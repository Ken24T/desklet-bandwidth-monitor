const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;

class BandwidthMonitorDesklet extends Desklet.Desklet {
    constructor(metadata, deskletId) {
        super(metadata, deskletId);

        this.metadata = metadata;
        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bind("sample-seconds", "sampleSeconds", this._syncView.bind(this));
        this.settings.bind("preferred-interface", "preferredInterface", this._syncView.bind(this));
        this.settings.bind("show-header", "showHeader", this._syncHeader.bind(this));

        this._contentBox = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor"
        });

        this._titleLabel = new St.Label({
            style_class: "bandwidth-monitor__title",
            text: "Bandwidth Monitor"
        });

        this._statusLabel = new St.Label({
            style_class: "bandwidth-monitor__status"
        });

        this._hintLabel = new St.Label({
            style_class: "bandwidth-monitor__hint",
            text: "Phase 0 scaffold ready. Live interface sampling arrives in the next milestone."
        });

        this._contentBox.add_child(this._titleLabel);
        this._contentBox.add_child(this._statusLabel);
        this._contentBox.add_child(this._hintLabel);

        this.setContent(this._contentBox);
        this._syncHeader();
        this._syncView();
    }

    _syncHeader() {
        const title = _("Bandwidth Monitor");

        this.setHeader(this.showHeader ? title : "");
        this._titleLabel.visible = this.showHeader;
    }

    _syncView() {
        const interfaceLabel = this.preferredInterface ? this.preferredInterface : _("auto");
        const sampleLabel = this.sampleSeconds || 1;

        this._statusLabel.set_text(
            `Scaffold configured for ${sampleLabel}s sampling on ${interfaceLabel}.`
        );
    }

    on_desklet_removed() {
        this.settings = null;
    }
}

function main(metadata, deskletId) {
    return new BandwidthMonitorDesklet(metadata, deskletId);
}