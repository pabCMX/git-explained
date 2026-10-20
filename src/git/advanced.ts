import type { Command } from './basic'
import {
  addCommit,
  ancestors,
  blame,
  checkoutTree,
  compare,
  currentBranch,
  DIRTY,
  fail,
  headId,
  headTree,
  isAncestor,
  isDirty,
  moveHead,
  ok,
  patchLocal,
  resolve,
  status,
  threeWay,
  treeOf,
  type Bisect,
  type Files,
  type Result,
  type StashEntry,
  type World,
} from './core'

const STOPPED = 'This simulator cannot pause in the middle, so it cancelled the command. Nothing changed.'

/**
 * Replays the commits of the current branch on top of `onto`, one by one, as new commits.
 * The old commits are not deleted, but no label points at them anymore.
 */
export function rebase(w: World, onto: string): Result {
  const cur = headId(w)
  const branch = currentBranch(w)
  if (!cur || !branch) return fail(w, 'fatal: rebase needs a branch with commits.')
  if (isDirty(w)) return fail(w, DIRTY)
  if (isAncestor(w, onto, cur)) return ok(w, [`Current branch ${branch} is up to date.`])
  if (isAncestor(w, cur, onto)) {
    return ok(checkoutTree(moveHead(w, onto), treeOf(w, onto)), [`Fast-forwarded ${branch} to ${onto}.`])
  }
  const base = ancestors(w, onto)
  const todo = [...ancestors(w, cur)]
    .map((id) => w.commits[id]!)
    .filter((c) => !base.has(c.id) && c.parents.length === 1)
    .sort((a, b) => a.order - b.order)
  let next = w
  let tip = onto
  const out: string[] = []
  for (const c of todo) {
    const r = threeWay(treeOf(w, c.parents[0]), treeOf(next, tip), c.tree, c.id)
    if (r.conflicts.length) {
      return fail(w, ...r.conflicts.map((p) => `CONFLICT (content): Merge conflict in ${p}`), `error: could not apply ${c.id} ${c.message}`, 'In real Git you fix the file, run "git add", then "git rebase --continue".', STOPPED)
    }
    if (!compare(treeOf(next, tip), r.tree).length) {
      out.push(`skipped ${c.id} ${c.message} (the change is already there)`)
      continue
    }
    ;[next, tip] = addCommit(next, { parents: [tip], message: c.message, author: c.author, tree: r.tree, lane: branch })
  }
  return ok(checkoutTree(moveHead(next, tip), treeOf(next, tip)), [...out, `Successfully rebased and updated refs/heads/${branch}.`])
}

function stashPush(w: World, args: string[]): Result {
  const s = status(w)
  const withUntracked = args.includes('-u') || args.includes('--include-untracked')
  const tracked = [...new Set([...s.staged, ...s.unstaged].map((c) => c.path))]
  const untracked = withUntracked ? s.untracked : []
  const id = headId(w)
  if (!id) return fail(w, 'You do not have the initial commit yet.')
  if (!tracked.length && !untracked.length) return fail(w, 'No local changes to save')
  const files: StashEntry['files'] = {}
  for (const p of tracked) files[p] = { content: w.local.working[p] ?? null, untracked: false }
  for (const p of untracked) files[p] = { content: w.local.working[p]!, untracked: true }
  const mi = args.indexOf('-m')
  const label = mi >= 0 ? args[mi + 1] : `${id} ${w.commits[id]!.message}`
  const message = `${mi >= 0 ? 'On' : 'WIP on'} ${currentBranch(w) ?? '(no branch)'}: ${label}`
  // Back to the last commit. Untracked files that were not stashed stay.
  const keep = Object.fromEntries(Object.entries(w.local.working).filter(([p]) => !(p in w.local.index) && !untracked.includes(p)))
  const tree = headTree(w)
  const next = patchLocal(w, { working: { ...keep, ...tree }, index: { ...tree }, stash: [{ message, base: id, files }, ...w.local.stash] })
  return ok(next, [`Saved working directory and index state ${message}`])
}

// A snapshot with one file, or none if the file does not exist.
const one = (path: string, content: string | undefined): Files => (content === undefined ? {} : { [path]: content })

