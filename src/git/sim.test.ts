import { describe, expect, it } from 'vitest'
import { emptyWorld, headId, runAll, status } from './sim'

const start = () => runAll(emptyWorld({ 'soup.txt': 'water\nsalt\n' }), ['git init', 'git add .', 'git commit -m "First soup"'])

describe('sim', () => {
  it('moves changes from folder to staging area to a commit', () => {
    let r = runAll(start().world, [{ kind: 'write', path: 'soup.txt', content: 'water\nsalt\nleeks\n' }])
    expect(status(r.world).unstaged).toEqual([{ path: 'soup.txt', kind: 'modified' }])
    r = runAll(r.world, ['git add soup.txt'])
    expect(status(r.world).staged).toEqual([{ path: 'soup.txt', kind: 'modified' }])
    r = runAll(r.world, ['git commit -m "Add leeks"'])
    expect(r.ok).toBe(true)
    expect(status(r.world).staged).toEqual([])
    expect(r.world.commits[headId(r.world)!]!.parents).toHaveLength(1)
  })

  it('fast-forwards when main has not moved', () => {
    const r = runAll(start().world, [
      'git switch -c spicy',
      { kind: 'write', path: 'soup.txt', content: 'water\nsalt\nchili\n' },
      'git commit -am "Chili"',
      'git switch main',
      'git merge spicy',
    ])
    expect(r.output).toContain('Fast-forward')
    expect(r.world.local.branches.main).toBe(r.world.local.branches.spicy)
  })

  it('marks a conflict and needs a fix before the merge commit', () => {
    let r = runAll(start().world, [
      'git switch -c spicy',
      { kind: 'write', path: 'soup.txt', content: 'water\nchili\n' },
      'git commit -am "Chili"',
      'git switch main',
      { kind: 'write', path: 'soup.txt', content: 'water\npepper\n' },
      'git commit -am "Pepper"',
      'git merge spicy',
    ])
    expect(r.ok).toBe(false)
    expect(r.world.local.working['soup.txt']).toBe('water\n<<<<<<< HEAD\npepper\n=======\nchili\n>>>>>>> spicy')
    expect(runAll(r.world, ['git commit -m "Merge"']).ok).toBe(false)
    r = runAll(r.world, [{ kind: 'write', path: 'soup.txt', content: 'water\npepper\nchili\n' }, 'git add soup.txt', 'git commit'])
    expect(r.ok).toBe(true)
    expect(r.world.commits[headId(r.world)!]!.parents).toHaveLength(2)
  })

  it('rejects a push when the remote has new commits', () => {
    let r = runAll(start().world, ['git remote add origin https://example.com/soup.git', 'git push'])
    r = runAll(r.world, [
      { kind: 'teammate', path: 'soup.txt', content: 'water\nsalt\nonion\n', message: 'Onion' },
      { kind: 'write', path: 'notes.txt', content: 'serve hot\n' },
      'git add .',
      'git commit -m "Notes"',
    ])
    expect(runAll(r.world, ['git push']).ok).toBe(false)
    r = runAll(r.world, ['git pull', 'git push'])
    expect(r.ok).toBe(true)
    expect(r.world.remote!.branches.main).toBe(headId(r.world))
  })

  it('revert makes a new commit that undoes an old one', () => {
    const r = runAll(start().world, [
      { kind: 'write', path: 'soup.txt', content: 'water\nsalt\nsugar\n' },
      'git commit -am "Sugar"',
      'git revert HEAD',
    ])
    expect(r.ok).toBe(true)
    expect(r.world.local.working['soup.txt']).toBe('water\nsalt\n')
    expect(r.world.counter).toBe(3)
  })
})
