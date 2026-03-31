# Desklet Bandwidth Monitor — TCTBP Agent

## Purpose

This agent governs milestone, checkpointing, publishing, handover, resume, sync, status, recovery, and deployment actions for Desklet Bandwidth Monitor.

Primary objective: no code is ever lost while keeping local and remote repository state validated, recoverable, and easy to resume on another machine.

This workflow is for explicit operator actions such as `ship`, `checkpoint`, `publish`, `handover`, `resume`, `deploy`, `status`, `abort`, `branch`, and `branch <name>`. It is not for normal feature implementation work.

Quick reference: see [TCTBP Cheatsheet.md](TCTBP%20Cheatsheet.md).

## Authoritative Precedence

- `.github/TCTBP.json` is the source of truth when this document and the JSON profile differ.
- This file explains behaviour and guard rails when the JSON profile does not capture enough safety context.
- `.github/TCTBP Cheatsheet.md` is the short operator summary.
- `.github/agents/TCTBP.agent.md` is the runtime entry point for explicit TCTBP trigger routing.
- `.github/copilot-instructions.md` contains repo-specific engineering guidance and should stay aligned with the workflow files and runtime files.

## Repo Profile

Desklet Bandwidth Monitor is a native Cinnamon/GJS desklet project for monitoring live network bandwidth activity with local desktop integration.

Repo-specific operational values that must be preserved:

- default branch: `main`
- version source: `metadata.json` field `version`
- tag format: plain semver tags such as `1.5.0`, not `v1.5.0`
- format gate: `python3 -m json.tool metadata.json >/dev/null && python3 -m json.tool settings-schema.json >/dev/null`
- lint gate: `./scripts/validate-desklet.sh`
- test gate: `./scripts/validate-desklet.sh`
- normal build gate: `./scripts/validate-desklet.sh`
- release build: `./scripts/package-desklet.sh`
- release build policy: use the package build for explicit packaging or deployment work, not as the default SHIP gate
- local install helper: `./scripts/install-local-desklet.sh`
- user-facing docs commonly reviewed: `README.md`, `docs/user-guide.md`, `docs/implementation-plan.md`, and `.github/bandwidth_monitor_desklet_specification.md`
- locale: Australian English for user-facing text and comments

## Core Invariants

1. Verification must pass before irreversible actions unless `.github/TCTBP.json` explicitly allows a docs/infra-only shortcut.
2. Problems must be zero before any commit.
3. Protected Git actions such as push, force-push, branch deletion, history rewrite, or remote modification require explicit approval unless granted by the active workflow trigger.
4. Tags must correspond exactly to the version committed in `metadata.json` and point to the commit that introduced that version.
5. No-code-loss takes priority over workflow completion.
6. Do not use hard reset, destructive checkout, auto-rebase, or force-push as normal workflow shortcuts.
7. Keep versioned artefacts, workflow files, runtime files, and documentation aligned.
8. Use `./scripts/validate-desklet.sh` as the default verification gate and reserve `./scripts/package-desklet.sh` for packaging or deploy work.

If any invariant fails, stop and explain the blocker.

## Supported Triggers

Supported workflow triggers are:

- `ship`, `ship please`, `shipping`, `prepare release`
- `checkpoint`, `checkpoint please`
- `publish`, `publish please`
- `deploy`, `deploy please`
- `handover`, `handover please`
- `resume`, `resume please`
- `status`, `status please`
- `abort`
- `branch`
- `branch <new-branch-name>`

Do not treat a bare `tctbp` request or the older `handoff` wording as implicit permission to mutate repository state.

## Docs/Infra-Only Detection

A changeset is docs-only or infrastructure-only only when every changed file matches the repo rules in `.github/TCTBP.json`, for example:

- `*.md`, `*.txt`, `*.rst`
- `docs/**`
- `.github/**`
- `LICENSE*`, `CHANGELOG*`, `CONTRIBUTING*`

Desklet runtime files such as `desklet.js`, `metadata.json`, `settings-schema.json`, `stylesheet.css`, and packaging scripts are not docs-only by default just because they are text files.

## Publish Workflow

Trigger: `publish` / `publish please`

Purpose: safely publish the current clean branch to origin without creating a release, bumping a version, creating a tag, or updating handover metadata.

Key rules:

