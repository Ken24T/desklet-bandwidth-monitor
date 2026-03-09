# Bandwidth Monitor Desklet Specification

## Purpose

Define the functional and technical specification for a Linux desklet that displays current network bandwidth activity in a clean, always-visible desktop widget.

## Working title

**Bandwidth Monitor Desklet**

## Background

The desklet is intended to give at-a-glance visibility of network activity without opening a terminal or full system monitor. It should suit a Linux desktop workflow, with emphasis on clarity, low overhead, and practical configurability.

## Product goals

- Show current network activity in a compact desktop widget.
- Make upload and download activity easy to read at a glance.
- Keep CPU, memory, and redraw overhead low.
- Offer enough configuration to be useful without becoming fiddly.
- Fit naturally into a Linux desktop environment, especially Cinnamon-style desklet workflows.

## Non-goals

- Full historical traffic analysis.
- Per-process packet inspection.
- Enterprise-grade network diagnostics.
- Replacing tools like `iftop`, `nload`, or full system-monitor suites.

## Primary use cases

1. View current download and upload speed from the desktop.
2. Confirm whether a download, sync, stream, or upload is actively using bandwidth.
3. See which network interface is being monitored.
4. Keep a lightweight network status widget visible on the desktop.

## Assumptions

- The desklet runs on Linux.
- Initial target environment is Cinnamon desklets.
- The implementation model is a pure native Cinnamon desklet.
- Traffic stats are sourced from standard Linux network interface counters.
- The widget is primarily local-only and does not depend on internet services.
- Extensive user configuration is a first-class product goal rather than a later nice-to-have.

## Open design questions

- Should speeds be shown only as live rates, or also with daily/session totals?
- How opinionated should theme presets be versus full manual colour control?
- Which settings should be exposed directly in v1, and which should be held back to avoid a configuration jungle?
- Should totals reset automatically at session start only, or also support manual reset per interface and global reset?

## Functional requirements

### Core monitoring

- Display current download speed.
- Display current upload speed.
- Refresh automatically at a configurable interval.
- Read traffic counters from one or more available network interfaces.
- Handle interfaces appearing or disappearing gracefully.
- Maintain per-interface cumulative RX and TX totals within the desklet session.
- Maintain cumulative RX and TX totals for the 'Group All Interfaces' aggregate view.

### Interface handling

- Discover available interfaces dynamically.
- Support at least Ethernet, Wi-Fi, and VPN/tunnel interfaces, with room for additional interfaces later.
- Present interfaces in the settings UI using friendly labels plus raw Linux interface names, for example `Ethernet (enp4s0)`.
- Allow each individual interface to be shown or hidden independently in the desklet display.
- Provide a separate 'Group All Interfaces' pseudo-interface that aggregates traffic from all applicable included interfaces.
- Allow the aggregate group to be shown or hidden independently from individual interfaces.
- When the user enables Group All display, default any currently displayed individual interfaces to hidden, while still allowing the user to manually re-enable them.
- Keep aggregate inclusion separate from simple display visibility.
- Ignore loopback and common virtual or noise interfaces by default, while still allowing them to be manually enabled if present.
- Support configurable inclusion or exclusion for VPN and tunnel interfaces.
- Support user-sortable interface ordering.
- Support optional user-defined interface nicknames or aliases.
- Support optional show or hide controls for RX and TX per displayed interface entry.
- Show interface names for displayed entries where enabled.
- Handle new interfaces appearing after desklet startup without requiring restart.
- Preserve per-interface settings where practical when interfaces reappear with the same name.

### Display

- Show values in human-friendly units.
- Support at least B/s, KB/s, MB/s, and possibly GB/s.
- Keep labels legible from normal desktop viewing distance.
- Indicate clearly which value is download and which is upload.
- Display a sparkline chart by default for each displayed interface entry, with a configuration option to disable chart rendering and use text-only display.
- When charts are enabled, render RX as a solid line and TX as a dotted line.
- Use interface-level colour coding where charts or coloured indicators are enabled.
- Display cumulative RX and TX totals for each visible interface entry and for the aggregate group when enabled.
- Totals display should be enabled by default but configurable so users can hide totals for a more compact interface.

