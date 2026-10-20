import { ScriptedDemo, type Script, type Step } from '../components/ScriptedDemo'
import type { Action } from '../git/sim'
import { BREAD, built, recipe, REMOTE_URL, SOUP } from './worlds'

const write = (path: string, content: string): Action => ({ kind: 'write', path, content })
const cake = (...extra: string[]) => recipe('Chocolate cake', '- 200 g flour', '- 150 g sugar', '- 100 g dark chocolate', ...extra)

// Fix your own commits

const rewriteStart = built({ 'soup.txt': SOUP }, [
  'git init',
  'git add .',
  'git commit -m "First recipes"',
  'git switch -c cake',
  write('cake.txt', recipe('Chocolate cake', '- 200 g flour', '- 150 g suger', '- 100 g dark chocolate')),
  'git add cake.txt',
  'git commit -m "Add cake"',
])
const rewriteSteps: Step[] = [
  {
    say: (
      <>
        Your <strong>cake</strong> branch has one commit, and it has a typo: "suger". You did not push the branch. So you can
        still change its commits, and nobody else is affected.
      </>
    ),
  },
  {
    do: [write('cake.txt', cake()), 'git commit -a --amend'],
    say: (
      <>
        You fix the typo. <code>git commit --amend</code> replaces the last commit with a new one that has your fix.{' '}
        <code>-a</code> stages the change first. Watch the graph: the old commit fades and a new one with a new ID takes its
        place. Add <code>-m "new message"</code> to change the message too.
      </>
    ),
  },
  {
    do: [
      write('cake.txt', cake('', 'Icing: 100 g chocolate')),
      'git commit -am "icing"',
      write('cake.txt', cake('', 'Icing: 100 g chocolate, 50 ml cream')),
      'git commit -am "more icing"',
      write('cake.txt', cake('', 'Icing: 100 g chocolate, 100 ml cream')),
      'git commit -am "icing fix"',
    ],
    say: <>Then you work on the icing and make three small, messy commits.</>,
  },
  {
    do: 'git reset --soft HEAD~3',
    say: (
      <>
        <code>git reset --soft HEAD~3</code> moves the branch label back three commits. The changes from those commits stay
        in the staging area. Nothing is lost.
      </>
    ),
  },
  {
    do: 'git commit -m "Add chocolate icing"',
    say: <>You commit once. Three messy commits are now one clean commit. This is called <strong>squashing</strong>.</>,
  },
  {
    do: 'git reset HEAD~1',
    say: (
      <>
        <code>git reset</code> without an option is <code>--mixed</code>. It moves the label back and takes the changes out
        of the staging area. They stay in your folder, so you can commit them in a different way.
      </>
    ),
  },
  {
    do: 'git reset --hard',
    say: (
      <>
        You decide the icing was a bad idea. <code>git reset --hard</code> makes the staging area and your folder match the
        commit. The icing changes are gone. Be careful: Git cannot get back changes that were never committed.
      </>
    ),
  },
]

export function RewriteLesson() {
  return (
    <>
      <p>
        Before you share a branch, you can clean up its commits: fix the last one, join small ones, or undo some. Git does
        this by making new commits and moving the branch label.
      </p>
      <ScriptedDemo start={rewriteStart} steps={rewriteSteps} views={['graph', 'areas']} />
      <h2>The three kinds of reset</h2>
      <p>
        All three move the branch label to another commit. They differ in what happens to the staging area and your folder.
      </p>
      <ul>
        <li>
          <code>--soft</code>: only the label moves. The changes stay staged.
        </li>
        <li>
          <code>--mixed</code> (the default): the label moves, and the staging area matches the commit. Changes stay in your
          folder.
        </li>
        <li>
          <code>--hard</code>: the label moves, and the staging area and folder match the commit. Uncommitted changes are
          deleted.
        </li>
      </ul>
      <p>
        Use these commands only on commits that you did not push. For commits that other people have, use{' '}
        <code>git revert</code>. Many people use <code>git rebase -i</code> (interactive rebase) to squash, reorder and edit
        many commits at once. It does the same thing with a list in a text editor. This simulator does not have it.
      </p>
    </>
  )
}

// Cherry-pick

const SALT_FIX = recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- 1/2 tsp salt')
const pickStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, [
  'git init',
  'git add .',
  'git commit -m "First recipes"',
  'git branch printed',
  write('pie.txt', recipe('Apple pie', '- 4 apples', '- 200 g flour')),
  'git add pie.txt',
  'git commit -m "Add apple pie"',
  write('soup.txt', SALT_FIX),
  'git commit -am "Fix: too much salt in soup"',
  write('cake.txt', cake()),
  'git add cake.txt',
  'git commit -m "Add cake"',
])
const pickSteps: Step[] = [
  {
    say: (
      <>
        Last year the family printed the cookbook from the <strong>printed</strong> branch. Since then, main got two new
        recipes and one important fix. The next print must have the fix, but not the new recipes.
      </>
    ),
  },
  {
    do: 'git log --oneline',
    say: (
      <>
        You find the fix in the log. It is the second newest commit, so you can also name it <code>main~1</code>.
      </>
    ),
  },
  { do: 'git switch printed', say: <>You switch to the printed branch.</> },
  {
    do: 'git cherry-pick main~1',
    say: (
      <>
        <code>git cherry-pick</code> copies the change of one commit to the branch you are on. The copy is a new commit with
        the same message and change, but a new ID. The pie and cake stay on main.
      </>
    ),
  },
]

