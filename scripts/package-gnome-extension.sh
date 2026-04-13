#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$repo_root" "$@" <<'PY'
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

repo_root = Path(sys.argv[1])
args = sys.argv[2:]
dry_run = "--dry-run" in args

with open(repo_root / "metadata.json", encoding="utf-8") as handle:
    repo_metadata = json.load(handle)

with open(repo_root / "gnome-extension" / "metadata.json", encoding="utf-8") as handle:
    extension_metadata = json.load(handle)

version = repo_metadata["version"]
uuid = extension_metadata["uuid"]
archive_dir = repo_root / "dist"
archive_path = archive_dir / f"{uuid}-v{version}.zip"

required_paths = [
    repo_root / "gnome-extension" / "metadata.json",
    repo_root / "gnome-extension" / "extension.js",
    repo_root / "gnome-extension" / "prefs.js",
    repo_root / "gnome-extension" / "stylesheet.css",
    repo_root / "gnome-extension" / "schemas" / "org.gnome.shell.extensions.bandwidth-monitor.gschema.xml",
    repo_root / "gnome-extension" / "shared" / "formatting.js",
    repo_root / "gnome-extension" / "shared" / "interfaces.js",
    repo_root / "gnome-extension" / "shared" / "monitor.js",
    repo_root / "gnome-extension" / "shared" / "settings.js",
]

missing = [str(path.relative_to(repo_root)) for path in required_paths if not path.is_file()]
if missing:
    raise SystemExit(f"Missing GNOME extension package files: {', '.join(missing)}")

if dry_run:
    print(archive_path)
    raise SystemExit(0)

archive_dir.mkdir(parents=True, exist_ok=True)

with tempfile.TemporaryDirectory(prefix="bandwidth-monitor-gnome-") as temp_dir:
    stage_root = Path(temp_dir) / uuid
    shutil.copytree(repo_root / "gnome-extension", stage_root)

    schema_dir = stage_root / "schemas"
    subprocess.run(["glib-compile-schemas", str(schema_dir)], check=True, stdout=subprocess.DEVNULL)

    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in stage_root.rglob("*"):
            archive.write(path, path.relative_to(stage_root))

print(archive_path)
PY