### Configuration

- Provide an extensive configuration panel with logically grouped sections.
- Configurable refresh interval.
- Configurable units or automatic unit scaling.
- Configurable label visibility.
- Configurable font size, spacing, and widget scale.
- Configurable update smoothing, if smoothing is implemented.
- Configurable interface visibility and interface selection behaviour.
- Configurable panel layout options and text alignment.
- Configurable theme mode, including light, dark, and transparent styles.
- Configurable foreground, background, accent, and warning colours where supported.
- Configurable opacity or transparency level where supported.
- Configurable padding, border radius, and compactness settings where practical.
- Configurable per-interface show or hide toggles.
- Configurable show or hide toggle for 'Group All Interfaces'.
- Configurable inclusion rules for which interfaces contribute to the aggregate group.
- Configurable ignore-by-default interface classes, with manual override for detected ignored interfaces.
- Configurable per-interface colour and optional nickname.
- Configurable per-interface RX and TX visibility.
- Manual reset control for totals, including per-interface reset and global reset if supported by Cinnamon settings UX.

### Reliability

- Avoid crashing if counters reset or wrap.
- Avoid displaying nonsense spikes where possible.
- Start cleanly when desktop session loads.
- Recover if the monitored interface goes down and later returns.

## Non-functional requirements

### Performance

- Low CPU usage.
- Low memory usage.
- Efficient polling and redraw behaviour.

### Usability

- Readable at a glance.
- Sensible defaults so the desklet is immediately useful without setup.
- Clear wording in settings.
- Settings grouped into logical sections so power users get flexibility without confusion.
- Theme controls should allow visual integration with a wide range of wallpapers and desktop styles.

### Maintainability

- Modular internal structure.
- Clear separation between data collection, rate calculation, and UI rendering.
- Easy to extend later with graphs, totals, or themes.

## Candidate feature set

### Version 1

- Live download and upload rates.
- Sparkline chart displayed by default for each visible interface entry, with optional text-only mode.
- Selected interface or auto-detect.
- Configurable refresh interval.
- Human-readable unit scaling.
- Extensive settings panel with logical grouping.
- Theme support including light, dark, and transparent modes.
- User-adjustable colours and opacity where supported.
- Positioning, sizing, alignment, and spacing controls.
- Interface show or hide options, depending on chosen display mode.

### Possible later features

- Peak rate indicators.
- Colour or icon alerts for high traffic.
- Click action to open detailed stats.
- Richer chart styles and history depth controls.
- Persisted totals across desklet restarts or reboots.

## Technical considerations

### Data source options

Possible Linux sources include:

- `/sys/class/net/<interface>/statistics/rx_bytes`
- `/sys/class/net/<interface>/statistics/tx_bytes`
- `/proc/net/dev`

Initial preference:

- Use `/sys/class/net/.../statistics/...` for clarity and simplicity, unless Cinnamon desklet constraints make another source more practical.

### Rate calculation

Bandwidth rate will likely be calculated by:

1. Reading cumulative byte counters.
2. Storing previous values and timestamp.
3. Calculating delta bytes over delta time.
4. Converting to user-facing units.

### Units

- Default rate units should be **bytes per second**.
- Supported display units should include at least B/s, KB/s, MB/s, and GB/s.
- Optional **bits per second** display mode may be offered for users who prefer network-style Mbps values.

### Sampling and refresh model

- The desklet should separate **counter sampling** from **UI redraw**.
- Counter sampling should occur at a configurable interval, with a sensible default of **1 second**.
- UI redraw should also be configurable, but should default to a smooth, responsive cadence without excessive CPU cost.
- Where practical, redraw behaviour should feel visually smooth rather than jumpy.

