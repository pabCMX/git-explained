import { rebase } from './advanced'
import {
  addCommit,
  ancestors,
  blockedMessage,
  checkoutTree,
  compare,
  currentBranch,
  DIRTY,
  fail,
  headId,
  headTree,
  isAncestor,
  isDirty,
  lineDiff,
  mergeBase,
  moveHead,
  moveTo,
  ok,
  patchLocal,
  refsAt,
  resolve,
  setRemoteBranch,
  status,
  threeWay,
  treeOf,
  type Change,
  type Result,
  type World,
} from './core'

export type Command = (w: World, args: string[]) => Result

export function init(w: World): Result {
  if (w.initialized) return ok(w, ['Reinitialized existing Git repository.'])
  return ok({ ...w, initialized: true }, ['Initialized empty Git repository in .git/'])
}

export function clone(w: World, args: string[]): Result {
  const url = args[0]
  if (!url) return fail(w, 'Tell Git what to clone: git clone <url>')
  if (w.initialized) return fail(w, 'This folder is already a Git repository.')
  if (!w.remote) return fail(w, `fatal: repository '${url}' not found`)
  const tracking = Object.fromEntries(Object.entries(w.remote.branches).map(([b, id]) => [`origin/${b}`, id]))
  const main = w.remote.branches.main
  const tree = treeOf(w, main)
  return ok(
    {
      ...w,
      initialized: true,
      local: {
        ...w.local,
        branches: main ? { main } : {},
        head: { kind: 'branch', name: 'main' },
        working: { ...tree },
        index: { ...tree },
        tracking,
        origin: w.remote.url,
      },
    },
    [`Cloning into '${url.split('/').pop()?.replace(/\.git$/, '')}'...`, 'done.'],
  )
}

const flags = (args: string[]) => new Set(args.filter((a) => a.startsWith('-')))
const names = (args: string[]) => args.filter((a) => !a.startsWith('-'))