// Puts a stash back on top of the current files. Files that also changed since the stash are merged.
function stashApply(w: World, entry: StashEntry): Result {
  const baseTree = treeOf(w, entry.base)
  const working = { ...w.local.working }
  const index = { ...w.local.index }
  for (const [p, f] of Object.entries(entry.files)) {
    if (f.untracked) {
      if (p in working) return fail(w, `error: ${p} already exists, so the stash cannot put it back.`)
      working[p] = f.content!
      continue
    }
    if (w.local.working[p] !== w.local.index[p]) return fail(w, `error: Your local changes to ${p} would be overwritten. Commit or stash them first.`)
    const r = threeWay(one(p, baseTree[p]), one(p, working[p]), one(p, f.content ?? undefined), 'stash')
    if (r.conflicts.length) return fail(w, `CONFLICT (content): Merge conflict in ${p}`, STOPPED)
    const content = r.tree[p]
    // Like "git stash pop" without --index: a deletion comes back as an unstaged deletion.
    if (content === undefined) delete working[p]
    else {
      working[p] = content
      // A new file that was tracked before the stash is tracked again.
      if (!(p in index)) index[p] = content
    }
  }
  return ok(patchLocal(w, { working, index }))
}

const stash: Command = (w, args) => {
  const sub = args[0] && !args[0].startsWith('-') ? args[0] : 'push'
  const rest = sub === 'push' && args[0] === 'push' ? args.slice(1) : args
  if (sub === 'push') return stashPush(w, rest)
  if (sub === 'list') return ok(w, w.local.stash.map((s, i) => `stash@{${i}}: ${s.message}`))
  const top = w.local.stash[0]
  if (!top) return fail(w, 'No stash entries found.')
  if (sub === 'drop') return ok(patchLocal(w, { stash: w.local.stash.slice(1) }), ['Dropped refs/stash@{0}'])
  if (sub !== 'pop' && sub !== 'apply') return fail(w, `Unknown stash command '${sub}'. Try push, list, pop, apply or drop.`)
  const r = stashApply(w, top)
  if (!r.ok || sub === 'apply') return r
  return ok(patchLocal(r.world, { stash: w.local.stash.slice(1) }), ['Changes are back in your folder.', `Dropped refs/stash@{0}`])
}

const cherryPick: Command = (w, args) => {
  const id = resolve(w, args[0] ?? '')
  const c = id ? w.commits[id] : undefined
  const cur = headId(w)
  if (!c || !cur) return fail(w, `fatal: bad revision '${args[0] ?? ''}'`)
  if (c.parents.length !== 1) return fail(w, 'This simulator can only cherry-pick normal commits, not merges or the first commit.')
  if (isDirty(w)) return fail(w, DIRTY)
  const r = threeWay(treeOf(w, c.parents[0]), headTree(w), c.tree, c.id)
  if (r.conflicts.length) return fail(w, ...r.conflicts.map((p) => `CONFLICT (content): Merge conflict in ${p}`), 'In real Git you fix the file, run "git add", then "git cherry-pick --continue".', STOPPED)
  if (!compare(headTree(w), r.tree).length) return fail(w, 'The change is already on this branch. Nothing to commit.')
  const branch = currentBranch(w)
  const [w2, nid] = addCommit(w, { parents: [cur], message: c.message, author: c.author, tree: r.tree, lane: branch ?? 'detached' })
  return ok(checkoutTree(moveHead(w2, nid), r.tree), [`[${branch ?? 'detached HEAD'} ${nid}] ${c.message}`, `(copy of ${c.id})`])
}

const reset: Command = (w, args) => {
  const mode = args.includes('--soft') ? 'soft' : args.includes('--hard') ? 'hard' : 'mixed'
  const ref = args.find((a) => !a.startsWith('-')) ?? 'HEAD'
  const id = resolve(w, ref)
  if (!id) {
    // "git reset <file>" takes the file out of the staging area.
    if (ref in w.local.index || ref in headTree(w)) {
      const tree = headTree(w)
      const index = { ...w.local.index }
      if (ref in tree) index[ref] = tree[ref]!
      else delete index[ref]
      return ok(patchLocal(w, { index }))
    }
    return fail(w, `fatal: ambiguous argument '${ref}': not a commit or a file.`)
  }
  const tree = treeOf(w, id)
  const moved = patchLocal(moveHead(w, id), { merging: null })
  if (mode === 'soft') return ok(moved, [`HEAD is now at ${id}. The staging area and your folder did not change.`])
  if (mode === 'hard') return ok(checkoutTree(moved, tree), [`HEAD is now at ${id} ${w.commits[id]!.message}`])
  const next = patchLocal(moved, { index: { ...tree } })
  const unstaged = status(next).unstaged
  return ok(next, unstaged.length ? ['Unstaged changes after reset:', ...unstaged.map((c) => `M\t${c.path}`)] : [])
}