- stop if `HEAD` is detached
- stop if the working tree is dirty
- fetch origin before deciding whether a push is required
- create an upstream on first publication when the branch is otherwise clean and unpublished
- stop if the branch is behind or diverged from origin
- never create a version bump, tag, or metadata update as part of `publish`

## Checkpoint Workflow

Trigger: `checkpoint` / `checkpoint please`

Purpose: create a durable local-only checkpoint commit on the current branch without changing version, tags, metadata, or remote state.

Key rules:

- stop if `HEAD` is detached
- stop if the working tree is clean
- stop if conflicts exist or a merge, rebase, cherry-pick, or revert is in progress
- stage the current non-ignored tracked and untracked changes
- create a clearly marked local-only checkpoint commit
- do not block on heavyweight verification gates, though existing diagnostics may still be reported for awareness
- do not push, create a tag, bump version, update metadata, or switch branches as part of `checkpoint`
- end with a concise four-column table and explicit confirmation that no remote state changed

## Branch Workflow

Trigger: `branch` or `branch <new-branch-name>`

Purpose: close out the current branch safely and either stop on `main` or create the next branch without losing code.

Key rules:

- stop if `HEAD` is detached
- determine whether the request is closeout-only mode (`branch`) or next-branch mode (`branch <new-branch-name>`)
- validate the requested branch name before mutating anything in next-branch mode
- automatically derive a unique branch name by appending `-1`, `-2`, and so on when the requested target already exists locally or remotely
- stop if the target branch resolves to the default branch or remains invalid after validation
- stop if the source branch is dirty and SHIP is declined
- if the source branch is dirty and SHIP is declined, recommend `checkpoint`, then `publish` or `handover`, before retrying `branch`
- stop if the source branch is ahead, behind, diverged, or otherwise unpublished relative to its upstream
- fast-forward local `main` when clean and behind origin
- ask for explicit confirmation before merging a non-default branch back into `main`
- treat merge-to-`main` as the expected default outcome, but stop if that merge is explicitly declined
- verify the source branch tip is reachable from `main` before optional cleanup
- in closeout-only mode, stop on the updated default branch once closeout is complete
- in next-branch mode, create and switch to the resolved new branch name from the updated default branch
- require explicit approval for push and branch deletion

Never use stash, reset, rebase, force-push, or destructive checkout as part of the branch workflow.

## Handover Workflow

Trigger: `handover` / `handover please`

Purpose: safely checkpoint and publish the current work branch at end of day, then refresh the handover metadata branch so another machine can resume from a deterministic shared state.

Scope:

- syncs the current work branch
- syncs relevant tags when needed
- maintains the metadata branch `tctbp/handover-state`
- does not attempt to reconcile every branch in the repository
- does not merge the current work branch into `main` as part of ordinary multi-machine sync

Handover metadata:

- metadata branch: `tctbp/handover-state`
- metadata file: `.github/TCTBP_STATE.json`
- metadata is refreshed after the current branch is safely published
- the metadata branch is never treated as a work branch candidate

Key safety rules:

- stop if `HEAD` is detached
- preserve dirty unpublished work through a durable checkpoint when necessary
- a recent matching standalone `checkpoint` commit may be reused instead of creating another one
- allow fast-forward only when local is clean and behind
- stop on divergence rather than guessing
- never auto-merge or auto-rebase as part of reconciliation
- update the metadata branch using a secondary worktree or another non-destructive mechanism

Handover summary format:

- use a concise four-column table with `Origin`, `Local`, `Status`, and `Action(s)`
- keep the final table shorter than `status`
- confirm current branch state, last shipped tag, metadata branch state, metadata consistency, and final synced baseline

## Resume Workflow

Trigger: `resume` / `resume please`

Purpose: restore the intended work branch at start of day by consulting handover metadata first, preserving current local unpublished work when a safe branch switch would otherwise strand it, and reconciling only through non-destructive checkout and fast-forward operations.

Key safety rules:

- stop if `HEAD` is detached
- consult metadata before arbitrary branch-recency inference
- prefer metadata over an arbitrary clean non-default branch
- preserve current local unpublished work first when switching would otherwise strand it
- create a local tracking branch from remote when the intended branch is published but missing locally
- allow fast-forward only when local is clean and behind
- stop when local is ahead, diverged, conflicted, or ambiguous instead of publishing during `resume`

## Status Workflow

Trigger: `status` / `status please`

Purpose: provide a read-only operator snapshot of the repo.

Behaviour:

