import {
  AutomationResultStatus,
  AutomationTool,
  ExecutionStatus,
  TestType,
} from '../../../types';
import {
  createDocument,
  listDocuments,
  populateParams,
  relation,
} from '../../shared/services/strapi';
import {
  executionStatusFromApi,
  testTypeFromApi,
} from '../../shared/services/enumMappers';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { AutomationImportHistoryDto } from '../types/api';
import type { AutomationImportHistoryRecord } from '../types/model';

function automationToolFromApi(value?: string) {
  switch ((value || '').toLowerCase()) {
    case 'cypress':
      return AutomationTool.CYPRESS;
    case 'postman':
      return AutomationTool.POSTMAN;
    case 'k6':
      return AutomationTool.K6;
    case 'webdriverio':
      return AutomationTool.WEBDRIVER_IO;
    case 'other':
      return AutomationTool.OTHER;
    case 'playwright':
    default:
      return value ? AutomationTool.PLAYWRIGHT : AutomationTool.PLAYWRIGHT;
  }
}

function automationToolToApi(value: AutomationTool) {
  switch (value) {
    case AutomationTool.CYPRESS:
      return 'cypress';
    case AutomationTool.POSTMAN:
      return 'postman';
    case AutomationTool.K6:
      return 'k6';
    case AutomationTool.WEBDRIVER_IO:
      return 'webdriverio';
    case AutomationTool.OTHER:
      return 'other';
    case AutomationTool.PLAYWRIGHT:
    default:
      return 'playwright';
  }
}

function automationResultStatusFromApi(value?: string) {
  switch ((value || '').toLowerCase()) {
    case 'failed':
      return AutomationResultStatus.FAILED;
    case 'skipped':
      return AutomationResultStatus.SKIPPED;
    case 'unknown':
      return AutomationResultStatus.UNKNOWN;
    case 'passed':
    default:
      return value ? AutomationResultStatus.PASSED : AutomationResultStatus.UNKNOWN;
  }
}

function automationResultStatusToApi(value: AutomationResultStatus) {
  switch (value) {
    case AutomationResultStatus.FAILED:
      return 'failed';
    case AutomationResultStatus.SKIPPED:
      return 'skipped';
    case AutomationResultStatus.UNKNOWN:
      return 'unknown';
    case AutomationResultStatus.PASSED:
    default:
      return 'passed';
  }
}

function mapAutomationImportHistory(document: AutomationImportHistoryDto): AutomationImportHistoryRecord {
  return {
    documentId: document.documentId,
    id: document.documentId,
    projectId: document.project?.key || '',
    testRunId: document.testRun?.documentId || '',
    testRunTitle: document.testRun?.title || 'Ejecución sin título',
    testRunStatus: executionStatusFromApi(document.testRun?.status) || ExecutionStatus.DRAFT,
    testRunType: testTypeFromApi(document.testRun?.testType) || TestType.FUNCTIONAL,
    tool: automationToolFromApi(document.tool),
    importedAt: document.importedAt || '',
    matchedCount: document.matchedCount || 0,
    missingReferenceCount: document.missingReferenceCount || 0,
    unmatchedExecutionCount: document.unmatchedExecutionCount || 0,
    unmatchedReportReferenceCount: document.unmatchedReportReferenceCount || 0,
    duplicateReferenceCount: document.duplicateReferenceCount || 0,
    matchedCases: (document.matchedCases || []).map(match => ({
      testCaseId: match.testCaseId,
      testCaseTitle: match.testCaseTitle,
      reference: match.reference,
      status: automationResultStatusFromApi(match.status),
      bugId: match.bugId,
    })),
  };
}

export async function getAutomationImportHistories(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<AutomationImportHistoryDto>(
    '/api/automation-import-histories',
    {
      ...populateParams(['project', 'testRun']),
      sort: 'importedAt:desc',
      ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
    },
  );

  return documents.map(mapAutomationImportHistory);
}

export async function saveAutomationImportHistory(
  input: Pick<
    AutomationImportHistoryRecord,
    | 'projectId'
    | 'testRunId'
    | 'tool'
    | 'importedAt'
    | 'matchedCount'
    | 'missingReferenceCount'
    | 'unmatchedExecutionCount'
    | 'unmatchedReportReferenceCount'
    | 'duplicateReferenceCount'
    | 'matchedCases'
  >,
) {
  const context = await findProjectContext(input.projectId);
  if (!context) {
    throw new Error(`Project ${input.projectId} is not available in the workspace.`);
  }

  const saved = await createDocument<AutomationImportHistoryDto>(
    '/api/automation-import-histories',
    {
      tool: automationToolToApi(input.tool),
      importedAt: input.importedAt,
      matchedCount: input.matchedCount,
      missingReferenceCount: input.missingReferenceCount,
      unmatchedExecutionCount: input.unmatchedExecutionCount,
      unmatchedReportReferenceCount: input.unmatchedReportReferenceCount,
      duplicateReferenceCount: input.duplicateReferenceCount,
      matchedCases: input.matchedCases.map(match => ({
        ...match,
        status: automationResultStatusToApi(match.status),
      })),
      project: relation(context.documentId),
      testRun: relation(input.testRunId),
    },
  );

  return mapAutomationImportHistory(saved);
}
