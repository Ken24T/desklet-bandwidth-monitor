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
        this._rowsByKey = {};

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bind("sample-seconds", "sampleSeconds", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("selection-mode", "selectionMode", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("preferred-interface", "preferredInterface", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("include-tunnel-interfaces", "includeTunnelInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("include-loopback-interfaces", "includeLoopbackInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("visible-interfaces", "visibleInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("interface-display-settings", "interfaceDisplaySettings", this._onInterfaceDisplaySettingsChanged.bind(this));
        this.settings.bind("show-group-all", "showGroupAll", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("reset-interface-request", "resetInterfaceRequest", this._onResetInterfaceRequested.bind(this));
        this.settings.bind("theme-mode", "themeMode", this._syncDisplaySettings.bind(this));
        this.settings.bind("manual-theme-action", "manualThemeAction", this._onManualThemeActionChanged.bind(this));
        this.settings.bind("desklet-background-color", "deskletBackgroundColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("row-background-color", "rowBackgroundColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("primary-text-color", "primaryTextColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("secondary-text-color", "secondaryTextColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("rx-accent-color", "rxAccentColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("tx-accent-color", "txAccentColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("rate-unit-mode", "rateUnitMode", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-labels", "showLabels", this._syncDisplaySettings.bind(this));
        this.settings.bind("show-totals", "showTotals", this._syncDisplaySettings.bind(this));
        this.settings.bind("font-scale", "fontScale", this._syncDisplaySettings.bind(this));
        this.settings.bind("row-spacing", "rowSpacing", this._syncDisplaySettings.bind(this));
        this.settings.bind("content-alignment", "contentAlignment", this._syncDisplaySettings.bind(this));
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

        this._contentBox.add_child(this._titleLabel);
        this._contentBox.add_child(this._panelBox);

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
        this._themePalette = this._getThemePalette();

        this._contentBox.style = `spacing: ${spacing}px; padding: 12px; border-radius: 16px; background-color: ${this._themePalette.deskletBackground};`;
        this._panelBox.style = `spacing: ${spacing}px;`;
        this._titleLabel.style = `font-size: ${1.15 * fontScale}em; color: ${this._themePalette.primaryText};`;
        this._titleLabel.x_align = alignment;

        Object.values(this._rowsByKey).forEach(widget => this._applyRowDisplaySettings(widget, fontScale, spacing, alignment));
        this._tickSample();
    }

    _onSamplingSettingsChanged() {
        this._monitor.reset();
        this._restartSampling();
        this._tickSample();
    }

    _onInterfaceDisplaySettingsChanged() {
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
            includeLoopbackInterfaces: this.includeLoopbackInterfaces,
            interfaceDisplaySettings: this.interfaceDisplaySettings || "",
            historyLength: this.historyLength || 60,
            smoothingMode: this.smoothingMode || "moving-average"
        });

        if (!snapshot.hasVisibleRows && !this.showGroupAll) {
            this._renderUnavailable("No visible interfaces are currently selected.");
            return true;
        }

        this._renderSnapshot(snapshot);
        return true;
    }

    _renderUnavailable(reason) {
        this._hideAllRows();
    }

    _renderSnapshot(snapshot) {
        this._syncRowWidgets(snapshot.rows, snapshot.aggregate);
    }

    _syncRowWidgets(rows, aggregate) {
        const visibleKeys = [];
        const shownInterfaceNames = this._resolveShownInterfaceNames(rows);

        rows.forEach(row => {
            const key = `row:${row.interfaceInfo.name}`;
            const widget = this._ensureRowWidget(key, row.title);

            widget.titleLabel.set_text(row.title);
            widget.stateLabel.set_text(this._formatDisplayState(row.state));
            widget.rxValue.valueWidget.set_text(row.hasRate ? this._formatRate(row.rxRate) : "--");
            widget.txValue.valueWidget.set_text(row.hasRate ? this._formatRate(row.txRate) : "--");
            widget.totalRxValue.valueWidget.set_text(this._formatBytes(row.totalRxBytes));
            widget.totalTxValue.valueWidget.set_text(this._formatBytes(row.totalTxBytes));
            widget.footer.set_text(row.footer);
            widget.footer.visible = Boolean(row.footer);
            widget.sparkline.update(row.rxHistory, row.txHistory, {
                visible: this.showSparklines,
                height: Math.max(40, Math.round(43 * (this.fontScale || 1))),
                backgroundColor: this._themePalette.chartBackgroundArray,
                rxColor: this._themePalette.rxAccentArray,
                txColor: this._themePalette.txAccentArray
            });
            widget.container.visible = shownInterfaceNames.has(row.interfaceInfo.name);

            if (widget.container.visible) {
                visibleKeys.push(key);
            }
        });

        if (this.showGroupAll) {
            const key = "aggregate";
            const widget = this._ensureRowWidget(key, aggregate.title);
            visibleKeys.push(key);

            widget.titleLabel.set_text(aggregate.title);
            widget.stateLabel.set_text(this._formatDisplayState(aggregate.state));
            widget.rxValue.valueWidget.set_text(aggregate.available ? this._formatRate(aggregate.rxRate) : "--");
            widget.txValue.valueWidget.set_text(aggregate.available ? this._formatRate(aggregate.txRate) : "--");
            widget.totalRxValue.valueWidget.set_text(this._formatBytes(aggregate.totalRxBytes));
            widget.totalTxValue.valueWidget.set_text(this._formatBytes(aggregate.totalTxBytes));
            widget.footer.set_text(aggregate.footer);
            widget.footer.visible = Boolean(aggregate.footer);
            widget.sparkline.update(aggregate.rxHistory, aggregate.txHistory, {
                visible: this.showSparklines,
                height: Math.max(40, Math.round(43 * (this.fontScale || 1))),
                backgroundColor: this._themePalette.chartBackgroundArray,
                rxColor: this._themePalette.rxAccentArray,
                txColor: this._themePalette.txAccentArray
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
        const palette = this._themePalette || this._getThemePalette();

        widget.container.style = `padding: ${rowPadding}px; border-radius: 10px; spacing: ${Math.max(6, spacing - 2)}px; background-color: ${palette.rowBackground};`;
        widget.header.style = `spacing: ${Math.max(10, spacing)}px;`;
        widget.headerInfo.style = `spacing: ${Math.max(10, spacing)}px;`;
        widget.liveMetrics.style = `spacing: ${Math.max(8, spacing - 2)}px;`;
        widget.totalsRow.style = `spacing: ${Math.max(12, spacing)}px;`;
        widget.titleLabel.style = `font-size: ${1.0 * fontScale}em; font-weight: bold; color: ${palette.primaryText};`;
        widget.stateLabel.style = `font-size: ${0.92 * fontScale}em; color: ${palette.secondaryText};`;
        widget.totalsTitleLabel.style = `font-size: ${0.92 * fontScale}em; color: ${palette.secondaryText}; font-weight: bold;`;
        widget.footer.style = `font-size: ${0.88 * fontScale}em; color: ${palette.secondaryText};`;
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
        widget.sparkline.actor.style = `height: ${Math.max(40, Math.round(43 * fontScale))}px;`;
        widget.sparkline.actor.visible = this.showSparklines;

        [
            { metric: widget.rxValue, accent: palette.rxAccent },
            { metric: widget.txValue, accent: palette.txAccent },
            { metric: widget.totalRxValue, accent: palette.rxAccent },
            { metric: widget.totalTxValue, accent: palette.txAccent }
        ].forEach(({ metric, accent }) => {
            metric.container.y_align = Clutter.ActorAlign.CENTER;
            metric.labelWidget.y_align = Clutter.ActorAlign.CENTER;
            metric.valueWidget.y_align = Clutter.ActorAlign.CENTER;
            const isCompact = metric.container.has_style_class_name("bandwidth-monitor__metric--compact");
            const isInline = metric.container.has_style_class_name("bandwidth-monitor__inline-metric");
            metric.container.style = isInline ? "" : `background-color: ${palette.metricBackground};`;
            if (isInline) {
                metric.labelWidget.visible = true;
                metric.labelWidget.style = `font-size: ${0.85 * fontScale}em; color: ${palette.secondaryText};`;
                metric.valueWidget.style = `font-size: ${1.0 * fontScale}em; font-weight: bold; color: ${accent};`;
            } else {
                metric.labelWidget.visible = this.showLabels;
                metric.labelWidget.style = isCompact
                    ? `font-size: ${0.8 * fontScale}em; color: ${palette.secondaryText};`
                    : `font-size: ${0.85 * fontScale}em; color: ${palette.secondaryText};`;
                metric.valueWidget.style = isCompact
                    ? `font-size: ${1.0 * fontScale}em; font-weight: bold; color: ${accent};`
                    : `font-size: ${1.05 * fontScale}em; font-weight: bold; color: ${accent};`;
            }
        });

        widget.totalsRow.visible = this.showTotals;
    }

    _hideAllRows() {
        Object.keys(this._rowsByKey).forEach(key => {
            this._rowsByKey[key].container.visible = false;
        });
    }

    _onResetInterfaceRequested() {
        const request = (this.resetInterfaceRequest || "").trim();
        if (!request) {
            return;
        }

        const [interfaceName] = request.split(":");
        if (!interfaceName) {
            return;
        }

        this._monitor.resetInterface(interfaceName);
        this.settings.setValue("reset-interface-request", "");
        this._tickSample();
    }

    _onManualThemeActionChanged() {
        const action = (this.manualThemeAction || "none").trim();
        if (!action || action === "none") {
            return;
        }

        const palette = this._getManualThemePreset(action);
        if (!palette) {
            this.settings.setValue("manual-theme-action", "none");
            return;
        }

        this.settings.setValue("desklet-background-color", palette.deskletBackgroundColor);
        this.settings.setValue("row-background-color", palette.rowBackgroundColor);
        this.settings.setValue("primary-text-color", palette.primaryTextColor);
        this.settings.setValue("secondary-text-color", palette.secondaryTextColor);
        this.settings.setValue("rx-accent-color", palette.rxAccentColor);
        this.settings.setValue("tx-accent-color", palette.txAccentColor);
        this.settings.setValue("manual-theme-action", "none");
        this._syncDisplaySettings();
    }

    _resolveShownInterfaceNames(rows) {
        const fallback = rows
            .filter(row => row.interfaceInfo && (this.includeLoopbackInterfaces || !row.interfaceInfo.isLoopback))
            .map(row => row.interfaceInfo.name);
        const rawValue = (this.visibleInterfaces || "").trim();

        if (!rawValue) {
            return new Set(fallback);
        }

        try {
            const parsed = JSON.parse(rawValue);
            if (parsed && Array.isArray(parsed.shown)) {
                const allowedNames = new Set(
                    rows
                        .filter(row => row.interfaceInfo && (this.includeLoopbackInterfaces || !row.interfaceInfo.isLoopback))
                        .map(row => row.interfaceInfo.name)
                );
                return new Set(parsed.shown.filter(name => typeof name === "string" && allowedNames.has(name)));
            }
        } catch (error) {
        }

        return new Set(rawValue.split(",").map(name => name.trim()).filter(Boolean));
    }

    _formatRate(bytesPerSecond) {
        return Formatting.formatRate(bytesPerSecond, this.rateUnitMode || "auto-bytes");
    }

    _formatBytes(bytes) {
        return Formatting.formatDataSize(bytes);
    }

    _formatDisplayState(state) {
        if (["auto", "up", "unknown"].includes(state)) {
            return "";
        }

        return state || "";
    }

    _getThemePalette() {
        const themeMode = this.themeMode || "dark";

        if (themeMode === "light") {
            return this._buildPresetPalette({
                deskletBackground: "rgba(244, 247, 251, 0.96)",
                rowBackground: "rgba(24, 35, 52, 0.09)",
                metricBackground: "rgba(24, 35, 52, 0.07)",
                chartBackground: "rgba(24, 35, 52, 0.07)",
                primaryText: "rgb(37, 45, 58)",
                secondaryText: "rgba(68, 79, 95, 0.82)",
                rxAccent: "rgb(36, 122, 206)",
                txAccent: "rgb(224, 140, 48)"
            });
        }

        if (themeMode === "manual" || themeMode === "custom") {
            return this._buildPresetPalette({
                deskletBackground: this._colourToCss(this._resolveColor(this.deskletBackgroundColor, "rgb(24, 28, 36)"), 0.94),
                rowBackground: this._colourToCss(this._resolveColor(this.rowBackgroundColor, "rgb(255, 255, 255)"), 0.18),
                metricBackground: this._colourToCss(this._resolveColor(this.rowBackgroundColor, "rgb(255, 255, 255)"), 0.12),
                chartBackground: this._colourToCss(this._resolveColor(this.rowBackgroundColor, "rgb(255, 255, 255)"), 0.10),
                primaryText: this._colourToCss(this._resolveColor(this.primaryTextColor, "rgb(255, 255, 255)"), 1),
                secondaryText: this._colourToCss(this._resolveColor(this.secondaryTextColor, "rgb(214, 220, 229)"), 0.92),
                rxAccent: this._colourToCss(this._resolveColor(this.rxAccentColor, "rgb(115, 198, 255)"), 1),
                txAccent: this._colourToCss(this._resolveColor(this.txAccentColor, "rgb(255, 191, 87)"), 1)
            });
        }

        return this._buildPresetPalette({
            deskletBackground: "rgba(22, 26, 34, 0.94)",
            rowBackground: "rgba(255, 255, 255, 0.06)",
            metricBackground: "rgba(255, 255, 255, 0.05)",
            chartBackground: "rgba(255, 255, 255, 0.05)",
            primaryText: "rgb(255, 255, 255)",
            secondaryText: "rgba(214, 220, 229, 0.82)",
            rxAccent: "rgb(115, 198, 255)",
            txAccent: "rgb(255, 191, 87)"
        });
    }

    _getManualThemePreset(action) {
        const presets = {
            "reset-dark": {
                deskletBackgroundColor: "rgb(24, 28, 36)",
                rowBackgroundColor: "rgb(255, 255, 255)",
                primaryTextColor: "rgb(255, 255, 255)",
                secondaryTextColor: "rgb(214, 220, 229)",
                rxAccentColor: "rgb(115, 198, 255)",
                txAccentColor: "rgb(255, 191, 87)"
            },
            "reset-light": {
                deskletBackgroundColor: "rgb(244, 247, 251)",
                rowBackgroundColor: "rgb(24, 35, 52)",
                primaryTextColor: "rgb(37, 45, 58)",
                secondaryTextColor: "rgb(68, 79, 95)",
                rxAccentColor: "rgb(36, 122, 206)",
                txAccentColor: "rgb(224, 140, 48)"
            },
            "ocean-blue": {
                deskletBackgroundColor: "rgb(18, 44, 77)",
                rowBackgroundColor: "rgb(118, 179, 255)",
                primaryTextColor: "rgb(241, 248, 255)",
                secondaryTextColor: "rgb(208, 225, 241)",
                rxAccentColor: "rgb(72, 220, 164)",
                txAccentColor: "rgb(255, 132, 105)"
            },
            "forest-mist": {
                deskletBackgroundColor: "rgb(27, 52, 46)",
                rowBackgroundColor: "rgb(208, 232, 223)",
                primaryTextColor: "rgb(239, 248, 244)",
                secondaryTextColor: "rgb(196, 225, 215)",
                rxAccentColor: "rgb(125, 221, 153)",
                txAccentColor: "rgb(255, 181, 92)"
            },
            "amber-glow": {
                deskletBackgroundColor: "rgb(74, 54, 12)",
                rowBackgroundColor: "rgb(255, 227, 163)",
                primaryTextColor: "rgb(255, 248, 224)",
                secondaryTextColor: "rgb(245, 226, 172)",
                rxAccentColor: "rgb(255, 222, 92)",
                txAccentColor: "rgb(255, 153, 64)"
            },
            "crimson-dusk": {
                deskletBackgroundColor: "rgb(88, 27, 35)",
                rowBackgroundColor: "rgb(238, 179, 184)",
                primaryTextColor: "rgb(255, 241, 243)",
                secondaryTextColor: "rgb(245, 206, 210)",
                rxAccentColor: "rgb(255, 164, 115)",
                txAccentColor: "rgb(255, 96, 96)"
            },
            "pale-sky": {
                deskletBackgroundColor: "rgb(176, 206, 230)",
                rowBackgroundColor: "rgb(255, 255, 255)",
                primaryTextColor: "rgb(34, 63, 84)",
                secondaryTextColor: "rgb(82, 110, 129)",
                rxAccentColor: "rgb(54, 140, 209)",
                txAccentColor: "rgb(237, 166, 82)"
            }
        };

        return presets[action] || null;
    }

    _buildPresetPalette(palette) {
        return {
            ...palette,
            chartBackgroundArray: this._colourToArray(this._resolveColor(palette.chartBackground, "rgba(255, 255, 255, 0.05)")),
            rxAccentArray: this._colourToArray(this._resolveColor(palette.rxAccent, "rgb(115, 198, 255)"), 0.95),
            txAccentArray: this._colourToArray(this._resolveColor(palette.txAccent, "rgb(255, 191, 87)"), 0.95)
        };
    }

    _resolveColor(value, fallback) {
        const [matched, colour] = Clutter.Color.from_string(value || fallback);
        if (matched) {
            return colour;
        }

        const [, fallbackColour] = Clutter.Color.from_string(fallback);
        return fallbackColour;
    }

    _colourToCss(colour, alphaOverride = null) {
        const alpha = alphaOverride === null ? (colour.alpha / 255) : alphaOverride;
        return `rgba(${colour.red}, ${colour.green}, ${colour.blue}, ${alpha})`;
    }

    _colourToArray(colour, alphaOverride = null) {
        const alpha = alphaOverride === null ? (colour.alpha / 255) : alphaOverride;
        return [colour.red / 255, colour.green / 255, colour.blue / 255, alpha];
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