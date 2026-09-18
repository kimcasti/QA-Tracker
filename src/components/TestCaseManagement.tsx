import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Card,
  Typography,
  message,
  Tooltip,
  Alert,
  List,
  Tabs,
  Dropdown,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  CloseOutlined,
  ArrowUpOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowDownOutlined,
  MenuOutlined,
  DownOutlined,
  RightOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  MoreOutlined,
  HolderOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import {
  AutomationResultStatus,
  AutomationStatus,
  AutomationTool,
  AutomationType,
  ACTIVE_AUTOMATION_TOOLS,
  Priority,
  TestCase,
  TestType,
  deriveAutomationStatus,
  isAutomatedCoverageStatus,
} from '../types';
import { useTranslation } from 'react-i18next';
import { toApiError } from '../config/http';
import { labelPriority } from '../i18n/labels';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { BulkPasteCasesModal } from '../modules/test-cases/components/BulkPasteCasesModal';
import { useTestCaseTemplates } from '../modules/test-case-templates/hooks/useTestCaseTemplates';
import { PlanBillingBanner } from '../modules/plans/components/PlanBillingBanner';
import { startUpgradeRequestFlow } from '../modules/plans/services/billingService';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { hasMeaningfulEvidenceContent, normalizeEvidenceHtml } from '../utils/evidenceRichText';
import { PlanUpgradeCard } from '../modules/plans/components/PlanUpgradeCard';
import { UpgradeModal } from '../modules/plans/components/UpgradeModal';
import {
  buildProjectUpgradeWhatsAppUrl,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';

const { Text } = Typography;
const EvidenceRichEditor = lazy(() => import('./EvidenceRichEditor'));
const automationStatusOptions = Object.values(AutomationStatus);
const automationTypeOptions = Object.values(AutomationType);
const automationToolOptions = [...ACTIVE_AUTOMATION_TOOLS];
const automationResultStatusOptions = Object.values(AutomationResultStatus);
const automationStatusGuidance: Record<AutomationStatus, string> = {
  [AutomationStatus.NOT_AUTOMATED]:
    'Este caso se ejecutará manualmente. No necesitas completar datos de automatización.',
  [AutomationStatus.CANDIDATE]:
    'Este caso puede automatizarse. Define el tipo y, si ya se conoce, la persona responsable.',
  [AutomationStatus.AUTOMATED]:
    'Registra la herramienta y la referencia para vincular este caso con su script automatizado.',
  [AutomationStatus.OBSOLETE]:
    'La automatización ya no está vigente. Sus datos se muestran como referencia histórica.',
};
const automationFilterOptions = [
  { label: 'Todos', value: 'all' },
  { label: 'Automatizadas', value: 'automated' },
  { label: 'Candidatas', value: 'candidate' },
  { label: 'Obsoletas', value: 'obsolete' },
  { label: 'Manuales', value: 'manual' },
] as const;

function getAutomationStatusColor(status?: AutomationStatus) {
  switch (status) {
    case AutomationStatus.AUTOMATED:
      return 'green';
    case AutomationStatus.CANDIDATE:
      return 'gold';
    case AutomationStatus.OBSOLETE:
      return 'red';
    case AutomationStatus.NOT_AUTOMATED:
    default:
      return 'default';
  }
}

function getAutomationResultColor(status?: AutomationResultStatus) {
  switch (status) {
    case AutomationResultStatus.PASSED:
      return 'green';
    case AutomationResultStatus.FAILED:
      return 'red';
    case AutomationResultStatus.SKIPPED:
      return 'gold';
    case AutomationResultStatus.UNKNOWN:
    default:
      return 'default';
  }
}

function getAutomationTypeLabel(type: AutomationType) {
  switch (type) {
    case AutomationType.INTEGRATION:
      return 'Integración';
    case AutomationType.PERFORMANCE:
      return 'Rendimiento';
    default:
      return type;
  }
}

function formatAutomationRunAt(value?: string) {
  if (!value) return 'Sin ejecucion registrada';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function TestCaseRichTextEditorField(props: React.ComponentProps<typeof EvidenceRichEditor>) {
  return (
    <Suspense fallback={<div className="py-3 text-sm text-slate-400">Cargando editor...</div>}>
      <EvidenceRichEditor {...props} showMarkers={false} showImageUpload={false} />
    </Suspense>
  );
}

function InformativeLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined
          aria-label={`Información sobre ${label}`}
          className="cursor-help text-slate-400 hover:text-blue-600"
          tabIndex={0}
        />
      </Tooltip>
    </span>
  );
}

function renderRichTextContent(value?: string) {
  const normalizedHtml = normalizeEvidenceHtml(value);

  if (!hasMeaningfulEvidenceContent(normalizedHtml)) {
    return <p className="mt-1 text-slate-500">-</p>;
  }

  return (
    <div
      className="qa-rich-text-content mt-1 text-sm text-slate-700"
      dangerouslySetInnerHTML={{ __html: normalizedHtml }}
    />
  );
}

function buildDuplicatedTestCaseTitle(title: string, existingTitles: string[]) {
  const normalizedExistingTitles = new Set(existingTitles.map(item => item.trim().toLowerCase()));
  const baseCopyTitle = `${title} (copia)`;

  if (!normalizedExistingTitles.has(baseCopyTitle.trim().toLowerCase())) {
    return baseCopyTitle;
  }

  let copyIndex = 2;
  while (normalizedExistingTitles.has(`${title} (copia ${copyIndex})`.trim().toLowerCase())) {
    copyIndex += 1;
  }

  return `${title} (copia ${copyIndex})`;
}

function getStableSortOrder(testCase: Pick<TestCase, 'sortOrder'>, fallback = 0) {
  return typeof testCase.sortOrder === 'number' && Number.isFinite(testCase.sortOrder)
    ? testCase.sortOrder
    : fallback;
}

function normalizeTestCaseOrder(testCases: TestCase[]) {
  return testCases.map((testCase, index) => ({
    ...testCase,
    sortOrder: index,
  }));
}

function moveTestCase(testCases: TestCase[], fromIndex: number, toIndex: number) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= testCases.length ||
    toIndex >= testCases.length ||
    fromIndex === toIndex
  ) {
    return testCases;
  }

  const reordered = [...testCases];
  const [movedTestCase] = reordered.splice(fromIndex, 1);

  if (!movedTestCase) {
    return testCases;
  }

  reordered.splice(toIndex, 0, movedTestCase);
  return normalizeTestCaseOrder(reordered);
}

