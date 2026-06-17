import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  DatePicker,
  Row,
  Col,
  Spin,
  message,
  Tooltip,
  Divider,
  Checkbox,
  Popconfirm,
  List,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  BugOutlined,
  ArrowLeftOutlined,
  SaveOutlined,
  ExportOutlined,
  SearchOutlined,
  BarChartOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
  MinusOutlined,
  LinkOutlined,
  StopOutlined,
  CopyOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { runTrackedExport } from '../modules/plans/services/planAccessService';
import { startUpgradeRequestFlow } from '../modules/plans/services/billingService';
import { PlanBillingBanner } from '../modules/plans/components/PlanBillingBanner';
import { UpgradeModal } from '../modules/plans/components/UpgradeModal';
import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useParticipantDirectoryMembers } from '../modules/participant-directory/hooks/useParticipantDirectoryMembers';
import { ParticipantSelect } from '../modules/participant-directory/components/ParticipantSelect';
import { useModules } from '../modules/settings/hooks/useModules';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useTestRunSummaries } from '../modules/test-runs/hooks/useTestRunSummaries';
import { useTestRuns } from '../modules/test-runs/hooks/useTestRuns';
import { getTestRunById } from '../modules/test-runs/services/testRunsService';
import { usePublicUatSessionActions } from '../modules/test-runs/hooks/usePublicUatSession';
import { getPublicUatSessionStatus } from '../modules/test-runs/services/publicUatSessionsService';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  Browser,
  DeviceType,
  TestExecution,
  TestStatus,
  TestResult,
  TestType,
  ExecutionStatus,
  Priority,
  RiskLevel,
  FunctionalityScope,
  Severity,
  TestRun,
  TestRunResult,
  Environment,
  BugOrigin,
  Functionality,
  OperatingSystem,
  PublicUatSessionSummary,
} from '../types';
import {
  labelEnvironment,
  labelExecutionStatus,
  labelPriority,
  labelTestResult,
} from '../i18n/labels';
import { previewNextInternalBugId, syncBugReport } from '../services/bugTrackerService';
import BugHistoryView from './BugHistoryView';
import CoverageMatrix from './CoverageMatrix';
import dayjs from 'dayjs';
import type { FilterValue } from 'antd/es/table/interface';
import { isPayloadTooLargeError, showPayloadTooLargeMessage } from '../utils/uploadValidation';
import {
  extractFirstImageSrc,
  hasMeaningfulEvidenceContent,
  mergeEvidenceContentWithImage,
  normalizeEvidenceHtml,
  stripHtmlToText,
} from '../utils/evidenceRichText';
import { exportTestRunToPdf } from '../utils/reportUtils';
import type { ExecutionRecommendationCandidate } from '../services/geminiService';
import { PlanUpgradeCard } from '../modules/plans/components/PlanUpgradeCard';
import {
  buildProjectUpgradeWhatsAppUrl,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';

const { Text, Title } = Typography;
const EvidenceRichEditor = lazy(() => import('./EvidenceRichEditor'));
const browserOptions = Object.values(Browser).map(value => ({ label: value, value }));
const deviceTypeOptions = Object.values(DeviceType).map(value => ({ label: value, value }));
const operatingSystemOptions = Object.values(OperatingSystem).map(value => ({
  label: value,
  value,
}));
const EXECUTION_RISK_OPTIONS = [
  { label: 'Cambios en base de datos', value: 'database-changes' },
  { label: 'Cambios de autenticación', value: 'auth-changes' },
  { label: 'Integraciones externas', value: 'external-integrations' },
  { label: 'Cambios UI/UX', value: 'ui-ux-changes' },
  { label: 'APIs modificadas', value: 'api-changes' },
  { label: 'Riesgo alto de regresión', value: 'high-regression-risk' },
  { label: 'Otro', value: 'other' },
];
const EXECUTION_EXIT_CRITERIA_OPTIONS = [
  { label: '100% de casos ejecutados', value: 'all-executed' },
  { label: 'Sin bugs críticos', value: 'no-critical-bugs' },
  { label: 'Sin bloqueos activos', value: 'no-active-blockers' },
  { label: 'Pass Rate >= 90%', value: 'pass-rate-90' },
  { label: 'Todos los bugs corregidos', value: 'all-bugs-fixed' },
  { label: 'Aprobación del Product Owner', value: 'po-approval' },
];

const TEST_TYPE_DEFAULTS: Partial<
  Record<
    TestType,
    {
      environment?: Environment;
      identifiedRisks: string[];
      exitCriteria: string[];
      helperText: string;
    }
  >
> = {
  [TestType.FUNCTIONAL]: {
    environment: Environment.TEST,
    identifiedRisks: ['ui-ux-changes'],
    exitCriteria: ['all-executed', 'no-critical-bugs'],
    helperText: 'Pensada para validar flujos funcionales y comportamiento esperado por mÃ³dulo.',
  },
  [TestType.INTEGRATION]: {
    environment: Environment.TEST,
    identifiedRisks: ['api-changes', 'external-integrations', 'database-changes'],
    exitCriteria: ['all-executed', 'no-critical-bugs', 'no-active-blockers'],
    helperText: 'Prioriza dependencias entre componentes, servicios y flujos de integraciÃ³n.',
  },
  [TestType.SANITY]: {
    environment: Environment.TEST,
    identifiedRisks: ['high-regression-risk'],
    exitCriteria: ['all-executed', 'no-critical-bugs'],
    helperText: 'Ideal para una validaciÃ³n rÃ¡pida despuÃ©s de cambios sensibles o despliegues.',
  },
  [TestType.EXPLORATORY]: {
    environment: Environment.TEST,
    identifiedRisks: ['ui-ux-changes', 'other'],
    exitCriteria: ['no-critical-bugs'],
    helperText: 'Ãštil para descubrir comportamientos no previstos y explorar riesgo residual.',
  },
  [TestType.UAT]: {
    environment: Environment.PRODUCTION,
    identifiedRisks: ['external-integrations', 'ui-ux-changes'],
    exitCriteria: ['no-critical-bugs', 'po-approval'],
    helperText: 'Enfocada en validaciÃ³n de negocio y aprobaciÃ³n final con participantes externos.',
  },
};

function EvidenceRichEditorField(props: React.ComponentProps<typeof EvidenceRichEditor>) {
  return (
    <Suspense fallback={<div className="py-3 text-sm text-slate-400">Cargando editor...</div>}>
      <EvidenceRichEditor {...props} />
    </Suspense>
  );
}

function formatPublicSessionDate(value?: string | null, fallback = 'No disponible') {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function renderRichTextContent(value?: string | null) {
  const normalizedHtml = normalizeEvidenceHtml(value);
  const plainText = stripHtmlToText(value);

  if (!normalizedHtml || !plainText) {
    return <p className="mt-1 text-sm text-slate-500">-</p>;
  }

  return (
    <div
      className="qa-rich-text-content mt-1 text-sm text-slate-700"
      dangerouslySetInnerHTML={{ __html: normalizedHtml }}
    />
  );
}

function PlanningSectionCard({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sm font-bold text-sky-700">
          {step}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

type NativeExecutionTableFilterState = {
  status: React.Key[] | null;
  sprint: React.Key[] | null;
  testType: React.Key[] | null;
  environment: React.Key[] | null;
};

type AiExecutionSuggestion = {
  functionalityId: string;
  reason: string;
  source: 'ai' | 'rules';
};

function formatCompactId(value?: string | null, startLength = 6, endLength = 5) {
  if (!value) return '—';

  const normalizedValue = value.trim();
  if (normalizedValue.length <= startLength + endLength + 3) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, startLength)}...${normalizedValue.slice(-endLength)}`;
}

function labelPublicUatSessionStatus(status?: PublicUatSessionSummary['status'] | null) {
  switch (status) {
    case 'active':
      return 'Sesión activa';
    case 'completed':
      return 'Sesión completada';
    case 'expired':
      return 'Sesión expirada';
    case 'revoked':
      return 'Sesión cerrada';
    case 'draft':
      return 'Borrador público';
    default:
      return 'Sin sesión pública';
  }
}

function publicUatStatusColor(status?: PublicUatSessionSummary['status'] | null) {
  switch (status) {
    case 'active':
      return 'processing';
    case 'completed':
      return 'success';
    case 'expired':
      return 'warning';
    case 'revoked':
      return 'default';
    case 'draft':
      return 'orange';
    default:
      return 'default';
  }
}

export default function TestExecutionView({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    data: workspace,
    activeMembership,
    projectQuota,
    isViewer,
    isOwner,
  } = useWorkspaceAccess();
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: testRunSummariesData } = useTestRunSummaries(projectId);
  const { save: saveTestRun, delete: deleteTestRun } = useTestRuns(projectId, {
    enabled: false,
  });
  const {
    activate: activatePublicUatSession,
    revoke: revokePublicUatSession,
    isActivating: isActivatingPublicUatSession,
    isRevoking: isRevokingPublicUatSession,
  } = usePublicUatSessionActions(projectId);
  const { data: allTestCases } = useTestCases(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testRuns = Array.isArray(testRunSummariesData) ? testRunSummariesData : [];
  const testCases = Array.isArray(allTestCases) ? allTestCases : [];
  const canDeleteTestRuns = isOwner || activeMembership?.role?.code === 'owner';
  const activeOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.plan || activeMembership?.organization?.plan,
  );
  const effectiveOrganizationPlan = normalizeOrganizationPlan(
    projectQuota?.effectivePlan || projectQuota?.plan || activeMembership?.organization?.plan,
  );
  const activeBillingState = {
    planStatus:
      projectQuota?.billing?.planStatus || activeMembership?.organization?.planStatus || 'active',
    planExpiresAt:
      projectQuota?.billing?.planExpiresAt || activeMembership?.organization?.planExpiresAt || null,
    gracePeriodEndsAt:
      projectQuota?.billing?.gracePeriodEndsAt ||
      activeMembership?.organization?.gracePeriodEndsAt ||
      null,
    inGracePeriod: projectQuota?.billing?.inGracePeriod ?? false,
    downgradedToStarter: projectQuota?.billing?.downgradedToStarter ?? false,
  };
  const canUseAi = projectQuota?.aiUsage?.canUse ?? Boolean(projectQuota?.features?.ai);
  const projectUsageCount = projectQuota?.usage?.projects ?? projectQuota?.currentCount ?? 0;
  const projectLimit = projectQuota?.limits?.projects ?? projectQuota?.limit ?? 3;
  const upgradePriceMonthlyUsd = projectQuota?.upgradePriceMonthlyUsd ?? 5;
  const aiUpgradeUrl = buildProjectUpgradeWhatsAppUrl({
    organizationName: activeMembership?.organization?.name,
    currentCount: projectUsageCount,
    limit: projectLimit,
    upgradePriceMonthlyUsd,
    messageVariant: 'ai-access',
  });
  const handleUpgradeClick = async (source: string) => {
    try {
      await startUpgradeRequestFlow({
        requestedPlan: 'growth',
        source,
        currentCount: projectUsageCount,
        limitValue: projectLimit,
        priceMonthlyUsd: upgradePriceMonthlyUsd,
        contactUrl: aiUpgradeUrl,
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'No pudimos iniciar la solicitud de upgrade.',
      );
    }
  };
  const handleEnterpriseClick = async () => {
    try {
      await startUpgradeRequestFlow({
        requestedPlan: 'enterprise',
        source: 'test-execution-upgrade-modal-enterprise',
        currentCount: projectUsageCount,
        limitValue: projectLimit,
        priceMonthlyUsd: null,
        contactUrl: aiUpgradeUrl,
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'No pudimos iniciar la solicitud de upgrade.',
      );
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isEditingRunInfo, setIsEditingRunInfo] = useState(false);
  const [openingRunId, setOpeningRunId] = useState<string | null>(null);
  const { data: participantDirectoryMembers = [], isLoading: isParticipantDirectoryLoading } =
    useParticipantDirectoryMembers(isModalOpen);
  const [activeTestRun, setActiveTestRun] = useState<TestRun | null>(null);
  const [form] = Form.useForm();
  const [evidenceForm] = Form.useForm();
  const [publicUatForm] = Form.useForm();
  const [isPublicUatModalOpen, setIsPublicUatModalOpen] = useState(false);
  const [selectedPublicUatRun, setSelectedPublicUatRun] = useState<TestRun | null>(null);
  const [publicUatStatusModalRun, setPublicUatStatusModalRun] = useState<TestRun | null>(null);
  const [publicUatStatusInfo, setPublicUatStatusInfo] = useState<PublicUatSessionSummary | null>(
    null,
  );
  const [isLoadingPublicUatStatus, setIsLoadingPublicUatStatus] = useState(false);

  // Step 1 State
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedFuncIds, setSelectedFuncIds] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiExecutionSuggestion[]>([]);
  const [isSuggestingAi, setIsSuggestingAi] = useState(false);
  const [aiSuggestionMode, setAiSuggestionMode] = useState<'ai' | 'rules' | null>(null);

  // Step 2 State (Execution View)
  const [executionResults, setExecutionResults] = useState<TestRunResult[]>([]);
  const [executionSearchText, setExecutionSearchText] = useState('');
  const [filterOnlyFailed, setFilterOnlyFailed] = useState(false);

  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [currentEvidenceTestCaseId, setCurrentEvidenceTestCaseId] = useState<string | null>(null);
  const [originalEvidenceRecord, setOriginalEvidenceRecord] = useState<TestRunResult | null>(null);

  // Always read the latest record from state, so evidence edits reflect immediately.
  const currentEvidenceRecord = useMemo(() => {
    if (!currentEvidenceTestCaseId) return null;
    return executionResults.find(r => r.testCaseId === currentEvidenceTestCaseId) || null;
  }, [currentEvidenceTestCaseId, executionResults]);

  const activeEvidenceTestCase = useMemo(() => {
    if (!currentEvidenceRecord) return null;
    return testCases.find(tc => tc.id === currentEvidenceRecord.testCaseId) || null;
  }, [currentEvidenceRecord, testCases]);

  const activeEvidenceFunctionality = useMemo(() => {
    if (!currentEvidenceRecord) return null;
    return functionalities.find(func => func.id === currentEvidenceRecord.functionalityId) || null;
  }, [currentEvidenceRecord, functionalities]);
  const isFailureEvidenceRequired = currentEvidenceRecord?.result === TestResult.FAILED;

  useEffect(() => {
    if (currentEvidenceRecord && isEvidenceModalOpen) {
      evidenceForm.setFieldsValue({
        evidence: mergeEvidenceContentWithImage(
          currentEvidenceRecord.notes || '',
          currentEvidenceRecord.evidenceImage,
        ),
        bugTitle: currentEvidenceRecord.bugTitle || '',
        severity: currentEvidenceRecord.severity,
        bugLink: currentEvidenceRecord.bugLink || '',
      });
    } else {
      evidenceForm.resetFields();
    }
  }, [currentEvidenceRecord, evidenceForm, isEvidenceModalOpen]);

  const functionalityIdsWithTestCases = useMemo(() => {
    return new Set(testCases.map(testCase => testCase.functionalityId).filter(Boolean));
  }, [testCases]);

  const functionalitiesWithTestCases = useMemo(() => {
    return functionalities.filter(func => functionalityIdsWithTestCases.has(func.id));
  }, [functionalities, functionalityIdsWithTestCases]);

  const completedFunctionalitiesWithTestCases = useMemo(() => {
    return functionalitiesWithTestCases.filter(func => func.status === TestStatus.COMPLETED);
  }, [functionalitiesWithTestCases]);

  const moduleOptions = useMemo(() => {
    const validModules = new Set(completedFunctionalitiesWithTestCases.map(func => func.module));

    return modulesData
      .filter(module => validModules.has(module.name))
      .map(module => ({ label: module.name, value: module.name }));
  }, [completedFunctionalitiesWithTestCases, modulesData]);

  const openEvidenceModal = (record: TestRunResult) => {
    setOriginalEvidenceRecord({ ...record });
    setCurrentEvidenceTestCaseId(record.testCaseId);
    setIsEvidenceModalOpen(true);

    if (record.result === TestResult.FAILED && !record.bugId?.trim() && activeTestRun?.projectId) {
      void previewNextInternalBugId(
        activeTestRun.projectId,
        executionResults
          .filter(item => item.testCaseId !== record.testCaseId)
          .map(item => item.bugId),
      ).then(nextBugId => {
        updateResult(record.testCaseId, 'bugId', nextBugId);
      });
    }
  };

  const closeEvidenceModal = () => {
    setIsEvidenceModalOpen(false);
    setCurrentEvidenceTestCaseId(null);
    setOriginalEvidenceRecord(null);
    evidenceForm.resetFields();
  };

  const restoreEvidenceChanges = () => {
    if (originalEvidenceRecord) {
      setExecutionResults(prev =>
        prev.map(result =>
          result.testCaseId === originalEvidenceRecord.testCaseId ? originalEvidenceRecord : result,
        ),
      );
    }

    closeEvidenceModal();
  };

  const handleSaveEvidence = async () => {
    if (!currentEvidenceRecord) return;

    try {
      const values = await evidenceForm.validateFields();
      const evidenceHtml = String(values.evidence || '');
      const derivedEvidenceImage = extractFirstImageSrc(evidenceHtml);
      const bugDescription = stripHtmlToText(evidenceHtml);
      const mergedRecord: TestRunResult = {
        ...currentEvidenceRecord,
        notes: evidenceHtml,
        bugTitle: values.bugTitle || '',
        severity: values.severity,
        bugLink: values.bugLink || '',
        evidenceImage: derivedEvidenceImage,
      };

      if (
        mergedRecord.result === TestResult.FAILED &&
        !hasMeaningfulEvidenceContent(evidenceHtml)
      ) {
        message.error('Las notas de ejecución son obligatorias para pruebas fallidas.');
        return;
      }

      if (mergedRecord.result === TestResult.FAILED && !mergedRecord.evidenceImage?.trim()) {
        message.error(
          'Para pruebas fallidas son obligatorias las notas de ejecución, el título del bug, la severidad y una imagen pegada o subida dentro del editor.',
        );
        return;
      }

      setExecutionResults(prev =>
        prev.map(result => (result.testCaseId === mergedRecord.testCaseId ? mergedRecord : result)),
      );

      if (
        mergedRecord.result === TestResult.FAILED &&
        activeTestRun &&
        activeEvidenceFunctionality
      ) {
        const syncedBug = await syncBugReport({
          linkedBugId: mergedRecord.linkedBugId,
          internalBugId: mergedRecord.bugId,
          title: mergedRecord.bugTitle,
          description: bugDescription,
          severity: mergedRecord.severity,
          bugLink: mergedRecord.bugLink,
          evidenceImage: mergedRecord.evidenceImage,
          origin: BugOrigin.GENERAL_EXECUTION,
          projectId: activeTestRun.projectId,
          functionalityId: activeEvidenceFunctionality.id,
          functionalityName: activeEvidenceFunctionality.name,
          module: activeEvidenceFunctionality.module,
          sprint: activeTestRun.sprint,
          reportedBy: activeTestRun.tester,
          testCaseId: mergedRecord.testCaseId,
          testCaseTitle: activeEvidenceTestCase?.title,
          testRunId: activeTestRun.id,
          executionId: mergedRecord.id,
        });

        if (syncedBug) {
          setExecutionResults(prev =>
            prev.map(result =>
              result.testCaseId === mergedRecord.testCaseId
                ? {
                    ...result,
                    linkedBugId: syncedBug.internalBugId,
                    bugId: syncedBug.internalBugId,
                  }
                : result,
            ),
          );
          await queryClient.invalidateQueries({
            queryKey: ['bugs', activeTestRun.projectId],
          });
        }
      }

      closeEvidenceModal();
      message.success('Evidencia guardada correctamente');
    } catch (error) {
      console.error('Error saving evidence:', error);
      if (isPayloadTooLargeError(error)) {
        showPayloadTooLargeMessage();
        return;
      }
      message.error('Error al guardar la evidencia. Por favor revisa los campos.');
    }
  };

  const availableFunctionalities = useMemo(() => {
    return completedFunctionalitiesWithTestCases.filter(f => selectedModules.includes(f.module));
  }, [selectedModules, completedFunctionalitiesWithTestCases]);

  const selectedTestType = Form.useWatch('testType', form) as TestType | undefined;
  const watchedTitle = Form.useWatch('title', form) as string | undefined;
  const watchedSprint = Form.useWatch('sprint', form) as string | undefined;
  const watchedPriority = Form.useWatch('priority', form) as Priority | undefined;
  const watchedTester = Form.useWatch('tester', form) as string | undefined;
  const watchedEnvironment = Form.useWatch('environment', form) as Environment | undefined;
  const watchedIdentifiedRisks = (Form.useWatch('identifiedRisks', form) as string[] | undefined) || [];
  const watchedExitCriteria = (Form.useWatch('exitCriteria', form) as string[] | undefined) || [];

  const testCaseCountByFunctionality = useMemo(() => {
    const counts = new Map<string, number>();
    testCases.forEach(testCase => {
      counts.set(testCase.functionalityId, (counts.get(testCase.functionalityId) || 0) + 1);
    });
    return counts;
  }, [testCases]);

  const testCaseById = useMemo(() => {
    return new Map(testCases.map(testCase => [testCase.id, testCase]));
  }, [testCases]);

  const functionalityById = useMemo(() => {
    return new Map(functionalities.map(func => [func.id, func]));
  }, [functionalities]);

  const selectedFunctionalityModels = useMemo(() => {
    return selectedFuncIds
      .map(id => functionalityById.get(id))
      .filter((item): item is Functionality => Boolean(item));
  }, [selectedFuncIds, functionalityById]);

  const buildRecommendationCandidate = (func: Functionality): ExecutionRecommendationCandidate => ({
    id: func.id,
    name: func.name,
    module: func.module,
    priority: func.priority,
    riskLevel: func.riskLevel,
    isCore: Boolean(func.isCore),
    isRegression: Boolean(func.isRegression),
    isSmoke: Boolean(func.isSmoke),
    lastFunctionalChangeAt: func.lastFunctionalChangeAt,
    roles: func.roles || [],
    testCaseCount: testCaseCountByFunctionality.get(func.id) || 0,
  });

  const isRecentFunctionalChange = (value?: string) => {
    if (!value) return false;
    const parsed = dayjs(value);
    return parsed.isValid() && dayjs().diff(parsed, 'day') <= 14;
  };

  const ruleBasedSuggestionPool = useMemo(() => {
    if (!selectedModules.length) return [];

    const selectedRoleSet = new Set(selectedFunctionalityModels.flatMap(func => func.roles || []));

    const scored = completedFunctionalitiesWithTestCases
      .filter(func => !selectedFuncIds.includes(func.id))
      .map(func => {
        let score = 0;
        const reasons: string[] = [];
        const sameModule = selectedModules.includes(func.module);
        const recentChange = isRecentFunctionalChange(func.lastFunctionalChangeAt);
        const hasHighPriority =
          func.priority === Priority.HIGH || func.priority === Priority.CRITICAL;
        const hasHighRisk = func.riskLevel === RiskLevel.HIGH;
        const sharesRoles = (func.roles || []).some(role => selectedRoleSet.has(role));

        if (sameModule) {
          score += 4;
          reasons.push('pertenece a un módulo seleccionado');
        }
        if (recentChange) {
          score += 4;
          reasons.push('tuvo un cambio reciente');
        }
        if (func.isCore) {
          score += 3;
          reasons.push('es parte del core');
        }
        if (hasHighPriority) {
          score += 2;
          reasons.push('tiene prioridad alta');
        }
        if (hasHighRisk) {
          score += 2;
          reasons.push('presenta riesgo alto');
        }
        if (sharesRoles) {
          score += 1;
          reasons.push('comparte roles con el flujo seleccionado');
        }

        if (selectedTestType === TestType.SANITY && func.isCore) {
          score += 2;
          reasons.push('encaja bien para una validación sanity');
        }
        if (selectedTestType === TestType.INTEGRATION && (hasHighRisk || recentChange)) {
          score += 2;
          reasons.push('podría impactar integraciones relacionadas');
        }
        if (
          selectedTestType === TestType.EXPLORATORY &&
          (recentChange || hasHighRisk || hasHighPriority)
        ) {
          score += 1;
          reasons.push('vale la pena explorarlo por su nivel de cambio o riesgo');
        }
        if (selectedTestType === TestType.UAT && (func.isCore || hasHighPriority)) {
          score += 1;
          reasons.push('podría afectar un flujo relevante para negocio');
        }

        return {
          func,
          score,
          reasons,
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.func.name.localeCompare(b.func.name))
      .slice(0, 10);

    return scored;
  }, [
    completedFunctionalitiesWithTestCases,
    selectedFuncIds,
    selectedFunctionalityModels,
    selectedModules,
    selectedTestType,
  ]);

  const visibleAiSuggestions = useMemo(() => {
    return aiSuggestions.filter(
      suggestion => !selectedFuncIds.includes(suggestion.functionalityId),
    );
  }, [aiSuggestions, selectedFuncIds]);

  const groupedFunctionalities = useMemo(() => {
    const groups: Record<string, typeof functionalities> = {};
    availableFunctionalities.forEach(f => {
      if (!groups[f.module]) groups[f.module] = [];
      groups[f.module].push(f);
    });
    return groups;
  }, [availableFunctionalities]);

  const selectedTestCaseCount = useMemo(
    () =>
      selectedFuncIds.reduce(
        (total, functionalityId) => total + (testCaseCountByFunctionality.get(functionalityId) || 0),
        0,
      ),
    [selectedFuncIds, testCaseCountByFunctionality],
  );

  const executionPlanningSteps = useMemo(() => {
    const generalComplete = Boolean(
      watchedTitle?.trim() &&
        selectedTestType &&
        watchedSprint &&
        watchedPriority &&
        watchedTester &&
        watchedEnvironment,
    );
    const scopeComplete = Boolean(
      selectedModules.length > 0 && (isEditingRunInfo || selectedFuncIds.length > 0),
    );
    const environmentComplete = Boolean(watchedEnvironment);
    const risksComplete = watchedIdentifiedRisks.length > 0;
    const criteriaComplete = watchedExitCriteria.length > 0;

    const sections = [
      { key: 'general', label: 'General', complete: generalComplete },
      { key: 'scope', label: 'Alcance', complete: scopeComplete },
      { key: 'environment', label: 'Ambiente', complete: environmentComplete },
      { key: 'risks', label: 'Riesgos', complete: risksComplete },
      { key: 'criteria', label: 'Criterios', complete: criteriaComplete },
      {
        key: 'create',
        label: 'Crear',
        complete: generalComplete && scopeComplete && environmentComplete,
      },
    ];

    const currentIndex = sections.findIndex(section => !section.complete);

    return {
      sections,
      currentIndex: currentIndex === -1 ? sections.length - 1 : currentIndex,
    };
  }, [
    isEditingRunInfo,
    selectedFuncIds.length,
    selectedModules.length,
    selectedTestType,
    watchedEnvironment,
    watchedExitCriteria.length,
    watchedIdentifiedRisks.length,
    watchedPriority,
    watchedSprint,
    watchedTester,
    watchedTitle,
  ]);

  const executionTestTypeOptions = useMemo(
    () =>
      Object.values(TestType)
        .filter(type => type !== TestType.REGRESSION && type !== TestType.SMOKE)
        .map(type => ({ label: type, value: type })),
    [],
  );

  const currentTestTypeDefaults = selectedTestType
    ? TEST_TYPE_DEFAULTS[selectedTestType]
    : undefined;

  useEffect(() => {
    // Auto-select all functionalities when modules change
    const newIds = availableFunctionalities.map(f => f.id);
    setSelectedFuncIds(newIds);
  }, [availableFunctionalities]);

  useEffect(() => {
    setAiSuggestions([]);
    setAiSuggestionMode(null);
  }, [selectedModules, selectedTestType]);

  useEffect(() => {
    if (!isModalOpen || isEditingRunInfo || !selectedTestType) return;

    const defaults = TEST_TYPE_DEFAULTS[selectedTestType];
    if (!defaults) return;

    form.setFieldsValue({
      environment: defaults.environment || form.getFieldValue('environment'),
      identifiedRisks: defaults.identifiedRisks,
      exitCriteria: defaults.exitCriteria,
    });
  }, [form, isEditingRunInfo, isModalOpen, selectedTestType]);

  const buildRuleBasedSuggestions = () => {
    return ruleBasedSuggestionPool.slice(0, 5).map(item => ({
      functionalityId: item.func.id,
      reason: item.reasons.slice(0, 2).join(' y '),
      source: 'rules' as const,
    }));
  };

  const handleSuggestWithAI = async () => {
    if (!canUseAi) {
      message.warning('Las sugerencias con IA están disponibles en el plan Growth.');
      return;
    }

    if (!selectedModules.length) {
      message.warning('Selecciona al menos un módulo antes de pedir sugerencias.');
      return;
    }

    if (ruleBasedSuggestionPool.length === 0) {
      setAiSuggestions([]);
      setAiSuggestionMode(null);
      message.info('No hay candidatas relevantes para sugerir en este momento.');
      return;
    }

    const fallbackSuggestions = buildRuleBasedSuggestions();
    const { hasAiProviderConfigured, recommendExecutionFunctionalitiesWithAI } =
      await import('../services/geminiService');

    if (!(await hasAiProviderConfigured())) {
      setAiSuggestions(fallbackSuggestions);
      setAiSuggestionMode('rules');
      message.warning(
        'No se encontró configuración de proveedor IA. Se muestran sugerencias automáticas basadas en reglas.',
      );
      return;
    }

    setIsSuggestingAi(true);
    try {
      const response =
        (await recommendExecutionFunctionalitiesWithAI({
          projectId: projectId || '',
          testType: selectedTestType || TestType.FUNCTIONAL,
          selectedModules,
          selectedFunctionalities: selectedFunctionalityModels.map(buildRecommendationCandidate),
          candidateFunctionalities: ruleBasedSuggestionPool.map(item =>
            buildRecommendationCandidate(item.func),
          ),
          maxSuggestions: 5,
        })) || [];

      const allowedIds = new Set(ruleBasedSuggestionPool.map(item => item.func.id));
      const nextSuggestions = response
        .filter(item => item?.functionalityId && item?.reason)
        .filter(item => allowedIds.has(item.functionalityId))
        .slice(0, 5)
        .map(item => ({
          functionalityId: item.functionalityId,
          reason: item.reason.trim(),
          source: 'ai' as const,
        }));

      if (nextSuggestions.length === 0) {
        setAiSuggestions(fallbackSuggestions);
        setAiSuggestionMode('rules');
        message.info(
          'La IA no encontro nuevas candidatas claras. Se muestran sugerencias automaticas.',
        );
        return;
      }

      setAiSuggestions(nextSuggestions);
      setAiSuggestionMode('ai');
      message.success('Sugerencias con IA listas');
    } catch (error) {
      console.error('AI suggestion error:', error);
      const msg = (error instanceof Error ? error.message : (error as any)?.message) || '';
      if (msg === 'AI_PROVIDER_MISSING' || msg === 'GEMINI_API_KEY_MISSING') {
        message.warning(
          'Configura GEMINI_API_KEY o GROQ_API_KEY en el backend para usar sugerencias con IA.',
        );
      } else if (msg === 'GEMINI_API_KEY_INVALID' || msg === 'GEMINI_API_KEY_LEAKED') {
        message.error(
          'La configuración actual del proveedor IA no es válida. Se usarán sugerencias automáticas.',
        );
      } else {
        message.warning('No fue posible consultar la IA. Se muestran sugerencias automaticas.');
      }

      setAiSuggestions(fallbackSuggestions);
      setAiSuggestionMode('rules');
    } finally {
      setIsSuggestingAi(false);
    }
  };

  const addSuggestedFunctionality = (functionalityId: string) => {
    setSelectedFuncIds(prev => Array.from(new Set([...prev, functionalityId])));
  };

  const resetTestRunModal = () => {
    setIsModalOpen(false);
    setIsEditingRunInfo(false);
    form.resetFields();
    setSelectedModules([]);
    setSelectedFuncIds([]);
  };

  const openTestRunDetail = (record: TestRun) => {
    setOpeningRunId(record.id);
    void getTestRunById(record.id)
      .then(fullRun => {
        setActiveTestRun(fullRun);
        setExecutionResults(fullRun.results);
      })
      .catch(error => {
        console.error('Error loading test run detail:', error);
        message.error('No se pudo abrir la ejecución seleccionada.');
      })
      .finally(() => {
        setOpeningRunId(current => (current === record.id ? null : current));
      });
  };

  const openPublicUatActivationModal = (record: TestRun) => {
    setSelectedPublicUatRun(record);
    publicUatForm.setFieldsValue({
      participantNameSnapshot: record.publicUatSession?.participant?.name || '',
      participantEmailSnapshot: record.publicUatSession?.participant?.email || '',
      deliveryNotes: '',
      expiresAt: record.publicUatSession?.expiresAt
        ? dayjs(record.publicUatSession.expiresAt)
        : dayjs().add(7, 'day'),
    });
    setIsPublicUatModalOpen(true);
  };

  const closePublicUatActivationModal = () => {
    setIsPublicUatModalOpen(false);
    setSelectedPublicUatRun(null);
    publicUatForm.resetFields();
  };

  const copyPublicUatLink = async (record: TestRun) => {
    try {
      const session = await getPublicUatSessionStatus(record.id);
      if (!session?.publicUrl) {
        message.warning('Esta ejecución UAT aún no tiene un enlace público disponible.');
        return;
      }

      await navigator.clipboard.writeText(session.publicUrl);
      message.success('Enlace público copiado al portapapeles.');
    } catch (error) {
      console.error('Error copying public UAT link:', error);
      message.error('No pudimos obtener el enlace público de esta ejecución UAT.');
    }
  };

  const handlePrimaryPublicUatAction = async (record: TestRun) => {
    const sessionStatus = record.publicUatSession?.status;

    if (sessionStatus === 'active' || sessionStatus === 'completed') {
      await copyPublicUatLink(record);
      return;
    }

    openPublicUatActivationModal(record);
  };

  const handleSubmitPublicUatActivation = async () => {
    if (!selectedPublicUatRun) return;

    try {
      const values = await publicUatForm.validateFields();
      const session = await activatePublicUatSession({
        testRunDocumentId: selectedPublicUatRun.id,
        input: {
          participantNameSnapshot: values.participantNameSnapshot || '',
          participantEmailSnapshot: values.participantEmailSnapshot || '',
          deliveryNotes: values.deliveryNotes || '',
          expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
        },
      });

      closePublicUatActivationModal();

      if (session?.publicUrl) {
        await navigator.clipboard.writeText(session.publicUrl);
        message.success('Sesión UAT pública activada y enlace copiado.');
      } else {
        message.success('Sesión UAT pública activada correctamente.');
      }
    } catch (error) {
      console.error('Error activating public UAT session:', error);
      message.error(
        error instanceof Error
          ? error.message
          : 'No fue posible activar la sesión pública para esta ejecución UAT.',
      );
    }
  };

  const openPublicUatStatusModal = async (record: TestRun) => {
    setPublicUatStatusModalRun(record);
    setIsLoadingPublicUatStatus(true);
    try {
      const session = await getPublicUatSessionStatus(record.id);
      setPublicUatStatusInfo(session);
    } catch (error) {
      console.error('Error loading public UAT status:', error);
      setPublicUatStatusInfo(null);
      message.error('No pudimos consultar el estado de la sesión pública.');
    } finally {
      setIsLoadingPublicUatStatus(false);
    }
  };

  const closePublicUatStatusModal = () => {
    setPublicUatStatusModalRun(null);
    setPublicUatStatusInfo(null);
  };

  const handleClosePublicUatSession = async (record: TestRun) => {
    try {
      await revokePublicUatSession(record.id);
      message.success('La sesión pública UAT fue cerrada correctamente.');
    } catch (error) {
      console.error('Error revoking public UAT session:', error);
      message.error(
        error instanceof Error
          ? error.message
          : 'No fue posible cerrar la sesión pública UAT.',
      );
    }
  };

  const openCreateTestRunModal = () => {
    setIsEditingRunInfo(false);
    form.resetFields();
    form.setFieldsValue({
      executionDate: dayjs(),
      testType: TestType.FUNCTIONAL,
      priority: Priority.MEDIUM,
      description: '',
      identifiedRisks: [],
      exitCriteria: [],
    });
    setSelectedModules([]);
    setSelectedFuncIds([]);
    setIsModalOpen(true);
  };

  const openEditTestRunModal = () => {
    if (!activeTestRun) return;

    setIsEditingRunInfo(true);
    form.setFieldsValue({
      title: activeTestRun.title,
      description: activeTestRun.description || '',
      executionDate: activeTestRun.executionDate ? dayjs(activeTestRun.executionDate) : dayjs(),
      testType: activeTestRun.testType,
      sprint: activeTestRun.sprint || undefined,
      priority: activeTestRun.priority,
      tester: activeTestRun.tester,
      environment: activeTestRun.environment,
      buildVersion: activeTestRun.buildVersion || '',
      browser: activeTestRun.browser,
      deviceType: activeTestRun.deviceType,
      operatingSystem: activeTestRun.operatingSystem,
      browserVersion: activeTestRun.browserVersion || '',
      osVersion: activeTestRun.osVersion || '',
      resolution: activeTestRun.resolution || '',
      identifiedRisks: [],
      exitCriteria: [],
    });
    setSelectedModules(activeTestRun.selectedModules || []);
    setSelectedFuncIds(activeTestRun.selectedFunctionalities || []);
    setIsModalOpen(true);
  };

  const handleCreateTestRun = async () => {
    try {
      const values = await form.validateFields();
      if (selectedFuncIds.length === 0) {
        message.error('Selecciona al menos una funcionalidad con casos de prueba registrados.');
        return;
      }

      const newRun: TestRun = {
        id: `TR-${Date.now()}`,
        projectId: projectId || '',
        title: values.title,
        description: values.description || '',
        executionDate: values.executionDate.format('YYYY-MM-DD'),
        status: ExecutionStatus.DRAFT,
        testType: values.testType,
        sprint: values.sprint,
        priority: values.priority,
        tester: values.tester,
        buildVersion: values.buildVersion,
        environment: values.environment,
        browser: values.browser,
        deviceType: values.deviceType,
        operatingSystem: values.operatingSystem,
        browserVersion: values.browserVersion,
        osVersion: values.osVersion,
        resolution: values.resolution,
        selectedModules,
        selectedFunctionalities: selectedFuncIds,
        results: [],
      };

      // Prepare initial results based on test cases
      const initialResults: TestRunResult[] = [];
      selectedFuncIds.forEach(fId => {
        const funcCases = testCases.filter(tc => tc.functionalityId === fId);
        funcCases.forEach(tc => {
          initialResults.push({
            id: `${newRun.id}-${tc.id}`,
            functionalityId: fId,
            testCaseId: tc.id,
            result: TestResult.NOT_EXECUTED,
          });
        });
      });

      const savedRun = await saveTestRun({
        ...newRun,
        results: initialResults,
      });

      setActiveTestRun(savedRun);
      setExecutionResults(savedRun.results);
      resetTestRunModal();

      message.success('Ejecución de pruebas creada. Iniciando fase de ejecución...');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleUpdateTestRunInfo = async () => {
    if (!activeTestRun) return;

    try {
      const values = await form.validateFields();
      const updatedRun: TestRun = {
        ...activeTestRun,
        title: values.title,
        description: values.description || '',
        executionDate: values.executionDate.format('YYYY-MM-DD'),
        testType: values.testType,
        sprint: values.sprint,
        priority: values.priority,
        tester: values.tester,
        buildVersion: values.buildVersion,
        environment: values.environment,
        browser: values.browser,
        deviceType: values.deviceType,
        operatingSystem: values.operatingSystem,
        browserVersion: values.browserVersion,
        osVersion: values.osVersion,
        resolution: values.resolution,
        selectedModules: activeTestRun.selectedModules,
        selectedFunctionalities: activeTestRun.selectedFunctionalities,
        results: executionResults,
      };

      const savedRun = await saveTestRun(updatedRun);
      setActiveTestRun(savedRun);
      setExecutionResults(savedRun.results);
      resetTestRunModal();
      message.success('Información de la ejecución actualizada');
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleSaveExecution = async (status: ExecutionStatus) => {
    if (!activeTestRun) return;

    if (status === ExecutionStatus.FINAL) {
      const incompleteFailedRecord = executionResults.find(
        result =>
          result.result === TestResult.FAILED &&
          (!result.notes?.trim() || !result.bugTitle?.trim() || !result.severity),
      );

      if (incompleteFailedRecord) {
        message.error(
          'No puedes finalizar la ejecución mientras exista una prueba fallida sin notas, título del bug o severidad.',
        );
        openEvidenceModal(incompleteFailedRecord);
        return;
      }
    }

    const updatedRun: TestRun = {
      ...activeTestRun,
      status,
      results: executionResults,
    };

    const savedRun = await saveTestRun(updatedRun);
    message.success(`Ejecución guardada como ${status}`);
    if (status === ExecutionStatus.FINAL) {
      setActiveTestRun(null);
      setExecutionResults([]);
      return;
    }
    setActiveTestRun(savedRun);
    setExecutionResults(savedRun.results);
  };

  const handleExecuteAll = () => {
    setExecutionResults(prev =>
      prev.map(r =>
        r.result === TestResult.NOT_EXECUTED ? { ...r, result: TestResult.PASSED } : r,
      ),
    );
    message.success('Todos los casos pendientes marcados como Aprobados');
  };

  const handleExportReport = async () => {
    if (!activeTestRun) return;

    try {
      const dataToExport = executionResults.map(r => {
        const tc = testCases.find(t => t.id === r.testCaseId);
        const func = functionalities.find(f => f.id === r.functionalityId);
        return {
          'ID Caso': tc?.id,
          Módulo: func?.module,
          Funcionalidad: func?.name,
          'Título Caso': tc?.title,
          Tester: activeTestRun.tester || '',
          'Build Version': activeTestRun.buildVersion || '',
          Environment: activeTestRun.environment || '',
          Resultado: r.result,
          'Bug ID': r.bugId || 'N/A',
          Severidad: r.severity || 'N/A',
          Notas: r.notes || '',
        };
      });

      if (!projectId) {
        message.warning('No se encontro el proyecto activo para exportar.');
        return;
      }

      await runTrackedExport({
        projectId,
        action: () =>
          exportTestRunToPdf({
            testRun: activeTestRun,
            results: executionResults,
            functionalities,
            testCases,
            publicUatSession: activeTestRun.publicUatSession,
          }),
      });
      message.success('PDF exportado correctamente');
    } catch (error) {
      const exportErrorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'Error al exportar el PDF';
      message.error(exportErrorMessage);
    }
  };

  const handleExportPdfForRun = async (record: TestRun) => {
    try {
      const fullRun = await getTestRunById(record.id);
      const projectIdForExport = fullRun.projectId || projectId;

      if (!projectIdForExport) {
        message.warning('No se encontro el proyecto activo para exportar.');
        return;
      }

      await runTrackedExport({
        projectId: projectIdForExport,
        action: () =>
          exportTestRunToPdf({
            testRun: fullRun,
            results: fullRun.results,
            functionalities,
            testCases,
            publicUatSession: fullRun.publicUatSession,
          }),
      });
      message.success('PDF exportado correctamente');
    } catch (error) {
      console.error('Error exporting run pdf:', error);
      message.error('No fue posible exportar el PDF de esta ejecución.');
    }
  };

  const updateResult = (tcId: string, field: keyof TestRunResult, value: any) => {
    setExecutionResults(prev =>
      prev.map(r => (r.testCaseId === tcId ? { ...r, [field]: value } : r)),
    );
  };

  const removeTestCase = (tcId: string) => {
    const nextResults = executionResults.filter(result => result.testCaseId !== tcId);
    setExecutionResults(nextResults);
    setActiveTestRun(prev => {
      if (!prev) {
        return prev;
      }

      const remainingFunctionalityIds = new Set(nextResults.map(result => result.functionalityId));

      return {
        ...prev,
        selectedFunctionalities: prev.selectedFunctionalities.filter(id =>
          remainingFunctionalityIds.has(id),
        ),
        results: nextResults,
      };
    });
    message.success('Caso de prueba descartado de esta ejecución.');
  };

  // Filters state
  const [tableFilters, setTableFilters] = useState<NativeExecutionTableFilterState>({
    status: null,
    sprint: null,
    testType: null,
    environment: null,
  });

  const nativeStatusFilters = useMemo(
    () =>
      Object.values(ExecutionStatus).map(status => ({
        text: labelExecutionStatus(status, t),
        value: status,
      })),
    [t],
  );

  const nativeSprintFilters = useMemo(
    () =>
      Array.from(new Set(testRuns.map(run => run.sprint).filter(Boolean)))
        .sort((left, right) => String(left).localeCompare(String(right)))
        .map(sprint => ({
          text: String(sprint),
          value: String(sprint),
        })),
    [testRuns],
  );

  const nativeTestTypeFilters = useMemo(
    () =>
      Array.from(new Set(testRuns.map(run => run.testType).filter(Boolean))).map(testType => ({
        text: String(testType),
        value: String(testType),
      })),
    [testRuns],
  );

  const nativeEnvironmentFilters = useMemo(
    () =>
      Array.from(new Set(testRuns.map(run => run.environment).filter(Boolean))).map(
        environment => ({
          text: labelEnvironment(environment as Environment, t),
          value: String(environment),
        }),
      ),
    [testRuns, t],
  );

  const hasActiveNativeTableFilters = useMemo(
    () => Object.values(tableFilters).some(value => Array.isArray(value) && value.length > 0),
    [tableFilters],
  );

  const clearNativeTableFilters = () => {
    setTableFilters({
      status: null,
      sprint: null,
      testType: null,
      environment: null,
    });
  };

  const testRunModalTitle = isEditingRunInfo
    ? 'Editar planificación de la ejecución'
    : 'Nueva Ejecución de Pruebas';
  const testRunModalPrimaryLabel = isEditingRunInfo
    ? 'Guardar información'
    : 'Crear Ejecución de Pruebas';

  const testRunPlanningFormContent = (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        executionDate: dayjs(),
        testType: TestType.FUNCTIONAL,
        priority: Priority.MEDIUM,
      }}
    >
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="mb-3">
          <span className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
            Flujo sugerido
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {executionPlanningSteps.sections.map((section, index) => {
            const isCurrent = executionPlanningSteps.currentIndex === index;
            const isComplete = section.complete;

            return (
              <div
                key={section.key}
                className={`rounded-xl border px-3 py-3 text-center transition-colors ${
                  isComplete
                    ? 'border-emerald-200 bg-emerald-50'
                    : isCurrent
                      ? 'border-sky-200 bg-sky-50'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div
                  className={`mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    isComplete
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {index + 1}
                </div>
                <div
                  className={`text-xs font-semibold ${
                    isComplete || isCurrent ? 'text-slate-800' : 'text-slate-500'
                  }`}
                >
                  {section.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-h-[68vh] space-y-4 overflow-y-auto pr-2">
        <PlanningSectionCard
          step="1"
          title="Información general"
          subtitle="Define el contexto principal de la ejecución antes de entrar al alcance."
        >
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Perfil recomendado
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedTestType ? (
                <Tag className="m-0 rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
                  {selectedTestType}
                </Tag>
              ) : null}
              {watchedPriority ? (
                <Tag className="m-0 rounded-full border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                  Prioridad: {labelPriority(watchedPriority, t)}
                </Tag>
              ) : null}
              {watchedEnvironment ? (
                <Tag className="m-0 rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  Ambiente: {labelEnvironment(watchedEnvironment, t)}
                </Tag>
              ) : null}
            </div>
            <div className="mt-3 text-sm text-slate-500">
              {currentTestTypeDefaults?.helperText ||
                'Selecciona el tipo de prueba para cargar una guía inicial de riesgos y criterios.'}
            </div>
          </div>

          <Row gutter={20}>
            <Col span={24}>
              <Form.Item name="title" label="Título de la ejecución" rules={[{ required: true }]}>
                <Input
                  placeholder="Ej: Regresión módulo de pagos - Sprint 25"
                  className="h-10 rounded-lg"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="testType" label="Tipo de prueba" rules={[{ required: true }]}>
                <Select className="h-10 rounded-lg" options={executionTestTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="executionDate"
                label="Fecha de ejecución"
                rules={[{ required: true }]}
              >
                <DatePicker className="h-10 w-full rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sprint" label="Sprint" rules={[{ required: true }]}>
                <Select
                  placeholder="Selecciona el sprint"
                  className="h-10 rounded-lg"
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
                <Select
                  options={Object.values(Priority).map(v => ({
                    label: labelPriority(v, t),
                    value: v,
                  }))}
                  className="h-10 rounded-lg"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tester" label="Tester" rules={[{ required: true }]}>
                <ParticipantSelect
                  members={participantDirectoryMembers}
                  valueField="fullName"
                  multiple={false}
                  placeholder="Selecciona el tester del workspace"
                  className="h-10 rounded-lg"
                  loading={isParticipantDirectoryLoading}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="environment" label="Environment" rules={[{ required: true }]}>
                <Select
                  placeholder="Selecciona el environment"
                  className="h-10 rounded-lg"
                  options={[
                    { label: Environment.TEST, value: Environment.TEST },
                    { label: Environment.LOCAL, value: Environment.LOCAL },
                    { label: Environment.PRODUCTION, value: Environment.PRODUCTION },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Descripción / objetivo">
                <Input.TextArea
                  rows={3}
                  placeholder="Describe qué quieres validar, por qué se ejecuta esta prueba y qué esperas confirmar."
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>
        </PlanningSectionCard>

        <PlanningSectionCard
          step="2"
          title="Alcance de la prueba"
          subtitle="Selecciona el alcance funcional antes de entrar en detalles del ambiente."
        >
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Módulos
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{selectedModules.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Funcionalidades
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{selectedFuncIds.length}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Casos incluidos
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{selectedTestCaseCount}</div>
            </div>
          </div>

          <Form.Item label="Módulos relacionados" required>
            <Select
              mode="multiple"
              placeholder="Selecciona uno o más módulos"
              className="w-full rounded-lg"
              onChange={setSelectedModules}
              value={selectedModules}
              options={moduleOptions}
              disabled={isEditingRunInfo}
            />
          </Form.Item>

          {isEditingRunInfo ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              En modo edición solo se actualiza la información general. Los módulos,
              funcionalidades y resultados actuales se conservan.
            </div>
          ) : selectedModules.length > 0 ? (
            <div className="mt-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Funcionalidades seleccionables
                </span>
                <Space>
                  <Tooltip title="Analiza el tipo de prueba, los módulos seleccionados y cambios recientes para sugerir funcionalidades relacionadas.">
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={isSuggestingAi}
                      disabled={!canUseAi}
                      onClick={() => void handleSuggestWithAI()}
                      className="rounded-full"
                    >
                      Sugerir con IA
                    </Button>
                  </Tooltip>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setSelectedFuncIds(availableFunctionalities.map(f => f.id))}
                    className="text-[11px] p-0"
                  >
                    Seleccionar todas
                  </Button>
                  <Divider type="vertical" />
                  <Button
                    size="small"
                    type="link"
                    danger
                    onClick={() => setSelectedFuncIds([])}
                    className="text-[11px] p-0"
                  >
                    Limpiar selección
                  </Button>
                </Space>
              </div>

              {!canUseAi ? (
                <PlanUpgradeCard
                  className="mb-4"
                  variant="inline-banner"
                  eyebrow="IA disponible en Growth"
                  title="Activa sugerencias automáticas para este flujo"
                  description="Desbloquea recomendaciones inteligentes para esta ejecución sin salir del proyecto."
                  ctaHref={aiUpgradeUrl}
                  ctaText="Probar IA"
                  onCtaClick={() => handleUpgradeClick('test-execution-ai-lock')}
                />
              ) : null}

              <UpgradeModal
                open={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                organizationName={activeMembership?.organization?.name}
                currentPlan={effectiveOrganizationPlan}
                title="Compara planes para priorizar mejor tus ejecuciones"
                description="Si quieres sumar sugerencias inteligentes, más capacidad y una operación más robusta, aquí puedes revisar el siguiente paso."
                onUpgradeGrowth={() => handleUpgradeClick('test-execution-upgrade-modal-growth')}
                onContactEnterprise={() => handleEnterpriseClick()}
              />

              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(groupedFunctionalities).map(([moduleName, funcs]) => {
                  const moduleFuncIds = funcs.map(f => f.id);
                  const selectedInModule = selectedFuncIds.filter(id => moduleFuncIds.includes(id));
                  const isAllSelected = selectedInModule.length === moduleFuncIds.length;

                  return (
                    <div
                      key={moduleName}
                      className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2">
                        <Space>
                          <Checkbox
                            indeterminate={
                              selectedInModule.length > 0 &&
                              selectedInModule.length < moduleFuncIds.length
                            }
                            checked={isAllSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedFuncIds(prev =>
                                  Array.from(new Set([...prev, ...moduleFuncIds])),
                                );
                              } else {
                                setSelectedFuncIds(prev =>
                                  prev.filter(id => !moduleFuncIds.includes(id)),
                                );
                              }
                            }}
                          />
                          <span className="text-sm font-bold text-slate-700">{moduleName}</span>
                          <Tag className="m-0 rounded-full border-none bg-slate-100 text-[10px] text-slate-500">
                            {selectedInModule.length} / {moduleFuncIds.length}
                          </Tag>
                        </Space>
                      </div>
                      <div className="p-4">
                        <Checkbox.Group
                          className="w-full"
                          value={selectedInModule}
                          onChange={vals => {
                            const nextModuleValues = vals as string[];
                            setSelectedFuncIds(prev => {
                              const withoutCurrentModule = prev.filter(
                                id => !moduleFuncIds.includes(id),
                              );
                              return [...withoutCurrentModule, ...nextModuleValues];
                            });
                          }}
                        >
                          <Row gutter={[12, 12]}>
                            {funcs.map(item => (
                              <Col span={12} key={item.id}>
                                <div
                                  className={`rounded-lg border p-2 transition-all ${
                                    selectedFuncIds.includes(item.id)
                                      ? 'border-blue-200 bg-blue-50'
                                      : 'border-slate-200 bg-white'
                                  }`}
                                >
                                  <Checkbox value={item.id} className="w-full">
                                    <div className="ml-1 flex flex-col">
                                      <span className="text-xs font-bold leading-tight text-slate-800">
                                        {item.id}
                                      </span>
                                      <span
                                        className="max-w-[200px] truncate text-[11px] text-slate-500"
                                        title={item.name}
                                      >
                                        {item.name}
                                      </span>
                                    </div>
                                  </Checkbox>
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </Checkbox.Group>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(groupedFunctionalities).length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No hay funcionalidades con casos de prueba registrados en los módulos seleccionados.
                  </div>
                )}
              </div>

              {(visibleAiSuggestions.length > 0 || aiSuggestionMode) && (
                <Card
                  className="mt-4 rounded-2xl border border-slate-200 shadow-none"
                  styles={{ body: { padding: 16 } }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ThunderboltOutlined className="text-cyan-600" />
                        <span className="font-semibold text-slate-800">Funcionalidades sugeridas</span>
                        <Tag
                          className="m-0 rounded-full border-none"
                          color={aiSuggestionMode === 'ai' ? 'blue' : 'gold'}
                        >
                          {aiSuggestionMode === 'ai' ? 'IA' : 'Reglas'}
                        </Tag>
                      </div>
                      <Text type="secondary" className="text-xs">
                        Recomendaciones complementarias para ampliar el alcance de esta ejecución.
                      </Text>
                    </div>
                    {visibleAiSuggestions.length > 0 && (
                      <Button
                        size="small"
                        type="link"
                        onClick={() =>
                          setSelectedFuncIds(prev =>
                            Array.from(
                              new Set([
                                ...prev,
                                ...visibleAiSuggestions.map(item => item.functionalityId),
                              ]),
                            ),
                          )
                        }
                      >
                        Agregar sugeridas
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {visibleAiSuggestions.map(suggestion => {
                      const functionality = functionalityById.get(suggestion.functionalityId);
                      if (!functionality) return null;

                      return (
                        <div
                          key={suggestion.functionalityId}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-800">
                                {functionality.id} - {functionality.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{suggestion.reason}</div>
                            </div>
                            <Button
                              size="small"
                              onClick={() =>
                                setSelectedFuncIds(prev =>
                                  prev.includes(suggestion.functionalityId)
                                    ? prev
                                    : [...prev, suggestion.functionalityId],
                                )
                              }
                            >
                              Agregar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              Selecciona al menos un módulo para definir el alcance funcional de esta ejecución.
            </div>
          )}
        </PlanningSectionCard>

        <PlanningSectionCard
          step="3"
          title="Ambiente de ejecución"
          subtitle="Documenta el contexto técnico para reproducibilidad y trazabilidad."
        >
          <Row gutter={20}>
            <Col span={24}>
              <Form.Item name="buildVersion" label="Build version">
                <Input placeholder="Ej: v1.2.3 (1234)" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="browser" label="Navegador">
                <Select
                  allowClear
                  placeholder="Selecciona navegador"
                  className="h-10 rounded-lg"
                  options={browserOptions}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="deviceType" label="Tipo de dispositivo">
                <Select
                  allowClear
                  placeholder="Selecciona dispositivo"
                  className="h-10 rounded-lg"
                  options={deviceTypeOptions}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="operatingSystem" label="Sistema operativo">
                <Select
                  allowClear
                  placeholder="Selecciona sistema operativo"
                  className="h-10 rounded-lg"
                  options={operatingSystemOptions}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="browserVersion" label="Versión del navegador">
                <Input placeholder="Ej: Chrome 122" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="osVersion" label="Versión del sistema operativo">
                <Input placeholder="Ej: iOS 17" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="resolution" label="Resolución de pantalla">
                <Input placeholder="Ej: 1920x1080" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>
        </PlanningSectionCard>

        <PlanningSectionCard
          step="4"
          title="Riesgos identificados"
          subtitle="Opcional por ahora. Ayuda a dejar explícito qué puede afectar esta ejecución."
        >
          <Form.Item name="identifiedRisks" label="Riesgos de esta ejecución">
            <Select
              mode="multiple"
              allowClear
              placeholder="Selecciona uno o más riesgos"
              className="w-full rounded-lg"
              options={EXECUTION_RISK_OPTIONS}
            />
          </Form.Item>
        </PlanningSectionCard>

        <PlanningSectionCard
          step="5"
          title="Criterios de salida"
          subtitle="Opcional por ahora. Define cuándo esta ejecución puede considerarse cerrada."
        >
          <Form.Item name="exitCriteria" label="Checklist de cierre">
            <Checkbox.Group className="grid grid-cols-1 gap-3 md:grid-cols-2" options={EXECUTION_EXIT_CRITERIA_OPTIONS} />
          </Form.Item>
        </PlanningSectionCard>
      </div>
    </Form>
  );

  const columns = [
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          TÍTULO
        </span>
      ),
      key: 'title',
      render: (_: any, record: TestRun) => (
        <div className="flex flex-col gap-1">
          <Text strong className="block text-slate-700">
            {record.title}
          </Text>
          {record.testType === TestType.UAT ? (
            <Tag
              color={publicUatStatusColor(record.publicUatSession?.status)}
              className="m-0 w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
            >
              {labelPublicUatSessionStatus(record.publicUatSession?.status)}
            </Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FECHA</span>
      ),
      dataIndex: 'executionDate',
      key: 'executionDate',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          TIPO DE TEST
        </span>
      ),
      dataIndex: 'testType',
      key: 'testType',
      filters: nativeTestTypeFilters,
      filteredValue: tableFilters.testType,
      onFilter: (value: boolean | React.Key, record: TestRun) => record.testType === String(value),
      render: (type: string) => (
        <Tag className="m-0 text-[10px] font-semibold uppercase bg-slate-100 border-slate-200 text-slate-600">
          {type}
        </Tag>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          SPRINT
        </span>
      ),
      dataIndex: 'sprint',
      key: 'sprint',
      filters: nativeSprintFilters,
      filteredValue: tableFilters.sprint,
      onFilter: (value: boolean | React.Key, record: TestRun) => record.sprint === String(value),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          TESTER
        </span>
      ),
      dataIndex: 'tester',
      key: 'tester',
      render: (tester: string | undefined) => tester || '—',
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          ENVIRONMENT
        </span>
      ),
      dataIndex: 'environment',
      key: 'environment',
      filters: nativeEnvironmentFilters,
      filteredValue: tableFilters.environment,
      onFilter: (value: boolean | React.Key, record: TestRun) =>
        record.environment === String(value),
      render: (env: Environment | undefined) =>
        env ? (
          <Tag className="m-0 text-[10px] font-semibold bg-slate-100 border-slate-200 text-slate-600">
            {env}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          ESTADO
        </span>
      ),
      dataIndex: 'status',
      key: 'status',
      filters: nativeStatusFilters,
      filteredValue: tableFilters.status,
      onFilter: (value: boolean | React.Key, record: TestRun) => record.status === String(value),
      render: (status: ExecutionStatus) => (
        <Tag
          color={status === ExecutionStatus.FINAL ? 'blue' : 'orange'}
          className="rounded-full px-3 font-bold uppercase text-[10px]"
        >
          {status}
        </Tag>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          PROGRESO
        </span>
      ),
      key: 'progress',
      render: (_: any, record: TestRun) => {
        const total = record.results.length;
        const executed = record.results.filter(r => r.result !== TestResult.NOT_EXECUTED).length;
        const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
        return (
          <div className="min-w-[110px]">
            <div className="flex justify-between text-[10px] mb-1">
              <span>
                {executed}/{total}
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          ACCIONES
        </span>
      ),
      key: 'actions',
      render: (_: any, record: TestRun) => (
        <Space size="small" className="flex-nowrap items-center">
          <Button
            icon={record.status === ExecutionStatus.DRAFT ? <EditOutlined /> : <EyeOutlined />}
            size="small"
            loading={openingRunId === record.id}
            onClick={() => openTestRunDetail(record)}
            className={record.status === ExecutionStatus.DRAFT ? 'text-amber-600' : 'text-blue-600'}
          >
            {record.status === ExecutionStatus.DRAFT ? 'Continuar' : 'Ver'}
          </Button>
          {record.testType === TestType.UAT ? (
            <Tooltip
              title={
                record.publicUatSession?.status === 'active' ||
                record.publicUatSession?.status === 'completed'
                  ? 'Copiar enlace público'
                  : 'Generar enlace público'
              }
            >
              <Button
                icon={
                  record.publicUatSession?.status === 'active' ||
                  record.publicUatSession?.status === 'completed' ? (
                    <CopyOutlined />
                  ) : (
                    <LinkOutlined />
                  )
                }
                size="small"
                onClick={() => void handlePrimaryPublicUatAction(record)}
              />
            </Tooltip>
          ) : null}
          {record.testType === TestType.UAT ? (
            <Tooltip title="Ver estado de sesión">
              <Button
                icon={<EyeOutlined />}
                size="small"
                disabled={
                  record.publicUatSession?.status !== 'active' &&
                  record.publicUatSession?.status !== 'completed'
                }
                onClick={() => void openPublicUatStatusModal(record)}
              />
            </Tooltip>
          ) : null}
          {record.testType === TestType.UAT && record.publicUatSession?.status === 'active' ? (
            <Tooltip title="Cerrar sesión pública">
              <Button
                icon={<StopOutlined />}
                size="small"
                danger
                loading={isRevokingPublicUatSession}
                onClick={() => void handleClosePublicUatSession(record)}
              />
            </Tooltip>
          ) : null}
          {record.testType === TestType.UAT ? (
            <Tooltip title="Descargar PDF">
              <Button
                icon={<ExportOutlined />}
                size="small"
                disabled={
                  record.publicUatSession?.status !== 'active' &&
                  record.publicUatSession?.status !== 'completed'
                }
                onClick={() => void handleExportPdfForRun(record)}
              />
            </Tooltip>
          ) : null}
          {canDeleteTestRuns && (
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => void deleteTestRun(record.id)}
            />
          )}
        </Space>
      ),
    },
  ];

  const handleNativeTableChange = (filters: Record<string, FilterValue | null>) => {
    setTableFilters({
      status: (filters.status as React.Key[] | null) || null,
      sprint: (filters.sprint as React.Key[] | null) || null,
      testType: (filters.testType as React.Key[] | null) || null,
      environment: (filters.environment as React.Key[] | null) || null,
    });
  };

  if (activeTestRun) {
    const hasActivePublicUatSession = activeTestRun.publicUatSession?.status === 'active';
    const isReadOnly =
      activeTestRun.status === ExecutionStatus.FINAL || isViewer || hasActivePublicUatSession;

    const filteredExecutionResults = executionResults.filter(r => {
      const tc = testCases.find(t => t.id === r.testCaseId);
      const func = functionalities.find(f => f.id === r.functionalityId);

      const searchLower = executionSearchText.toLowerCase();
      const matchesSearch =
        !executionSearchText ||
        tc?.id.toLowerCase().includes(searchLower) ||
        tc?.title.toLowerCase().includes(searchLower) ||
        func?.module.toLowerCase().includes(searchLower) ||
        func?.name.toLowerCase().includes(searchLower);

      const matchesFailed = !filterOnlyFailed || r.result === TestResult.FAILED;

      return matchesSearch && matchesFailed;
    });

    return (
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <Space size="middle">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setActiveTestRun(null)}
              className="rounded-lg"
            >
              Volver
            </Button>
            <div>
              <div className="flex items-center gap-2">
                {isReadOnly && (
                  <Tag
                    color={hasActivePublicUatSession ? 'processing' : 'success'}
                    className="m-0 font-bold uppercase text-[10px] px-2 py-0.5 rounded-sm"
                  >
                    {hasActivePublicUatSession ? 'UAT PÚBLICA ACTIVA' : 'FINALIZADA'}
                  </Tag>
                )}
                <Title level={3} className="m-0 text-slate-800">
                  {activeTestRun.title}
                </Title>
              </div>
              <Text type="secondary" className="text-xs text-slate-400">
                {formatCompactId(activeTestRun.id)} • {activeTestRun.sprint || 'Sin Sprint'} •{' '}
                {activeTestRun.tester || 'Sin Tester'}
                {activeTestRun.environment ? ` • ${activeTestRun.environment}` : ''}
                {activeTestRun.buildVersion ? ` • Build ${activeTestRun.buildVersion}` : ''}
              </Text>
              {(activeTestRun.browser ||
                activeTestRun.deviceType ||
                activeTestRun.operatingSystem) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeTestRun.browser && (
                    <Tag className="m-0 rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      <span className="font-semibold text-slate-500">Navegador:</span>{' '}
                      {activeTestRun.browser}
                    </Tag>
                  )}
                  {activeTestRun.deviceType && (
                    <Tag className="m-0 rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      <span className="font-semibold text-slate-500">Dispositivo:</span>{' '}
                      {activeTestRun.deviceType}
                    </Tag>
                  )}
                  {activeTestRun.operatingSystem && (
                    <Tag className="m-0 rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      <span className="font-semibold text-slate-500">Sistema operativo:</span>{' '}
                      {activeTestRun.operatingSystem}
                    </Tag>
                  )}
                </div>
              )}
            </div>
          </Space>
          <Space>
            {!isReadOnly && !isViewer && (
              <Button icon={<EditOutlined />} className="rounded-lg" onClick={openEditTestRunModal}>
                Editar Info
              </Button>
            )}
            <Button icon={<ExportOutlined />} onClick={handleExportReport} className="rounded-lg">
              Descargar PDF
            </Button>
            {!isReadOnly && !isViewer && (
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleExecuteAll}
                className="rounded-lg bg-blue-600"
              >
                Execute All
              </Button>
            )}
          </Space>
        </div>

        {/* Metrics Row */}
        <Row gutter={20}>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2">
              <div className="flex items-center justify-center gap-3 mb-1">
                <BarChartOutlined className="text-slate-400 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  Total Tests
                </Text>
              </div>
              <div className="text-2xl font-black text-slate-800">{executionResults.length}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2 bg-emerald-50/30">
              <div className="flex items-center justify-center gap-3 mb-1">
                <CheckCircleOutlined className="text-emerald-500 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  Approved
                </Text>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-slate-800">
                  {executionResults.filter(r => r.result === TestResult.PASSED).length}
                </span>
                <Text type="secondary" className="text-xs font-bold text-emerald-600">
                  (
                  {executionResults.length > 0
                    ? Math.round(
                        (executionResults.filter(r => r.result === TestResult.PASSED).length /
                          executionResults.length) *
                          100,
                      )
                    : 0}
                  %)
                </Text>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2 bg-rose-50/30">
              <div className="flex items-center justify-center gap-3 mb-1">
                <CloseCircleOutlined className="text-rose-500 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  Failed
                </Text>
              </div>
              <div className="text-2xl font-black text-rose-600">
                {executionResults.filter(r => r.result === TestResult.FAILED).length}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2 bg-amber-50/30">
              <div className="flex items-center justify-center gap-3 mb-1">
                <ClockCircleOutlined className="text-amber-500 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  Pending
                </Text>
              </div>
              <div className="text-2xl font-black text-amber-600">
                {executionResults.filter(r => r.result === TestResult.NOT_EXECUTED).length}
              </div>
            </Card>
          </Col>
        </Row>

        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
            <Input
              placeholder="Search by Module or Functionality..."
              prefix={<SearchOutlined className="text-slate-400" />}
              className="w-80 rounded-lg h-10 border-slate-200"
              value={executionSearchText}
              onChange={e => setExecutionSearchText(e.target.value)}
            />
            <Space>
              <Button
                type={!filterOnlyFailed ? 'primary' : 'default'}
                className="rounded-lg px-6"
                onClick={() => setFilterOnlyFailed(false)}
              >
                All
              </Button>
              <Button
                type={filterOnlyFailed ? 'primary' : 'default'}
                className="rounded-lg px-6"
                onClick={() => setFilterOnlyFailed(true)}
              >
                Failed Only
              </Button>
            </Space>
          </div>
          <Table
            dataSource={filteredExecutionResults}
            rowKey="testCaseId"
            pagination={false}
            className="execution-detail-table"
            columns={[
              {
                title: (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    MODULO
                  </span>
                ),
                key: 'module',
                width: '14%',
                render: (_, record) => {
                  const func = functionalityById.get(record.functionalityId);
                  return (
                    <Text strong className="text-slate-800">
                      {func?.module}
                    </Text>
                  );
                },
              },
              {
                title: (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    FUNCIONALIDAD / CASO
                  </span>
                ),
                key: 'case',
                width: '30%',
                render: (_, record) => {
                  const tc = testCaseById.get(record.testCaseId);
                  const func = functionalityById.get(record.functionalityId);
                  return (
                    <div className="flex flex-col">
                      <Text className="text-slate-800 text-sm">{tc?.title}</Text>
                      <Text type="secondary" className="text-[11px] opacity-60">
                        {func?.name}
                      </Text>
                    </div>
                  );
                },
              },
              {
                title: (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    EJECUTADO
                  </span>
                ),
                key: 'executed',
                width: '10%',
                align: 'center',
                render: (_, record) => {
                  const executed = record.result !== TestResult.NOT_EXECUTED;

                  return (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        !isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'
                      } transition-colors ${
                        executed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'
                      }`}
                      onClick={
                        !isReadOnly
                          ? () => {
                              updateResult(
                                record.testCaseId,
                                'result',
                                executed ? TestResult.NOT_EXECUTED : TestResult.PASSED,
                              );
                            }
                          : undefined
                      }
                    >
                      {executed ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                    </div>
                  );
                },
              },
              {
                title: (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    FECHA
                  </span>
                ),
                key: 'date',
                width: '12%',
                render: () => (
                  <div className="flex flex-col text-[11px] text-slate-500 leading-tight">
                    <span>{dayjs().format('DD MMM,')}</span>
                    <span>{dayjs().format('YYYY')}</span>
                  </div>
                ),
              },
              {
                title: (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    RESULTADO
                  </span>
                ),
                key: 'result',
                width: '18%',
                render: (_, record) => (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      className={`w-full custom-result-select-v2 ${record.result.toLowerCase().replace(' ', '_')}`}
                      value={record.result}
                      disabled={isReadOnly}
                      variant="borderless"
                      onChange={val => updateResult(record.testCaseId, 'result', val)}
                      suffixIcon={<ArrowDownOutlined className="text-[10px] opacity-40" />}
                      options={Object.values(TestResult).map(r => ({
                        label: (
                          <Space size={6}>
                            <div
                              className={`w-2 h-2 rounded-full ${
                                r === TestResult.PASSED
                                  ? 'bg-emerald-500'
                                  : r === TestResult.FAILED
                                    ? 'bg-rose-500'
                                    : r === TestResult.BLOCKED
                                      ? 'bg-amber-500'
                                      : 'bg-slate-300'
                              }`}
                            />
                            <span className="text-xs">{labelTestResult(r, t)}</span>
                          </Space>
                        ),
                        value: r,
                      }))}
                    />
                    {record.bugId && (
                      <div className="flex flex-wrap gap-1">
                        <Tag className="m-0 flex items-center gap-1.5 bg-rose-50 border-rose-100 text-rose-600 px-2 py-0.5 rounded-md w-fit">
                          <BugOutlined className="text-[10px]" />
                          {record.bugLink ? (
                            <a
                              href={record.bugLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-rose-600 hover:underline truncate max-w-[120px]"
                            >
                              {record.bugId}
                            </a>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-600 truncate max-w-[120px]">
                              {record.bugId}
                            </span>
                          )}
                        </Tag>
                        {record.severity && (
                          <Tag className="m-0 text-[9px] font-black uppercase bg-slate-800 text-white border-none px-1.5 rounded-sm">
                            {record.severity}
                          </Tag>
                        )}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    EVIDENCIA
                  </span>
                ),
                key: 'evidence',
                width: '11%',
                align: 'center',
                render: (_, record) => (
                  <Button
                    type="link"
                    className="text-blue-600 text-xs flex items-center gap-1 p-0 h-auto"
                    onClick={() => openEvidenceModal(record)}
                  >
                    {record.evidenceImage || record.notes ? (
                      <>
                        <EyeOutlined /> View
                      </>
                    ) : (
                      <>
                        <PlusOutlined /> Note
                      </>
                    )}
                  </Button>
                ),
              },
              ...(!isReadOnly
                ? [
                    {
                      title: (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          ACCIONES
                        </span>
                      ),
                      key: 'actions',
                      width: '8%',
                      align: 'center' as const,
                      render: (_: unknown, record: TestRunResult) => (
                        <Popconfirm
                          title="Descartar caso de prueba"
                          description="Este caso se quitará de esta ejecución."
                          okText="Descartar"
                          cancelText="Cancelar"
                          onConfirm={() => removeTestCase(record.testCaseId)}
                        >
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            className="text-rose-500"
                          />
                        </Popconfirm>
                      ),
                    },
                  ]
                : []),
            ]}
            expandable={{
              rowExpandable: record => Boolean(testCaseById.get(record.testCaseId)),
              expandIcon: ({ expanded, onExpand, record }) => (
                <button
                  type="button"
                  aria-label={expanded ? 'Ocultar detalle del caso' : 'Ver detalle del caso'}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-sky-300 hover:text-sky-600"
                  onClick={event => onExpand(record, event)}
                >
                  {expanded ? (
                    <MinusOutlined className="text-[10px]" />
                  ) : (
                    <PlusOutlined className="text-[10px]" />
                  )}
                </button>
              ),
              expandedRowRender: record => {
                const testCase = testCaseById.get(record.testCaseId);

                if (!testCase) return null;

                return (
                  <div className="rounded-xl bg-slate-50 p-5">
                    <div className="mb-4">
                      <Text strong>Descripción:</Text>
                      {renderRichTextContent(testCase.description)}
                    </div>
                    <div className="mb-4">
                      <Text strong>Precondiciones:</Text>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {testCase.preconditions || '—'}
                      </p>
                    </div>
                    <div className="mb-4">
                      <Text strong>Pasos de Prueba:</Text>
                      {renderRichTextContent(testCase.testSteps)}
                    </div>
                    <div>
                      <Text strong>Resultado Esperado:</Text>
                      {renderRichTextContent(testCase.expectedResult)}
                    </div>
                  </div>
                );
              },
            }}
          />
        </Card>
        {!isReadOnly && !isViewer && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <Button
              icon={<SaveOutlined />}
              onClick={() => void handleSaveExecution(ExecutionStatus.DRAFT)}
              className="rounded-lg h-10 px-6"
            >
              Guardar Borrador
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => void handleSaveExecution(ExecutionStatus.FINAL)}
              className="rounded-lg h-10 px-8 bg-blue-600"
            >
              Finalizar Ejecución
            </Button>
          </div>
        )}

        <Modal
          title={<span className="text-xl font-bold text-slate-800">{testRunModalTitle}</span>}
          open={isModalOpen}
          onCancel={resetTestRunModal}
          width={920}
          centered
          footer={[
            <Button key="cancel" onClick={resetTestRunModal}>
              Cancelar
            </Button>,
            ...(!isViewer
              ? [
                  <Button
                    key="create"
                    type="primary"
                    onClick={isEditingRunInfo ? handleUpdateTestRunInfo : handleCreateTestRun}
                  >
                    {testRunModalPrimaryLabel}
                  </Button>,
                ]
              : []),
          ]}
        >
          {testRunPlanningFormContent}
        </Modal>

        {/* Evidence Modal */}
        <Modal
          title={<span className="text-lg font-bold text-slate-800">Evidencia de Ejecución</span>}
          open={isEvidenceModalOpen}
          onCancel={restoreEvidenceChanges}
          width={520}
          centered
          footer={[
            <Button key="close" onClick={restoreEvidenceChanges} className="rounded-lg">
              Cancelar
            </Button>,
            !isReadOnly && (
              <Button
                key="save"
                type="primary"
                onClick={handleSaveEvidence}
                className="rounded-lg bg-blue-600"
              >
                Guardar Evidencia
              </Button>
            ),
          ]}
        >
          {currentEvidenceRecord && (
            <div key={currentEvidenceRecord.testCaseId} className="space-y-5 py-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Text
                  type="secondary"
                  className="text-[10px] font-bold uppercase tracking-widest block mb-1"
                >
                  Funcionalidad
                </Text>
                <Text strong className="text-slate-800">
                  {activeEvidenceTestCase?.id} - {activeEvidenceTestCase?.title}
                </Text>
              </div>

              <Form form={evidenceForm} layout="vertical">
                <Form.Item
                  name="evidence"
                  required={isFailureEvidenceRequired}
                  label={<span className="font-semibold text-slate-600">Notas de Ejecución</span>}
                  rules={
                    isFailureEvidenceRequired
                      ? [{ required: true, message: 'Las notas de ejecución son obligatorias.' }]
                      : undefined
                  }
                >
                  <EvidenceRichEditorField
                    placeholder="Escribe aquí las notas de la ejecución. Puedes usar emojis, pegar una captura o subir una imagen."
                    disabled={isReadOnly}
                  />
                </Form.Item>
                {isFailureEvidenceRequired && (
                  <>
                    <Divider titlePlacement="left" className="!m-0 !mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Reporte de Bug
                      </span>
                    </Divider>

                    <Form.Item
                      name="bugTitle"
                      required
                      label={<span className="font-semibold text-slate-600">Título del Bug</span>}
                      rules={[{ required: true, message: 'El título del bug es obligatorio.' }]}
                    >
                      <Input
                        placeholder="Resume el error detectado"
                        disabled={isReadOnly}
                        className="rounded-lg border-slate-200"
                      />
                    </Form.Item>

                    <Form.Item
                      name="severity"
                      required
                      label={<span className="font-semibold text-slate-600">Severidad</span>}
                      rules={[{ required: true, message: 'La severidad es obligatoria.' }]}
                    >
                      <Select
                        className="w-full rounded-lg"
                        placeholder="Seleccionar"
                        disabled={isReadOnly}
                        options={Object.values(Severity).map(s => ({ label: s, value: s }))}
                      />
                    </Form.Item>

                    <Form.Item
                      name="bugLink"
                      label={<span className="font-semibold text-slate-600">Link al Bug</span>}
                    >
                      <Input
                        placeholder="https://jira.atlassian.net/browse/..."
                        disabled={isReadOnly}
                        className="rounded-lg border-slate-200"
                      />
                    </Form.Item>

                    <Text type="secondary" className="text-[11px] block -mt-2">
                      Al registrar un bug desde una prueba fallida, se creará o actualizará
                      automáticamente en el Historial de Bugs con estado inicial Pendiente.
                    </Text>
                  </>
                )}
              </Form>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PlanBillingBanner
        organizationName={activeMembership?.organization?.name}
        contractedPlan={activeOrganizationPlan}
        effectivePlan={effectiveOrganizationPlan}
        billing={activeBillingState}
        upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
        onRenewClick={() => handleUpgradeClick('test-execution-billing-banner')}
      />

      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">
            Ejecución de Pruebas
          </Title>
          <Text type="secondary" className="text-slate-500">
            Registra y monitorea los resultados de las ejecuciones de pruebas manuales y
            automatizadas.
          </Text>
        </div>
        {!isViewer ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateTestRunModal}
            className="rounded-lg h-10 px-6"
          >
            Crear Ejecución de Pruebas
          </Button>
        ) : null}
      </div>

      <Card className="mb-6 rounded-2xl border-sky-100 bg-sky-50/70 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
            <InfoCircleOutlined className="text-lg" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">
              Las ejecuciones se construyen a partir de los casos de prueba registrados en las
              funcionalidades.
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Antes de crear una ejecución, asegúrate de que la funcionalidad tenga casos
              asociados. QA Tracker usa esos casos para definir el alcance inicial de la sesión.
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        defaultActiveKey="executions"
        items={[
          {
            key: 'executions',
            label: 'Historial de Ejecuciones',
            children: (
              <div className="space-y-6">
                <Card
                  className="rounded-2xl shadow-sm border-slate-100"
                  title={
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-800 font-bold">Historial de Ejecuciones</span>
                      <span className="text-xs text-slate-400">
                        Usa los filtros nativos de la tabla en estado, sprint, tipo de test y
                        environment.
                      </span>
                    </div>
                  }
                  extra={
                    <Button
                      onClick={clearNativeTableFilters}
                      disabled={!hasActiveNativeTableFilters}
                      className="rounded-lg h-9 px-4 text-slate-500"
                    >
                      Limpiar filtros tabla
                    </Button>
                  }
                >
                  <Table
                    columns={columns}
                    dataSource={testRuns}
                    rowKey="id"
                    className="executive-table"
                    tableLayout="auto"
                    onChange={(_, filters) => handleNativeTableChange(filters)}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'coverage',
            label: 'Cobertura de Casos',
            children: <CoverageMatrix projectId={projectId} embedded />,
          },
          {
            key: 'bugs',
            label: 'Historial de Bugs',
            children: <BugHistoryView projectId={projectId} />,
          },
        ]}
      />

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Generar enlace público UAT</span>}
        open={isPublicUatModalOpen}
        onCancel={closePublicUatActivationModal}
        confirmLoading={isActivatingPublicUatSession}
        onOk={() => void handleSubmitPublicUatActivation()}
        okText="Activar y copiar enlace"
        cancelText="Cancelar"
      >
        <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-600">
          <p className="m-0 font-semibold text-slate-800">
            {selectedPublicUatRun?.title || 'Ejecución UAT'}
          </p>
          <p className="m-0 mt-1">
            Al activar esta sesión, la ejecución se compartirá mediante un enlace público y la edición interna de resultados quedará bloqueada mientras la sesión esté activa.
          </p>
        </div>

        <Form form={publicUatForm} layout="vertical">
          <Form.Item
            name="participantNameSnapshot"
            label="Nombre del participante"
            rules={[{ required: true, message: 'Ingresa el nombre del participante.' }]}
          >
            <Input placeholder="Ej: María Gómez" className="rounded-lg" />
          </Form.Item>
          <Form.Item
            name="participantEmailSnapshot"
            label="Correo del participante"
            rules={[
              { required: true, message: 'Ingresa el correo del participante.' },
              { type: 'email', message: 'Ingresa un correo válido.' },
            ]}
          >
            <Input placeholder="cliente@empresa.com" className="rounded-lg" />
          </Form.Item>
          <Form.Item name="expiresAt" label="Fecha de expiración">
            <DatePicker className="w-full rounded-lg" />
          </Form.Item>
          <Form.Item name="deliveryNotes" label="Indicaciones para el cliente">
            <Input.TextArea
              rows={4}
              placeholder="Comparte aquí el contexto o las instrucciones de esta validación UAT."
              className="rounded-lg"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Estado de sesión pública UAT</span>}
        open={Boolean(publicUatStatusModalRun)}
        onCancel={closePublicUatStatusModal}
        footer={[
          <Button key="close" onClick={closePublicUatStatusModal}>
            Cerrar
          </Button>,
          publicUatStatusInfo?.publicUrl ? (
            <Button
              key="copy"
              type="primary"
              icon={<CopyOutlined />}
              onClick={() => {
                void navigator.clipboard.writeText(publicUatStatusInfo.publicUrl || '').then(() => {
                  message.success('Enlace público copiado.');
                });
              }}
            >
              Copiar enlace
            </Button>
          ) : null,
        ]}
      >
        {isLoadingPublicUatStatus ? (
          <div className="flex items-center justify-center py-10">
            <Spin />
          </div>
        ) : publicUatStatusInfo ? (
          <div className="space-y-4 text-sm text-slate-600">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <Tag
                color={publicUatStatusColor(publicUatStatusInfo.status)}
                className="rounded-full px-3 py-1"
              >
                {labelPublicUatSessionStatus(publicUatStatusInfo.status)}
              </Tag>
              <div className="mt-3 space-y-1">
                <div>
                  <span className="font-semibold text-slate-800">Ejecución:</span>{' '}
                  {publicUatStatusModalRun?.title}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Participante:</span>{' '}
                  {publicUatStatusInfo.participant?.name || 'No definido'}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Correo:</span>{' '}
                  {publicUatStatusInfo.participant?.email || 'No definido'}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Activada:</span>{' '}
                  {formatPublicSessionDate(publicUatStatusInfo.activatedAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Expira:</span>{' '}
                  {formatPublicSessionDate(publicUatStatusInfo.expiresAt)}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Último acceso:</span>{' '}
                  {formatPublicSessionDate(publicUatStatusInfo.lastAccessedAt, 'Sin accesos aún')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-sm text-slate-500">
            Esta ejecución aún no tiene una sesión pública asociada.
          </div>
        )}
      </Modal>

      <Modal
        title={<span className="text-xl font-bold text-slate-800">{testRunModalTitle}</span>}
        open={isModalOpen}
        onCancel={resetTestRunModal}
        width={920}
        centered
        footer={[
          <Button key="cancel" onClick={resetTestRunModal}>
            Cancelar
          </Button>,
          ...(!isViewer
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={isEditingRunInfo ? handleUpdateTestRunInfo : handleCreateTestRun}
                >
                  {testRunModalPrimaryLabel}
                </Button>,
              ]
            : []),
        ]}
      >
        {testRunPlanningFormContent}
      </Modal>
    </div>
  );
}
