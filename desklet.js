const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Gettext = imports.gettext;
const BoxPointer = imports.ui.boxpointer;
const Main = imports.ui.main;

const UUID = "bandwidth-monitor@Ken24T";
const DeskletManager = imports.ui.deskletManager;
const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;

const ENABLED_DESKLETS_KEY = "enabled-desklets";
const DEFAULT_PRIMARY_MONITOR_MARGIN = 48;
const TEXT_REFRESH_INTERVAL_US = 1000000;

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
        this._lastTextMetricsUpdateUs = 0;
        this._textMetricsByInterface = {};
        this._aggregateTextMetrics = null;
        this._pendingTextMetricsByInterface = {};
        this._pendingAggregateTextMetrics = null;
        this._detailsPopup = null;
        this._detailsPopupSource = null;
        this._detailsPopupHideTimeoutId = 0;

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, deskletId);
        this.settings.bind("sample-seconds", "sampleSeconds", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("selection-mode", "selectionMode", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("preferred-interface", "preferredInterface", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("include-tunnel-interfaces", "includeTunnelInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("include-loopback-interfaces", "includeLoopbackInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("visible-interfaces", "visibleInterfaces", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("interface-display-settings", "interfaceDisplaySettings", this._onInterfaceDisplaySettingsChanged.bind(this));
        this.settings.bind("show-group-all", "showGroupAll", this._onSamplingSettingsChanged.bind(this));
        this.settings.bind("aggregate-emphasis", "aggregateEmphasis", this._syncDisplaySettings.bind(this));
        this.settings.bind("reset-interface-request", "resetInterfaceRequest", this._onResetInterfaceRequested.bind(this));
        this.settings.bind("theme-mode", "themeMode", this._syncDisplaySettings.bind(this));
        this.settings.bind("manual-theme-action", "manualThemeAction", this._onManualThemeActionChanged.bind(this));
        this.settings.bind("desklet-background-color", "deskletBackgroundColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("row-background-color", "rowBackgroundColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("primary-text-color", "primaryTextColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("secondary-text-color", "secondaryTextColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("rx-accent-color", "rxAccentColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("tx-accent-color", "txAccentColor", this._syncDisplaySettings.bind(this));
        this.settings.bind("display-density", "displayDensity", this._syncDisplaySettings.bind(this));
        this.settings.bind("focus-interface-mode", "focusInterfaceMode", this._syncDisplaySettings.bind(this));
        this.settings.bind("layout-restore-action", "layoutRestoreAction", this._onLayoutRestoreActionChanged.bind(this));
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
        this._renderUnavailable("Looking for an active connection.");
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
            style_class: "bandwidth-monitor__status",
            text: _("Looking for an active connection.")
        });
        this._statusLabel.clutter_text.line_wrap = true;
        this._statusLabel.clutter_text.ellipsize = 0;

        this._panelBox = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__panel"
        });

        this._contentBox.add_child(this._titleLabel);
        this._contentBox.add_child(this._statusLabel);
        this._contentBox.add_child(this._panelBox);

        this.setContent(this._contentBox);
        this._buildDetailsPopup();
    }

    _buildDetailsPopup() {
        this._detailsPopup = new BoxPointer.BoxPointer(St.Side.TOP);
        this._detailsPopup.hide();
        this._detailsPopup.add_style_class_name("bandwidth-monitor__details-popup");

        this._detailsPopupContent = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__details-popup-content"
        });
        this._detailsPopupTitle = new St.Label({
            style_class: "bandwidth-monitor__details-popup-title",
            text: ""
        });
        this._detailsPopupMeta = new St.Label({
            style_class: "bandwidth-monitor__details-popup-meta",
            text: ""
        });
        this._detailsPopupMetrics = new St.Label({
            style_class: "bandwidth-monitor__details-popup-metrics",
            text: ""
        });
        this._detailsPopupNote = new St.Label({
            style_class: "bandwidth-monitor__details-popup-note",
            text: ""
        });

        [this._detailsPopupMeta, this._detailsPopupMetrics, this._detailsPopupNote].forEach(label => {
            label.clutter_text.line_wrap = true;
            label.clutter_text.ellipsize = 0;
        });

        this._detailsPopupContent.add_child(this._detailsPopupTitle);
        this._detailsPopupContent.add_child(this._detailsPopupMeta);
        this._detailsPopupContent.add_child(this._detailsPopupMetrics);
        this._detailsPopupContent.add_child(this._detailsPopupNote);
        this._detailsPopup.bin.set_child(this._detailsPopupContent);
        Main.layoutManager.addChrome(this._detailsPopup);
    }

    _createRowWidget(title) {
        const container = new St.BoxLayout({
            vertical: true,
            style_class: "bandwidth-monitor__row",
            reactive: true,
            track_hover: true
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
            text: _("Getting ready for live traffic.")
        });
        footer.clutter_text.line_wrap = true;
        footer.clutter_text.ellipsize = 0;
        const sparkline = new Sparkline.SparklineView();

        container.connect("enter-event", () => {
            this._showDetailsPopup(container, container._bandwidthMonitorDetailData);
        });
        container.connect("leave-event", () => {
            this._queueHideDetailsPopup();
        });

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
            totalsInHeader: false,
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
        this._displaySettings = this._resolveDisplaySettings();
        const { fontScale, spacing, alignment } = this._displaySettings;
        this._themePalette = this._getThemePalette();

        this._contentBox.style = `spacing: ${spacing}px; padding: 12px; border-radius: 16px; background-color: ${this._themePalette.deskletBackground};`;
        this._panelBox.style = `spacing: ${spacing}px;`;
        this._titleLabel.style = `font-size: ${1.15 * fontScale}em; color: ${this._themePalette.primaryText};`;
        this._statusLabel.style = `font-size: ${0.92 * fontScale}em; color: ${this._themePalette.secondaryText};`;
        this._titleLabel.x_align = alignment;
        this._statusLabel.x_align = alignment;
        this._detailsPopup.style = `
            -arrow-background-color: ${this._themePalette.deskletBackground};
            -arrow-border-color: ${this._themePalette.rowBackground};
            -arrow-border-width: 1px;
            -arrow-border-radius: 12px;
            -arrow-base: 18px;
            -arrow-rise: 10px;
            -boxpointer-gap: 8px;
        `;
        this._detailsPopupContent.style = `padding: ${Math.max(12, spacing + 2)}px; spacing: ${Math.max(8, spacing - 1)}px; min-width: 240px;`;
        this._detailsPopupTitle.style = `font-size: ${1.0 * fontScale}em; font-weight: bold; color: ${this._themePalette.primaryText};`;
        this._detailsPopupMeta.style = `font-size: ${0.9 * fontScale}em; color: ${this._themePalette.secondaryText};`;
        this._detailsPopupMetrics.style = `font-size: ${0.94 * fontScale}em; color: ${this._themePalette.primaryText};`;
        this._detailsPopupNote.style = `font-size: ${0.88 * fontScale}em; color: ${this._themePalette.secondaryText};`;

        Object.values(this._rowsByKey).forEach(widget => this._applyRowDisplaySettings(widget, this._displaySettings));
        this._tickSample();
    }

    _onSamplingSettingsChanged() {
        this._monitor.reset();
        this._resetTextMetricsCache();
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

        const intervalMilliseconds = this._getSampleIntervalMilliseconds();
        this._sampleTimeoutId = Mainloop.timeout_add(intervalMilliseconds, () => this._tickSample());
    }

    _getSampleIntervalMilliseconds() {
        const intervalSeconds = Math.max(0.25, Number(this.sampleSeconds) || 1);
        return Math.max(50, Math.round(intervalSeconds * 1000));
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
        this._refreshTextMetricsCache(snapshot);

        if (!snapshot.availableInterfaces || snapshot.availableInterfaces.length === 0) {
            this._renderUnavailable("No network devices are available yet.");
            return true;
        }

        if (!snapshot.hasVisibleRows && !this.showGroupAll) {
            this._renderUnavailable("Choose at least one interface in the Interfaces tab.");
            return true;
        }

        this._renderSnapshot(snapshot);
        return true;
    }

    _renderUnavailable(reason) {
        this._hideDetailsPopup(BoxPointer.PopupAnimation.NONE);
        this._statusLabel.set_text(_(reason));
        this._statusLabel.visible = true;
        this._hideAllRows();
    }

    _renderSnapshot(snapshot) {
        const allVisibleRowsUnavailable = snapshot.rows.length > 0 && snapshot.rows.every(row => !row.available);
        if (allVisibleRowsUnavailable) {
            this._statusLabel.set_text(_("Waiting for one of the visible interfaces to come online."));
            this._statusLabel.visible = true;
        } else {
            this._statusLabel.visible = false;
        }

        this._syncRowWidgets(snapshot.rows, snapshot.aggregate);
    }

    _syncRowWidgets(rows, aggregate) {
        const displaySettings = this._displaySettings || this._resolveDisplaySettings();
        const visibleKeys = [];
        const shownInterfaceNames = this._resolveShownInterfaceNames(rows);
        const visibleRowCount = rows.filter(row => shownInterfaceNames.has(row.interfaceInfo.name)).length;

        rows.forEach(row => {
            const key = `row:${row.interfaceInfo.name}`;
            const widget = this._ensureRowWidget(key, row.title);
            const displayedMetrics = this._getDisplayedMetrics(row, row.interfaceInfo.name);
            widget.isAggregate = false;
            widget.isPrimary = Boolean(row.selected);
            widget.primaryState = row.state;

            widget.titleLabel.set_text(row.title);
            widget.stateLabel.set_text(this._formatDisplayState(row.state));
            widget.rxValue.valueWidget.set_text(displayedMetrics.hasRate ? this._formatRate(displayedMetrics.rxRate) : "--");
            widget.txValue.valueWidget.set_text(displayedMetrics.hasRate ? this._formatRate(displayedMetrics.txRate) : "--");
            widget.totalRxValue.valueWidget.set_text(this._formatBytes(displayedMetrics.totalRxBytes));
            widget.totalTxValue.valueWidget.set_text(this._formatBytes(displayedMetrics.totalTxBytes));
            widget.footer.set_text(row.footer);
            widget.footer.visible = Boolean(row.footer);
            widget.sparkline.update(row.rxHistory, row.txHistory, {
                visible: displaySettings.showSparklines,
                height: this._getSparklineHeight(displaySettings),
                backgroundColor: this._themePalette.chartBackgroundArray,
                rxColor: this._themePalette.rxAccentArray,
                txColor: this._themePalette.txAccentArray
            });
            widget.container._bandwidthMonitorDetailData = this._buildInterfaceDetailsData(row, displayedMetrics);
            widget.container.visible = shownInterfaceNames.has(row.interfaceInfo.name);

            if (widget.container.visible) {
                visibleKeys.push(key);
            }
        });

        if (this.showGroupAll) {
            const key = "aggregate";
            const widget = this._ensureRowWidget(key, aggregate.title);
            visibleKeys.push(key);
            const displayedMetrics = this._getDisplayedMetrics(aggregate, "aggregate");
            widget.isAggregate = true;
            widget.isPrimary = false;
            widget.primaryState = "";

            widget.titleLabel.set_text(aggregate.title);
            widget.stateLabel.set_text(this._formatDisplayState(aggregate.state));
            widget.rxValue.valueWidget.set_text(displayedMetrics.hasRate ? this._formatRate(displayedMetrics.rxRate) : "--");
            widget.txValue.valueWidget.set_text(displayedMetrics.hasRate ? this._formatRate(displayedMetrics.txRate) : "--");
            widget.totalRxValue.valueWidget.set_text(this._formatBytes(displayedMetrics.totalRxBytes));
            widget.totalTxValue.valueWidget.set_text(this._formatBytes(displayedMetrics.totalTxBytes));
            widget.footer.set_text(aggregate.footer);
            widget.footer.visible = Boolean(aggregate.footer);
            widget.sparkline.update(aggregate.rxHistory, aggregate.txHistory, {
                visible: displaySettings.showSparklines,
                height: this._getSparklineHeight(displaySettings),
                backgroundColor: this._themePalette.chartBackgroundArray,
                rxColor: this._themePalette.rxAccentArray,
                txColor: this._themePalette.txAccentArray
            });
            widget.container._bandwidthMonitorDetailData = this._buildAggregateDetailsData(aggregate, displayedMetrics, visibleRowCount);
            widget.container.visible = true;
        }

        Object.keys(this._rowsByKey).forEach(key => {
            if (!visibleKeys.includes(key)) {
                this._rowsByKey[key].container.visible = false;
            }
        });

        if (this._detailsPopupSource && !this._detailsPopupSource.visible) {
            this._hideDetailsPopup(BoxPointer.PopupAnimation.NONE);
        }
    }

    _ensureRowWidget(key, title) {
        if (!this._rowsByKey[key]) {
            this._rowsByKey[key] = this._createRowWidget(title);
            this._panelBox.add_child(this._rowsByKey[key].container);
            this._applyRowDisplaySettings(this._rowsByKey[key], this._displaySettings || this._resolveDisplaySettings());
        }

        return this._rowsByKey[key];
    }

    _applyRowDisplaySettings(widget, displaySettings) {
        const { fontScale, spacing, alignment, showLabels, showTotals, showSparklines } = displaySettings;
        const palette = this._themePalette || this._getThemePalette();
        const primaryAccent = this._resolveColor(palette.rxAccent, "rgb(115, 198, 255)");
        const aggregateAccent = this._resolveColor(palette.txAccent, "rgb(255, 191, 87)");
        const isPrimary = Boolean(widget.isPrimary);
        const isAggregate = Boolean(widget.isAggregate);
        const isFocusedPrimary = Boolean(this.focusInterfaceMode) && isPrimary && !isAggregate;
        const aggregateEmphasis = isAggregate ? (this.aggregateEmphasis || "normal") : "normal";
        const effectiveFontScale = isFocusedPrimary ? fontScale * 1.12 : fontScale;
        const effectiveSpacing = isFocusedPrimary ? Math.max(spacing, 12) : spacing;
        const rowPadding = Math.max(8, effectiveSpacing);
        const stateText = widget.stateLabel.get_text();
        const primaryBackground = this._colourToCss(primaryAccent, 0.14);
        const primaryBorder = this._colourToCss(primaryAccent, 0.78);
        let rowBackground = palette.rowBackground;
        let borderColour = "transparent";
        let titleColour = palette.primaryText;
        let footerColour = palette.secondaryText;
        let rowOpacity = 255;

        if (isPrimary) {
            rowBackground = primaryBackground;
            borderColour = primaryBorder;
        } else if (isAggregate) {
            if (aggregateEmphasis === "subtle") {
                rowBackground = palette.metricBackground;
                titleColour = palette.secondaryText;
                rowOpacity = 220;
            } else if (aggregateEmphasis === "prominent") {
                rowBackground = this._colourToCss(aggregateAccent, 0.12);
                borderColour = this._colourToCss(aggregateAccent, 0.6);
            }
        }

        this._syncChartlessRowPlacement(widget, showSparklines);

        widget.container.style = `padding: ${rowPadding}px; border-radius: ${isFocusedPrimary ? 14 : 10}px; spacing: ${Math.max(6, effectiveSpacing - 2)}px; background-color: ${rowBackground}; border: 1px solid ${borderColour};`;
        widget.container.opacity = rowOpacity;
        widget.header.style = `spacing: ${Math.max(10, effectiveSpacing)}px;`;
        widget.headerInfo.style = `spacing: ${Math.max(10, effectiveSpacing)}px;`;
        widget.liveMetrics.style = `spacing: ${Math.max(8, effectiveSpacing - 2)}px;`;
        widget.totalsRow.style = showSparklines
            ? `spacing: ${Math.max(12, effectiveSpacing)}px;`
            : `spacing: ${Math.max(10, effectiveSpacing - 1)}px; padding: 5px 8px; border-radius: 999px; background-color: ${palette.metricBackground};`;
        widget.titleLabel.style = `font-size: ${1.0 * effectiveFontScale}em; font-weight: bold; color: ${titleColour};`;
        widget.stateLabel.style = stateText
            ? `font-size: ${0.82 * effectiveFontScale}em; color: ${isPrimary ? palette.primaryText : palette.secondaryText}; background-color: ${isPrimary ? primaryBorder : palette.metricBackground}; border-radius: 999px; padding: 3px 8px; font-weight: bold;`
            : "";
        widget.stateLabel.visible = Boolean(stateText);
        widget.totalsTitleLabel.style = `font-size: ${0.92 * effectiveFontScale}em; color: ${palette.secondaryText}; font-weight: bold;`;
        widget.footer.style = `font-size: ${0.88 * effectiveFontScale}em; color: ${footerColour};`;
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
        widget.sparkline.actor.style = `height: ${isFocusedPrimary ? Math.round(this._getSparklineHeight(displaySettings) * 1.18) : this._getSparklineHeight(displaySettings)}px;`;
        widget.sparkline.actor.visible = showSparklines;
        widget.totalsTitleLabel.visible = showSparklines;

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
                metric.labelWidget.style = `font-size: ${0.85 * effectiveFontScale}em; color: ${palette.secondaryText};`;
                metric.valueWidget.style = `font-size: ${1.0 * effectiveFontScale}em; font-weight: bold; color: ${accent};`;
            } else {
                metric.labelWidget.visible = showLabels;
                metric.labelWidget.style = isCompact
                    ? `font-size: ${0.8 * effectiveFontScale}em; color: ${palette.secondaryText};`
                    : `font-size: ${0.85 * effectiveFontScale}em; color: ${palette.secondaryText};`;
                metric.valueWidget.style = isCompact
                    ? `font-size: ${1.0 * effectiveFontScale}em; font-weight: bold; color: ${accent};`
                    : `font-size: ${1.05 * effectiveFontScale}em; font-weight: bold; color: ${accent};`;
            }
        });

        widget.totalsRow.visible = showTotals;
    }

    _syncChartlessRowPlacement(widget, showSparklines) {
        if (!showSparklines && !widget.totalsInHeader) {
            widget.container.remove_child(widget.totalsRow);
            widget.header.add_child(widget.totalsRow);
            widget.totalsInHeader = true;
            return;
        }

        if (showSparklines && widget.totalsInHeader) {
            widget.header.remove_child(widget.totalsRow);
            widget.container.insert_child_at_index(widget.totalsRow, 1);
            widget.totalsInHeader = false;
        }
    }

    _resolveDisplaySettings() {
        const preset = this.displayDensity || "comfortable";

        if (preset === "compact") {
            return {
                fontScale: 0.92,
                spacing: 6,
                alignment: this._resolveAlignment("left"),
                showLabels: false,
                showTotals: false,
                showSparklines: false,
                sparklineHeight: 36
            };
        }

        if (preset === "detailed") {
            return {
                fontScale: 1.08,
                spacing: 12,
                alignment: this._resolveAlignment("left"),
                showLabels: true,
                showTotals: true,
                showSparklines: true,
                sparklineHeight: 52
            };
        }

        if (preset === "manual") {
            return {
                fontScale: this.fontScale || 1,
                spacing: this.rowSpacing || 10,
                alignment: this._resolveAlignment(this.contentAlignment || "left"),
                showLabels: this.showLabels,
                showTotals: this.showTotals,
                showSparklines: this.showSparklines,
                sparklineHeight: Math.max(40, Math.round(43 * (this.fontScale || 1)))
            };
        }

        return {
            fontScale: 1,
            spacing: 10,
            alignment: this._resolveAlignment("left"),
            showLabels: true,
            showTotals: true,
            showSparklines: false,
            sparklineHeight: 40
        };
    }

    _getSparklineHeight(displaySettings) {
        return Math.max(32, Math.round(displaySettings.sparklineHeight || (43 * displaySettings.fontScale)));
    }

    _hideAllRows() {
        Object.keys(this._rowsByKey).forEach(key => {
            this._rowsByKey[key].container.visible = false;
        });
    }

    _resetTextMetricsCache() {
        this._lastTextMetricsUpdateUs = 0;
        this._textMetricsByInterface = {};
        this._aggregateTextMetrics = null;
        this._pendingTextMetricsByInterface = {};
        this._pendingAggregateTextMetrics = null;
    }

    _refreshTextMetricsCache(snapshot) {
        const nowUs = GLib.get_monotonic_time();
        snapshot.rows.forEach(row => {
            const key = row.interfaceInfo.name;
            const previous = this._pendingTextMetricsByInterface[key] || null;
            this._pendingTextMetricsByInterface[key] = this._mergeDisplayedMetrics(previous, row);
        });
        this._pendingAggregateTextMetrics = this._mergeDisplayedMetrics(
            this._pendingAggregateTextMetrics,
            snapshot.aggregate
        );

        if (this._lastTextMetricsUpdateUs === 0 || (nowUs - this._lastTextMetricsUpdateUs) >= TEXT_REFRESH_INTERVAL_US) {
            this._lastTextMetricsUpdateUs = nowUs;
            this._textMetricsByInterface = { ...this._pendingTextMetricsByInterface };
            this._aggregateTextMetrics = this._pendingAggregateTextMetrics;
            this._pendingTextMetricsByInterface = {};
            this._pendingAggregateTextMetrics = null;
        }
    }

    _captureDisplayedMetrics(row) {
        const hasRate = row.available && (typeof row.hasRate === "boolean" ? row.hasRate : true);
        return {
            hasRate,
            rxRate: row.rxRate,
            txRate: row.txRate,
            totalRxBytes: row.totalRxBytes,
            totalTxBytes: row.totalTxBytes,
            sawNonZeroRate: hasRate && (row.rxRate > 0 || row.txRate > 0)
        };
    }

    _mergeDisplayedMetrics(previous, row) {
        const current = this._captureDisplayedMetrics(row);
        if (!previous) {
            return current;
        }

        const merged = {
            hasRate: previous.hasRate || current.hasRate,
            rxRate: current.rxRate,
            txRate: current.txRate,
            totalRxBytes: current.totalRxBytes,
            totalTxBytes: current.totalTxBytes,
            sawNonZeroRate: previous.sawNonZeroRate || current.sawNonZeroRate
        };

        if (!current.hasRate) {
            merged.rxRate = previous.rxRate;
            merged.txRate = previous.txRate;
            return merged;
        }

        if (current.sawNonZeroRate) {
            return merged;
        }

        if (previous.sawNonZeroRate) {
            merged.rxRate = previous.rxRate;
            merged.txRate = previous.txRate;
        }

        return merged;
    }

    _getDisplayedMetrics(row, key) {
        if (!row.available) {
            return this._captureDisplayedMetrics(row);
        }

        if (key === "aggregate") {
            return this._aggregateTextMetrics || this._captureDisplayedMetrics(row);
        }

        return this._textMetricsByInterface[key] || this._captureDisplayedMetrics(row);
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

    _onLayoutRestoreActionChanged() {
        const action = (this.layoutRestoreAction || "none").trim();
        if (!action || action === "none") {
            return;
        }

        if (action === "restore-comfortable") {
            this.settings.setValue("display-density", "comfortable");
        } else if (action === "restore-compact") {
            this.settings.setValue("display-density", "compact");
        } else if (action === "restore-detailed") {
            this.settings.setValue("display-density", "detailed");
        } else if (action === "restore-manual-defaults") {
            this.settings.setValue("display-density", "manual");
            this.settings.setValue("show-labels", true);
            this.settings.setValue("show-totals", true);
            this.settings.setValue("font-scale", 1.0);
            this.settings.setValue("row-spacing", 10);
            this.settings.setValue("content-alignment", "left");
            this.settings.setValue("show-sparklines", true);
        }

        this.settings.setValue("layout-restore-action", "none");
        this._syncDisplaySettings();
    }

    _resolveShownInterfaceNames(rows) {
        if (this.focusInterfaceMode) {
            const primaryRow = rows.find(row => row.selected && row.interfaceInfo);
            if (primaryRow) {
                return new Set([primaryRow.interfaceInfo.name]);
            }

            const fallbackPrimary = rows.find(row => row.interfaceInfo && (this.includeLoopbackInterfaces || !row.interfaceInfo.isLoopback));
            return fallbackPrimary ? new Set([fallbackPrimary.interfaceInfo.name]) : new Set();
        }

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
        if (state === "auto") {
            return _("Primary");
        }

        if (state === "preferred") {
            return _("Preferred");
        }

        if (state === "down") {
            return _("Offline");
        }

        if (state === "lowerlayerdown") {
            return _("Disconnected");
        }

        if (state === "dormant") {
            return _("Idle");
        }

        if (state === "unavailable") {
            return _("Unavailable");
        }

        if (["up", "unknown", "idle"].includes(state)) {
            return "";
        }

        return state || "";
    }

    _showDetailsPopup(sourceActor, detailData) {
        if (!this._detailsPopup || !sourceActor || !detailData || !sourceActor.visible) {
            return;
        }

        this._cancelQueuedDetailsPopupHide();

        this._detailsPopupTitle.set_text(detailData.title || "");
        this._detailsPopupMeta.set_text((detailData.metaLines || []).join("\n"));
        this._detailsPopupMetrics.set_text((detailData.metricLines || []).join("\n"));
        this._detailsPopupNote.set_text(detailData.note || "");
        this._detailsPopupNote.visible = Boolean(detailData.note);

        this._detailsPopupSource = sourceActor;
        this._detailsPopup.setPosition(sourceActor, 0.5);

        if (!this._detailsPopup.visible) {
            this._detailsPopup.open(BoxPointer.PopupAnimation.FULL);
        } else {
            this._detailsPopup.show();
        }

        if (this._detailsPopup.get_parent()) {
            this._detailsPopup.get_parent().set_child_above_sibling(this._detailsPopup, null);
        }
    }

    _queueHideDetailsPopup() {
        this._cancelQueuedDetailsPopupHide();
        this._detailsPopupHideTimeoutId = Mainloop.timeout_add(160, () => {
            this._detailsPopupHideTimeoutId = 0;
            this._hideDetailsPopup();
            return false;
        });
    }

    _cancelQueuedDetailsPopupHide() {
        if (this._detailsPopupHideTimeoutId > 0) {
            Mainloop.source_remove(this._detailsPopupHideTimeoutId);
            this._detailsPopupHideTimeoutId = 0;
        }
    }

    _hideDetailsPopup(animation = BoxPointer.PopupAnimation.FULL) {
        this._cancelQueuedDetailsPopupHide();

        if (!this._detailsPopup) {
            return;
        }

        this._detailsPopup.close(animation);
        this._detailsPopupSource = null;
    }

    _buildInterfaceDetailsData(row, displayedMetrics) {
        const metaLines = [
            `${_("Device")}: ${row.interfaceInfo.name}`,
            `${_("Type")}: ${row.interfaceInfo.classification.label}`,
            `${_("State")}: ${row.interfaceInfo.operState}`
        ];

        if (row.selected) {
            metaLines.push(`${_("Role")}: ${row.state === "preferred" ? _("Preferred device") : _("Automatic choice")}`);
        }

        if (row.interfaceInfo.isTunnel) {
            metaLines.push(`${_("Tunnel")}: ${_("Yes")}`);
        }

        if (row.interfaceInfo.isLoopback) {
            metaLines.push(`${_("Loopback")}: ${_("Yes")}`);
        }

        return {
            title: row.title,
            metaLines,
            metricLines: [
                `${_("Current RX")}: ${displayedMetrics.hasRate ? this._formatRate(displayedMetrics.rxRate) : "--"}`,
                `${_("Current TX")}: ${displayedMetrics.hasRate ? this._formatRate(displayedMetrics.txRate) : "--"}`,
                `${_("Total RX")}: ${this._formatBytes(displayedMetrics.totalRxBytes)}`,
                `${_("Total TX")}: ${this._formatBytes(displayedMetrics.totalTxBytes)}`
            ],
            note: row.footer ? `${_("Note")}: ${row.footer}` : ""
        };
    }

    _buildAggregateDetailsData(aggregate, displayedMetrics, visibleRowCount) {
        return {
            title: aggregate.title,
            metaLines: [
                `${_("Visible interfaces")}: ${visibleRowCount}`
            ],
            metricLines: [
                `${_("Current RX")}: ${displayedMetrics.hasRate ? this._formatRate(displayedMetrics.rxRate) : "--"}`,
                `${_("Current TX")}: ${displayedMetrics.hasRate ? this._formatRate(displayedMetrics.txRate) : "--"}`,
                `${_("Total RX")}: ${this._formatBytes(displayedMetrics.totalRxBytes)}`,
                `${_("Total TX")}: ${this._formatBytes(displayedMetrics.totalTxBytes)}`
            ],
            note: aggregate.footer ? `${_("Note")}: ${aggregate.footer}` : ""
        };
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

        this._cancelQueuedDetailsPopupHide();

        if (this._detailsPopup) {
            this._detailsPopup.destroy();
            this._detailsPopup = null;
        }

        this._monitor.reset();
        this.settings = null;
    }
}

function main(metadata, deskletId) {
    return new BandwidthMonitorDesklet(metadata, deskletId);
}