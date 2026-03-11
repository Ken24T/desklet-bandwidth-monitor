#!/usr/bin/python3

import json
import os
import re
import sys
import time

import gi

for candidate in (
    "/usr/share/cinnamon/cinnamon-settings/bin",
    "/usr/share/cinnamon/cinnamon-settings",
):
    if candidate not in sys.path:
        sys.path.append(candidate)

gi.require_version("Gtk", "3.0")

from gi.repository import Gtk, Pango

from JsonSettingsWidgets import *


class InterfaceVisibilityWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)

        self.key = key
        self.info = info
        self.settings = settings
        self.root_path = info.get("root-path", "/sys/class/net")
        self.state_key = info.get("state-key", "visible-interfaces")
        self.display_key = info.get("display-key", "interface-display-settings")
        self.reset_key = info.get("reset-key", "reset-interface-request")
        self.include_loopback_key = info.get("include-loopback-key", "include-loopback-interfaces")
        self._rows = {}
        self._ordered_names = []
        self._updating = False

        self.set_spacing(6)

        self.interface_list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.pack_start(self.interface_list, False, False, 0)

        self.settings.listen(self.state_key, self._on_setting_changed)
        self.settings.listen(self.display_key, self._on_display_setting_changed)
        self.settings.listen(self.include_loopback_key, self._on_include_loopback_changed)

        self._rebuild_interface_rows()
        self._sync_visibility_from_setting(self.settings.get_value(self.state_key))
        self._sync_display_from_setting(self.settings.get_value(self.display_key))

    def _on_setting_changed(self, _key, value):
        self._rebuild_interface_rows(value)
        self._sync_visibility_from_setting(value)
        self._sync_display_from_setting(self.settings.get_value(self.display_key))

    def _on_display_setting_changed(self, _key, value):
        self._sync_display_from_setting(value)

    def _on_include_loopback_changed(self, _key, _value):
        self._rebuild_interface_rows()
        self._sync_visibility_from_setting(self.settings.get_value(self.state_key))
        self._sync_display_from_setting(self.settings.get_value(self.display_key))

    def _on_interface_toggled(self, *_args):
        if self._updating:
            return

        self._write_state()

    def _on_move_up_clicked(self, _button, interface_name):
        self._move_interface(interface_name, -1)

    def _on_move_down_clicked(self, _button, interface_name):
        self._move_interface(interface_name, 1)

    def _on_reset_clicked(self, _button, interface_name):
        request = f"{interface_name}:{int(time.time() * 1000)}"
        self.settings.set_value(self.reset_key, request)

    def _on_name_changed(self, _entry, interface_name):
        self._write_display_settings(interface_name)

    def _on_show_system_name_toggled(self, _switch, _paramspec, interface_name):
        self._write_display_settings(interface_name)

    def _sync_visibility_from_setting(self, value):
        shown_names = set(self._deserialise_state(value, self._ordered_names)["shown"])

        self._updating = True
        for name in self._ordered_names:
            row = self._rows.get(name)
            if row is None:
                continue
            row["toggle"].set_active(name in shown_names)
        self._update_move_button_sensitivity()
        self._updating = False

    def _sync_display_from_setting(self, value):
        display_settings = self._deserialise_display_state(value)

        self._updating = True
        for name, row in self._rows.items():
            config = display_settings.get(name, {})
            row["name_entry"].set_text(config.get("customName", ""))
            row["show_system_name"].set_active(config.get("showSystemName", True))
        self._updating = False

    def _rebuild_interface_rows(self, state_value=None):
        for child in list(self.interface_list.get_children()):
            self.interface_list.remove(child)

        self._rows = {}
        interfaces = self._list_interfaces()
        state = self._deserialise_state(
            self.settings.get_value(self.state_key) if state_value is None else state_value,
            [interface["name"] for interface in interfaces]
        )
        self._ordered_names = state["order"]
        interface_by_name = {interface["name"]: interface for interface in interfaces}

        if not interfaces:
            label = Gtk.Label(label=_("No interfaces detected."), halign=Gtk.Align.START)
            label.set_xalign(0.0)
            label.set_line_wrap(True)
            self.interface_list.pack_start(label, False, False, 0)
            self.show_all()
            return

        for interface_name in self._ordered_names:
            interface = interface_by_name.get(interface_name)
            if interface is None:
                continue

            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            label = Gtk.Label(label=self._build_interface_label(interface), halign=Gtk.Align.START)
            label.set_xalign(0.0)
            label.set_hexpand(False)
            label.set_line_wrap(False)
            label.set_ellipsize(Pango.EllipsizeMode.END)
            label.set_width_chars(24)
            label.set_max_width_chars(32)

            name_entry = Gtk.Entry()
            name_entry.set_hexpand(True)
            name_entry.set_placeholder_text(interface["classification"]["label"])
            name_entry.connect("changed", self._on_name_changed, interface["name"])

            show_name_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
            show_name_label = Gtk.Label(label=_("Show device name"), halign=Gtk.Align.START)
            show_name_label.set_xalign(0.0)
            show_system_name = Gtk.Switch(halign=Gtk.Align.END, valign=Gtk.Align.CENTER)
            show_system_name.connect("notify::active", self._on_show_system_name_toggled, interface["name"])
            show_name_box.pack_start(show_name_label, False, False, 0)
            show_name_box.pack_start(show_system_name, False, False, 0)

            toggle = Gtk.Switch(halign=Gtk.Align.END, valign=Gtk.Align.CENTER)
            toggle.connect("notify::active", self._on_interface_toggled)

            move_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
            move_up_button = Gtk.Button(label=_("Up"))
            move_up_button.connect("clicked", self._on_move_up_clicked, interface["name"])
            move_down_button = Gtk.Button(label=_("Down"))
            move_down_button.connect("clicked", self._on_move_down_clicked, interface["name"])
            move_box.pack_start(move_up_button, False, False, 0)
            move_box.pack_start(move_down_button, False, False, 0)

            reset_button = Gtk.Button(label=_("Reset totals"))
            reset_button.connect("clicked", self._on_reset_clicked, interface["name"])

            row.pack_start(toggle, False, False, 0)
            row.pack_start(label, False, False, 0)
            row.pack_start(name_entry, True, True, 0)
            row.pack_start(show_name_box, False, False, 0)
            row.pack_start(move_box, False, False, 0)
            row.pack_start(reset_button, False, False, 0)
            self.interface_list.pack_start(row, False, False, 0)

            self._rows[interface["name"]] = {
                "toggle": toggle,
                "reset": reset_button,
                "name_entry": name_entry,
                "show_system_name": show_system_name,
                "move_up": move_up_button,
                "move_down": move_down_button,
            }

        self._update_move_button_sensitivity()
        self.show_all()

    def _list_interfaces(self):
        if not os.path.isdir(self.root_path):
            return []

        include_loopback = bool(self.settings.get_value(self.include_loopback_key))
        interfaces = []
        for name in sorted(os.listdir(self.root_path)):
            interface_path = os.path.join(self.root_path, name)
            if not os.path.isdir(interface_path):
                continue

            type_code = self._read_int(os.path.join(interface_path, "type"), -1)
            classification = self._classify(name, type_code)
            if classification["id"] == "virtual-noise":
                continue
            if classification["id"] == "loopback" and not include_loopback:
                continue

            oper_state = self._read_text(os.path.join(interface_path, "operstate")) or "unknown"
            interfaces.append({
                "name": name,
                "classification": classification,
                "oper_state": oper_state,
            })

        return interfaces

    def _default_visible_names(self):
        return [
            interface["name"]
            for interface in self._list_interfaces()
            if interface["classification"]["id"] != "loopback"
        ]

    def _serialise_state(self, shown_names, ordered_names):
        return json.dumps({"shown": shown_names, "order": ordered_names})

    def _deserialise_state(self, value, available_names=None):
        available_names = list(available_names or self._default_visible_names())

        if not value:
            shown = self._default_visible_names()
            return {
                "shown": [name for name in shown if name in available_names],
                "order": self._normalise_order([], available_names),
            }

        try:
            data = json.loads(value)
            if isinstance(data, dict) and isinstance(data.get("shown"), list):
                shown = [name for name in data["shown"] if isinstance(name, str)]
                order = data.get("order") if isinstance(data.get("order"), list) else []
                normalised_order = self._normalise_order(order, available_names)
                allowed = set(normalised_order)
                return {
                    "shown": [name for name in shown if name in allowed],
                    "order": normalised_order,
                }
        except ValueError:
            pass

        shown = [name.strip() for name in value.split(",") if name.strip()]
        normalised_order = self._normalise_order(shown, available_names)
        allowed = set(normalised_order)
        return {
            "shown": [name for name in shown if name in allowed],
            "order": normalised_order,
        }

    def _normalise_order(self, ordered_names, available_names):
        normalised = []
        seen = set()

        for name in ordered_names:
            if isinstance(name, str) and name in available_names and name not in seen:
                normalised.append(name)
                seen.add(name)

        for name in available_names:
            if name not in seen:
                normalised.append(name)
                seen.add(name)

        return normalised

    def _write_state(self):
        if self._updating:
            return

        shown = [
            name
            for name in self._ordered_names
            if name in self._rows and self._rows[name]["toggle"].get_active()
        ]
        self.settings.set_value(self.state_key, self._serialise_state(shown, self._ordered_names))

    def _move_interface(self, interface_name, direction):
        if interface_name not in self._ordered_names:
            return

        current_index = self._ordered_names.index(interface_name)
        target_index = current_index + direction

        if target_index < 0 or target_index >= len(self._ordered_names):
            return

        self._ordered_names[current_index], self._ordered_names[target_index] = (
            self._ordered_names[target_index],
            self._ordered_names[current_index],
        )
        self._write_state()

    def _update_move_button_sensitivity(self):
        for index, name in enumerate(self._ordered_names):
            row = self._rows.get(name)
            if row is None:
                continue

            row["move_up"].set_sensitive(index > 0)
            row["move_down"].set_sensitive(index < len(self._ordered_names) - 1)

    def _serialise_display_state(self, display_settings):
        if not display_settings:
            return ""

        return json.dumps(display_settings, sort_keys=True)

    def _deserialise_display_state(self, value):
        if not value:
            return {}

        try:
            data = json.loads(value)
        except ValueError:
            return {}

        if not isinstance(data, dict):
            return {}

        parsed = {}
        for interface_name, config in data.items():
            if not isinstance(interface_name, str) or not isinstance(config, dict):
                continue

            parsed[interface_name] = {
                "customName": config.get("customName", "") if isinstance(config.get("customName", ""), str) else "",
                "showSystemName": config.get("showSystemName", True) if isinstance(config.get("showSystemName", True), bool) else True,
            }

        return parsed

    def _write_display_settings(self, interface_name):
        if self._updating:
            return

        row = self._rows.get(interface_name)
        if row is None:
            return

        display_settings = self._deserialise_display_state(self.settings.get_value(self.display_key))
        custom_name = row["name_entry"].get_text().strip()
        show_system_name = row["show_system_name"].get_active()

        if custom_name or not show_system_name:
            display_settings[interface_name] = {
                "customName": custom_name,
                "showSystemName": show_system_name,
            }
        elif interface_name in display_settings:
            del display_settings[interface_name]

        self.settings.set_value(self.display_key, self._serialise_display_state(display_settings))

    def _build_interface_label(self, interface):
        label = interface["classification"]["label"]
        oper_state = interface["oper_state"]
        return f"{interface['name']}  •  {label}  •  {oper_state}"

    def _classify(self, name, type_code):
        if name == "lo" or type_code == 772:
            return {"id": "loopback", "label": "Loopback"}

        if re.match(r"^(tun|tap|wg|ppp|vpn)", name) or type_code == 65534:
            return {"id": "tunnel", "label": "VPN/Tunnel"}

        if re.match(r"^(wl|wlan)", name):
            return {"id": "wifi", "label": "Wi-Fi"}

        if re.match(r"^(en|eth)", name) or type_code == 1:
            return {"id": "ethernet", "label": "Ethernet"}

        if re.match(r"^(veth|virbr|docker|br-|podman|vmnet)", name):
            return {"id": "virtual-noise", "label": "Virtual"}

        return {"id": "other", "label": "Interface"}

    def _read_int(self, path, fallback):
        value = self._read_text(path)
        if value is None:
            return fallback

        try:
            return int(value)
        except ValueError:
            return fallback

    def _read_text(self, path):
        try:
            with open(path, encoding="utf-8") as handle:
                return handle.read().strip()
        except OSError:
            return None