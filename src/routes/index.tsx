import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { LocalGraph, Panel } from '../components/GraphViews'
import { CourseLayout, PageHeader, cardClass, primaryButton, secondaryButton } from '../components/Page'
import { run, type World } from '../git/sim'
import { lessons, lessonsIn, parts } from '../lessons/registry'
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
    <CourseLayout>
      <PageHeader eyebrow={`A free course · ${lessons.length} lessons`} title="Learn Git from the start.">
        <p>
          Git keeps the full history of your files. You can go back to any version, try ideas without risk, and work on the
          same files with other people. You do not need to know how to program.
        </p>
      </PageHeader>
      <div className="flex flex-wrap gap-3">
        <Link to="/learn/$lessonId" params={{ lessonId: 'why' }} className={primaryButton}>
          Start lesson 1
        </Link>
        <Link to="/playground" className={secondaryButton}>
          Open the playground
        </Link>
      </div>

      <section className="my-8 rounded-2xl border border-line bg-page p-3 sm:p-4" aria-label="Example">
        <Panel title="A history graph">
          <div className="min-h-[220px]">
            <LocalGraph world={world} />
          </div>
        </Panel>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Each dot is a saved version. The orange line is a branch for an experiment. It joins main again with a merge.
        </p>
      </section>

      <h2 className="mt-10 text-xl font-semibold">How each lesson works</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ['Read', 'A short explanation of one idea, with diagrams.'],
          ['Type with a guide', 'You type each command. The guide shows it, and the diagrams show what it does.'],
          ['Do it on your own', 'You do the same steps from a task list. Then Check my work tells you if you got it right.'],
        ].map(([title, text], i) => (
          <li key={title} className="rounded-xl border border-line bg-surface p-4">
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold tabular-nums">{i + 1}</span>
            <div className="mt-2 font-semibold">{title}</div>
            <div className="mt-1 text-sm text-ink-2">{text}</div>
          </li>
        ))}
      </ol>

      {parts.map((part) => (
        <section key={part.id} className="mt-10">
          <h2 className="text-xl font-semibold">{part.title}</h2>
          <p className="mt-1 mb-3 text-sm text-ink-2">{part.summary}</p>
          <ol className="grid gap-3 sm:grid-cols-2">
            {lessonsIn(part.id).map((l) => (
              <li key={l.id}>
                <Link to="/learn/$lessonId" params={{ lessonId: l.id }} className={`${cardClass} flex h-full gap-3`}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold tabular-nums">
                    {l.n}
                  </span>
                  <span>
                    <span className="block font-medium">{l.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-2">{l.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <h2 className="mt-10 text-xl font-semibold">Tools</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link to="/playground" className={cardClass}>
          <div className="font-medium">Playground</div>
          <div className="mt-0.5 text-sm text-ink-2">Type any Git command on a pretend folder and watch the diagrams change.</div>
        </Link>
        <Link to="/cheatsheet" className={cardClass}>
          <div className="font-medium">Cheat sheet</div>
          <div className="mt-0.5 text-sm text-ink-2">The common commands on one page, in plain words.</div>
        </Link>
      </div>
    </CourseLayout>
  )
}
