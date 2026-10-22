import { describe, expect, it } from 'vitest'
import { asList } from '../components/Exercise'
import { differences } from '../git/check'
import { runAll, type Action } from '../git/sim'
import * as basics from './basics'
import * as branching from './branching'
import * as repair from './repair'
import * as sharing from './sharing'
import * as team from './team'

// Every lesson step must succeed, unless the step says it is meant to fail.
describe('lesson scripts', () => {
  const all = [basics, branching, sharing, team, repair].flatMap((m) => m.scripts)
  it.each(all.map((s, i) => [i, s] as const))('script %i shows the start before its first command', (_, { steps }) => {
    expect(steps[0]!.do).toBeUndefined()
  })

  // The "on your own" round shows the task, not the command, so each step with a command needs one.
  it.each(all.map((s, i) => [i, s] as const))('script %i has a task for each step with a command', (_, { steps }) => {
    const missing = steps.flatMap((s, n) => (asList(s.do).some((a) => typeof a === 'string') && !s.task ? [n] : []))
    expect(missing).toEqual([])
  })

  it.each(all.map((s, i) => [i, s] as const))('script %i runs as written', (_, { start, steps }) => {
    let w = start
    steps.forEach((step, n) => {
      const r = runAll(w, asList(step.do))
      expect({ step: n, ok: r.ok, output: r.output }).toMatchObject({ step: n, ok: !step.fails })
      w = r.world
    })
  })
})

// A reader who does every step with their own commit messages must pass "Check my work".
describe('check my work', () => {
  const all = [basics, branching, sharing, team, repair].flatMap((m) => m.scripts)
  const play = ({ start, steps }: (typeof all)[number], edit: (a: Action) => Action) =>
    steps.reduce((w, s) => runAll(w, asList(s.do).map(edit)).world, start)
  const ownWords = (a: Action) => (typeof a === 'string' ? a.replace(/(-a?m) "[^"]*"/, '$1 "my own words"') : a)

  it.each(all.map((s, i) => [i, s] as const))('script %i accepts other commit messages', (_, script) => {
    expect(differences(play(script, ownWords), play(script, (a) => a))).toEqual([])
  })
})
