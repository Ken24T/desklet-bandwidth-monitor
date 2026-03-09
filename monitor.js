const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;

const Interfaces = imports.interfaces;

var SessionMonitor = class {
    constructor(rootPath = "/sys/class/net") {
        this._rootPath = rootPath;
        this._catalog = new Interfaces.InterfaceCatalog(rootPath);
        this._previousByInterface = {};
        this._totalsByInterface = {};
    }

    reset() {
        this._previousByInterface = {};
        this._totalsByInterface = {};
    }

    sample(config = {}) {
        const selection = this._catalog.resolveSelection(
            config.selectionMode || "auto",
            config.preferredInterface || "",
            Boolean(config.includeTunnelInterfaces)
        );
        const visibleInterfaces = this._resolveVisibleInterfaces(
            selection.interfaces,
            selection.selected,
            config.visibleInterfaces || "",
            Boolean(config.includeTunnelInterfaces)
        );
        const nowUs = GLib.get_monotonic_time();
        const rows = visibleInterfaces.map(interfaceInfo => this._buildRow(interfaceInfo, nowUs, selection));
        const availableRows = rows.filter(row => row.available);

        return {
            availableInterfaces: selection.interfaces,
            selectedInterface: selection.selected,
            selectionMode: selection.selectionMode,
            selectionNote: selection.selectionNote,
            rows,
            aggregate: this._buildAggregateRow(availableRows),
            hasVisibleRows: rows.length > 0
        };
    }

    _resolveVisibleInterfaces(interfaces, selectedInterface, visibleInterfacesSetting, includeTunnelInterfaces) {
        const requested = visibleInterfacesSetting
            .split(",")
            .map(name => name.trim())
            .filter(Boolean);

        if (requested.length > 0) {
            const resolved = requested
                .map(name => interfaces.find(iface => iface.name === name))
                .filter(iface => Boolean(iface) && !iface.isNoise);

            if (selectedInterface && !resolved.some(iface => iface.name === selectedInterface.name)) {
                resolved.unshift(selectedInterface);
            }

            return resolved;
        }

        const defaults = interfaces.filter(iface => {
            if (iface.isLoopback || iface.isNoise) {
                return false;
            }

            if (iface.isTunnel && !includeTunnelInterfaces) {
                return false;
            }

            return true;
        });

        if (selectedInterface && !defaults.some(iface => iface.name === selectedInterface.name)) {
            defaults.unshift(selectedInterface);
        }

        return defaults;
    }

    _buildRow(interfaceInfo, nowUs, selection) {
        const counters = this._readCounters(interfaceInfo.name);
        if (!counters) {
            delete this._previousByInterface[interfaceInfo.name];
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
                hasRate: false
            };
        }

        const previous = this._previousByInterface[interfaceInfo.name] || null;
        const totals = this._totalsByInterface[interfaceInfo.name] || { rx: 0, tx: 0 };
        let rxRate = 0;
        let txRate = 0;
        let hasRate = false;
        let footer = `Sampling counters from /sys/class/net/${interfaceInfo.name}/statistics/.`;

        if (previous && nowUs > previous.timeUs) {
            const elapsedSeconds = (nowUs - previous.timeUs) / 1000000;
            const rxDelta = counters.rxBytes - previous.rxBytes;
            const txDelta = counters.txBytes - previous.txBytes;

            if (rxDelta >= 0 && txDelta >= 0) {
                rxRate = rxDelta / elapsedSeconds;
                txRate = txDelta / elapsedSeconds;
                totals.rx += rxDelta;
                totals.tx += txDelta;
                hasRate = true;
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
            hasRate
        };
    }

    _buildAggregateRow(rows) {
        if (rows.length === 0) {
            return {
                available: false,
                title: "Group All Interfaces",
                state: "idle",
                rxRate: 0,
                txRate: 0,
                totalRxBytes: 0,
                totalTxBytes: 0,
                footer: "No visible interfaces are currently contributing to the aggregate."
            };
        }

        return rows.reduce((result, row) => {
            result.rxRate += row.hasRate ? row.rxRate : 0;
            result.txRate += row.hasRate ? row.txRate : 0;
            result.totalRxBytes += row.totalRxBytes;
            result.totalTxBytes += row.totalTxBytes;
            return result;
        }, {
            available: true,
            title: "Group All Interfaces",
            state: `${rows.length} rows`,
            rxRate: 0,
            txRate: 0,
            totalRxBytes: 0,
            totalTxBytes: 0,
            footer: "Combined live rates and session totals for the currently visible interfaces."
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