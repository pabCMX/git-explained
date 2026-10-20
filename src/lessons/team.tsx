import { ScriptedDemo, type Script, type Step } from '../components/ScriptedDemo'
import type { Action } from '../git/sim'
import { BREAD, built, onlyOnRemote, recipe, REMOTE_URL, SOUP } from './worlds'

const write = (path: string, content: string): Action => ({ kind: 'write', path, content })
const PIE = recipe('Apple pie', '- 4 apples', '- 200 g flour', '- 100 g butter')

// Stash

const stashStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, [
  'git init',
  'git add .',
  'git commit -m "First recipes"',
  'git switch -c spicy',
  write('soup.txt', recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt', '- 1 red chili')),
  'git commit -am "Add chili"',
])
const stashSteps: Step[] = [
  {
    do: write('soup.txt', recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt', '- 1 red chili', '- smoked paprika?')),
    say: (
      <>
        You are on the <strong>spicy</strong> branch, in the middle of a change to <code>soup.txt</code>. The change is not
        ready to commit.
      </>
    ),
  },
  {
    do: 'git switch main',
    fails: true,
    say: (
      <>
        Sam asks you to fix something on main right now. But Git stops you. <code>soup.txt</code> is different on main, so
        the switch would overwrite your unfinished change.
      </>
    ),
  },
  {
    do: 'git stash',
    say: (
      <>
        <code>git stash</code> puts your unfinished changes on a shelf, and makes your folder match the last commit again.
        Watch the change move into the <strong>Stash</strong> column.
      </>
    ),
  },
  {
    do: ['git switch main', write('bread.txt', recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', 'Bake for 40 minutes at 220 °C.')), 'git commit -am "Add oven temperature"'],
    say: <>Now the switch works. You fix the bread on main and commit.</>,
  },
  {
    do: ['git switch spicy', 'git stash list'],
    say: (
      <>
        Back on spicy. <code>git stash list</code> shows what is on the shelf. You can stash more than once. The newest is{' '}
        <code>stash@&#123;0&#125;</code>.
      </>
    ),
  },
  {
    do: 'git stash pop',
    say: (
      <>
        <code>git stash pop</code> puts the newest changes back in your folder and removes them from the shelf. You can
        continue where you stopped.
      </>
    ),
  },
]

export function StashLesson() {
  return (
    <>
      <p>
        On a busy project, you often have to stop in the middle of something. You cannot commit half a change, and you cannot
        switch branches with it. The <strong>stash</strong> is a shelf for this kind of work.
      </p>
      <ScriptedDemo start={stashStart} steps={stashSteps} views={['areas', 'graph']} />
      <h2>Stash commands</h2>
      <ul>
        <li>
          <code>git stash</code>: put changes to tracked files aside. Add <code>-u</code> to include new files, and{' '}
          <code>-m "note"</code> to give the stash a name.
        </li>
        <li>
          <code>git stash list</code>: see what is on the shelf.
        </li>
        <li>
          <code>git stash pop</code>: put the newest stash back and remove it from the shelf.
        </li>
        <li>
          <code>git stash apply</code>: put it back, but keep a copy on the shelf.
        </li>
        <li>
          <code>git stash drop</code>: delete the newest stash.
        </li>
      </ul>
      <p>
        The stash stays on your computer. <code>git push</code> does not send it. Do not keep work there for weeks. If the
        work is worth keeping, put it on a branch and commit it.
      </p>
    </>
  )
}

// Feature branches on a team

const teamStart = onlyOnRemote(
  built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, ['git init', 'git add .', 'git commit -m "First recipes"', `git remote add origin ${REMOTE_URL}`, 'git push']),
)
const SEEDS = recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', '- seeds on top', 'Bake for 40 minutes.')
const teamSteps: Step[] = [
  { do: `git clone ${REMOTE_URL}`, say: <>You and Sam share the cookbook on a remote. You clone it.</> },
  {
    do: ['git switch -c pie', write('pie.txt', PIE), 'git add pie.txt', 'git commit -m "Add apple pie"'],
    say: (
      <>
        A common team rule: nobody commits on main directly. Each task gets its own <strong>feature branch</strong>. Your task
        is a pie recipe, so you make a branch named <strong>pie</strong>.
      </>
    ),
  },
  {
    do: 'git push -u origin pie',
    say: (
      <>
        <code>git push -u origin pie</code> sends your branch to the remote. The <code>-u</code> connects your pie to{' '}
        <code>origin/pie</code>, so later a plain <code>git push</code> or <code>git pull</code> knows where to go. On the
        website you now open a <strong>pull request</strong>: a request to merge pie into main, where others can review it.
      </>
    ),
  },
  {
    do: { kind: 'teammate', branch: 'seeds', from: 'main', path: 'bread.txt', content: SEEDS, message: 'Seeds on bread' },
    say: <>Sam works on a different task, on a branch named <strong>seeds</strong>, and pushes it.</>,
  },
  {
    do: ['git fetch', 'git branch -a'],
    say: (
      <>
        <code>git fetch</code> gets all new commits and branches. <code>git branch -a</code> lists your branches and the
        remote ones. Remote ones start with <code>remotes/origin/</code>.
      </>
    ),
  },
  {
    do: 'git switch seeds',
    say: (
      <>
        You want to test Sam's work before you approve it. <code>git switch seeds</code> sees <code>origin/seeds</code> and
        makes a local seeds branch from it.
      </>
    ),
  },
  {
    do: { kind: 'remote-merge', branch: 'seeds', deleteBranch: true },
    say: (
      <>
        The review is done. Sam merges the pull request on the website. The website makes a merge commit on main, then
        deletes the seeds branch on the remote.
      </>
    ),
  },
  {
    do: ['git switch main', 'git pull'],
    say: <>You update your main. Now it has the seeds.</>,
  },
  {
    do: 'git fetch --prune',
    say: (
      <>
        Your computer still shows <code>origin/seeds</code>, because fetch does not delete labels. <code>--prune</code>{' '}
        removes the labels of branches that are gone from the remote.
      </>
    ),
  },
  {
    do: 'git branch -d seeds',
    say: (
      <>
        Delete your local seeds branch too. <code>-d</code> is safe: Git refuses if the branch has commits that are not
        merged.
      </>
    ),
  },
  {
    do: ['git switch pie', 'git merge main', 'git push'],
    say: (
      <>
        Your pie branch does not have the seeds yet. Merge main into it to stay current and to test that all parts work
        together. Then push. The pull request shows the new commits.
      </>
    ),
  },
  {
    do: [{ kind: 'remote-merge', branch: 'pie', deleteBranch: true }, 'git switch main', 'git pull', 'git fetch --prune', 'git branch -d pie'],
    say: <>Your pull request is merged too. You clean up the same way: pull main, prune, delete the local branch.</>,
  },
]

export function TeamBranchesLesson() {
  return (
    <>
      <p>
        When many people work on one repository, branches multiply quickly. This lesson shows the usual routine for feature
        branches on a shared remote: share your branch, look at other branches, and clean up after a merge.
      </p>
      <ScriptedDemo start={teamStart} steps={teamSteps} views={['remote']} />
      <h2>Commands from this lesson</h2>
      <ul>
        <li>
          <code>git push -u origin &lt;branch&gt;</code>: push a new branch and connect it to the remote one.
        </li>
        <li>
          <code>git branch -a</code>: list local and remote branches.
        </li>
        <li>
          <code>git switch &lt;branch&gt;</code>: also works for a branch that exists only on the remote.
        </li>
        <li>
          <code>git fetch --prune</code>: remove labels of remote branches that were deleted.
        </li>
        <li>
          <code>git push origin --delete &lt;branch&gt;</code>: delete a branch on the remote yourself.
        </li>
      </ul>
      <p>
        Keep feature branches short. A branch that lives for weeks drifts away from main, and the merge at the end gets hard.
        Merge main into your branch often, or rebase it, as the next lesson shows.
      </p>
    </>
  )
}

// Merge, squash or rebase

const PIE_DONE = recipe('Apple pie', '- 4 apples', '- 200 g flour', '- 100 g butter', '- 1 tsp cinnamon', 'Bake for 45 minutes.')
const integrateStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, [
  'git init',
  'git add .',
  'git commit -m "First recipes"',
  'git switch -c pie',
  write('pie.txt', PIE),
  'git add pie.txt',
  'git commit -m "Start pie"',
  write('pie.txt', recipe('Apple pie', '- 4 apples', '- 200 g flour', '- 100 g butter', '- 1 tsp cinnamon')),
  'git commit -am "wip"',
  write('pie.txt', PIE_DONE),
  'git commit -am "Fix bake time"',
  'git switch main',
  write('bread.txt', recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', 'Bake for 35 minutes.')),
  'git commit -am "Shorter bake time"',
])
const intro: Step = {
  say: (
    <>
      The <strong>pie</strong> branch has three commits. main has one new commit since pie started. Here is one way to bring
      pie into main.
    </>
  ),
}
const mergeWay: Step[] = [
  intro,
  {
    do: 'git merge pie',
    say: (
      <>
        <strong>Merge</strong>: one merge commit joins the two lines. History shows exactly what happened, including the
        "wip" commit. Some teams use <code>git merge --no-ff</code> to make a merge commit even when a fast-forward is
        possible, so each feature stays visible as a group.
      </>
    ),
  },
]
const squashWay: Step[] = [
  intro,
  {
    do: 'git merge --squash pie',
    say: (
      <>
        <strong>Squash</strong>: Git puts all changes from pie into the staging area as one change, but does not commit.
      </>
    ),
  },
  {
    do: 'git commit -m "Add apple pie"',
    say: <>You commit them as one clean commit on main. The "wip" commit does not appear in main's history.</>,
  },
  {
    do: 'git branch -d pie',
    fails: true,
    say: (
      <>
        Now delete pie. Git refuses, because main does not contain the pie commits themselves, only a copy of their changes.
      </>
    ),
  },
  {
    do: 'git branch -D pie',
    say: <><code>-D</code> deletes it anyway. That is normal after a squash. Websites do the same with "Squash and merge".</>,
  },
]
const rebaseWay: Step[] = [
  intro,
  {
    do: ['git switch pie', 'git rebase main'],
    say: (
      <>
        <strong>Rebase</strong>: Git takes the pie commits and replays them, one by one, on top of the newest main. Watch the
        old commits fade out. The new ones have the same changes and messages, but new IDs, because their parent changed.
      </>
    ),
  },
  {
    do: ['git switch main', 'git merge pie'],
    say: (
      <>
        Now pie starts at the end of main, so the merge is a fast-forward. The history is one straight line, as if you had
        started pie today.
      </>
    ),
  },
]

export function RebaseLesson() {
  return (
    <>
      <p>
        There are three common ways to bring a feature branch into main. They give the same files, but different history.
        Each demo below starts from the same point.
      </p>
      <ScriptedDemo start={integrateStart} steps={mergeWay} views={['graph']} />
      <ScriptedDemo start={integrateStart} steps={squashWay} views={['graph']} />
      <ScriptedDemo start={integrateStart} steps={rebaseWay} views={['graph']} />
      <h2>Which one to use</h2>
      <ul>
        <li>
          <strong>Merge</strong> keeps all the real history. It is the safest choice and never changes existing commits.
        </li>
        <li>
          <strong>Squash</strong> gives main one commit for each feature. The small steps are lost from main.
        </li>
        <li>
          <strong>Rebase</strong> gives a straight history and keeps each commit. It makes new commits, so it changes history.
        </li>
      </ul>
      <p>
        Most teams pick one and use it for all pull requests. Ask what your team does.
      </p>
      <h2>The golden rule of rebase</h2>
      <p>
        Rebase only commits that nobody else has. If you rebase commits that you already pushed, other people still have the
        old ones, and the histories no longer agree. The next lesson shows how to handle that case.
      </p>
      <p>
        If a rebase hits a conflict, Git stops at that commit. You fix the file, run <code>git add</code>, then{' '}
        <code>git rebase --continue</code>. <code>git rebase --abort</code> cancels the rebase. This simulator does not pause,
        so it cancels the rebase on a conflict.
      </p>
    </>
  )
}

// Force push safely

const PIE2 = recipe('Apple pie', '- 4 apples', '- 200 g flour', '- 100 g butter', '- 1 tsp cinnamon')
const forceStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, [
  'git init',
  'git add .',
  'git commit -m "First recipes"',
  `git remote add origin ${REMOTE_URL}`,
  'git push',
  'git switch -c pie',
  write('pie.txt', PIE),
  'git add pie.txt',
  'git commit -m "Add apple pie"',
  'git push -u origin pie',
])
const forceSteps: Step[] = [
  {
    do: [{ kind: 'teammate', path: 'bread.txt', content: SEEDS, message: 'Seeds on bread' }, 'git fetch'],
    say: (
      <>
        Your <strong>pie</strong> branch is on the remote. Then Sam pushes a commit to main, and you fetch it.
      </>
    ),
  },
  {
    do: 'git rebase origin/main',
    say: (
      <>
        You rebase pie on top of the new main. Your commit gets a new ID. Look at the remote: it still has the old pie
        commit.
      </>
    ),
  },
  {
    do: 'git push',
    fails: true,
    say: (
      <>
        A normal push refuses. To the remote, your new commit does not come after the old one. It replaces it. A normal push
        never removes commits.
      </>
    ),
  },
  {
    do: 'git push --force-with-lease',
    say: (
      <>
        <code>--force-with-lease</code> tells the remote: replace pie with my version, but only if pie is still where I last
        saw it. It is, so the push works.
      </>
    ),
  },
  {
    do: { kind: 'teammate', branch: 'pie', path: 'pie.txt', content: PIE2, message: 'More cinnamon' },
    say: <>Now Sam helps with your pie and pushes a commit to the pie branch. You did not fetch it.</>,
  },
  {
    do: [write('crust.txt', recipe('Pie crust', '- 250 g flour', '- 125 g cold butter')), 'git add crust.txt', 'git commit -m "Add crust"'],
    say: <>You add a commit on your computer.</>,
  },
  {
    do: 'git push --force-with-lease',
    fails: true,
    say: (
      <>
        You push with <code>--force-with-lease</code> again, out of habit. This time it refuses. The remote changed since
        your last fetch, so the lease protects Sam's commit. A plain <code>git push --force</code> does not check. It would
        delete Sam's commit from the remote.
      </>
    ),
  },
  {
    do: 'git pull --rebase',
    say: (
      <>
        The right fix: <code>git pull --rebase</code>. It fetches Sam's commit and replays your new commit on top of it.
      </>
    ),
  },
  { do: 'git push', say: <>Now your commit comes after Sam's, so a normal push works. Nobody lost work.</> },
]

export function ForcePushLesson() {
  return (
    <>
      <p>
        After a rebase or an <code>--amend</code>, your branch has new commits that replace old ones. If you pushed the old
        ones, a normal push refuses. This lesson shows when a force push is fine, and how to do it without deleting the work
        of other people.
      </p>
      <ScriptedDemo start={forceStart} steps={forceSteps} views={['remote']} />
      <h2>Rules for force push</h2>
      <ul>
        <li>
          Never force push to main, or to any branch that other people work on, unless the team agrees.
        </li>
        <li>
          On your own feature branch, force push after a rebase is normal.
        </li>
        <li>
          Always use <code>git push --force-with-lease</code>, not <code>--force</code>. If it refuses, fetch and look at what
          changed.
        </li>
        <li>
          To get other people's commits on a branch without a merge commit, use <code>git pull --rebase</code>.
        </li>
      </ul>
    </>
  )
}

export const scripts: Script[] = [
  { start: stashStart, steps: stashSteps },
  { start: teamStart, steps: teamSteps },
  { start: integrateStart, steps: mergeWay },
  { start: integrateStart, steps: squashWay },
  { start: integrateStart, steps: rebaseWay },
  { start: forceStart, steps: forceSteps },
]
