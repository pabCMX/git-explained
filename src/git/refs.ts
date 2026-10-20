import { ancestorsOfLocalRefs, ancestorsOfRemote, currentBranch, type Commit, type World } from './sim'

// A label drawn on the graph. "remote" is a local copy of a remote branch, for example origin/main.
export type Ref = { name: string; id: string; kind: 'branch' | 'remote' | 'head'; current?: boolean }

/** Labels for the graph of this computer. */
export function localRefs(w: World): Ref[] {
  const cur = currentBranch(w)
  const refs: Ref[] = []
  if (w.local.head.kind === 'detached') refs.push({ name: 'HEAD', id: w.local.head.id, kind: 'head' })
  for (const [name, id] of Object.entries(w.local.branches)) refs.push({ name, id, kind: 'branch', current: name === cur })
  for (const [name, id] of Object.entries(w.local.tracking)) refs.push({ name, id, kind: 'remote' })
  return refs
}

/** Labels for the graph of the remote. */
export function remoteRefs(w: World): Ref[] {
  return Object.entries(w.remote?.branches ?? {}).map(([name, id]) => ({ name, id, kind: 'branch' as const }))
}

const byOrder = (a: Commit, b: Commit) => a.order - b.order

export function localCommits(w: World): Commit[] {
  return [...ancestorsOfLocalRefs(w)].map((id) => w.commits[id]!).sort(byOrder)
}

export function remoteCommits(w: World): Commit[] {
  return [...ancestorsOfRemote(w)].map((id) => w.commits[id]!).sort(byOrder)
}

/**
 * Picks a row for each commit. Each branch claims the commits on its first-parent line, main first.
 * So after a fast-forward, the commits move up into the main row. Commits that no label reaches
 * (for example, from a deleted branch) keep the branch name they were made on.
 */
export function assignLanes(commits: Commit[], refs: Ref[]): Map<string, string> {
  const byId = new Map(commits.map((c) => [c.id, c]))
  const rank = (r: Ref) => (r.name === 'main' ? 0 : r.kind === 'branch' ? 1 : r.kind === 'remote' ? 2 : 3)
  const tips = refs
    .filter((r) => r.kind !== 'head')
    .sort((a, b) => rank(a) - rank(b) || (byId.get(a.id)?.order ?? 0) - (byId.get(b.id)?.order ?? 0))
  const lane = new Map<string, string>()
  for (const t of tips) {
    let c = byId.get(t.id)
    while (c && !lane.has(c.id)) {
      lane.set(c.id, t.name)
      c = c.parents[0] ? byId.get(c.parents[0]) : undefined
    }
  }
  const claimed = new Set(lane.values())
  for (const c of commits) if (!lane.has(c.id)) lane.set(c.id, claimed.has(c.lane) ? `${c.lane} (merged)` : c.lane)
  return lane
}

/**
 * Branch names in the order they first got a commit, main first. Commits are never removed,
 * so a branch keeps its color for the whole lesson, also after the label is deleted.
 */
export function laneOrder(w: World): string[] {
  const out = ['main']
  for (const c of Object.values(w.commits).sort(byOrder)) if (!out.includes(c.lane)) out.push(c.lane)
  for (const name of [...Object.keys(w.local.branches), ...Object.keys(w.remote?.branches ?? {})]) {
    if (!out.includes(name)) out.push(name)
  }
  return out
}
