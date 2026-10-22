import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { CourseLayout, PageHeader, cardClass } from '../components/Page'
import { lessons, lessonsIn, parts } from '../lessons/registry'

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
  const part = parts.find((p) => p.id === lesson.part)!
  const inPart = lessonsIn(lesson.part)

  return (
    <CourseLayout>
      <PageHeader eyebrow={`${part.title} · lesson ${inPart.findIndex((l) => l.id === lesson.id) + 1} of ${inPart.length}`} title={lesson.title} />
      <article className="prose-lesson">
        <lesson.Component key={lesson.id} />
      </article>

      <nav className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {prev ? (
          <Link to="/learn/$lessonId" params={{ lessonId: prev.id }} className={cardClass}>
            <div className="text-xs text-muted">Back</div>
            <div className="font-medium">{prev.title}</div>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to="/learn/$lessonId" params={{ lessonId: next.id }} className={`${cardClass} text-right`}>
            <div className="text-xs text-muted">Next lesson</div>
            <div className="font-medium">{next.title}</div>
          </Link>
        ) : (
          <Link to="/playground" className={`${cardClass} text-right`}>
            <div className="text-xs text-muted">Now try it</div>
            <div className="font-medium">Open the playground</div>
          </Link>
        )}
      </nav>
    </CourseLayout>
  )
}
