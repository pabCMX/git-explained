// A tiny Git simulator. Every function is pure: it takes a World and returns a new World.
// Lessons replay a list of actions from a start World, so "Back" is a replay of fewer steps.

export type Files = Record<string, string>

export type Commit = {
  id: string
  parents: string[]
  message: string
  tree: Files
  // Branch name at the time of the commit. The graph uses it to pick a row.
  lane: string
  order: number
}

export type Head = { kind: 'branch'; name: string } | { kind: 'detached'; id: string }

export type Local = {
  branches: Record<string, string>
  head: Head
  working: Files
  index: Files
  merging: { id: string; name: string } | null
  // Last known position of the remote branches, for example "origin/main".
  tracking: Record<string, string>
  origin: string | null
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

export type Action =
  | string
  | { kind: 'write'; path: string; content: string }
  | { kind: 'delete'; path: string }
  | { kind: 'teammate'; branch?: string; path: string; content: string; message: string }

export type Result = { world: World; output: string[]; ok: boolean }

export type Change = { path: string; kind: 'new' | 'modified' | 'deleted' }

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

/** The three lists that "git status" prints. */
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

function isDirty(w: World) {
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

function mergeBase(w: World, a: string, b: string): string | undefined {
  const fromA = ancestors(w, a)
  let best: Commit | undefined
  for (const id of ancestors(w, b)) {
    const c = w.commits[id]
    if (fromA.has(id) && c && (!best || c.order > best.order)) best = c
  }
  return best?.id
}

/** Turns a name like "main", "origin/main", "HEAD~1" or a short id into a commit id. */
export function resolve(w: World, ref: string): string | undefined {
  const tilde = ref.match(/^(.+)~(\d+)$/)
  if (tilde) {
    let id = resolve(w, tilde[1]!)
    for (let i = 0; i < Number(tilde[2]); i++) id = id ? w.commits[id]?.parents[0] : undefined
    return id
  }
  if (ref === 'HEAD') return headId(w)
  if (ref in w.local.branches) return w.local.branches[ref]
  if (ref in w.local.tracking) return w.local.tracking[ref]
  if (ref.length >= 4) {
    const known = ancestorsOfLocalRefs(w)
    return [...known].find((id) => id.startsWith(ref))
  }
  return undefined
}

/** Commits this computer has. Commits that only exist on the remote are not included. */
export function ancestorsOfLocalRefs(w: World): Set<string> {
  const ids = [
    ...Object.values(w.local.branches),
    ...Object.values(w.local.tracking),
    headId(w),
    w.local.merging?.id,
  ]
  const out = new Set<string>()
  for (const id of ids) for (const a of ancestors(w, id)) out.add(a)
  return out
}

export function ancestorsOfRemote(w: World): Set<string> {
  const out = new Set<string>()
  for (const id of Object.values(w.remote?.branches ?? {})) for (const a of ancestors(w, id)) out.add(a)
  return out
}

function addCommit(w: World, c: Omit<Commit, 'id' | 'order'>): [World, string] {
  const order = w.counter + 1
  const id = hash(`${order}|${c.message}|${c.parents.join(',')}|${JSON.stringify(c.tree)}`)
  return [{ ...w, counter: order, commits: { ...w.commits, [id]: { ...c, id, order } } }, id]
}

function patchLocal(w: World, patch: Partial<Local>): World {
  return { ...w, local: { ...w.local, ...patch } }
}

// Moves the current branch to id. If HEAD is detached, moves HEAD itself.
function moveHead(w: World, id: string): World {
  const h = w.local.head
  return h.kind === 'branch'
    ? patchLocal(w, { branches: { ...w.local.branches, [h.name]: id } })
    : patchLocal(w, { head: { kind: 'detached', id } })
}

// Puts the files of a snapshot into the folder. Untracked files stay where they are.
function checkoutTree(w: World, tree: Files): World {
  const untracked = Object.fromEntries(
    Object.entries(w.local.working).filter(([p]) => !(p in w.local.index) && !(p in tree)),
  )
  return patchLocal(w, { working: { ...untracked, ...tree }, index: { ...tree } })
}

const ok = (world: World, output: string[] = []): Result => ({ world, output, ok: true })
const fail = (world: World, ...output: string[]): Result => ({ world, output, ok: false })

function tokenize(s: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out
}

/** Runs one action: a command line such as `git commit -m "hi"`, or a file edit. */
export function run(w: World, action: Action): Result {
  if (typeof action !== 'string') return runEdit(w, action)
  const [cmd, sub, ...args] = tokenize(action.trim())
  if (!cmd) return ok(w)
  if (cmd === 'help' || (cmd === 'git' && (!sub || sub === 'help'))) return ok(w, HELP)
  if (cmd !== 'git') return fail(w, `Unknown command "${cmd}". Commands here start with "git". Type "help" for a list.`)
  if (sub === 'init') return init(w)
  if (sub === 'clone') return clone(w, args)
  if (!w.initialized) return fail(w, 'fatal: not a git repository', 'Run "git init" first to start tracking this folder.')
  const fn = COMMANDS[sub ?? '']
  if (!fn) return fail(w, `git: '${sub}' is not a command this simulator knows. Type "help" for a list.`)
  return fn(w, args)
}

/** Runs actions in order and stops at the first failure. */
export function runAll(w: World, actions: Action[]): Result {
  let r = ok(w)
  for (const a of actions) {
    const next = run(r.world, a)
    r = { world: next.world, output: [...r.output, ...next.output], ok: next.ok }
    if (!next.ok) break
  }
  return r
}

export const HELP = [
  'Commands you can try:',
  '  git init                    start tracking this folder',
  '  git status                  see what changed',
  '  git add <file> | git add .  put changes in the staging area',
  '  git commit -m "message"     save a snapshot',
  '  git log                     list the snapshots',
  '  git diff [--staged]         see changed lines',
  '  git branch <name>           make a new branch',
  '  git switch <name>           go to a branch (-c to make it first)',
  '  git checkout <id>           look at an old snapshot',
  '  git merge <branch>          bring another branch into this one',
  '  git restore <file>          throw away changes to a file',
  '  git restore --staged <file> take a file out of the staging area',
  '  git revert <id>             undo a commit with a new commit',
  '  git remote add origin <url> connect to a remote',
  '  git push / fetch / pull     send or get commits',
]

function runEdit(w: World, a: Exclude<Action, string>): Result {
  if (a.kind === 'write') return ok(patchLocal(w, { working: { ...w.local.working, [a.path]: a.content } }))
  if (a.kind === 'delete') {
    const { [a.path]: _, ...rest } = w.local.working
    return ok(patchLocal(w, { working: rest }))
  }
  // A teammate pushes a commit straight to the remote.
  const branch = a.branch ?? 'main'
  if (!w.remote) return fail(w, 'There is no remote yet.')
  const parent = w.remote.branches[branch]
  const tree = { ...treeOf(w, parent), [a.path]: a.content }
  const [w2, id] = addCommit(w, { parents: parent ? [parent] : [], message: a.message, tree, lane: branch })
  return ok({ ...w2, remote: { ...w.remote, branches: { ...w.remote.branches, [branch]: id } } }, [
    `A teammate pushed "${a.message}" to ${branch} on the remote.`,
  ])
}

function init(w: World): Result {
  if (w.initialized) return ok(w, ['Reinitialized existing Git repository.'])
  return ok({ ...w, initialized: true }, ['Initialized empty Git repository in .git/'])
}

function clone(w: World, args: string[]): Result {
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

type Command = (w: World, args: string[]) => Result

const COMMANDS: Record<string, Command> = {
  status: (w) => {
    const s = status(w)
    const b = currentBranch(w)
    const out = [b ? `On branch ${b}` : `HEAD detached at ${headId(w)}`]
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
    const merging = next.local.merging
    const message = mi >= 0 ? args[mi + 1] : merging ? `Merge branch '${merging.name}'` : undefined
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
    if (!args.length) {
      const cur = currentBranch(w)
      const names = Object.keys(w.local.branches).sort()
      if (!names.length) return ok(w, [`(no branches yet. Make a commit first.)`])
      return ok(w, names.map((n) => `${n === cur ? '*' : ' '} ${n}`))
    }
    if (args[0] === '-d' || args[0] === '-D') {
      const name = args[1]
      if (!name || !(name in w.local.branches)) return fail(w, `error: branch '${name}' not found`)
      if (name === currentBranch(w)) return fail(w, `error: you cannot delete the branch you are on.`)
      const { [name]: _, ...rest } = w.local.branches
      return ok(patchLocal(w, { branches: rest }), [`Deleted branch ${name}.`])
    }
    return createBranch(w, args[0]!)
  },

  switch: (w, args) => {
    if (args[0] === '-c') {
      const r = createBranch(w, args[1] ?? '')
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
    if (isDirty(w)) return fail(w, DIRTY)
    const r = checkoutTree(patchLocal(w, { head: { kind: 'detached', id } }), treeOf(w, id))
    return ok(r, [
      `HEAD is now at ${id} ${w.commits[id]!.message}`,
      `You are in 'detached HEAD' state. You can look around.`,
      `To go back, run: git switch main`,
    ])
  },

  merge: (w, args) => {
    if (args[0] === '--abort') {
      if (!w.local.merging) return fail(w, 'There is no merge to abort.')
      return ok(checkoutTree(patchLocal(w, { merging: null }), headTree(w)), ['Merge aborted.'])
    }
    if (w.local.merging) return fail(w, 'You are in the middle of a merge. Fix the conflicts, then add and commit.')
    const name = args[0] ?? ''
    const target = resolve(w, name)
    if (!target) return fail(w, `merge: ${name} - not something we can merge`)
    return merge(w, target, name)
  },

  restore: (w, args) => {
    const staged = args.includes('--staged')
    let paths = args.filter((a) => !a.startsWith('--'))
    if (!paths.length) return fail(w, 'Tell Git which file: git restore <file>')
    if (paths.includes('.')) paths = [...new Set([...Object.keys(w.local.working), ...Object.keys(w.local.index)])]
    if (staged) {
      const index = { ...w.local.index }
      const tree = headTree(w)
      for (const p of paths) {
        if (p in tree) index[p] = tree[p]!
        else delete index[p]
      }
      return ok(patchLocal(w, { index }))
    }
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
    const named = args.filter((a) => !a.startsWith('-'))
    const branch = named[1] ?? currentBranch(w)
    const mine = branch ? w.local.branches[branch] : undefined
    if (!branch || !mine) return fail(w, 'error: there is nothing to push yet.')
    const theirs = w.remote.branches[branch]
    if (theirs === mine) return ok(w, ['Everything up-to-date'])
    if (theirs && !isAncestor(w, theirs, mine)) {
      return fail(w, `! [rejected]  ${branch} -> ${branch} (fetch first)`, 'The remote has commits that you do not have. Run "git pull" first.')
    }
    const next: World = {
      ...patchLocal(w, { tracking: { ...w.local.tracking, [`origin/${branch}`]: mine } }),
      remote: { ...w.remote, branches: { ...w.remote.branches, [branch]: mine } },
    }
    return ok(next, [`To ${w.remote.url}`, theirs ? `   ${theirs}..${mine}  ${branch} -> ${branch}` : ` * [new branch]  ${branch} -> ${branch}`])
  },

  fetch: (w) => fetch(w),

  pull: (w) => {
    const f = fetch(w)
    if (!f.ok) return f
    const b = currentBranch(f.world)
    const up = b ? f.world.local.tracking[`origin/${b}`] : undefined
    if (!b || !up) return fail(f.world, 'There is no branch on the remote to pull from.')
    const m = merge(f.world, up, `origin/${b}`)
    return { ...m, output: [...f.output, ...m.output] }
  },
}

const DIRTY = 'error: You have changes that are not committed. Commit them (or restore them) first.'

function createBranch(w: World, name: string): Result {
  if (!name) return fail(w, 'Give the branch a name: git branch <name>')
  if (name in w.local.branches) return fail(w, `fatal: a branch named '${name}' already exists`)
  const id = headId(w)
  if (!id) return fail(w, `fatal: make a commit first. A branch must point at a commit.`)
  return ok(patchLocal(w, { branches: { ...w.local.branches, [name]: id } }))
}

function switchBranch(w: World, name: string): Result {
  let next = w
  if (!(name in w.local.branches)) {
    const remoteId = w.local.tracking[`origin/${name}`]
    if (!remoteId) return fail(w, `fatal: invalid reference: ${name}`)
    next = patchLocal(w, { branches: { ...w.local.branches, [name]: remoteId } })
  }
  if (currentBranch(next) === name) return ok(next, [`Already on '${name}'`])
  if (isDirty(next)) return fail(w, DIRTY)
  const moved = patchLocal(next, { head: { kind: 'branch', name } })
  return ok(checkoutTree(moved, headTree(moved)), [`Switched to branch '${name}'`])
}

function merge(w: World, target: string, name: string): Result {
  const cur = headId(w)
  if (!cur) return fail(w, 'fatal: make a commit before you merge.')
  if (isDirty(w)) return fail(w, DIRTY)
  if (isAncestor(w, target, cur)) return ok(w, ['Already up to date.'])
  if (isAncestor(w, cur, target)) {
    return ok(checkoutTree(moveHead(w, target), treeOf(w, target)), [`Updating ${cur}..${target}`, 'Fast-forward'])
  }
  const base = treeOf(w, mergeBase(w, cur, target))
  const ours = treeOf(w, cur)
  const theirs = treeOf(w, target)
  const merged: Files = {}
  const conflicts: string[] = []
  const out: string[] = []
  for (const p of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
    const o = ours[p]
    const t = theirs[p]
    const b = base[p]
    let result: string | undefined
    if (o === t) result = o
    else if (o === b) result = t
    else if (t === b) result = o
    else {
      out.push(`Auto-merging ${p}`, `CONFLICT (content): Merge conflict in ${p}`)
      conflicts.push(p)
      result = conflictText(o ?? '', t ?? '', name)
    }
    if (result !== undefined) merged[p] = result
  }
  if (conflicts.length) {
    const next = patchLocal(checkoutTree(w, merged), { merging: { id: target, name } })
    return fail(next, ...out, 'Automatic merge failed. Fix the conflicts, then commit the result.')
  }
  const lane = currentBranch(w) ?? 'detached'
  const [w2, id] = addCommit(w, { parents: [cur, target], message: `Merge branch '${name}'`, tree: merged, lane })
  return ok(checkoutTree(moveHead(w2, id), merged), [...out, "Merge made by the 'ort' strategy."])
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

function fetch(w: World): Result {
  if (!w.local.origin || !w.remote) return fail(w, 'fatal: No remote is set up.')
  const out: string[] = []
  const tracking = { ...w.local.tracking }
  for (const [b, id] of Object.entries(w.remote.branches)) {
    const key = `origin/${b}`
    if (tracking[key] !== id) out.push(`   ${tracking[key] ?? '(new)'}..${id}  ${b} -> ${key}`)
    tracking[key] = id
  }
  return ok(patchLocal(w, { tracking }), out.length ? [`From ${w.remote.url}`, ...out] : [])
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

const splitLines = (s: string) => (s === '' ? [] : s.replace(/\n$/, '').split('\n'))

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
