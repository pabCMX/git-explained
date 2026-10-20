import { VersionChaos } from '../components/Explainers'
import { ScriptedDemo, type Step } from '../components/ScriptedDemo'
import { emptyWorld } from '../git/sim'
import { BREAD, built, recipe, SOUP } from './worlds'

export function WhyLesson() {
  return (
    <>
      <p>
        You write something. You change it. A week later you want the old version back. Most people solve this with copies:{' '}
        <code>report_final.docx</code>, <code>report_final_v2.docx</code>, and so on. Click <strong>Next day</strong> and watch
        the folder grow.
      </p>
      <VersionChaos />
      <p>
        <strong>Git</strong> is a program that keeps the history of a folder. You keep one copy of each file. When you reach a
        good point, you tell Git to save a <strong>snapshot</strong> of the folder. Git puts each snapshot in a hidden folder,
        with a short note about what changed. You can look at any old snapshot, compare two snapshots, or go back.
      </p>
      <h2>Words you will see</h2>
      <ul>
        <li>
          <strong>Repository</strong> (or "repo"): a folder that Git tracks, together with all its history.
        </li>
        <li>
          <strong>Commit</strong>: one saved snapshot, with a message. As a verb, "to commit" means to save one.
        </li>
        <li>
          <strong>Branch</strong>: a separate line of work, so you can try an idea without risk to the main version.
        </li>
        <li>
          <strong>Remote</strong>: a copy of the repository on another computer, for example on GitHub. Teams use it to share.
        </li>
      </ul>
      <h2>Is Git only for programmers?</h2>
      <p>
        No. Git tracks any files. Writers use it for books and articles, researchers for data and papers, and teams for
        documentation, legal texts and website content.
      </p>
      <p>
        Git works best with <strong>plain text</strong> files: <code>.txt</code>, <code>.md</code> (Markdown),{' '}
        <code>.csv</code>, <code>.json</code>. In these files Git can show which lines changed, and it can combine edits from
        two people. Git also keeps every version of Word files, PDFs and images, but it cannot show what changed inside them
        or combine them.
      </p>
      <p>
        In these lessons, a family keeps its cookbook in a Git repository. Each recipe is a text file. You type commands in
        a terminal, the text window where you give commands to the computer. Apps such as GitHub Desktop do the same
        commands with buttons. The ideas are the same.
      </p>
    </>
  )
}

