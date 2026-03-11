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

## Future Slice: Adaptive Refresh Sampling

Suggested branch: `phase-x-adaptive-refresh-sampling`

Purpose: add an optional adaptive sampling mode that preserves the existing fixed refresh model while allowing the desklet to respond faster during sustained traffic.

Principles:

- Keep the current fixed refresh interval as the default and as the simplest behaviour.
- Treat adaptive refresh as an optional mode layered on top of the existing sampling timer, not as a replacement for the current model.
- Prefer a small number of clearly explained controls over a fully programmable threshold matrix.
- Avoid timer thrash by using smoothed activity signals, hysteresis, and cooldown periods.
- Keep CPU wakeups low during idle periods and favour responsiveness only when the traffic level justifies it.

Why this slice fits the current implementation:

- Sampling cadence is currently selected in one place in `desklet.js`, which makes interval selection a contained change.
- Rate calculation already uses elapsed time, so changing the interval does not invalidate the basic RX/TX math.
- Text refresh is already steadier than the sampling cadence, which reduces visible jitter when faster sampling is active.
- The main architectural caveat is that sparkline history is sample-count based, so adaptive sampling changes the real-world time span shown by the chart unless the history model is normalised to time.

Recommended scope for the first implementation:

- Add a new sampling mode setting with `Fixed` and `Adaptive` options.
- Keep the existing `sample-seconds` value as the fixed interval and as the adaptive mode's normal or idle interval.
- Add a new minimum or fastest adaptive interval setting.
- Add one user-facing responsiveness control, preferably expressed as a simple preset or threshold.
- Add one user-facing cooldown control that determines how long traffic must remain calm before the desklet returns to the slower interval.
- Keep the adaptive decision based on total visible traffic volume rather than per-interface micromanagement.
- Reschedule the sampling timer only when the effective interval band actually changes.

Explicitly out of scope for the first implementation:

- Per-interface adaptive polling policies.
- Separate adaptive controls for RX and TX.
- A continuously variable interval that changes every sample.
- Time-normalised sparkline history.
- Separate adaptive redraw logic beyond the existing text refresh behaviour.

Suggested settings model:

1. Sampling mode

- `Fixed`
- `Adaptive`

2. Base refresh rate

- Reuse the existing `sample-seconds` setting.
- In adaptive mode, this becomes the normal or idle interval.
- Default: `1.0s`

3. Fastest refresh rate

- New setting: `adaptive-fast-sample-seconds`.
- Clamp to the same lower bound already considered safe for the desklet.
- Default: `0.5s`
- Range: `0.25s` to `5.0s`

4. Responsiveness or traffic trigger

- Use the `adaptive-response-profile` setting with `Conservative`, `Balanced`, and `Responsive` presets.
- Each preset maps to internal traffic thresholds and hold timings.
- This keeps the UX understandable while still allowing tuning.
- Default: `Balanced`

5. Cooldown

- New setting: `adaptive-cooldown-seconds`.
- Determines how long recent traffic must stay below the downshift threshold before returning to the slower band.
- Default: `8s`
- Range: `2s` to `60s`

Recommended runtime model:

1. Compute an activity score from the most recent aggregate throughput.

- Use the dominant direction from the current snapshot, based on `max(total RX, total TX)`.
- Base it on smoothed recent traffic, not a single raw sample.
- If aggregate mode is hidden, still use the total of visible monitored rows rather than only the primary interface so the desklet responds to the traffic it is actually showing.

2. Map the activity score into a small number of cadence bands.

- `Idle`: use base interval.
- `Active`: optional middle band if needed.
- `Busy`: use fastest interval.

The first implementation can reasonably skip the middle band and use only `Idle` and `Busy` if that keeps the behaviour easier to verify.

3. Apply hysteresis.

- Use a higher threshold for moving into a faster band than for dropping back down.
- This avoids rapid up/down switching around a single trigger point.

