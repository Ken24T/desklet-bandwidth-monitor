#!/usr/bin/python3

import json
import os
import sys

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


class DeskletInfoWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)

        self.key = key
        self.info = info
        self.settings = settings

        self.set_spacing(8)

        metadata = self._load_metadata()
        uuid = metadata.get("uuid", "Unknown")
        version = metadata.get("version", "Unknown")
        install_path = os.path.join(os.path.expanduser("~/.local/share/cinnamon/desklets"), uuid)
        settings_path = os.path.join(os.path.expanduser("~/.config/cinnamon/spices"), uuid)

        details = [
            ("Name", metadata.get("name", "Unknown")),
            ("Version", version),
            ("UUID", uuid),
            ("Max instances", str(metadata.get("max-instances", "Unknown"))),
            ("Desklet path", install_path),
            ("Settings path", settings_path),
            ("Counters source", "/sys/class/net/<interface>/statistics/"),
        ]

        grid = Gtk.Grid(column_spacing=12, row_spacing=6)
        grid.set_hexpand(True)

        for row_index, (label_text, value_text) in enumerate(details):
            label = Gtk.Label(label=label_text, halign=Gtk.Align.START)
            label.set_xalign(0.0)

            value = Gtk.Label(label=value_text, halign=Gtk.Align.START)
            value.set_xalign(0.0)
            value.set_line_wrap(True)
            value.set_selectable(True)

            grid.attach(label, 0, row_index, 1, 1)
            grid.attach(value, 1, row_index, 1, 1)

        hint = Gtk.Label(
            label="Useful for confirming the installed version, UUID, and local Cinnamon paths during troubleshooting.",
            halign=Gtk.Align.START,
        )
        hint.set_xalign(0.0)
        hint.set_line_wrap(True)

        self.pack_start(grid, False, False, 0)
        self.pack_start(hint, False, False, 0)
        self.show_all()

    def _load_metadata(self):
        metadata_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "metadata.json")
        try:
            with open(metadata_path, encoding="utf-8") as handle:
                return json.load(handle)
        except (OSError, ValueError):
            return {}