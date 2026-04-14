#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
uuid="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["uuid"])' "$repo_root/gnome-extension/metadata.json")"
open_prefs=false

for arg in "$@"; do
    case "$arg" in
        --prefs)
            open_prefs=true
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            echo "Usage: ./scripts/reload-gnome-extension.sh [--prefs]" >&2
            exit 2
            ;;
    esac
done

"$repo_root/scripts/install-gnome-extension.sh"

if gnome-extensions info "$uuid" >/dev/null 2>&1; then
    enabled_state="$(gnome-extensions info "$uuid" | sed -n 's/^  Enabled: //p')"
    if [[ "$enabled_state" == "Yes" ]]; then
        gnome-extensions disable "$uuid"
        gnome-extensions enable "$uuid"
        echo "Reloaded active GNOME extension $uuid."
    else
        echo "Extension $uuid is installed but currently disabled. Enable it when you want to test it live."
    fi
fi

if [[ "$open_prefs" == true ]]; then
    if pgrep -x extension-manager >/dev/null 2>&1; then
        echo "Extension Manager is still running and may show stale preferences content."
        echo "Opening a fresh preferences window via gnome-extensions prefs instead."
    fi

    if pgrep -f '/usr/bin/gjs -m /usr/share/gnome-shell/org.gnome.Shell.Extensions' >/dev/null 2>&1; then
        pkill -f '/usr/bin/gjs -m /usr/share/gnome-shell/org.gnome.Shell.Extensions' || true
        echo "Restarted the GNOME extension preferences host to avoid stale prefs UI code."
    fi

    nohup gnome-extensions prefs "$uuid" >/dev/null 2>&1 &
    echo "Opened a fresh preferences window for $uuid."
fi