const commitStart = emptyWorld({ 'soup.txt': SOUP })
const commitSteps: Step[] = [
  {
    say: (
      <>
        Here is a folder with one recipe, <code>soup.txt</code>. Git does not track this folder yet. There is no history.
      </>
    ),
  },
  {
    do: 'git init',
    say: (
      <>
        <code>git init</code> tells Git to start tracking the folder. Git makes a hidden folder named <code>.git</code> for
        the history. Your files do not change. You do this one time for each project.
      </>
    ),
  },
  {
    do: ['git add soup.txt', 'git commit -m "First version of the soup"'],
    say: (
      <>
        Now you save the first snapshot with <code>git commit</code>. The <code>-m</code> part is the message. You learn
        about <code>git add</code> in the next lesson. The commit is the dot in the graph. Hover over it to see its details.
      </>
    ),
  },
  {
    do: { kind: 'write', path: 'soup.txt', content: recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 2 carrots', '- 1 liter water', '- 1 tsp salt') },
    say: (
      <>
        You add carrots in your normal text editor and save the file. Git sees that the file changed. But Git does not make
        a snapshot on its own. A file save and a commit are different things.
      </>
    ),
  },
  {
    do: ['git add soup.txt', 'git commit -m "Add carrots"'],
    say: (
      <>
        A second commit. The line between the dots shows that this commit comes after the first one. Git calls the older
        commit the <strong>parent</strong>. The green line in "What changed" is the line you added.
      </>
    ),
  },
  {
    do: [
      { kind: 'write', path: 'soup.txt', content: recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 2 carrots', '- 1 liter water', '- a pinch of salt') },
      'git commit -am "Less salt"',
    ],
    say: (
      <>
        One more change. A changed line shows as a red line out and a green line in. Each commit has an ID like{' '}
        <code>3fa9c1e</code>. Git makes the ID from the content, so no two commits have the same ID.
      </>
    ),
  },
  {
    do: 'git log',
    say: (
      <>
        <code>git log</code> lists all commits, newest first. <code>HEAD -&gt; main</code> means: you are on the branch{' '}
        <strong>main</strong>, at this commit. The ring around a dot in the graph shows the same thing. Lesson 5 explains
        branches.
      </>
    ),
  },
]

export function CommitsLesson() {
  return (
    <>
      <p>
        A <strong>commit</strong> is a snapshot of all the files in your folder at one moment, plus a message that says what
        you changed and why. A commit is like a photo of the folder. You can always look at an old photo, and new photos
        never change old ones.
      </p>
      <ScriptedDemo start={commitStart} steps={commitSteps} views={['files', 'diff', 'graph']} />
      <h2>What makes a good commit</h2>
      <ul>
        <li>One idea for each commit. "Add carrots" is good. "Changes" is not.</li>
        <li>Write the message for a future reader who wants to know why the file changed.</li>
        <li>Commit often. Small commits are easy to understand and easy to undo.</li>
      </ul>
      <p>
        Git does not copy every file again for each commit. If a file did not change, the new snapshot points to the copy that
        Git already has. So a history of thousands of commits stays small.
      </p>
    </>
  )
}

const stagingStart = built({ 'soup.txt': SOUP }, ['git init', 'git add .', 'git commit -m "First soup"'])
const stagingSteps: Step[] = [
  {
    say: (
      <>
        Git keeps your work in three places. <strong>Your folder</strong> has the files you see. The{' '}
        <strong>staging area</strong> has the changes you picked for the next commit. The <strong>repository</strong> has
        the saved commits. Now all three agree.
      </>
    ),
  },
  {
    do: { kind: 'write', path: 'bread.txt', content: BREAD },
    say: (
      <>
        You make a new file, <code>bread.txt</code>. It appears in your folder with the label <strong>new</strong>. Git
        sees it, but Git does not track it yet.
      </>
    ),
  },
  {
    do: 'git status',
    say: (
      <>
        <code>git status</code> asks Git: "What changed?" It is always safe to run. Use it before and after every other
        command until it is a habit.
      </>
    ),
  },
  {
    do: 'git add bread.txt',
    say: (
      <>
        <code>git add</code> moves the change into the staging area. Watch the label move. Think of the staging area as a box
        that you pack before you mail it.
      </>
    ),
  },
  {
    do: 'git commit -m "Add bread recipe"',
    say: (
      <>
        <code>git commit</code> closes the box and saves it. The change moves into the repository as a new commit. The
        staging area is empty again.
      </>
    ),
  },
  {
    do: [
      { kind: 'write', path: 'soup.txt', content: recipe('Leek soup', '- 2 leeks', '- 1 potato', '- 1 liter water', '- a pinch of salt') },
      { kind: 'write', path: 'bread.txt', content: recipe('Bread', '- 300 g flour', '- 200 g rye flour', '- 7 g yeast', '- 300 ml water', 'Bake for 40 minutes.') },
    ],
    say: (
      <>
        Now you change two files. The soup gets less salt. The bread gets rye flour, which is only a test. The two changes
        are not related.
      </>
    ),
  },
  {
    do: 'git add soup.txt',
    say: (
      <>
        This is why the staging area exists. You add only the soup. The bread change stays in your folder and is not part of
        the next commit.
      </>
    ),
  },
  {
    do: 'git commit -m "Use less salt in soup"',
    say: (
      <>
        The commit has only the soup change. Later, you can find or undo the salt change alone, without the bread test.
      </>
    ),
  },
  {
    do: ['git add bread.txt', 'git commit -m "Try rye flour"'],
    say: (
      <>
        The bread change gets its own commit. Tip: <code>git add .</code> adds all changes in the folder at once. Use it when
        all your changes belong together.
      </>
    ),
  },
]

export function StagingLesson() {
  return (
    <>
      <p>
        You saw <code>git add</code> before <code>git commit</code> in the last lesson. Here you learn why there are two
        steps. Watch the colored labels: they show where each change is.
      </p>
      <ScriptedDemo start={stagingStart} steps={stagingSteps} views={['areas', 'graph']} />
      <h2>The short version</h2>
      <ul>
        <li>
          You edit files in <strong>your folder</strong>.
        </li>
        <li>
          <code>git add</code> copies changes to the <strong>staging area</strong>.
        </li>
        <li>
          <code>git commit</code> saves what is in the staging area as a commit in the <strong>repository</strong>.
        </li>
      </ul>
      <p>
        If you want to commit all changes to files that Git already tracks, <code>git commit -am "message"</code> does the add
        and the commit in one step. It does not include new files.
      </p>
    </>
  )
}

const soupV = (salt: string, extra: string[] = []) => recipe('Leek soup', '- 2 leeks', '- 1 potato', ...extra, '- 1 liter water', salt)
const historyStart = built({ 'soup.txt': soupV('- 1 tsp salt') }, [
  'git init',
  'git add .',
  'git commit -m "First soup"',
  { kind: 'write', path: 'soup.txt', content: soupV('- 1 tsp salt', ['- 2 carrots']) },
  'git commit -am "Add carrots"',
  { kind: 'write', path: 'soup.txt', content: soupV('- a pinch of salt', ['- 2 carrots']) },
  'git commit -am "Less salt"',
  { kind: 'write', path: 'soup.txt', content: soupV('- a pinch of salt', ['- 2 carrots', '- 100 ml cream']) },
  'git commit -am "Add cream"',
])
const historySteps: Step[] = [
  { say: <>This soup recipe has four commits. The newest is on the right.</> },
  {
    do: 'git log --oneline',
    say: (
      <>
        <code>git log</code> lists the commits, newest first. Each line has the ID and the message. You use the ID to point at
        a commit.
      </>
    ),
  },
  {
    do: 'git checkout HEAD~2',
    say: (
      <>
        <code>git checkout</code> takes you to an old commit. <code>HEAD~2</code> means "two commits before where I am now".
        You can also type an ID. Look at the file: the cream and the pinch of salt are gone. Git changed the file in your
        folder to how it was then.
      </>
    ),
  },
  {
    say: (
      <>
        The yellow <strong>HEAD</strong> label shows where you are. Git calls this state <strong>detached HEAD</strong>. The
        name sounds bad, but it only means you are looking at an old commit and you are not on a branch. Use it to look, not
        to work.
      </>
    ),
  },
  {
    do: 'git switch main',
    say: (
      <>
        <code>git switch main</code> takes you back to the newest commit. The file has the cream again. Nothing was lost.
        Going back in time never deletes history.
      </>
    ),
  },
  {
    do: [{ kind: 'write', path: 'soup.txt', content: soupV('- a pinch of salt', ['- 2 carrots', '- 100 ml cream', '- black pepper']) }, 'git diff'],
    say: (
      <>
        Before you commit, <code>git diff</code> shows the lines you changed. Lines with <code>+</code> are new. Lines with{' '}
        <code>-</code> are removed. Add <code>--staged</code> to see the changes in the staging area.
      </>
    ),
  },
]

export function HistoryLesson() {
  return (
    <>
      <p>
        History is useful only if you can look at it. In this lesson you list the commits, open an old version, and come
        back.
      </p>
      <ScriptedDemo start={historyStart} steps={historySteps} views={['graph', 'files']} />
      <h2>Commands from this lesson</h2>
      <ul>
        <li>
          <code>git log</code>: list the commits. Add <code>--oneline</code> for a short list.
        </li>
        <li>
          <code>git checkout &lt;id&gt;</code>: look at the folder as it was at that commit.
        </li>
        <li>
          <code>git switch main</code>: go back to the newest commit on main.
        </li>
        <li>
          <code>git diff</code>: show the changed lines that you did not commit yet.
        </li>
      </ul>
    </>
  )
}
