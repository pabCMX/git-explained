// Types and shared helpers for the Git simulator. Every function is pure: it takes a World and returns a new World.

export type Files = Record<string, string>

export type Commit = {
  id: string
  parents: string[]
  message: string
  author: string
  tree: Files
  // Branch name at the time of the commit. The graph uses it when no label reaches the commit.
  lane: string
  order: number
}

export type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string }

// One saved stash. null content means the file was deleted.
export type StashEntry = {
  message: string
  base: string
  files: Record<string, { content: string | null; untracked: boolean }>
}

export type Bisect = { good: string[]; bad: string | null; start: Head; found: string | null }

export type Local = {
  branches: Record<string, string>
  head: Head
  working: Files
  index: Files
  merging: { id: string; name: string } | null
  // Last known position of the remote branches, for example "origin/main".
  tracking: Record<string, string>
  origin: string | null
  stash: StashEntry[]
  // Where HEAD has been, newest first. "git reflog" prints it.
  reflog: { id: string; message: string }[]
  bisect: Bisect | null
}

export type Remote = { url: string; branches: Record<string, string> }

export type World = {
  initialized: boolean
  // One store for all commits. Each side only "has" the commits it can reach from its refs.
  commits: Record<string, Commit>
  local: Local
  remote: Remote | null
  counter: number
}

export type Result = { world: World; output: string[]; ok: boolean }

export type Change = { path: string; kind: 'new' | 'modified' | 'deleted' }

export const YOU = 'You'
export const SAM = 'Sam'

/** Makes a folder of files that Git does not track yet. */
export function emptyWorld(files: Files = {}): World {
  return {
    initialized: false,
    commits: {},
    local: {
      branches: {},
      head: { kind: 'branch', name: 'main' },
      working: files,
      index: {},
      merging: null,
      tracking: {},
      origin: null,
      stash: [],
      reflog: [],
      bisect: null,
    },
    remote: null,
    counter: 0,
  }
}

/** Short stable hash. Same input always gives the same 7 characters, so replays match. */
export function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let h2 = h ^ 0x5bd1e995
  h2 = Math.imul(h2 ^ (h2 >>> 15), 0x2c1b3c6d)
  return ((h >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16)).slice(0, 7)
}

export function headId(w: World): string | undefined {
  const h = w.local.head
  return h.kind === 'branch' ? w.local.branches[h.name] : h.id
}

export function currentBranch(w: World): string | null {
  return w.local.head.kind === 'branch' ? w.local.head.name : null
}

export function treeOf(w: World, id: string | undefined): Files {
  return id ? (w.commits[id]?.tree ?? {}) : {}
}

export function headTree(w: World): Files {
  return treeOf(w, headId(w))
}

/** Lists what changed from one set of files to another. */
export function compare(from: Files, to: Files): Change[] {
  const paths = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort()
  const out: Change[] = []
  for (const path of paths) {
    const a = from[path]
    const b = to[path]
    if (a === b) continue
    out.push({ path, kind: a === undefined ? 'new' : b === undefined ? 'deleted' : 'modified' })
  }
  return out
}

/** The lists that "git status" prints. */
export function status(w: World) {
  const { working, index } = w.local
  const staged = compare(headTree(w), index)
  const unstaged = compare(index, working).filter((c) => c.kind !== 'new')
  const untracked = Object.keys(working)
    .filter((p) => !(p in index))
    .sort()
  const conflicted = Object.keys(index).filter((p) => index[p]?.includes('<<<<<<<'))
  return { staged, unstaged, untracked, conflicted }
}

export function isDirty(w: World) {
  const s = status(w)
  return s.staged.length > 0 || s.unstaged.length > 0
}

/** All commits reachable from id, including id. */
export function ancestors(w: World, id: string | undefined): Set<string> {
  const seen = new Set<string>()
  const stack = id ? [id] : []
  while (stack.length) {
    const c = stack.pop()!
    if (seen.has(c)) continue
    seen.add(c)
    stack.push(...(w.commits[c]?.parents ?? []))
  }
  return seen
}

export function isAncestor(w: World, a: string, b: string) {
  return ancestors(w, b).has(a)
}