- fetch remote state first
- render a four-column table using `Origin`, `Local`, `Status`, and `Action(s)`
- include branch/upstream state, head commit, default-branch state, tag state, ahead/behind counts, working tree state, version source, metadata state, and whether `resume`, `checkpoint`, `publish`, `ship`, or `handover` is recommended
- never mutate the repo from `status`

## Abort Workflow

Trigger: `abort`

Purpose: inspect and recover safely from a partially completed workflow.

Check for states such as:

- version bumped without matching tag
- tag created but not pushed
- branch pushed while handover metadata is stale
- metadata pushed while the target branch is unpublished
- merge in progress
- local/remote tag drift
- user-facing docs or packaging metadata updated without the corresponding repo state

Abort must inspect first, propose recovery second, and execute only explicitly approved actions.

## Deploy Workflow

Trigger: `deploy` / `deploy please`

Purpose: build a release artefact or install the desklet locally using the repo-defined scripts.

General rules:

- stop if `HEAD` is detached
- require a clean working tree
- require a synced branch
- use `./scripts/package-desklet.sh` for packaging work
- review packaging and install docs impact before mutating deployment targets
- validate the deployed result rather than merely copying files

Repo-specific deploy targets:

### `cinnamon-local-install`

- build/package: `./scripts/package-desklet.sh`
- install: `./scripts/install-local-desklet.sh`
- post-deploy validation: confirm `~/.local/share/cinnamon/desklets/bandwidth-monitor@Ken24T/desklet.js` and `metadata.json` exist

### `release-package`

- build/package: `./scripts/package-desklet.sh`
- expected output: versioned archive under `dist/`
- post-deploy validation: confirm `dist/` contains `bandwidth-monitor@Ken24T-v*.zip`

If the requested deployment target is not one of these explicit cases, stop and ask rather than guessing.

## SHIP Workflow

Trigger: `ship` / `ship please` / `shipping` / `prepare release`

Purpose: create a formal shipped version only from a clean, fetched branch.

Workflow order:

1. preflight
2. verify
3. problems
4. docs impact
5. bump
6. commit
7. changelog when present
8. tag
9. push

Preflight guard rails:

- fetch origin when needed
- stop if `HEAD` is detached
- allow first publication from a clean unpublished branch
- stop if the branch is behind or diverged from origin
- stop if the working tree is dirty
- render a release-focused four-column snapshot table before mutating anything

Verify and build policy:

- normal SHIP gate: the JSON format checks plus `./scripts/validate-desklet.sh`
- use `./scripts/package-desklet.sh` only when the user explicitly requests packaging or deploy work, or when the deploy workflow requires it
- docs/infra-only changes may skip heavyweight code gates according to `.github/TCTBP.json`, but still require editor diagnostics and docs impact assessment

Versioning rules:

- patch bump on every SHIP except docs-only or infrastructure-only changes
- first SHIP on a `phase/` or `feature/` branch gets a minor bump instead of a patch bump
- major bump only by explicit instruction
- apply version changes to `metadata.json` before committing

Tagging rules:

- use plain semver tags like `1.5.0`
- one tag per shipped commit
- skip tagging when no version bump occurs

Docs impact rules:

- `README.md`, `docs/user-guide.md`, and `.github/bandwidth_monitor_desklet_specification.md` for user-visible or UI changes
- `metadata.json`, `scripts/install-local-desklet.sh`, and `scripts/package-desklet.sh` for packaging or metadata changes
- `docs/implementation-plan.md` for roadmap or implementation-status changes
- if no docs changes are required, record `No docs impact` with a short reason

## Summary Table Consistency

For SHIP, handover, and status tables:

- columns must be `Origin`, `Local`, `Status`, and `Action(s)`
- use `n/a` when there is no meaningful origin-side value
- keep `Status` diagnostic, not narrative
- keep `Action(s)` concrete and short

## Repo-Specific Preservation Notes

When updating these workflow files, preserve the following local choices unless the user explicitly changes them:

- plain numeric release tags instead of `v`-prefixed tags
- `metadata.json` as version source
- `./scripts/validate-desklet.sh` as the default SHIP validation gate
- `./scripts/package-desklet.sh` only for explicit packaging or deploy work
- `./scripts/install-local-desklet.sh` for local Cinnamon installation
- user-guide and specification docs under `docs/` and `.github/`
- Australian English conventions
