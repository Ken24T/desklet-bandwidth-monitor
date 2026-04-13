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

Desklet Bandwidth Monitor is a solo-developer bandwidth monitor repository with a Cinnamon desklet, a GNOME Shell extension MVP branch, and local installation and release packaging scripts.

Repo-specific operational values that must be preserved:

- default branch: `main`
- version source: `metadata.json` field `version`
- tag format: `X.Y.Z` without a `v` prefix
- format gate: `python3 -m json.tool metadata.json >/dev/null && python3 -m json.tool settings-schema.json >/dev/null`
- lint gate: `./scripts/validate-desklet.sh`
- test gate: `./scripts/validate-desklet.sh`
- normal build gate: `./scripts/validate-desklet.sh`
- release/package build: `./scripts/package-desklet.sh`
- deploy targets: `cinnamon-user-local` via `./scripts/install-local-desklet.sh`; `gnome-user-local` via `./scripts/install-gnome-extension.sh`
- user-facing docs commonly reviewed: `README.md`, `docs/user-guide.md`, `.github/bandwidth_monitor_desklet_specification.md`, and `docs/implementation-plan.md`
- branch preference for implementation work: phase-oriented branches that normally merge back into `main` before the next phase branch is created
- locale: Australian English for user-facing text and comments

## Core Invariants

1. Verification must pass before irreversible actions unless `.github/TCTBP.json` explicitly allows a docs/infra-only shortcut.
2. Problems must be zero before any release, publication-linked, or shared-state commit, unless `.github/TCTBP.json` explicitly allows a local-only checkpoint commit to preserve work first.
3. Protected Git actions such as push, force-push, branch deletion, history rewrite, or remote modification require explicit approval unless granted by the active workflow trigger.
4. Tags must correspond exactly to the version committed in `metadata.json` and point to the commit that introduced that version.
5. No-code-loss takes priority over workflow completion.
6. Do not use hard reset, destructive checkout, auto-rebase, or force-push as normal workflow shortcuts.
7. Keep versioned artefacts, workflow files, runtime files, and documentation aligned.
8. Use the validation script as the normal SHIP gate; reserve package creation or local installation work for explicit packaging or deploy actions.

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

Do not treat a bare `tctbp` request as implicit permission to mutate repository state.

## Docs/Infra-Only Detection

A changeset is docs-only or infrastructure-only only when every changed file matches the repo rules in `.github/TCTBP.json`, for example:

- `*.md`, `*.txt`, `*.rst`
- `docs/**`
- `.github/**`
- `packaging/**`
- `LICENSE*`, `CHANGELOG*`, `CONTRIBUTING*`

Build manifests, desklet metadata, settings schema, and runtime styling are not docs-only by default just because they are text files.

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
- stop if the working tree has unresolved conflicts or if a merge, rebase, cherry-pick, or revert is in progress
- stage the current non-ignored tracked and untracked changes on the current branch
- create a clearly marked local-only commit using the configured checkpoint message prefix
- do not run heavyweight verification gates as a blocker for this workflow
- if diagnostics are already available, they may be reported for awareness only
- end with a concise four-column table covering the previous `HEAD`, new checkpoint commit, resulting working-tree state, upstream sync state, and explicit local-only outcome
- emit that checkpoint table as a standalone Markdown block with a blank line before and after it
- never push, create a tag, bump version, update handover metadata, or change branches as part of `checkpoint`

## Branch Workflow

Trigger: `branch` or `branch <new-branch-name>`

Purpose: close out the current branch safely and either stop on `main` or create the next branch without losing code.

Key rules:

- stop if `HEAD` is detached
- determine whether the request is closeout-only mode (`branch`) or next-branch mode (`branch <new-branch-name>`)
- validate the requested branch name before mutating anything in next-branch mode
- stop if the target branch already exists locally or on origin in next-branch mode
- stop if the source branch is dirty and SHIP is declined
- if the source branch is dirty and SHIP is declined, recommend `checkpoint`, then `publish` or `handover`, before retrying `branch`
- stop if the source branch is ahead, behind, diverged, or otherwise unpublished relative to its upstream
- fast-forward local `main` when clean and behind origin
- ask for explicit confirmation before merging a non-default branch back into `main`
- treat merge-to-`main` as the expected default outcome, but stop if that merge is explicitly declined
- verify the source branch tip is reachable from `main` before optional cleanup
- in closeout-only mode, stop on the updated default branch once closeout is complete
- in next-branch mode, create and switch to the requested new branch from the updated default branch
- require explicit approval for push and branch deletion

