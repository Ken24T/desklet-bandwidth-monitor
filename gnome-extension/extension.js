import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {formatCompactRate, formatDataSize, formatRate} from './shared/formatting.js';
import {SessionMonitor} from './shared/monitor.js';
import {readSettingsSnapshot} from './shared/settings.js';

const MENU_ICON_NAME = 'network-transmit-receive-symbolic';

function resolveInlineFontSizeStyle(fontSizePoints) {
    if (!Number.isInteger(fontSizePoints) || fontSizePoints <= 0)
        return '';

    return `font-size: ${fontSizePoints}pt;`;
}

function applyLabelFontSize(label, fontSizePoints) {
    if (!label)
        return;

    label.style = resolveInlineFontSizeStyle(fontSizePoints);

    if (!Number.isInteger(fontSizePoints) || fontSizePoints <= 0) {
        label.clutter_text.set_font_name(null);
        label.queue_relayout();
        return;
    }

    const currentDescription = label.clutter_text.get_font_description();
    const nextDescription = currentDescription
        ? currentDescription.copy()
        : Pango.FontDescription.from_string('Sans');

    nextDescription.set_size(fontSizePoints * Pango.SCALE);
    label.clutter_text.set_font_description(nextDescription);
    label.queue_relayout();
}

function createInfoItem(title, subtitle = '', note = '', fontSizePoints = 0) {
    const inlineFontSizeStyle = resolveInlineFontSizeStyle(fontSizePoints);
    const item = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });
    const box = new St.BoxLayout({
        vertical: true,
        style_class: 'bandwidth-monitor-menu-item',
        style: inlineFontSizeStyle,
    });
    const titleLabel = new St.Label({
        text: title,
        style_class: 'bandwidth-monitor-menu-title',
        x_expand: true,
    });
    applyLabelFontSize(titleLabel, fontSizePoints);

    box.add_child(titleLabel);

    if (subtitle) {
        const subtitleLabel = new St.Label({
            text: subtitle,
            style_class: 'bandwidth-monitor-menu-subtitle',
            x_expand: true,
        });
        applyLabelFontSize(subtitleLabel, fontSizePoints);
        subtitleLabel.clutter_text.line_wrap = true;
        subtitleLabel.clutter_text.ellipsize = 0;
        box.add_child(subtitleLabel);
    }

    if (note) {
        const noteLabel = new St.Label({
            text: note,
            style_class: 'bandwidth-monitor-menu-note',
            x_expand: true,
        });
        applyLabelFontSize(noteLabel, fontSizePoints);
        noteLabel.clutter_text.line_wrap = true;
        noteLabel.clutter_text.ellipsize = 0;
        box.add_child(noteLabel);
    }

    item.add_child(box);
    return item;
}

function createTrafficItem(row, rateUnitMode, fontSizePoints = 0, aggregate = false) {
    const inlineFontSizeStyle = resolveInlineFontSizeStyle(fontSizePoints);
    const item = new PopupMenu.PopupBaseMenuItem({
        reactive: false,
        can_focus: false,
    });
    const container = new St.BoxLayout({
        vertical: true,
        style_class: aggregate
            ? 'bandwidth-monitor-menu-item bandwidth-monitor-menu-item-aggregate'
            : 'bandwidth-monitor-menu-item',
        style: inlineFontSizeStyle,
    });
    const header = new St.BoxLayout({
        vertical: false,
        x_expand: true,
        style_class: 'bandwidth-monitor-menu-header',
    });
    const titleLabel = new St.Label({
        text: row.title,
        style_class: 'bandwidth-monitor-menu-row-title',
        x_expand: true,
    });
    applyLabelFontSize(titleLabel, fontSizePoints);
    const stateLabel = new St.Label({
        text: resolveStateText(row, aggregate),
        style_class: 'bandwidth-monitor-menu-row-state',
    });
    applyLabelFontSize(stateLabel, fontSizePoints);
    const ratesLabel = new St.Label({
        text: row.hasRate
            ? `RX ${formatRate(row.rxRate, rateUnitMode)}   TX ${formatRate(row.txRate, rateUnitMode)}`
            : 'RX --   TX --',
        style_class: 'bandwidth-monitor-menu-row-metrics',
        x_expand: true,
    });
    applyLabelFontSize(ratesLabel, fontSizePoints);
    const totalsLabel = new St.Label({
        text: `Session totals: RX ${formatDataSize(row.totalRxBytes)}   TX ${formatDataSize(row.totalTxBytes)}`,
        style_class: 'bandwidth-monitor-menu-row-secondary',
        x_expand: true,
    });
    applyLabelFontSize(totalsLabel, fontSizePoints);

    header.add_child(titleLabel);
    header.add_child(stateLabel);

    container.add_child(header);
    container.add_child(ratesLabel);
    container.add_child(totalsLabel);

    if (row.footer) {
        const footerLabel = new St.Label({
            text: row.footer,
            style_class: 'bandwidth-monitor-menu-note',
            x_expand: true,
        });
        applyLabelFontSize(footerLabel, fontSizePoints);
        footerLabel.clutter_text.line_wrap = true;
        footerLabel.clutter_text.ellipsize = 0;
        container.add_child(footerLabel);
    }

    item.add_child(container);
    return item;
}

function resolveStateText(row, aggregate) {
    if (aggregate)
        return 'Combined';

    if (!row.available)
        return 'Unavailable';

    if (row.selected)
        return 'Primary';

    return capitalise(row.state || 'active');
}

function capitalise(value) {
    if (!value)
        return '';

    return `${value[0].toUpperCase()}${value.slice(1)}`;
}

