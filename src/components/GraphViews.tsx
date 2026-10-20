import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { laneOrder, localCommits, localRefs, remoteCommits, remoteRefs } from '../git/refs'
import { headId, type World } from '../git/sim'
import { CommitGraph } from './CommitGraph'

export function Panel({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

/** The history graph of this computer. */
export function LocalGraph({ world }: { world: World }) {
  return (
    <CommitGraph
      commits={localCommits(world)}
      refs={localRefs(world)}
      lanes={laneOrder(world)}
      headId={headId(world)}
      empty={world.initialized ? 'No commits yet.' : 'Not a Git repository yet.'}
    />
  )
}

export type Flow = 'up' | 'down' | 'blocked' | null

/** The remote on top, this computer below. Commits sit in the same column on both, so you can compare. */
export function RemoteView({ world, flow }: { world: World; flow: Flow }) {
  const local = localCommits(world)
  const remote = remoteCommits(world)
  const all = [...new Map([...local, ...remote].map((c) => [c.id, c])).values()].sort((a, b) => a.order - b.order)
  const column = new Map(all.map((c, i) => [c.id, i]))
  const columnOf = (id: string) => column.get(id) ?? 0
  const lanes = laneOrder(world)
  return (
    <div className="flex flex-col gap-2">
      <Panel title={`Remote ${world.remote?.url ? `· ${world.remote.url}` : ''}`} icon={<CloudIcon />}>
        <CommitGraph commits={remote} refs={remoteRefs(world)} lanes={lanes} columnOf={columnOf} empty="The remote is empty." />
      </Panel>
      <div className="relative flex h-10 items-center justify-center">
        <AnimatePresence mode="wait">
          {flow && (
            <motion.div
              key={flow}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-2 text-sm font-medium ${flow === 'blocked' ? 'text-bad' : 'text-accent'}`}
            >
              {flow === 'blocked' ? (
                <motion.span animate={{ x: [0, -4, 4, -4, 0] }} transition={{ duration: 0.4 }}>
                  ✕ push refused
                </motion.span>
              ) : (
                <>
                  <FlowDots flow={flow} />
                  {flow === 'up' ? 'push sends commits up' : 'fetch / pull brings commits down'}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Panel title="Your computer" icon={<LaptopIcon />}>
        <CommitGraph
          commits={local}
          refs={localRefs(world)}
          lanes={lanes}
          columnOf={columnOf}
          headId={headId(world)}
          empty={world.initialized ? 'No commits yet.' : 'No copy on this computer yet.'}
        />
      </Panel>
    </div>
  )
}

function FlowDots({ flow }: { flow: 'up' | 'down' }) {
  return (
    <div className="relative h-10 w-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute left-0.5 size-2 rounded-full bg-accent"
          initial={{ top: flow === 'up' ? 32 : 0, opacity: 0 }}
          animate={{ top: flow === 'up' ? 0 : 32, opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.35, ease: 'linear' }}
        />
      ))}
    </div>
  )
}

const CloudIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18z" />
  </svg>
)

const LaptopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19h20" />
  </svg>
)