Branch naming notes for this repo:

- phase-oriented branch names remain the normal implementation pattern
- short-lived sub-branches are acceptable for substantial internal slices, but should merge back into the parent phase branch before `main`

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
- end with a concise four-column handover summary table emitted as a standalone Markdown block with a blank line before and after it
- add a short completion line after the table confirming the handed-over branch and commit

## Resume Workflow

Trigger: `resume` / `resume please`

Purpose: restore the intended work branch at start of day by consulting handover metadata first, preserving current local unpublished work when a safe branch switch would otherwise strand it, and reconciling only through non-destructive checkout and fast-forward operations.

Key safety rules:

- stop if `HEAD` is detached
- consult metadata before arbitrary branch-recency inference
- prefer metadata over an arbitrary clean non-default branch
- detect when switching to the handed-over branch would strand current local unpublished work
- ask for confirmation before creating any local-only preserve step during `resume`
- preserve dirty current-branch work with a local checkpoint before switching when that is safe
- preserve a clean-but-ahead current branch with a local rescue branch before switching when that is safe
- create a local tracking branch from remote when the intended branch is published but missing locally
- allow fast-forward only when the selected branch is clean and behind
- stop when preserve-local handling would require publication, when the selected branch is ahead or diverged, or when the state is otherwise ambiguous

## Status Workflow

Trigger: `status` / `status please`

Purpose: provide a read-only operator snapshot of the repo.

Behaviour:

- fetch remote state first
- the first user-visible output block must be a four-column table using `Origin`, `Local`, `Status`, and `Action(s)`
- emit that status table as a standalone Markdown block with a blank line before and after it
- include branch/upstream state, head commit, default-branch state, tag state, ahead/behind counts, working tree state, version source, metadata state, and whether `resume`, `publish`, `ship`, or `handover` is recommended
- include whether `checkpoint` is recommended when the working tree is dirty and the safest next step is local preservation
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
- changelog updated without a matching version bump

Abort must inspect first, propose recovery second, and execute only explicitly approved actions.

## Deploy Workflow

Trigger: `deploy` / `deploy please`

Purpose: build a runtime-ready artefact or install the desklet or GNOME extension safely for explicit local use.

General rules:

- stop if `HEAD` is detached
- require a clean working tree
- require a synced branch
- use the target-specific package script for explicit packaging or deploy work
- review packaging and install docs impact before mutating deployment targets
- validate the deployed result rather than merely copying files

Repo-specific deploy target:

### `cinnamon-user-local`

- build: `./scripts/package-desklet.sh`
- install: `./scripts/install-local-desklet.sh`
- post-deploy validation: confirm `~/.local/share/cinnamon/desklets/bandwidth-monitor@Ken24T/metadata.json` exists

### `gnome-user-local`

- build: `./scripts/package-gnome-extension.sh`
- install: `./scripts/install-gnome-extension.sh`
- post-deploy validation: confirm `~/.local/share/gnome-shell/extensions/bandwidth-monitor-gnome@Ken24T/metadata.json` and `~/.local/share/gnome-shell/extensions/bandwidth-monitor-gnome@Ken24T/schemas/gschemas.compiled` exist

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

- normal SHIP gate: `python3 -m json.tool metadata.json >/dev/null && python3 -m json.tool settings-schema.json >/dev/null`, then `./scripts/validate-desklet.sh`
- use `./scripts/package-desklet.sh` only when the user explicitly requests packaging or deployment work, or when the deploy workflow requires it
- docs/infra-only changes may skip heavyweight code gates according to `.github/TCTBP.json`, but still require editor diagnostics and docs impact assessment

Versioning rules:

