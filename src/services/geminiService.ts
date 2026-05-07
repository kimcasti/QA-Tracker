import { Http, isApiConfigured, toApiError } from '../config/http';
import { queryClient } from '../config/query';
import { invalidateWorkspaceCache } from '../modules/workspace/services/workspaceService';

export type ExecutionRecommendationCandidate = {
  id: string;
  name: string;
  module: string;
  priority: string;
  riskLevel: string;
  isCore: boolean;
  isRegression: boolean;
  isSmoke: boolean;
  lastFunctionalChangeAt?: string;
  roles: string[];
  testCaseCount: number;
};

export type ExecutionRecommendation = {
  functionalityId: string;
  reason: string;
};

type ProjectInsightInput = {
  name: string;
  description?: string;
  purpose?: string;
  coreRequirements?: string[];
  businessRules?: string;
};

export type DeliveryUnitAiSummaryContext = {
  deliveryUnit: {
    name: string;
    type?: string;
    status?: string;
    periodLabel?: string;
    startDate?: string;
    estimatedEndDate?: string;
    baseDescription?: string;
  };
  activities: Array<{
    name: string;
    description?: string;
  }>;
  functionalities: Array<{
    name: string;
    status?: string;
    priority?: string;
    module?: string;
  }>;
  metrics: {
    totalFunctionalities: number;
    completed: number;
    inProgress: number;
    pending: number;
    activeBugs: number;
    testCasesCount: number;
    progressPercent: number;
  };
};

export type DeliveryUnitAiSummary = {
  introduction: string;
  objectives: string;
  conclusion: string;
};

function toServiceError(error: unknown) {
  const apiError = toApiError(error);
  throw new Error(apiError.message);
}

async function postAi<T>(path: string, data: Record<string, unknown>) {
  try {
    const response = await Http.post(path, { data });
    invalidateWorkspaceCache();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workspace'] }),
      queryClient.invalidateQueries({ queryKey: ['workspace', 'organization-usage'] }),
    ]);
    return response.data?.data as T;
  } catch (error) {
    toServiceError(error);
  }
}

export const hasAiProviderConfigured = () => isApiConfigured();

export async function generateTestCasesWithAI(
  functionalityName: string,
  moduleName: string,
  projectId?: string,
) {
  return postAi<any[]>('/api/ai/test-cases/generate', {
    functionalityName,
    moduleName,
    projectId,
  });
}

export async function improveMeetingNotesWithAI(notes: string, projectId?: string) {
  return postAi<{
    summary: string;
    decisions: string;
    actions: string;
    nextSteps: string;
  }>('/api/ai/meeting-notes/improve', {
    notes,
    projectId,
  });
}

export async function recommendExecutionFunctionalitiesWithAI(input: {
  projectId?: string;
  testType: string;
  selectedModules: string[];
  selectedFunctionalities: ExecutionRecommendationCandidate[];
  candidateFunctionalities: ExecutionRecommendationCandidate[];
  maxSuggestions?: number;
}) {
  return postAi<ExecutionRecommendation[]>('/api/ai/execution-functionalities/recommend', input);
}

export async function analyzeProjectWithAI(input: ProjectInsightInput, projectId?: string) {
  return postAi<string>('/api/ai/project/analyze', {
    ...input,
    projectId,
  });
}

export async function generateProjectWireframeBrief(
  input: ProjectInsightInput,
  projectId?: string,
) {
  return postAi<string>('/api/ai/project/wireframe-brief', {
    ...input,
    projectId,
  });
}

export async function generateDeliveryUnitSummaryWithAI(
  input: DeliveryUnitAiSummaryContext,
  projectId?: string,
) {
  return postAi<DeliveryUnitAiSummary>('/api/ai/delivery-units/summary', {
    ...input,
    projectId,
  });
}
