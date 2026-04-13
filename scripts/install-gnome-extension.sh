#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
extension_root="$repo_root/gnome-extension"
extensions_dir="$HOME/.local/share/gnome-shell/extensions"

python3 - "$extension_root" "$extensions_dir" <<'PY'
import json
import os
import shutil
import sys

extension_root = sys.argv[1]
extensions_dir = sys.argv[2]

with open(os.path.join(extension_root, "metadata.json"), encoding="utf-8") as handle:
    metadata = json.load(handle)

uuid = metadata["uuid"]
target_path = os.path.join(extensions_dir, uuid)

required_paths = [
    "metadata.json",
    "extension.js",
    "prefs.js",
    "stylesheet.css",
    "schemas/org.gnome.shell.extensions.bandwidth-monitor.gschema.xml",
    "shared/formatting.js",
    "shared/interfaces.js",
    "shared/monitor.js",
    "shared/settings.js",
]

missing = [path for path in required_paths if not os.path.isfile(os.path.join(extension_root, path))]
if missing:
    raise SystemExit(f"Missing GNOME extension files: {', '.join(missing)}")

os.makedirs(extensions_dir, exist_ok=True)

if os.path.lexists(target_path):
    if os.path.islink(target_path) or os.path.isfile(target_path):
        os.unlink(target_path)
    else:
        shutil.rmtree(target_path)

shutil.copytree(extension_root, target_path)

print(uuid)
print(target_path)
PY

glib-compile-schemas "$extensions_dir/$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["uuid"])' "$extension_root/metadata.json")/schemas"

echo "Installed GNOME extension into the local user extensions directory."

if gnome-extensions info bandwidth-monitor-gnome@Ken24T >/dev/null 2>&1; then
    echo "GNOME sees the extension already. Use GNOME Extensions or gnome-extensions to enable bandwidth-monitor-gnome@Ken24T when you are ready."
else
    echo "The files are installed, but this running GNOME session has not indexed the new extension yet."
    echo "If it does not appear in Extensions immediately, log out and back in, then enable bandwidth-monitor-gnome@Ken24T."
fi