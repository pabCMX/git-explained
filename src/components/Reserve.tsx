import type { ReactNode } from 'react'

/**
 * Keeps a block as tall as its tallest version, so the content below never jumps.
 * Every version in `all` renders invisibly in the same grid cell, and `live` sits on top.
 */
export function Reserve({ live, all }: { live: ReactNode; all: ReactNode[] }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] *:col-start-1 *:row-start-1">
      {all.map((node, k) => (
        <div key={k} className="invisible" aria-hidden inert>
          {node}
        </div>
      ))}
      <div className="min-w-0">{live}</div>
    </div>
  )
}