export function CherryPickLesson() {
  return (
    <>
      <p>
        Sometimes you need one commit from another branch, not all of them. A typical case: a fix on main that an older
        version also needs.
      </p>
      <ScriptedDemo start={pickStart} steps={pickSteps} views={['graph', 'diff']} />
      <h2>Good to know</h2>
      <ul>
        <li>
          You can pick more than one: <code>git cherry-pick &lt;id&gt; &lt;id&gt;</code>. This simulator takes one.
        </li>
        <li>A cherry-pick can have conflicts, the same as a merge.</li>
        <li>
          Copies are separate commits. If you need many commits from a branch, a merge is usually better.
        </li>
      </ul>
    </>
  )
}

// Reflog

const reflogStart = built({ 'soup.txt': SOUP }, [
  'git init',
  'git add .',
  'git commit -m "First recipes"',
  write('pie.txt', recipe('Apple pie', '- 4 apples')),
  'git add pie.txt',
  'git commit -m "Add pie"',
  write('cake.txt', cake()),
  'git add cake.txt',
  'git commit -m "Add cake"',
  'git switch -c experiment',
  write('cake.txt', cake('- vegan butter')),
  'git commit -am "Try vegan butter"',
  write('cake.txt', cake('- vegan butter', '- oat milk')),
  'git commit -am "Try oat milk"',
  'git switch main',
])
const lostId = reflogStart.local.branches.experiment!
const reflogSteps: Step[] = [
  {
    do: 'git reset --hard HEAD~2',
    say: <>You want to undo one commit, but you type <code>HEAD~2</code>. Two commits disappear from main.</>,
  },
  { do: 'git log --oneline', say: <><code>git log</code> does not show them. They look lost.</> },
  {
    do: 'git reflog',
    say: (
      <>
        <code>git reflog</code> lists every place HEAD has been, newest first. The lost commits are still there.{' '}
        <code>HEAD@&#123;1&#125;</code> means "where HEAD was one move ago".
      </>
    ),
  },
  { do: 'git reset --hard HEAD@{1}', say: <>You reset back to that point. Everything is back.</> },
  {
    do: 'git branch -d experiment',
    fails: true,
    say: <>Later you clean up and delete the experiment branch. <code>-d</code> refuses, because its commits are not merged.</>,
  },
  {
    do: 'git branch -D experiment',
    say: <>You are sure, so you use <code>-D</code>. The two commits disappear from the graph.</>,
  },
  {
    do: 'git reflog',
    say: (
      <>
        A week later you want the oat milk version after all. You were on that branch before, so the reflog still has the
        commit. You find "Try oat milk" and its ID, <code>{lostId}</code>.
      </>
    ),
  },
  {
    do: `git branch experiment ${lostId}`,
    say: <>You make a new branch at that ID. The commits are back in the graph.</>,
  },
]

export function ReflogLesson() {
  return (
    <>
      <p>
        Git almost never deletes a commit right away. When no branch points to a commit, it only stops showing it. The{' '}
        <strong>reflog</strong> helps you find it again.
      </p>
      <ScriptedDemo start={reflogStart} steps={reflogSteps} views={['graph']} />
      <h2>Limits</h2>
      <ul>
        <li>The reflog is only on your computer. It is not pushed, and a fresh clone has an empty reflog.</li>
        <li>
          Git cleans up old entries. By default, entries for commits that no branch reaches expire after 30 days, and other
          entries after 90 days.
        </li>
        <li>
          The reflog has only committed work. Changes that you deleted with <code>reset --hard</code> or{' '}
          <code>restore</code> before a commit are gone.
        </li>
      </ul>
    </>
  )
}

// Blame and bisect

const soup = (...lines: string[]) => recipe('Leek soup', ...lines)
const blameStart = built({ 'soup.txt': soup('- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt') }, [
  'git init',
  'git add .',
  'git commit -m "First soup"',
  `git remote add origin ${REMOTE_URL}`,
  'git push',
  { kind: 'teammate', path: 'soup.txt', content: soup('- 2 leeks', '- 1 potato', '- 1 liter vegetable stock', '- 2 tsp salt'), message: 'Use stock, more salt' },
  'git pull',
  write('soup.txt', soup('- 2 leeks', '- 1 potato', '- 1 clove garlic', '- 1 liter vegetable stock', '- 2 tsp salt')),
  'git commit -am "Add garlic"',
])
const blameSteps: Step[] = [
  {
    do: 'git blame soup.txt',
    say: (
      <>
        <code>git blame</code> shows, for each line, the last commit that changed it and who made it. The colored bar shows
        the author.
      </>
    ),
  },
  {
    do: [write('soup.txt', soup('- 2 leeks', '- 1 potato', '- 1 clove garlic', '- 1 liter vegetable stock', '- 1 tsp salt')), 'git commit -am "Less salt again"', 'git blame soup.txt'],
    say: (
      <>
        You change the salt line that Sam wrote. Now blame shows your commit for that line. Blame always shows the last
        change, not the first.
      </>
    ),
  },
]