### History buffer

- Sparkline charts should use a bounded rolling history buffer.
- A sensible default is **60 samples** representing approximately **60 seconds** of history at a 1-second sampling interval.
- History depth should be configurable within sensible limits.
- Buffer growth should remain bounded to protect performance and memory usage.

### Smoothing options

Potential approaches:

- No smoothing for maximum responsiveness.
- Simple moving average over last few samples.
- Exponential smoothing for steadier display.

Preferred direction:

- Provide smoothing as a configurable option.
- Default to a moderate smoothing mode that improves readability while preserving a responsive feel.

## UI ideas

The desklet layout should prioritise **at‑a‑glance readability**, compactness, and predictable scaling when multiple interfaces are shown. Because several interfaces may be visible simultaneously, the UI should be based on **repeatable interface rows**.

### Recommended core layout (row model)

Each visible interface should render as a structured row containing:

1. **Interface label** (nickname or friendly name)
2. **Live RX / TX values**
3. **Sparkline chart** (default enabled)
4. **Optional totals display**

Suggested structure:

```
[ Interface Name ]   RX: 12.4 MB/s   TX: 1.2 MB/s
[ sparkline chart showing RX solid / TX dotted ]
Totals: RX 4.2 GB   TX 512 MB
```

This row repeats for every enabled interface.

Advantages:

- predictable vertical stacking
- scales cleanly from 1 to several interfaces
- keeps charts visually separated
- works well with compact or spacious modes

---

### Chart behaviour

Default behaviour:

- Each interface row displays a **sparkline history chart**.
- RX and TX are plotted **within the same sparkline area**.
- **RX line = solid**.
- **TX line = dotted**.
- Interface colour applies to both lines.
- Sparklines should feel visually smooth where practical.

This allows users to quickly see upload vs download patterns without requiring additional chart space.

Configurable options:

- disable sparklines globally
- optional per‑interface chart enable/disable (future)
- configurable history depth
- configurable smoothing mode

---

### Density modes

The desklet should support three layout density presets:

**Compact**

- small fonts
- reduced padding
- minimal chart height
- totals optional

**Standard (default)**

- balanced spacing
- readable chart height
- totals visible

**Spacious**

- larger fonts
- more padding
- larger sparkline charts
- optimised for high‑resolution displays

These density modes control internal spacing and presentation density, but should remain separate from overall desklet size presets.

---

### Value alignment

Recommended default layout:

```
Interface Name   RX: 12 MB/s   TX: 1 MB/s
[sparkline chart showing both RX and TX]
Totals
```

Important behaviour:

- The **interface name and RX/TX values share the same text row**.
- RX and TX values appear **inline after the interface name**.
- The sparkline chart represents **both RX and TX in the same chart area** below the text row.
- RX is rendered as a **solid line** and TX as a **dotted line**.

This layout keeps the interface row compact and easy to scan while allowing the sparkline to show the activity pattern clearly.

Example:

```
Ethernet   RX: 12 MB/s   TX: 1 MB/s
[sparkline]
Totals: RX 4.2 GB   TX 512 MB
```

Alternative layouts may be added later, but the default design assumes **inline RX/TX values with a shared sparkline below**.

---

### Sparkline placement

Two viable placements:

**Option A (recommended)** Chart below the values.

Pros:

- visually stable
- scales better with narrow desklets

**Option B** Chart to the right of values.

Pros:

- more compact vertically

Recommendation: implement **Option A first**.

---

### Multi‑interface scaling

The desklet should remain readable when displaying multiple interfaces.

Recommended constraints:

- maximum default sparkline history width
- automatic vertical stacking
- optional scroll if the desklet height is constrained (future feature)

### Vertical resizing behaviour

When the user resizes the desklet vertically, the sparkline charts should dynamically scale to use the available vertical space.

