# Git, from the start

A TanStack Start app that teaches Git to people who do not program. Nine basic lessons and eight advanced lessons use a family cookbook in plain text files as the example. The advanced part is for projects with many branches and many contributors. Each lesson has exercises with animated diagrams: a commit graph, the three areas (folder, staging area, repository), file contents, line diffs, and a remote next to your computer. In an exercise the reader first types each command with a guide. Then they do the same steps from a task list without the commands, and "Check my work" compares their result with the goal.

## Run it

```sh
pnpm install
pnpm dev        # http://localhost:3417
pnpm test       # simulator tests
pnpm build      # static site in dist/client
pnpm preview    # serve the build locally
```

## Host it

`pnpm build` prerenders every page to static HTML in `dist/client`. Any static host works, for example Netlify, Vercel or Cloudflare Pages: build command `pnpm build`, output folder `dist/client`. The site expects to be served from the root of a domain, not from a subpath.

## How it works

- `src/git/` is a small Git simulator in pure TypeScript. Each command takes a `World` and returns a new one. An exercise replays its steps from the start, so "Back" always shows the exact earlier state.
  - `core.ts`: types and shared helpers, including the line-level three-way merge and blame.
  - `basic.ts`: init, clone, status, add, commit (with `--amend`), log, diff, branch, switch, checkout, merge (with `--no-ff` and `--squash`), restore, revert, remote, push (with `--force-with-lease` and `--delete`), fetch (with `--prune`) and pull (with `--rebase`).
  - `advanced.ts`: stash, rebase, cherry-pick, reset, reflog, blame and bisect.
  - `sim.ts`: command dispatch, file edits, teammate actions and the reflog.
  - `check.ts`: compares the reader's end state with the goal for "Check my work". Commit ids and messages do not count.
- `src/components/Exercise.tsx` runs a lesson script in two rounds, guided and on your own, and shows the views that the lesson asks for. `Terminal.tsx` is the terminal for the exercises and the playground.
- `src/components/Page.tsx` has the shared page frame, header and card styles.
- `src/components/CommitGraph.tsx` draws the animated graph. Each branch claims the commits on its first-parent line (main first), so a fast-forward moves the commits into the main row.
- `src/lessons/` has the lesson text and scripts. `registry.ts` sets the order. `scripts.test.ts` checks that every lesson step succeeds, or fails where the step says it should, that every step with a command has a task, and that other commit messages still pass the check.

The simulator does not pause in the middle of a rebase, cherry-pick or stash pop with a conflict. It cancels the command and says so.
