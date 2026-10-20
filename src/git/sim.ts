// A tiny Git simulator. Every function is pure: it takes a World and returns a new World.
// Lessons replay a list of actions from a start World, so "Back" is a replay of fewer steps.
import { ADVANCED } from './advanced'
import { BASIC, clone, init } from './basic'
import {
  addCommit,
  fail,
  headId,
  mergeBase,
  ok,
  patchLocal,
  SAM,
  setRemoteBranch,
  threeWay,
  treeOf,
  type Result,
  type World,
} from './core'

export * from './core'

export type Action =
  | string
  | { kind: 'write'; path: string; content: string }
  | { kind: 'delete'; path: string }
  // A teammate pushes a commit to the remote. A new branch starts from `from` (main if not given).
  | { kind: 'teammate'; branch?: string; from?: string; path: string; content: string; message: string }
  // A teammate merges a pull request on the website, and can delete the branch after.
  | { kind: 'remote-merge'; branch: string; into?: string; deleteBranch?: boolean }

const COMMANDS = { ...BASIC, ...ADVANCED }

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
  if (sub === 'clone') return logHead(w, clone(w, args), 'clone')
  if (!w.initialized) return fail(w, 'fatal: not a git repository', 'Run "git init" first to start tracking this folder.')
  const fn = COMMANDS[sub ?? '']
  if (!fn) return fail(w, `git: '${sub}' is not a command this simulator knows. Type "help" for a list.`)
  return logHead(w, fn(w, args), `${sub} ${args.join(' ')}`)
}

// Adds a reflog entry when a command moved HEAD, like real Git does.
function logHead(before: World, r: Result, what: string): Result {
  const id = headId(r.world)
  if (!id || id === headId(before)) return r
  const c = r.world.commits[id]!
  const message = what.startsWith('commit') ? `commit${what.includes('--amend') ? ' (amend)' : ''}: ${c.message}` : what.trim().replace(' ', ': ')
  return { ...r, world: patchLocal(r.world, { reflog: [{ id, message }, ...r.world.local.reflog] }) }
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
  '  git commit -m "message"     save a snapshot (--amend to replace the last one)',
  '  git log                     list the snapshots',
  '  git diff [--staged]         see changed lines',
  '  git branch [-a] [<name>]    list or make branches (-d / -D to delete)',
  '  git switch <name>           go to a branch (-c to make it first)',
  '  git checkout <id>           look at an old snapshot',
  '  git merge <branch>          bring another branch in (--no-ff, --squash)',
  '  git rebase <branch>         replay your commits on top of another branch',
  '  git cherry-pick <id>        copy one commit to this branch',
  '  git stash [pop|list|drop]   put changes aside and get them back',
  '  git restore <file>          throw away changes to a file',
  '  git restore --staged <file> take a file out of the staging area',
  '  git reset [--soft|--hard] <id>  move the branch to another commit',
  '  git revert <id>             undo a commit with a new commit',
  '  git reflog                  where HEAD has been',
  '  git blame <file>            who last changed each line',
  '  git bisect start|good|bad|reset  find the commit that broke something',
  '  git remote add origin <url> connect to a remote',
  '  git push / fetch / pull     send or get commits',
  '  git push --force-with-lease replace a branch on the remote, safely',
]

function runEdit(w: World, a: Exclude<Action, string>): Result {
  if (a.kind === 'write') return ok(patchLocal(w, { working: { ...w.local.working, [a.path]: a.content } }))
  if (a.kind === 'delete') {
    const { [a.path]: _, ...rest } = w.local.working
    return ok(patchLocal(w, { working: rest }))
  }
  if (!w.remote) return fail(w, 'There is no remote yet.')
  if (a.kind === 'remote-merge') {
    const into = a.into ?? 'main'
    const ours = w.remote.branches[into]
    const theirs = w.remote.branches[a.branch]
    if (!ours || !theirs) return fail(w, `The remote has no branch '${!ours ? into : a.branch}'.`)
    const r = threeWay(treeOf(w, mergeBase(w, ours, theirs)), treeOf(w, ours), treeOf(w, theirs), a.branch)
    if (r.conflicts.length) return fail(w, 'The pull request has conflicts. The website cannot merge it.')
    const [w2, id] = addCommit(w, { parents: [ours, theirs], message: `Merge pull request: ${a.branch}`, author: SAM, tree: r.tree, lane: into })
    const merged = setRemoteBranch(w2, into, id)
    return ok(a.deleteBranch ? setRemoteBranch(merged, a.branch, null) : merged, [
      `Sam merged the pull request for ${a.branch} into ${into} on the website.${a.deleteBranch ? ` The ${a.branch} branch was deleted there.` : ''}`,
    ])
  }
  const branch = a.branch ?? 'main'
  const parent = w.remote.branches[branch] ?? w.remote.branches[a.from ?? 'main']
  const tree = { ...treeOf(w, parent), [a.path]: a.content }
  const [w2, id] = addCommit(w, { parents: parent ? [parent] : [], message: a.message, author: SAM, tree, lane: branch })
  return ok(setRemoteBranch(w2, branch, id), [`Sam pushed "${a.message}" to ${branch} on the remote.`])
}
