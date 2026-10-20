import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AreasDiagram } from '../components/AreasDiagram'
import { LocalGraph, Panel, RemoteView } from '../components/GraphViews'
import { OutputLines } from '../components/ScriptedDemo'
import { emptyWorld, headId, run, status, treeOf, type Action, type World } from '../git/sim'
import { BREAD, SOUP } from '../lessons/worlds'

export const Route = createFileRoute('/playground')({
  head: () => ({ meta: [{ title: 'Playground · Git, from the start' }] }),
  component: Playground,
})

type Entry = { cmd: string; output: string[]; ok: boolean }

const START = emptyWorld({ 'soup.txt': SOUP, 'bread.txt': BREAD })
const WELCOME: Entry = {
  cmd: '',
  ok: true,
  output: ['This folder has two recipes. Git does not track it yet.', 'Type "git init" to start, or "help" for all commands.'],
}

function Playground() {
  const [world, setWorld] = useState(START)
  const [log, setLog] = useState<Entry[]>([WELCOME])
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const exec = (cmd: string) => {
    if (cmd.trim() === 'clear') return setLog([])
    const r = run(world, cmd)
    setWorld(r.world)
    setLog((l) => [...l, { cmd, output: r.output, ok: r.ok }])
  }
  const apply = (a: Action) => setWorld((w) => run(w, a).world)
  const reset = () => {
    setWorld(START)
    setLog([WELCOME])
  }
  const suggest = (cmd: string) => {
    setInput(cmd)
    inputRef.current?.focus()
  }

  const samPush = () => {
    const tip = world.remote?.branches.main
    const bread = treeOf(world, tip)['bread.txt'] ?? BREAD
    const n = Object.values(world.commits).filter((c) => c.message.startsWith('Note from Sam')).length + 1
    const r = run(world, { kind: 'teammate', path: 'bread.txt', content: `${bread}Note from Sam #${n}.\n`, message: `Note from Sam #${n}` })
    setWorld(r.world)
    setLog((l) => [...l, { cmd: '', output: r.output, ok: r.ok }])
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
          <p className="mt-1 text-ink-2">A pretend folder in your browser. Try any command. Nothing here can break.</p>
        </div>
        <div className="flex gap-2">
          {world.remote?.branches.main && (
            <button onClick={samPush} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-grid">
              Sam pushes a change
            </button>
          )}
          <button onClick={reset} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-grid">
            Start over
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Terminal log={log} input={input} setInput={setInput} onRun={exec} inputRef={inputRef} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions(world).map((s) => (
              <button
                key={s}
                onClick={() => suggest(s)}
                className="rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-2 hover:bg-grid"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <FileEditor world={world} apply={apply} />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Panel title="Where your changes are">
          <AreasDiagram world={world} />
        </Panel>
        {world.local.origin ? (
          <RemoteView world={world} flow={null} />
        ) : (
          <Panel title="History graph">
            <LocalGraph world={world} />
          </Panel>
        )}
      </div>
    </main>
  )
}

/** Next commands that make sense in the current state. A click puts the command in the input. */
function suggestions(w: World): string[] {
  if (!w.initialized) return ['git init', 'help']
  const s = status(w)
  const out = ['git status']
  if (w.local.merging) return [...out, 'git add .', 'git commit', 'git merge --abort']
  if (s.unstaged.length || s.untracked.length) out.push('git add .', 'git diff')
  if (headId(w) && (s.unstaged.length || s.staged.length)) out.push('git stash')
  if (w.local.stash.length) out.push('git stash pop')
  if (s.staged.length) out.push('git commit -m "Describe your change"', 'git restore --staged .')
  if (headId(w)) {
    out.push('git log', 'git branch', 'git switch -c idea', 'git reflog')
    if (Object.keys(w.local.branches).length > 1) out.push('git switch main', 'git merge idea')
    if (w.local.origin) out.push('git push', 'git pull')
    else out.push('git remote add origin github.com/you/cookbook')
  }
  return out
}

function Terminal({
  log,
  input,
  setInput,
  onRun,
  inputRef,
}: {
  log: Entry[]
  input: string
  setInput: (s: string) => void
  onRun: (cmd: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const end = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const past = log.map((e) => e.cmd).filter(Boolean)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [log])

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      onRun(input)
      setInput('')
      setCursor(null)
    } else if (e.key === 'ArrowUp' && past.length) {
      e.preventDefault()
      const c = cursor === null ? past.length - 1 : Math.max(0, cursor - 1)
      setCursor(c)
      setInput(past[c]!)
    } else if (e.key === 'ArrowDown' && cursor !== null) {
      e.preventDefault()
      const c = cursor + 1
      setCursor(c < past.length ? c : null)
      setInput(c < past.length ? past[c]! : '')
    }
  }

  return (
    <div
      className="flex h-[380px] flex-col rounded-xl bg-[#141413] p-3 font-mono text-[13px] leading-6 text-[#f0efec]"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto">
        {log.map((e, i) => (
          <div key={i} className="mb-1">
            {e.cmd && (
              <div>
                <span className="text-[#5598e7]">cookbook $ </span>
                {e.cmd}
              </div>
            )}
            <OutputLines lines={e.output} ok={e.ok} />
          </div>
        ))}
        <div ref={end} />
      </div>
      <label className="flex items-center gap-2 border-t border-white/10 pt-2">
        <span className="text-[#5598e7]">cookbook $</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          placeholder="type a command, then press Enter"
          aria-label="Command"
          className="flex-1 bg-transparent outline-none placeholder:text-[#898781]"
        />
      </label>
    </div>
  )
}

function FileEditor({ world, apply }: { world: World; apply: (a: Action) => void }) {
  const files = Object.keys(world.local.working).sort()
  const [open, setOpen] = useState(files[0] ?? '')
  const [newName, setNewName] = useState('')
  const current = files.includes(open) ? open : files[0]

  const create = () => {
    const name = newName.trim()
    if (!name || name in world.local.working) return
    apply({ kind: 'write', path: name, content: '' })
    setOpen(name)
    setNewName('')
  }

  return (
    <div className="flex h-full min-h-[380px] flex-col rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap gap-1 border-b border-line p-2">
        {files.map((f) => (
          <button
            key={f}
            onClick={() => setOpen(f)}
            className={`rounded-md px-2 py-1 font-mono text-xs ${f === current ? 'bg-grid text-ink' : 'text-ink-2 hover:bg-grid'}`}
          >
            {f}
          </button>
        ))}
      </div>
      {current ? (
        <>
          <textarea
            value={world.local.working[current] ?? ''}
            onChange={(e) => apply({ kind: 'write', path: current, content: e.target.value })}
            spellCheck={false}
            aria-label={`Contents of ${current}`}
            className="min-h-48 flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-6 outline-none"
          />
          <div className="flex justify-between gap-2 border-t border-line p-2">
            <span className="self-center px-1 text-xs text-muted">Edits save to the folder at once.</span>
            <button onClick={() => apply({ kind: 'delete', path: current })} className="rounded-md px-2 py-1 text-xs text-bad hover:bg-grid">
              Delete file
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 p-3 text-sm text-muted">The folder is empty.</div>
      )}
      <form
        className="flex gap-2 border-t border-line p-2"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="new-file.txt"
          aria-label="New file name"
          className="min-w-0 flex-1 rounded-md border border-line bg-page px-2 py-1 font-mono text-xs outline-none focus:border-accent"
        />
        <button className="rounded-md bg-accent px-3 py-1 text-xs font-semibold text-white">New file</button>
      </form>
    </div>
  )
}