4. Apply cooldown.

- After traffic drops below the lower threshold, wait for the configured cooldown window before slowing the timer.
- Allow upward shifts to happen immediately or after a very short confirmation window.

5. Reschedule only on band transitions.

- Do not remove and recreate the timer every sample.
- Rebuild the timeout only when the effective interval changes.

Suggested internal changes:

### `settings-schema.json`

- Add a sampling mode control alongside the existing refresh rate.
- Add adaptive-only settings for fastest rate, responsiveness, and cooldown.
- Keep labels user-facing and desktop-oriented, not network-engineering jargon.
- Concrete keys for the first slice:
	- `sampling-mode` with values `fixed` and `adaptive`, default `fixed`
	- `sample-seconds`, default `1.0`
	- `adaptive-fast-sample-seconds`, default `0.5`
	- `adaptive-response-profile`, default `balanced`
	- `adaptive-cooldown-seconds`, default `8`

### `desklet.js`

- Introduce a small adaptive sampling state object, for example:
	- current effective interval
	- current adaptive band
	- recent traffic signal
	- last upward shift time
	- last below-threshold time
- Split the existing interval logic so one helper returns the fixed interval and another returns the current effective interval.
- After each sample, evaluate whether the cadence band should change.
- If the band changes, restart the timer with the new interval.
- Keep the current fixed text refresh behaviour unless testing shows a reason to change it.

### Monitoring or snapshot layer

- Prefer to derive the adaptive traffic signal from the existing snapshot data already produced for rows and aggregate totals.
- Avoid creating a second sampling path or a second counter reader.
- If a helper is needed, add a small utility function near the snapshot handling path rather than pushing adaptive policy into the low-level counter reader.

Suggested first-pass algorithm:

1. Start at the base interval.
2. On each sample, compute `activityRate = max(totalRxRate, totalTxRate)` from the aggregate or summed visible rows.
3. Smooth that value using a short rolling average or a simple exponential smoother.
4. Compare the smoothed activity against preset thresholds.
5. If the activity exceeds the upper threshold for a short sustained run of samples, switch to the fast interval.
6. If the activity falls below the lower threshold, begin or continue a cooldown timer.
7. Once the cooldown expires with traffic still calm, return to the base interval.
8. If traffic collapses well below the downshift threshold, allow a shorter cooldown so the desklet can settle back to the base cadence sooner after a clearly finished burst.

Cooldown refinement:

- When traffic drops far below the lower threshold, allow a shortened cooldown so downshifts feel less sticky after a large transfer stops abruptly.
- In the current branch prototype, that shortened cooldown is capped at approximately `2s`.

Recommended threshold strategy:

- Do not start with absolute thresholds exposed directly in bytes per second unless there is clear demand.
- Internally define preset threshold tables for `Conservative`, `Balanced`, and `Responsive`.
- Calibrate thresholds against realistic desktop cases such as idle sync traffic, browsing, streaming, and large file transfers.
- First-slice preset table:
	- `Conservative`: smoothing `0.32`, activation `3 samples`, upshift `2097152 B/s`, downshift `786432 B/s`
	- `Balanced`: smoothing `0.42`, activation `2 samples`, upshift `1048576 B/s`, downshift `393216 B/s`
	- `Responsive`: smoothing `0.55`, activation `2 samples`, upshift `393216 B/s`, downshift `131072 B/s`

Sparkline and history caveat:

- The current history buffer is sample-count based, so adaptive sampling shortens the visible time window when traffic is busy and lengthens it when traffic is quiet.
- This is acceptable for a first version if documented as a known limitation.
- If this proves visually confusing, a later slice can move charts toward a time-normalised history model.

Validation plan:

1. Functional validation

- Fixed mode behaves exactly as it does today.
- Adaptive mode remains at the base interval during idle traffic.
- Adaptive mode shifts to the fast interval during sustained traffic.
- Adaptive mode returns to the base interval only after the cooldown window.
- Timer cleanup remains correct during desklet reload and removal.

