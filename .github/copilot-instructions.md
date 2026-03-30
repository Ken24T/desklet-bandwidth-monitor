# Copilot Instructions

This repository is a native Cinnamon/GJS desklet project for monitoring network bandwidth.

## Working Context

- Treat the specification in `.github/bandwidth_monitor_desklet_specification.md` as the product source of truth.
- Treat `.github/TCTBP Agent.md` and `.github/TCTBP.json` as the workflow source of truth for SHIP, checkpoint, publish, handover, resume, deploy, status, abort, and branching.
- This is a solo-developer repository. Do not assume Pull Requests, review gates, or team branching conventions unless explicitly requested.
- The repository may be local-first for parts of its life cycle, but this repo currently has `origin` configured and should keep local and remote state aligned when workflow triggers are used.

## Repository Structure

| Folder | Purpose |
|--------|---------|
| `desklet.js` | Cinnamon desklet entry point |
| `metadata.json` | Desklet metadata and version source |
| `settings-schema.json` | Cinnamon settings schema |
| `stylesheet.css` | Desklet styling |
| `monitor.js`, `sampler.js`, `interfaces.js`, `formatting.js`, `sparkline.js` | Monitoring and rendering support modules |
| `scripts/` | Validation, packaging, and local installation scripts |
| `docs/` | User-facing and implementation documentation |
| `.github/` | Product specification, Copilot guidance, and TCTBP runtime/workflow files |

## TCTBP Runtime Surface

The desklet repo's TCTBP runtime and workflow surface lives in:

- `.github/agents/TCTBP.agent.md`
- `.github/TCTBP.json`
- `.github/TCTBP Agent.md`
- `.github/TCTBP Cheatsheet.md`
- `.github/copilot-instructions.md`
- `.github/prompts/Install TCTBP Agent Infrastructure Into Another Repository.prompt.md`
- optional hook layer: `.github/hooks/tctbp-safety.json` and `scripts/tctbp-pretool-hook.js`

Keep these files aligned when the workflow or runtime entry points change.

The consolidated cross-repo application prompt is expected to be discoverable through the explicit local-only trigger `reconcile-tctbp <absolute-target-repo-path>`.

## Implementation Defaults

- Prefer a pure Cinnamon-native implementation using GJS.
- Aim for a small, modular desklet structure centred on `desklet.js`, `metadata.json`, `settings-schema.json`, and `stylesheet.css`.
- Read network counters from `/sys/class/net/<interface>/statistics/` unless there is a concrete Cinnamon-specific constraint that forces a different source.
- Keep data collection, rate calculation, history buffering, and rendering concerns separated even when a slice is small.
- Use a soft file-size guideline rather than a hard cap: target about 300 lines for most focused modules, and allow `desklet.js` to grow further only when it remains cohesive.
- Optimise for correctness and low overhead over cleverness.
- For local Cinnamon installation, prefer a real copied desklet deployment into `~/.local/share/cinnamon/desklets/<uuid>` via `./scripts/install-local-desklet.sh`; do not rely on symlink-based installs.

## Development Commands

```bash
python3 -m json.tool metadata.json >/dev/null
python3 -m json.tool settings-schema.json >/dev/null
./scripts/validate-desklet.sh
./scripts/package-desklet.sh
./scripts/install-local-desklet.sh
```

## Expected Delivery Style

- Build the project in thin vertical slices rather than large speculative frameworks.
- Keep edits minimal and consistent with the current repo shape.
- Update documentation when introducing structure, workflow, or artefact changes.
- Keep `docs/user-guide.md` current for user-visible behaviour, settings, limitations, and installation guidance as the project evolves.
- When versioned desklet artefacts exist, keep version changes aligned with the TCTBP workflow.

## Workflow Expectations

- If the user asks to ship, checkpoint, publish, handover, resume, deploy, status, abort, or branch, follow `.github/TCTBP Agent.md` and `.github/TCTBP.json`.
- For this repo, `metadata.json` is the version source and release tags are bare semver tags such as `1.5.0` rather than `v1.5.0`.
- Treat `./scripts/validate-desklet.sh` as the normal verification gate and reserve `./scripts/package-desklet.sh` for explicit packaging or deploy work.
- For implementation work, prefer one branch per phase, merge completed phase branches into `main`, use short-lived sub-branches only for substantial internal slices, and ask before pushing the merged phase result when the workflow requires it.

## Docs Impact Defaults

- Review `README.md`, `docs/user-guide.md`, and `.github/bandwidth_monitor_desklet_specification.md` for user-visible or UI behaviour changes.
- Review `metadata.json`, `settings-schema.json`, `scripts/install-local-desklet.sh`, and `scripts/package-desklet.sh` for packaging, settings, or installation changes.
- Review `docs/implementation-plan.md` when roadmap or implementation-status expectations change.

## Near-Term Project Direction

- Keep release packaging, validation, and user-facing documentation aligned with the live desklet implementation state.
- Continue improving the desklet in coherent vertical slices rather than speculative framework work.