- All visible sparklines should maintain **equal height**.
- The available vertical space should be distributed evenly across the visible interface rows.
- Increasing desklet height increases sparkline height proportionally.
- Decreasing desklet height reduces sparkline height proportionally.
- Text elements (labels, RX/TX values, totals) should remain readable and not overlap charts.
- The desklet should intelligently recalculate its preferred height when interface rows are added or removed.
- If an interface display is hidden or removed, the desklet should shrink to fit the remaining visible interface rows rather than leaving unused blank space.
- If a new interface display is shown, the desklet should expand as needed within configured size limits.
- A **minimum sparkline height** should be enforced so charts remain legible.
- If available space becomes too small for meaningful sparkline rendering, the desklet may clamp chart height or fall back to a more compact presentation.

This ensures the desklet scales cleanly when users manually resize it and avoids inconsistent chart heights between interfaces.

### Desklet size constraints

To prevent layouts that become unusable or visually broken, the desklet should support configurable minimum and maximum size constraints.

Recommended behaviour:

- Configurable **minimum width and height** to ensure interface rows remain readable.
- Configurable **maximum width and height** to prevent charts from becoming excessively large.
- When the desklet is resized beyond configured limits, the size should clamp to the defined min/max values.
- Default limits should be sensible so the desklet works well immediately without configuration.
- Minimum effective height should be calculated dynamically based on the number of currently visible interface rows and the active density mode.
- The desklet should support user-facing **size presets** such as Small, Medium, and Large.
- The selected size preset should establish the base dimensions or scale for the desklet.
- Users should be able to apply a **relative size tweak** in 10% increments, allowing adjustment above or below the preset baseline.

Recommended sizing model:

- **Density mode** controls the internal compactness of the layout.
- **Size preset** controls the overall base size of the desklet.
- **Percentage tweak** allows finer control, for example Medium with +10% or Small with -10%.

Example defaults (illustrative only):

- Minimum width: enough for interface label and RX/TX values
- Minimum height: enough for at least one interface row with sparkline
- Maximum width: prevents extremely stretched charts
- Maximum height: prevents oversized sparklines that waste space
- Presets: Small, Medium, Large
- Relative adjustment: -30%, -20%, -10%, 0%, +10%, +20%, +30%

These constraints should remain optional and adjustable via the Size and Typography configuration section.

---

### Example visual structure

Example with three interfaces:

```
Group All   RX: 24 MB/s   TX: 3 MB/s
[sparkline]
Totals: RX 12 GB  TX 1.1 GB

Ethernet   RX: 18 MB/s   TX: 2 MB/s
[sparkline]
Totals: RX 9 GB  TX 700 MB

Wi‑Fi   RX: 6 MB/s   TX: 1 MB/s
[sparkline]
Totals: RX 3 GB  TX 400 MB
```

The **Group All interface display should behave identically to any other interface display**, with the only difference being the label indicating that it represents aggregated traffic.

---

### Optional compact text‑only mode

If sparklines are disabled, each interface row becomes:

```
Interface Name
RX: 12.4 MB/s   TX: 1.2 MB/s
Totals: RX 4.2 GB   TX 512 MB
```

This mode reduces rendering overhead and allows extremely compact layouts.

---

### Visual hierarchy

Recommended priority order for readability:

1. Interface name
2. Live RX/TX rates
3. Sparkline activity pattern
4. Totals

Live activity should always be the most visually prominent element.

---

## Configuration panel concept

The settings UI should be divided into clear sections rather than one long wall of toggles.

### Section: General

- Refresh interval
- UI redraw interval
- Show or hide totals (enabled by default)
- Unit behaviour
- Smoothing mode
- Show or hide title
- Show or hide labels
- Enable or disable sparklines globally
- Default chart history depth if configurable

### Section: Interfaces

