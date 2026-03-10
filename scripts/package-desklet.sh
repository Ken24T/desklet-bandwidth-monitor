#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$repo_root" "$@" <<'PY'
import json
import os
import sys
import zipfile

repo_root = sys.argv[1]
args = sys.argv[2:]
dry_run = "--dry-run" in args

with open(os.path.join(repo_root, "metadata.json"), encoding="utf-8") as handle:
    metadata = json.load(handle)

uuid = metadata["uuid"]
version = metadata["version"]
archive_dir = os.path.join(repo_root, "dist")
archive_path = os.path.join(archive_dir, f"{uuid}-v{version}.zip")

package_files = [
    "desklet.js",
    "metadata.json",
    "settings-schema.json",
    "stylesheet.css",
    "InterfaceVisibilityWidget.py",
    "interfaces.js",
    "sampler.js",
    "monitor.js",
    "formatting.js",
    "sparkline.js",
]

missing = [path for path in package_files if not os.path.isfile(os.path.join(repo_root, path))]
if missing:
    raise SystemExit(f"Missing package files: {', '.join(missing)}")

if dry_run:
    print(archive_path)
    raise SystemExit(0)

os.makedirs(archive_dir, exist_ok=True)

with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
    for relative_path in package_files:
        source_path = os.path.join(repo_root, relative_path)
        archive.write(source_path, os.path.join(uuid, relative_path))

print(archive_path)
PY