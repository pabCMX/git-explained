import { ScriptedDemo, type Step } from '../components/ScriptedDemo'
import { BREAD, built, recipe, SOUP } from './worlds'

const spicy = (...extra: string[]) => recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt', ...extra)

const branchStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, [
  'git init',
  'git add soup.txt',
  'git commit -m "First soup"',
  'git add bread.txt',
  'git commit -m "Add bread"',
])
const branchSteps: Step[] = [
  {
    say: (
      <>
        A <strong>branch</strong> is a name label that points at a commit. Your first branch is named <strong>main</strong>.{' '}
        <code>HEAD → main</code> shows that you are on main. When you commit, the label of your branch moves to the new commit.
      </>
    ),
  },
  {
    do: 'git branch spicy',
    say: (
      <>
        You want to test a spicy soup, but you do not want to change the family recipe yet. <code>git branch spicy</code>{' '}
        makes a new label at the same commit. Nothing else changes. You are still on main.
      </>
    ),
  },
  {
    do: 'git switch spicy',
    say: (
      <>
        <code>git switch spicy</code> puts you on the new branch. The <code>HEAD</code> part moves to the spicy label. Tip:{' '}
        <code>git switch -c spicy</code> does both steps at once.
      </>
    ),
  },
  {
    do: [{ kind: 'write', path: 'soup.txt', content: spicy('- 1 red chili') }, 'git commit -am "Add chili"'],
    say: <>You add a chili and commit. The new commit gets its own row and color. The spicy label moves forward. main stays where it was.</>,
  },
  {
    do: [{ kind: 'write', path: 'soup.txt', content: spicy('- 2 red chilis', '- 1 tsp paprika') }, 'git commit -am "More heat"'],
    say: <>One more commit on spicy.</>,
  },
  {
    do: 'git switch main',
    say: (
      <>
        Now switch back to main and look at <code>soup.txt</code>. The chili is gone. Git changed the file to match the
        commit that main points at. The chili is safe in the spicy branch.
      </>
    ),
  },
  {
    do: [{ kind: 'write', path: 'bread.txt', content: recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', 'Bake for 35 minutes.') }, 'git commit -am "Shorter bake time"'],
    say: (
      <>
        You keep working on main and fix the bread. Now the history splits into two lines. Each branch has commits that the
        other one does not have.
      </>
    ),
  },
  {
    do: 'git switch spicy',
    say: (
      <>
        You can move between branches at any time. The folder changes to match each one. Commit your changes before you
        switch, or Git stops you so that no work gets lost.
      </>
    ),
  },
]

export function BranchesLesson() {
  return (
    <>
      <p>
        Sometimes you want to try an idea without risk. Without Git, you make a copy of the folder. With Git, you make a{' '}
        <strong>branch</strong>. A branch costs almost nothing, because it is only a label.
      </p>
      <ScriptedDemo start={branchStart} steps={branchSteps} views={['graph', 'files']} />
      <h2>When to use a branch</h2>
      <ul>
        <li>To test an idea that maybe you will not keep.</li>
        <li>To work on a big change while main stays ready to use.</li>
        <li>To let each person on a team work alone, then combine the work later. That is the next lesson.</li>
      </ul>
      <p>
        Give branches short names that say what they are for, such as <code>spicy</code>, <code>chapter-3</code> or{' '}
        <code>fix-typos</code>.
      </p>
    </>
  )
}

const mergeStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, ['git init', 'git add .', 'git commit -m "First recipes"'])
const mergeSteps: Step[] = [
  {
    do: ['git switch -c dessert', { kind: 'write', path: 'pie.txt', content: recipe('Apple pie', '- 4 apples', '- 200 g flour', '- 100 g butter') }, 'git add pie.txt', 'git commit -m "Add apple pie"'],
    say: (
      <>
        You make a branch named <strong>dessert</strong> and add a pie recipe there. The pie is ready. Now you want it in
        main.
      </>
    ),
  },
  {
    do: ['git switch main', 'git merge dessert'],
    say: (
      <>
        To merge, go to the branch that receives the work, then <code>git merge</code> the other branch. main has no new
        commits since dessert started, so Git only moves the main label forward. Git calls this a{' '}
        <strong>fast-forward</strong>. Git makes no new commit.
      </>
    ),
  },
  {
    do: ['git switch -c vegan', { kind: 'write', path: 'soup.txt', content: recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter vegetable stock', '- 1 tsp salt') }, 'git commit -am "Use vegetable stock"'],
    say: <>Now you start a branch named <strong>vegan</strong> and change the soup.</>,
  },
  {
    do: ['git switch main', { kind: 'write', path: 'bread.txt', content: recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', '- 1 tsp sugar', 'Bake for 40 minutes.') }, 'git commit -am "Add sugar to bread"'],
    say: <>At the same time, someone commits a bread change on main. Both branches now have a new commit.</>,
  },
  {
    do: 'git merge vegan',
    say: (
      <>
        Git cannot simply move a label now. It makes a <strong>merge commit</strong> that combines both lines. A merge commit
        has two parents. The hollow dot shows it. The two branches changed different files, so Git combines them without help.
      </>
    ),
  },
  {
    do: 'git branch -d vegan',
    say: (
      <>
        You do not need the vegan label now. <code>git branch -d</code> deletes the label. The commits stay, because main
        includes them.
      </>
    ),
  },
]

const salt = (line: string) => recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', line)
const conflictStart = built({ 'soup.txt': SOUP }, [
  'git init',
  'git add .',
  'git commit -m "First soup"',
  'git switch -c less-salt',
  { kind: 'write', path: 'soup.txt', content: salt('- a pinch of salt') },
  'git commit -am "Less salt"',
  'git switch main',
  { kind: 'write', path: 'soup.txt', content: salt('- 2 tsp salt') },
  'git commit -am "More salt"',
])
const conflictSteps: Step[] = [
  {
    say: (
      <>
        On main, someone changed the salt to <strong>2 tsp</strong>. On the <strong>less-salt</strong> branch, someone
        changed the same line to <strong>a pinch</strong>. Git cannot know which one you want.
      </>
    ),
  },
  {
    do: 'git merge less-salt',
    say: (
      <>
        Git stops and asks you. This is a <strong>merge conflict</strong>. It is normal, and nothing is broken. Git writes
        both versions into the file, between marker lines. The part under <code>HEAD</code> is from your branch. The part
        under <code>=======</code> is from the other branch.
      </>
    ),
  },
  {
    do: 'git status',
    say: <><code>git status</code> lists the files with conflicts. Here there is only one.</>,
  },
  {
    do: { kind: 'write', path: 'soup.txt', content: salt('- 1 tsp salt, then taste') },
    say: (
      <>
        You open the file and fix it. Keep the text you want, or write something new. Then delete the three marker lines.
        Here the family agrees on "1 tsp salt, then taste".
      </>
    ),
  },
  {
    do: ['git add soup.txt', 'git commit'],
    say: (
      <>
        <code>git add</code> tells Git that the conflict is fixed. <code>git commit</code> makes the merge commit. Git
        writes the message for you.
      </>
    ),
  },
]

export function MergingLesson() {
  return (
    <>
      <p>
        A branch is useful only if you can bring the work back. <code>git merge</code> takes the commits from another branch
        and adds them to the branch you are on.
      </p>
      <ScriptedDemo start={mergeStart} steps={mergeSteps} views={['graph', 'files']} />
      <h2>When two changes collide</h2>
      <p>
        Git can combine changes on its own when they are in different files, or in different parts of the same file. If two
        branches change the same lines, Git asks you to decide.
      </p>
      <ScriptedDemo start={conflictStart} steps={conflictSteps} views={['files', 'graph']} />
      <p>
        If a merge goes wrong and you want to stop, <code>git merge --abort</code> puts everything back to how it was before
        the merge.
      </p>
    </>
  )
}
