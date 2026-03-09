# Copilot Instructions

This repository is a native Cinnamon/GJS desklet project for monitoring network bandwidth.

## Working Context

- Treat the specification in `.github/bandwidth_monitor_desklet_specification.md` as the product source of truth.
- Treat `.github/TCTBP Agent.md` and `.github/TCTBP.json` as the shipping, handoff, and branching workflow source of truth.
- This is a solo-developer repository. Do not assume Pull Requests, review gates, or team branching conventions unless explicitly requested.
- The repository may be local-first for parts of its life cycle. Remote push steps are conditional on a configured remote.

## Implementation Defaults

- Prefer a pure Cinnamon-native implementation using GJS.
- Aim for a small, modular desklet structure centred on `desklet.js`, `metadata.json`, `settings-schema.json`, and `stylesheet.css`.
- Read network counters from `/sys/class/net/<interface>/statistics/` unless there is a concrete Cinnamon-specific constraint that forces a different source.
- Keep the data-collection, rate-calculation, history-buffer, and rendering concerns separated even if the first slice is small.
- Use a soft file-size guideline rather than a hard cap: target `<=300` lines for most focused modules, allow orchestration-heavy files such as `desklet.js` to grow to roughly `400-500` lines if still cohesive, and split based on responsibility rather than raw line count.
- Optimise for correctness and low overhead over cleverness.

## Expected Delivery Style

- Build the project in thin vertical slices rather than large speculative frameworks.
- Keep edits minimal and consistent with the current repo shape.
- Update documentation when introducing structure, workflow, or artifact changes.
- Keep `docs/user-guide.md` current for user-visible behaviour, settings, limitations, and installation guidance as the project evolves.
- When versioned desklet artifacts exist, keep version changes aligned with the TCTBP workflow.

## Workflow Expectations

- If the user asks to ship, hand off, or branch, follow `.github/TCTBP Agent.md` and `.github/TCTBP.json`.
- Do not claim lint, test, or packaging verification happened if those commands are not yet defined.
- For bootstrap-stage work, prefer establishing real commands and files over placeholder automation.
- For implementation work, prefer one branch per phase, merge completed phase branches into local `main`, use short-lived sub-branches only for substantial internal slices, and ask before pushing the merged phase result to the remote.

## Near-Term Project Direction

- First establish the desklet scaffold and metadata.
- Then deliver a minimal live bandwidth display for one interface.
- Then expand to multi-interface support, totals, settings, and sparklines.