interface TestCaseManagementProps {
  projectId: string;
  functionalityId: string;
  functionalityName: string;
  moduleName: string;
  onClose?: () => void;
  functionalityNavigation?: {
    position: number;
    total: number;
    previousName?: string;
    nextName?: string;
    onPrevious?: () => void;
    onNext?: () => void;
  };
}

const TestCaseManagement: React.FC<TestCaseManagementProps> = ({
  projectId,
  functionalityId,
  functionalityName,
  moduleName,
  onClose,
  functionalityNavigation,
}) => {
  const { t } = useTranslation();
  const {
    data: testCases,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    save,
    reorder,
    saveManyWithSingleRefresh,
    savePastedCases,
    delete: deleteTestCase,
  } = useTestCases(projectId, functionalityId);
  const { data: templates = [] } = useTestCaseTemplates(projectId, moduleName);
  const { isViewer, activeMembership, projectQuota } = useWorkspaceAccess();
  const [isCaseFormVisible, setIsCaseFormVisible] = useState(false);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiGenerationError, setAiGenerationError] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderDraft, setReorderDraft] = useState<TestCase[]>([]);
  const [draggedReorderTestCaseId, setDraggedReorderTestCaseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [generatedForFunctionalityId, setGeneratedForFunctionalityId] = useState<string | null>(
    null,
  );
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [automationFilter, setAutomationFilter] =
    useState<(typeof automationFilterOptions)[number]['value']>('all');
  const [automationResultFilter, setAutomationResultFilter] = useState<
    AutomationResultStatus | 'all'
  >('all');
  const [automationToolFilter, setAutomationToolFilter] = useState<AutomationTool | 'all'>('all');
  const [testCaseSearch, setTestCaseSearch] = useState('');
  const [isAutomationSectionExpanded, setIsAutomationSectionExpanded] = useState(true);
  const [form] = Form.useForm();
  const selectedAutomationStatus = Form.useWatch<AutomationStatus>('automationStatus', form);
  const effectiveAutomationStatus =
    selectedAutomationStatus || AutomationStatus.NOT_AUTOMATED;
  const isAutomationCandidate = effectiveAutomationStatus === AutomationStatus.CANDIDATE;
  const isAutomationConfigured = effectiveAutomationStatus === AutomationStatus.AUTOMATED;
  const isAutomationObsolete = effectiveAutomationStatus === AutomationStatus.OBSOLETE;
  const showAutomationPlanningFields =
    isAutomationCandidate || isAutomationConfigured || isAutomationObsolete;
  const showAutomationImplementationFields = isAutomationConfigured || isAutomationObsolete;
  const hasGeneratedCasesForCurrentFunctionality =
    generatedForFunctionalityId === functionalityId && (testCases?.length ?? 0) > 0;
  const isGenerateAiDisabled = isGenerating || hasGeneratedCasesForCurrentFunctionality;
  const visibleTestCases = Array.isArray(testCases)
    ? [...testCases].sort((left, right) => getStableSortOrder(left) - getStableSortOrder(right))
    : [];
  const automationSummary = useMemo(() => {
    const total = visibleTestCases.length;
    const byStatus = {
      automated: 0,
      candidate: 0,
      obsolete: 0,
      manual: 0,
    };
    const toolCounts = new Map<string, number>();
    const resultCounts = new Map<string, number>();

    for (const testCase of visibleTestCases) {
      const status = deriveAutomationStatus(testCase);
      if (status === AutomationStatus.AUTOMATED) byStatus.automated += 1;
      else if (status === AutomationStatus.CANDIDATE) byStatus.candidate += 1;
      else if (status === AutomationStatus.OBSOLETE) byStatus.obsolete += 1;
      else byStatus.manual += 1;

      if (testCase.automationTool) {
        toolCounts.set(testCase.automationTool, (toolCounts.get(testCase.automationTool) || 0) + 1);
      }

      if (testCase.lastAutomationStatus) {
        resultCounts.set(
          testCase.lastAutomationStatus,
          (resultCounts.get(testCase.lastAutomationStatus) || 0) + 1,
        );
      }
    }

    const automatedCoverage = total > 0 ? Math.round((byStatus.automated / total) * 100) : 0;
    const candidateCoverage = total > 0 ? Math.round((byStatus.candidate / total) * 100) : 0;
    const leadingTool =
      [...toolCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const leadingResult =
      [...resultCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const trackedAutomationCases = visibleTestCases.filter(testCase => {
      const status = deriveAutomationStatus(testCase);
      return (
        status === AutomationStatus.AUTOMATED ||
        Boolean(testCase.automationTool) ||
        Boolean(testCase.lastAutomationStatus) ||
        Boolean(testCase.lastAutomationRunAt)
      );
    });
    const latestRunByTool = automationToolOptions
      .map(tool => {
        const casesForTool = trackedAutomationCases.filter(testCase => testCase.automationTool === tool);
        const latestCase = [...casesForTool]
          .filter(testCase => testCase.lastAutomationRunAt)
          .sort(
            (left, right) =>
              new Date(right.lastAutomationRunAt || 0).getTime() -
              new Date(left.lastAutomationRunAt || 0).getTime(),
          )[0];

        return {
          tool,
          totalCases: casesForTool.length,
          latestCase: latestCase || null,
        };
      })
      .filter(item => item.totalCases > 0);
    const historicalAutomationCases = [...trackedAutomationCases].sort((left, right) => {
      const rightDate = new Date(right.lastAutomationRunAt || 0).getTime();
      const leftDate = new Date(left.lastAutomationRunAt || 0).getTime();
      return rightDate - leftDate || left.title.localeCompare(right.title);
    });

    return {
      total,
      automatedCoverage,
      candidateCoverage,
      byStatus,
      leadingTool,
      leadingResult,
      resultCounts,
      latestRunByTool,
      historicalAutomationCases,
      automatedCases: visibleTestCases.filter(testCase =>
        isAutomatedCoverageStatus(deriveAutomationStatus(testCase)),
      ),
    };
  }, [visibleTestCases]);
  const filteredTestCases = useMemo(() => {
    const normalizedSearch = testCaseSearch.trim().toLocaleLowerCase();

    return visibleTestCases.filter(testCase => {
      const status = deriveAutomationStatus(testCase);

      const matchesStatus =
        automationFilter === 'all'
          ? true
          : automationFilter === 'automated'
            ? status === AutomationStatus.AUTOMATED
            : automationFilter === 'candidate'
              ? status === AutomationStatus.CANDIDATE
              : automationFilter === 'obsolete'
                ? status === AutomationStatus.OBSOLETE
                : status === AutomationStatus.NOT_AUTOMATED;

      const matchesResult =
        automationResultFilter === 'all'
          ? true
          : testCase.lastAutomationStatus === automationResultFilter;

      const matchesTool =
        automationToolFilter === 'all' ? true : testCase.automationTool === automationToolFilter;

      const matchesSearch =
        normalizedSearch.length === 0 ||
        [testCase.title, testCase.id, testCase.automationReference]
          .filter(Boolean)
          .some(value => String(value).toLocaleLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesResult && matchesTool && matchesSearch;
    });
  }, [
    automationFilter,
    automationResultFilter,
    automationToolFilter,
    testCaseSearch,
    visibleTestCases,
  ]);
  const loadErrorMessage = isError ? toApiError(error).message : '';
  const generateAiButtonLabel = isGenerating
    ? 'Generando con IA...'
    : hasGeneratedCasesForCurrentFunctionality
      ? 'Casos IA generados'
      : 'Generar con IA';
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
        source: 'test-case-upgrade-modal-enterprise',
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
  const generateAiTooltipTitle = isGenerating
    ? 'La IA está generando y guardando los casos de prueba.'
    : !canUseAi
      ? 'Disponible en Growth. Actualiza tu plan para generar casos de prueba con IA.'
      : hasGeneratedCasesForCurrentFunctionality
        ? 'La generación ya fue exitosa para esta funcionalidad. Si necesitas más casos, recarga la vista o edita los existentes.'
        : 'Genera casos sugeridos con IA para esta funcionalidad.';

  const runGenerateAI = async () => {
    setIsGenerating(true);
    setAiGenerationError(null);
    try {
      const { generateTestCasesWithAI } = await import('../services/geminiService');
      const generated = await generateTestCasesWithAI(functionalityName, moduleName, projectId);
      if (!Array.isArray(generated) || generated.length === 0) {
        throw new Error('La IA no devolvió casos de prueba. Intenta generar el caso nuevamente.');
      }
      const nextSortOrder = visibleTestCases.length;
      const generatedTestCases: TestCase[] = generated.map((tc, index) => ({
        ...tc,
        id: `TC-AI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId,
        functionalityId,
        isAutomated: false,
        automationStatus: AutomationStatus.NOT_AUTOMATED,
        sortOrder: nextSortOrder + index,
      }));

      await saveManyWithSingleRefresh(generatedTestCases);
      setGeneratedForFunctionalityId(functionalityId);

      message.success(
        generated.length === 1
          ? 'Se generó 1 caso de prueba con IA'
          : `Se generaron ${generated.length} casos de prueba con IA`,
      );
    } catch (error) {
      console.error('AI Generation error:', error);
      const msg = (error instanceof Error ? error.message : (error as any)?.message) || '';
      const anyErr: any = error as any;
      const nestedMessage = (anyErr?.error?.message || anyErr?.message || '').toString();
      const reason = anyErr?.error?.details?.[0]?.reason || anyErr?.details?.[0]?.reason;
      const isLeakedKey =
        msg === 'GEMINI_API_KEY_LEAKED' || /reported as leaked/i.test(nestedMessage);
      const isInvalidKey =
        msg === 'GEMINI_API_KEY_INVALID' ||
        isLeakedKey ||
        reason === 'API_KEY_INVALID' ||
        /api key not valid/i.test(nestedMessage);

      if (msg === 'AI_PROVIDER_MISSING' || msg === 'GEMINI_API_KEY_MISSING') {
        setAiGenerationError(
          'El servicio de IA no está configurado. Contacta al administrador de la organización.',
        );
      } else if (isInvalidKey) {
        setAiGenerationError(
          isLeakedKey
            ? 'La API Key configurada en el entorno fue reportada como filtrada. Genera una nueva.'
            : 'La API Key configurada en el entorno no es válida.',
        );
      } else {
        setAiGenerationError(msg || 'No se pudo generar o guardar el caso de prueba. Inténtalo nuevamente.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAI = async () => {
    if (isGenerateAiDisabled) return;
    if (!canUseAi) {
      message.warning('La generación de casos con IA está disponible en el plan Growth.');
      return;
    }

    await runGenerateAI();
  };

  const openCaseForm = (testCase?: TestCase) => {
    setIsAutomationSectionExpanded(true);
    if (testCase) {
      setEditingTestCase(testCase);
      form.setFieldsValue({
        ...testCase,
        automationStatus: deriveAutomationStatus(testCase),
      });
    } else {
      setEditingTestCase(null);
      form.resetFields();
    }
    setIsCaseFormVisible(true);
  };

  const handleCancel = () => {
    setIsCaseFormVisible(false);
    form.resetFields();
  };

  const handleTemplateSelect = (templateId?: string) => {
    const template = templates.find(item => item.id === templateId);

    if (!template) return;

    form.setFieldsValue({
      description: template.description,
      preconditions: template.preconditions,
      testSteps: template.testSteps,
      expectedResult: template.expectedResult,
      testType: template.testType,
      priority: template.priority,
      isAutomated: template.isAutomated,
      automationStatus: deriveAutomationStatus(template),
      automationType: template.automationType,
      automationTool: template.automationTool,
      automationReference: template.automationReference,
      automationOwner: template.automationOwner,
    });
  };

  const onFinish = (values: any) => {
    const formValues = form.getFieldsValue(true);
    const mergedValues = {
      ...formValues,
      ...values,
    };
    const nextSortOrder =
      visibleTestCases.length > 0
        ? Math.max(...visibleTestCases.map(testCase => getStableSortOrder(testCase))) + 1
        : 0;
    const automationStatus = mergedValues.automationStatus || AutomationStatus.NOT_AUTOMATED;
    const newTestCase: TestCase = {
      ...mergedValues,
      id: editingTestCase?.id || `TC-${Date.now()}`,
      projectId,
      functionalityId,
      automationStatus,
      automationType: mergedValues.automationType,
      automationTool: mergedValues.automationTool,
      automationReference: mergedValues.automationReference || '',
      automationOwner: mergedValues.automationOwner || '',
      lastAutomationStatus:
        automationStatus === AutomationStatus.AUTOMATED
          ? mergedValues.lastAutomationStatus || AutomationResultStatus.UNKNOWN
          : undefined,
      lastAutomationRunAt:
        automationStatus === AutomationStatus.AUTOMATED
          ? mergedValues.lastAutomationRunAt || ''
          : undefined,
      isAutomated: isAutomatedCoverageStatus(automationStatus),
      sortOrder: editingTestCase?.sortOrder ?? nextSortOrder,
    };

    save(newTestCase, {
      onSuccess: () => {
        message.success(editingTestCase ? 'Caso de prueba actualizado' : 'Caso de prueba creado');
        setIsCaseFormVisible(false);
        form.resetFields();
        void refetch();
      },
      onError: () => {
        message.error('Error al guardar el caso de prueba');
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteTestCase(id, {
      onSuccess: () => {
        message.success('Caso de prueba eliminado');
      },
      onError: () => {
        message.error('Error al eliminar el caso de prueba');
      },
    });
  };

  const handleDuplicate = (testCase: TestCase) => {
    const nextSortOrder =
      visibleTestCases.length > 0
        ? Math.max(...visibleTestCases.map(item => getStableSortOrder(item))) + 1
        : 0;
    const duplicatedTestCase: TestCase = {
      ...testCase,
      documentId: undefined,
      id: `TC-${Date.now()}`,
      title: buildDuplicatedTestCaseTitle(
        testCase.title,
        visibleTestCases.map(item => item.title),
      ),
      sortOrder: nextSortOrder,
    };

    save(duplicatedTestCase, {
      onSuccess: () => {
        message.success('Caso de prueba duplicado');
      },
      onError: () => {
        message.error('Error al duplicar el caso de prueba');
      },
    });
  };

  const handlePersistReorder = async (changedTestCases: TestCase[]) => {
    setIsReordering(true);
    try {
      const items = changedTestCases
        .filter(
          (testCase): testCase is TestCase & { documentId: string; sortOrder: number } =>
            Boolean(testCase.documentId) &&
            typeof testCase.sortOrder === 'number' &&
            Number.isFinite(testCase.sortOrder),
        )
        .map(testCase => ({
          documentId: testCase.documentId,
          sortOrder: testCase.sortOrder,
        }));

      if (items.length > 0) {
        await reorder(items);
      }
      message.success('Orden de casos de prueba actualizado');
      return true;
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : 'No pudimos actualizar el orden de los casos de prueba.',
      );
      return false;
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveTestCase = async (testCaseId: string, direction: 'up' | 'down') => {
    const currentIndex = visibleTestCases.findIndex(testCase => testCase.id === testCaseId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= visibleTestCases.length) {
      return;
    }

    const reorderedTestCases = moveTestCase(visibleTestCases, currentIndex, targetIndex);
    const originalById = new Map(visibleTestCases.map(testCase => [testCase.id, testCase]));
    const changedTestCases = reorderedTestCases.filter(
      testCase => originalById.get(testCase.id)?.sortOrder !== testCase.sortOrder,
    );
    await handlePersistReorder(changedTestCases);
  };

  const openReorderModal = () => {
    setReorderDraft(visibleTestCases);
    setDraggedReorderTestCaseId(null);
    setIsReorderModalOpen(true);
  };

  const moveReorderDraftItem = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;

    setReorderDraft(current => {
      const sourceIndex = current.findIndex(testCase => testCase.id === sourceId);
      const targetIndex = current.findIndex(testCase => testCase.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0) return current;

      const next = [...current];
      const [movedTestCase] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedTestCase);
      return next;
    });
  };

  const handleSaveTestCaseOrder = async () => {
    const reorderedTestCases = normalizeTestCaseOrder(reorderDraft);
    const originalById = new Map(visibleTestCases.map(testCase => [testCase.id, testCase]));
    const changedTestCases = reorderedTestCases.filter(
      testCase => originalById.get(testCase.id)?.sortOrder !== testCase.sortOrder,
    );

    if (await handlePersistReorder(changedTestCases)) {
      setIsReorderModalOpen(false);
      setDraggedReorderTestCaseId(null);
    }
  };

  const handleTableRowDrop = async (targetTestCaseId: string) => {
    const sourceTestCaseId = draggedReorderTestCaseId;
    setDraggedReorderTestCaseId(null);

    if (!sourceTestCaseId || sourceTestCaseId === targetTestCaseId) return;

    const sourceIndex = visibleTestCases.findIndex(testCase => testCase.id === sourceTestCaseId);
    const targetIndex = visibleTestCases.findIndex(testCase => testCase.id === targetTestCaseId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reorderedTestCases = moveTestCase(visibleTestCases, sourceIndex, targetIndex);
    const originalById = new Map(visibleTestCases.map(testCase => [testCase.id, testCase]));
    const changedTestCases = reorderedTestCases.filter(
      testCase => originalById.get(testCase.id)?.sortOrder !== testCase.sortOrder,
    );
    await handlePersistReorder(changedTestCases);
  };

  const columns = [
    {
      title: '',
      key: 'drag-handle',
      width: 36,
      align: 'center' as const,
      render: (_: unknown, record: TestCase) => (
        <Tooltip title={isViewer ? undefined : 'Arrastrar para ordenar'}>
          <span
            draggable={!isViewer && !isReordering}
            aria-label="Arrastrar caso de prueba"
            className={`inline-flex h-7 w-7 items-center justify-center text-slate-400 ${
              isViewer || isReordering
                ? 'cursor-default opacity-50'
                : 'cursor-grab hover:text-slate-600 active:cursor-grabbing'
            }`}
            onDragStart={event => {
              setDraggedReorderTestCaseId(record.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', record.id);
            }}
            onDragEnd={() => setDraggedReorderTestCaseId(null)}
          >
            <HolderOutlined />
          </span>
        </Tooltip>
      ),
    },
    Table.EXPAND_COLUMN,
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'testType',
      key: 'testType',
      width: 120,
      render: (type: TestType) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Automatización',
      dataIndex: 'isAutomated',
      key: 'isAutomated',
      width: 160,
      render: (_: boolean | undefined, record: TestCase) => {
        const automationStatus = deriveAutomationStatus(record);
        return <Tag color={getAutomationStatusColor(automationStatus)}>{automationStatus}</Tag>;
      },
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (priority: Priority) => {
        const colors = {
          [Priority.CRITICAL]: 'magenta',
          [Priority.HIGH]: 'red',
          [Priority.MEDIUM]: 'orange',
          [Priority.LOW]: 'green',
        };
        return <Tag color={colors[priority]}>{priority}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: TestCase) => (
        <div className="flex flex-nowrap items-center justify-center gap-1">
          {!isViewer ? (
            <>
              <Tooltip title="Editar caso de prueba">
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openCaseForm(record)}
                />
              </Tooltip>
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    { key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicar' },
                    {
                      key: 'move-up',
                      icon: <ArrowUpOutlined />,
                      label: 'Mover arriba',
                      disabled:
                        isReordering ||
                        visibleTestCases.findIndex(item => item.id === record.id) === 0,
                    },
                    {
                      key: 'move-down',
                      icon: <ArrowDownOutlined />,
                      label: 'Mover abajo',
                      disabled:
                        isReordering ||
                        visibleTestCases.findIndex(item => item.id === record.id) ===
                          visibleTestCases.length - 1,
                    },
                    { type: 'divider' },
                    { key: 'delete', icon: <DeleteOutlined />, label: 'Eliminar', danger: true },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'duplicate') handleDuplicate(record);
                    if (key === 'move-up') void handleMoveTestCase(record.id, 'up');
                    if (key === 'move-down') void handleMoveTestCase(record.id, 'down');
                    if (key === 'delete') {
                      Modal.confirm({
                        title: '¿Eliminar este caso de prueba?',
                        content: 'Esta acción no se puede deshacer.',
                        okText: 'Eliminar',
                        okButtonProps: { danger: true },
                        cancelText: 'Cancelar',
                        onOk: () => handleDelete(record.id),
                      });
                    }
                  },
                }}
              >
                <Button
                  size="small"
                  aria-label="Más acciones"
                  icon={<MoreOutlined />}
                />
              </Dropdown>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Card
      title={
        <div className="qa-test-case-management-header">
          <div className="qa-test-case-management-header__title">
            <FileTextOutlined className="shrink-0" />
            <div className="min-w-0">
              <Tooltip title={`Casos de prueba · ${functionalityName}`}>
                <span className="qa-test-case-management-header__title-text">
                  {isCaseFormVisible
                    ? `${editingTestCase ? 'Editar' : 'Nuevo'} caso de prueba · ${functionalityName}`
                    : `Casos de prueba · ${functionalityName}`}
                </span>
              </Tooltip>
              {!isCaseFormVisible ? (
                <span className="mt-0.5 block text-xs font-normal text-slate-400">
                  {visibleTestCases.length} caso{visibleTestCases.length === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
          <div className="qa-test-case-management-header__actions">
            {isCaseFormVisible ? (
              <Button icon={<ArrowLeftOutlined />} onClick={handleCancel}>
                Volver a los casos
              </Button>
            ) : !isViewer && visibleTestCases.length > 5 ? (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    {
                      key: 'create-group',
                      type: 'group',
                      label: 'CREAR CASOS',
                      children: [
                        { key: 'new', label: 'Nuevo caso de prueba', icon: <PlusOutlined />, onClick: () => openCaseForm() },
                        { key: 'paste', label: 'Pegar casos en bloque', icon: <CopyOutlined />, disabled: isLoading || isError, onClick: () => setIsBulkPasteOpen(true) },
                        { key: 'ai', label: <Tooltip title={generateAiTooltipTitle}><span>{generateAiButtonLabel}</span></Tooltip>, icon: <ThunderboltOutlined />, disabled: isGenerateAiDisabled || !canUseAi || isGenerating, onClick: () => void handleGenerateAI() },
                      ],
                    },
                    { type: 'divider' },
                    {
                      key: 'organize-group',
                      type: 'group',
                      label: 'ORGANIZACIÓN',
                      children: [
                        { key: 'reorder', label: 'Ordenar casos', icon: <MenuOutlined />, onClick: openReorderModal },
                      ],
                    },
                  ],
                }}
              >
                <Button icon={<MenuOutlined />} loading={isGenerating}>
                  Gestionar <DownOutlined />
                </Button>
              </Dropdown>
            ) : !isViewer ? (
              <>
                <Tooltip title={generateAiTooltipTitle}>
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={handleGenerateAI}
                    loading={isGenerating}
                    disabled={isGenerateAiDisabled || !canUseAi}
                    className="rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    {generateAiButtonLabel}
                  </Button>
                </Tooltip>
                <Button icon={<CopyOutlined />} disabled={isLoading || isError} onClick={() => setIsBulkPasteOpen(true)}>
                  Pegar casos en bloque
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCaseForm()}>
                  Nuevo caso de prueba
                </Button>
              </>
            ) : null}
            {onClose ? (
              <Tooltip title="Cerrar casos de prueba">
                <Button
                  type="text"
                  aria-label="Cerrar casos de prueba"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                />
              </Tooltip>
            ) : null}
          </div>
        </div>
      }
      className="qa-test-case-management-card shadow-none"
    >
      <div hidden={isCaseFormVisible}>
      {functionalityNavigation && functionalityNavigation.total > 0 ? (
        <nav
          aria-label="Navegación entre funcionalidades del módulo"
          className="mb-4 flex flex-wrap items-center justify-between gap-3"
        >
          <Text type="secondary" className="min-w-0 break-words">
            {moduleName || 'Sin módulo'} · Funcionalidad {functionalityNavigation.position} de{' '}
            {functionalityNavigation.total}
          </Text>
          <Space wrap>
            <Tooltip title={functionalityNavigation.previousName}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={functionalityNavigation.onPrevious}
                disabled={!functionalityNavigation.onPrevious || isGenerating || isReordering}
                aria-label="Funcionalidad anterior"
              >
                Anterior
              </Button>
            </Tooltip>
            <Tooltip title={functionalityNavigation.nextName}>
              <Button
                onClick={functionalityNavigation.onNext}
                disabled={!functionalityNavigation.onNext || isGenerating || isReordering}
                aria-label="Funcionalidad siguiente"
              >
                Siguiente <ArrowRightOutlined />
              </Button>
            </Tooltip>
          </Space>
        </nav>
      ) : null}
      {aiGenerationError ? (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          closable
          onClose={() => setAiGenerationError(null)}
          message="No se pudo completar la generación con IA"
          description={aiGenerationError}
          action={
            <Button
              size="small"
              onClick={handleGenerateAI}
              loading={isGenerating}
              disabled={isGenerateAiDisabled || !canUseAi}
            >
              Reintentar
            </Button>
          }
        />
      ) : null}
      <PlanBillingBanner
        organizationName={activeMembership?.organization?.name}
        contractedPlan={activeOrganizationPlan}
        effectivePlan={effectiveOrganizationPlan}
        billing={activeBillingState}
        upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
        onRenewClick={() => handleUpgradeClick('test-case-billing-banner')}
      />

      {!isViewer && !canUseAi ? (
        <PlanUpgradeCard
          className="mb-4"
          variant="inline-banner"
          eyebrow="IA disponible en Growth"
          title="Desbloquea la generación de casos con IA"
          description="Activa sugerencias automáticas para crear casos de prueba sin salir del proyecto."
          ctaHref={aiUpgradeUrl}
          ctaText="Probar IA"
          onCtaClick={() => handleUpgradeClick('test-case-ai-lock')}
        />
      ) : null}

      <div className="mb-4">
        <Alert
          className="rounded-2xl border-sky-100 bg-sky-50/70 shadow-none"
          type="info"
          showIcon
          closable
          message="Utiliza plantillas para estandarizar tus casos de prueba."
          description="Las plantillas se configuran por módulo y permiten acelerar la creación de casos manteniendo consistencia entre funcionalidades."
        />
      </div>

      <Tabs
        className="mt-1"
        defaultActiveKey="test-cases"
        items={[
          {
            key: 'test-cases',
            label: 'Casos de prueba',
            children: (
              <>
                <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_minmax(150px,0.55fr)_minmax(150px,0.55fr)_minmax(150px,0.55fr)_auto]">
                    <Input
                      size="small"
                      allowClear
                      prefix={<SearchOutlined className="text-slate-400" />}
                      placeholder="Buscar caso de prueba"
                      value={testCaseSearch}
                      onChange={event => {
                        setTestCaseSearch(event.target.value);
                        setCurrentPage(1);
                      }}
                    />
                    <Select
                      size="small"
                      className="w-full"
                      value={automationFilter}
                      options={automationFilterOptions.map(option => ({
                        label: `Estado: ${option.label}`,
                        value: option.value,
                      }))}
                      onChange={value => {
                        setAutomationFilter(value);
                        setCurrentPage(1);
                      }}
                    />
                    <Select
                      size="small"
                      className="w-full"
                      value={automationResultFilter}
                      options={[
                        { label: 'Resultado: Todos', value: 'all' },
                        ...automationResultStatusOptions.map(option => ({
                          label: `Resultado: ${option}`,
                          value: option,
                        })),
                      ]}
                      onChange={value => {
                        setAutomationResultFilter(value);
                        setCurrentPage(1);
                      }}
                    />
                    <Select
                      size="small"
                      className="w-full"
                      value={automationToolFilter}
                      options={[
                        { label: 'Herramienta: Todas', value: 'all' },
                        ...automationToolOptions.map(option => ({
                          label: `Herramienta: ${option}`,
                          value: option,
                        })),
                      ]}
                      onChange={value => {
                        setAutomationToolFilter(value);
                        setCurrentPage(1);
                      }}
                    />
                    <Button
                      size="small"
                      className="w-full xl:w-auto"
                      disabled={
                        testCaseSearch.length === 0 &&
                        automationFilter === 'all' &&
                        automationResultFilter === 'all' &&
                        automationToolFilter === 'all'
                      }
                      onClick={() => {
                        setTestCaseSearch('');
                        setAutomationFilter('all');
                        setAutomationResultFilter('all');
                        setAutomationToolFilter('all');
                        setCurrentPage(1);
                      }}
                    >
                      Limpiar filtros
                    </Button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      {
                        key: 'all' as const,
                        label: 'Todos',
                        count: automationSummary.total,
                        activeClassName: 'border-blue-200 bg-blue-50 text-blue-700',
                        dotClassName: 'border-blue-500',
                      },
                      {
                        key: 'automated' as const,
                        label: 'Automatizados',
                        count: automationSummary.byStatus.automated,
                        activeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                        dotClassName: 'border-emerald-500',
                      },
                      {
                        key: 'candidate' as const,
                        label: 'Candidatos',
                        count: automationSummary.byStatus.candidate,
                        activeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
                        dotClassName: 'border-amber-500',
                      },
                      {
                        key: 'obsolete' as const,
                        label: 'Obsoletos',
                        count: automationSummary.byStatus.obsolete,
                        activeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
                        dotClassName: 'border-rose-500',
                      },
                    ].map(option => {
                      const isActive = automationFilter === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => {
                            setAutomationFilter(option.key);
                            setCurrentPage(1);
                          }}
                          className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                            isActive
                              ? option.activeClassName
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {isActive ? (
                            <CheckCircleFilled />
                          ) : (
                            <span className={`h-3 w-3 rounded-full border ${option.dotClassName}`} />
                          )}
                          <span>{option.label}</span>
                          <span>{option.count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isError ? (
                  <Alert
                    type="error"
                    showIcon
                    className="mb-4"
                    message="No pudimos cargar los casos de prueba en este momento."
                    description={
                      loadErrorMessage
                        ? `${loadErrorMessage} Si ya habías registrado casos, esto puede ser un fallo temporal del backend y no una pérdida de datos.`
                        : 'Si ya habías registrado casos, esto puede ser un fallo temporal del backend y no una pérdida de datos.'
                    }
                    action={
                      <Button size="small" onClick={() => void refetch()} loading={isFetching}>
                        Reintentar
                      </Button>
                    }
                  />
                ) : null}

                <Table
                  key={`${testCaseSearch}-${automationFilter}-${automationResultFilter}-${automationToolFilter}-${filteredTestCases.length}`}
                  className="qa-test-case-table"
                  columns={columns}
                  dataSource={filteredTestCases}
                  rowKey="id"
                  rowClassName={record =>
                    draggedReorderTestCaseId === record.id ? 'qa-test-case-table__dragging-row' : ''
                  }
                  onRow={record => ({
                    onDragOver: event => {
                      if (!isViewer && draggedReorderTestCaseId) event.preventDefault();
                    },
                    onDrop: event => {
                      event.preventDefault();
                      if (!isViewer) void handleTableRowDrop(record.id);
                    },
                  })}
                  loading={
                    isLoading || isReordering || (isFetching && visibleTestCases.length === 0)
                  }
                  pagination={{
                    current: currentPage,
                    pageSize,
                    total: filteredTestCases.length,
                    showTotal: total => `${total} caso${total === 1 ? '' : 's'}`,
                    onChange: (page, nextPageSize) => {
                      setCurrentPage(page);
                      if (typeof nextPageSize === 'number' && nextPageSize !== pageSize) {
                        setPageSize(nextPageSize);
                      }
                    },
                  }}
                  locale={{
                    emptyText: isError
                      ? 'No se pudieron cargar los casos de prueba.'
                      : 'Aún no hay casos de prueba registrados para esta funcionalidad.',
                  }}
                  expandable={{
                    expandedRowRender: record => (
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="mb-4">
                          <Text strong>Descripción:</Text>
                          {renderRichTextContent(record.description)}
                        </div>
                        <div className="mb-4">
                          <Text strong>Precondiciones:</Text>
                          {renderRichTextContent(record.preconditions)}
                        </div>
                        <div className="mb-4">
                          <Text strong>Pasos de Prueba:</Text>
                          {renderRichTextContent(record.testSteps)}
                        </div>
                        <div>
                          <Text strong>Resultado Esperado:</Text>
                          {renderRichTextContent(record.expectedResult)}
                        </div>
                      </div>
                    ),
                  }}
                />
              </>
            ),
          },
          {
            key: 'automation-traceability',
            label: 'Trazabilidad automatizada',
            children:
              automationSummary.latestRunByTool.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {automationSummary.latestRunByTool.map(item => (
                      <div
                        key={item.tool}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700">{item.tool}</span>
                          <Tag color="blue">
                            {item.totalCases} caso{item.totalCases === 1 ? '' : 's'}
                          </Tag>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          {item.latestCase ? (
                            <>
                              <div>
                                Ultima ejecucion:{' '}
                                {formatAutomationRunAt(item.latestCase.lastAutomationRunAt)}
                              </div>
                              <div className="mt-1">Caso: {item.latestCase.title}</div>
                            </>
                          ) : (
                            <div>Sin ejecuciones importadas aun.</div>
                          )}
                        </div>
                        {item.latestCase?.lastAutomationStatus ? (
                          <div className="mt-2">
                            <Tag
                              color={getAutomationResultColor(item.latestCase.lastAutomationStatus)}
                            >
                              {item.latestCase.lastAutomationStatus}
                            </Tag>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <div className="mb-3 text-sm font-semibold text-slate-700">
                      Historial resumido por caso automatizado
                    </div>
                    <div className="space-y-2">
                      {automationSummary.historicalAutomationCases.slice(0, 5).map(testCase => (
                        <div
                          key={testCase.id}
                          className="flex flex-col gap-2 rounded-xl border border-slate-100 px-3 py-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-700">
                              {testCase.title}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>{testCase.automationTool || 'Sin herramienta'}</span>
                              <span>{testCase.automationReference || 'Sin referencia'}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {testCase.lastAutomationStatus ? (
                              <Tag color={getAutomationResultColor(testCase.lastAutomationStatus)}>
                                {testCase.lastAutomationStatus}
                              </Tag>
                            ) : (
                              <Tag>Sin resultado</Tag>
                            )}
                            <Tag color="default">
                              {formatAutomationRunAt(testCase.lastAutomationRunAt)}
                            </Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Aun no hay trazabilidad automatizada registrada para esta funcionalidad.
                </div>
              ),
          },
        ]}
      />

      {isBulkPasteOpen && !isViewer && (
        <BulkPasteCasesModal
          key={`${projectId}-${functionalityId}`}
          projectId={projectId}
          functionalityId={functionalityId}
          functionalityName={functionalityName}
          existingCases={testCases || []}
          onSave={savePastedCases}
          onClose={() => setIsBulkPasteOpen(false)}
        />
      )}
      <UpgradeModal
        open={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        organizationName={activeMembership?.organization?.name}
        currentPlan={effectiveOrganizationPlan}
        title="Compara planes para acelerar la creación de casos"
        description="Si quieres combinar trabajo manual con IA y más capacidad operativa, aquí puedes ver con claridad el siguiente paso."
        onUpgradeGrowth={() => handleUpgradeClick('test-case-upgrade-modal-growth')}
        onContactEnterprise={() => handleEnterpriseClick()}
      />

      <Modal
        title="Ordenar casos de prueba"
        open={isReorderModalOpen}
        onCancel={() => {
          if (!isReordering) {
            setIsReorderModalOpen(false);
            setDraggedReorderTestCaseId(null);
          }
        }}
        closable={!isReordering}
        maskClosable={!isReordering}
        keyboard={!isReordering}
        width={720}
        footer={[
          <Button
            key="cancel"
            disabled={isReordering}
            onClick={() => setIsReorderModalOpen(false)}
          >
            Cancelar
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={isReordering}
            onClick={() => void handleSaveTestCaseOrder()}
          >
            Guardar orden
          </Button>,
        ]}
      >
        <Text type="secondary" className="mb-4 block text-sm">
          Arrastra los casos para definir su secuencia. El orden se aplicara cuando guardes.
        </Text>
        <List
          className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200"
          dataSource={reorderDraft}
          locale={{ emptyText: 'No hay casos para ordenar.' }}
          renderItem={(testCase, index) => {
            const isDragging = draggedReorderTestCaseId === testCase.id;

            return (
              <List.Item
                key={testCase.id}
                draggable={!isReordering}
                className={`cursor-grab px-4 py-3 transition ${
                  isDragging ? 'bg-sky-50 opacity-60' : 'bg-white hover:bg-slate-50'
                } ${isReordering ? 'cursor-not-allowed' : 'active:cursor-grabbing'}`}
                onDragStart={event => {
                  setDraggedReorderTestCaseId(testCase.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  if (draggedReorderTestCaseId) {
                    moveReorderDraftItem(draggedReorderTestCaseId, testCase.id);
                  }
                  setDraggedReorderTestCaseId(null);
                }}
                onDragEnd={() => setDraggedReorderTestCaseId(null)}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    {index + 1}
                  </span>
                  <MenuOutlined className="shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <Text strong className="block truncate text-slate-800">
                      {testCase.title || 'Caso de prueba'}
                    </Text>
                    <Text type="secondary" className="block truncate text-xs">
                      {testCase.testType} - {testCase.priority}
                    </Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      </Modal>

      </div>

      {isCaseFormVisible ? (
        <Suspense fallback={<div className="py-3 text-sm text-slate-400">Cargando editor...</div>}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              priority: Priority.MEDIUM,
              testType: TestType.FUNCTIONAL,
              automationStatus: AutomationStatus.NOT_AUTOMATED,
              isAutomated: false,
              lastAutomationStatus: AutomationResultStatus.UNKNOWN,
            }}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 lg:col-span-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition-colors hover:bg-blue-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                  aria-expanded={isAutomationSectionExpanded}
                  aria-controls="test-case-automation-fields"
                  onClick={() => setIsAutomationSectionExpanded(current => !current)}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <ThunderboltOutlined />
                    </span>
                    <Text strong className="text-blue-950">
                      <InformativeLabel
                        label="Automatización"
                        tooltip="Define si el caso se automatizará o ya está automatizado, junto con la herramienta, el responsable y la referencia del script."
                      />
                    </Text>
                  </span>
                  {isAutomationSectionExpanded ? (
                    <DownOutlined className="text-blue-600" />
                  ) : (
                    <RightOutlined className="text-blue-600" />
                  )}
                </button>
                <div
                  id="test-case-automation-fields"
                  className={`${isAutomationSectionExpanded ? 'grid' : 'hidden'} grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2`}
                >
                  <Form.Item
                    name="automationStatus"
                    label="Estado"
                    className="sm:col-span-1"
                    rules={[{ required: true, message: 'Selecciona el estado de automatización' }]}
                  >
                    <Select
                      options={automationStatusOptions.map(option => ({
                        label: option,
                        value: option,
                      }))}
                    />
                  </Form.Item>

                  {showAutomationPlanningFields ? (
                    <Form.Item name="automationType" label="Tipo de automatización">
                      <Select
                        allowClear
                        disabled={isAutomationObsolete}
                        placeholder="Selecciona el tipo"
                        options={automationTypeOptions.map(option => ({
                          label: getAutomationTypeLabel(option),
                          value: option,
                        }))}
                      />
                    </Form.Item>
                  ) : null}

                  <Alert
                    className="sm:col-span-2"
                    showIcon
                    type={isAutomationObsolete ? 'warning' : 'info'}
                    message={automationStatusGuidance[effectiveAutomationStatus]}
                  />

                  {showAutomationImplementationFields ? (
                    <Form.Item
                      name="automationTool"
                      label="Herramienta"
                      rules={
                        isAutomationConfigured
                          ? [{ required: true, message: 'Selecciona la herramienta utilizada' }]
                          : undefined
                      }
                    >
                      <Select
                        allowClear
                        disabled={isAutomationObsolete}
                        placeholder="Selecciona la herramienta"
                        options={automationToolOptions.map(option => ({
                          label: option,
                          value: option,
                        }))}
                      />
                    </Form.Item>
                  ) : null}

                  {showAutomationPlanningFields ? (
                    <Form.Item
                      name="automationOwner"
                      label="Responsable"
                      className={isAutomationCandidate ? 'sm:col-span-2' : undefined}
                    >
                      <Input
                        disabled={isAutomationObsolete}
                        placeholder="Ej: Equipo de automatización QA"
                      />
                    </Form.Item>
                  ) : null}

                  {showAutomationImplementationFields ? (
                    <Form.Item
                      name="automationReference"
                      label="Referencia"
                      className="sm:col-span-2"
                      rules={
                        isAutomationConfigured
                          ? [
                              {
                                required: true,
                                whitespace: true,
                                message: 'Ingresa la ruta o identificador del script',
                              },
                            ]
                          : undefined
                      }
                    >
                      <Input
                        disabled={isAutomationObsolete}
                        placeholder="Ej: tests/auth/login.spec.ts o AUTH-LOGIN-001"
                      />
                    </Form.Item>
                  ) : null}

                  {isAutomationConfigured ? (
                    <>
                      <Form.Item name="lastAutomationStatus" label="Último resultado">
                        <Select
                          allowClear
                          disabled
                          options={automationResultStatusOptions.map(option => ({
                            label: option,
                            value: option,
                          }))}
                        />
                      </Form.Item>

                      <Form.Item name="lastAutomationRunAt" label="Última ejecución">
                        <Input
                          readOnly
                          disabled
                          placeholder="Se actualiza desde la ejecución automatizada"
                        />
                      </Form.Item>
                    </>
                  ) : null}
                </div>
              </div>

              <Form.Item
                name="title"
                label="Título"
                rules={[{ required: true, message: 'Por favor ingresa el título' }]}
              >
                <Input placeholder="Ej: Validar login con credenciales correctas" />
              </Form.Item>

              <Form.Item name="templateId" label="Plantilla">
                <Select
                  allowClear
                  placeholder={
                    templates.length > 0
                      ? 'Selecciona una plantilla para autocompletar'
                      : 'No hay plantillas para este módulo'
                  }
                  options={templates.map(template => ({
                    label: template.name,
                    value: template.id,
                  }))}
                  onChange={handleTemplateSelect}
                />
              </Form.Item>

              <Form.Item name="testType" label="Tipo de Prueba" rules={[{ required: true }]}>
                <Select>
                  {Object.values(TestType).map(type => (
                    <Select.Option key={type} value={type}>
                      {type}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
                <Select>
                  {Object.values(Priority).map(priority => (
                    <Select.Option key={priority} value={priority}>
                      {labelPriority(priority, t)}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="description"
                label={
                  <InformativeLabel
                    label="Descripción"
                    tooltip="Resume el objetivo y el alcance del caso de prueba para que cualquier persona entienda qué se validará."
                  />
                }
              >
                <TestCaseRichTextEditorField
                  voiceSessionKey={editingTestCase?.id || "new-case"}
                  placeholder="Descripción breve del objetivo de la prueba"
                  minHeightClassName="min-h-[160px]"
                />
              </Form.Item>

              <Form.Item name="isAutomated" valuePropName="checked" hidden>
                <Switch checkedChildren="Sí" unCheckedChildren="No" disabled={isViewer} />
              </Form.Item>

              <Form.Item
                name="preconditions"
                label={
                  <InformativeLabel
                    label="Precondiciones"
                    tooltip="Indica los datos, permisos, configuraciones o estados que deben existir antes de iniciar la prueba."
                  />
                }
              >
                <TestCaseRichTextEditorField
                  voiceSessionKey={editingTestCase?.id || "new-case"}
                  placeholder="Estado inicial requerido"
                  minHeightClassName="min-h-[160px]"
                />
              </Form.Item>

              <Form.Item
                name="testSteps"
                label={
                  <InformativeLabel
                    label="Pasos de Prueba"
                    tooltip="Detalla, en orden, las acciones que debe ejecutar la persona responsable para reproducir la validación."
                  />
                }
                rules={[{ required: true, message: 'Por favor ingresa los pasos' }]}
              >
                <TestCaseRichTextEditorField
                  voiceSessionKey={editingTestCase?.id || "new-case"}
                  placeholder="1. Ingresar a la URL...&#10;2. Escribir usuario...&#10;3. Clic en botón..."
                  minHeightClassName="min-h-[160px]"
                />
              </Form.Item>

              <Form.Item
                name="expectedResult"
                label={
                  <InformativeLabel
                    label="Resultado Esperado"
                    tooltip="Describe el comportamiento observable que confirma que la prueba fue exitosa después de completar los pasos."
                  />
                }
                rules={[{ required: true, message: 'Por favor ingresa el resultado esperado' }]}
              >
                <TestCaseRichTextEditorField
                  voiceSessionKey={editingTestCase?.id || "new-case"}
                  placeholder="El sistema debe mostrar el dashboard..."
                  minHeightClassName="min-h-[160px]"
                />
              </Form.Item>
            </div>

            <Form.Item className="mb-0 mt-4 flex justify-end">
              <Space>
                <Button onClick={handleCancel}>Cancelar</Button>
                {!isViewer ? (
                  <Button type="primary" htmlType="submit">
                    {editingTestCase ? 'Actualizar' : 'Crear'}
                  </Button>
                ) : null}
              </Space>
            </Form.Item>
          </Form>
        </Suspense>
      ) : null}
    </Card>
  );
};

export default TestCaseManagement;
