const St = imports.gi.St;
const Mainloop = imports.mainloop;

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const Sampler = imports.sampler;

class BandwidthMonitorDesklet extends Desklet.Desklet {
    constructor(metadata, deskletId) {
        super(metadata, deskletId);

        this.metadata = metadata;
        this._sampleTimeoutId = 0;
        this._sampler = new Sampler.InterfaceSampler();
        this._lastAvailableInterfaces = [];

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bind("sample-seconds", "sampleSeconds", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("selection-mode", "selectionMode", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("preferred-interface", "preferredInterface", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("include-tunnel-interfaces", "includeTunnelInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("show-header", "showHeader", this._syncHeader.bind(this));

        this._buildShell();
        this._syncHeader();
        this._renderUnavailable(null);
    }

    _buildShell() {
        this._contentBox = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor"
        });

        this._titleLabel = new St.Label({
            style_class: "bandwidth-monitor__title",
            text: _("Bandwidth Monitor")
        });

        this._statusLabel = new St.Label({
            style_class: "bandwidth-monitor__status"
        });

        this._panelBox = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__panel"
        });

        this._primaryRow = this._createPlaceholderRow(_("Primary Interface"), _("RX"), _("TX"));
        this._aggregateRow = this._createPlaceholderRow(_("Group All Interfaces"), _("RX total"), _("TX total"));

        this._hintLabel = new St.Label({
            style_class: "bandwidth-monitor__hint"
        });

        this._inventoryLabel = new St.Label({
            style_class: "bandwidth-monitor__inventory"
        });

        this._contentBox.add_child(this._titleLabel);
        this._contentBox.add_child(this._statusLabel);
        this._panelBox.add_child(this._primaryRow.container);
        this._panelBox.add_child(this._aggregateRow.container);
        this._contentBox.add_child(this._panelBox);
        this._contentBox.add_child(this._hintLabel);
        this._contentBox.add_child(this._inventoryLabel);

        this.setContent(this._contentBox);
    }