const BandwidthIndicator = GObject.registerClass(
class BandwidthIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Bandwidth Monitor'));

        this._extension = extension;
        this._settings = extension.getSettings();
        this._config = readSettingsSnapshot(this._settings);
        this._monitor = new SessionMonitor();
        this._timeoutId = 0;
        this._settingsChangedId = this._settings.connect('changed', () => this._reloadSettings());

        this._indicatorBox = new St.BoxLayout({
            vertical: false,
            style_class: 'bandwidth-monitor-indicator-box',
        });
        this._indicatorIcon = new St.Icon({
            icon_name: MENU_ICON_NAME,
            style_class: 'system-status-icon',
        });
        this._summaryLabel = new St.Label({
            text: 'RX -- TX --',
            style_class: 'bandwidth-monitor-indicator-label',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._applyTextSize();

        this._indicatorBox.add_child(this._indicatorIcon);
        this._indicatorBox.add_child(this._summaryLabel);
        this.add_child(this._indicatorBox);

        this._statusSection = new PopupMenu.PopupMenuSection();
        this._rowsSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._statusSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._rowsSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._resetTotalsItem = new PopupMenu.PopupMenuItem(_('Reset session totals'));
        this._resetTotalsItem.connect('activate', () => {
            this._monitor.reset();
            this._updateSample();
        });
        this.menu.addMenuItem(this._resetTotalsItem);

        this._preferencesItem = new PopupMenu.PopupMenuItem(_('Preferences'));
        this._preferencesItem.connect('activate', () => this._extension.openPreferences());
        this.menu.addMenuItem(this._preferencesItem);

        this._restartTimer();
        this._updateSample();
    }

    destroy() {
        if (this._timeoutId > 0) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        this._monitor.reset();
        super.destroy();
    }

    _reloadSettings() {
        this._config = readSettingsSnapshot(this._settings);
        this._applyTextSize();
        this._restartTimer();
        this._updateSample();
    }

    _applyTextSize() {
        const inlineFontSizeStyle = resolveInlineFontSizeStyle(this._config.fontSizePoints);
        this.style = inlineFontSizeStyle;
        this._indicatorBox.style = inlineFontSizeStyle;
        applyLabelFontSize(this._summaryLabel, this._config.fontSizePoints);
    }

    _restartTimer() {
        if (this._timeoutId > 0) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        const intervalMs = this._config.sampleSeconds * 1000;
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, intervalMs, () => {
            this._updateSample();
            return GLib.SOURCE_CONTINUE;
        });
        GLib.Source.set_name_by_id(this._timeoutId, '[bandwidth-monitor-gnome] sample');
    }

    _updateSample() {
        const sample = this._monitor.sample({
            selectionMode: this._config.selectionMode,
            preferredInterface: this._config.preferredInterface,
            includeTunnelInterfaces: this._config.includeTunnelInterfaces,
            includeLoopbackInterfaces: this._config.includeLoopbackInterfaces,
        });

        this._updateSummaryLabel(sample);
        this._renderMenu(sample);
    }

    _updateSummaryLabel(sample) {
        const summaryRow = this._resolveSummaryRow(sample);
        if (!summaryRow) {
            this._summaryLabel.text = 'No link';
            return;
        }

        if (!this._rowHasLiveData(summaryRow)) {
            this._summaryLabel.text = 'Waiting';
            return;
        }

        this._summaryLabel.text = `RX ${formatCompactRate(summaryRow.rxRate, this._config.rateUnitMode)} TX ${formatCompactRate(summaryRow.txRate, this._config.rateUnitMode)}`;
    }

    _resolveSummaryRow(sample) {
        const availableRows = sample.rows.filter(row => row.available);

        if (this._config.showAggregate && sample.aggregate.available && availableRows.length > 1)
            return sample.aggregate;

        if (sample.selectedInterface) {
            const selectedRow = sample.rows.find(row => row.interfaceInfo?.name === sample.selectedInterface.name);
            if (selectedRow)
                return selectedRow;
        }

        return availableRows[0] || (sample.aggregate.available ? sample.aggregate : null);
    }

    _rowHasLiveData(row) {
        if (row.hasRate)
            return true;

        return row.rxRate > 0
            || row.txRate > 0
            || row.totalRxBytes > 0
            || row.totalTxBytes > 0;
    }

    _renderMenu(sample) {
        this._statusSection.removeAll();
        this._rowsSection.removeAll();

        const primaryText = sample.selectedInterface
            ? `Primary interface: ${sample.selectedInterface.label}`
            : 'No usable network interface was found.';
        const noteText = sample.selectionNote
            || (this._config.showAggregate
                ? 'The panel summary uses combined traffic when multiple interfaces are active.'
                : 'The panel summary follows the current primary interface.');

        this._statusSection.addMenuItem(createInfoItem('Bandwidth Monitor', primaryText, noteText, this._config.fontSizePoints));

        if (!sample.hasVisibleRows) {
            this._rowsSection.addMenuItem(createInfoItem('No visible interfaces', 'Adjust the interface settings in Preferences if you need loopback or tunnel devices.', '', this._config.fontSizePoints));
            return;
        }

        sample.rows.forEach(row => {
            this._rowsSection.addMenuItem(createTrafficItem(row, this._config.rateUnitMode, this._config.fontSizePoints));
        });

        if (this._config.showAggregate)
            this._rowsSection.addMenuItem(createTrafficItem(sample.aggregate, this._config.rateUnitMode, this._config.fontSizePoints, true));
    }
});

export default class BandwidthMonitorExtension extends Extension {
    enable() {
        this._indicator = new BandwidthIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator, 1, 'right');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}