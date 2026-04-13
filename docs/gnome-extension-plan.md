# GNOME Extension Port Plan

This document captures the initial plan for porting the Cinnamon bandwidth monitor desklet to Ubuntu GNOME as a GNOME Shell extension.

The goal is not to force a 1:1 desktop-widget clone. The goal is to preserve the monitoring value of the current project while adapting the UI, settings, packaging, and runtime model to GNOME Shell 50.

## Current Implementation Status

The current `port/gnome-extenstion` branch now includes a first working MVP slice with:

- a GNOME Shell 50 extension scaffold in `gnome-extension/`
- shell-neutral monitoring modules under `gnome-extension/shared/`
- a top-bar indicator with a multi-interface dropdown
- basic GNOME preferences backed by GSettings
- local install, packaging, and validation scripts for the extension

Still intentionally pending after this first implementation slice:

- sparkline charts in GNOME
- per-interface visibility editing in preferences
- richer appearance controls and theme customisation
- deeper parity with the Cinnamon desklet layout system

## Product Direction

Recommended target: a top-bar indicator with a dropdown menu.

Why this target:

- GNOME Shell does not offer a direct equivalent to Cinnamon desklets on the desktop.
- A panel indicator matches GNOME's interaction model better than trying to simulate a desktop widget.
- The current monitor content already maps well to a compact summary plus an expanded per-interface view.
- It keeps the first port small enough to ship without rebuilding the whole project as a standalone application.

Explicitly not the first target:

- a desktop widget clone
- a separate background daemon
- a standalone GTK or Libadwaita app

Those can be reconsidered later if the extension proves too constrained.

## Architecture Goal

Split the project into two layers:

1. Shared monitoring core
2. Shell-specific presentation layer

Shared monitoring core responsibilities:

- enumerate interfaces from `/sys/class/net`
- classify interfaces and pick a primary interface
- read RX and TX counters
- calculate rates, totals, and rolling history
- format user-facing values and status messages

GNOME extension layer responsibilities:

- panel button and dropdown rendering
- GNOME Shell timer lifecycle and cleanup
- GSettings-backed preferences
- preferences UI for GNOME
- extension packaging and install workflow

## Reuse Strategy

The following existing files contain logic that should be reused or adapted rather than rewritten from scratch:

- `interfaces.js`
- `monitor.js`
- `sampler.js`
- `formatting.js`
- parts of `sparkline.js`

The following files are Cinnamon-specific and should not be ported directly:

- `desklet.js`
- `settings-schema.json`
- `DeskletInfoWidget.py`
- `InterfaceVisibilityWidget.py`
- `stylesheet.css` as-is

## Phase Plan

## Phase G1: Shared-Core Extraction

Purpose: separate monitoring logic from Cinnamon shell code so the GNOME extension does not inherit desklet-specific assumptions.

Scope:

- identify which code in the current root-level modules is shell-neutral
- move or duplicate shared logic into a GNOME-friendly module area
- remove Cinnamon-only imports from the shared path
- define a stable data shape for sampled interface rows and aggregate totals

Done criteria:

- shared logic can be loaded without Cinnamon desklet APIs
- interface sampling and rate calculation still behave the same
- the port branch has a clear separation between core and shell layers

## Phase G2: GNOME Extension Scaffold

Purpose: establish a minimal GNOME Shell 50 extension that loads cleanly.

Scope:

- add extension metadata
- add the main extension entrypoint
- add a minimal panel indicator
- add install and packaging helpers for local GNOME extension testing

Done criteria:

- the extension can be installed locally
- GNOME Shell can load and enable it
- enabling and disabling the extension does not leak timers or actors

## Phase G3: Monitoring MVP

Purpose: display real live bandwidth data in GNOME with the smallest useful feature set.

Scope:

- show live RX and TX values in the panel label or indicator summary
- show a dropdown with the current primary interface
- include automatic interface selection
- include safe empty and unavailable states

Done criteria:

- live data updates on GNOME Shell
- unplugged or missing interfaces do not break the extension
- the first-run experience is understandable without opening preferences

## Phase G4: Multi-Interface Dropdown

Purpose: bring over the multi-row monitoring model in a GNOME-appropriate form.

Scope:

- one dropdown section per visible interface
- combined traffic row when enabled
- session totals per row
- primary-interface emphasis

Done criteria:

- multiple monitored interfaces render reliably
- aggregate totals are consistent with visible rows
- the dropdown remains readable on narrow displays

## Phase G5: Preferences and State

Purpose: rebuild the current user controls using GNOME-native settings infrastructure.

Scope:

- GSettings schema
- preferences window or panel for GNOME Shell 50
- selection mode, preferred interface, visible rows, unit mode, refresh cadence, and basic appearance options
- migration or reset strategy for settings that do not map cleanly from Cinnamon

Done criteria:

- core settings persist correctly through GNOME preferences
- invalid or stale saved state does not break startup
- unsupported Cinnamon-specific settings are either dropped or intentionally redefined

## Phase G6: Visual Refinement

Purpose: restore some of the richer desklet experience without overfitting to GNOME Shell internals.

Scope:

- improved panel summary formatting
- dropdown row styling
- optional miniature charts only if they are performant and visually stable in GNOME Shell
- restrained theming options that align with GNOME styling constraints

Done criteria:

- the extension feels intentionally designed for GNOME rather than like a desklet transplant
- redraw cost stays reasonable
- visual density remains usable across common desktop widths

## Phase G7: Packaging and Documentation

Purpose: make the GNOME port maintainable and testable as a first-class branch deliverable.

Scope:

- extension packaging script
- local install and reload script
- README updates for dual Cinnamon and GNOME direction
- GNOME-specific user or developer documentation

Done criteria:

- local GNOME install workflow is documented and repeatable
- packaging produces a usable GNOME extension artifact
- repo docs clearly distinguish Cinnamon and GNOME tracks

## MVP Feature Cut

The first GNOME milestone should keep only the features needed to prove the port direction:

- live RX and TX monitoring
- automatic primary-interface selection
- dropdown display for one or more interfaces
- configurable refresh interval
- basic preferences
- safe empty and unavailable states

Features that should wait until after the MVP:

- full theme parity with Cinnamon
- custom colour palettes
- complex per-interface management widgets
- advanced sparkline styling
- every current layout-density variant

## Proposed Repo Shape For The Port

One reasonable direction for this branch is:

```text
docs/
  gnome-extension-plan.md
gnome-extension/
  metadata.json
  extension.js
  prefs.js
  stylesheet.css
  schemas/
shared/
  formatting.js
  interfaces.js
  monitor.js
  sampler.js
scripts/
  install-gnome-extension.sh
  package-gnome-extension.sh
```

This does not have to be the final layout, but the important constraint is clear separation between shared monitoring logic and shell-specific runtime code.

## Open Decisions

These decisions should be locked before major implementation starts:

1. Whether the panel summary shows both RX and TX continuously or uses a simpler compact state.
2. Whether the first GNOME prefs UI is a full preferences window or a minimal schema-first implementation.
3. Whether sparkline support belongs in the first shipped GNOME release or a later refinement phase.
4. Whether the repo should remain a dual-target codebase or eventually split Cinnamon and GNOME into separate deliverables.

## Recommended Next Step

Start with Phase G1 and Phase G2 only.

That means the next work session should focus on extracting or duplicating the reusable monitoring core, scaffolding a minimal GNOME Shell extension, and proving that the extension can load cleanly on GNOME Shell 50 before attempting feature parity.