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

from gi.repository import Gtk

from JsonSettingsWidgets import *


class InterfaceVisibilityWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)

        self.key = key
        self.info = info
        self.settings = settings
        self.root_path = info.get("root-path", "/sys/class/net")
        self.state_key = info.get("state-key", "visible-interfaces")
        self.reset_key = info.get("reset-key", "reset-interface-request")
        self.include_loopback_key = info.get("include-loopback-key", "include-loopback-interfaces")
        self._rows = {}
        self._updating = False

        self.set_spacing(6)

        self.interface_list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.pack_start(self.interface_list, False, False, 0)

        self.settings.listen(self.state_key, self._on_setting_changed)
        self.settings.listen(self.include_loopback_key, self._on_include_loopback_changed)

        self._rebuild_interface_rows()
        self._sync_from_setting(self.settings.get_value(self.state_key))

    def _on_setting_changed(self, _key, value):
        self._sync_from_setting(value)

    def _on_include_loopback_changed(self, _key, _value):
        self._rebuild_interface_rows()
        self._sync_from_setting(self.settings.get_value(self.state_key))

    def _on_interface_toggled(self, *_args):
        if self._updating:
            return

        shown = [name for name, row in self._rows.items() if row["toggle"].get_active()]
        self.settings.set_value(self.state_key, self._serialise_state(shown))

    def _on_reset_clicked(self, _button, interface_name):
        request = f"{interface_name}:{int(time.time() * 1000)}"
        self.settings.set_value(self.reset_key, request)

    def _sync_from_setting(self, value):
        shown_names = set(self._deserialise_state(value))

        self._updating = True
        for name, row in self._rows.items():
            row["toggle"].set_active(name in shown_names)
        self._updating = False

    def _rebuild_interface_rows(self):
        for child in list(self.interface_list.get_children()):
            self.interface_list.remove(child)

        self._rows = {}
        interfaces = self._list_interfaces()

        if not interfaces:
            label = Gtk.Label(label=_("No interfaces detected."), halign=Gtk.Align.START)
            label.set_xalign(0.0)
            label.set_line_wrap(True)
            self.interface_list.pack_start(label, False, False, 0)
            self.show_all()
            return

        for interface in interfaces:
            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
            label = Gtk.Label(label=self._build_interface_label(interface), halign=Gtk.Align.START)
            label.set_xalign(0.0)
            label.set_hexpand(True)
            label.set_line_wrap(False)

            toggle = Gtk.Switch(halign=Gtk.Align.END, valign=Gtk.Align.CENTER)
            toggle.connect("notify::active", self._on_interface_toggled)

            reset_button = Gtk.Button(label=_("Reset totals"))
            reset_button.connect("clicked", self._on_reset_clicked, interface["name"])

            row.pack_start(label, True, True, 0)
            row.pack_start(toggle, False, False, 0)
            row.pack_start(reset_button, False, False, 0)
            self.interface_list.pack_start(row, False, False, 0)

            self._rows[interface["name"]] = {
                "toggle": toggle,
                "reset": reset_button,
            }

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

    def _serialise_state(self, shown_names):
        return json.dumps({"shown": shown_names})

    def _deserialise_state(self, value):
        if not value:
            return self._default_visible_names()

        try:
            data = json.loads(value)
            if isinstance(data, dict) and isinstance(data.get("shown"), list):
                return [name for name in data["shown"] if isinstance(name, str)]
        except ValueError:
            pass

        return [name.strip() for name in value.split(",") if name.strip()]

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