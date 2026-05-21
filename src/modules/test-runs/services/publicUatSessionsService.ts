import { Http, PublicHttp } from '../../../config/http';
import type { PublicUatSessionSummary, TestRun, TestRunResult } from '../../../types';
import { extractFirstImageSrc } from '../../../utils/evidenceRichText';
import { testResultFromApi, testResultToApi } from '../../shared/services/enumMappers';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type {
  ActivatePublicUatSessionInput,
  PublicUatResultUpdateInput,
  PublicUatSessionDetail,
  PublicUatSessionStatusResponse,
} from '../types/model';

type PublicSessionStatusDto = PublicUatSessionStatusResponse;

type PublicSessionDetailDto = {
  session: {
    documentId: string;
    status: 'draft' | 'active' | 'completed' | 'expired' | 'revoked';
    expiresAt?: string | null;
    activatedAt?: string | null;
    completedAt?: string | null;
    readOnly: boolean;
    allowResultEditing: boolean;
    allowEvidenceUpload: boolean;
    allowCommentEditing: boolean;
    participantName: string;
    participantEmail?: string | null;
    deliveryNotes?: string;
  };
  testRun: {
    documentId: string;
    title: string;
    description?: string;
    executionDate?: string;
    status?: string;
    testType?: string;
    priority?: string;
    tester?: string;
    environment?: string;
    buildVersion?: string;
    sprint?: {
      documentId: string;
      name: string;
    } | null;
    results?: Array<{
      documentId: string;
      result?: string;
      notes?: string;
      evidenceImage?: string | null;
      functionality?: {
        documentId: string;
        code?: string | null;
        name?: string;
        module?: string;
      } | null;
      testCase?: {
        documentId: string;
        title?: string;
        description?: string;
        preconditions?: string;
        testSteps?: string;
        expectedResult?: string;
      } | null;
    }>;
  } | null;
};

type ApiEnvelope<T> = { data: T };

function mapPublicUatSessionSummary(
  dto?: PublicSessionStatusDto | null,
): PublicUatSessionSummary | null {
  if (!dto?.documentId) return null;

  return {
    documentId: dto.documentId,
    status: dto.status,
    expiresAt: dto.expiresAt || null,
    activatedAt: dto.activatedAt || null,
    completedAt: dto.completedAt || null,
    revokedAt: dto.revokedAt || null,
    lastAccessedAt: dto.lastAccessedAt || null,
    allowResultEditing: dto.allowResultEditing ?? true,
    allowEvidenceUpload: dto.allowEvidenceUpload ?? true,
    allowCommentEditing: dto.allowCommentEditing ?? true,
    completionLocked: dto.completionLocked ?? false,
    publicUrl: dto.publicUrl || null,
    participant: dto.participant || null,
  };
}

function mapPublicResult(dto: NonNullable<NonNullable<PublicSessionDetailDto['testRun']>['results']>[number]): TestRunResult {
  return {
    id: dto.documentId,
    functionalityId: dto.functionality?.documentId || '',
    functionalityName: dto.functionality?.name || '',
    moduleName: dto.functionality?.module || '',
    testCaseId: dto.testCase?.documentId || '',
    testCaseTitle: dto.testCase?.title || '',
    testCaseDescription: dto.testCase?.description || '',
    preconditions: dto.testCase?.preconditions || '',
    testSteps: dto.testCase?.testSteps || '',
    expectedResult: dto.testCase?.expectedResult || '',
    result: testResultFromApi(dto.result),
    notes: dto.notes || '',
    evidenceImage: dto.evidenceImage || undefined,
  };
}

