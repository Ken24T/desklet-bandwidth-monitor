#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
desklet_dir="$HOME/.local/share/cinnamon/desklets"

python3 - "$repo_root" "$desklet_dir" <<'PY'
import json
import os
import shutil
import sys

repo_root = sys.argv[1]
desklet_dir = sys.argv[2]

with open(os.path.join(repo_root, "metadata.json"), encoding="utf-8") as handle:
	metadata = json.load(handle)

uuid = metadata["uuid"]
target_path = os.path.join(desklet_dir, uuid)
package_files = [
	"desklet.js",
	"metadata.json",
	"settings-schema.json",
	"stylesheet.css",
	"interfaces.js",
	"sampler.js",
	"monitor.js",
	"formatting.js",
	"sparkline.js",
]

missing = [path for path in package_files if not os.path.isfile(os.path.join(repo_root, path))]
if missing:
	raise SystemExit(f"Missing desklet files: {', '.join(missing)}")

os.makedirs(desklet_dir, exist_ok=True)

if os.path.lexists(target_path):
	if os.path.islink(target_path) or os.path.isfile(target_path):
		os.unlink(target_path)
	else:
		shutil.rmtree(target_path)

os.makedirs(target_path, exist_ok=True)

for relative_path in package_files:
	source_path = os.path.join(repo_root, relative_path)
	destination_path = os.path.join(target_path, relative_path)
	shutil.copy2(source_path, destination_path)

print(f"Installed {uuid}")
print(f"to {target_path}")
print("This is a real copied desklet install, not a symlink.")
PY
echo "You can now add or reload the desklet in Cinnamon from the local desklets directory."