export const BASIC: Record<string, Command> = {
  status: (w) => {
    const s = status(w)
    const b = currentBranch(w)
    const out = [b ? `On branch ${b}` : `HEAD detached at ${headId(w)}`]
    if (w.local.bisect) out.push('You are currently bisecting.')
    if (!headId(w)) out.push('', 'No commits yet')
    const up = b && w.local.tracking[`origin/${b}`]
    const mine = b ? w.local.branches[b] : undefined
    if (up && mine) {
      const ahead = [...ancestors(w, mine)].filter((id) => !isAncestor(w, id, up)).length
      const behind = [...ancestors(w, up)].filter((id) => !isAncestor(w, id, mine)).length
      if (ahead && behind) out.push(`Your branch and 'origin/${b}' have diverged.`)
      else if (ahead) out.push(`Your branch is ahead of 'origin/${b}' by ${ahead} commit${ahead > 1 ? 's' : ''}.`)
      else if (behind) out.push(`Your branch is behind 'origin/${b}' by ${behind} commit${behind > 1 ? 's' : ''}.`)
      else out.push(`Your branch is up to date with 'origin/${b}'.`)
    }
    if (w.local.merging) {
      out.push('', s.conflicted.length ? 'You have unmerged paths. Fix the conflicts, then "git add" and "git commit".' : 'All conflicts fixed. Run "git commit" to finish the merge.')
      for (const p of s.conflicted) out.push(`  both modified:   ${p}`)
    }
    const fmt = (c: Change) => `  ${(c.kind === 'new' ? 'new file' : c.kind) + ':'}`.padEnd(14) + c.path
    const staged = s.staged.filter((c) => !s.conflicted.includes(c.path))
    if (staged.length) out.push('', 'Changes to be committed:', ...staged.map(fmt))
    if (s.unstaged.length) out.push('', 'Changes not staged for commit:', ...s.unstaged.map(fmt))
    if (s.untracked.length) out.push('', 'Untracked files:', ...s.untracked.map((p) => `  ${p}`))
    if (!s.staged.length && !s.unstaged.length && !s.untracked.length) out.push('', 'nothing to commit, working tree clean')
    return ok(w, out)
  },

  add: (w, args) => {
    if (!args.length) return fail(w, 'Nothing specified, nothing added. Try "git add <file>" or "git add ."')
    const all = args.includes('.') || args.includes('-A') || args.includes('--all')
    const paths = all ? [...new Set([...Object.keys(w.local.working), ...Object.keys(w.local.index)])] : args
    const index = { ...w.local.index }
    for (const p of paths) {
      const content = w.local.working[p]
      if (content !== undefined) index[p] = content
      else if (p in index) delete index[p]
      else return fail(w, `fatal: pathspec '${p}' did not match any files`)
    }
    return ok(patchLocal(w, { index }))
  },

  commit: (w, args) => {
    let next = w
    if (args.includes('-a') || args.includes('-am')) {
      const index = { ...w.local.index }
      for (const p of Object.keys(index)) {
        const content = w.local.working[p]
        if (content === undefined) delete index[p]
        else index[p] = content
      }
      next = patchLocal(w, { index })
    }
    const mi = args.findIndex((a) => a === '-m' || a === '-am')
    const given = mi >= 0 ? args[mi + 1] : undefined
    if (args.includes('--amend')) return amend(next, given)
    const merging = next.local.merging
    const message = given ?? (merging ? `Merge branch '${merging.name}'` : undefined)
    if (!message) return fail(w, 'Please add a message: git commit -m "what you changed"')
    const s = status(next)
    if (s.conflicted.length) return fail(w, 'error: Committing is not possible because you have unmerged files.', ...s.conflicted.map((p) => `  ${p}`))
    if (!s.staged.length && !merging) {
      return fail(w, s.unstaged.length || s.untracked.length ? 'no changes added to commit (use "git add" first)' : 'nothing to commit, working tree clean')
    }
    const parent = headId(next)
    const parents = [parent, merging?.id].filter((p): p is string => !!p)
    const lane = currentBranch(next) ?? 'detached'
    const [w2, id] = addCommit(next, { parents, message, tree: { ...next.local.index }, lane })
    const w3 = patchLocal(moveHead(w2, id), { merging: null })
    const where = currentBranch(w3) ?? 'detached HEAD'
    return ok(w3, [`[${where}${parent ? '' : ' (root-commit)'} ${id}] ${message}`, `${s.staged.length} file${s.staged.length === 1 ? '' : 's'} changed`])
  },

  log: (w) => {
    const id = headId(w)
    if (!id) return fail(w, `fatal: your current branch '${currentBranch(w)}' does not have any commits yet`)
    const commits = [...ancestors(w, id)].map((c) => w.commits[c]!).sort((a, b) => b.order - a.order)
    return ok(
      w,
      commits.map((c) => {
        const refs = refsAt(w, c.id)
        return `${c.id}${refs.length ? ` (${refs.join(', ')})` : ''} ${c.message}`
      }),
    )
  },

  diff: (w, args) => {
    const staged = args.includes('--staged') || args.includes('--cached')
    const from = staged ? headTree(w) : w.local.index
    const to = staged ? w.local.index : w.local.working
    const changes = compare(from, to).filter((c) => staged || c.kind !== 'new')
    if (!changes.length) return ok(w, staged ? ['(nothing staged)'] : ['(no unstaged changes)'])
    const out: string[] = []
    for (const c of changes) {
      out.push(`--- ${c.path}`)
      for (const l of lineDiff(from[c.path] ?? '', to[c.path] ?? '')) {
        out.push(`${l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '} ${l.text}`)
      }
    }
    return ok(w, out)
  },

  branch: (w, args) => {
    const f = flags(args)
    const [name] = names(args)
    if (f.has('-d') || f.has('-D')) {
      if (!name || !(name in w.local.branches)) return fail(w, `error: branch '${name}' not found`)
      if (name === currentBranch(w)) return fail(w, `error: you cannot delete the branch you are on.`)
      const tip = w.local.branches[name]!
      const head = headId(w)
      if (f.has('-d') && head && !isAncestor(w, tip, head)) {
        return fail(w, `error: The branch '${name}' is not fully merged.`, `If you are sure you want to delete it, run 'git branch -D ${name}'.`)
      }
      const { [name]: _, ...rest } = w.local.branches
      return ok(patchLocal(w, { branches: rest }), [`Deleted branch ${name} (was ${tip}).`])
    }
    if (!name) {
      const cur = currentBranch(w)
      const local = Object.keys(w.local.branches).sort()
      if (!local.length) return ok(w, [`(no branches yet. Make a commit first.)`])
      const out = local.map((n) => `${n === cur ? '*' : ' '} ${n}`)
      if (f.has('-a')) out.push(...Object.keys(w.local.tracking).sort().map((t) => `  remotes/${t}`))
      return ok(w, out)
    }
    return createBranch(w, name, names(args)[1])
  },

  switch: (w, args) => {
    if (args[0] === '-c') {
      const r = createBranch(w, args[1] ?? '', args[2])
      return r.ok ? switchBranch(r.world, args[1]!) : r
    }
    return switchBranch(w, args[0] ?? '')
  },

  checkout: (w, args) => {
    if (args[0] === '-b') {
      const r = createBranch(w, args[1] ?? '')
      return r.ok ? switchBranch(r.world, args[1]!) : r
    }
    const ref = args[0] ?? ''
    if (ref in w.local.branches || `origin/${ref}` in w.local.tracking) return switchBranch(w, ref)
    const id = resolve(w, ref)
    if (!id) return fail(w, `error: '${ref}' is not a branch or a commit Git knows.`)
    const moved = moveTo(w, { kind: 'detached', id }, treeOf(w, id))
    if (Array.isArray(moved)) return fail(w, ...blockedMessage(moved))
    return ok(moved, [
      `HEAD is now at ${id} ${w.commits[id]!.message}`,
      `You are in 'detached HEAD' state. You can look around.`,
      `To go back, run: git switch main`,
    ])
  },

  merge: (w, args) => {
    const f = flags(args)
    if (f.has('--abort')) {
      if (!w.local.merging) return fail(w, 'There is no merge to abort.')
      return ok(checkoutTree(patchLocal(w, { merging: null }), headTree(w)), ['Merge aborted.'])
    }
    if (w.local.merging) return fail(w, 'You are in the middle of a merge. Fix the conflicts, then add and commit.')
    const name = names(args)[0] ?? ''
    const target = resolve(w, name)
    if (!target) return fail(w, `merge: ${name} - not something we can merge`)
    return merge(w, target, name, { noFF: f.has('--no-ff'), squash: f.has('--squash') })
  },

  restore: (w, args) => {
    const staged = args.includes('--staged')
    let paths = names(args)
    if (!paths.length) return fail(w, 'Tell Git which file: git restore <file>')
    if (paths.includes('.')) paths = [...new Set([...Object.keys(w.local.working), ...Object.keys(w.local.index)])]
    if (staged) return ok(unstage(w, paths))
    const working = { ...w.local.working }
    for (const p of paths) {
      if (p in w.local.index) working[p] = w.local.index[p]!
      else if (!args.includes('.')) return fail(w, `error: pathspec '${p}' did not match any file known to git`)
    }
    return ok(patchLocal(w, { working }))
  },

  revert: (w, args) => {
    const id = resolve(w, args[0] ?? '')
    const c = id ? w.commits[id] : undefined
    if (!c) return fail(w, `fatal: bad revision '${args[0] ?? ''}'`)
    if (isDirty(w) || w.local.merging) return fail(w, DIRTY)
    if (c.parents.length !== 1) return fail(w, 'This simulator can only revert normal commits, not merges or the first commit.')
    const before = treeOf(w, c.parents[0])
    const tree = { ...headTree(w) }
    for (const ch of compare(before, c.tree)) {
      if (tree[ch.path] !== c.tree[ch.path]) return fail(w, `error: could not revert ${c.id}. ${ch.path} changed again after that commit.`)
      if (ch.path in before) tree[ch.path] = before[ch.path]!
      else delete tree[ch.path]
    }
    const message = `Revert "${c.message}"`
    const [w2, nid] = addCommit(w, { parents: [headId(w)!], message, tree, lane: currentBranch(w) ?? 'detached' })
    return ok(checkoutTree(moveHead(w2, nid), tree), [`[${currentBranch(w) ?? 'detached HEAD'} ${nid}] ${message}`])
  },

  remote: (w, args) => {
    if (args[0] === 'add') {
      const url = args[2]
      if (args[1] !== 'origin' || !url) return fail(w, 'Use: git remote add origin <url>')
      if (w.local.origin) return fail(w, 'error: remote origin already exists.')
      return ok({ ...patchLocal(w, { origin: url }), remote: w.remote ?? { url, branches: {} } })
    }
    return ok(w, w.local.origin ? [args[0] === '-v' ? `origin  ${w.local.origin}` : 'origin'] : [])
  },

  push: (w, args) => {
    if (!w.local.origin || !w.remote) return fail(w, 'fatal: No remote is set up. Use "git remote add origin <url>" first.')
    const f = flags(args)
    const branch = names(args)[1] ?? currentBranch(w)
    if (f.has('--delete') || f.has('-d')) {
      if (!branch || !(branch in w.remote.branches)) return fail(w, `error: unable to delete '${branch}': remote ref does not exist`)
      const { [`origin/${branch}`]: _, ...tracking } = w.local.tracking
      return ok(patchLocal(setRemoteBranch(w, branch, null), { tracking }), [`To ${w.remote.url}`, ` - [deleted]  ${branch}`])
    }
    const mine = branch ? w.local.branches[branch] : undefined
    if (!branch || !mine) return fail(w, 'error: there is nothing to push yet.')
    const theirs = w.remote.branches[branch]
    if (theirs === mine) return ok(w, ['Everything up-to-date'])
    const fastForward = !theirs || isAncestor(w, theirs, mine)
    if (!fastForward) {
      if (f.has('--force-with-lease') && theirs !== w.local.tracking[`origin/${branch}`]) {
        return fail(w, `! [rejected]  ${branch} -> ${branch} (stale info)`, 'The remote changed since your last fetch. Someone pushed work that you have not seen.')
      }
      if (!f.has('--force') && !f.has('-f') && !f.has('--force-with-lease')) {
        return fail(w, `! [rejected]  ${branch} -> ${branch} (fetch first)`, 'The remote has commits that you do not have. Run "git pull" first.')
      }
    }
    const next = patchLocal(setRemoteBranch(w, branch, mine), { tracking: { ...w.local.tracking, [`origin/${branch}`]: mine } })
    const line = !theirs
      ? ` * [new branch]  ${branch} -> ${branch}`
      : fastForward
        ? `   ${theirs}..${mine}  ${branch} -> ${branch}`
        : ` + ${theirs}...${mine}  ${branch} -> ${branch} (forced update)`
    return ok(next, [`To ${w.remote.url}`, line])
  },

  fetch: (w, args) => fetch(w, args.includes('--prune') || args.includes('-p')),

  pull: (w, args) => {
    const f = fetch(w, false)
    if (!f.ok) return f
    const b = currentBranch(f.world)
    const up = b ? f.world.local.tracking[`origin/${b}`] : undefined
    if (!b || !up) return fail(f.world, 'There is no branch on the remote to pull from.')
    const m = args.includes('--rebase') ? rebase(f.world, up) : merge(f.world, up, `origin/${b}`)
    return { ...m, output: [...f.output, ...m.output] }
  },
}

