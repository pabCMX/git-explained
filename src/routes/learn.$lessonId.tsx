import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { lessons } from '../lessons/registry'

export const Route = createFileRoute('/learn/$lessonId')({
  loader: ({ params }) => {
    const index = lessons.findIndex((l) => l.id === params.lessonId)
    if (index < 0) throw notFound()
    return { index }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${lessons[loaderData.index]!.title} · Git, from the start` : 'Git, from the start' }],
  }),
  component: LessonPage,
})

function LessonPage() {
  const { index } = Route.useLoaderData()
  const lesson = lessons[index]!
  const prev = lessons[index - 1]
  const next = lessons[index + 1]

  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-4 pb-24">
      <aside className="sticky top-16 hidden h-fit w-56 shrink-0 py-10 lg:block">
        <ol className="flex flex-col gap-0.5">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <Link
                to="/learn/$lessonId"
                params={{ lessonId: l.id }}
                className="flex gap-2 rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-grid"
                activeProps={{ className: 'bg-grid font-medium text-ink' }}
              >
                <span className="w-4 text-right text-muted tabular-nums">{i + 1}</span>
                {l.title}
              </Link>
            </li>
          ))}
        </ol>
      </aside>

      <main className="min-w-0 flex-1 py-10">
        <div className="text-sm text-muted">
          Lesson {index + 1} of {lessons.length}
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{lesson.title}</h1>
        <article className="prose-lesson mt-4">
          <lesson.Component key={lesson.id} />
        </article>

        <nav className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <Link to="/learn/$lessonId" params={{ lessonId: prev.id }} className="rounded-xl border border-line bg-surface p-4 hover:bg-grid">
              <div className="text-xs text-muted">Back</div>
              <div className="font-medium">{prev.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to="/learn/$lessonId"
              params={{ lessonId: next.id }}
              className="rounded-xl border border-line bg-surface p-4 text-right hover:bg-grid"
            >
              <div className="text-xs text-muted">Next lesson</div>
              <div className="font-medium">{next.title}</div>
            </Link>
          ) : (
            <Link to="/playground" className="rounded-xl border border-line bg-surface p-4 text-right hover:bg-grid">
              <div className="text-xs text-muted">Now try it</div>
              <div className="font-medium">Open the playground</div>
            </Link>
          )}
        </nav>
      </main>
    </div>
  )
}
