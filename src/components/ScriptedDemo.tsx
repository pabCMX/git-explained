import { motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { runAll, type Action, type Result, type World } from '../git/sim'
import { AreasDiagram } from './AreasDiagram'
import { DiffView, FilesView } from './FileViews'
import { BisectView, BlameView } from './InspectViews'
import { LocalGraph, Panel, RemoteView, type Flow } from './GraphViews'
import { Reserve } from './Reserve'

// `fails` marks a step whose command is meant to fail, such as a refused push. Tests check it.
export type Step = { do?: Action | Action[]; say: ReactNode; fails?: boolean }
export type Script = { start: World; steps: Step[] }
type SimpleView = 'graph' | 'areas' | 'files' | 'diff' | 'remote' | 'bisect'
// blame:<file> shows the blame of one file.
export type View = SimpleView | `blame:${string}`

const isBlame = (v: View): v is `blame:${string}` => v.startsWith('blame:')
const titles: Record<SimpleView, string> = {
  graph: 'History graph',
  areas: 'Where your changes are',
  files: 'Files in your folder',
  diff: 'What changed',
  remote: '',
  bisect: 'Bisect search',
}
const viewTitle = (v: View) => (isBlame(v) ? 'Who changed each line' : titles[v])

const asList = (a: Step['do']) => (a === undefined ? [] : Array.isArray(a) ? a : [a])

// Which way commits move in the remote view for one step.
function flowOf(step: Step, result: Result): Flow {
  const commands = asList(step.do).filter((a) => typeof a === 'string')
  if (commands.some((a) => /git push/.test(a))) return result.ok ? 'up' : 'blocked'
  if (commands.some((a) => /git (pull|fetch|clone)/.test(a))) return 'down'
  return null
}

const captionClass =
  'text-[15px] leading-relaxed text-ink-2 [&_strong]:text-ink [&_code]:rounded [&_code]:bg-grid [&_code]:px-1 [&_code]:text-ink'

/**
 * Plays a lesson script one step at a time. Each step runs its actions on the world from the step before.
 * The buttons sit at the top and every block reserves its tallest height, so nothing moves under the mouse.
 */
export function ScriptedDemo({ start, steps, views }: { start: World; steps: Step[]; views: View[] }) {
  const [i, setI] = useState(0)
  const results = useMemo(() => {
    let w = start
    return steps.map((s) => {
      const r = runAll(w, asList(s.do))
      w = r.world
      return r
    })
  }, [start, steps])
  const step = steps[i]!
  const result = results[i]!

  return (
    <section className="my-8 rounded-2xl border border-line bg-page p-3 sm:p-4" aria-label="Interactive demo">
      {/* Sticks below the site header, so the buttons stay in reach in tall demos. */}
      <div className="sticky top-[57px] z-10 -mx-3 mb-3 flex flex-wrap items-center gap-2 bg-page px-3 py-2 sm:-mx-4 sm:px-4">
        <div className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-grid">
          <motion.div className="h-full bg-accent" animate={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="w-20 text-right text-xs text-muted tabular-nums">
          Step {i + 1} of {steps.length}
        </span>
        <button
          onClick={() => setI(0)}
          disabled={i === 0}
          className="rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-grid disabled:opacity-40"
        >
          Start over
        </button>
        <button
          onClick={() => setI(i - 1)}
          disabled={i === 0}
          className="rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-grid disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={() => setI(i + 1)}
          disabled={i === steps.length - 1}
          className="w-20 rounded-lg bg-accent py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {i === steps.length - 1 ? 'Done' : 'Next'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Reserve
          all={steps.map((s, k) => (
            <div key={k} className={captionClass}>
              {s.say}
            </div>
          ))}
          live={
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={captionClass}>
              {step.say}
            </motion.div>
          }
        />
        <Reserve
          all={steps.map((s, k) => (
            <ActionLog key={k} actions={asList(s.do)} result={results[k]!} />
          ))}
          live={<ActionLog actions={asList(step.do)} result={result} />}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {views.map((v) =>
          v === 'remote' ? (
            <RemoteView key={v} world={result.world} flow={flowOf(step, result)} reserve={results.map((r) => r.world)} />
          ) : (
            <Panel key={v} title={viewTitle(v)}>
              <Reserve
                all={results.map((r, k) => (
                  <ViewBody key={k} view={v} world={r.world} />
                ))}
                live={<ViewBody view={v} world={result.world} />}
              />
            </Panel>
          ),
        )}
      </div>
    </section>
  )
}

function ViewBody({ view, world }: { view: View; world: World }) {
  if (view === 'graph') return <LocalGraph world={world} />
  if (view === 'areas') return <AreasDiagram world={world} />
  if (view === 'files') return <FilesView world={world} />
  if (view === 'bisect') return <BisectView world={world} />
  if (isBlame(view)) return <BlameView world={world} path={view.slice('blame:'.length)} />
  return <DiffView world={world} />
}

function ActionLog({ actions, result }: { actions: Action[]; result: Result }) {
  if (!actions.length) {
    return <div className="hidden h-full rounded-xl bg-[#141413] p-3 font-mono text-sm text-[#898781] md:block">$ _</div>
  }
  return (
    <div className="h-full rounded-xl bg-[#141413] p-3 font-mono text-[13px] leading-6 text-[#f0efec]">
      {actions.map((a, k) => (
        <div key={k}>{describe(a)}</div>
      ))}
      <OutputLines lines={result.output} ok={result.ok} />
    </div>
  )
}

function describe(a: Action): ReactNode {
  if (typeof a === 'string') {
    return (
      <>
        <span className="text-[#5598e7]">$ </span>
        {a}
      </>
    )
  }
  if (a.kind === 'write') return <span className="text-[#c3c2b7]"># You edit {a.path} and save it.</span>
  if (a.kind === 'delete') return <span className="text-[#c3c2b7]"># You delete {a.path}.</span>
  if (a.kind === 'remote-merge') return <span className="text-[#c3c2b7]"># Sam merges the pull request for {a.branch} on the website.</span>
  return (
    <span className="text-[#c3c2b7]">
      # Sam pushes to {a.branch ?? 'main'} from their own computer.
    </span>
  )
}

/** Terminal output with colors for diff lines and errors. */
export function OutputLines({ lines, ok }: { lines: string[]; ok: boolean }) {
  return (
    <>
      {lines.map((l, k) => (
        <div
          key={k}
          className={`whitespace-pre-wrap ${
            !ok && k === lines.length - 1
              ? 'text-[#e66767]'
              : l.startsWith('+ ')
                ? 'text-[#0ca30c]'
                : l.startsWith('- ') || l.startsWith('CONFLICT') || l.startsWith('!')
                  ? 'text-[#e66767]'
                  : 'text-[#c3c2b7]'
          }`}
        >
          {l}
        </div>
      ))}
    </>
  )
}