function amend(w: World, message: string | undefined): Result {
  const id = headId(w)
  const c = id ? w.commits[id] : undefined
  if (!c) return fail(w, 'fatal: there is no commit to amend yet.')
  const [w2, nid] = addCommit(w, {
    parents: c.parents,
    message: message ?? c.message,
    author: c.author,
    tree: { ...w.local.index },
    lane: currentBranch(w) ?? 'detached',
  })
  return ok(moveHead(w2, nid), [`[${currentBranch(w) ?? 'detached HEAD'} ${nid}] ${message ?? c.message}`, `(replaces ${c.id})`])
}

export function unstage(w: World, paths: string[]): World {
  const index = { ...w.local.index }
  const tree = headTree(w)
  for (const p of paths) {
    if (p in tree) index[p] = tree[p]!
    else delete index[p]
  }
  return patchLocal(w, { index })
}

// Makes a branch at HEAD, or at `start` if given.
function createBranch(w: World, name: string, start?: string): Result {
  if (!name) return fail(w, 'Give the branch a name: git branch <name>')
  if (name in w.local.branches) return fail(w, `fatal: a branch named '${name}' already exists`)
  const id = start ? resolve(w, start) : headId(w)
  if (start && !id) return fail(w, `fatal: not a valid object name: '${start}'`)
  if (!id) return fail(w, `fatal: make a commit first. A branch must point at a commit.`)
  return ok(patchLocal(w, { branches: { ...w.local.branches, [name]: id } }))
}

