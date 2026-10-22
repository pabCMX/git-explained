import { motion } from 'motion/react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { differences } from '../git/check'
import { run, type Action, type Result, type World } from '../git/sim'
import { AreasDiagram } from './AreasDiagram'
import { DiffView, FilesView } from './FileViews'
import { BisectView, BlameView } from './InspectViews'
import { LocalGraph, Panel, RemoteView, type Flow } from './GraphViews'
import { Reserve } from './Reserve'
import { Terminal, type Entry } from './Terminal'

// `say` explains the step in the guided mode. `task` tells the reader what to do in the "on your own"
// mode, without the exact command. `fails` marks a step whose command is meant to fail, such as a
// refused push. Tests check it.
export type Step = { do?: Action | Action[]; say: ReactNode; task?: ReactNode; fails?: boolean }
export type Script = { start: World; steps: Step[] }
type SimpleView = 'graph' | 'areas' | 'files' | 'diff' | 'remote' | 'bisect'
// blame:<file> shows the blame of one file.
export type View = SimpleView | `blame:${string}`
type Event = Exclude<Action, string>

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

export const asList = (a: Step['do']) => (a === undefined ? [] : Array.isArray(a) ? a : [a])

/** What an event does, as a sentence. Events are actions that are not typed, such as a file edit. */
export function eventText(a: Event) {
  if (a.kind === 'write') return `You edit ${a.path} and save it.`
  if (a.kind === 'delete') return `You delete ${a.path}.`
  if (a.kind === 'remote-merge') return `Sam merges the pull request for ${a.branch} on the website.`
  return `Sam pushes to ${a.branch ?? 'main'} from their own computer.`
}

const toEntry = (a: Action, r: Result): Entry =>
  typeof a === 'string' ? { cmd: a, output: r.output, ok: r.ok } : { cmd: eventText(a), note: true, output: r.output, ok: r.ok }

// Which way commits move in the remote view, for the command that ran last.
function flowOf(action: Action | undefined, result: Result | undefined): Flow {
  if (typeof action !== 'string' || !result) return null
  if (/git push/.test(action)) return result.ok ? 'up' : 'blocked'
  if (/git (pull|fetch|clone)/.test(action)) return 'down'
  return null
}

// Typed commands match when they differ only in spaces, letter case or the kind of quotes.
const loose = (s: string) => s.replace(/'/g, '"').toLowerCase()
const norm = (s: string) => loose(s.trim()).replace(/\s+/g, ' ')
// How many characters at the start of the expected command the reader typed right.
function typedRight(typed: string, expected: string) {
  const a = loose(typed.trimStart())
  const b = loose(expected)
  let k = 0
  while (k < a.length && k < b.length && a[k] === b[k]) k++
  return k
}

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

const captionClass =
  'text-[15px] leading-relaxed text-ink-2 [&_strong]:text-ink [&_code]:rounded [&_code]:bg-grid [&_code]:px-1 [&_code]:text-ink'
const buttonClass = 'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:bg-grid disabled:opacity-40'
const primaryClass = 'rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40'
const terminalHeight = 'h-72'

/**
 * A lesson exercise in two rounds. In the guided round the reader types each command of the script,
 * with the command shown. In the second round they do the same steps from a task list, without the
 * commands, and check their end state against the goal.
 */
export function Exercise({ start, steps, views }: { start: World; steps: Step[]; views: View[] }) {
  const plays = useMemo(() => playSteps(start, steps), [start, steps])
  const [mode, setMode] = useState<'guided' | 'solo'>('guided')
  const tabs = (
    <div role="tablist" aria-label="Exercise mode" className="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
      {(['guided', 'solo'] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => setMode(m)}
          className={`rounded-md px-3 py-1 ${mode === m ? 'bg-accent font-semibold text-white' : 'text-ink-2 hover:bg-grid'}`}
        >
          {m === 'guided' ? '1. With a guide' : '2. On your own'}
        </button>
      ))}
    </div>
  )
  return (
    <section className="my-8 rounded-2xl border border-line bg-page p-3 sm:p-4" aria-label="Exercise">
      {mode === 'guided' ? (
        <Guided plays={plays} steps={steps} views={views} tabs={tabs} onFinish={() => setMode('solo')} />
      ) : (
        <Solo start={start} goal={plays.at(-1)!.frames.at(-1)?.world ?? plays.at(-1)!.before} steps={steps} views={views} tabs={tabs} />
      )}
    </section>
  )
}

// Sticks below the site header, so the buttons stay in reach in tall exercises.
function Controls({ children }: { children: ReactNode }) {
  return <div className="sticky top-[57px] z-10 -mx-3 mb-3 flex flex-wrap items-center gap-2 bg-page px-3 py-2 sm:-mx-4 sm:px-4">{children}</div>
}

