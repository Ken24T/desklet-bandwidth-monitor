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

What does not exist yet:

- sparklines
- full settings experience

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

Installation and packaging steps are not final yet.

This section will be expanded once the desklet reaches a usable release state and the packaging workflow is defined.

For local development on Cinnamon, the repository includes a helper script:

```bash
./scripts/install-local-desklet.sh
```

This creates or updates a symlink in `~/.local/share/cinnamon/desklets/` so the current repository can be loaded as a local desklet during development.

## Current Behaviour

At the current stage, the desklet provides a static shell intended for development validation rather than end-user use.

The current implementation establishes:

- desklet metadata
- settings binding structure
- a stable row-based content shell
- live RX and TX text output for visible interfaces
- a validation script for the repository scaffold

Current visible behaviour:

- the desklet can display a header
- the desklet shows live RX and TX text values for one interface
- the desklet discovers available interfaces and shows them in the desklet
- interface selection mode can be automatic or preferred-interface based
- if the preferred interface is unavailable, the desklet falls back to automatic selection
- tunnel interfaces can be excluded from or included in automatic selection
- multiple interface rows can be shown together
- per-session RX and TX totals are shown for each visible row
- an aggregate Group All Interfaces row can be shown for the visible set
- rate units can be shown as bytes per second or bits per second
- labels, totals, alignment, spacing, and font scale can be adjusted from settings
- the discovered interface inventory can be shown or hidden
- sparkline charts can be shown or hidden
- history length and smoothing behaviour can be adjusted
- the desklet waits for a stable sample after counter resets or interface return
- obviously implausible spike samples are suppressed when recent history makes them suspect

## Planned User Workflow

Once the desklet is implemented, the expected user flow will be:

1. Add the desklet to the Cinnamon desktop.
2. Choose an interface or use automatic selection.
3. View live RX and TX activity at a glance.
4. Adjust display and behaviour through desklet settings.

## Known Limitations

Current limitations are expected for this early phase:

- visibility uses a simple comma-separated interface list rather than a richer settings UI
- interface ordering is still basic
- per-interface nicknames, colours, and richer layout controls are not implemented yet
- chart styling is still simple rather than fully themeable
- no production-ready packaging instructions yet

## Document Maintenance Rule

This file should stay focused on user-visible behaviour.

Implementation details, branching rules, and release workflow belong in the technical and workflow documents instead.