import { motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { runAll, type Action, type Result, type World } from '../git/sim'
import { AreasDiagram } from './AreasDiagram'
import { DiffView, FilesView } from './FileViews'
import { BisectView, BlameView } from './InspectViews'
import { LocalGraph, Panel, RemoteView, type Flow } from './GraphViews'

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

/** Plays a lesson script one step at a time. Each step runs its actions on the world from the step before. */
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
  const actions = asList(step.do)
  const flow: Flow = actions.some((a) => typeof a === 'string' && /git push/.test(a))
    ? result.ok
      ? 'up'
      : 'blocked'
    : actions.some((a) => typeof a === 'string' && /git (pull|fetch|clone)/.test(a))
      ? 'down'
      : null

  return (
    <section className="my-8 rounded-2xl border border-line bg-page p-3 sm:p-4" aria-label="Interactive demo">
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-grid">
          <motion.div className="h-full bg-accent" animate={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <span className="text-xs text-muted tabular-nums">
          Step {i + 1} of {steps.length}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[15px] leading-relaxed text-ink-2 [&_strong]:text-ink [&_code]:rounded [&_code]:bg-grid [&_code]:px-1 [&_code]:text-ink"
        >
          {step.say}
        </motion.div>
        <ActionLog actions={actions} result={result} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {views.map((v) =>
          v === 'remote' ? (
            <RemoteView key={v} world={result.world} flow={flow} />
          ) : (
            <Panel key={v} title={viewTitle(v)}>
              <ViewBody view={v} world={result.world} />
            </Panel>
          ),
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setI(0)}
          disabled={i === 0}
          className="rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-grid disabled:opacity-40"
        >
          Start over
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setI(i - 1)}
          disabled={i === 0}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-grid disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={() => setI(i + 1)}
          disabled={i === steps.length - 1}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {i === steps.length - 1 ? 'Done' : 'Next'}
        </button>
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
    return <div className="hidden rounded-xl bg-[#141413] p-3 font-mono text-sm text-[#898781] md:block">$ _</div>
  }
  return (
    <div className="rounded-xl bg-[#141413] p-3 font-mono text-[13px] leading-6 text-[#f0efec]">
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
