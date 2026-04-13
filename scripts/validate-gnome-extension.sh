#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

required_files=(
  "gnome-extension/metadata.json"
  "gnome-extension/extension.js"
  "gnome-extension/prefs.js"
  "gnome-extension/stylesheet.css"
  "gnome-extension/schemas/org.gnome.shell.extensions.bandwidth-monitor.gschema.xml"
  "gnome-extension/shared/formatting.js"
  "gnome-extension/shared/interfaces.js"
  "gnome-extension/shared/monitor.js"
  "gnome-extension/shared/settings.js"
  "scripts/install-gnome-extension.sh"
  "scripts/package-gnome-extension.sh"
)

for relative_path in "${required_files[@]}"; do
  if [[ ! -f "$repo_root/$relative_path" ]]; then
    echo "Missing required file: $relative_path" >&2
    exit 1
  fi
done

python3 - "$repo_root/gnome-extension/metadata.json" <<'PY'
import json
import sys

metadata_path = sys.argv[1]

with open(metadata_path, encoding="utf-8") as handle:
    metadata = json.load(handle)

required_metadata_keys = ["uuid", "name", "description", "shell-version", "settings-schema"]
missing = [key for key in required_metadata_keys if key not in metadata]
if missing:
    raise SystemExit(f"gnome-extension/metadata.json is missing required keys: {', '.join(missing)}")

shell_versions = metadata.get("shell-version")
if not isinstance(shell_versions, list) or not shell_versions:
    raise SystemExit("gnome-extension/metadata.json must include at least one shell-version entry")
PY

glib-compile-schemas --strict --dry-run "$repo_root/gnome-extension/schemas"

gjs -m "$repo_root/gnome-extension/shared/formatting.js" >/dev/null
gjs -m "$repo_root/gnome-extension/shared/interfaces.js" >/dev/null
gjs -m "$repo_root/gnome-extension/shared/monitor.js" >/dev/null
gjs -m "$repo_root/gnome-extension/shared/settings.js" >/dev/null

grep -q "export default class .* extends Extension" "$repo_root/gnome-extension/extension.js" || {
  echo "gnome-extension/extension.js is missing the GNOME extension entry class" >&2
  exit 1
}

grep -q "fillPreferencesWindow" "$repo_root/gnome-extension/prefs.js" || {
  echo "gnome-extension/prefs.js is missing fillPreferencesWindow" >&2
  exit 1
}

"$repo_root/scripts/package-gnome-extension.sh" --dry-run >/dev/null

echo "GNOME extension validation passed."