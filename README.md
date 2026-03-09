# Desklet Bandwidth Monitor

A native Cinnamon desklet for displaying live network bandwidth activity with a lightweight, desktop-first UI.

## Current Status

This repository is in bootstrap stage. The current committed assets are planning and workflow documents that define:

- the product specification
- the implementation direction
- the release and handoff workflow

## Key Documents

- Product specification: `.github/bandwidth_monitor_desklet_specification.md`
- Copilot workspace instructions: `.github/copilot-instructions.md`
- TCTBP workflow policy: `.github/TCTBP Agent.md`
- TCTBP workflow configuration: `.github/TCTBP.json`
- Implementation plan: `docs/implementation-plan.md`
- User guide: `docs/user-guide.md`

## Intended Initial Project Shape

The desklet is expected to start with a small native Cinnamon/GJS structure built around:

- `desklet.js`
- `metadata.json`
- `settings-schema.json`
- `stylesheet.css`

## Current Scaffold

The repository now includes the Phase 0 desklet scaffold with those root-level files and a minimal validation command:

```bash
./scripts/validate-desklet.sh
```

For local Cinnamon testing during development:

```bash
./scripts/install-local-desklet.sh
```

## Workflow Notes

This repo uses a local-first, solo-developer TCTBP workflow.

- Pull Requests are not required.
- Shipping and handoff rules live in the `.github/TCTBP*` files.
- Versioning should eventually be driven by `metadata.json` once the desklet scaffold exists.

## Next Step

The current branch focus is Phase 2: add live single-interface bandwidth sampling and text display, then move on to interface discovery and smarter selection.