function Guided({ plays, steps, views, tabs, onFinish }: { plays: Play[]; steps: Step[]; views: View[]; tabs: ReactNode; onFinish: () => void }) {
  const [i, setI] = useState(0)
  // How many actions of step i are done.
  const [done, setDone] = useState(0)
  const [input, setInput] = useState('')
  const [miss, setMiss] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const play = plays[i]!
  const actions = asList(steps[i]!.do)
  const total = play.frames.length
  const pending = done < total ? actions[done]! : null
  const last = i === steps.length - 1

  const go = (next: number) => {
    setI(next)
    setDone(0)
    setInput('')
    setMiss(false)
  }
  const focus = () => inputRef.current?.focus({ preventScroll: true })
  const onEnter = (typed: string) => {
    if (pending === null) return last ? onFinish() : go(i + 1)
    if (typeof pending !== 'string' || norm(typed) === norm(pending)) {
      setDone(done + 1)
      setInput('')
      setMiss(false)
    } else setMiss(true)
  }
  const press = () => {
    onEnter(input)
    focus()
  }

  const world = done === 0 ? play.before : play.frames[done - 1]!.world
  const flow = flowOf(actions[done - 1], play.frames[done - 1])
  const everyWorld = plays.flatMap((p) => [p.before, ...p.frames.map((f) => f.world)])
  const log = actions.slice(0, done).map((a, k) => toEntry(a, play.frames[k]!))

  return (
    <>
      <Controls>
        {tabs}
        <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-grid">
          <motion.div className="h-full bg-accent" animate={{ width: `${((i + (pending === null ? 1 : 0)) / steps.length) * 100}%` }} />
        </div>
        <span className="w-20 text-right text-xs text-muted tabular-nums">
          Step {i + 1} of {steps.length}
        </span>
        <button onClick={() => go(i - 1)} disabled={i === 0} className={buttonClass}>
          Back
        </button>
        <button onClick={() => go(0)} disabled={i === 0 && done === 0} className={buttonClass}>
          Start over
        </button>
      </Controls>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Reserve
            all={steps.map((s, k) => (
              <div key={k} className={captionClass}>
                {s.say}
              </div>
            ))}
            live={
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={captionClass}>
                {steps[i]!.say}
              </motion.div>
            }
          />
          <div className="mt-auto">
            <button onClick={press} disabled={typeof pending === 'string'} className={`${primaryClass} w-full sm:w-auto`}>
              {typeof pending === 'string' ? 'Type the command, then press Enter' : pending ? 'Do it' : last ? 'Practice on your own' : 'Continue'}
            </button>
          </div>
        </div>
        <Terminal
          log={log}
          input={input}
          setInput={(s) => {
            setInput(s)
            setMiss(false)
          }}
          onEnter={onEnter}
          inputRef={inputRef}
          allowEmpty={typeof pending !== 'string'}
          className={terminalHeight}
          placeholder={typeof pending === 'string' ? 'type the command here' : 'press Enter'}
          hint={<GuideHint pending={pending} input={input} miss={miss} first={i === 0} last={last} />}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {views.map((v) =>
          v === 'remote' ? (
            <RemoteView key={v} world={world} flow={flow} reserve={everyWorld} />
          ) : (
            <Panel key={v} title={viewTitle(v)}>
              <Reserve all={everyWorld.map((w, k) => <ViewBody key={k} view={v} world={w} />)} live={<ViewBody view={v} world={world} />} />
            </Panel>
          ),
        )}
      </div>
    </>
  )
}