- patch bump on every SHIP except docs-only or infrastructure-only changes
- first SHIP on a `phase-` or `feature/` branch gets a minor bump instead of a patch bump
- major bump only by explicit instruction
- apply version changes to `metadata.json` before committing

Tagging rules:

- use bare `X.Y.Z` tags without a `v` prefix
- one tag per shipped commit
- skip tagging when no version bump occurs

Docs impact rules:

- `README.md`, `docs/user-guide.md`, and `.github/bandwidth_monitor_desklet_specification.md` for user-visible or UI changes
- `scripts/install-local-desklet.sh`, `scripts/package-desklet.sh`, `scripts/install-gnome-extension.sh`, `scripts/package-gnome-extension.sh`, `docs/gnome-extension-user-guide.md`, `gnome-extension/metadata.json`, and `metadata.json` for install, packaging, or release metadata changes
- `docs/implementation-plan.md` for roadmap or release-status changes

## Repo-Specific Preservation Notes

When updating these workflow files, preserve the following local choices unless the user explicitly changes them:

- bare semver release tags such as `1.5.0`
- `metadata.json` as version source
- `./scripts/validate-desklet.sh` as the default SHIP verification gate
- `./scripts/package-desklet.sh` and `./scripts/package-gnome-extension.sh` only for explicit packaging or deploy work
- local Cinnamon installation via `./scripts/install-local-desklet.sh`
- local GNOME installation via `./scripts/install-gnome-extension.sh`
- phase-oriented branch naming for implementation work
- docs paths under `docs/` and `.github/bandwidth_monitor_desklet_specification.md`
- Australian English conventions
- Tests, lint, validation, packaging
- Commits and local tags
- Branch switching and merging
- **Non-destructive remote reads** (`fetch`, logs, diffs)

**Require Explicit Approval**

- Push (any remote)
- Delete branches
- Force push
- Rewrite history
- Modify remotes

**Clarification:** There is no concept of a "push to a local branch". Local commits are always allowed; any `git push` that updates a remote always requires approval.

---

## Failure Behaviour

On any failure:

- Stop immediately
- Explain the failure
- Propose safe recovery options (revert bump commit, delete local tag)
- Never rewrite history without approval

---

## Repo Notes

- Current target: **native Cinnamon/GJS desklet**
- Expected primary files: `desklet.js`, `metadata.json`, `settings-schema.json`, `stylesheet.css`
- Preferred data source: `/sys/class/net/<interface>/statistics/`
- Default version source once present: `metadata.json`
- Remote may not exist yet; all workflows must remain valid in a purely local repository
- Preferred implementation branch model: one branch per phase, with optional short-lived sub-branches for substantial phase-internal work

---

## Appendix: `TCTBP.json` (Indicative Template)

```json
{
  "schemaVersion": 1,
  "activation": {
    "triggers": ["ship", "ship please", "shipping", "tctbp", "prepare release", "handoff", "handoff please"],
    "caseInsensitive": true,
    "branchCommand": {
      "enabled": true,
      "pattern": "^branch\\s+(.+)$"
    }
  },
  "repository": {
    "mode": "local-first",
    "pullRequestsRequired": false,
    "pushRequiresRemote": true,
    "phaseBranching": {
      "default": "one-branch-per-phase",
      "allowSubBranchesForSignificantWork": true,
      "mergeCompletedPhaseToLocalMain": true,
      "askBeforeRemotePushAfterPhaseMerge": true
    }
  },
  "projectProfile": {
    "stack": "cinnamon-gjs-desklet",
    "primaryFiles": ["desklet.js", "metadata.json", "settings-schema.json", "stylesheet.css"],
    "versionFile": "metadata.json",
    "versionField": "version"
  },
  "workflow": {
    "order": ["preflight", "test", "problems", "bump", "commit", "tag", "push"],
    "requireApproval": ["push"]
  },
  "versioning": {
    "scheme": "semver",
    "patchEveryShip": true,
    "skipForChangeTypes": ["docs-only", "infrastructure-only"],
    "minorOnFirstShipOfBranch": true,
    "majorExplicitOnly": true
  },
  "tagging": {
    "policy": "everyCommit",
    "skipWhenNoBump": true,
    "format": "{version}"
  }
}
```

