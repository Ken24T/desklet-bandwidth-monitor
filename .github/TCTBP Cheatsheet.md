# Desklet Bandwidth Monitor — TCTBP Cheatsheet

Short operator reference for the desklet repo workflows.

Use this file for the quick view.
Use [TCTBP Agent.md](TCTBP%20Agent.md) for the full workflow rules and guard rails.

## Core Rule

- No code is ever lost while syncing local and remote state.
- Do not use destructive shortcuts as part of normal workflow execution.
- If a workflow hits divergence, ambiguity, failed verification, or stale release state, it should stop rather than guess.

## Repo Gates

Repo gates for this repository:

- Format check: `python3 -m json.tool metadata.json >/dev/null && python3 -m json.tool settings-schema.json >/dev/null`
- Test: `./scripts/validate-desklet.sh`
- Lint: `./scripts/validate-desklet.sh`
- Normal build gate: `./scripts/validate-desklet.sh`
- Release/package builds: `./scripts/package-desklet.sh` and `./scripts/package-gnome-extension.sh`

Release/package build rule:

- `./scripts/package-desklet.sh` and `./scripts/package-gnome-extension.sh` are for explicit packaging or deployment work.
- Normal SHIP uses `./scripts/validate-desklet.sh` by default.

## Version And Tags

- Version source: `metadata.json` field `version`
- Tag format: plain semver, for example `1.5.0`
- Do not normalise this repo to `v1.5.0` tags unless explicitly requested.

## Triggers

### `ship` / `ship please` / `shipping` / `prepare release`

Purpose:
Formal source release workflow.

Attempts to:

- preflight the repo state
- show a concise origin-vs-local snapshot table before mutating anything
- run verification gates
- confirm zero problems
- assess docs impact
- bump version when required
- commit the release changes
- create the version tag
- push the current branch

Notes:

- starts with a four-column table: `Origin`, `Local`, `Status`, `Action(s)`
- uses `./scripts/validate-desklet.sh`, not `./scripts/package-desklet.sh`, as the default SHIP gate
- patch bump behaviour is controlled by `versioning.patchEveryShip` and `versioning.patchEveryShipForDocsInfrastructureOnly` in `.github/TCTBP.json`
- in this repo, docs-only and infrastructure-only ships do not bump by default
- first ship on a `phase-` or `feature/` branch gets a minor bump
- may publish a clean branch that has no upstream yet by creating the upstream on the first ship push
- stops if the branch is dirty, behind origin, diverged from origin, or on detached `HEAD`

### `publish` / `publish please`

Safely publish the current clean branch to `origin` without release semantics.

- no version bump
- no tag creation
- no handover metadata update

### `checkpoint` / `checkpoint please`

Create a durable local-only checkpoint commit on the current branch without release or sync side effects.

- stops if `HEAD` is detached, the tree is clean, conflicts exist, or a merge/rebase/cherry-pick/revert is in progress
- stages current tracked and non-ignored untracked changes
- creates a clearly marked non-release local commit
- ends with a concise four-column table covering the previous HEAD, new checkpoint commit, resulting working-tree state, sync state, and explicit local-only outcome
- emits that checkpoint table as a standalone Markdown block with a blank line before and after it
- does not push, create a tag, or update handover metadata

### `handover` / `handover please`

Safely checkpoint and publish the current work branch, then refresh `tctbp/handover-state` so another machine can resume deterministically.

Notes:

- can reuse a recent matching standalone `checkpoint` commit instead of creating another one
- fast-forwards when behind and clean
- stops on divergence or ambiguity
- ends with a concise four-column table emitted as a standalone Markdown block with a blank line before and after it
- adds a one-line completion summary after the table

### `resume` / `resume please`

Safely restore the intended work branch at the start of a session by consulting handover metadata first, preserving local unpublished work first when a safe branch switch would otherwise strand it.

Attempts to:

- fetch and inspect remote state
- read the handover metadata branch first
- prefer metadata over arbitrary branch-recency guesses
- detect when switching would strand local unpublished work on the current branch
- ask to preserve that local work locally before switching when that case is safe
- create a local tracking branch from the intended remote branch when needed
- fast-forward the selected clean branch when origin is ahead
- stop on ambiguity, divergence, conflicts, or any case that would require publication

Notes:

- may create a local-only checkpoint or rescue branch after confirmation to preserve local work before switching
- does not publish
- does not update metadata
- does not create a release
- stops if preserve-local handling would be unsafe, if switching branches would still be destructive, or if local/remote state is ambiguous

### `deploy` / `deploy please`

Run an explicit local installation workflow.

Repo-specific target:

- `cinnamon-user-local`
  - build: `./scripts/package-desklet.sh`
  - install: `./scripts/install-local-desklet.sh`
  - validate: confirm `~/.local/share/cinnamon/desklets/bandwidth-monitor@Ken24T/metadata.json` exists
- `gnome-user-local`
  - build: `./scripts/package-gnome-extension.sh`
  - install: `./scripts/install-gnome-extension.sh`
  - validate: confirm `~/.local/share/gnome-shell/extensions/bandwidth-monitor-gnome@Ken24T/metadata.json` and `~/.local/share/gnome-shell/extensions/bandwidth-monitor-gnome@Ken24T/schemas/gschemas.compiled` exist

### `status` / `status please`

Read-only operator snapshot of branch state, sync status, tags, version source, and recommended next steps.

- first user-visible output block must be the fuller four-column table using `Origin`, `Local`, `Status`, and `Action(s)`
- emit that status table as a standalone Markdown block with a blank line before and after it

### `abort`

Inspect and recover from a partially completed SHIP, sync, or deploy workflow.

### `branch` / `branch <new-branch-name>`

Close out current work cleanly, optionally starting the next branch.

- `branch` closes out the current branch and leaves the repo on the updated `main`
- `branch <new-branch-name>` closes out the current branch and starts the next branch from the updated `main`
- asks for explicit confirmation before merging a non-default branch back into `main`
- requires the source branch to be published before the transition continues

## Docs Impact Reminder

Repo-specific docs commonly reviewed:

- `README.md`
- `docs/user-guide.md`
- `docs/implementation-plan.md`
- `.github/bandwidth_monitor_desklet_specification.md`
- `metadata.json`
- `settings-schema.json`
- `scripts/install-local-desklet.sh`
- `scripts/package-desklet.sh`
- `scripts/install-gnome-extension.sh`
- `scripts/package-gnome-extension.sh`
- `docs/gnome-extension-user-guide.md`
- `.github/TCTBP Agent.md`
- `.github/TCTBP Cheatsheet.md`
- `.github/copilot-instructions.md`

## Quick Choice

- Need a release version or tag: use `ship`
- Need a durable local-only save before deciding whether to publish or hand over: use `checkpoint`
- Need to sync a clean branch without release or metadata side effects: use `publish`
- Need to stop on one machine and resume on another safely: use `handover`
- Need to restore the last handed-over branch before starting work: use `resume`
- Need the local Cinnamon or GNOME install updated: use `deploy`
- Need a quick repo state check: use `status`
- Need to recover from a partial workflow state: use `abort`
- Need to close out the current branch or start the next one: use `branch` or `branch <new-branch-name>`