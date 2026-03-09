const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;

class BandwidthMonitorDesklet extends Desklet.Desklet {
    constructor(metadata, deskletId) {
        super(metadata, deskletId);

        this.metadata = metadata;
        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bind("sample-seconds", "sampleSeconds", this._syncShell.bind(this));
        this.settings.bind("preferred-interface", "preferredInterface", this._syncShell.bind(this));
        this.settings.bind("show-header", "showHeader", this._syncHeader.bind(this));

        this._buildShell();
        this._syncHeader();
        this._syncShell();
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

        this._contentBox.add_child(this._titleLabel);
        this._contentBox.add_child(this._statusLabel);
        this._panelBox.add_child(this._primaryRow.container);
        this._panelBox.add_child(this._aggregateRow.container);
        this._contentBox.add_child(this._panelBox);
        this._contentBox.add_child(this._hintLabel);

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

    _syncShell() {
        const interfaceLabel = this.preferredInterface ? this.preferredInterface : _("auto");
        const sampleLabel = this.sampleSeconds || 1;

        this._statusLabel.set_text(_(`Static shell configured for ${sampleLabel}s sampling on ${interfaceLabel}.`));
        this._primaryRow.titleLabel.set_text(_(`Primary Interface (${interfaceLabel})`));
        this._primaryRow.stateLabel.set_text(_(`sample ${sampleLabel}s`));
        this._primaryRow.footer.set_text(_("Static shell only. Live RX and TX values arrive in Phase 2."));

        this._aggregateRow.stateLabel.set_text(_("planned aggregate"));
        this._aggregateRow.footer.set_text(_("Group totals and multi-interface display arrive in later phases."));

        this._hintLabel.set_text(
            _("This desklet now provides a stable row-based shell and settings wiring without live traffic sampling.")
        );
    }

    on_desklet_added_to_desktop() {
        this._syncHeader();
        this._syncShell();
    }

    on_desklet_removed() {
        this.settings = null;
    }
}

function main(metadata, deskletId) {
    return new BandwidthMonitorDesklet(metadata, deskletId);
}