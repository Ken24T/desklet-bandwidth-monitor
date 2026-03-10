# User Guide

This guide is the user-facing reference for the Bandwidth Monitor desklet.

It should be updated whenever user-visible behaviour, settings, installation steps, or limitations change.

## Status

The project is currently in early implementation.

What exists today:

- Phase 0 scaffold files for a Cinnamon desklet
- baseline metadata and settings schema
- a static desklet shell with row-based placeholder layout
- live single-interface RX and TX text monitoring
- basic interface discovery and auto-selection rules
- repeatable interface rows with session totals and aggregate totals
- expanded display settings for labels, totals, alignment, scaling, and unit mode
- sparkline charts with configurable history length and smoothing mode
- more defensive handling for disappearing interfaces, counter resets, and suspicious spikes
- package creation for release artifacts
- a working desklet settings panel for sampling, per-interface row controls, layout, and sparkline options

What does not exist yet:

- richer settings controls such as per-interface nicknames, colours, and ordering tools

## Intended Purpose

The desklet is intended to show current network bandwidth activity directly on the Cinnamon desktop in a compact, readable form.

Planned user-facing goals include:

- current download and upload rates
- sensible automatic unit formatting
- per-interface visibility
- optional aggregate totals
- configurable appearance and layout
- optional sparkline charts

## Installation

The project now includes a package script for release artifacts:

```bash
./scripts/package-desklet.sh
```

This produces a zip archive in `dist/` containing the desklet files under the correct UUID folder.

For local development on Cinnamon, the repository includes a helper script:

```bash
./scripts/install-local-desklet.sh
```

This creates or updates a real desklet copy in `~/.local/share/cinnamon/desklets/bandwidth-monitor@Ken24T` using the current repository files.

For packaged installation, extract the packaged UUID directory into `~/.local/share/cinnamon/desklets/` and then add or reload the desklet in Cinnamon.

## Current Behaviour

At the current stage, the desklet provides a working live monitor with a basic but functional settings experience.

The current implementation establishes:

- desklet metadata
- settings binding structure
- a stable row-based content shell
- live RX and TX text output for visible interfaces
- a validation script for the repository scaffold

Current visible behaviour:

- the desklet can display a header
- the desklet exposes a Cinnamon settings panel for sampling, interface selection, and layout options
- the settings panel is grouped into functional sections for general behaviour, interfaces, layout, and charts
- the Interfaces section provides one row per known interface with its own show toggle and Reset totals button
- loopback interfaces are hidden from the Interfaces section by default and can be exposed with a dedicated include option when needed
- individual interface rows can be hidden while Group All continues to show the combined traffic for the monitored interfaces
- the desklet shows live RX and TX text values for one interface
- the desklet discovers available interfaces and shows them in the desklet
- interface selection mode can be automatic or preferred-interface based
- if the preferred interface is unavailable, the desklet falls back to automatic selection
- VPN and tunnel interfaces are shown by default, and the settings panel controls whether they can become the primary auto-selected interface
- multiple interface rows can be shown together or hidden individually
- per-session RX and TX totals are shown for each visible row
- an aggregate Group All Interfaces row can be shown for the monitored interfaces, even when some individual rows are hidden
- rate units can be shown as bytes per second or bits per second
- labels, totals, alignment, spacing, and font scale can be adjusted from settings
- sparkline charts can be shown or hidden
- sparkline charts use a fixed taller height with steadier scaling for easier at-a-glance comparison during bursts
- history length and smoothing behaviour can be adjusted
- the desklet waits for a stable sample after counter resets or interface return
- obviously implausible spike samples are suppressed when recent history makes them suspect
- the layout focuses on the interface rows without extra summary text above or below the monitor cards

## Planned User Workflow

Once the desklet is implemented, the expected user flow will be:

1. Add the desklet to the Cinnamon desktop.
2. Choose an interface or use automatic selection.
3. View live RX and TX activity at a glance.
4. Adjust display and behaviour through desklet settings.

## Known Limitations

Current limitations are expected for this early phase:

- interface ordering is still basic
- per-interface nicknames, colours, and richer layout controls are not implemented yet
- chart styling is still simple rather than fully themeable

## Document Maintenance Rule

This file should stay focused on user-visible behaviour.

Implementation details, branching rules, and release workflow belong in the technical and workflow documents instead.