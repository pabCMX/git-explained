import { describe, expect, it } from 'vitest'
import { differences } from './check'
import { emptyWorld, runAll, type Action } from './sim'

const start = emptyWorld({ 'a.txt': 'one\n' })
const play = (actions: Action[]) => {
  const r = runAll(start, actions)
  expect(r.ok).toBe(true)
  return r.world
}

describe('differences', () => {
  const goal = play(['git init', 'git add a.txt', 'git commit -m "First"', 'git switch -c idea'])

  it('accepts other messages and other commands with the same result', () => {
    const you = play(['git init', 'git add .', 'git commit -m "my own words"', 'git branch idea', 'git switch idea'])
    expect(differences(you, goal)).toEqual([])
  })

  it('names a missing branch and the wrong current branch', () => {
    const you = play(['git init', 'git add a.txt', 'git commit -m "First"'])
    expect(differences(you, goal)).toEqual(['There is no branch idea. The goal has one.', 'You are on the branch main. The goal is on the branch idea.'])
  })

  it('counts commits and finds uncommitted files', () => {
    const you = play(['git init', 'git add a.txt', 'git commit -m "First"', 'git switch -c idea', { kind: 'write', path: 'a.txt', content: 'two\n' }, 'git commit -am "Two"'])
    expect(differences(you, goal)).toEqual([
      'The branch idea has 2 commits. The goal has 1.',
      'The file a.txt in your folder is different from the goal.',
      'The file a.txt in the staging area is different from the goal.',
    ])
  })

  it('checks the remote side', () => {
    const remoteGoal = runAll(goal, ['git remote add origin example.com/repo', 'git push']).world
    const you = runAll(goal, ['git remote add origin example.com/repo']).world
    expect(differences(you, remoteGoal)).toContain('On the remote, there is no branch idea. The goal has one.')
  })
})
