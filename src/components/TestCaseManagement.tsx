import React, { Suspense, lazy, useState } from 'react';
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
  Popconfirm,
  Tooltip,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  CopyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import { TestCase, Priority, TestType } from '../types';
import { useTranslation } from 'react-i18next';
import { toApiError } from '../config/http';
import { labelPriority } from '../i18n/labels';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useTestCaseTemplates } from '../modules/test-case-templates/hooks/useTestCaseTemplates';
import { PlanBillingBanner } from '../modules/plans/components/PlanBillingBanner';
import { startUpgradeRequestFlow } from '../modules/plans/services/billingService';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { normalizeEvidenceHtml, stripHtmlToText } from '../utils/evidenceRichText';
import { PlanUpgradeCard } from '../modules/plans/components/PlanUpgradeCard';
import { UpgradeModal } from '../modules/plans/components/UpgradeModal';
import {
  buildProjectUpgradeWhatsAppUrl,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';

const { TextArea } = Input;
const { Text } = Typography;
const BasicRichTextEditor = lazy(() => import('./BasicRichTextEditor'));

function BasicRichTextEditorField(props: React.ComponentProps<typeof BasicRichTextEditor>) {
  return (
    <Suspense fallback={<div className="py-3 text-sm text-slate-400">Cargando editor...</div>}>
      <BasicRichTextEditor {...props} />
    </Suspense>
  );
}

function renderRichTextContent(value?: string) {
  const normalizedHtml = normalizeEvidenceHtml(value);
  const plainText = stripHtmlToText(value);

  if (!normalizedHtml || !plainText) {
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
}

const TestCaseManagement: React.FC<TestCaseManagementProps> = ({
  projectId,
  functionalityId,
  functionalityName,
  moduleName,
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
    saveManyWithSingleRefresh,
    delete: deleteTestCase,
  } = useTestCases(projectId, functionalityId);
  const { data: templates = [] } = useTestCaseTemplates(projectId, moduleName);
  const { isViewer, activeMembership, projectQuota } = useWorkspaceAccess();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [draggedTestCaseId, setDraggedTestCaseId] = useState<string | null>(null);
  const [dragOverTestCaseId, setDragOverTestCaseId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [generatedForFunctionalityId, setGeneratedForFunctionalityId] = useState<string | null>(
    null,
  );
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [form] = Form.useForm();
  const hasGeneratedCasesForCurrentFunctionality =
    generatedForFunctionalityId === functionalityId && (testCases?.length ?? 0) > 0;
  const isGenerateAiDisabled = isGenerating || hasGeneratedCasesForCurrentFunctionality;
  const visibleTestCases = Array.isArray(testCases)
    ? [...testCases].sort(
        (left, right) => getStableSortOrder(left) - getStableSortOrder(right),
      )
    : [];
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
  const pageStartIndex = (currentPage - 1) * pageSize;
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
    try {
      const { generateTestCasesWithAI } = await import('../services/geminiService');
      const generated = await generateTestCasesWithAI(functionalityName, moduleName, projectId);
      const nextSortOrder = visibleTestCases.length;
      const generatedTestCases: TestCase[] = generated.map((tc, index) => ({
        ...tc,
        id: `TC-AI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId,
        functionalityId,
        isAutomated: false,
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
        message.warning(
          'Configura GEMINI_API_KEY o GROQ_API_KEY en el backend para usar la generacion con IA.',
        );
      } else if (isInvalidKey) {
        message.error(
          isLeakedKey
            ? 'La API Key configurada en el entorno fue reportada como filtrada. Genera una nueva.'
            : 'La API Key configurada en el entorno no es válida.',
        );
      } else {
        message.error('Error al generar casos con IA. Revisa la configuración del proveedor IA.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!canUseAi) {
      message.warning('La generación de casos con IA está disponible en el plan Growth.');
      return;
    }

    const { hasAiProviderConfigured } = await import('../services/geminiService');

    if (!(await hasAiProviderConfigured())) {
      message.warning(
        'Configura GEMINI_API_KEY o GROQ_API_KEY en el backend para usar la generacion con IA.',
      );
      return;
    }

    await runGenerateAI();
  };

  const showModal = (testCase?: TestCase) => {
    if (testCase) {
      setEditingTestCase(testCase);
      form.setFieldsValue(testCase);
    } else {
      setEditingTestCase(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
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
    });
  };

  const onFinish = (values: any) => {
    const nextSortOrder =
      visibleTestCases.length > 0
        ? Math.max(...visibleTestCases.map(testCase => getStableSortOrder(testCase))) + 1
        : 0;
    const newTestCase: TestCase = {
      ...values,
      id: editingTestCase?.id || `TC-${Date.now()}`,
      projectId,
      functionalityId,
      sortOrder: editingTestCase?.sortOrder ?? nextSortOrder,
    };

    save(newTestCase, {
      onSuccess: () => {
        message.success(editingTestCase ? 'Caso de prueba actualizado' : 'Caso de prueba creado');
        setIsModalVisible(false);
        form.resetFields();
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

  const handlePersistReorder = async (reorderedTestCases: TestCase[]) => {
    setIsReordering(true);
    try {
      await saveManyWithSingleRefresh(reorderedTestCases);
      message.success('Orden de casos de prueba actualizado');
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : 'No pudimos actualizar el orden de los casos de prueba.',
      );
    } finally {
      setIsReordering(false);
      setDraggedTestCaseId(null);
      setDragOverTestCaseId(null);
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
    await handlePersistReorder(reorderedTestCases);
  };

  const handleDragStart = (testCaseId: string) => {
    if (isViewer || isReordering) {
      return;
    }

    setDraggedTestCaseId(testCaseId);
    setDragOverTestCaseId(testCaseId);
  };

  const handleDragEnd = () => {
    setDraggedTestCaseId(null);
    setDragOverTestCaseId(null);
  };

  const handleDropOnRow = async (targetTestCaseId: string) => {
    if (!draggedTestCaseId || draggedTestCaseId === targetTestCaseId) {
      handleDragEnd();
      return;
    }

    const fromIndex = visibleTestCases.findIndex(testCase => testCase.id === draggedTestCaseId);
    const toIndex = visibleTestCases.findIndex(testCase => testCase.id === targetTestCaseId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      handleDragEnd();
      return;
    }

    const reorderedTestCases = moveTestCase(visibleTestCases, fromIndex, toIndex);
    await handlePersistReorder(reorderedTestCases);
  };

  const columns = [
    {
      title: '',
      key: 'drag',
      width: 52,
      align: 'center' as const,
      render: () =>
        !isViewer ? (
          <Tooltip title="Arrastra para reordenar">
            <span
              className={`qa-test-case-drag-handle${
                isReordering ? ' qa-test-case-drag-handle--disabled' : ''
              }`}
            >
              <HolderOutlined />
            </span>
          </Tooltip>
        ) : null,
    },
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
      width: 140,
      render: (isAutomated: boolean | undefined) => (
        <Tag color={isAutomated ? 'green' : 'default'}>
          {isAutomated ? 'Automatizado' : 'Manual'}
        </Tag>
      ),
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
      width: 190,
      align: 'center' as const,
      render: (_: any, record: TestCase) => (
        <div className="flex flex-nowrap items-center justify-center gap-1">
          {!isViewer ? (
            <>
              <Tooltip title="Mover arriba">
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUpOutlined />}
                  onClick={() => void handleMoveTestCase(record.id, 'up')}
                  disabled={
                    isReordering || visibleTestCases.findIndex(item => item.id === record.id) === 0
                  }
                  className="!px-1"
                />
              </Tooltip>
              <Tooltip title="Mover abajo">
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDownOutlined />}
                  onClick={() => void handleMoveTestCase(record.id, 'down')}
                  disabled={
                    isReordering ||
                    visibleTestCases.findIndex(item => item.id === record.id) ===
                      visibleTestCases.length - 1
                  }
                  className="!px-1"
                />
              </Tooltip>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                onClick={() => showModal(record)}
                className="!px-1"
              />
              <Tooltip title="Duplicar caso de prueba">
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => handleDuplicate(record)}
                  className="!px-1"
                />
              </Tooltip>
              <Popconfirm
                title="¿Estás seguro de eliminar este caso de prueba?"
                onConfirm={() => handleDelete(record.id)}
                okText="Sí"
                cancelText="No"
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  className="!px-1"
                />
              </Popconfirm>
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
            <Tooltip title={`Casos de Prueba - ${functionalityName}`}>
              <span className="qa-test-case-management-header__title-text">
                Casos de Prueba - {functionalityName}
              </span>
            </Tooltip>
          </div>
          <div className="qa-test-case-management-header__actions">
            {!isViewer ? (
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
                <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
                  Nuevo Caso de Prueba
                </Button>
              </>
            ) : null}
          </div>
        </div>
      }
      className="qa-test-case-management-card shadow-sm"
    >
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

      <Alert
        className="mb-6 rounded-2xl border-sky-100 bg-sky-50/70 shadow-sm"
        type="info"
        showIcon
        message="Utiliza plantillas para estandarizar tus casos de prueba."
        description="Las plantillas se configuran por módulo y permiten acelerar la creación de casos manteniendo consistencia entre funcionalidades."
      />

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
        className="mt-2 qa-test-case-table"
        columns={columns}
        dataSource={visibleTestCases}
        rowKey="id"
        loading={isLoading || isReordering || (isFetching && visibleTestCases.length === 0)}
        pagination={{
          current: currentPage,
          pageSize,
          showTotal: total => `${total} caso${total === 1 ? '' : 's'}`,
          onChange: (page, nextPageSize) => {
            setCurrentPage(page);
            if (typeof nextPageSize === 'number' && nextPageSize !== pageSize) {
              setPageSize(nextPageSize);
            }
          },
        }}
        onRow={(record, index) => {
          const globalIndex = pageStartIndex + (index ?? 0);
          const rowPositionLabel = globalIndex + 1;
          const isDraggedRow = draggedTestCaseId === record.id;
          const isDragOverRow = dragOverTestCaseId === record.id && draggedTestCaseId !== record.id;

          return {
            draggable: !isViewer && !isReordering,
            onDragStart: event => {
              const target = event.target as HTMLElement | null;
              if (!target?.closest('.qa-test-case-drag-handle')) {
                event.preventDefault();
                return;
              }

              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', record.id);
              handleDragStart(record.id);
            },
            onDragEnter: event => {
              event.preventDefault();
              if (!isViewer && draggedTestCaseId && draggedTestCaseId !== record.id) {
                setDragOverTestCaseId(record.id);
              }
            },
            onDragOver: event => {
              if (!isViewer && draggedTestCaseId) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            },
            onDrop: async event => {
              event.preventDefault();
              await handleDropOnRow(record.id);
            },
            onDragEnd: () => {
              handleDragEnd();
            },
            className: [
              !isViewer ? 'qa-test-case-table__draggable-row' : '',
              isDraggedRow ? 'qa-test-case-table__draggable-row--dragging' : '',
              isDragOverRow ? 'qa-test-case-table__draggable-row--over' : '',
            ]
              .filter(Boolean)
              .join(' '),
            'aria-label': !isViewer
              ? `Caso de prueba ${rowPositionLabel}. Arrastra para cambiar su posición.`
              : undefined,
          };
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
                <p className="mt-1">{record.preconditions}</p>
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

      <Modal
        title={editingTestCase ? 'Editar Caso de Prueba' : 'Nuevo Caso de Prueba'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={800}
      >
        <Suspense fallback={<div className="py-3 text-sm text-slate-400">Cargando editor...</div>}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              priority: Priority.MEDIUM,
              testType: TestType.FUNCTIONAL,
              isAutomated: false,
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="title"
                label="Título"
                rules={[{ required: true, message: 'Por favor ingresa el título' }]}
                className="col-span-2"
              >
                <Input placeholder="Ej: Validar login con credenciales correctas" />
              </Form.Item>

              <Form.Item name="templateId" label="Plantilla" className="col-span-2">
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

              <Form.Item name="description" label="Descripción" className="col-span-2">
                <BasicRichTextEditor placeholder="Descripción breve del objetivo de la prueba" />
              </Form.Item>

              <Form.Item
                name="isAutomated"
                label="Automatizado"
                valuePropName="checked"
                className="col-span-2"
              >
                <Switch checkedChildren="Sí" unCheckedChildren="No" disabled={isViewer} />
              </Form.Item>

              <Form.Item name="preconditions" label="Precondiciones" className="col-span-2">
                <TextArea rows={2} placeholder="Estado inicial requerido" />
              </Form.Item>

              <Form.Item
                name="testSteps"
                label="Pasos de Prueba"
                rules={[{ required: true, message: 'Por favor ingresa los pasos' }]}
                className="col-span-2"
              >
                <BasicRichTextEditor
                  placeholder="1. Ingresar a la URL...&#10;2. Escribir usuario...&#10;3. Clic en botón..."
                  minHeightClassName="min-h-[160px]"
                />
              </Form.Item>

              <Form.Item
                name="expectedResult"
                label="Resultado Esperado"
                rules={[{ required: true, message: 'Por favor ingresa el resultado esperado' }]}
                className="col-span-2"
              >
                <BasicRichTextEditor
                  placeholder="El sistema debe mostrar el dashboard..."
                  minHeightClassName="min-h-[120px]"
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
      </Modal>
    </Card>
  );
};

export default TestCaseManagement;
