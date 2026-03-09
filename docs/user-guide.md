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

What does not exist yet:

- live bandwidth sampling
- interface discovery
- multi-interface display
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
- live RX and TX text output for a single interface
- a validation script for the repository scaffold

Current visible behaviour:

- the desklet can display a header
- the desklet shows live RX and TX text values for one interface
- the preferred interface setting can target a specific interface name
- if the preferred interface is unavailable, the desklet falls back to automatic selection
- aggregate and multi-interface views are not shown yet

## Planned User Workflow

Once the desklet is implemented, the expected user flow will be:

1. Add the desklet to the Cinnamon desktop.
2. Choose an interface or use automatic selection.
3. View live RX and TX activity at a glance.
4. Adjust display and behaviour through desklet settings.

## Known Limitations

Current limitations are expected for this early phase:

- only one interface is monitored at a time
- interface discovery and richer selection rules are still basic
- no production-ready packaging instructions yet
- settings are foundational rather than feature-complete

## Document Maintenance Rule

This file should stay focused on user-visible behaviour.

Implementation details, branching rules, and release workflow belong in the technical and workflow documents instead.