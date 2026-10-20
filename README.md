# Git, from the start

A TanStack Start app that teaches Git to people who do not program. Nine basic lessons and eight advanced lessons use a family cookbook in plain text files as the example. The advanced part is for projects with many branches and many contributors. Each lesson has step-by-step demos with animated diagrams: a commit graph, the three areas (folder, staging area, repository), file contents, line diffs, and a remote next to your computer.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:3417
pnpm test       # simulator tests
pnpm build
```

## How it works

- `src/git/` is a small Git simulator in pure TypeScript. Each command takes a `World` and returns a new one. A lesson demo replays its steps from the start, so "Back" always shows the exact earlier state.
  - `core.ts`: types and shared helpers, including the line-level three-way merge and blame.
  - `basic.ts`: init, clone, status, add, commit (with `--amend`), log, diff, branch, switch, checkout, merge (with `--no-ff` and `--squash`), restore, revert, remote, push (with `--force-with-lease` and `--delete`), fetch (with `--prune`) and pull (with `--rebase`).
  - `advanced.ts`: stash, rebase, cherry-pick, reset, reflog, blame and bisect.
  - `sim.ts`: command dispatch, file edits, teammate actions and the reflog.
- `src/components/ScriptedDemo.tsx` plays a lesson script and shows the views that the lesson asks for.
- `src/components/CommitGraph.tsx` draws the animated graph. Each branch claims the commits on its first-parent line (main first), so a fast-forward moves the commits into the main row.
- `src/lessons/` has the lesson text and scripts. `registry.ts` sets the order. `scripts.test.ts` checks that every lesson step succeeds, or fails where the step says it should.

The simulator does not pause in the middle of a rebase, cherry-pick or stash pop with a conflict. It cancels the command and says so.
