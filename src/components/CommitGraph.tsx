import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { assignLanes, type Ref } from '../git/refs'
import { compare, type Commit } from '../git/sim'

const DX = 96
const PAD = 60
const R = 12
const LABEL_H = 20
const LABEL_GAP = 4
const spring = { type: 'spring', stiffness: 260, damping: 28 } as const

export const laneColor = (lanes: string[], lane: string) => `var(--lane-${Math.max(0, lanes.indexOf(lane)) % 6})`
// origin/main reuses the color of main, with a dashed label to tell them apart.
const colorKey = (lane: string) => lane.replace(/^origin\//, '').replace(/ \(merged\)$/, '')

const kindRank = { head: 0, branch: 1, remote: 2 }

type Props = {
  commits: Commit[]
  refs: Ref[]
  // Shared lane order (see laneOrder), so a branch keeps its row order and color in every graph on the page.
  lanes: string[]
  // Column for each commit. Two graphs that share it line up their commits.
  columnOf?: (id: string) => number
  headId?: string
  empty?: string
}

/** Animated commit graph. Each row is a branch lane, each column is one commit in time order. */
export function CommitGraph({ commits, refs, lanes, columnOf, headId, empty = 'No commits yet.' }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const col = (id: string) => (columnOf ? columnOf(id) : commits.findIndex((c) => c.id === id))
  const byId = new Map(commits.map((c) => [c.id, c]))
  const laneOf = assignLanes(commits, refs)
  const lane = (c: Commit) => laneOf.get(c.id) ?? c.lane
  const color = (c: Commit) => laneColor(lanes, colorKey(lane(c)))

  const refsAt = new Map<string, Ref[]>()
  for (const r of refs) if (byId.has(r.id)) refsAt.set(r.id, [...(refsAt.get(r.id) ?? []), r])
  for (const list of refsAt.values()) list.sort((a, b) => kindRank[a.kind] - kindRank[b.kind])

  // Each lane is as tall as its biggest stack of labels.
  const laneY = new Map<string, number>()
  let top = 6
  const used = [...new Set(commits.map(lane))].sort((a, b) => order(lanes, a) - order(lanes, b))
  for (const l of used) {
    const cap = Math.max(0, ...commits.filter((c) => lane(c) === l).map((c) => refsAt.get(c.id)?.length ?? 0))
    const y = top + cap * (LABEL_H + LABEL_GAP) + R + 6
    laneY.set(l, y)
    top = y + R + 30
  }
  const maxCol = Math.max(0, ...commits.map((c) => col(c.id)))
  const width = PAD * 2 + DX * maxCol + 40
  const height = Math.max(top, 70)
  const pos = (c: Commit) => ({ x: PAD + DX * col(c.id), y: laneY.get(lane(c)) ?? 0 })

  useEffect(() => {
    const el = scroller.current
    el?.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [commits.length])

  if (!commits.length) {
    return <div className="flex h-24 items-center justify-center text-sm text-muted">{empty}</div>
  }

  const head = headId ? byId.get(headId) : undefined
  const hovered = hover ? byId.get(hover) : undefined

  return (
    <div ref={scroller} className="overflow-x-auto">
      <div className="relative" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Commit graph with ${commits.length} commits`}
          className="overflow-visible"
        >
          {commits.flatMap((c) =>
            c.parents
              .map((p) => byId.get(p))
              .filter((p) => !!p)
              .map((p) => {
                const a = pos(p)
                const b = pos(c)
                const d =
                  a.y === b.y
                    ? `M ${a.x} ${a.y} L ${b.x} ${b.y}`
                    : `M ${a.x} ${a.y} L ${b.x - DX} ${a.y} C ${b.x - DX / 2} ${a.y}, ${b.x - DX / 2} ${b.y}, ${b.x} ${b.y}`
                return (
                  <motion.path
                    key={`${p.id}-${c.id}`}
                    initial={{ pathLength: 0, d }}
                    animate={{ pathLength: 1, d }}
                    transition={{ duration: 0.5 }}
                    fill="none"
                    stroke={b.y >= a.y ? color(c) : color(p)}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )
              }),
          )}

          {head && (
            <motion.circle
              r={R + 5}
              fill="none"
              stroke="var(--ink)"
              strokeWidth={2}
              initial={false}
              animate={{ cx: pos(head).x, cy: pos(head).y }}
              transition={spring}
            />
          )}

          {commits.map((c) => {
            const { x, y } = pos(c)
            return (
              <motion.g
                key={c.id}
                initial={{ x, y, scale: 0, opacity: 0 }}
                animate={{ x, y, scale: 1, opacity: 1 }}
                transition={spring}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
                className="cursor-default"
              >
                <circle r={R + 12} fill="transparent" />
                <circle r={R} fill={color(c)} stroke="var(--surface)" strokeWidth={2} />
                {c.parents.length > 1 && <circle r={4} fill="var(--surface)" />}
                <text y={R + 17} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
                  {c.message.length > 14 ? c.message.slice(0, 13) + '…' : c.message}
                </text>
              </motion.g>
            )
          })}

          {[...refsAt.entries()].flatMap(([id, list]) => {
            const c = byId.get(id)!
            const { x, y } = pos(c)
            return list.map((r, k) => {
              const text = r.current ? `HEAD → ${r.name}` : r.name
              const w = text.length * 6.7 + 16
              const ly = y - R - 8 - LABEL_H - k * (LABEL_H + LABEL_GAP)
              const labelColor = laneColor(lanes, colorKey(r.name))
              return (
                <motion.g
                  key={`${r.kind}:${r.name}`}
                  initial={{ x, y: ly, opacity: 0 }}
                  animate={{ x, y: ly, opacity: 1 }}
                  transition={spring}
                >
                  <rect
                    x={-w / 2}
                    width={w}
                    height={LABEL_H}
                    rx={5}
                    fill={r.current ? 'var(--ink)' : r.kind === 'head' ? 'var(--warn)' : 'var(--surface)'}
                    stroke={r.kind === 'remote' ? 'var(--muted)' : r.current ? 'var(--ink)' : r.kind === 'head' ? 'var(--warn)' : labelColor}
                    strokeWidth={r.kind === 'remote' ? 1.5 : 2}
                    strokeDasharray={r.kind === 'remote' ? '4 3' : undefined}
                  />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                    fontWeight={r.current ? 700 : 500}
                    fill={r.current ? 'var(--surface)' : r.kind === 'head' ? '#0b0b0b' : r.kind === 'remote' ? 'var(--ink-2)' : 'var(--ink)'}
                  >
                    {text}
                  </text>
                </motion.g>
              )
            })
          })}
        </svg>

        {hovered && <CommitTooltip commit={hovered} parent={hovered.parents[0] ? byId.get(hovered.parents[0]) : undefined} at={pos(hovered)} />}
      </div>
    </div>
  )
}

// Rows follow the shared order. origin/x and merged leftovers of x sit just below x.
const order = (lanes: string[], l: string) => {
  const i = lanes.indexOf(colorKey(l))
  return (i < 0 ? lanes.length : i) * 3 + (l.startsWith('origin/') ? 1 : l.endsWith('(merged)') ? 2 : 0)
}

function CommitTooltip({ commit, parent, at }: { commit: Commit; parent?: Commit; at: { x: number; y: number } }) {
  const changes = compare(parent?.tree ?? {}, commit.tree)
  return (
    <div
      className="pointer-events-none absolute z-10 w-56 rounded-lg border border-line bg-surface p-3 text-xs shadow-lg"
      style={{ left: at.x + 22, top: Math.max(0, at.y - 30) }}
    >
      <div className="font-mono text-muted">{commit.id}</div>
      <div className="mt-1 font-medium text-ink">{commit.message}</div>
      <div className="mt-2 text-ink-2">
        {commit.parents.length > 1 ? 'Merge commit. It has 2 parents.' : changes.length ? 'Changed:' : 'No file changes.'}
      </div>
      {commit.parents.length < 2 &&
        changes.map((c) => (
          <div key={c.path} className="text-ink-2">
            <span className="font-mono">{c.path}</span> <span className="text-muted">({c.kind})</span>
          </div>
        ))}
    </div>
  )
}
