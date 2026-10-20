import { describe, expect, it } from 'vitest'
import { runAll } from '../git/sim'
import * as basics from './basics'
import * as branching from './branching'
import * as repair from './repair'
import * as sharing from './sharing'
import * as team from './team'

// Every lesson step must succeed, unless the step says it is meant to fail.
describe('lesson scripts', () => {
  const all = [basics, branching, sharing, team, repair].flatMap((m) => m.scripts)
  it.each(all.map((s, i) => [i, s] as const))('script %i runs as written', (_, { start, steps }) => {
    let w = start
    steps.forEach((step, n) => {
      const actions = step.do === undefined ? [] : Array.isArray(step.do) ? step.do : [step.do]
      const r = runAll(w, actions)
      expect({ step: n, ok: r.ok, output: r.output }).toMatchObject({ step: n, ok: !step.fails })
      w = r.world
    })
  })
})