/** The line in the guided terminal that says what to do next. While the reader types, right letters turn green. */
function GuideHint({ pending, input, miss, first, last }: { pending: Action | null; input: string; miss: boolean; first: boolean; last: boolean }) {
  if (pending === null) {
    return <div className="text-[#e5a50a]"># {first ? 'Press Enter to start.' : last ? 'Done. Press Enter to try it on your own.' : 'Press Enter to go on.'}</div>
  }
  if (typeof pending !== 'string') return <div className="text-[#e5a50a]"># Next: {eventText(pending)} Press Enter.</div>
  const k = typedRight(input, pending)
  const wrong = input.trimStart().length > k
  return (
    <div>
      <div className="text-[#e5a50a]"># Type this command:</div>
      <div className="whitespace-pre-wrap">
        <span className="text-[#0ca30c]">{pending.slice(0, k)}</span>
        <span className={wrong ? 'rounded-sm bg-[#e66767] text-[#141413]' : 'underline'}>{pending.slice(k, k + 1)}</span>
        <span className="text-[#898781]">{pending.slice(k + 1)}</span>
      </div>
      {(miss || wrong) && <div className="text-[#e66767]"># {miss && !wrong ? 'Not finished. Type the rest of the command.' : 'Check the red letter.'}</div>}
    </div>
  )
}

function Solo({ start, goal, steps, views, tabs }: { start: World; goal: World; steps: Step[]; views: View[]; tabs: ReactNode }) {
  const intro: Entry = { cmd: 'Do the tasks one by one. Type "help" for a list of commands.', note: true, output: [], ok: true }
  const [world, setWorld] = useState(start)
  const [log, setLog] = useState<Entry[]>([intro])
  const [input, setInput] = useState('')
  // Events the reader already triggered, as "step:action".
  const [used, setUsed] = useState<string[]>([])
  const [result, setResult] = useState<string[] | null>(null)
  const [showGoal, setShowGoal] = useState(false)
  const [answers, setAnswers] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const apply = (a: Action) => {
    const r = run(world, a)
    setWorld(r.world)
    setLog((l) => [...l, toEntry(a, r)])
    setResult(null)
  }
  const onEnter = (typed: string) => {
    setInput('')
    if (typed.trim() === 'clear') return setLog([])
    apply(typed.trim())
  }
  const reset = () => {
    setWorld(start)
    setLog([intro])
    setUsed([])
    setResult(null)
  }

  const items = steps.map((s, k) => ({ s, k })).filter(({ s }) => asList(s.do).length)
  const shown = showGoal ? goal : world

  return (
    <>
      <Controls>
        {tabs}
        <span className="flex-1" />
        <button onClick={reset} className={buttonClass}>
          Start over
        </button>
        <button onClick={() => setResult(differences(world, goal))} className={primaryClass}>
          Check my work
        </button>
      </Controls>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-2">
            {items.map(({ s, k }, n) => (
              <li key={k} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-2">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-ink tabular-nums">
                  {n + 1}
                </span>
                <div className={`min-w-0 ${captionClass}`}>
                  {/* Buttons and the task follow the order of the actions, so an edit that comes first shows first. */}
                  {asList(s.do).map((a, j, all) =>
                    typeof a === 'string' ? (
                      <div key={j}>
                        {all.findIndex((x) => typeof x === 'string') === j && s.task}
                        {answers && <code className="mt-1 block w-fit text-[13px]">{a}</code>}
                      </div>
                    ) : (
                      <button
                        key={j}
                        disabled={used.includes(`${k}:${j}`)}
                        onClick={() => {
                          apply(a)
                          setUsed((u) => [...u, `${k}:${j}`])
                          inputRef.current?.focus({ preventScroll: true })
                        }}
                        className="mt-1 block rounded-md border border-line bg-surface px-2.5 py-1 text-left text-sm text-ink hover:bg-grid disabled:opacity-50"
                      >
                        {used.includes(`${k}:${j}`) ? '✓ ' : ''}
                        {eventText(a)}
                      </button>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ol>
          <button onClick={() => setAnswers(!answers)} className="w-fit text-sm text-accent underline-offset-2 hover:underline">
            {answers ? 'Hide the commands' : 'Stuck? Show the commands'}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Terminal log={log} input={input} setInput={setInput} onEnter={onEnter} inputRef={inputRef} className={terminalHeight} />
          {result && <CheckResult problems={result} />}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-2">The diagrams show</span>
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {[false, true].map((g) => (
              <button
                key={String(g)}
                onClick={() => setShowGoal(g)}
                aria-pressed={showGoal === g}
                className={`rounded-md px-2.5 py-0.5 ${showGoal === g ? 'bg-grid font-medium text-ink' : 'text-ink-2 hover:bg-grid'}`}
              >
                {g ? 'the goal' : 'your work'}
              </button>
            ))}
          </div>
        </div>
        {views.map((v) =>
          v === 'remote' ? (
            <RemoteView key={v} world={shown} flow={null} />
          ) : (
            <Panel key={v} title={viewTitle(v)}>
              <ViewBody view={v} world={shown} />
            </Panel>
          ),
        )}
      </div>
    </>
  )
}

function CheckResult({ problems }: { problems: string[] }) {
  if (!problems.length) {
    return (
      <div role="status" className="rounded-xl border border-good/40 bg-good/10 p-3 text-sm font-medium text-good-ink">
        ✓ Your work matches the goal. Well done.
      </div>
    )
  }
  return (
    <div role="status" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-ink">
      <div className="font-medium">Not yet. {problems.length === 1 ? 'One thing is' : `${problems.length} things are`} different:</div>
      <ul className="mt-1 list-disc pl-5 text-ink-2">
        {problems.slice(0, 5).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {problems.length > 5 && <div className="mt-1 text-ink-2">And {problems.length - 5} more.</div>}
    </div>
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
