# Git, from the start

A TanStack Start app that teaches Git to people who do not program. Nine lessons use a family cookbook in plain text files as the example. Each lesson has step-by-step demos with animated diagrams: a commit graph, the three areas (folder, staging area, repository), file contents, line diffs, and a remote next to your computer.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:3417
pnpm test       # simulator tests
pnpm build
```

## How it works

- `src/git/sim.ts` is a small Git simulator in pure TypeScript. Each command takes a `World` and returns a new one. A lesson demo replays its steps from the start, so "Back" always shows the exact earlier state.
- `src/components/ScriptedDemo.tsx` plays a lesson script and shows the views that the lesson asks for.
- `src/components/CommitGraph.tsx` draws the animated graph. Each branch claims the commits on its first-parent line (main first), so a fast-forward moves the commits into the main row.
- `src/lessons/` has the lesson text and scripts. `registry.ts` sets the order.
- The simulator covers the common commands only: init, clone, status, add, commit, log, diff, branch, switch, checkout, merge, restore, revert, remote, push, fetch and pull.
