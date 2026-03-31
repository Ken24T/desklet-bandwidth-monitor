# Desklet Bandwidth Monitor — TCTBP Cheatsheet

Short operator reference for the Desklet Bandwidth Monitor workflows.

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
- Release build/package: `./scripts/package-desklet.sh`

Release-build rule:

- `./scripts/package-desklet.sh` is for explicit packaging or deploy work.
- Normal SHIP uses the validation script and JSON format check by default.

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
- uses the JSON format checks plus `./scripts/validate-desklet.sh`, not the package script, as the default build gate
- patch bump happens on every ship unless the changes are docs-only or infrastructure-only
- first ship on a `phase/` or `feature/` branch gets a minor bump
- may publish a clean branch that has no upstream yet by creating the upstream on the first ship push
- stops if the branch is dirty, behind origin, diverged from origin, or on detached `HEAD`

### `publish` / `publish please`

Purpose:
Safely publish the current branch to `origin` without release semantics.

Attempts to:

- preflight the current branch state
- fetch and compare local versus origin
- allow first publication by creating the upstream when needed
- push the current branch when it is clean and ahead
- verify that the branch is now synced

Notes:

- does not bump version
- does not create a tag
- does not update handover metadata
- stops if the branch is dirty, behind, diverged, or detached

### `checkpoint` / `checkpoint please`

Purpose:
Create a durable local-only checkpoint commit without release or sync side effects.

Attempts to:

- preflight the current branch and working tree state
- stop if `HEAD` is detached, the tree is clean, conflicts exist, or a merge/rebase/cherry-pick/revert is in progress
- stage the current non-ignored tracked and new files
- create a clearly marked non-release local commit
- end with a concise four-column table showing the pre-checkpoint commit, the new checkpoint commit, resulting sync state, and explicit local-only outcome
- confirm that nothing was pushed, tagged, or handed over

Notes:

- does not push
- does not bump version
- does not create a tag
- does not update handover metadata
- may leave the branch ahead of or further diverged from origin because it is local-only
- handover may reuse a recent matching checkpoint commit instead of creating another one

### `handover` / `handover please`

Purpose:
Safely checkpoint and publish the current work branch at the end of a session, then refresh handover metadata so another machine can resume deterministically.

Scope:

- syncs the current work branch
- syncs relevant tags when needed
- maintains `tctbp/handover-state`
- does not reconcile every branch in the repository
- does not merge into `main` as part of normal machine-to-machine sync

Notes:

- can checkpoint dirty unpublished work before verification strands it
- fast-forwards when behind and clean
- stops on divergence or ambiguity
- ends with a concise four-column table and a one-line completion summary

### `resume` / `resume please`

Purpose:
Safely restore the intended work branch at the start of a session.

Attempts to:

- fetch and inspect remote state
- read the handover metadata branch first
- prefer metadata over arbitrary branch-recency guesses
- preserve local unpublished work first when a safe branch switch would otherwise strand it
- create a local tracking branch from the intended remote branch when needed
- fast-forward a clean branch when origin is ahead
- stop on ambiguity, divergence, conflicts, or any case that would require publication

Notes:

- does not publish
- does not update metadata
- does not create a release
- stops if preserve-local handling would be unsafe or if local/remote state is ambiguous

### `deploy` / `deploy please`

Purpose:
Run an explicit desklet install or packaging deployment target.

Repo-specific deploy targets:

- `cinnamon-local-install`
  - build/package: `./scripts/package-desklet.sh`
  - install: `./scripts/install-local-desklet.sh`
  - validate: confirm the installed local desklet copy contains `desklet.js` and `metadata.json`
- `release-package`
  - build/package: `./scripts/package-desklet.sh`
  - expected output: versioned archive under `dist/`

Notes:

- requires a clean, synced branch
- stops on detached `HEAD`
- reviews packaging/install docs when packaging behaviour changes

### `status` / `status please`

Purpose:
Read-only operator snapshot of branch state, sync status, tags, version source, and recommended next steps.

Notes:

- fetches first
- uses the fuller four-column table: `Origin`, `Local`, `Status`, `Action(s)`
- includes current branch, default branch, working tree, version source, tag state, ahead/behind state, metadata relevance, and whether `resume`, `checkpoint`, `publish`, `ship`, or `handover` is recommended

### `abort`

Purpose:
Inspect and recover from a partially completed SHIP, sync, or deploy workflow.

Use when:

- version, tag, merge, or push state looks inconsistent
- branch publication and handover metadata disagree
- a previous workflow stopped mid-way

Recovery expectations:

- inspect first
- preserve unpublished work before cleanup when needed
- never rewrite history or force-push without explicit extra confirmation

### `branch` / `branch <new-branch-name>`

Purpose:
Close out current work cleanly, optionally starting the next branch.

Attempts to:

- close out the current branch and leave the repo on updated `main` when invoked as `branch`
- close out the current branch and start the next branch from updated `main` when invoked as `branch <new-branch-name>`
- assess whether the current branch should be shipped first
- stop if `HEAD` is detached
- auto-derive a unique new branch name when the requested name already exists locally or remotely
- stop instead of switching if the current branch is dirty and SHIP is declined
- stop instead of guessing if the source branch or local `main` is diverged
- stop if the source branch is ahead, behind, or unpublished relative to its upstream
- recommend `publish`, `handover`, or `ship` first when the source branch is not yet published or synced
- ask for explicit confirmation before merging the current non-default branch back into `main`
- merge the current branch into local `main` when the current branch is not already `main`
- skip the merge step when the workflow already starts on `main`
- create and switch to the resolved new branch from updated local `main`

## Docs Impact Reminder

Review docs when the change touches:

- user-visible features
- UI or interaction
- config or settings
- packaging or metadata
- roadmap or status

Repo-specific docs commonly reviewed:

- `README.md`
- `docs/user-guide.md`
- `docs/implementation-plan.md`
- `.github/bandwidth_monitor_desklet_specification.md`
- `.github/TCTBP Agent.md`
- `.github/TCTBP Cheatsheet.md`
- `.github/copilot-instructions.md`

## Approval Model

- `ship` may create local commit and tag state as part of the workflow
- `checkpoint` grants approval only for the local checkpoint commit it creates
- `publish` grants approval to push the current branch for that workflow only
- `handover` grants approval to push the current branch, metadata branch, and relevant tags for that workflow only
- `deploy` grants approval to run the repo-defined deployment commands for that workflow only
- any other remote push still requires explicit approval unless already covered by the active workflow

## Quick Choice

- Need a release version or tag: use `ship`
- Need a durable local-only save without remote side effects: use `checkpoint`
- Need to sync a clean branch without release or metadata side effects: use `publish`
- Need to stop on one machine and resume on another safely: use `handover`
- Need to restore the last handed-over branch before starting work: use `resume`
- Need the local desklet installed or a release package created: use `deploy`
- Need a quick repo state check: use `status`
- Need to recover from a partial workflow state: use `abort`
- Need to close out the current branch or start the next one: use `branch` or `branch <new-branch-name>`