function switchBranch(w: World, name: string): Result {
  let next = w
  const out: string[] = []
  if (!(name in w.local.branches)) {
    // Like real Git: switching to "feature" makes a local branch from origin/feature, if there is one.
    const remoteId = w.local.tracking[`origin/${name}`]
    if (!remoteId) return fail(w, `fatal: invalid reference: ${name}`)
    next = patchLocal(w, { branches: { ...w.local.branches, [name]: remoteId } })
    out.push(`branch '${name}' set up to track 'origin/${name}'.`)
  }
  if (currentBranch(next) === name) return ok(next, [`Already on '${name}'`])
  const moved = moveTo(next, { kind: 'branch', name }, treeOf(next, next.local.branches[name]))
  if (Array.isArray(moved)) return fail(w, ...blockedMessage(moved))
  return ok(moved, [...out, `Switched to branch '${name}'`])
}

type MergeOptions = { noFF?: boolean; squash?: boolean }

export function merge(w: World, target: string, name: string, opts: MergeOptions = {}): Result {
  const cur = headId(w)
  if (!cur) return fail(w, 'fatal: make a commit before you merge.')
  if (isDirty(w)) return fail(w, DIRTY)
  if (isAncestor(w, target, cur)) return ok(w, ['Already up to date.'])
  const canFastForward = isAncestor(w, cur, target)
  const result = canFastForward
    ? { tree: treeOf(w, target), conflicts: [] }
    : threeWay(treeOf(w, mergeBase(w, cur, target)), treeOf(w, cur), treeOf(w, target), name)
  const out = result.conflicts.flatMap((p) => [`Auto-merging ${p}`, `CONFLICT (content): Merge conflict in ${p}`])

  if (opts.squash) {
    if (result.conflicts.length) return fail(w, ...out, 'This simulator stops a squash merge with conflicts. Nothing changed.')
    return ok(checkoutTree(w, result.tree), ['Squash commit -- not updating HEAD', 'Automatic merge went well. The changes are staged. Now run git commit.'])
  }
  if (canFastForward && !opts.noFF) {
    return ok(checkoutTree(moveHead(w, target), treeOf(w, target)), [`Updating ${cur}..${target}`, 'Fast-forward'])
  }
  if (result.conflicts.length) {
    const next = patchLocal(checkoutTree(w, result.tree), { merging: { id: target, name } })
    return fail(next, ...out, 'Automatic merge failed. Fix the conflicts, then commit the result.')
  }
  const lane = currentBranch(w) ?? 'detached'
  const [w2, id] = addCommit(w, { parents: [cur, target], message: `Merge branch '${name}'`, tree: result.tree, lane })
  return ok(checkoutTree(moveHead(w2, id), result.tree), [...out, "Merge made by the 'ort' strategy."])
}

function fetch(w: World, prune: boolean): Result {
  if (!w.local.origin || !w.remote) return fail(w, 'fatal: No remote is set up.')
  const out: string[] = []
  const tracking = { ...w.local.tracking }
  for (const [b, id] of Object.entries(w.remote.branches)) {
    const key = `origin/${b}`
    if (tracking[key] !== id) out.push(tracking[key] ? `   ${tracking[key]}..${id}  ${b} -> ${key}` : ` * [new branch]  ${b} -> ${key}`)
    tracking[key] = id
  }
  if (prune) {
    for (const key of Object.keys(tracking)) {
      if (!(key.slice('origin/'.length) in w.remote.branches)) {
        delete tracking[key]
        out.push(` - [deleted]  (none) -> ${key}`)
      }
    }
  }
  return ok(patchLocal(w, { tracking }), out.length ? [`From ${w.remote.url}`, ...out] : [])
}
