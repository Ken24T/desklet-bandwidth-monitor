const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Interfaces = imports.interfaces;

var InterfaceSampler = class {
    constructor(rootPath = "/sys/class/net") {
        this._rootPath = rootPath;
        this._catalog = new Interfaces.InterfaceCatalog(rootPath);
        this._lastSample = null;
    }

    reset() {
        this._lastSample = null;
    }

    sample(options = {}) {
        const requestedInterface = (options.preferredInterface || "").trim();
        const selectionMode = options.selectionMode || "auto";
        const includeTunnelInterfaces = Boolean(options.includeTunnelInterfaces);
        const selection = this._catalog.resolveSelection(selectionMode, requestedInterface, includeTunnelInterfaces);
        const selectedInterface = selection.selected;

        if (!selectedInterface) {
            this._lastSample = null;
            return {
                available: false,
                requestedInterface,
                availableInterfaces: selection.interfaces,
                reason: "No usable network interface was found."
            };
        }

        const interfaceName = selectedInterface.name;
        const counters = this._readCounters(interfaceName);
        if (!counters) {
            this._lastSample = null;
            return {
                available: false,
                requestedInterface,
                availableInterfaces: selection.interfaces,
                reason: `Unable to read counters for ${interfaceName}.`
            };
        }

        const nowUs = GLib.get_monotonic_time();
        const previous = this._lastSample && this._lastSample.interfaceName === interfaceName
            ? this._lastSample
            : null;

        const result = {
            available: true,
            interfaceName,
            interfaceLabel: selectedInterface.label,
            interfaceInfo: selectedInterface,
            requestedInterface,
            availableInterfaces: selection.interfaces,
            selectionMode: selection.selectionMode,
            selectionNote: selection.selectionNote,
            rxBytes: counters.rxBytes,
            txBytes: counters.txBytes,
            rxRate: 0,
            txRate: 0,
            hasRate: false,
            counterReset: false,
            elapsedSeconds: null
        };

        if (previous && nowUs > previous.timeUs) {
            const elapsedSeconds = (nowUs - previous.timeUs) / 1000000;
            const rxDelta = counters.rxBytes - previous.rxBytes;
            const txDelta = counters.txBytes - previous.txBytes;

            result.elapsedSeconds = elapsedSeconds;

            if (rxDelta >= 0 && txDelta >= 0) {
                result.rxRate = rxDelta / elapsedSeconds;
                result.txRate = txDelta / elapsedSeconds;
                result.hasRate = true;
            } else {
                result.counterReset = true;
            }
        }

        this._lastSample = {
            interfaceName,
            rxBytes: counters.rxBytes,
            txBytes: counters.txBytes,
            timeUs: nowUs
        };

        return result;
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