import type { CanvasCatalog } from './types';

/** Resolve links by persistence IDs; never infer ownership from a title or code. */
export function resolveCanvasCaseEdit(
  catalog: CanvasCatalog,
  projectId: string,
  functionalityCode: string,
  caseDocumentId: string,
) {
  const caseItem = catalog.cases.find(item =>
    item.documentId === caseDocumentId && item.testCase.documentId === caseDocumentId &&
    item.testCase.projectId === projectId && item.functionalityCode === functionalityCode,
  );
  if (!caseItem) return null;
  const functionality = catalog.functionalities.find(item =>
    item.documentId === caseItem.functionalityDocumentId && item.code === functionalityCode,
  );
  if (!functionality) return null;
  const moduleName = catalog.modules.find(item =>
    item.documentId === functionality.moduleDocumentId,
  )?.name || '';
  return { caseItem, functionality, moduleName };
}