2. Behaviour validation

- No visible interval thrash during borderline traffic.
- Text remains readable and calm because the one-second text cache is still respected.
- Charts remain bounded and do not cause runaway redraw behaviour.

3. Edge-case validation

- Interface disappearance resets adaptive state safely.
- Counter resets do not incorrectly trigger a faster interval.
- Very short bursts do not permanently pin the desklet to the fast cadence.

Suggested delivery order:

1. Add settings and fixed-versus-adaptive plumbing with no behaviour change while adaptive mode is disabled.
2. Implement a basic two-band adaptive model using internal thresholds.
3. Add cooldown and hysteresis.
4. Validate against idle, bursty, and sustained transfer cases.
5. Update `docs/user-guide.md` with clear wording about what adaptive refresh does and how it affects chart time span.

Done criteria:

- Fixed mode preserves current behaviour.
- Adaptive mode is optional, understandable, and stable.
- Adaptive interval changes are band-based rather than per-sample thrash.
- CPU wakeups remain lower at idle than running permanently at the fastest interval.
- User documentation explains the tradeoff that chart history spans may vary when adaptive mode is enabled.

## Phase 13: Theme Modes and Colouring

Suggested branch: `phase-13-theme-colouring`

Purpose: add user-facing theme controls without destabilising the now-settled monitoring and layout model.

Scope:

- Theme mode selection with opinionated presets first
- Light and dark preset palettes that remain readable against a wide range of wallpapers
- A custom theme mode that exposes a restrained set of colour controls
- Runtime application of theme settings to the desklet shell, rows, text, and charts
- Documentation updates for the new theme behaviours and limits

Recommended constraints:

- Do not start with full "theme everything" flexibility
- Prefer a small set of high-value colours over dozens of low-signal controls
- Keep contrast and readability ahead of novelty
- Preserve the current compact, glanceable layout while adding theme flexibility

Suggested vertical slices:

1. Theme foundation

- Add theme mode setting: `Dark`, `Light`, `Custom`
- Centralise runtime colour/style resolution so the desklet can swap palettes coherently
- Keep existing appearance as the default dark preset baseline

2. Curated light and dark presets

- Ship one deliberate dark preset and one deliberate light preset
- Verify row contrast, metric readability, and sparkline visibility in both modes
- Ensure totals, labels, and chart backgrounds remain legible without manual tweaking

3. Custom colour controls

- Expose a restrained initial set of colour pickers:
  desklet background, row background, primary text, secondary text, RX accent, TX accent
- Reveal these controls only when `Custom` theme mode is selected
- Keep alpha/transparency support limited to settings that materially improve wallpaper integration

4. Theme polish and safety

- Add validation of readable defaults and safe fallbacks when colours are extreme
- Review light-mode spacing, borders, and muted text treatment
- Keep docs and screenshots aligned with the actual theme model

Slice outcome:

- Users can choose a clean light or dark preset quickly, or opt into a constrained custom theme mode for personalisation.

Done criteria:

- Theme mode changes apply cleanly at runtime.
- Light and dark presets both feel intentional rather than inverted afterthoughts.
- Custom colour controls remain understandable and do not overwhelm the settings panel.
- Charts, totals, labels, and row backgrounds stay legible across supported theme modes.

## Theme Branching Workflow

Current local state after `0.5.0`:

- local `main` contains the shipped `0.5.0` desklet
- the workspace is currently on `phase-13-follow-up`

Recommended branch handling before implementation starts:

1. Treat `phase-13-follow-up` as a placeholder only.
2. Start the actual theme work on a theme-specific branch: `phase-13-theme-colouring`.
3. Create that branch from updated local `main`, not from stale exploratory work.

Recommended internal branch sequence for the theme phase:

1. `phase-13-theme-colouring`
	Use this as the parent phase branch and integration branch for the whole theming milestone.

