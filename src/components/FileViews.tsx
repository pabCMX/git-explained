import { AnimatePresence, motion } from 'motion/react'
import { compare, headId, lineDiff, treeOf, type World } from '../git/sim'

/** What is in the folder right now, file by file. Conflict marker lines are highlighted. */
export function FilesView({ world }: { world: World }) {
  const files = Object.entries(world.local.working).sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AnimatePresence initial={false}>
        {files.map(([path, content]) => (
          <motion.div
            key={path}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="overflow-hidden rounded-lg border border-line bg-surface"
          >
            <div className="border-b border-line bg-page px-3 py-1.5 font-mono text-xs text-ink-2">{path}</div>
            <motion.pre
              key={content}
              initial={{ opacity: 0.2 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="px-3 py-2 font-mono text-sm leading-6 whitespace-pre-wrap"
            >
              {content.replace(/\n$/, '').split('\n').map((line, i) => (
                <div key={i} className={markerClass(line)}>
                  {line || ' '}
                </div>
              ))}
            </motion.pre>
          </motion.div>
        ))}
      </AnimatePresence>
      {!files.length && <div className="text-sm text-muted">The folder is empty.</div>}
    </div>
  )
}

function markerClass(line: string) {
  if (/^(<{7}|={7}|>{7})/.test(line)) return 'bg-bad/15 font-semibold text-bad'
  return ''
}

/** Line changes in the newest commit compared to its parent. */
export function DiffView({ world }: { world: World }) {
  const id = headId(world)
  const c = id ? world.commits[id] : undefined
  if (!c) return <div className="text-sm text-muted">No commit to compare yet.</div>
  const before = treeOf(world, c.parents[0])
  const changes = compare(before, c.tree)
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-ink-2">
        Changes in <span className="font-mono text-ink">{c.id}</span> “{c.message}”
      </div>
      {changes.map((ch) => (
        <div key={ch.path} className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="border-b border-line bg-page px-3 py-1.5 font-mono text-xs text-ink-2">
            {ch.path} <span className="text-muted">({ch.kind})</span>
          </div>
          <div className="py-1 font-mono text-sm leading-6">
            {lineDiff(before[ch.path] ?? '', c.tree[ch.path] ?? '').map((l, i) => (
              <motion.div
                key={`${c.id}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`px-3 ${l.kind === 'add' ? 'bg-good/15' : l.kind === 'del' ? 'bg-bad/15 text-ink-2 line-through' : 'text-muted'}`}
              >
                <span className="mr-2 inline-block w-3 select-none">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ''}</span>
                {l.text || ' '}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
      {!changes.length && <div className="text-sm text-muted">This commit has no file changes.</div>}
    </div>
  )
}
