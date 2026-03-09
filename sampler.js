const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var InterfaceSampler = class {
    constructor(rootPath = "/sys/class/net") {
        this._rootPath = rootPath;
        this._lastSample = null;
    }

    reset() {
        this._lastSample = null;
    }

    sample(preferredInterface = "") {
        const requestedInterface = preferredInterface.trim();
        const interfaceName = this._resolveInterface(requestedInterface);

        if (!interfaceName) {
            this._lastSample = null;
            return {
                available: false,
                requestedInterface,
                reason: "No usable network interface was found."
            };
        }

        const counters = this._readCounters(interfaceName);
        if (!counters) {
            this._lastSample = null;
            return {
                available: false,
                requestedInterface,
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
            requestedInterface,
            selectionMode: requestedInterface && requestedInterface === interfaceName ? "preferred" : "auto",
            selectionNote: requestedInterface && requestedInterface !== interfaceName
                ? `Preferred interface ${requestedInterface} was unavailable. Using ${interfaceName}.`
                : null,
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

    _resolveInterface(requestedInterface) {
        if (requestedInterface && this._hasCounters(requestedInterface)) {
            return requestedInterface;
        }

        return this._chooseAutoInterface();
    }

    _chooseAutoInterface() {
        const interfaces = this._listInterfaces();

        const preferredPhysical = interfaces.filter(name => name !== "lo" && this._readType(name) === 1 && this._readOperState(name) === "up");
        if (preferredPhysical.length > 0) {
            return preferredPhysical[0];
        }

        const activeInterfaces = interfaces.filter(name => name !== "lo" && this._readOperState(name) === "up");
        if (activeInterfaces.length > 0) {
            return activeInterfaces[0];
        }

        const standardInterfaces = interfaces.filter(name => name !== "lo" && this._readType(name) === 1);
        if (standardInterfaces.length > 0) {
            return standardInterfaces[0];
        }

        const nonLoopback = interfaces.filter(name => name !== "lo");
        if (nonLoopback.length > 0) {
            return nonLoopback[0];
        }

        return interfaces.includes("lo") ? "lo" : null;
    }

    _listInterfaces() {
        const root = Gio.File.new_for_path(this._rootPath);
        let enumerator = null;
        const names = [];

        try {
            enumerator = root.enumerate_children(
                "standard::name,standard::type",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info = null;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                    names.push(info.get_name());
                }
            }
        } catch (error) {
            global.logError(error, "Bandwidth Monitor: unable to enumerate network interfaces.");
        } finally {
            if (enumerator) {
                enumerator.close(null);
            }
        }

        names.sort();
        return names;
    }

    _hasCounters(interfaceName) {
        return this._readCounters(interfaceName) !== null;
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

    _readOperState(interfaceName) {
        return this._readText(`${this._rootPath}/${interfaceName}/operstate`) || "unknown";
    }

    _readType(interfaceName) {
        const value = this._readInteger(`${this._rootPath}/${interfaceName}/type`);
        return value === null ? -1 : value;
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