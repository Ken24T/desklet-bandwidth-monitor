# Bandwidth Monitor

A bandwidth monitor project with a mature Cinnamon desklet and a new GNOME Shell 50 extension MVP on the `port/gnome-extenstion` branch.

## Current Status

This repository now contains a working Cinnamon desklet implementation with:

- live bandwidth text monitoring
- interface discovery and selection
- multi-interface rows and aggregate totals
- configurable display settings
- sparkline history charts
- release packaging support

This branch also now contains a first GNOME Shell extension MVP with:

- a top-bar indicator with live RX and TX summary text
- a multi-interface dropdown with session totals
- automatic or preferred-interface selection
- a combined traffic row option
- GNOME preferences for refresh rate, text size, interface selection, and rate units
- local install, validation, and packaging scripts for GNOME Shell 50

## Key Documents

- Product specification: `.github/bandwidth_monitor_desklet_specification.md`
- Copilot workspace instructions: `.github/copilot-instructions.md`
- TCTBP workflow policy: `.github/TCTBP Agent.md`
- TCTBP workflow configuration: `.github/TCTBP.json`
- Implementation plan: `docs/implementation-plan.md`
- GNOME extension port plan: `docs/gnome-extension-plan.md`
- GNOME extension user guide: `docs/gnome-extension-user-guide.md`
- User guide: `docs/user-guide.md`

## Cinnamon Project Shape

The Cinnamon desklet remains built around:

- `desklet.js`
- `metadata.json`
- `settings-schema.json`
- `stylesheet.css`

## Current Tooling

The repository now includes a combined validation command:

```bash
./scripts/validate-desklet.sh
```

When the GNOME extension files are present, that validation command also runs the GNOME extension validation checks.

For local Cinnamon testing during development:

```bash
./scripts/install-local-desklet.sh
```

This installs a real local desklet copy into `~/.local/share/cinnamon/desklets/bandwidth-monitor@Ken24T`.

For release packaging:

```bash
./scripts/package-desklet.sh
```

For local GNOME Shell testing during development:

```bash
./scripts/install-gnome-extension.sh
```

This installs a real local extension copy into `~/.local/share/gnome-shell/extensions/bandwidth-monitor-gnome@Ken24T` and compiles the bundled schema.

For a faster local GNOME edit-test loop that reinstalls and reloads the active extension:

```bash
./scripts/reload-gnome-extension.sh
```

To reload and open a fresh preferences window directly:

```bash
./scripts/reload-gnome-extension.sh --prefs
```

For GNOME extension packaging:

```bash
./scripts/package-gnome-extension.sh
```

For GNOME-specific validation only:

```bash
./scripts/validate-gnome-extension.sh
```

## Workflow Notes

This repo uses a local-first, solo-developer TCTBP workflow.

- Pull Requests are not required.
- Shipping and handoff rules live in the `.github/TCTBP*` files.
- Versioning should eventually be driven by `metadata.json` once the desklet scaffold exists.

## Current Branch Focus

The `port/gnome-extenstion` branch now carries a working GNOME Shell extension MVP plus the supporting planning and documentation for the next refinement slices.