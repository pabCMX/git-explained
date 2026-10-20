import { motion } from 'motion/react'
import { bisectSuspects } from '../git/advanced'
import { ancestors, blame, headId, SAM, type World } from '../git/sim'

const authorColor = (author: string) => (author === SAM ? 'var(--lane-1)' : 'var(--lane-0)')

/** A file with the commit and author that last changed each line, like "git blame". */
export function BlameView({ world, path }: { world: World; path: string }) {
  const id = headId(world)
  const lines = id ? blame(world, id, path) : []
  if (!lines.length) return <div className="text-sm text-muted">No committed version of {path} yet.</div>
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-2">{path}</span>
        <div className="flex gap-3 text-xs text-ink-2">
          {['You', SAM].map((a) => (
            <span key={a} className="flex items-center gap-1.5">
              <span className="h-3 w-1 rounded-full" style={{ background: authorColor(a) }} />
              {a}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface font-mono text-sm leading-7">
        {lines.map((l, i) => {
          const first = i === 0 || lines[i - 1]!.commit.id !== l.commit.id
          return (
            <motion.div
              key={`${i}-${l.commit.id}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-[4px_minmax(9rem,14rem)_1fr] ${first && i > 0 ? 'border-t border-line' : ''}`}
            >
              <span style={{ background: authorColor(l.commit.author) }} />
              <span className="truncate px-3 text-xs leading-7 text-muted">
                {first && (
                  <>
                    <span className="text-ink-2">{l.commit.id}</span> {l.commit.author} · {l.commit.message}
                  </>
                )}
              </span>
              <span className="pr-3 whitespace-pre">{l.text || ' '}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/** The bisect search as a timeline: cleared commits, suspects, the commit under test, and the result. */
export function BisectView({ world }: { world: World }) {
  const b = world.local.bisect
  if (!b) return <div className="text-sm text-muted">Bisect is not running.</div>
  const tip = b.start.kind === 'branch' ? world.local.branches[b.start.name] : b.start.id
  const line = [...ancestors(world, tip)].map((id) => world.commits[id]!).sort((x, y) => x.order - y.order)
  const suspects = new Set(bisectSuspects(world, b))
  const cleared = new Set(b.good.flatMap((g) => [...ancestors(world, g)]))
  const broken = b.bad ? line.filter((c) => ancestors(world, c.id).has(b.bad!)).map((c) => c.id) : []
  const testing = world.local.head.kind === 'detached' ? world.local.head.id : null

  const state = (id: string) =>
    b.found === id ? 'found' : cleared.has(id) ? 'good' : broken.includes(id) && !suspects.has(id) ? 'bad' : suspects.has(id) ? (id === b.bad ? 'bad' : 'suspect') : 'unknown'
  const style = {
    good: { bg: 'var(--good)', icon: '✓', label: 'good' },
    bad: { bg: 'var(--bad)', icon: '✗', label: 'bad' },
    found: { bg: 'var(--bad)', icon: '!', label: 'first bad' },
    suspect: { bg: 'var(--axis)', icon: '?', label: 'suspect' },
    unknown: { bg: 'var(--grid)', icon: '', label: '' },
  }

  return (
    <div>
      <div className="mb-3 text-sm text-ink-2">
        {b.found
          ? 'Found it. One commit is left.'
          : !b.bad || !b.good.length
            ? 'Tell Git one bad commit and one good commit.'
            : `${suspects.size - 1} suspect${suspects.size === 2 ? '' : 's'} left before the bad commit.`}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-start gap-1">
          {line.map((c) => {
            const st = style[state(c.id)]
            return (
              <div key={c.id} className="flex w-20 flex-col items-center gap-1 text-center">
                <div className="h-4 text-[10px] font-semibold text-accent">{testing === c.id ? 'testing ▼' : ''}</div>
                <motion.div
                  animate={{ backgroundColor: st.bg, scale: testing === c.id || b.found === c.id ? 1.2 : 1 }}
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-bold text-white ${b.found === c.id ? 'ring-4 ring-bad/30' : ''}`}
                >
                  {st.icon}
                </motion.div>
                <div className="w-full truncate text-[11px] text-ink-2" title={c.message}>
                  {c.message}
                </div>
                <div className="text-[10px] text-muted">{st.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
