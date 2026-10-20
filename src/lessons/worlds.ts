import { emptyWorld, runAll, type Action, type Files, type World } from '../git/sim'

// The example in every lesson: a family cookbook, kept as plain text files.

export const recipe = (title: string, ...lines: string[]) => `${title}\n\n${lines.join('\n')}\n`

export const SOUP = recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt')
export const BREAD = recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', 'Bake for 40 minutes.')
export const REMOTE_URL = 'github.com/family/cookbook'

/** Runs setup actions and returns the result. Throws if a step fails, so a broken lesson script fails loudly. */
export function built(files: Files, actions: Action[]): World {
  const r = runAll(emptyWorld(files), actions)
  if (!r.ok) throw new Error(`Lesson setup failed: ${r.output.join('\n')}`)
  return r.world
}

/** Keeps the remote and its commits, but removes the local repository. Used to start with "git clone". */
export function onlyOnRemote(w: World): World {
  return { ...w, initialized: false, local: emptyWorld().local }
}
