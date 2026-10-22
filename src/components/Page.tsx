import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { lessonsIn, parts } from '../lessons/registry'

// One card style for every link card: lesson list, lesson navigation, cheat sheet groups.
export const cardClass = 'rounded-xl border border-line bg-surface p-4 hover:bg-grid'
export const primaryButton = 'rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:opacity-90'
export const secondaryButton = 'rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:bg-grid'

/** The page frame with the list of lessons on the left. The list hides on small screens. */
export function CourseLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 pb-24">
      <aside className="sticky top-16 hidden h-fit max-h-[calc(100vh-5rem)] w-60 shrink-0 overflow-y-auto py-10 lg:block">
        {parts.map((part) => (
          <div key={part.id} className="mb-6">
            <div className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">{part.title}</div>
            <ol className="flex flex-col gap-0.5">
              {lessonsIn(part.id).map((l) => (
                <li key={l.id}>
                  <Link
                    to="/learn/$lessonId"
                    params={{ lessonId: l.id }}
                    className="flex gap-2 rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-grid"
                    activeProps={{ className: 'bg-grid font-medium text-ink' }}
                  >
                    <span className="w-4 shrink-0 text-right text-muted tabular-nums">{l.n}</span>
                    {l.title}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </aside>
      <main className="min-w-0 flex-1 py-10">{children}</main>
    </div>
  )
}

/** The top of every page: a small line of context, the title, and an optional intro. */
export function PageHeader({ eyebrow, title, children }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-4">
      <div className="text-sm text-muted">{eyebrow}</div>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {children && <div className="prose-lesson">{children}</div>}
    </header>
  )
}
