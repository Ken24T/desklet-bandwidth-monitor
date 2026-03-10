const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const Main = imports.ui.main;

const UUID = "bandwidth-monitor@Ken24T";
const DeskletManager = imports.ui.deskletManager;
const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;

const ENABLED_DESKLETS_KEY = "enabled-desklets";
const DEFAULT_PRIMARY_MONITOR_MARGIN = 48;

const deskletMeta = DeskletManager.deskletMeta[UUID] || null;
const deskletDir = deskletMeta
    ? deskletMeta.path
    : GLib.build_filenamev([GLib.get_home_dir(), ".local", "share", "cinnamon", "desklets", UUID]);

imports.searchPath.unshift(deskletDir);

const Formatting = imports.formatting;
const Monitor = imports.monitor;
const Sparkline = imports.sparkline;

Gettext.bindtextdomain(UUID, GLib.build_filenamev([deskletDir, "locale"]));

function _(text) {
    return Gettext.dgettext(UUID, text);
}

class BandwidthMonitorDesklet extends Desklet.Desklet {
    constructor(metadata, deskletId) {
        super(metadata, deskletId);

        this.metadata = metadata;
        this._sampleTimeoutId = 0;
        this._monitor = new Monitor.SessionMonitor();
        this._lastAvailableInterfaces = [];
        this._rowsByKey = {};

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bind("sample-seconds", "sampleSeconds", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("selection-mode", "selectionMode", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("preferred-interface", "preferredInterface", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("include-tunnel-interfaces", "includeTunnelInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("visible-interfaces", "visibleInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("show-group-all", "showGroupAll", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("rate-unit-mode", "rateUnitMode", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-labels", "showLabels", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-totals", "showTotals", this._syncDisplaySettings.bind(this));
        this.settings.bind("font-scale", "fontScale", this._syncDisplaySettings.bind(this));
        this.settings.bind("row-spacing", "rowSpacing", this._syncDisplaySettings.bind(this));
        this.settings.bind("content-alignment", "contentAlignment", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-interface-inventory", "showInterfaceInventory", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-sparklines", "showSparklines", this._syncDisplaySettings.bind(this));
        this.settings.bind("history-length", "historyLength", this._syncDisplaySettings.bind(this));
        this.settings.bind("smoothing-mode", "smoothingMode", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-header", "showHeader", this._syncHeader.bind(this));

        this._buildShell();
        this._syncHeader();
        this._syncDisplaySettings();
        this._renderUnavailable("Waiting for an initial monitor sample.");
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

        this._panelBox = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__panel"
        });

        this._inventoryLabel = new St.Label({
            style_class: "bandwidth-monitor__inventory"
        });
        this._inventoryLabel.clutter_text.line_wrap = true;
        this._inventoryLabel.clutter_text.ellipsize = 0;

        this._contentBox.add_child(this._titleLabel);
        this._contentBox.add_child(this._panelBox);
        this._contentBox.add_child(this._inventoryLabel);

        this.setContent(this._contentBox);
    }

    _createRowWidget(title) {
        const container = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__row"
        });

        const header = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__row-header"
        });
        const headerInfo = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__row-header-info"
        });
        const liveMetrics = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__row-live-metrics"
        });
        const titleLabel = new St.Label({
            style_class: "bandwidth-monitor__row-title",
            text: title
        });
        const stateLabel = new St.Label({
            style_class: "bandwidth-monitor__row-state",
            text: _("planned")
        });

        headerInfo.add_child(titleLabel);
        headerInfo.add_child(stateLabel);

        const totalsRow = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__totals"
        });
        const totalsTitleLabel = new St.Label({
            style_class: "bandwidth-monitor__totals-title",
            text: _("Totals:")
        });
        const rxValue = this._createMetric(_("RX"), "--", true);
        const txValue = this._createMetric(_("TX"), "--", true);
        const totalRxValue = this._createInlineMetric(_("RX"), "--");
        const totalTxValue = this._createInlineMetric(_("TX"), "--");

        liveMetrics.add_child(rxValue.container);
        liveMetrics.add_child(txValue.container);
        header.add_child(headerInfo);
        header.add_child(liveMetrics);
        totalsRow.add_child(totalsTitleLabel);
        totalsRow.add_child(totalRxValue.container);
        totalsRow.add_child(totalTxValue.container);

        const footer = new St.Label({
            style_class: "bandwidth-monitor__row-footer",
            text: _("Waiting for the first stable sample.")
        });
        footer.clutter_text.line_wrap = true;
        footer.clutter_text.ellipsize = 0;
        const sparkline = new Sparkline.SparklineView();

        container.add_child(header);
        container.add_child(totalsRow);
        container.add_child(sparkline.actor);
        container.add_child(footer);

        return {
            container,
            titleLabel,
            stateLabel,
            header,
            headerInfo,
            liveMetrics,
            totalsRow,
            totalsTitleLabel,
            sparkline,
            footer,
            rxValue,
            txValue,
            totalRxValue,
            totalTxValue
        };
    }

    _createMetric(label, value, compact = false) {
        const container = new St.BoxLayout({
            vertical: !compact,
            style_class: compact
                ? "bandwidth-monitor__metric bandwidth-monitor__metric--compact"
                : "bandwidth-monitor__metric"
        });
        const labelWidget = new St.Label({
            style_class: compact
                ? "bandwidth-monitor__metric-label bandwidth-monitor__metric-label--compact"
                : "bandwidth-monitor__metric-label",
            text: label
        });
        const valueWidget = new St.Label({
            style_class: compact
                ? "bandwidth-monitor__metric-value bandwidth-monitor__metric-value--compact"
                : "bandwidth-monitor__metric-value",
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

    _createInlineMetric(label, value) {
        const container = new St.BoxLayout({
            vertical: false,
            style_class: "bandwidth-monitor__inline-metric"
        });
        const labelWidget = new St.Label({
            style_class: "bandwidth-monitor__inline-metric-label",
            text: label
        });
        const valueWidget = new St.Label({
            style_class: "bandwidth-monitor__inline-metric-value",
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

    _syncDisplaySettings() {
        const fontScale = this.fontScale || 1;
        const spacing = this.rowSpacing || 10;
        const alignment = this._resolveAlignment(this.contentAlignment || "left");

        this._contentBox.style = `spacing: ${spacing}px;`;
        this._panelBox.style = `spacing: ${spacing}px;`;
        this._titleLabel.style = `font-size: ${1.15 * fontScale}em;`;
        this._inventoryLabel.style = `font-size: ${0.84 * fontScale}em; color: rgba(255, 255, 255, 0.64);`;
        this._titleLabel.x_align = alignment;
        this._inventoryLabel.x_align = alignment;
        this._inventoryLabel.visible = this.showInterfaceInventory;

        Object.values(this._rowsByKey).forEach(widget => this._applyRowDisplaySettings(widget, fontScale, spacing, alignment));
        this._tickSample();
    }

    _onSamplingSettingsChanged() {
        this._monitor.reset();
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
        const snapshot = this._monitor.sample({
            selectionMode: this.selectionMode || "auto",
            preferredInterface: this.preferredInterface || "",
            includeTunnelInterfaces: this.includeTunnelInterfaces,
            visibleInterfaces: this.visibleInterfaces || "",
            historyLength: this.historyLength || 60,
            smoothingMode: this.smoothingMode || "moving-average"
        });

        this._lastAvailableInterfaces = snapshot.availableInterfaces || [];

        if (!snapshot.hasVisibleRows) {
            this._renderUnavailable("No visible interfaces are currently selected.");
            return true;
        }

        this._renderSnapshot(snapshot);
        return true;
    }

    _renderUnavailable(reason) {
        this._hideAllRows();
        this._syncInterfaceInventory(reason);
    }

    _renderSnapshot(snapshot) {
        this._syncRowWidgets(snapshot.rows, snapshot.aggregate);
        this._syncInterfaceInventory();
    }

    _syncRowWidgets(rows, aggregate) {
        const visibleKeys = [];

        rows.forEach(row => {
            const key = `row:${row.interfaceInfo.name}`;
            const widget = this._ensureRowWidget(key, row.title);
            visibleKeys.push(key);

            widget.titleLabel.set_text(row.title);
            widget.stateLabel.set_text(row.state);
            widget.rxValue.valueWidget.set_text(row.hasRate ? this._formatRate(row.rxRate) : "--");
            widget.txValue.valueWidget.set_text(row.hasRate ? this._formatRate(row.txRate) : "--");
            widget.totalRxValue.valueWidget.set_text(this._formatBytes(row.totalRxBytes));
            widget.totalTxValue.valueWidget.set_text(this._formatBytes(row.totalTxBytes));
            widget.footer.set_text(row.footer);
            widget.footer.visible = Boolean(row.footer);
            widget.sparkline.update(row.rxHistory, row.txHistory, {
                visible: this.showSparklines,
                height: Math.max(32, Math.round(34 * (this.fontScale || 1)))
            });
            widget.container.visible = true;
        });

        if (this.showGroupAll) {
            const key = "aggregate";
            const widget = this._ensureRowWidget(key, aggregate.title);
            visibleKeys.push(key);

            widget.titleLabel.set_text(aggregate.title);
            widget.stateLabel.set_text(aggregate.state);
            widget.rxValue.valueWidget.set_text(aggregate.available ? this._formatRate(aggregate.rxRate) : "--");
            widget.txValue.valueWidget.set_text(aggregate.available ? this._formatRate(aggregate.txRate) : "--");
            widget.totalRxValue.valueWidget.set_text(this._formatBytes(aggregate.totalRxBytes));
            widget.totalTxValue.valueWidget.set_text(this._formatBytes(aggregate.totalTxBytes));
            widget.footer.set_text(aggregate.footer);
            widget.footer.visible = Boolean(aggregate.footer);
            widget.sparkline.update(aggregate.rxHistory, aggregate.txHistory, {
                visible: this.showSparklines,
                height: Math.max(32, Math.round(34 * (this.fontScale || 1)))
            });
            widget.container.visible = true;
        }

        Object.keys(this._rowsByKey).forEach(key => {
            if (!visibleKeys.includes(key)) {
                this._rowsByKey[key].container.visible = false;
            }
        });
    }

    _ensureRowWidget(key, title) {
        if (!this._rowsByKey[key]) {
            this._rowsByKey[key] = this._createRowWidget(title);
            this._panelBox.add_child(this._rowsByKey[key].container);
            this._applyRowDisplaySettings(
                this._rowsByKey[key],
                this.fontScale || 1,
                this.rowSpacing || 10,
                this._resolveAlignment(this.contentAlignment || "left")
            );
        }

        return this._rowsByKey[key];
    }

    _applyRowDisplaySettings(widget, fontScale, spacing, alignment) {
        const rowPadding = Math.max(8, spacing);

        widget.container.style = `padding: ${rowPadding}px; border-radius: 10px; spacing: ${Math.max(6, spacing - 2)}px; background-color: rgba(255, 255, 255, 0.06);`;
        widget.header.style = `spacing: ${Math.max(10, spacing)}px;`;
        widget.headerInfo.style = `spacing: ${Math.max(10, spacing)}px;`;
        widget.liveMetrics.style = `spacing: ${Math.max(8, spacing - 2)}px;`;
        widget.totalsRow.style = `spacing: ${Math.max(12, spacing)}px;`;
        widget.titleLabel.style = `font-size: ${1.0 * fontScale}em; font-weight: bold;`;
        widget.stateLabel.style = `font-size: ${0.92 * fontScale}em; color: rgba(255, 255, 255, 0.68);`;
        widget.totalsTitleLabel.style = `font-size: ${0.92 * fontScale}em; color: rgba(255, 255, 255, 0.72); font-weight: bold;`;
        widget.footer.style = `font-size: ${0.88 * fontScale}em; color: rgba(255, 255, 255, 0.72);`;
        widget.header.x_align = Clutter.ActorAlign.START;
        widget.headerInfo.x_align = Clutter.ActorAlign.START;
        widget.liveMetrics.x_align = Clutter.ActorAlign.START;
        widget.totalsRow.x_align = Clutter.ActorAlign.START;
        widget.header.y_align = Clutter.ActorAlign.CENTER;
        widget.headerInfo.y_align = Clutter.ActorAlign.CENTER;
        widget.liveMetrics.y_align = Clutter.ActorAlign.CENTER;
        widget.totalsRow.y_align = Clutter.ActorAlign.CENTER;
        widget.titleLabel.x_align = alignment;
        widget.stateLabel.x_align = alignment;
        widget.titleLabel.y_align = Clutter.ActorAlign.CENTER;
        widget.stateLabel.y_align = Clutter.ActorAlign.CENTER;
        widget.totalsTitleLabel.y_align = Clutter.ActorAlign.CENTER;
        widget.footer.x_align = alignment;
        widget.sparkline.actor.style = `height: ${Math.max(32, Math.round(34 * fontScale))}px;`;
        widget.sparkline.actor.visible = this.showSparklines;

        [widget.rxValue, widget.txValue, widget.totalRxValue, widget.totalTxValue].forEach(metric => {
            metric.container.y_align = Clutter.ActorAlign.CENTER;
            metric.labelWidget.y_align = Clutter.ActorAlign.CENTER;
            metric.valueWidget.y_align = Clutter.ActorAlign.CENTER;
            const isCompact = metric.container.has_style_class_name("bandwidth-monitor__metric--compact");
            const isInline = metric.container.has_style_class_name("bandwidth-monitor__inline-metric");
            if (isInline) {
                metric.labelWidget.visible = true;
                metric.labelWidget.style = `font-size: ${0.85 * fontScale}em; color: rgba(255, 255, 255, 0.72);`;
                metric.valueWidget.style = `font-size: ${1.0 * fontScale}em; font-weight: bold;`;
            } else {
                metric.labelWidget.visible = this.showLabels;
                metric.labelWidget.style = isCompact
                    ? `font-size: ${0.8 * fontScale}em; color: rgba(255, 255, 255, 0.72);`
                    : `font-size: ${0.85 * fontScale}em; color: rgba(255, 255, 255, 0.72);`;
                metric.valueWidget.style = isCompact
                    ? `font-size: ${1.0 * fontScale}em; font-weight: bold;`
                    : `font-size: ${1.05 * fontScale}em; font-weight: bold;`;
            }
        });

        widget.totalsRow.visible = this.showTotals;
    }

    _hideAllRows() {
        Object.keys(this._rowsByKey).forEach(key => {
            this._rowsByKey[key].container.visible = false;
        });
    }

    _syncInterfaceInventory(reason = "") {
        if (reason) {
            this._inventoryLabel.set_text(reason);
            return;
        }

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
        return Formatting.formatRate(bytesPerSecond, this.rateUnitMode || "auto-bytes");
    }

    _formatBytes(bytes) {
        return Formatting.formatDataSize(bytes);
    }

    _resolveAlignment(value) {
        if (value === "center") {
            return Clutter.ActorAlign.CENTER;
        }

        if (value === "right") {
            return Clutter.ActorAlign.END;
        }

        return Clutter.ActorAlign.START;
    }

    on_desklet_added_to_desktop() {
        this._ensureSaneStartupPosition();
        this._syncHeader();
        this._restartSampling();
        this._tickSample();
    }

    _ensureSaneStartupPosition() {
        const primaryMonitor = Main.layoutManager.primaryMonitor;
        if (!primaryMonitor) {
            return;
        }

        const [currentX, currentY] = this.actor.get_position();
        const withinPrimaryMonitor = currentX >= primaryMonitor.x
            && currentY >= primaryMonitor.y
            && currentX < (primaryMonitor.x + primaryMonitor.width)
            && currentY < (primaryMonitor.y + primaryMonitor.height);

        if (withinPrimaryMonitor) {
            return;
        }

        const targetX = primaryMonitor.x + DEFAULT_PRIMARY_MONITOR_MARGIN;
        const targetY = primaryMonitor.y + DEFAULT_PRIMARY_MONITOR_MARGIN;

        this.actor.set_position(targetX, targetY);
        this._persistDeskletPosition(targetX, targetY);
    }

    _persistDeskletPosition(x, y) {
        const enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);
        const updatedDesklets = enabledDesklets.map(definition => {
            const elements = definition.split(":");
            if (elements.length !== 4) {
                return definition;
            }

            if (elements[0] !== this.metadata.uuid || parseInt(elements[1], 10) !== this.instance_id) {
                return definition;
            }

            elements[2] = String(Math.round(x));
            elements[3] = String(Math.round(y));
            return elements.join(":");
        });

        global.settings.set_strv(ENABLED_DESKLETS_KEY, updatedDesklets);
    }

    on_desklet_removed() {
        if (this._sampleTimeoutId > 0) {
            Mainloop.source_remove(this._sampleTimeoutId);
            this._sampleTimeoutId = 0;
        }

        this._monitor.reset();
        this.settings = null;
    }
}

function main(metadata, deskletId) {
    return new BandwidthMonitorDesklet(metadata, deskletId);
}