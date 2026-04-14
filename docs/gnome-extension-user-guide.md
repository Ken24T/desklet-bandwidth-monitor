# GNOME Extension User Guide

This guide describes the current GNOME Shell extension MVP on the `port/gnome-extenstion` branch.

It is intentionally separate from `docs/user-guide.md`, which remains the Cinnamon desklet guide.

## Current Status

The GNOME implementation currently provides:

- a top-bar panel indicator
- live RX and TX summary text in the panel
- a dropdown with one row per visible interface
- session RX and TX totals for each row
- an optional combined traffic row
- automatic or preferred-interface selection
- basic preferences for refresh rate, unit mode, text size, tunnel handling, and loopback visibility

The GNOME implementation does not yet provide:

- sparkline charts
- per-interface visibility management in preferences
- custom colour themes
- desklet-style desktop placement
- full settings parity with the Cinnamon version

## Requirements

The current MVP is targeted at GNOME Shell 50.

Required local tools and runtime pieces:

- `gnome-shell`
- `gnome-extensions`
- `glib-compile-schemas`
- `gjs`

## Validation

Validate just the GNOME extension:

```bash
./scripts/validate-gnome-extension.sh
```

Validate the full repository state, including the desklet and the GNOME extension:

```bash
./scripts/validate-desklet.sh
```

## Local Installation

Install the extension into the local user extensions directory:

```bash
./scripts/install-gnome-extension.sh
```

For a faster edit-test loop during development, reinstall and reload the current extension in one step:

```bash
./scripts/reload-gnome-extension.sh
```

To open a fresh preferences window after reloading:

```bash
./scripts/reload-gnome-extension.sh --prefs
```

This copies the extension into:

```text
~/.local/share/gnome-shell/extensions/bandwidth-monitor-gnome@Ken24T
```

After installation, enable it from a GNOME Shell session using the Extensions app or `gnome-extensions enable bandwidth-monitor-gnome@Ken24T`.

If the extension does not appear immediately in the Extensions app after the first local install, log out and back in. On this Ubuntu GNOME setup, the running session may not index newly copied user extensions until the session refreshes.

When iterating on `prefs.js`, avoid relying on a long-lived Extension Manager window alone. On this system, both `extension-manager` and the GNOME extension preferences host can keep showing stale preferences UI code until they are restarted. Use `./scripts/reload-gnome-extension.sh --prefs` to reopen preferences through a fresh host process.

## Packaging

Create a zip archive for the GNOME extension:

```bash
./scripts/package-gnome-extension.sh
```

The archive is written into `dist/` and includes the compiled schema.

The archive is packaged in the format expected by `gnome-extensions install`, with `metadata.json` at the root of the zip.

## Current Behaviour

The panel indicator shows a compact live bandwidth summary.

Current summary behaviour:

- when more than one active interface is visible and the combined row is enabled, the panel summary uses combined traffic
- otherwise, the panel summary follows the current primary interface
- when the extension is still warming up, the panel summary shows a waiting state until enough samples exist to calculate rates

The dropdown currently shows:

- a short status block describing the current primary interface
- one row per visible interface
- live RX and TX rates for each row
- session totals for each row
- any current fallback or availability note for that row
- an optional combined traffic row at the bottom
- actions for resetting session totals and opening Preferences

## Preferences

The current preferences window exposes:

- refresh interval in seconds
- rate units in bytes per second or bits per second
- text size for the panel summary and dropdown, with `0` meaning the GNOME Shell theme default
- primary-interface mode: automatic or preferred interface
- preferred interface name
- whether tunnel devices may become the primary interface
- whether loopback devices appear in the dropdown
- whether the combined traffic row is shown

## Known Limitations

The GNOME MVP is intentionally smaller than the Cinnamon desklet.

Known current limitations:

- the dropdown always shows the discovered visible interfaces; there is no per-interface show or hide editor yet
- the panel summary format is fixed rather than fully configurable
- charts and historical sparklines are not yet implemented in the GNOME UI
- session totals reset when the extension is disabled, reloaded, or when you use the reset action
- the extension is designed for GNOME Shell 50 and has not yet been validated against older Shell releases

## Next Slice

The next sensible implementation slices for the GNOME extension are:

1. per-interface visibility controls in preferences
2. improved dropdown layout and primary-interface emphasis
3. optional chart support if it remains lightweight in GNOME Shell