export function mergeBase(w: World, a: string, b: string): string | undefined {
  const fromA = ancestors(w, a)
  let best: Commit | undefined
  for (const id of ancestors(w, b)) {
    const c = w.commits[id]
    if (fromA.has(id) && c && (!best || c.order > best.order)) best = c
  }
  return best?.id
}

/** Turns "main", "origin/main", "HEAD~1", "HEAD@{2}" or a short id into a commit id. */
export function resolve(w: World, ref: string): string | undefined {
  const tilde = ref.match(/^(.+)~(\d+)$/)
  if (tilde) {
    let id = resolve(w, tilde[1]!)
    for (let i = 0; i < Number(tilde[2]); i++) id = id ? w.commits[id]?.parents[0] : undefined
    return id
  }
  const at = ref.match(/^HEAD@\{(\d+)\}$/)
  if (at) return w.local.reflog[Number(at[1])]?.id
  if (ref === 'HEAD') return headId(w)
  if (ref in w.local.branches) return w.local.branches[ref]
  if (ref in w.local.tracking) return w.local.tracking[ref]
  if (ref.length >= 4) {
    // Commits that no label reaches are still found here, if the reflog knows them.
    const known = ancestorsOfLocalRefs(w)
    for (const e of w.local.reflog) for (const a of ancestors(w, e.id)) known.add(a)
    return [...known].find((id) => id.startsWith(ref))
  }
  return undefined
}

/** Commits this computer has. Commits that only exist on the remote are not included. */
export function ancestorsOfLocalRefs(w: World): Set<string> {
  const ids = [...Object.values(w.local.branches), ...Object.values(w.local.tracking), headId(w), w.local.merging?.id]
  const out = new Set<string>()
  for (const id of ids) for (const a of ancestors(w, id)) out.add(a)
  return out
}

export function ancestorsOfRemote(w: World): Set<string> {
  const out = new Set<string>()
  for (const id of Object.values(w.remote?.branches ?? {})) for (const a of ancestors(w, id)) out.add(a)
  return out
}

export function addCommit(w: World, c: Omit<Commit, 'id' | 'order' | 'author'> & { author?: string }): [World, string] {
  const order = w.counter + 1
  const id = hash(`${order}|${c.message}|${c.parents.join(',')}|${JSON.stringify(c.tree)}`)
  return [{ ...w, counter: order, commits: { ...w.commits, [id]: { author: YOU, ...c, id, order } } }, id]
}

export function patchLocal(w: World, patch: Partial<Local>): World {
  return { ...w, local: { ...w.local, ...patch } }
}

export function setRemoteBranch(w: World, branch: string, id: string | null): World {
  if (!w.remote) return w
  const branches = { ...w.remote.branches }
  if (id) branches[branch] = id
  else delete branches[branch]
  return { ...w, remote: { ...w.remote, branches } }
}

/** Moves the current branch to id. If HEAD is detached, moves HEAD itself. */
export function moveHead(w: World, id: string): World {
  const h = w.local.head
  return h.kind === 'branch'
    ? patchLocal(w, { branches: { ...w.local.branches, [h.name]: id } })
    : patchLocal(w, { head: { kind: 'detached', id } })
}

/** Puts the files of a snapshot into the folder and the staging area. Untracked files stay. */
export function checkoutTree(w: World, tree: Files): World {
  const untracked = Object.fromEntries(Object.entries(w.local.working).filter(([p]) => !(p in w.local.index) && !(p in tree)))
  return patchLocal(w, { working: { ...untracked, ...tree }, index: { ...tree } })
}

/**
 * Moves HEAD to another snapshot, like switch and checkout. Uncommitted changes come along,
 * unless the move would overwrite them. Then it returns the files in the way.
 */
export function moveTo(w: World, head: Head, tree: Files): World | string[] {
  const s = status(w)
  const cur = headTree(w)
  const dirty = [...new Set([...s.staged, ...s.unstaged].map((c) => c.path))]
  const blocked = dirty.filter((p) => cur[p] !== tree[p])
  if (blocked.length) return blocked
  const moved = checkoutTree(patchLocal(w, { head }), tree)
  const working = { ...moved.local.working }
  const index = { ...moved.local.index }
  for (const p of dirty) {
    const wv = w.local.working[p]
    const iv = w.local.index[p]
    if (wv === undefined) delete working[p]
    else working[p] = wv
    if (iv === undefined) delete index[p]
    else index[p] = iv
  }
  return patchLocal(moved, { working, index })
}