- Dynamically list detected interfaces using friendly labels plus raw names
- Per-interface show or hide toggle
- Per-interface include or exclude from Group All
- Show or hide RX per interface
- Show or hide TX per interface
- Optional per-interface nickname
- Optional per-interface colour
- Show or hide 'Group All Interfaces'
- Rules for which interfaces are included in the aggregate group
- Include or exclude VPN and tunnel interfaces
- Include or exclude loopback
- Surface ignored-by-default interfaces so they can be manually enabled if desired
- Show or hide interface names
- User-sortable interface ordering
- Reset totals for a selected interface
- Reset totals for all interfaces

### Section: Layout

- Compact, standard, or spacious density
- Horizontal or vertical arrangement if supported
- Text alignment
- Padding and spacing
- Border radius
- Optional title placement
- Size preset selection: Small, Medium, Large
- Fine size adjustment in 10% increments relative to the selected preset

### Section: Size and typography

- Minimum desklet width
- Maximum desklet width
- Minimum desklet height
- Maximum desklet height
- Minimum sparkline height
- Desklet scale
- Preset base size definition
- Relative size adjustment percentage in 10% increments
- Font sizes for title, labels, and values
- Font weight options if supported
- Width constraints or auto-width behaviour

### Section: Theme

- Theme mode: light, dark, transparent, or custom
- Background opacity
- Foreground text colour
- Accent colour
- Optional separate colours for download and upload
- Border or shadow visibility where supported

### Section: Advanced

- Polling behaviour
- Counter reset handling
- Spike suppression or smoothing aggressiveness
- Debug or diagnostics mode if added later

## Design direction emerging

- Pure Cinnamon-native implementation.
- Rich configuration is part of v1, not deferred.
- The settings experience should feel structured and intentional, not like a junk drawer of checkboxes.
- Light, dark, and transparent presentation modes should be first-class options.
- Theming should balance convenience presets with manual override for users who want fine control.
- Desklet sizing should combine simple presets with fine-grained percentage adjustment so users can get close quickly and then nudge the result without fiddly manual resizing.

## Error and edge-case handling

- No active interface found.
- Selected interface missing.
- Counter reset after suspend, reconnect, or reboot.
- Very high-speed bursts causing display jumps.
- Wi-Fi to Ethernet switching.
- VPN/tunnel interfaces appearing alongside physical interfaces.
- Interfaces being renamed or recreated.
- Aggregate totals changing as interfaces are added, removed, shown, or hidden.
- Totals reset behaviour needing to be predictable and clearly scoped.
- Ignored-by-default virtual interfaces appearing and confusing users unless clearly surfaced in settings.
- Group All being enabled and hiding currently visible interfaces should be predictable and reversible.

## Early decisions to make

1. Target desklet framework details.
2. Whether the aggregate group includes all detected interfaces by default except loopback, or uses explicit inclusion rules.
3. How totals reset controls are exposed in the Cinnamon settings experience.
4. Whether interface visibility also controls aggregate inclusion, or whether those are separate concepts.

## Interface design direction emerging

- V1 should support multiple displayed interface entries rather than just one active interface.
- Each interface can be independently shown or hidden.
- A separate aggregate entry called 'Group All Interfaces' should combine traffic from all eligible included interfaces.
- Group All should behave like any other displayed interface entry, with live RX and TX rates, cumulative RX and TX totals, and chart rendering enabled by default.
- When Group All display is enabled, currently displayed individual interfaces should default to hidden, but users may manually re-enable any other interface displays they want alongside it.
- Aggregate inclusion rules must be kept separate from simple display visibility to avoid confusing behaviour.
- Group All should be the default first-run display.
- Group All should include Ethernet, Wi-Fi, VPN or tunnel, and other non-ignored interfaces by default, while excluding loopback and ignored virtual-noise interfaces unless manually enabled.
- Interfaces should be presented in the UI with friendly labels plus raw Linux names.
- Loopback and common virtual-noise interfaces should be ignored by default but still manually selectable if present.
- Interfaces should support user-sortable ordering, colours, nicknames, and per-interface RX or TX visibility.
- Colours should be automatically assigned by default and manually overridable.
- Nicknames should replace labels in desklet display, while settings should continue to show the true interface identity.
- RX and TX totals are part of v1 and should be resettable using a baseline-reset model.
- If an interface disappears and later returns, the desklet should prioritise correctness and avoid false spikes or fake continuity.
- When charts are enabled, RX uses a solid line and TX uses a dotted line for clear differentiation.
- Interface colour should distinguish one interface from another, while line style distinguishes RX from TX.
- Sparkline charts should be enabled by default for displayed interface entries, with a configuration option to switch to text-only display.

