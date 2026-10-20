import { describe, expect, it } from 'vitest'
import { bisectSuspects } from './advanced'
import { blame, emptyWorld, headId, runAll, status, type Action } from './sim'

const write = (path: string, content: string): Action => ({ kind: 'write', path, content })
const start = () => runAll(emptyWorld({ 'soup.txt': 'water\nsalt\n', 'bread.txt': 'flour\n' }), ['git init', 'git add .', 'git commit -m "First"']).world

describe('advanced commands', () => {
  it('stash puts changes aside and pop brings them back', () => {
    let r = runAll(start(), [write('soup.txt', 'water\nsalt\nleeks\n'), 'git stash'])
    expect(status(r.world).unstaged).toEqual([])
    expect(r.world.local.stash).toHaveLength(1)
    r = runAll(r.world, ['git stash pop'])
    expect(r.world.local.working['soup.txt']).toBe('water\nsalt\nleeks\n')
    expect(r.world.local.stash).toHaveLength(0)
  })

  it('rebase replays branch commits on top of main as new commits', () => {
    const r = runAll(start(), [
      'git switch -c idea',
      write('soup.txt', 'water\nsalt\nchili\n'),
      'git commit -am "Chili"',
      'git switch main',
      write('bread.txt', 'flour\nyeast\n'),
      'git commit -am "Yeast"',
      'git switch idea',
      'git rebase main',
    ])
    expect(r.ok).toBe(true)
    const tip = r.world.commits[headId(r.world)!]!
    expect(tip.message).toBe('Chili')
    expect(tip.parents).toEqual([r.world.local.branches.main])
    expect(r.world.local.working['bread.txt']).toBe('flour\nyeast\n')
  })

  it('cherry-pick copies one commit', () => {
    const r = runAll(start(), [
      'git switch -c fixes',
      write('bread.txt', 'flour\nsalt\n'),
      'git commit -am "Salt in bread"',
      'git switch main',
      'git cherry-pick fixes',
    ])
    expect(r.world.local.working['bread.txt']).toBe('flour\nsalt\n')
    expect(headId(r.world)).not.toBe(r.world.local.branches.fixes)
  })

  it('reflog finds a commit after reset --hard', () => {
    let r = runAll(start(), [write('soup.txt', 'water\n'), 'git commit -am "Oops"', 'git reset --hard HEAD~1'])
    expect(r.world.local.working['soup.txt']).toBe('water\nsalt\n')
    r = runAll(r.world, ['git reset --hard HEAD@{1}'])
    expect(r.world.commits[headId(r.world)!]!.message).toBe('Oops')
  })

  it('force-with-lease refuses when the remote moved since the last fetch', () => {
    let r = runAll(start(), ['git remote add origin example.com/x', 'git push', write('soup.txt', 'a\n'), 'git commit -am "Mine"', 'git push'])
    r = runAll(r.world, [
      { kind: 'teammate', path: 'bread.txt', content: 'rye\n', message: 'Theirs' },
      'git commit --amend -m "Mine, better"',
    ])
    expect(runAll(r.world, ['git push --force-with-lease']).ok).toBe(false)
    const forced = runAll(r.world, ['git push --force'])
    expect(forced.ok).toBe(true)
    expect(forced.world.remote!.branches.main).toBe(headId(forced.world))
  })

  it('bisect narrows down to the first bad commit', () => {
    const lines = ['a', 'b', 'c', 'sugar', 'd', 'e', 'f']
    let w = start()
    for (const l of lines) w = runAll(w, [write('soup.txt', `water\nsalt\n${l}\n`), `git commit -am "${l}"`]).world
    const first = runAll(w, ['git log']).output.at(-1)!.split(' ')[0]!
    let r = runAll(w, ['git bisect start', 'git bisect bad', `git bisect good ${first}`])
    for (let i = 0; i < 5 && !r.world.local.bisect!.found; i++) {
      const bad = r.world.local.working['soup.txt']!.includes('sugar') || ['d', 'e', 'f'].some((x) => r.world.local.working['soup.txt']!.includes(`\n${x}\n`))
      r = runAll(r.world, [`git bisect ${bad ? 'bad' : 'good'}`])
    }
    expect(r.world.commits[r.world.local.bisect!.found!]!.message).toBe('sugar')
    expect(bisectSuspects(r.world, r.world.local.bisect!)).toHaveLength(1)
  })

  it('blame names the commit and author of each line', () => {
    const r = runAll(start(), [
      'git remote add origin example.com/x',
      'git push',
      { kind: 'teammate', path: 'soup.txt', content: 'water\nsalt\npepper\n', message: 'Pepper' },
      'git pull',
    ])
    const lines = blame(r.world, headId(r.world)!, 'soup.txt')
    expect(lines.map((l) => [l.text, l.commit.message, l.commit.author])).toEqual([
      ['water', 'First', 'You'],
      ['salt', 'First', 'You'],
      ['pepper', 'Pepper', 'Sam'],
    ])
  })
})
