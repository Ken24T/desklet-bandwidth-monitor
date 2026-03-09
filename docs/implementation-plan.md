# Implementation Plan

This plan turns the desklet specification into small, buildable slices. The goal is to keep each slice demonstrable, reversible, and useful on its own.

These slices are planning and delivery units, not automatic release units. Under the TCTBP workflow, shipping should normally happen at completed milestone boundaries, which may contain one slice or several closely related slices.

## Delivery Strategy

- Build in vertical slices, not broad framework-first batches.
- Prefer a working desklet with fewer features over partially wired systems.
- Keep the internal design modular so later slices can extend it without a rewrite.
- Treat performance, redraw efficiency, and correctness as first-class constraints from the start.
- Use one main implementation branch per phase by default.
- If a phase contains substantial internal work, use a short-lived sub-branch and merge it back into the phase branch before merging the completed phase to local `main`.
- After each successful phase merge to local `main`, decide explicitly whether to also push that state to the remote.

## Phase 0: Repository Bootstrap

Suggested branch: `phase-0-bootstrap`

Purpose: establish the minimum repo structure needed to start real implementation.

Steps:

1. Add the initial desklet scaffold files: `desklet.js`, `metadata.json`, `settings-schema.json`, `stylesheet.css`.
2. Decide the desklet UUID, display name, and baseline metadata fields.
3. Choose the initial validation approach for GJS and JSON files.
4. Replace bootstrap placeholders in `.github/TCTBP.json` with real repo commands once they exist.

Done criteria:

- The repository contains the canonical desklet file set.
- Version source is explicitly defined in `metadata.json`.
- The TCTBP workflow can point to concrete files instead of placeholders.

## Phase 1: Static Desklet Shell

Suggested branch: `phase-1-static-shell`

Purpose: prove the desklet loads in Cinnamon and renders a stable UI shell.

Scope:

- Desklet lifecycle wiring in `desklet.js`
- Basic container and text layout
- Styling hooks in `stylesheet.css`
- Settings load path wired, even if the initial schema is minimal

Slice outcome:

- The desklet appears on the desktop without live bandwidth data yet.

Done criteria:

- Desklet loads cleanly.
- Removal cleans up resources.
- UI remains stable across reloads.

## Phase 2: Single-Interface Live Text Display

Suggested branch: `phase-2-single-interface-live-text`

Purpose: deliver the first genuinely useful feature with minimal complexity.

Scope:

- Read RX and TX counters from `/sys/class/net/<interface>/statistics/`
- Store previous sample values and timestamps
- Calculate live rates from byte deltas over time
- Render upload and download values for one selected interface

Recommended constraints:

- Default sampling interval: 1 second
- No chart rendering yet
- No smoothing yet unless it is trivial and clearly correct

Slice outcome:

- The desklet shows live RX and TX values for one interface.

Done criteria:

- Rates update continuously.
- Counter resets or missing interfaces do not crash the desklet.
- Output units are human-readable.

## Phase 3: Interface Discovery and Selection

Suggested branch: `phase-3-interface-discovery-selection`

Purpose: move from a hard-coded proof of concept to a usable network monitor.

Scope:

- Enumerate interfaces from `/sys/class/net`
- Classify interface types where practical
- Ignore loopback and noisy virtual interfaces by default
- Allow selecting a target interface or auto-detecting a sensible default

Slice outcome:

- The desklet supports real interface selection rather than a fixed interface name.

Done criteria:

- Interface list populates reliably.
- Disappearing or returning interfaces are handled safely.
- User-visible labels are clear.

## Phase 4: Multi-Interface Rows and Session Totals

Suggested branch: `phase-4-multi-interface-totals`

Purpose: establish the core row-based model described in the specification.

Scope:

- Repeatable interface rows
- Per-interface visibility controls
- Session RX and TX totals using a baseline-reset model
- Optional aggregate "Group All Interfaces" row

Slice outcome:

- The desklet can show multiple interfaces and totals in a predictable layout.

Done criteria:

- Multiple visible rows render correctly.
- Totals remain correct within the current session.
- Aggregate totals match the included interfaces.

## Phase 5: Settings Expansion

Suggested branch: `phase-5-settings-expansion`

Purpose: expose the functionality needed for the desklet to feel like a real desktop widget.

Scope:

- Refresh interval
- Unit behaviour and optional auto-scaling
- Label visibility
- Font size, spacing, scale, and alignment
- Per-interface visibility, colours, nicknames, RX/TX visibility, and ordering
- Aggregate display toggles

Slice outcome:

- The desklet becomes configurable enough for daily use.

Done criteria:

- Settings map cleanly to runtime behaviour.
- Settings changes update the desklet without requiring restart where practical.
- Defaults remain sensible for first-time users.

## Phase 6: Sparkline Charts and Smoothing

Suggested branch: `phase-6-sparklines-smoothing`

Purpose: add the richer visual layer without undermining performance.

Scope:

- Bounded rolling history buffers
- Native Cinnamon/GJS sparkline rendering
- RX solid line, TX dotted line
- Optional smoothing
- Text-only fallback mode

Slice outcome:

- Each visible interface row can render live charts with bounded overhead.

Done criteria:

- History size remains bounded.
- Redraw behaviour stays smooth and efficient.
- Charts remain legible across different desklet sizes.

## Phase 7: Reliability and Edge Cases

Suggested branch: `phase-7-reliability-edge-cases`

Purpose: harden the desklet against the conditions that make monitors feel untrustworthy.

Scope:

- Interface disappearance and reappearance
- Counter wrap or reset handling
- Spike suppression where sensible
- Timer cleanup and reload correctness
- Graceful behaviour with low or zero traffic

Slice outcome:

- The desklet behaves predictably in common failure and idle scenarios.

Done criteria:

- No obvious false spikes on reattach or reset.
- No leaked timers after removal or reload.
- State transitions favour correctness over visual continuity.

## Phase 8: Packaging and Release Readiness

Suggested branch: `phase-8-packaging-release-readiness`

Purpose: make the project ship-ready and easier to maintain.

Scope:

- Finalise metadata fields and version handling
- Confirm packaging expectations for distribution
- Add any missing validation commands to the repo workflow
- Align README, TCTBP docs, and implementation state

Slice outcome:

- The repo can be shipped using the defined TCTBP workflow with real commands and real artifacts.

Done criteria:

- Versioning is authoritative and documented.
- Release workflow reflects actual repository commands.
- Core documentation matches the implementation.

## Immediate Next Branches

The recommended near-term branch sequence is:

1. `phase-0-bootstrap`
2. `phase-1-static-shell`
3. `phase-2-single-interface-live-text`

Recommended working model:

- complete the current phase branch
- merge it into local `main`
- create the next phase branch from updated local `main`
- ask whether to also push the newly merged `main` state to the remote

This keeps the branch history aligned with the implementation phases while still allowing substantial internal slices to use short-lived sub-branches when needed.