function mapPublicDetail(dto: PublicSessionDetailDto): PublicUatSessionDetail {
  const mappedTestRun: TestRun | null = dto.testRun
    ? {
        id: dto.testRun.documentId,
        projectId: '',
        title: dto.testRun.title,
        description: dto.testRun.description || '',
        executionDate: dto.testRun.executionDate || '',
        status: (dto.testRun.status as TestRun['status']) || 'Borrador',
        testType: (dto.testRun.testType as TestRun['testType']) || 'UAT',
        sprint: dto.testRun.sprint?.name || '',
        priority: (dto.testRun.priority as TestRun['priority']) || 'Medio',
        tester: dto.testRun.tester || '',
        buildVersion: dto.testRun.buildVersion || '',
        environment: dto.testRun.environment as TestRun['environment'],
        selectedModules: [],
        selectedFunctionalities: [],
        results: (dto.testRun.results || []).map(mapPublicResult),
      }
    : null;

  return {
    session: dto.session,
    testRun: mappedTestRun,
  };
}

export async function activatePublicUatSession(
  testRunDocumentId: string,
  input: ActivatePublicUatSessionInput,
) {
  const response = await Http.post<ApiEnvelope<PublicSessionStatusDto>>(
    `/api/public-uat-sessions/test-runs/${encodeURIComponent(testRunDocumentId)}/activate`,
    {
      data: {
        participantNameSnapshot: input.participantNameSnapshot?.trim() || null,
        participantEmailSnapshot: input.participantEmailSnapshot?.trim().toLowerCase() || null,
        deliveryNotes: input.deliveryNotes?.trim() || null,
        expiresAt: input.expiresAt || null,
      },
    },
  );

  return mapPublicUatSessionSummary(response.data.data);
}

export async function getPublicUatSessionStatus(testRunDocumentId: string) {
  const response = await Http.get<ApiEnvelope<PublicSessionStatusDto | null>>(
    `/api/public-uat-sessions/test-runs/${encodeURIComponent(testRunDocumentId)}/status`,
  );

  return mapPublicUatSessionSummary(response.data.data);
}

export async function revokePublicUatSession(testRunDocumentId: string) {
  const response = await Http.put<ApiEnvelope<PublicSessionStatusDto>>(
    `/api/public-uat-sessions/test-runs/${encodeURIComponent(testRunDocumentId)}/revoke`,
    {},
  );

  return mapPublicUatSessionSummary(response.data.data);
}

export async function getPublicUatSession(token: string) {
  const response = await PublicHttp.get<ApiEnvelope<PublicSessionDetailDto>>(
    `/api/public-uat/${encodeURIComponent(token)}`,
  );

  return mapPublicDetail(response.data.data);
}

export async function savePublicUatResult(
  token: string,
  resultDocumentId: string,
  input: PublicUatResultUpdateInput,
) {
  const response = await PublicHttp.post<
    ApiEnvelope<{
      documentId: string;
      result?: string;
      notes?: string;
      evidenceImage?: string | null;
    }>
  >(`/api/public-uat/${encodeURIComponent(token)}/results/${encodeURIComponent(resultDocumentId)}`, {
    data: {
      ...(typeof input.result !== 'undefined' ? { result: testResultToApi(input.result) } : {}),
      ...(typeof input.notes !== 'undefined' ? { notes: input.notes || null } : {}),
      ...(typeof input.evidenceImage !== 'undefined'
        ? { evidenceImage: input.evidenceImage || null }
        : {}),
    },
  });

  return {
    id: response.data.data.documentId,
    result: testResultFromApi(response.data.data.result),
    notes: response.data.data.notes || '',
    evidenceImage: response.data.data.evidenceImage || undefined,
  };
}

export async function completePublicUatSession(token: string) {
  const response = await PublicHttp.post<ApiEnvelope<PublicSessionDetailDto>>(
    `/api/public-uat/${encodeURIComponent(token)}/complete`,
    {},
  );

  return mapPublicDetail(response.data.data);
}

export async function resolveProjectDocumentId(projectId: string) {
  const context = await findProjectContext(projectId);
  return context?.documentId || null;
}

export function derivePublicUatEvidencePayload(notes?: string | null) {
  const normalizedNotes = String(notes || '');
  return {
    notes: normalizedNotes,
    evidenceImage: extractFirstImageSrc(normalizedNotes) || null,
  };
}