const BISECT_LINES = [
  ['First soup', ['- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt']],
  ['Add carrots', ['- 2 leeks', '- 1 potato', '- 2 carrots', '- 1 liter water', '- 1 tsp salt']],
  ['Add garlic', ['- 2 leeks', '- 1 potato', '- 2 carrots', '- 1 clove garlic', '- 1 liter water', '- 1 tsp salt']],
  ['Use vegetable stock', ['- 2 leeks', '- 1 potato', '- 2 carrots', '- 1 clove garlic', '- 1 liter vegetable stock', '- 1 tsp salt']],
  ['Add thyme', ['- 2 leeks', '- 1 potato', '- 2 carrots', '- 1 clove garlic', '- 1 liter vegetable stock', '- 1 tsp salt', '- thyme']],
  ['Sort the list', ['- 1 tbsp salt', '- 1 clove garlic', '- 1 liter vegetable stock', '- 1 potato', '- 2 carrots', '- 2 leeks', '- thyme']],
  ['Add cream', ['- 1 tbsp salt', '- 1 clove garlic', '- 1 liter vegetable stock', '- 1 potato', '- 100 ml cream', '- 2 carrots', '- 2 leeks', '- thyme']],
  ['Add pepper', ['- 1 tbsp salt', '- 1 clove garlic', '- 1 liter vegetable stock', '- 1 potato', '- 100 ml cream', '- 2 carrots', '- 2 leeks', '- pepper', '- thyme']],
] as const
const bisectStart = built(
  { 'soup.txt': soup(...BISECT_LINES[0][1]) },
  [
    'git init',
    'git add .',
    `git commit -m "${BISECT_LINES[0][0]}"`,
    ...BISECT_LINES.slice(1).flatMap(([message, lines]): Action[] => [write('soup.txt', soup(...lines)), `git commit -am "${message}"`]),
  ],
)
const bisectSteps: Step[] = [
  {
    say: (
      <>
        Someone says the soup is much too salty now. The first version was fine. There are 8 commits. Which one broke it?
        You could check them one by one. <code>git bisect</code> is faster.
      </>
    ),
  },
  {
    do: ['git bisect start', 'git bisect bad', 'git bisect good HEAD~7'],
    say: (
      <>
        You start bisect. You tell Git that the newest commit is <strong>bad</strong> and the first one is{' '}
        <strong>good</strong>. Git checks out a commit in the middle of the suspects.
      </>
    ),
  },
  {
    do: 'git bisect good',
    say: <>You read the file: "1 tsp salt". That is fine, so you tell Git <code>good</code>. Half of the suspects are cleared.</>,
  },
  {
    do: 'git bisect bad',
    say: <>This version has "1 tbsp salt". A tablespoon is three times more. Too salty: <code>bad</code>.</>,
  },
  {
    do: 'git bisect good',
    say: (
      <>
        Fine again. Now Git knows the answer: "Sort the list". When someone sorted the ingredients, they also changed tsp to
        tbsp by mistake.
      </>
    ),
  },
  { do: 'git bisect reset', say: <><code>git bisect reset</code> takes you back to where you started.</> },
]

export function BlameBisectLesson() {
  return (
    <>
      <p>
        In a project with many contributors, two questions come up often. Who changed this line, and why? And which commit
        broke something that used to work?
      </p>
      <h2>Who changed this line?</h2>
      <ScriptedDemo start={blameStart} steps={blameSteps} views={['blame:soup.txt']} />
      <p>
        Use blame to find the commit, then read its message to understand why. Websites such as GitHub show the same view.
        The name sounds negative, but the command is for context, not for finding someone at fault.
      </p>
      <h2>Which commit broke it?</h2>
      <ScriptedDemo start={bisectStart} steps={bisectSteps} views={['bisect', 'files']} />
      <p>
        Each answer removes about half of the suspects. With 1,000 commits, you need about 10 tests. If you can check "good"
        or "bad" with a script, <code>git bisect run &lt;script&gt;</code> does all the steps for you.
      </p>
    </>
  )
}

export const scripts: Script[] = [
  { start: rewriteStart, steps: rewriteSteps },
  { start: pickStart, steps: pickSteps },
  { start: reflogStart, steps: reflogSteps },
  { start: blameStart, steps: blameSteps },
  { start: bisectStart, steps: bisectSteps },
]
