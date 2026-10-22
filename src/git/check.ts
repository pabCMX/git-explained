// Compares two worlds the way a teacher would: same branches, same commits, same files.
// Commit ids and messages do not count, so a reader can type their own messages.
import { ancestors, hash, type Files, type Head, type World } from './core'

// A key for a commit from its files, author and parents. Messages and ids are left out.
function keyer(w: World) {
  const memo = new Map<string, string>()
  const key = (id: string): string => {
    const known = memo.get(id)
    if (known) return known
    const c = w.commits[id]!
    const k = hash(JSON.stringify([c.author, c.tree, c.parents.map(key)]))
    memo.set(id, k)
    return k
  }
  return key
}

/**
 * Lists what is different between the reader's world and the goal, in plain sentences.
 * An empty list means the reader reached the goal.
 */
export function differences(you: World, goal: World): string[] {
  if (!goal.initialized) return you.initialized ? ['Git should not track this folder yet.'] : []
  if (!you.initialized) return ['Git does not track this folder yet.']
  const ky = keyer(you)
  const kg = keyer(goal)
  const out: string[] = []

  const refs = (where: string, a: Record<string, string>, b: Record<string, string>) => {
    for (const name of [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()) {
      const mine = a[name]
      const theirs = b[name]
      if (!mine) out.push(at(where, `There is no branch ${name}. The goal has one.`))
      else if (!theirs) out.push(at(where, `The branch ${name} should not exist.`))
      else if (ky(mine) !== kg(theirs)) {
        const n = ancestors(you, mine).size
        const m = ancestors(goal, theirs).size
        out.push(
          at(
            where,
            n === m
              ? `The branch ${name} has different commits than the goal.`
              : `The branch ${name} has ${n} commit${n === 1 ? '' : 's'}. The goal has ${m}.`,
          ),
        )
      }
    }
  }
  refs('', you.local.branches, goal.local.branches)

  const head = (h: Head, key: (id: string) => string) => (h.kind === 'branch' ? `branch ${h.name}` : `commit ${key(h.id)}`)
  const yh = you.local.head
  const gh = goal.local.head
  if (head(yh, ky) !== head(gh, kg)) {
    const where = (h: Head) => (h.kind === 'branch' ? `on the branch ${h.name}` : 'on an old commit, not on a branch')
    out.push(
      yh.kind === 'detached' && gh.kind === 'detached'
        ? 'You are on a different old commit than the goal.'
        : `You are ${where(yh)}. The goal is ${where(gh)}.`,
    )
  }

  files(out, 'your folder', you.local.working, goal.local.working)
  files(out, 'the staging area', you.local.index, goal.local.index)

  if (!!you.local.merging !== !!goal.local.merging) {
    out.push(you.local.merging ? 'A merge is still in progress. Finish it with a commit.' : 'The goal still has a merge in progress.')
  }
  if (!!you.local.bisect !== !!goal.local.bisect) {
    out.push(you.local.bisect ? 'A bisect is still running.' : 'The goal still has a bisect running.')
  }

  const ys = you.local.stash.map((s) => hash(JSON.stringify(s.files)))
  const gs = goal.local.stash.map((s) => hash(JSON.stringify(s.files)))
  if (ys.length !== gs.length) out.push(`Your stash has ${ys.length} entr${ys.length === 1 ? 'y' : 'ies'}. The goal has ${gs.length}.`)
  else if (ys.join() !== gs.join()) out.push('Your stash has different changes than the goal.')

  if (!!you.local.origin !== !!goal.local.origin) {
    out.push(you.local.origin ? 'This folder should not have a remote yet.' : 'This folder is not connected to the remote.')
  }
  for (const name of [...new Set([...Object.keys(goal.local.tracking), ...Object.keys(you.local.tracking)])].sort()) {
    const mine = you.local.tracking[name]
    const theirs = goal.local.tracking[name]
    if (!mine || !theirs || ky(mine) !== kg(theirs)) out.push(`Your copy of ${name} is not the same as in the goal. Did you fetch?`)
  }
  if (goal.remote) refs('On the remote, ', you.remote?.branches ?? {}, goal.remote.branches)

  return out
}

// Puts a prefix such as "On the remote, " before a sentence.
const at = (where: string, s: string) => (where ? where + s[0]!.toLowerCase() + s.slice(1) : s)

function files(out: string[], where: string, a: Files, b: Files) {
  for (const path of [...new Set([...Object.keys(b), ...Object.keys(a)])].sort()) {
    if (!(path in a)) out.push(`The file ${path} is missing from ${where}.`)
    else if (!(path in b)) out.push(`The file ${path} should not be in ${where}.`)
    else if (a[path] !== b[path]) out.push(`The file ${path} in ${where} is different from the goal.`)
  }
}
