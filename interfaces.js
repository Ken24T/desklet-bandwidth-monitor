const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var InterfaceCatalog = class {
    constructor(rootPath = "/sys/class/net") {
        this._rootPath = rootPath;
    }

    list() {
        const root = Gio.File.new_for_path(this._rootPath);
        let enumerator = null;
        const interfaces = [];

        try {
            enumerator = root.enumerate_children(
                "standard::name,standard::type",
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let info = null;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() !== Gio.FileType.DIRECTORY) {
                    continue;
                }

                const name = info.get_name();
                const typeCode = this._readInteger(`${this._rootPath}/${name}/type`, -1);
                const operState = this._readText(`${this._rootPath}/${name}/operstate`) || "unknown";
                const classification = this._classify(name, typeCode);

                interfaces.push({
                    name,
                    typeCode,
                    operState,
                    classification,
                    label: `${classification.label} (${name})`,
                    isLoopback: classification.id === "loopback",
                    isTunnel: classification.id === "tunnel",
                    isNoise: classification.id === "virtual-noise",
                    isUp: operState === "up"
                });
            }
        } catch (error) {
            global.logError(error, "Bandwidth Monitor: unable to enumerate interfaces.");
        } finally {
            if (enumerator) {
                enumerator.close(null);
            }
        }

        interfaces.sort((left, right) => left.name.localeCompare(right.name));
        return interfaces;
    }

    resolveSelection(selectionMode = "auto", preferredInterface = "", includeTunnelInterfaces = false) {
        const interfaces = this.list();
        const requestedInterface = preferredInterface.trim();

        if (selectionMode === "preferred" && requestedInterface) {
            const preferred = interfaces.find(iface => iface.name === requestedInterface && !iface.isNoise);
            if (preferred) {
                return {
                    selected: preferred,
                    interfaces,
                    selectionMode: "preferred",
                    selectionNote: null
                };
            }
        }

        const selected = this._chooseAutoInterface(interfaces, includeTunnelInterfaces);
        const selectionNote = selectionMode === "preferred" && requestedInterface && selected
            ? `Preferred interface ${requestedInterface} isn't available right now. Showing ${selected.name} instead.`
            : null;

        return {
            selected,
            interfaces,
            selectionMode: selected ? "auto" : selectionMode,
            selectionNote
        };
    }

    _chooseAutoInterface(interfaces, includeTunnelInterfaces) {
        const preferredDefault = interfaces.filter(iface => this._isDefaultCandidate(iface, includeTunnelInterfaces));
        if (preferredDefault.length > 0) {
            return preferredDefault[0];
        }

        const standardInterfaces = interfaces.filter(iface => !iface.isLoopback && !iface.isNoise && (!iface.isTunnel || includeTunnelInterfaces));
        if (standardInterfaces.length > 0) {
            return standardInterfaces[0];
        }

        const nonLoopback = interfaces.filter(iface => !iface.isLoopback && !iface.isNoise);
        if (nonLoopback.length > 0) {
            return nonLoopback[0];
        }

        return interfaces.find(iface => iface.isLoopback) || null;
    }

    _isDefaultCandidate(iface, includeTunnelInterfaces) {
        if (iface.isLoopback || iface.isNoise) {
            return false;
        }

        if (iface.isTunnel && !includeTunnelInterfaces) {
            return false;
        }

        return iface.classification.id === "ethernet" || iface.classification.id === "wifi"
            ? iface.isUp || iface.operState === "unknown"
            : iface.isUp;
    }

    _classify(name, typeCode) {
        if (name === "lo" || typeCode === 772) {
            return { id: "loopback", label: "Loopback" };
        }

        if (/^(tun|tap|wg|ppp|vpn)/.test(name) || typeCode === 65534) {
            return { id: "tunnel", label: "VPN/Tunnel" };
        }

        if (/^(wl|wlan)/.test(name)) {
            return { id: "wifi", label: "Wi-Fi" };
        }

        if (/^(en|eth)/.test(name) || typeCode === 1) {
            return { id: "ethernet", label: "Ethernet" };
        }

        if (/^(veth|virbr|docker|br-|podman|vmnet)/.test(name)) {
            return { id: "virtual-noise", label: "Virtual" };
        }

        return { id: "other", label: "Interface" };
    }

    _readInteger(path, fallback = null) {
        const text = this._readText(path);
        if (text === null) {
            return fallback;
        }

        const value = parseInt(text, 10);
        return Number.isNaN(value) ? fallback : value;
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