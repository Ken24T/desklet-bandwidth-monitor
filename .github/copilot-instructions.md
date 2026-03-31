# Copilot Instructions

This repository is a native Cinnamon/GJS desklet project for monitoring network bandwidth.

## Working Context

- Treat the specification in `.github/bandwidth_monitor_desklet_specification.md` as the product source of truth.
- Treat `.github/TCTBP Agent.md` and `.github/TCTBP.json` as the shipping, handover, resume, and branching workflow source of truth.
- This is a solo-developer repository. Do not assume Pull Requests, review gates, or team branching conventions unless explicitly requested.
- Remote push steps are conditional on a configured remote, but this repository should now be treated as a standard tracked git repository rather than relying on the older `handoff`-only flow.

## TCTBP Runtime Surface

The desklet repository's TCTBP runtime and workflow surface lives in:

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
- Keep the data-collection, rate-calculation, history-buffer, and rendering concerns separated even if the first slice is small.
- Use a soft file-size guideline rather than a hard cap: target `<=300` lines for most focused modules, allow orchestration-heavy files such as `desklet.js` to grow to roughly `400-500` lines if still cohesive, and split based on responsibility rather than raw line count.
- Optimise for correctness and low overhead over cleverness.
- For local Cinnamon installation, prefer a real copied desklet deployment into `~/.local/share/cinnamon/desklets/<uuid>` via `./scripts/install-local-desklet.sh`; do not rely on symlink-based installs.

## Development Commands

```bash
python3 -m json.tool metadata.json >/dev/null && python3 -m json.tool settings-schema.json >/dev/null
./scripts/validate-desklet.sh
./scripts/package-desklet.sh
./scripts/install-local-desklet.sh
```

## Expected Delivery Style

- Build the project in thin vertical slices rather than large speculative frameworks.
- Keep edits minimal and consistent with the current repo shape.
- Update documentation when introducing structure, workflow, or artifact changes.
- Keep `docs/user-guide.md` current for user-visible behaviour, settings, limitations, and installation guidance as the project evolves.
- When versioned desklet artifacts exist, keep version changes in `metadata.json` aligned with the TCTBP workflow and plain numeric tags.

## Workflow Expectations

- If the user asks to ship, publish, checkpoint, handover, resume, deploy, status, abort, or branch, follow `.github/TCTBP Agent.md` and `.github/TCTBP.json`.
- Do not claim lint, test, packaging, or install verification happened if those commands were not run successfully.
- Prefer phase-oriented implementation branches for larger desklet milestones and `infrastructure/` branches for tooling or workflow changes.

## Near-Term Project Direction

- Continue release-readiness work for the desklet package, documentation, and install flow.
- Keep the package archive, Cinnamon local install, settings panel, and user guide aligned with the implementation state.