2. Optional sub-branch: `phase-13-theme-foundation`
	Use this if palette resolution or runtime styling extraction becomes substantial enough to merit isolation.

3. Optional sub-branch: `phase-13-theme-presets`
	Use this for the curated `Dark` and `Light` mode work once the foundation is stable.

4. Optional sub-branch: `phase-13-theme-custom-colours`
	Use this for the custom colour pickers and visibility/dependency logic in the settings panel.

5. Optional sub-branch: `phase-13-theme-polish`
	Use this for contrast review, readability corrections, and final documentation updates.

Recommended workflow:

- create `phase-13-theme-colouring` from local `main`
- use short-lived sub-branches only if a slice becomes large enough to justify isolation
- merge any sub-branch back into `phase-13-theme-colouring` first
- validate the completed phase branch against the real repo commands
- SHIP the completed phase branch
- merge the shipped phase branch into local `main`
- create the next branch only after the local merge completes
- ask explicitly before pushing `main` and tags to the remote

## Immediate Next Branches

The recommended next branch sequence from the current shipped state is:

1. retire or ignore the placeholder `phase-13-follow-up` branch
2. create `phase-13-theme-colouring` from local `main`
3. optionally use the theme sub-branches above if the work becomes substantial

Recommended working model:

- complete the current phase branch
- merge it into local `main`
- create the next phase branch from updated local `main`
- ask whether to also push the newly merged `main` state to the remote

This keeps the branch history aligned with the implementation phases while still allowing substantial internal slices to use short-lived sub-branches when needed.

## Phase 18: UX Polish Programme

Suggested branch: `phase-18-ux-suggestions`

Purpose: improve the desklet's day-to-day feel through deliberate user-experience refinements rather than broad new functionality.

Delivery rule for this phase:

- Keep all UX slices on the same phase branch.
- SHIP each completed slice locally as an incremental milestone on the branch.
- Decide on merge and remote push only after the overall UX programme reaches a satisfactory stopping point.

Planned UX slices:

1. Styled hover details card

- Replace the plain hover tooltip with a richer anchored popout card.
- Preserve the current informational content while making the interaction feel intentional.

2. Display density modes

- Add `Compact`, `Comfortable`, and `Detailed` density presets.
- Let density modes coordinate spacing, labels, totals, and sparkline emphasis more cleanly than manual tuning alone.

3. First-run defaults and onboarding polish

- Review default settings for theme, visible rows, sparkline visibility, and sampling cadence.
- Soften warm-up and startup states so first use feels calm rather than technical.

4. Primary interface emphasis

- Add a subtle but consistent visual treatment for the currently selected primary interface.
- Keep the emphasis informative rather than noisy.

5. Aggregate row emphasis controls

- Make the `Group All` row feel more intentionally optional.
- Allow the aggregate to be visually toned down or promoted depending on user preference.

6. Deliberate chartless presentation

- Improve the sparkline-off layout so it looks designed rather than merely reduced.
- Ensure the desklet remains compact and attractive without charts.

7. Empty and edge-state copy polish

- Rewrite technical or abrupt status wording into shorter user-facing messages.
- Keep reliability messaging useful without cluttering the main interface.

8. Quick restore actions

- Add fast recovery actions for layout and appearance experimentation.
- Extend the current "safe reset" concept beyond theme colours where it helps.

9. Single focus interface mode

- Add a mode optimised for users who primarily care about one interface.
- Keep optional aggregate and hover details compatible with that mode.

10. UX wording and naming pass

- Review labels, option names, tab titles, and preset wording.
- Reduce unnecessary technical language where simpler wording is clear.

Done criteria for the full programme:

- Hover interactions feel intentional and readable.
- The desklet supports both compact and information-rich usage styles.
- First-run behaviour feels sensible without configuration.
- The settings panel and visible copy read like a polished desktop tool rather than a prototype.