export const blockedMessage = (paths: string[]) => [
  'error: Your local changes to these files would be overwritten:',
  ...paths.map((p) => `  ${p}`),
  'Commit them or stash them first.',
]

export const DIRTY = 'error: You have changes that are not committed. Commit them or stash them first.'

export const ok = (world: World, output: string[] = []): Result => ({ world, output, ok: true })
export const fail = (world: World, ...output: string[]): Result => ({ world, output, ok: false })

/**
 * Three-way merge of two snapshots that share a base. A file that only one side changed takes that
 * change. A file that both sides changed in different ways is a conflict and gets markers.
 */
export function threeWay(base: Files, ours: Files, theirs: Files, label: string) {
  const tree: Files = {}
  const conflicts: string[] = []
  for (const p of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const o = ours[p]
    const t = theirs[p]
    const b = base[p]
    let result: string | undefined
    if (o === t) result = o
    else if (o === b) result = t
    else if (t === b) result = o
    else {
      conflicts.push(p)
      result = conflictText(o ?? '', t ?? '', label)
    }
    if (result !== undefined) tree[p] = result
  }
  return { tree, conflicts }
}

// Like real Git, only the lines that both sides changed get conflict markers.
function conflictText(ours: string, theirs: string, name: string): string {
  const o = splitLines(ours)
  const t = splitLines(theirs)
  let start = 0
  while (start < o.length && start < t.length && o[start] === t[start]) start++
  let end = 0
  while (end < o.length - start && end < t.length - start && o[o.length - 1 - end] === t[t.length - 1 - end]) end++
  return [
    ...o.slice(0, start),
    '<<<<<<< HEAD',
    ...o.slice(start, o.length - end),
    '=======',
    ...t.slice(start, t.length - end),
    `>>>>>>> ${name}`,
    ...o.slice(o.length - end),
  ].join('\n')
}

/** Refs that point at a commit, for labels such as "HEAD -> main, origin/main". */
export function refsAt(w: World, id: string): string[] {
  const cur = currentBranch(w)
  const out: string[] = []
  if (w.local.head.kind === 'detached' && w.local.head.id === id) out.push('HEAD')
  for (const [b, c] of Object.entries(w.local.branches)) if (c === id) out.push(b === cur ? `HEAD -> ${b}` : b)
  for (const [b, c] of Object.entries(w.local.tracking)) if (c === id) out.push(b)
  return out
}

export const splitLines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'))

export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string }

/** Line diff with a longest common subsequence table. Files here are small, so this is fast enough. */
export function lineDiff(a: string, b: string): DiffLine[] {
  const x = splitLines(a)
  const y = splitLines(b)
  const dp = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      dp[i]![j] = x[i] === y[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      out.push({ kind: 'same', text: x[i]! })
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ kind: 'del', text: x[i++]! })
    else out.push({ kind: 'add', text: y[j++]! })
  }
  while (i < x.length) out.push({ kind: 'del', text: x[i++]! })
  while (j < y.length) out.push({ kind: 'add', text: y[j++]! })
  return out
}

export type BlameLine = { text: string; commit: Commit }

/** For each line of a file at a commit, the commit that last changed it. Follows all parents of merges. */
export function blame(w: World, id: string, path: string, memo = new Map<string, BlameLine[]>()): BlameLine[] {
  const hit = memo.get(id)
  if (hit) return hit
  const c = w.commits[id]
  const content = c?.tree[path]
  if (!c || content === undefined) return []
  const result: BlameLine[] = splitLines(content).map((text) => ({ text, commit: c }))
  for (const p of c.parents) {
    const before = w.commits[p]?.tree[path]
    if (before === undefined) continue
    const prev = blame(w, p, path, memo)
    let i = 0
    let j = 0
    for (const op of lineDiff(before, content)) {
      if (op.kind === 'same') {
        // Only lines that no earlier parent explained can come from this parent.
        if (result[j]!.commit === c) result[j] = { text: op.text, commit: prev[i]!.commit }
        i++
        j++
      } else if (op.kind === 'del') i++
      else j++
    }
  }
  memo.set(id, result)
  return result
}