## Technical architecture

### Recommended desklet structure

The implementation should follow a modular pure-Cinnamon desklet structure, with clear separation of concerns even if the final package remains small.

Recommended file set:

- `desklet.js` for main desklet lifecycle and orchestration
- `metadata.json` for desklet metadata
- `settings-schema.json` for user configuration
- `stylesheet.css` for theme and layout styling

If the code grows beyond a comfortable single-file size, internal helper modules may be introduced later, but v1 should still preserve logical separation between discovery, sampling, buffering, and rendering.

### Core internal components

#### 1. Interface discovery layer

Responsibilities:

- enumerate interfaces from `/sys/class/net`
- classify likely interface types such as Ethernet, Wi-Fi, VPN/tunnel, or other
- apply ignored-by-default rules
- maintain interface metadata for display and settings

Suggested logical model:

- raw interface name
- friendly label
- optional nickname
- interface type
- colour
- show or hide in desklet
- include or exclude from Group All
- RX visible
- TX visible
- ordering position
- baseline RX and TX counters
- cumulative RX and TX totals

#### 2. Sampling engine

Responsibilities:

- read RX and TX byte counters from `/sys/class/net/<interface>/statistics/`
- store previous sample values and timestamps
- calculate rates from byte deltas over time deltas
- update totals using the baseline-reset model
- handle counter resets, disappearing interfaces, and returning interfaces safely

Preferred default behaviour:

- sampling interval default: **1 second**
- bounded work per cycle
- correctness preferred over fake continuity

#### 3. History buffer layer

Responsibilities:

- maintain bounded rolling RX and TX sample history per visible interface
- maintain bounded rolling RX and TX sample history for Group All
- support configurable history depth
- support optional smoothing before rendering

Suggested default:

- 60 samples
- approximately 60 seconds at a 1-second sample interval

#### 4. Rendering layer

Responsibilities:

- build and update visible interface rows
- render text values and totals
- render sparklines
- recalculate row layout and chart height on resize
- rebuild or refresh UI when settings change

### Desklet lifecycle

Recommended lifecycle flow:

- `_init()` loads settings, discovers interfaces, builds UI, and starts timers
- sampling update loop reads counters and updates rate/totals/history state
- render update loop refreshes text and sparkline output
- settings change handlers rebuild or restyle affected parts of the desklet
- `on_desklet_removed()` stops timers and releases resources cleanly

### Sampling and redraw timers

The desklet should separate sampling from rendering.

Recommended model:

- **sampling timer** reads counters and updates internal state
- **render timer** redraws visible values and sparklines

Default direction:

- sampling default: **1 second**
- redraw default: **smooth but bounded**, potentially equal to or slightly more frequent than sampling where practical

This separation helps keep the display smooth without coupling every redraw to filesystem reads.

### Data flow

Recommended flow:

1. discover interfaces
2. read counters
3. calculate rates
4. update totals
5. update history buffers
6. apply smoothing if enabled
7. render interface rows

### Performance guardrails

- bounded history buffers only
- avoid per-frame filesystem reads
- avoid unnecessary full UI rebuilds
- reuse render objects where practical
- clamp redraw frequency to avoid wasting CPU cycles
- fall back gracefully if chart space becomes too small

## Sparkline rendering approach

### Recommended rendering direction

For v1, the safest and most maintainable approach is to use a **native Cinnamon/GJS drawing approach** rather than embedding any web-style rendering layer.

