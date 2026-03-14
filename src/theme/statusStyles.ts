import { BugStatus, TestStatus } from '../types';
import { qaPalette, softBorder, softSurface } from './palette';

export const functionalityStatusColors: Record<TestStatus, string> = {
  [TestStatus.BACKLOG]: qaPalette.functionalityStatus.backlog,
  [TestStatus.POST_MVP]: qaPalette.functionalityStatus.postMvp,
  [TestStatus.IN_PROGRESS]: qaPalette.functionalityStatus.inProgress,
  [TestStatus.COMPLETED]: qaPalette.functionalityStatus.completed,
  [TestStatus.FAILED]: qaPalette.functionalityStatus.failed,
  [TestStatus.MVP]: qaPalette.functionalityStatus.inProgress,
};

export const bugStatusColors: Record<BugStatus, string> = {
  [BugStatus.PENDING]: qaPalette.bugStatus.pending,
  [BugStatus.IN_PROGRESS]: qaPalette.bugStatus.inProgress,
  [BugStatus.QA]: qaPalette.bugStatus.qa,
  [BugStatus.RESOLVED]: qaPalette.bugStatus.resolved,
};

export function softTagStyle(color: string) {
  return {
    color,
    backgroundColor: softSurface(color),
    borderColor: softBorder(color),
  };
}