const reflog: Command = (w) => {
  if (!w.local.reflog.length) return ok(w, ['(the reflog is empty)'])
  return ok(w, w.local.reflog.map((e, i) => `${e.id} HEAD@{${i}}: ${e.message}`))
}

const blameCmd: Command = (w, args) => {
  const path = args.find((a) => !a.startsWith('-'))
  const id = headId(w)
  if (!path || !id) return fail(w, 'Use: git blame <file>')
  if (!(path in headTree(w))) return fail(w, `fatal: no such path '${path}' in HEAD`)
  return ok(
    w,
    blame(w, id, path).map((l) => `${l.commit.id} (${l.commit.author.padEnd(3)}) ${l.text}`),
  )
}

/**
 * The commits that are still suspects: they come after every good commit and at or before the bad one.
 * Bisect checks out the middle one, so each answer removes half of the suspects.
 */
export function bisectSuspects(w: World, b: Bisect): string[] {
  if (!b.bad) return []
  const cleared = new Set(b.good.flatMap((g) => [...ancestors(w, g)]))
  return [...ancestors(w, b.bad)]
    .filter((id) => !cleared.has(id))
    .sort((x, y) => w.commits[x]!.order - w.commits[y]!.order)
}

function bisectNext(w: World, b: Bisect): Result {
  const next = patchLocal(w, { bisect: b })
  if (!b.bad || !b.good.length) return ok(next, [`status: waiting for ${!b.bad ? 'a bad' : 'a good'} commit`])
  const suspects = bisectSuspects(w, b)
  if (suspects.length === 1) {
    const c = w.commits[suspects[0]!]!
    return ok(patchLocal(w, { bisect: { ...b, found: c.id } }), [`${c.id} is the first bad commit`, `    ${c.message} (${c.author})`, 'Run "git bisect reset" to go back.'])
  }
  const candidates = suspects.slice(0, -1)
  const pick = candidates[Math.floor((candidates.length - 1) / 2)]!
  const left = suspects.length - 1
  const moved = checkoutTree(patchLocal(next, { head: { kind: 'detached', id: pick } }), treeOf(w, pick))
  return ok(moved, [
    `Bisecting: ${Math.floor(left / 2)} revisions left to test after this (roughly ${Math.ceil(Math.log2(left + 1)) - 1} steps)`,
    `[${pick}] ${w.commits[pick]!.message}`,
  ])
}

const bisect: Command = (w, args) => {
  const [sub, ref] = args
  const b = w.local.bisect
  if (sub === 'start') {
    if (isDirty(w)) return fail(w, DIRTY)
    return ok(patchLocal(w, { bisect: { good: [], bad: null, start: w.local.head, found: null } }), ['status: waiting for both good and bad commits'])
  }
  if (!b) return fail(w, 'You need to start by "git bisect start".')
  if (sub === 'reset') {
    const start = b.start
    const back = patchLocal(w, { head: start, bisect: null })
    const id = start.kind === 'branch' ? w.local.branches[start.name] : start.id
    return ok(checkoutTree(back, treeOf(w, id)), [`Back on ${start.kind === 'branch' ? `branch '${start.name}'` : id}.`])
  }
  if (sub !== 'good' && sub !== 'bad') return fail(w, `Unknown bisect command '${sub}'. Try start, good, bad or reset.`)
  if (b.found) return fail(w, 'Bisect already found the commit. Run "git bisect reset".')
  const id = resolve(w, ref ?? 'HEAD')
  if (!id) return fail(w, `fatal: bad revision '${ref}'`)
  return bisectNext(w, sub === 'bad' ? { ...b, bad: id } : { ...b, good: [...b.good, id] })
}

export const ADVANCED: Record<string, Command> = {
  stash,
  rebase: (w, args) => {
    const name = args.find((a) => !a.startsWith('-')) ?? ''
    const onto = resolve(w, name)
    if (!onto) return fail(w, `fatal: invalid upstream '${name}'`)
    return rebase(w, onto)
  },
  'cherry-pick': cherryPick,
  reset,
  reflog,
  blame: blameCmd,
  bisect,
}
