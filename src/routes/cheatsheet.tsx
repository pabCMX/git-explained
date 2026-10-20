import { createFileRoute, Link } from '@tanstack/react-router'
import type { Lesson } from '../lessons/registry'

export const Route = createFileRoute('/cheatsheet')({
  head: () => ({ meta: [{ title: 'Cheat sheet · Git, from the start' }] }),
  component: CheatSheet,
})

const groups: { title: string; lesson: Lesson['id']; advanced?: boolean; rows: [string, string][] }[] = [
  {
    title: 'Start',
    lesson: 'commits',
    rows: [
      ['git init', 'Start tracking the folder you are in.'],
      ['git clone <url>', 'Download a full copy of a remote repository.'],
    ],
  },
  {
    title: 'Save your work',
    lesson: 'staging',
    rows: [
      ['git status', 'Show what changed and where it is. Always safe.'],
      ['git add <file>', 'Put the changes in one file in the staging area.'],
      ['git add .', 'Put all changes in the staging area.'],
      ['git commit -m "message"', 'Save the staging area as a new commit.'],
      ['git commit -am "message"', 'Add all changed tracked files and commit them in one step.'],
    ],
  },
  {
    title: 'Look at history',
    lesson: 'history',
    rows: [
      ['git log --oneline', 'List the commits, newest first.'],
      ['git diff', 'Show changed lines that are not staged.'],
      ['git diff --staged', 'Show changed lines that are staged.'],
      ['git checkout <id>', 'Look at the folder as it was at a commit.'],
    ],
  },
  {
    title: 'Branches',
    lesson: 'branches',
    rows: [
      ['git branch', 'List the branches. A * marks the one you are on.'],
      ['git switch -c <name>', 'Make a new branch and go to it.'],
      ['git switch <name>', 'Go to a branch.'],
      ['git merge <name>', 'Bring the commits of another branch into this one.'],
      ['git branch -d <name>', 'Delete a branch label. The merged commits stay.'],
    ],
  },
  {
    title: 'Share',
    lesson: 'remotes',
    rows: [
      ['git remote add origin <url>', 'Connect this repository to a remote.'],
      ['git push', 'Send your commits to the remote.'],
      ['git fetch', 'Get new commits from the remote. Your files do not change.'],
      ['git pull', 'Fetch, then merge into your branch.'],
    ],
  },
  {
    title: 'Undo',
    lesson: 'undo',
    rows: [
      ['git restore <file>', 'Throw away changes to a file that you did not stage.'],
      ['git restore --staged <file>', 'Take a file out of the staging area. The file keeps your changes.'],
      ['git revert <id>', 'Make a new commit that undoes an old one.'],
      ['git merge --abort', 'Stop a merge and go back to before it.'],
    ],
  },
  {
    title: 'Put work aside',
    lesson: 'stash',
    advanced: true,
    rows: [
      ['git stash', 'Put changes to tracked files on a shelf. Add -u for new files.'],
      ['git stash list', 'Show what is on the shelf.'],
      ['git stash pop', 'Put the newest stash back and remove it from the shelf.'],
      ['git stash apply', 'Put the newest stash back and keep a copy on the shelf.'],
      ['git stash drop', 'Delete the newest stash.'],
    ],
  },
  {
    title: 'Branches on a team',
    lesson: 'team-branches',
    advanced: true,
    rows: [
      ['git push -u origin <branch>', 'Push a new branch and connect it to the remote one.'],
      ['git branch -a', 'List local and remote branches.'],
      ['git fetch --prune', 'Remove labels of remote branches that were deleted.'],
      ['git push origin --delete <branch>', 'Delete a branch on the remote.'],
      ['git branch -D <name>', 'Delete a branch, also if its commits are not merged.'],
    ],
  },
  {
    title: 'Combine branches',
    lesson: 'rebase',
    advanced: true,
    rows: [
      ['git merge --no-ff <branch>', 'Always make a merge commit, also when a fast-forward is possible.'],
      ['git merge --squash <branch>', 'Stage all changes of a branch as one change. Then commit.'],
      ['git rebase <branch>', 'Replay your commits on top of another branch.'],
      ['git pull --rebase', 'Fetch, then replay your commits on top of the remote ones.'],
    ],
  },
  {
    title: 'Rewrite your own commits',
    lesson: 'rewrite',
    advanced: true,
    rows: [
      ['git commit --amend', 'Replace the last commit with the staged changes. Add -m to change the message.'],
      ['git reset --soft <id>', 'Move the branch. Changes stay staged.'],
      ['git reset <id>', 'Move the branch. Changes stay in your folder, not staged.'],
      ['git reset --hard <id>', 'Move the branch and make your folder match. Uncommitted changes are deleted.'],
      ['git push --force-with-lease', 'Replace the remote branch, only if nobody else changed it.'],
    ],
  },
  {
    title: 'Copy, recover and investigate',
    lesson: 'blame-bisect',
    advanced: true,
    rows: [
      ['git cherry-pick <id>', 'Copy the change of one commit to this branch.'],
      ['git reflog', 'List every place HEAD has been. Use it to find lost commits.'],
      ['git branch <name> <id>', 'Make a branch at a commit, for example one from the reflog.'],
      ['git blame <file>', 'Show who last changed each line, and in which commit.'],
      ['git bisect start / good / bad / reset', 'Find the commit that broke something by halving the suspects.'],
    ],
  },
]

function CheatSheet() {
  return (
    <main className="mx-auto max-w-4xl px-4 pt-8 pb-24">
      <h1 className="text-3xl font-bold tracking-tight">Cheat sheet</h1>
      <p className="mt-1 text-ink-2">
        The commands from the lessons, in plain words. Words in &lt;angle brackets&gt; are for you to fill in. Try any of them in the{' '}
        <Link to="/playground" className="text-accent underline">
          playground
        </Link>
        .
      </p>
      <div className="mt-8 flex flex-col gap-6">
        {groups.map((g, i) => (
          <div key={g.title}>
            {g.advanced && !groups[i - 1]?.advanced && <h2 className="mt-6 mb-4 text-xl font-semibold">Advanced</h2>}
            <section className="rounded-xl border border-line bg-surface">
              <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
                <h2 className="font-semibold">{g.title}</h2>
                <Link to="/learn/$lessonId" params={{ lessonId: g.lesson }} className="text-xs text-accent hover:underline">
                  Lesson
                </Link>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {g.rows.map(([cmd, text]) => (
                    <tr key={cmd} className="border-b border-line last:border-0">
                      <td className="w-[42%] px-4 py-2.5 align-top font-mono text-[13px] whitespace-nowrap">{cmd}</td>
                      <td className="px-4 py-2.5 text-ink-2">{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        ))}
      </div>
    </main>
  )
}
