import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useId, type ReactNode } from 'react'
import { ancestors, compare, hash, headId, status, treeOf, type Change, type World } from '../git/sim'

const kindLabel = { new: 'new', modified: 'changed', deleted: 'deleted' }
const kindColor = { new: 'var(--good)', modified: 'var(--warn)', deleted: 'var(--bad)' }

/**
 * Shows the folder, the staging area and the repository side by side, plus the stash when it is not empty.
 * A change chip keeps the same layoutId while its content is the same, so it flies between columns.
 */
export function AreasDiagram({ world }: { world: World }) {
  const scope = useId()
  const { working, index } = world.local
  const s = status(world)
  const chipId = (path: string, content: string | undefined) => `${scope}:${path}:${hash(content ?? '\u0000')}`

  const paths = [...new Set([...Object.keys(working), ...Object.keys(index)])].sort()
  const folderChange = (p: string): Change | undefined =>
    s.unstaged.find((c) => c.path === p) ?? (s.untracked.includes(p) ? { path: p, kind: 'new' } : undefined)

  const recent = [...ancestors(world, headId(world))]
    .map((id) => world.commits[id]!)
    .sort((a, b) => b.order - a.order)
    .slice(0, 3)

  return (
    <LayoutGroup id={scope}>
      <div className={`grid gap-3 ${world.local.stash.length ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Area title="Your folder" hint="The files you see and edit.">
          {paths.map((p) => {
            const change = folderChange(p)
            return (
              <div key={p} className="flex items-center justify-between gap-2 rounded-md bg-page px-2.5 py-1.5">
                <span className={`font-mono text-sm ${p in working ? '' : 'text-muted line-through'}`}>{p}</span>
                {change ? (
                  <Chip layoutId={chipId(p, working[p])} kind={change.kind} />
                ) : (
                  <span className="text-xs text-muted">{s.staged.some((c) => c.path === p) ? 'staged' : 'saved'}</span>
                )}
              </div>
            )
          })}
          {!paths.length && <Empty>The folder is empty.</Empty>}
        </Area>

        <Area title="Staging area" hint="Changes you picked for the next snapshot.">
          <AnimatePresence mode="popLayout">
            {s.staged.map((c) => (
              <motion.div
                key={c.path}
                layout
                className="flex items-center justify-between gap-2 rounded-md bg-page px-2.5 py-1.5"
              >
                <span className="font-mono text-sm">{c.path}</span>
                <Chip layoutId={chipId(c.path, index[c.path])} kind={c.kind} />
              </motion.div>
            ))}
          </AnimatePresence>
          {!s.staged.length && <Empty>Nothing staged. Use git add.</Empty>}
        </Area>

        <Area title="Repository" hint="Saved snapshots. Newest first.">
          {!world.initialized && <Empty>No repository yet. Use git init.</Empty>}
          {world.initialized && !recent.length && <Empty>No snapshots yet.</Empty>}
          <AnimatePresence mode="popLayout" initial={false}>
            {recent.map((c, i) => {
              const changes = compare(treeOf(world, c.parents[0]), c.tree)
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: i === 0 ? 1 : 0.6, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-md border border-line bg-page px-2.5 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{c.message}</span>
                    <span className="font-mono text-xs text-muted">{c.id}</span>
                  </div>
                  {i === 0 && changes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {changes.map((ch) => (
                        <span key={ch.path} className="flex items-center gap-1 text-xs text-ink-2">
                          <Chip layoutId={chipId(ch.path, c.tree[ch.path])} kind={ch.kind} />
                          <span className="font-mono">{ch.path}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </Area>

        {world.local.stash.length > 0 && (
          <Area title="Stash" hint="Changes put aside. Newest first.">
            {world.local.stash.map((entry, i) => (
              <motion.div key={entry.message + world.local.stash.length} layout className="rounded-md border border-dashed border-axis bg-page px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs">{entry.message}</span>
                  <span className="font-mono text-xs text-muted">stash@{`{${i}}`}</span>
                </div>
                {i === 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(entry.files).map(([p, f]) => (
                      <span key={p} className="flex items-center gap-1 text-xs text-ink-2">
                        <Chip layoutId={chipId(p, f.content ?? undefined)} kind={f.content === null ? 'deleted' : f.untracked ? 'new' : 'modified'} />
                        <span className="font-mono">{p}</span>
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </Area>
        )}
      </div>
    </LayoutGroup>
  )
}

function Area({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-0.5 font-semibold">{title}</div>
      <div className="mb-3 text-xs text-muted">{hint}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Chip({ layoutId, kind }: { layoutId: string; kind: Change['kind'] }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-medium"
    >
      <span className="size-2 rounded-full" style={{ background: kindColor[kind] }} />
      {kindLabel[kind]}
    </motion.span>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <div className="py-2 text-sm text-muted">{children}</div>
