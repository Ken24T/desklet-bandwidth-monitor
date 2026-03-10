const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

const Interfaces = imports.interfaces;

var SessionMonitor = class {
    constructor(rootPath = "/sys/class/net") {
        this._rootPath = rootPath;
        this._catalog = new Interfaces.InterfaceCatalog(rootPath);
        this._previousByInterface = {};
        this._totalsByInterface = {};
        this._historyByInterface = {};
        this._aggregateHistory = { rx: [], tx: [] };
    }

    reset() {
        this._previousByInterface = {};
        this._totalsByInterface = {};
        this._historyByInterface = {};
        this._aggregateHistory = { rx: [], tx: [] };
    }

    resetInterface(interfaceName) {
        const counters = this._readCounters(interfaceName);

        this._totalsByInterface[interfaceName] = { rx: 0, tx: 0 };

        if (counters) {
            this._previousByInterface[interfaceName] = {
                rxBytes: counters.rxBytes,
                txBytes: counters.txBytes,
                timeUs: GLib.get_monotonic_time()
            };
            return;
        }

        delete this._previousByInterface[interfaceName];
    }

    sample(config = {}) {
        const selection = this._catalog.resolveSelection(
            config.selectionMode || "auto",
            config.preferredInterface || "",
            Boolean(config.includeTunnelInterfaces)
        );
        this._clearMissingPrevious(selection.interfaces.map(iface => iface.name));
        const visibleInterfaces = this._resolveVisibleInterfaces(
            selection.interfaces,
            selection.selected,
            Boolean(config.includeTunnelInterfaces),
            Boolean(config.includeLoopbackInterfaces)
        );
        const nowUs = GLib.get_monotonic_time();
        const historyLength = Math.max(10, config.historyLength || 60);
        const smoothingMode = config.smoothingMode || "moving-average";
        const rows = visibleInterfaces.map(interfaceInfo => this._buildRow(interfaceInfo, nowUs, selection, historyLength, smoothingMode));
        const availableRows = rows.filter(row => row.available);
        const aggregate = this._buildAggregateRow(availableRows, historyLength, smoothingMode);

        return {
            availableInterfaces: selection.interfaces,
            selectedInterface: selection.selected,
            selectionMode: selection.selectionMode,
            selectionNote: selection.selectionNote,
            rows,
            aggregate,
            hasVisibleRows: rows.length > 0
        };
    }

    _resolveVisibleInterfaces(interfaces, selectedInterface, includeTunnelInterfaces, includeLoopbackInterfaces) {
        const defaults = interfaces.filter(iface => {
            if (iface.isNoise) {
                return false;
            }

            if (iface.isLoopback && !includeLoopbackInterfaces) {
                return false;
            }

            return true;
        });

        if (selectedInterface && !defaults.some(iface => iface.name === selectedInterface.name)) {
            defaults.unshift(selectedInterface);
        }

        return defaults;
    }

    _buildRow(interfaceInfo, nowUs, selection, historyLength, smoothingMode) {
        const counters = this._readCounters(interfaceInfo.name);
        if (!counters) {
            delete this._previousByInterface[interfaceInfo.name];
            const history = this._appendHistory(interfaceInfo.name, 0, 0, historyLength, smoothingMode);
            return {
                available: false,
                interfaceInfo,
                title: interfaceInfo.label,
                state: "unavailable",
                rxRate: 0,
                txRate: 0,
                totalRxBytes: this._totalsByInterface[interfaceInfo.name]?.rx || 0,
                totalTxBytes: this._totalsByInterface[interfaceInfo.name]?.tx || 0,
                footer: `Unable to read counters for ${interfaceInfo.name}.`,
                selected: selection.selected && selection.selected.name === interfaceInfo.name,
                hasRate: false,
                rxHistory: history.rx,
                txHistory: history.tx
            };
        }

        const previous = this._previousByInterface[interfaceInfo.name] || null;
        const totals = this._totalsByInterface[interfaceInfo.name] || { rx: 0, tx: 0 };
        let rxRate = 0;
        let txRate = 0;
        let hasRate = false;
        let footer = "";
        let spikeSuppressed = false;

        if (previous && nowUs > previous.timeUs) {
            const elapsedSeconds = (nowUs - previous.timeUs) / 1000000;
            const rxDelta = counters.rxBytes - previous.rxBytes;
            const txDelta = counters.txBytes - previous.txBytes;

            if (rxDelta >= 0 && txDelta >= 0) {
                rxRate = rxDelta / elapsedSeconds;
                txRate = txDelta / elapsedSeconds;
                const stabilised = this._stabiliseRates(interfaceInfo.name, rxRate, txRate);
                rxRate = stabilised.rxRate;
                txRate = stabilised.txRate;
                spikeSuppressed = stabilised.suppressed;

                if (!spikeSuppressed) {
                    totals.rx += rxDelta;
                    totals.tx += txDelta;
                }

                hasRate = true;

                if (spikeSuppressed) {
                    footer = "Spike suppressed to avoid displaying an implausible burst sample.";
                }
            } else {
                footer = "Counter reset detected. Waiting for the next stable sample.";
            }
        } else {
            footer = "Collecting the second sample needed for live rates and session totals.";
        }

        this._previousByInterface[interfaceInfo.name] = {
            rxBytes: counters.rxBytes,
            txBytes: counters.txBytes,
            timeUs: nowUs
        };
        this._totalsByInterface[interfaceInfo.name] = totals;

        const state = selection.selected && selection.selected.name === interfaceInfo.name
            ? (selection.selectionMode === "preferred" ? "preferred" : "auto")
            : interfaceInfo.operState;

        const history = this._appendHistory(
            interfaceInfo.name,
            hasRate ? rxRate : 0,
            hasRate ? txRate : 0,
            historyLength,
            smoothingMode
        );

        return {
            available: true,
            interfaceInfo,
            title: interfaceInfo.label,
            state,
            rxRate,
            txRate,
            totalRxBytes: totals.rx,
            totalTxBytes: totals.tx,
            footer: selection.selected && selection.selected.name === interfaceInfo.name && selection.selectionNote
                ? selection.selectionNote
                : footer,
            selected: selection.selected && selection.selected.name === interfaceInfo.name,
            hasRate,
            rxHistory: history.rx,
            txHistory: history.tx
        };
    }

    _buildAggregateRow(rows, historyLength, smoothingMode) {
        if (rows.length === 0) {
            const history = this._appendAggregateHistory(0, 0, historyLength, smoothingMode);
            return {
                available: false,
                title: "Group All",
                state: "idle",
                rxRate: 0,
                txRate: 0,
                totalRxBytes: 0,
                totalTxBytes: 0,
                footer: "No visible interfaces are currently contributing to the aggregate.",
                rxHistory: history.rx,
                txHistory: history.tx
            };
        }

        const aggregate = rows.reduce((result, row) => {
            result.rxRate += row.hasRate ? row.rxRate : 0;
            result.txRate += row.hasRate ? row.txRate : 0;
            result.totalRxBytes += row.totalRxBytes;
            result.totalTxBytes += row.totalTxBytes;
            return result;
        }, {
            available: true,
            title: "Group All",
            state: `${rows.length} rows`,
            rxRate: 0,
            txRate: 0,
            totalRxBytes: 0,
            totalTxBytes: 0,
            footer: ""
        });

        const history = this._appendAggregateHistory(aggregate.rxRate, aggregate.txRate, historyLength, smoothingMode);
        aggregate.rxHistory = history.rx;
        aggregate.txHistory = history.tx;
        return aggregate;
    }

    _appendHistory(key, rxValue, txValue, historyLength, smoothingMode) {
        if (!this._historyByInterface[key]) {
            this._historyByInterface[key] = { rx: [], tx: [] };
        }

        this._pushValue(this._historyByInterface[key].rx, rxValue, historyLength);
        this._pushValue(this._historyByInterface[key].tx, txValue, historyLength);

        return {
            rx: this._smoothSeries(this._historyByInterface[key].rx, smoothingMode),
            tx: this._smoothSeries(this._historyByInterface[key].tx, smoothingMode)
        };
    }

    _clearMissingPrevious(availableNames) {
        const available = new Set(availableNames);

        Object.keys(this._previousByInterface).forEach(name => {
            if (!available.has(name)) {
                delete this._previousByInterface[name];
            }
        });
    }

    _stabiliseRates(key, rxRate, txRate) {
        const history = this._historyByInterface[key] || { rx: [], tx: [] };
        const baselineRx = this._averagePositiveTail(history.rx, 5);
        const baselineTx = this._averagePositiveTail(history.tx, 5);
        let suppressed = false;

        if (baselineRx > 1024 && rxRate > Math.max(1024 * 1024, baselineRx * 20)) {
            rxRate = baselineRx;
            suppressed = true;
        }

        if (baselineTx > 1024 && txRate > Math.max(1024 * 1024, baselineTx * 20)) {
            txRate = baselineTx;
            suppressed = true;
        }

        return { rxRate, txRate, suppressed };
    }

    _averagePositiveTail(series, count) {
        const values = series.filter(value => value > 0).slice(-count);
        if (values.length === 0) {
            return 0;
        }

        return values.reduce((result, value) => result + value, 0) / values.length;
    }

    _appendAggregateHistory(rxValue, txValue, historyLength, smoothingMode) {
        this._pushValue(this._aggregateHistory.rx, rxValue, historyLength);
        this._pushValue(this._aggregateHistory.tx, txValue, historyLength);

        return {
            rx: this._smoothSeries(this._aggregateHistory.rx, smoothingMode),
            tx: this._smoothSeries(this._aggregateHistory.tx, smoothingMode)
        };
    }

    _pushValue(series, value, historyLength) {
        series.push(Math.max(0, value));
        while (series.length > historyLength) {
            series.shift();
        }
    }

    _smoothSeries(series, mode) {
        if (mode === "none") {
            return series.slice();
        }

        if (mode === "exponential") {
            const smoothed = [];
            let previous = series[0] || 0;
            const alpha = 0.35;

            series.forEach(value => {
                previous = (alpha * value) + ((1 - alpha) * previous);
                smoothed.push(previous);
            });

            return smoothed;
        }

        return series.map((value, index) => {
            const start = Math.max(0, index - 2);
            const window = series.slice(start, index + 1);
            const sum = window.reduce((result, item) => result + item, 0);
            return sum / window.length;
        });
    }

    _readCounters(interfaceName) {
        const basePath = `${this._rootPath}/${interfaceName}/statistics`;
        const rxBytes = this._readInteger(`${basePath}/rx_bytes`);
        const txBytes = this._readInteger(`${basePath}/tx_bytes`);

        if (rxBytes === null || txBytes === null) {
            return null;
        }

        return { rxBytes, txBytes };
    }

    _readInteger(path) {
        const text = this._readText(path);
        if (text === null) {
            return null;
        }

        const value = parseInt(text, 10);
        return Number.isNaN(value) ? null : value;
    }

    _readText(path) {
        try {
            const [ok, contents] = GLib.file_get_contents(path);
            if (!ok) {
                return null;
            }

            return ByteArray.toString(contents).trim();
        } catch (error) {
            return null;
        }
    }
};