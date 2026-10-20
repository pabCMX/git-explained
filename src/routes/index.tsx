import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { LocalGraph } from '../components/GraphViews'
import { run, type World } from '../git/sim'
import { lessons } from '../lessons/registry'
import { BREAD, built, recipe, SOUP } from '../lessons/worlds'

export const Route = createFileRoute('/')({ component: Home })

// A short story that plays on a loop: commit, branch, commit on both, merge.
const story = [
  'git commit -am "Less salt"',
  'git switch -c spicy',
  'git commit -am "Add chili"',
  'git commit -am "More heat"',
  'git switch main',
  'git commit -am "Fix bread"',
  'git merge spicy',
  'git commit -am "Serve hot"',
]
const heroStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, ['git init', 'git add .', 'git commit -m "First recipes"'])
const heroFrames = story.reduce<World[]>(
  (frames, action, i) => {
    // Each commit needs a file change first, so the demo writes a new line before it.
    const prev = frames[frames.length - 1]!
    const path = action.includes('bread') ? 'bread.txt' : 'soup.txt'
    const edited = action.includes('commit') ? run(prev, { kind: 'write', path, content: recipe('Draft', `step ${i}`) }).world : prev
    return [...frames, run(edited, action).world]
  },
  [heroStart],
)

function Home() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % (heroFrames.length + 2)), 1400)
    return () => clearInterval(t)
  }, [])
  const world = heroFrames[Math.min(frame, heroFrames.length - 1)]!

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">Learn Git from the start.</h1>
          <p className="mt-4 max-w-lg text-lg text-ink-2">
            Git keeps the full history of your files. You can go back to any version, try ideas without risk, and work on the
            same files with other people. These lessons show how it works, step by step. You do not need to know how to
            program.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/learn/$lessonId"
              params={{ lessonId: 'why' }}
              className="rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:opacity-90"
            >
              Start lesson 1
            </Link>
            <Link to="/playground" className="rounded-lg border border-line bg-surface px-5 py-3 font-medium hover:bg-grid">
              Open the playground
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">A history graph</div>
          <div className="min-h-[220px]">
            <LocalGraph world={world} />
          </div>
          <p className="mt-2 text-sm text-ink-2">
            Each dot is a saved version. The orange line is a branch for an experiment. It joins main again with a merge.
          </p>
        </div>
      </section>

      <h2 className="mb-4 text-xl font-semibold">Lessons</h2>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l, i) => (
          <li key={l.id}>
            <Link
              to="/learn/$lessonId"
              params={{ lessonId: l.id }}
              className="flex h-full gap-3 rounded-xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold tabular-nums">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold">{l.title}</span>
                <span className="mt-1 block text-sm text-ink-2">{l.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link to="/playground" className="rounded-xl border border-line bg-surface p-5 hover:shadow-md">
          <div className="font-semibold">Playground</div>
          <div className="mt-1 text-sm text-ink-2">Type real Git commands on a pretend folder and watch the diagrams change.</div>
        </Link>
        <Link to="/cheatsheet" className="rounded-xl border border-line bg-surface p-5 hover:shadow-md">
          <div className="font-semibold">Cheat sheet</div>
          <div className="mt-1 text-sm text-ink-2">The common commands on one page, in plain words.</div>
        </Link>
      </div>
    </main>
  )
}
