import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {RATE_UNIT_MODE_VALUES, SELECTION_MODE_VALUES, SETTINGS_KEYS} from './shared/settings.js';

const SELECTION_MODE_OPTIONS = [
    { id: SELECTION_MODE_VALUES[0], label: 'Automatic' },
    { id: SELECTION_MODE_VALUES[1], label: 'Preferred interface' },
];

const RATE_UNIT_OPTIONS = [
    { id: RATE_UNIT_MODE_VALUES[0], label: 'Automatic bytes per second' },
    { id: RATE_UNIT_MODE_VALUES[1], label: 'Automatic bits per second' },
];

function createDropdownRow(settings, key, title, subtitle, options) {
    const model = new Gtk.StringList();
    options.forEach(option => model.append(option.label));

    const dropdown = new Gtk.DropDown({
        model,
        selected: Math.max(0, options.findIndex(option => option.id === settings.get_string(key))),
        valign: Gtk.Align.CENTER,
    });
    const row = new Adw.ActionRow({ title, subtitle });
    row.add_suffix(dropdown);
    row.activatable_widget = dropdown;

    dropdown.connect('notify::selected', () => {
        const selected = options[dropdown.get_selected()] || options[0];
        settings.set_string(key, selected.id);
    });
    settings.connect(`changed::${key}`, () => {
        const selectedIndex = Math.max(0, options.findIndex(option => option.id === settings.get_string(key)));
        if (dropdown.get_selected() !== selectedIndex)
            dropdown.set_selected(selectedIndex);
    });

    return row;
}

function createSwitchRow(settings, key, title, subtitle) {
    const row = new Adw.SwitchRow({ title, subtitle, active: settings.get_boolean(key) });

    row.connect('notify::active', () => settings.set_boolean(key, row.get_active()));
    settings.connect(`changed::${key}`, () => {
        const active = settings.get_boolean(key);
        if (row.get_active() !== active)
            row.set_active(active);
    });

    return row;
}

function createEntryRow(settings, key, title, subtitle) {
    const row = new Adw.EntryRow({ title });
    row.set_text(settings.get_string(key));
    row.set_show_apply_button(true);

    if (subtitle)
        row.set_tooltip_text(subtitle);

    row.connect('apply', () => settings.set_string(key, row.get_text().trim()));
    row.connect('changed', () => {
        if (!row.get_show_apply_button())
            row.set_show_apply_button(true);
    });
    settings.connect(`changed::${key}`, () => {
        const value = settings.get_string(key);
        if (row.get_text() !== value)
            row.set_text(value);
        row.set_show_apply_button(true);
    });

    return row;
}

function createSpinRow(settings, key, title, subtitle, minimum, maximum, step) {
    const adjustment = new Gtk.Adjustment({
        lower: minimum,
        upper: maximum,
        step_increment: step,
        page_increment: step,
        value: settings.get_int(key),
    });
    const spin = new Gtk.SpinButton({
        adjustment,
        digits: 0,
        valign: Gtk.Align.CENTER,
    });
    const row = new Adw.ActionRow({ title, subtitle });
    row.add_suffix(spin);
    row.activatable_widget = spin;

    spin.connect('value-changed', () => settings.set_int(key, spin.get_value_as_int()));
    settings.connect(`changed::${key}`, () => {
        const value = settings.get_int(key);
        if (spin.get_value_as_int() !== value)
            spin.set_value(value);
    });

    return row;
}

export default class BandwidthMonitorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const monitoringPage = new Adw.PreferencesPage({ title: _('Monitoring') });
        const monitoringGroup = new Adw.PreferencesGroup({ title: _('Monitoring') });
        monitoringGroup.add(createSpinRow(
            settings,
            SETTINGS_KEYS.SAMPLE_SECONDS,
            _('Refresh interval'),
            _('Seconds between bandwidth samples.'),
            1,
            10,
            1
        ));
        monitoringGroup.add(createDropdownRow(
            settings,
            SETTINGS_KEYS.RATE_UNIT_MODE,
            _('Rate units'),
            _('Choose whether rates use byte or bit scaling.'),
            RATE_UNIT_OPTIONS
        ));
        monitoringGroup.add(createSpinRow(
            settings,
            SETTINGS_KEYS.FONT_SIZE_POINTS,
            _('Text size'),
            _('Point size for the panel summary and dropdown text. Set to 0 to use the GNOME Shell theme default.'),
            0,
            24,
            1
        ));
        monitoringGroup.add(createSwitchRow(
            settings,
            SETTINGS_KEYS.SHOW_AGGREGATE,
            _('Show combined traffic row'),
            _('Include a combined RX and TX row at the bottom of the dropdown.')
        ));
        monitoringPage.add(monitoringGroup);

        const interfaceGroup = new Adw.PreferencesGroup({ title: _('Interface selection') });
        interfaceGroup.add(createDropdownRow(
            settings,
            SETTINGS_KEYS.SELECTION_MODE,
            _('Primary interface mode'),
            _('Follow the best active interface automatically, or pin a preferred device name.'),
            SELECTION_MODE_OPTIONS
        ));
        interfaceGroup.add(createEntryRow(
            settings,
            SETTINGS_KEYS.PREFERRED_INTERFACE,
            _('Preferred interface'),
            _('Use a device name such as enp3s0 or wlp2s0 when the primary interface mode is set to Preferred interface.')
        ));
        interfaceGroup.add(createSwitchRow(
            settings,
            SETTINGS_KEYS.INCLUDE_TUNNELS,
            _('Allow VPN and tunnel devices'),
            _('Let automatic selection choose tunnel devices such as tun0 or wg0 as the primary interface.')
        ));
        interfaceGroup.add(createSwitchRow(
            settings,
            SETTINGS_KEYS.INCLUDE_LOOPBACK,
            _('Show loopback devices'),
            _('Include loopback devices such as lo in the dropdown list.')
        ));
        monitoringPage.add(interfaceGroup);

        const infoGroup = new Adw.PreferencesGroup({ title: _('Current scope') });
        const infoRow = new Adw.ActionRow({
            title: _('GNOME MVP status'),
            subtitle: _('This first implementation provides a top-bar summary, a multi-interface dropdown, session totals, a combined row, basic monitoring preferences, and text-size control. Sparkline charts, per-interface visibility controls, and deeper appearance options are planned later.')
        });
        infoRow.set_sensitive(false);
        infoGroup.add(infoRow);
        monitoringPage.add(infoGroup);

        window.add(monitoringPage);
    }
}