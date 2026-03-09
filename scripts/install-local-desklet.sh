#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
uuid="bandwidth-monitor@Ken24T"
desklet_dir="$HOME/.local/share/cinnamon/desklets"
target_path="$desklet_dir/$uuid"

mkdir -p "$desklet_dir"
ln -sfn "$repo_root" "$target_path"

echo "Linked $repo_root"
echo "to $target_path"
echo "You can now add the desklet in Cinnamon using the UUID $uuid."