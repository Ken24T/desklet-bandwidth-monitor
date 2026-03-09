#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

required_files=(
  "desklet.js"
  "formatting.js"
  "interfaces.js"
  "metadata.json"
  "monitor.js"
  "sampler.js"
  "sparkline.js"
  "scripts/package-desklet.sh"
  "settings-schema.json"
  "stylesheet.css"
)

for relative_path in "${required_files[@]}"; do
  if [[ ! -f "$repo_root/$relative_path" ]]; then
    echo "Missing required file: $relative_path" >&2
    exit 1
  fi
done

python3 - "$repo_root/metadata.json" "$repo_root/settings-schema.json" <<'PY'
import json
import sys

metadata_path, schema_path = sys.argv[1:3]

with open(metadata_path, encoding="utf-8") as handle:
    metadata = json.load(handle)

with open(schema_path, encoding="utf-8") as handle:
    json.load(handle)

required_metadata_keys = ["uuid", "name", "description", "version"]
missing = [key for key in required_metadata_keys if key not in metadata]
if missing:
    raise SystemExit(f"metadata.json is missing required keys: {', '.join(missing)}")
PY

grep -q "function main(metadata, deskletId)" "$repo_root/desklet.js" || {
  echo "desklet.js is missing the Cinnamon desklet main entry point" >&2
  exit 1
}

grep -q "on_desklet_removed" "$repo_root/desklet.js" || {
  echo "desklet.js is missing on_desklet_removed cleanup hook" >&2
  exit 1
}

gjs --version >/dev/null

"$repo_root/scripts/package-desklet.sh" --dry-run >/dev/null

echo "Desklet scaffold validation passed."