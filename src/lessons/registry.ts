import { BranchesLesson, MergingLesson } from './branching'
import { CommitsLesson, HistoryLesson, StagingLesson, WhyLesson } from './basics'
import { RealLifeLesson, RemotesLesson, UndoLesson } from './sharing'

/** All lessons in reading order. The id is the URL part: /learn/<id>. */
export const lessons = [
  { id: 'why', title: 'Why track versions?', summary: 'The problem with final_v2_REAL.docx, and what Git does instead.', Component: WhyLesson },
  { id: 'commits', title: 'A commit is a snapshot', summary: 'Start a repository and save your first versions.', Component: CommitsLesson },
  { id: 'staging', title: 'Three places for your work', summary: 'Your folder, the staging area and the repository.', Component: StagingLesson },
  { id: 'history', title: 'Look back in time', summary: 'List the commits, open an old version, see what changed.', Component: HistoryLesson },
  { id: 'branches', title: 'Branches', summary: 'Try an idea without risk to the main version.', Component: BranchesLesson },
  { id: 'merging', title: 'Merging and conflicts', summary: 'Bring work together, and decide when edits collide.', Component: MergingLesson },
  { id: 'remotes', title: 'Share with a remote', summary: 'Clone, push, fetch and pull with other people.', Component: RemotesLesson },
  { id: 'undo', title: 'Undo mistakes', summary: 'The right undo for the folder, the staging area and commits.', Component: UndoLesson },
  { id: 'daily', title: 'Git in daily use', summary: 'The five-step loop, good habits and useful tools.', Component: RealLifeLesson },
]

export type Lesson = (typeof lessons)[number]