Recommended priorities:

- keep sparklines lightweight
- minimise dependencies
- draw directly from bounded sample arrays
- preserve consistent behaviour across themes and sizes

### Rendering model

Each visible interface row should have a single sparkline area that renders both RX and TX histories.

Rules:

- RX uses a **solid line**
- TX uses a **dotted line**
- both use the interface colour
- both are scaled to the current chart area
- chart height responds to desklet height and visible row count

### Practical implementation guidance

The sparkline renderer should:

- accept RX and TX sample arrays plus chart dimensions
- normalise values to the current visible scale
- render from left to right across the available width
- clip cleanly to the chart bounds
- support redraw without recreating the entire desklet row

### Smoothing behaviour

Preferred v1 direction:

- default to a moderate smoothing mode
- keep smoothing configurable
- allow fully raw display for users who prefer maximum responsiveness

### Scale behaviour

To avoid misleading output:

- the sparkline should use a clear per-row scaling rule
- scaling should remain stable enough to read patterns without excessive jitter
- sudden scale changes should be minimised where practical

### Fallback behaviour

If the sparkline area becomes too small:

- clamp to the minimum sparkline height, or
- fall back to text-only display if required by available space or settings

## Settings schema direction

### Schema philosophy

The settings schema should expose rich control without becoming chaotic. It should be grouped around the user’s mental model rather than implementation details.

Top-level sections should remain:

- General
- Interfaces
- Layout
- Size and typography
- Theme
- Advanced

### Recommended schema characteristics

- clear labels and help text for user-facing settings
- sensible defaults for first run
- stable internal keys for future compatibility
- keep advanced or risky settings away from the basic path
- separate display visibility from Group All inclusion

### General settings candidates

- sampling interval
- redraw interval
- unit mode: bytes/sec or bits/sec
- automatic unit scaling on or off
- smoothing mode
- sparkline enabled on or off
- default history depth
- show totals on or off
- show title on or off
- show labels on or off

### Interface settings candidates

Per-interface settings should be represented cleanly and consistently.

Likely fields per interface:

- visible in desklet
- included in Group All
- show RX
- show TX
- nickname
- colour
- ordering value

Global interface-related settings:

- show Group All
- include VPN/tunnel interfaces by default
- include loopback by default
- surface ignored interfaces for optional enablement

### Layout settings candidates

- density mode
- text alignment
- padding
- spacing
- border radius
- title placement
- chart placement where future layouts allow variation
- size preset: Small, Medium, Large
- size percentage tweak in 10% increments

### Size and typography settings candidates

- minimum width
- maximum width
- minimum height
- maximum height
- minimum sparkline height
- font sizes for title, labels, and values
- width constraints or auto-width behaviour

### Theme settings candidates

- theme mode: light, dark, transparent, custom
- background opacity
- foreground text colour
- accent colour
- optional override colours where supported
- border visibility
- shadow visibility

### Advanced settings candidates

- counter reset handling
- smoothing aggressiveness
- spike suppression behaviour
- diagnostics or debug mode

### Settings interaction principles

- changing visibility should immediately update displayed rows
- changing size or density should immediately recalculate layout
- changing theme should restyle without requiring restart
- enabling Group All should default-hide currently shown individual interfaces, while allowing manual re-enable
- reset actions should be explicit and clearly scoped

## Proposed next step

Refine this into:

- product requirements
- UX decisions
- settings schema
- technical architecture
- acceptance criteria

## TL;DR

We now have a strong starter specification for a lightweight Linux bandwidth desklet focused on live upload and download monitoring, low overhead, and practical configuration. The interface model is now much clearer: Group All is the default first-run display, per-interface entries are configurable and sortable, totals are resettable, and sparklines are enabled by default with an option for text-only mode. The specification now also includes a clearer technical architecture, a native sparkline rendering direction, and a structured settings schema model that should translate well into implementation and later Copilot instructions.

