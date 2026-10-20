import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Git, from the start' },
      { name: 'description', content: 'Learn Git from first principles, with animated diagrams. No programming needed.' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-accent underline">
        Go to the start page
      </Link>
    </div>
  ),
})

function RootComponent() {
  return (
    <RootDocument>
      <header className="sticky top-0 z-20 border-b border-line bg-page/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 sm:gap-4">
          <Link to="/" aria-label="Git, from the start" className="mr-auto flex items-center gap-2 font-semibold">
            <Logo />
            <span className="hidden sm:inline">Git, from the start</span>
          </Link>
          <Link to="/learn/$lessonId" params={{ lessonId: 'why' }} {...nav}>
            Lessons
          </Link>
          <Link to="/playground" {...nav}>
            Playground
          </Link>
          <Link to="/cheatsheet" {...nav}>
            Cheat sheet
          </Link>
        </nav>
      </header>
      <Outlet />
    </RootDocument>
  )
}

const nav = {
  className: 'rounded-md px-2.5 py-1.5 text-sm text-ink-2 hover:bg-grid',
  activeProps: { className: 'bg-grid text-ink font-medium' },
}

const Logo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path d="M6 5v14M6 12c0-4 12-2 12-7" fill="none" stroke="var(--lane-0)" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="6" cy="5" r="3" fill="var(--lane-0)" />
    <circle cx="6" cy="19" r="3" fill="var(--lane-0)" />
    <circle cx="18" cy="5" r="3" fill="var(--lane-1)" />
  </svg>
)

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
