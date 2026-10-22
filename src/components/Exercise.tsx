import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { run, type Action, type Result, type World } from '../git/sim'
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

// Which way commits move in the remote view, for the command that ran last.
function flowOf(action: Action | undefined, result: Result | undefined): Flow {
  if (typeof action !== 'string' || !result) return null
  if (/git push/.test(action)) return result.ok ? 'up' : 'blocked'
  if (/git (pull|fetch|clone)/.test(action)) return 'down'
  return null
}

const captionClass =
  'text-[15px] leading-relaxed text-ink-2 [&_strong]:text-ink [&_code]:rounded [&_code]:bg-grid [&_code]:px-1 [&_code]:text-ink'

// Delay before the first command of a step, and between the next ones, in milliseconds.
const FIRST_DELAY = 500
const NEXT_DELAY = 1000

// One step, replayed one action at a time: the world before it, and the result after each action.
// Like runAll, it stops at the first action that fails.
type Play = { before: World; frames: Result[] }

function playSteps(start: World, steps: Step[]): Play[] {
  let w = start
  return steps.map((s) => {
    const before = w
    const frames: Result[] = []
    for (const a of asList(s.do)) {
      const r = run(w, a)
      frames.push(r)
      w = r.world
      if (!r.ok) break
    }
    return { before, frames }
  })
}

/**
 * Plays a lesson script one step at a time. Inside a step, the commands run one by one, so the reader
 * sees each command change the diagrams. The buttons sit at the top and every block reserves its
 * tallest height, so nothing moves under the mouse.
 */
export function ScriptedDemo({ start, steps, views }: { start: World; steps: Step[]; views: View[] }) {
  const plays = useMemo(() => playSteps(start, steps), [start, steps])
  const reduced = useReducedMotion()
  const [i, setI] = useState(0)
  // How many commands of step i have run.
  const [done, setDone] = useState(0)
  const play = plays[i]!
  const step = steps[i]!
  const total = play.frames.length
  const shown = reduced ? total : done

  useEffect(() => {
    if (shown >= total) return
    const t = setTimeout(() => setDone(shown + 1), shown === 0 ? FIRST_DELAY : NEXT_DELAY)
    return () => clearTimeout(t)
  }, [shown, total])

  const go = (next: number, replay: boolean) => {
    setI(next)
    setDone(replay ? 0 : plays[next]!.frames.length)
  }
  const world = shown === 0 ? play.before : play.frames[shown - 1]!.world
  const flow = flowOf(asList(step.do)[shown - 1], play.frames[shown - 1])
  const everyWorld = plays.flatMap((p) => [p.before, ...p.frames.map((f) => f.world)])

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
        <button onClick={() => go(0, false)} disabled={i === 0} className="rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-grid disabled:opacity-40">
          Start over
        </button>
        <button
          onClick={() => go(i - 1, false)}
          disabled={i === 0}
          className="rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-grid disabled:opacity-40"
        >
          Back
        </button>
        <button
          onClick={() => go(i + 1, true)}
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
          all={plays.map((p, k) => (
            <ActionLog key={k} actions={asList(steps[k]!.do)} frames={p.frames} done={p.frames.length} />
          ))}
          live={<ActionLog actions={asList(step.do)} frames={play.frames} done={shown} onReplay={total > 1 && shown === total ? () => go(i, true) : undefined} />}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {views.map((v) =>
          v === 'remote' ? (
            <RemoteView key={v} world={world} flow={flow} reserve={everyWorld} />
          ) : (
            <Panel key={v} title={viewTitle(v)}>
              <Reserve
                all={everyWorld.map((w, k) => (
                  <ViewBody key={k} view={v} world={w} />
                ))}
                live={<ViewBody view={v} world={world} />}
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

/**
 * The terminal for one step. Commands that ran show their output. Commands still to come are dimmed,
 * so the reader sees what happens next.
 */
function ActionLog({ actions, frames, done, onReplay }: { actions: Action[]; frames: Result[]; done: number; onReplay?: () => void }) {
  if (!actions.length) {
    return <div className="hidden h-full rounded-xl bg-[#141413] p-3 font-mono text-sm text-[#898781] md:block">$ _</div>
  }
  return (
    <div className="relative h-full rounded-xl bg-[#141413] p-3 font-mono text-[13px] leading-6 text-[#f0efec]">
      {actions.map((a, k) => (
        <div key={k} className={`transition-opacity duration-300 ${k < done ? '' : 'opacity-35'}`}>
          <div>{describe(a)}</div>
          {k < done && frames[k] && <OutputLines lines={frames[k].output} ok={frames[k].ok} />}
        </div>
      ))}
      {onReplay && (
        <button onClick={onReplay} className="absolute top-2 right-2 rounded-md px-2 py-0.5 font-sans text-xs text-[#c3c2b7] hover:bg-white/10">
          Replay
        </button>
      )}
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
