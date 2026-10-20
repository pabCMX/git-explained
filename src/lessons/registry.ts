import { BranchesLesson, MergingLesson } from './branching'
import { CommitsLesson, HistoryLesson, StagingLesson, WhyLesson } from './basics'
import { BlameBisectLesson, CherryPickLesson, ReflogLesson, RewriteLesson } from './repair'
import { RealLifeLesson, RemotesLesson, UndoLesson } from './sharing'
import { ForcePushLesson, RebaseLesson, StashLesson, TeamBranchesLesson } from './team'

export const parts = [
  { id: 'basics', title: 'The basics', summary: 'Everything you need to keep the history of your own files and share them.' },
  { id: 'advanced', title: 'Advanced', summary: 'For projects with many branches and many contributors.' },
] as const

/** All lessons in reading order. The id is the URL part: /learn/<id>. */
export const lessons = [
  { part: 'basics', id: 'why', title: 'Why track versions?', summary: 'The problem with final_v2_REAL.docx, and what Git does instead.', Component: WhyLesson },
  { part: 'basics', id: 'commits', title: 'A commit is a snapshot', summary: 'Start a repository and save your first versions.', Component: CommitsLesson },
  { part: 'basics', id: 'staging', title: 'Three places for your work', summary: 'Your folder, the staging area and the repository.', Component: StagingLesson },
  { part: 'basics', id: 'history', title: 'Look back in time', summary: 'List the commits, open an old version, see what changed.', Component: HistoryLesson },
  { part: 'basics', id: 'branches', title: 'Branches', summary: 'Try an idea without risk to the main version.', Component: BranchesLesson },
  { part: 'basics', id: 'merging', title: 'Merging and conflicts', summary: 'Bring work together, and decide when edits collide.', Component: MergingLesson },
  { part: 'basics', id: 'remotes', title: 'Share with a remote', summary: 'Clone, push, fetch and pull with other people.', Component: RemotesLesson },
  { part: 'basics', id: 'undo', title: 'Undo mistakes', summary: 'The right undo for the folder, the staging area and commits.', Component: UndoLesson },
  { part: 'basics', id: 'daily', title: 'Git in daily use', summary: 'The five-step loop, good habits and useful tools.', Component: RealLifeLesson },
  { part: 'advanced', id: 'stash', title: 'Put work aside with stash', summary: 'Stop in the middle of a change and come back to it later.', Component: StashLesson },
  { part: 'advanced', id: 'team-branches', title: 'Feature branches on a team', summary: 'Share branches, try other branches, clean up after a merge.', Component: TeamBranchesLesson },
  { part: 'advanced', id: 'rebase', title: 'Merge, squash or rebase', summary: 'Three ways to bring a branch into main, and the history each one gives.', Component: RebaseLesson },
  { part: 'advanced', id: 'rewrite', title: 'Fix your own commits', summary: 'Amend, squash, and the three kinds of reset.', Component: RewriteLesson },
  { part: 'advanced', id: 'force-push', title: 'Force push safely', summary: 'Replace a pushed branch without deleting the work of others.', Component: ForcePushLesson },
  { part: 'advanced', id: 'cherry-pick', title: 'Copy one commit', summary: 'Take a single fix from another branch with cherry-pick.', Component: CherryPickLesson },
  { part: 'advanced', id: 'reflog', title: 'Get lost commits back', summary: 'The reflog remembers where you have been.', Component: ReflogLesson },
  { part: 'advanced', id: 'blame-bisect', title: 'Who changed it, and when it broke', summary: 'Find the author of a line and the commit that caused a problem.', Component: BlameBisectLesson },
] as const

export type Lesson = (typeof lessons)[number]

/** Lessons of one part, with their number inside the part (1-based). */
export const lessonsIn = (part: Lesson['part']) =>
  lessons.filter((l) => l.part === part).map((l, i) => ({ ...l, n: i + 1 }))