    _createPlaceholderRow(title, rxLabel, txLabel) {
        const container = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__row"
        });

        const header = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__row-header"
        });
        const titleLabel = new St.Label({
            style_class: "bandwidth-monitor__row-title",
            text: title
        });
        const stateLabel = new St.Label({
            style_class: "bandwidth-monitor__row-state",
            text: _("planned")
        });

        header.add_child(titleLabel);
        header.add_child(stateLabel);

        const metrics = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__metrics"
        });
        const rxValue = this._createMetric(rxLabel, "--");
        const txValue = this._createMetric(txLabel, "--");

        metrics.add_child(rxValue.container);
        metrics.add_child(txValue.container);

        const footer = new St.Label({
            style_class: "bandwidth-monitor__row-footer",
            text: _("Waiting for live sampling in the next milestone.")
        });

        container.add_child(header);
        container.add_child(metrics);
        container.add_child(footer);

        return {
            container,
            titleLabel,
            stateLabel,
            footer,
            rxValue,
            txValue
        };
    }

    _createMetric(label, value) {
        const container = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__metric"
        });
        const labelWidget = new St.Label({
            style_class: "bandwidth-monitor__metric-label",
            text: label
        });
        const valueWidget = new St.Label({
            style_class: "bandwidth-monitor__metric-value",
            text: value
        });

        container.add_child(labelWidget);
        container.add_child(valueWidget);

        return {
            container,
            labelWidget,
            valueWidget
        };
    }

    _syncHeader() {
        const title = _("Bandwidth Monitor");

        this.setHeader(this.showHeader ? title : "");
        this._titleLabel.visible = this.showHeader;
    }

    _onSamplingSettingsChanged() {
        this._sampler.reset();
        this._restartSampling();
        this._tickSample();
    }

    _restartSampling() {
        if (this._sampleTimeoutId > 0) {
            Mainloop.source_remove(this._sampleTimeoutId);
            this._sampleTimeoutId = 0;
        }

        const intervalSeconds = this._getSampleInterval();
        this._sampleTimeoutId = Mainloop.timeout_add_seconds(intervalSeconds, () => this._tickSample());
    }

    _getSampleInterval() {
        return Math.max(1, this.sampleSeconds || 1);
    }

    _tickSample() {
        const measurement = this._sampler.sample({
            selectionMode: this.selectionMode || "auto",
            preferredInterface: this.preferredInterface || "",
            includeTunnelInterfaces: this.includeTunnelInterfaces
        });

        this._lastAvailableInterfaces = measurement.availableInterfaces || [];

        if (!measurement.available) {
            this._renderUnavailable(measurement.reason || "No interface available.");
            return true;
        }

        if (measurement.counterReset) {
            this._renderWaiting(measurement, "Counter change detected. Waiting for the next sample.");
            return true;
        }

        if (!measurement.hasRate) {
            this._renderWaiting(measurement, "Collecting the second sample needed to calculate live rates.");
            return true;
        }

        this._renderMeasurement(measurement);
        return true;
    }

    _renderUnavailable(reason) {
        const requestedInterface = this.preferredInterface ? this.preferredInterface : "auto";
        const sampleLabel = this._getSampleInterval();

        this._statusLabel.set_text(`Waiting for a usable interface at ${sampleLabel}s sampling.`);
        this._primaryRow.titleLabel.set_text(`Primary Interface (${requestedInterface})`);
        this._primaryRow.stateLabel.set_text("unavailable");
        this._primaryRow.rxValue.valueWidget.set_text("--");
        this._primaryRow.txValue.valueWidget.set_text("--");
        this._primaryRow.footer.set_text(reason || "No interface is currently available.");

        this._aggregateRow.container.visible = false;
        this._hintLabel.set_text("Single-interface live monitoring is active in this phase. Multi-interface totals arrive later.");
        this._syncInterfaceInventory();
    }

    _renderWaiting(measurement, footerText) {
        this._statusLabel.set_text(`Monitoring ${measurement.interfaceLabel} every ${this._getSampleInterval()}s.`);
        this._primaryRow.titleLabel.set_text(measurement.interfaceLabel);
        this._primaryRow.stateLabel.set_text(measurement.selectionMode === "preferred" ? "preferred" : "auto");
        this._primaryRow.rxValue.valueWidget.set_text("--");
        this._primaryRow.txValue.valueWidget.set_text("--");
        this._primaryRow.footer.set_text(measurement.selectionNote || footerText);

        this._aggregateRow.container.visible = false;
        this._hintLabel.set_text("Live RX and TX text values are enabled for one interface in this phase.");
        this._syncInterfaceInventory();
    }

    _renderMeasurement(measurement) {
        this._statusLabel.set_text(`Monitoring ${measurement.interfaceLabel} every ${this._getSampleInterval()}s.`);
        this._primaryRow.titleLabel.set_text(measurement.interfaceLabel);
        this._primaryRow.stateLabel.set_text(measurement.selectionMode === "preferred" ? "preferred" : "auto");
        this._primaryRow.rxValue.valueWidget.set_text(this._formatRate(measurement.rxRate));
        this._primaryRow.txValue.valueWidget.set_text(this._formatRate(measurement.txRate));
        this._primaryRow.footer.set_text(
            measurement.selectionNote || `Sampling counters from /sys/class/net/${measurement.interfaceName}/statistics/.`
        );

        this._aggregateRow.container.visible = false;
        this._hintLabel.set_text("Live RX and TX text values are enabled for one interface in this phase.");
        this._syncInterfaceInventory();
    }

    _syncInterfaceInventory() {
        if (this._lastAvailableInterfaces.length === 0) {
            this._inventoryLabel.set_text("No interfaces discovered yet.");
            return;
        }

        const summary = this._lastAvailableInterfaces
            .filter(iface => !iface.isNoise)
            .map(iface => `${iface.label} [${iface.operState}]`)
            .join(" | ");

        this._inventoryLabel.set_text(`Available interfaces: ${summary}`);
    }

    _formatRate(bytesPerSecond) {
        const units = ["B/s", "KB/s", "MB/s", "GB/s"];
        let value = Math.max(0, bytesPerSecond);
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }

        const decimals = value >= 100 || unitIndex === 0 ? 0 : 1;
        return `${value.toFixed(decimals)} ${units[unitIndex]}`;
    }

    on_desklet_added_to_desktop() {
        this._syncHeader();
        this._restartSampling();
        this._tickSample();
    }

    on_desklet_removed() {
        if (this._sampleTimeoutId > 0) {
            Mainloop.source_remove(this._sampleTimeoutId);
            this._sampleTimeoutId = 0;
        }

        this._sampler.reset();
        this.settings = null;
    }
}

function main(metadata, deskletId) {
    return new BandwidthMonitorDesklet(metadata, deskletId);
}