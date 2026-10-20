import { Link } from '@tanstack/react-router'
import { DailyLoop } from '../components/Explainers'
import { ScriptedDemo, type Step } from '../components/ScriptedDemo'
import { BREAD, built, onlyOnRemote, recipe, REMOTE_URL, SOUP } from './worlds'

const garlicSoup = recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 clove garlic', '- 1 liter water', '- 1 tsp salt')

const remoteStart = onlyOnRemote(
  built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, [
    'git init',
    'git add .',
    'git commit -m "First recipes"',
    `git remote add origin ${REMOTE_URL}`,
    'git push',
  ]),
)
const remoteSteps: Step[] = [
  {
    say: (
      <>
        A <strong>remote</strong> is a copy of the repository on another computer. Usually it is on a website such as GitHub,
        GitLab or Codeberg. The family cookbook is there. You do not have it on your computer yet.
      </>
    ),
  },
  {
    do: `git clone ${REMOTE_URL}`,
    say: (
      <>
        <code>git clone</code> downloads the full repository, with all its history. The dashed label{' '}
        <code>origin/main</code> is what your computer knows about main on the remote. <strong>origin</strong> is the usual
        name for the remote.
      </>
    ),
  },
  {
    do: [{ kind: 'write', path: 'soup.txt', content: garlicSoup }, 'git commit -am "Add garlic"'],
    say: (
      <>
        You commit on your computer. The remote does not get this commit. Your main is now one commit in front of{' '}
        <code>origin/main</code>.
      </>
    ),
  },
  { do: 'git status', say: <><code>git status</code> tells you that you are ahead of the remote by 1 commit.</> },
  {
    do: 'git push',
    say: (
      <>
        <code>git push</code> sends your new commits to the remote. Now the remote has the garlic, and the people who use it
        can get it.
      </>
    ),
  },
  {
    do: { kind: 'teammate', path: 'bread.txt', content: recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', '- seeds on top', 'Bake for 40 minutes.'), message: 'Seeds on bread' },
    say: (
      <>
        Your cousin Sam pushes a commit from their own computer. The commit is on the remote now, but not on your computer.
        Git does not sync on its own.
      </>
    ),
  },
  {
    do: 'git status',
    say: (
      <>
        <code>git status</code> still says "up to date". This surprises many people. Git compares with the last information
        it got from the remote. It does not ask the remote again.
      </>
    ),
  },
  {
    do: ['git fetch', 'git status'],
    say: (
      <>
        <code>git fetch</code> gets the new commits from the remote, but does not change your files. The{' '}
        <code>origin/main</code> label moves forward. Now status says you are behind.
      </>
    ),
  },
  {
    do: 'git pull',
    say: (
      <>
        <code>git pull</code> is a fetch and then a merge. Here the merge is a fast-forward, and your folder now has
        Sam's seeds.
      </>
    ),
  },
  {
    do: [
      { kind: 'teammate', path: 'bread.txt', content: recipe('Bread', '- 500 g flour', '- 7 g yeast', '- 300 ml water', '- seeds on top', 'Bake for 45 minutes.'), message: 'Longer bake' },
      { kind: 'write', path: 'soup.txt', content: recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 clove garlic', '- 1 liter water', '- 1 tsp salt', 'Serve hot.') },
      'git commit -am "Serve hot"',
    ],
    say: <>Now you and Sam both commit at the same time. Sam pushes first.</>,
  },
  {
    do: 'git push',
    say: (
      <>
        Git refuses your push. The remote has a commit that you do not have. If Git accepted your push, Sam's commit would
        be lost. The fix is always the same: pull first.
      </>
    ),
  },
  {
    do: 'git pull',
    say: (
      <>
        The pull merges Sam's commit with yours. You changed different files, so Git does it alone. If you changed the same
        lines, you would fix a conflict, as in the merging lesson.
      </>
    ),
  },
  { do: 'git push', say: <>Now the push works. The remote and your computer have the same history again.</> },
]

export function RemotesLesson() {
  return (
    <>
      <p>
        Until now, all history was on your computer. To work with other people, or to keep a backup, you connect your
        repository to a <strong>remote</strong>. Watch the two graphs. The top one is the remote. The bottom one is your
        computer.
      </p>
      <ScriptedDemo start={remoteStart} steps={remoteSteps} views={['remote', 'files']} />
      <h2>The four sharing commands</h2>
      <ul>
        <li>
          <code>git clone &lt;url&gt;</code>: get a full copy of a remote repository. You do this one time.
        </li>
        <li>
          <code>git push</code>: send your commits to the remote.
        </li>
        <li>
          <code>git fetch</code>: get new commits from the remote, without changing your files.
        </li>
        <li>
          <code>git pull</code>: fetch, then merge into your branch. Use it before you start work.
        </li>
      </ul>
      <p>
        If you already have a repository on your computer, use <code>git remote add origin &lt;url&gt;</code> to connect it,
        then <code>git push -u origin main</code> the first time.
      </p>
    </>
  )
}

const sugarSoup = recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- 1 tsp salt', '- 3 tbsp sugar')
const undoStart = built({ 'soup.txt': SOUP, 'bread.txt': BREAD }, ['git init', 'git add .', 'git commit -m "First recipes"'])
const undoSteps: Step[] = [
  {
    do: { kind: 'write', path: 'soup.txt', content: recipe('Leek soup', '- 2 leeks') },
    say: <>You delete most of the soup recipe by mistake, and you save the file. You did not commit.</>,
  },
  {
    do: 'git restore soup.txt',
    say: (
      <>
        <code>git restore</code> puts the file back as it was in the last commit. Be careful: this deletes your changes in
        that file, and Git cannot get them back, because they were never committed.
      </>
    ),
  },
  {
    do: [{ kind: 'write', path: 'notes-to-self.txt', content: 'Buy leeks.\nCall grandma about the soup.\n' }, 'git add .'],
    say: (
      <>
        You write a private note and then run <code>git add .</code>. Now the note is in the staging area, but it must not
        go in the cookbook.
      </>
    ),
  },
  {
    do: 'git restore --staged notes-to-self.txt',
    say: (
      <>
        <code>git restore --staged</code> takes the file out of the staging area. The file stays in your folder. Only the
        "add" is undone.
      </>
    ),
  },
  {
    do: [{ kind: 'write', path: 'soup.txt', content: sugarSoup }, 'git commit -am "Add sugar"'],
    say: <>You commit sugar in the soup. Later the family tastes it. It was a bad idea.</>,
  },
  {
    do: 'git revert HEAD',
    say: (
      <>
        <code>git revert</code> makes a <strong>new</strong> commit that does the opposite of an old one. The sugar is gone,
        and the history shows what happened. This is the safe way to undo a commit, also after you pushed it.
      </>
    ),
  },
]

export function UndoLesson() {
  return (
    <>
      <p>
        Everyone makes mistakes. The right undo command depends on where the mistake is: in your folder, in the staging area,
        or in a commit.
      </p>
      <ScriptedDemo start={undoStart} steps={undoSteps} views={['areas', 'graph']} />
      <h2>Which undo do I need?</h2>
      <ul>
        <li>
          A change in a file that you did not add: <code>git restore &lt;file&gt;</code>.
        </li>
        <li>
          A file that you added but do not want to commit: <code>git restore --staged &lt;file&gt;</code>.
        </li>
        <li>
          A commit that you want to cancel: <code>git revert &lt;id&gt;</code>.
        </li>
      </ul>
      <p>
        You will also read about <code>git reset</code> and <code>git commit --amend</code>. They change history instead of
        adding to it. They are fine for commits that only you have. Do not use them on commits that you already pushed, because
        your history and the history of other people will not agree.
      </p>
    </>
  )
}

export function RealLifeLesson() {
  return (
    <>
      <p>
        Most days with Git are the same five steps. If you remember only one thing from this course, remember this loop.
      </p>
      <DailyLoop />
      <h2>Good habits</h2>
      <ul>
        <li>
          Run <code>git status</code> often. It tells you where you are and often suggests the next command.
        </li>
        <li>Pull before you start, and push when you finish. Then conflicts stay small.</li>
        <li>Commit small, related changes with clear messages.</li>
        <li>
          Use a branch for anything that you are not sure about. Merge it when it is ready, or delete it.
        </li>
        <li>
          Put file names that Git must ignore in a file named <code>.gitignore</code>, for example private notes or large
          exports.
        </li>
      </ul>
      <h2>Tools</h2>
      <p>
        You do not need the terminal. <strong>GitHub Desktop</strong>, <strong>Sourcetree</strong> and the Git panel in{' '}
        <strong>Visual Studio Code</strong> show the same staging area, commits and branches with buttons. Websites such as{' '}
        <strong>GitHub</strong>, <strong>GitLab</strong> and <strong>Codeberg</strong> keep your remote and let other people
        suggest changes with a <strong>pull request</strong>: a request to merge their branch into yours.
      </p>
      <p>
        Now try it yourself in the <Link to="/playground" className="text-accent underline">
          playground
        </Link>. Nothing you do there
        can break anything.
      </p>
    </>
  )
}
