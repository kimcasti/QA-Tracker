import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Tooltip,
  Upload,
  message,
  Divider,
  Checkbox,
} from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined,
  SearchOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  UploadOutlined,
  DeleteOutlined,
  BugOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useSlackMembers } from '../modules/slack-members/hooks/useSlackMembers';
import { SlackMemberSelect } from '../modules/slack-members/components/SlackMemberSelect';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useSmokeCycles } from '../modules/test-cycles/hooks/useSmokeCycles';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  RegressionCycle,
  TestResult,
  TestType,
  RegressionExecution,
  Severity,
  Environment,
  BugOrigin,
  Priority,
  Functionality,
} from '../types';
import { labelTestResult } from '../i18n/labels';
import { exportCycleToCSV } from '../utils/exportUtils';
import { previewNextInternalBugId, syncBugReport } from '../services/bugTrackerService';
import dayjs from 'dayjs';
import {
  isPayloadTooLargeError,
  readFileAsDataUrl,
  showPayloadTooLargeMessage,
  validateInlineImageFile,
} from '../utils/uploadValidation';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const RECENT_CHANGE_WINDOW_DAYS = 14;

function normalizeSprintName(value?: string) {
  return value?.trim() || undefined;
}

function normalizeSprintKey(value?: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^sprint\s*/i, '');
}

function parseTesterValue(value?: string) {
  if (!value) return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function serializeTesterValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map(item => item.trim()).filter(Boolean).join(', ');
  }

  return value?.trim() || '';
}

function summarizeTesterValue(value?: string) {
  const testers = parseTesterValue(value);
  if (testers.length === 0) return null;
  if (testers.length === 1) {
    return { label: testers[0], tooltip: testers[0] };
  }

  return {
    label: `${testers.length} testers`,
    tooltip: testers.join(', '),
  };
}

function isRecentlyChanged(functionality: Functionality) {
  if (!functionality.lastFunctionalChangeAt) return false;

  const changedAt = dayjs(functionality.lastFunctionalChangeAt);
  return changedAt.isValid() && dayjs().diff(changedAt, 'day') <= RECENT_CHANGE_WINDOW_DAYS;
}

function hasFunctionalTestCases(
  functionalityId: string,
  functionalityIdsWithTestCases: Set<string>,
) {
  return functionalityIdsWithTestCases.has(functionalityId);
}

export default function SmokeCycles({ projectId }: { projectId?: string }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { data: cyclesData, save } = useSmokeCycles(projectId);
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: allTestCases } = useTestCases(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const { isViewer, canManageCycleConfig } = useWorkspaceAccess();

  const cycles = Array.isArray(cyclesData) ? cyclesData : [];
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testCases = Array.isArray(allTestCases) ? allTestCases : [];
  const latestCycle = Array.isArray(cycles) && cycles.length > 0 ? cycles[0] : null;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: slackMembers = [], isLoading: isSlackMembersLoading } =
    useSlackMembers(isModalOpen);
  const [editingCycle, setEditingCycle] = useState<RegressionCycle | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<RegressionCycle | null>(null);
  const [selectedFunctionalityIds, setSelectedFunctionalityIds] = useState<string[]>([]);
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [suggestionModuleFilter, setSuggestionModuleFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  const handleOpenModal = () => {
    setEditingCycle(null);
    setSelectedFunctionalityIds([]);
    setSelectionInitialized(false);
    setSuggestionModuleFilter(undefined);
    form.resetFields();
    // Calculate next Cycle ID
    const nextNumber =
      cycles.length > 0
        ? Math.max(
            ...cycles.map(c => {
              const match = c.cycleId?.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            }),
          ) + 1
        : 1;

    form.setFieldsValue({
      cycleId: `S-${nextNumber.toString().padStart(2, '0')}`,
      sprint: undefined,
      status: 'EN_PROGRESO',
      date: dayjs(),
      note: '',
      tester: [],
      environment: undefined,
      buildVersion: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (cycle: RegressionCycle) => {
    setEditingCycle(cycle);
    setSelectedCycle(cycle);
    setSelectedFunctionalityIds([]);
    setSelectionInitialized(true);
    setSuggestionModuleFilter(undefined);
    form.setFieldsValue({
      cycleId: cycle.cycleId,
      status: cycle.status,
      sprint: normalizeSprintName(cycle.sprint),
      date: dayjs(cycle.date),
      note: cycle.note,
      tester: parseTesterValue(cycle.tester),
      environment: cycle.environment,
      buildVersion: cycle.buildVersion || '',
    });
    setIsModalOpen(true);
  };

  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string | undefined>(undefined);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilter, setDetailFilter] = useState<'ALL' | 'FAILED'>('ALL');

  // Evidence Modal State
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<RegressionExecution | null>(null);
  const [evidenceForm] = Form.useForm();
  const [evidenceImage, setEvidenceImage] = useState<string | undefined>(undefined);

  const isReadOnly = selectedCycle?.status === 'FINALIZADA' || isViewer;
  const isFailureEvidenceRequired = currentExecution?.result === TestResult.FAILED;

  // Sync form values when currentExecution changes
  useEffect(() => {
    if (currentExecution) {
      evidenceForm.setFieldsValue({
        evidence: currentExecution.evidence,
        bugTitle: currentExecution.bugTitle,
        bugId: currentExecution.bugId,
        bugLink: currentExecution.bugLink,
        severity: currentExecution.severity,
      });
      setEvidenceImage(currentExecution.evidenceImage);
    } else {
      evidenceForm.resetFields();
      setEvidenceImage(undefined);
    }
  }, [currentExecution, evidenceForm]);

  useEffect(() => {
    if (
      !currentExecution ||
      currentExecution.result !== TestResult.FAILED ||
      currentExecution.bugId?.trim() ||
      !selectedCycle?.projectId
    ) {
      return;
    }

    void previewNextInternalBugId(
      selectedCycle.projectId,
      selectedCycle.executions
        .filter(execution => execution.id !== currentExecution.id)
        .map(execution => execution.bugId),
    )
      .then(nextBugId => {
        evidenceForm.setFieldValue('bugId', nextBugId);
      })
      .catch(() => undefined);
  }, [currentExecution, evidenceForm, selectedCycle]);

  // Filter smoke functionalities for new cycles
  const smokeFuncs = Array.isArray(functionalities)
    ? functionalities.filter(f => f?.isSmoke || f?.testTypes?.includes(TestType.SMOKE))
    : [];

  const smokeMandatoryFuncs = smokeFuncs.filter(functionality => functionality.isCore);

  const smokeRecommendedFuncs = smokeFuncs.filter(
    functionality =>
      !smokeMandatoryFuncs.some(item => item.id === functionality.id) &&
      isRecentlyChanged(functionality),
  );

  const smokeOptionalFuncs = smokeFuncs.filter(
    functionality =>
      !smokeMandatoryFuncs.some(item => item.id === functionality.id) &&
      !smokeRecommendedFuncs.some(item => item.id === functionality.id),
  );

  const functionalityIdsWithTestCases = new Set(
    testCases.map(item => item.functionalityId).filter(Boolean),
  );

  const smokeModuleOptions = Array.from(new Set(smokeFuncs.map(item => item.module).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(module => ({ label: module, value: module }));

  const filterByModule = (items: Functionality[]) =>
    suggestionModuleFilter ? items.filter(item => item.module === suggestionModuleFilter) : items;

  useEffect(() => {
    if (!isModalOpen || editingCycle || selectionInitialized) return;

    const suggestedIds = Array.from(
      new Set([
        ...smokeMandatoryFuncs.map(item => item.id),
        ...smokeRecommendedFuncs.map(item => item.id),
      ]),
    );

    setSelectedFunctionalityIds(suggestedIds);
    setSelectionInitialized(true);
  }, [editingCycle, isModalOpen, selectionInitialized, smokeMandatoryFuncs, smokeRecommendedFuncs]);

  const renderReasonTags = (functionality: Functionality) => {
    const tags: { label: string; color: string }[] = [];

    if (functionality.isCore) tags.push({ label: 'Core', color: 'blue' });
    if (functionality.priority === Priority.CRITICAL || functionality.priority === Priority.HIGH) {
      tags.push({ label: 'Alta prioridad', color: 'gold' });
    }
    if (isRecentlyChanged(functionality)) {
      tags.push({ label: 'Cambio reciente', color: 'green' });
    }

    return (
      <Space size={[4, 4]} wrap>
        {tags.map(tag => (
          <Tag key={`${functionality.id}-${tag.label}`} color={tag.color} className="m-0">
            {tag.label}
          </Tag>
        ))}
      </Space>
    );
  };

  const renderSuggestionSection = (
    title: string,
    subtitle: string,
    colorClassName: string,
    items: Functionality[],
  ) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-slate-100 ${colorClassName}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
            <p className="text-xs text-slate-500 mb-0">{subtitle}</p>
          </div>
          <Space size={8} wrap>
            {items.filter(item => !hasFunctionalTestCases(item.id, functionalityIdsWithTestCases))
              .length > 0 && (
              <Tag color="orange" className="m-0">
                Sin casos:{' '}
                {
                  items.filter(
                    item => !hasFunctionalTestCases(item.id, functionalityIdsWithTestCases),
                  ).length
                }
              </Tag>
            )}
            <Tag className="m-0">{items.length}</Tag>
          </Space>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {items.map(item => (
            <label
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <Checkbox
                className="mt-1"
                checked={selectedFunctionalityIds.includes(item.id)}
                onChange={event => {
                  setSelectedFunctionalityIds(current =>
                    event.target.checked
                      ? Array.from(new Set([...current, item.id]))
                      : current.filter(id => id !== item.id),
                  );
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                  <Tag className="m-0">{item.module}</Tag>
                  {!hasFunctionalTestCases(item.id, functionalityIdsWithTestCases) && (
                    <Tag color="orange" className="m-0">
                      Sin casos de prueba
                    </Tag>
                  )}
                </div>
                <div className="mt-2">{renderReasonTags(item)}</div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="px-4 py-5 text-sm text-slate-400">
          No hay funcionalidades en esta categoria.
        </div>
      )}
    </div>
  );

  const columns = [
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">CICLO</span>
      ),
      dataIndex: 'cycleId',
      key: 'cycleId',
      render: (text: string, record: RegressionCycle) => (
        <Button
          type="link"
          className="p-0 h-auto font-bold text-orange-600"
          onClick={() => setSelectedCycle(record)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FECHA</span>
      ),
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => (
        <div className="flex flex-col">
          <span className="text-slate-700 font-medium">{dayjs(date).format('DD MMM')}</span>
          <span className="text-slate-400 text-xs">{dayjs(date).format('YYYY')}</span>
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          TOTAL TEST
        </span>
      ),
      dataIndex: 'totalTests',
      key: 'totalTests',
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          APROBADOS
        </span>
      ),
      dataIndex: 'passed',
      key: 'passed',
      render: (val: number) => (
        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold inline-block">
          {val}
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          FALLIDOS
        </span>
      ),
      dataIndex: 'failed',
      key: 'failed',
      render: (val: number) => (
        <div className="bg-red-50 text-red-700 px-3 py-1 rounded-lg font-bold inline-block">
          {val}
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          PENDIENTES
        </span>
      ),
      dataIndex: 'pending',
      key: 'pending',
      render: (val: number) => (
        <div className="bg-slate-50 text-slate-500 px-3 py-1 rounded-lg font-bold inline-block">
          {val || 0}
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          % APROB.
        </span>
      ),
      dataIndex: 'passRate',
      key: 'passRate',
      render: (rate: number) => (
        <div className="flex items-center gap-3 min-w-[120px]">
          <Progress
            percent={rate}
            size="small"
            showInfo={false}
            strokeColor={rate >= 85 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444'}
            trailColor="#f1f5f9"
          />
          <span className="font-bold text-slate-700">{rate}%</span>
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          ACCIONES
        </span>
      ),
      key: 'actions',
      render: (_: any, record: RegressionCycle) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => setSelectedCycle(record)}
            className="rounded-lg border-slate-200 text-slate-600"
          >
            Ver Detalle
          </Button>
          {canManageCycleConfig && !isViewer ? (
            <Button
              icon={<SettingOutlined />}
              onClick={() => handleEdit(record)}
              className="rounded-lg border-slate-200 text-slate-600"
            >
              Editar
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingCycle) {
        const updatedCycle: RegressionCycle = {
          ...editingCycle,
          ...values,
          sprint: normalizeSprintName(values.sprint),
          tester: serializeTesterValue(values.tester),
          date: values.date.format('YYYY-MM-DD'),
        };
        console.log('Payload - Update Smoke Cycle:', updatedCycle);
        const savedCycle = await save(updatedCycle);
        setSelectedCycle(savedCycle);
        message.success('Ciclo de Smoke actualizado correctamente');
      } else {
        const selectedFunctionalities = smokeFuncs.filter(f =>
          selectedFunctionalityIds.includes(f.id),
        );

        if (selectedFunctionalities.length === 0) {
          message.error('Selecciona al menos una funcionalidad para el ciclo de smoke.');
          return;
        }

        // Smoke cycles are executed by functionality, not by individual test case.
        const initialExecutions: RegressionExecution[] = [];

        selectedFunctionalities.forEach(f => {
          initialExecutions.push({
            id: Math.random().toString(36).substr(2, 9),
            functionalityId: f.id,
            module: f.module,
            functionalityName: f.name,
            executed: false,
            result: TestResult.NOT_EXECUTED,
          });
        });

        const newCycle: RegressionCycle = {
          id: Date.now().toString(),
          projectId: projectId || '',
          type: 'SMOKE',
          ...values,
          sprint: normalizeSprintName(values.sprint),
          tester: serializeTesterValue(values.tester),
          date: values.date.format('YYYY-MM-DD'),
          totalTests: initialExecutions.length,
          passed: 0,
          failed: 0,
          blocked: 0,
          pending: initialExecutions.length,
          passRate: 0,
          status: values.status || 'EN_PROGRESO',
          executions: initialExecutions,
        };

        console.log('Payload - Create Smoke Cycle:', newCycle);
        const savedCycle = await save(newCycle);
        setSelectedCycle(savedCycle);
        message.success('Ciclo de Smoke creado correctamente');
      }

      setIsModalOpen(false);
      setEditingCycle(null);
      setSelectedFunctionalityIds([]);
      setSelectionInitialized(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const updateExecution = async (
    cycleId: string,
    executionId: string,
    updates: Partial<RegressionExecution>,
  ) => {
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;

    const updatedExecutions = cycle.executions.map(ex =>
      ex.id === executionId
        ? { ...ex, ...updates, date: updates.executed ? dayjs().format('YYYY-MM-DD') : ex.date }
        : ex,
    );

    const passed = updatedExecutions.filter(ex => ex.result === TestResult.PASSED).length;
    const failed = updatedExecutions.filter(ex => ex.result === TestResult.FAILED).length;
    const blocked = updatedExecutions.filter(ex => ex.result === TestResult.BLOCKED).length;
    const total = updatedExecutions.length;
    const pending = updatedExecutions.filter(ex => !ex.executed).length;
    const rate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

    const updatedCycle: RegressionCycle = {
      ...cycle,
      executions: updatedExecutions,
      passed,
      failed,
      blocked,
      pending,
      passRate: rate,
      // Keep status manual; do not auto-finalize when pending reaches 0.
      status: cycle.status || 'EN_PROGRESO',
    };

    const savedCycle = await save(updatedCycle);
    if (selectedCycle?.id === cycleId) {
      setSelectedCycle(savedCycle);
    }
  };

  const handleExecuteAll = async (cycle: RegressionCycle) => {
    const updatedExecutions = cycle.executions.map(ex => ({
      ...ex,
      executed: true,
      result: TestResult.PASSED,
      date: dayjs().format('YYYY-MM-DD'),
    }));

    const updatedCycle: RegressionCycle = {
      ...cycle,
      executions: updatedExecutions,
      passed: updatedExecutions.length,
      failed: 0,
      blocked: 0,
      pending: 0,
      passRate: 100,
      // Keep status manual; user must finalize explicitly.
      status: cycle.status || 'EN_PROGRESO',
    };

    const savedCycle = await save(updatedCycle);
    setSelectedCycle(savedCycle);
  };

  const handleFinalizeCycle = async (cycle: RegressionCycle) => {
    if (cycle.pending > 0) {
      message.warning('AÃºn hay casos pendientes por ejecutar');
      return;
    }

    const incompleteFailedExecution = (cycle.executions || []).find(
      execution =>
        execution.result === TestResult.FAILED &&
        (!execution.evidence?.trim() || !execution.bugTitle?.trim() || !execution.severity),
    );

    if (incompleteFailedExecution) {
      message.error(
        'No puedes finalizar el ciclo mientras exista una prueba fallida sin notas, titulo del bug o severidad.',
      );
      setSelectedCycle(cycle);
      setCurrentExecution(incompleteFailedExecution);
      setEvidenceModalOpen(true);
      return;
    }

    const updatedCycle: RegressionCycle = {
      ...cycle,
      status: 'FINALIZADA',
    };

    const savedCycle = await save(updatedCycle);
    setSelectedCycle(savedCycle);
    message.success('Ciclo finalizado correctamente');
  };

  const handleReopenCycle = async (cycle: RegressionCycle) => {
    if (!canManageCycleConfig) {
      message.error('Solo Owner y QA Lead pueden reabrir ciclos.');
      return;
    }

    const updatedCycle: RegressionCycle = {
      ...cycle,
      status: 'EN_PROGRESO',
    };

    const savedCycle = await save(updatedCycle);
    setSelectedCycle(savedCycle);
    message.success('Ciclo reabierto (EN PROGRESO)');
  };

  const filteredCycles = (Array.isArray(cycles) ? cycles : []).filter(c => {
    if (!c) return false;
    const matchesSearch =
      (c.cycleId || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (c.note || '').toLowerCase().includes(searchText.toLowerCase());

    const matchesSprint =
      !sprintFilter || normalizeSprintKey(c.sprint) === normalizeSprintKey(sprintFilter);

    const matchesDate =
      !dateRange ||
      !dateRange[0] ||
      !dateRange[1] ||
      (c.date &&
        dayjs(c.date).isValid() &&
        dayjs(c.date).isAfter(dateRange[0].subtract(1, 'day')) &&
        dayjs(c.date).isBefore(dateRange[1].add(1, 'day')));

    return matchesSearch && matchesSprint && matchesDate;
  });

  const sprintOptions = Array.from(new Set(cycles.map(c => c.sprint).filter(Boolean)))
    .sort((a, b) => {
      const numA = parseInt(a?.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b?.match(/\d+/)?.[0] || '0', 10);
      return numB - numA;
    })
    .map(s => ({ value: s, label: s }));

  const filteredExecutions = (selectedCycle?.executions || []).filter(ex => {
    if (!ex) return false;
    const matchesSearch =
      (ex.functionalityId || '').toLowerCase().includes(detailSearch.toLowerCase()) ||
      (ex.module || '').toLowerCase().includes(detailSearch.toLowerCase()) ||
      (ex.functionalityName || '').toLowerCase().includes(detailSearch.toLowerCase());

    const matchesFilter = detailFilter === 'ALL' || ex.result === TestResult.FAILED;

    return matchesSearch && matchesFilter;
  });

  const functionalityLookup = new Map(functionalities.map(item => [item.id, item] as const));

  return (
    <>
      {selectedCycle ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setSelectedCycle(null)}
                className="rounded-xl h-10 w-10 flex items-center justify-center border-slate-200"
              />
              <div>
                <div className="flex items-center gap-3 [&>span]:hidden">
                  <Tag
                    color={selectedCycle.status === 'FINALIZADA' ? 'green' : 'orange'}
                    className={`rounded-full px-3 font-bold uppercase text-[10px] ${!isReadOnly && canManageCycleConfig ? 'cursor-pointer hover:opacity-80' : ''} transition-opacity`}
                    onClick={
                      !isReadOnly && canManageCycleConfig
                        ? () => handleEdit(selectedCycle)
                        : undefined
                    }
                  >
                    {selectedCycle.status === 'FINALIZADA' ? 'Finalizada' : 'En Progreso'}
                  </Tag>
                  <span className="text-slate-400 text-sm">
                    • {selectedCycle.sprint || 'Sin Sprint'}
                  </span>
                  {selectedCycle.tester && (
                    <span className="text-slate-400 text-sm">• {selectedCycle.tester}</span>
                  )}
                  {selectedCycle.environment && (
                    <span className="text-slate-400 text-sm">• {selectedCycle.environment}</span>
                  )}
                  {selectedCycle.buildVersion && (
                    <span className="text-slate-400 text-sm">
                      • Build {selectedCycle.buildVersion}
                    </span>
                  )}
                </div>
                <Title level={2} className="!m-0 uppercase tracking-tight">
                  {selectedCycle.cycleId}
                </Title>
                <Paragraph type="secondary" className="!m-0">
                  {selectedCycle.note}
                </Paragraph>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Tag className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                    <span className="font-semibold text-slate-500">Sprint:</span>{' '}
                    {selectedCycle.sprint || 'Sin Sprint'}
                  </Tag>
                  {(() => {
                    const testerSummary = summarizeTesterValue(selectedCycle.tester);
                    if (!testerSummary) return null;

                    return (
                      <Tooltip title={testerSummary.tooltip}>
                        <Tag className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                          <span className="font-semibold text-slate-500">Tester:</span>{' '}
                          {testerSummary.label}
                        </Tag>
                      </Tooltip>
                    );
                  })()}
                  {selectedCycle.environment && (
                    <Tag className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      <span className="font-semibold text-slate-500">Entorno:</span>{' '}
                      {selectedCycle.environment}
                    </Tag>
                  )}
                  {selectedCycle.buildVersion && (
                    <Tag className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      <span className="font-semibold text-slate-500">Build:</span>{' '}
                      {selectedCycle.buildVersion}
                    </Tag>
                  )}
                </div>
              </div>
            </div>
            <Space size="middle">
              {isReadOnly && canManageCycleConfig && !isViewer && (
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => void handleReopenCycle(selectedCycle)}
                  className="rounded-xl h-11 px-4 border-slate-200 text-slate-600 font-semibold"
                >
                  Reabrir Ciclo
                </Button>
              )}
              {!isReadOnly && canManageCycleConfig && !isViewer && (
                <Button
                  icon={<SettingOutlined />}
                  onClick={() => handleEdit(selectedCycle)}
                  className="rounded-xl h-11 px-4 border-slate-200 text-slate-600 font-semibold"
                >
                  Editar Info
                </Button>
              )}
              <Button
                icon={<FileTextOutlined />}
                className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 font-semibold"
                onClick={() => exportCycleToCSV(selectedCycle)}
              >
                Export Report
              </Button>
              {!isReadOnly && !isViewer && (
                <Tooltip
                  title={
                    selectedCycle.pending > 0 ? 'Ejecute todos los casos antes de finalizar' : ''
                  }
                >
                  <span>
                    <Button
                      type={selectedCycle.pending > 0 ? 'default' : 'primary'}
                      icon={<CheckCircleOutlined />}
                      size="large"
                      disabled={selectedCycle.pending > 0}
                      className={`rounded-xl h-11 px-8 font-bold ${
                        selectedCycle.pending > 0
                          ? 'border-slate-200 bg-slate-100 text-slate-500 shadow-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 border-none text-white shadow-lg shadow-emerald-200'
                      }`}
                  onClick={() => void handleFinalizeCycle(selectedCycle)}
                    >
                      Finalizar Ciclo
                    </Button>
                  </span>
                </Tooltip>
              )}
              {!isReadOnly && !isViewer && (
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  size="large"
                  className="rounded-xl h-11 px-8 shadow-lg shadow-orange-200 font-bold bg-orange-600 border-orange-600 hover:bg-orange-700"
                  onClick={() => void handleExecuteAll(selectedCycle)}
                >
                  Execute All
                </Button>
              )}
            </Space>
          </div>

          <Row gutter={20}>
            <Col span={6}>
              <Card className="rounded-2xl border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <BarChartOutlined className="text-slate-400 text-xl" />
                  </div>
                  <div>
                    <Text
                      type="secondary"
                      className="text-[11px] font-bold uppercase tracking-wider"
                    >
                      Total Tests
                    </Text>
                    <div className="text-2xl font-bold text-slate-800 leading-none mt-1">
                      {selectedCycle.totalTests}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="rounded-2xl border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                    <CheckCircleOutlined className="text-emerald-500 text-xl" />
                  </div>
                  <div>
                    <Text
                      type="secondary"
                      className="text-[11px] font-bold uppercase tracking-wider"
                    >
                      Approved
                    </Text>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold text-emerald-600 leading-none">
                        {selectedCycle.passed}
                      </span>
                      <span className="text-xs text-emerald-500 font-bold">
                        (
                        {selectedCycle.totalTests > 0
                          ? Math.round((selectedCycle.passed / selectedCycle.totalTests) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="rounded-2xl border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                    <CloseCircleOutlined className="text-red-500 text-xl" />
                  </div>
                  <div>
                    <Text
                      type="secondary"
                      className="text-[11px] font-bold uppercase tracking-wider"
                    >
                      Failed
                    </Text>
                    <div className="text-2xl font-bold text-red-600 leading-none mt-1">
                      {selectedCycle.failed}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="rounded-2xl border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                    <ClockCircleOutlined className="text-amber-500 text-xl" />
                  </div>
                  <div>
                    <Text
                      type="secondary"
                      className="text-[11px] font-bold uppercase tracking-wider"
                    >
                      Pending
                    </Text>
                    <div className="text-2xl font-bold text-amber-600 leading-none mt-1">
                      {selectedCycle.pending}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4 flex-1 max-w-md">
                <Input
                  prefix={<SearchOutlined className="text-slate-400" />}
                  placeholder="Search by Module or Functionality..."
                  className="h-11 rounded-xl bg-slate-50 border-none"
                  value={detailSearch}
                  onChange={e => setDetailSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type={detailFilter === 'ALL' ? 'primary' : 'default'}
                  className="rounded-lg h-9"
                  onClick={() => setDetailFilter('ALL')}
                >
                  All
                </Button>
                <Button
                  type={detailFilter === 'FAILED' ? 'primary' : 'default'}
                  className="rounded-lg h-9"
                  onClick={() => setDetailFilter('FAILED')}
                >
                  Failed Only
                </Button>
              </div>
            </div>

            <Table
              dataSource={filteredExecutions}
              rowKey="id"
              pagination={false}
              className="regression-table"
              columns={[
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">MODULO</span>
                  ),
                  dataIndex: 'module',
                  key: 'module',
                  render: m => <span className="font-bold text-slate-800">{m}</span>,
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      FUNCIONALIDAD
                    </span>
                  ),
                  dataIndex: 'functionalityName',
                  key: 'name',
                  render: (n, record) => {
                    const functionality = functionalityLookup.get(record.functionalityId);

                    return (
                      <div>
                        <div className="text-slate-800 font-medium">{n}</div>
                        {functionality && (
                          <div className="mt-2">{renderReasonTags(functionality)}</div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      EJECUTADO
                    </span>
                  ),
                  dataIndex: 'executed',
                  key: 'executed',
                  align: 'center',
                  render: (executed, record) => (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${!isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'} transition-colors ${executed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}
                      onClick={
                        !isReadOnly
                          ? () =>
                              updateExecution(selectedCycle.id, record.id, {
                                executed: !executed,
                                result: !executed ? TestResult.PASSED : TestResult.NOT_EXECUTED,
                              })
                          : undefined
                      }
                    >
                      <CheckCircleOutlined />
                    </div>
                  ),
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">FECHA</span>
                  ),
                  dataIndex: 'date',
                  key: 'date',
                  render: d => (
                    <span className="text-slate-400">
                      {d ? dayjs(d).format('DD MMM, YYYY') : '—'}
                    </span>
                  ),
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      RESULTADO
                    </span>
                  ),
                  dataIndex: 'result',
                  key: 'result',
                  render: (result, record) => (
                    <div className="flex flex-col gap-1">
                      <Select
                        value={result}
                        onChange={val =>
                          updateExecution(selectedCycle.id, record.id, {
                            result: val,
                            executed: val !== TestResult.NOT_EXECUTED,
                          })
                        }
                        className="w-32"
                        variant="borderless"
                        disabled={isReadOnly}
                        dropdownStyle={{ borderRadius: '12px' }}
                        options={Object.values(TestResult).map(r => ({
                          label: (
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  r === TestResult.PASSED
                                    ? 'bg-emerald-500'
                                    : r === TestResult.FAILED
                                      ? 'bg-red-500'
                                      : r === TestResult.BLOCKED
                                        ? 'bg-amber-500'
                                        : 'bg-slate-300'
                                }`}
                              />
                              <span
                                className={
                                  r === TestResult.PASSED
                                    ? 'text-emerald-600'
                                    : r === TestResult.FAILED
                                      ? 'text-red-600'
                                      : r === TestResult.BLOCKED
                                        ? 'text-amber-600'
                                        : 'text-slate-400'
                                }
                              >
                                {labelTestResult(r, t)}
                              </span>
                            </div>
                          ),
                          value: r,
                        }))}
                      />
                      {(() => {
                        const raw = (record.bugLink || record.bugId || '').trim();
                        if (!raw) return null;

                        const isUrl = /^https?:\/\//i.test(raw) || /^www\./i.test(raw);
                        const href = isUrl
                          ? raw.startsWith('http')
                            ? raw
                            : `https://${raw}`
                          : null;
                        const label = (record.bugId || raw).trim();

                        return (
                          <Tag
                            color="magenta"
                            icon={<BugOutlined />}
                            className="text-[10px] m-0 w-fit"
                          >
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-inherit underline"
                                onClick={e => e.stopPropagation()}
                              >
                                {label}
                              </a>
                            ) : (
                              label
                            )}
                          </Tag>
                        );
                      })()}
                    </div>
                  ),
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      EVIDENCIA
                    </span>
                  ),
                  dataIndex: 'evidence',
                  key: 'evidence',
                  render: (ev, record) => (
                    <div className="flex items-center gap-2 text-orange-500 cursor-pointer hover:text-orange-700 font-medium">
                      {ev || record.evidenceImage ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={e => {
                            e.stopPropagation();
                            setCurrentExecution(record);
                            setEvidenceModalOpen(true);
                          }}
                        >
                          <EyeOutlined /> <span>View</span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1 text-slate-400"
                          onClick={e => {
                            e.stopPropagation();
                            setCurrentExecution(record);
                            setEvidenceModalOpen(true);
                          }}
                        >
                          <PlusOutlined /> <span>Note</span>
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <Title level={2} className="!mb-1">
                Control de Smoke
              </Title>
              <Paragraph type="secondary">
                Gestión y seguimiento de pruebas críticas de humo.
              </Paragraph>
              {isViewer && (
                <Space size={[8, 8]} wrap>
                  <Tag color="default" className="rounded-full px-3 py-1 font-semibold">
                    Solo lectura
                  </Tag>
                  <Text type="secondary">
                    Puedes consultar ciclos y resultados, pero no editar ni ejecutar acciones.
                  </Text>
                </Space>
              )}
            </div>
            {!isViewer && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              className="rounded-xl h-12 px-6 shadow-lg shadow-orange-200 bg-orange-600 border-orange-600 hover:bg-orange-700"
              onClick={handleOpenModal}
            >
              Nuevo Ciclo de Smoke
            </Button>
            )}
          </div>

          {latestCycle && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                  <BarChartOutlined className="text-white" />
                </div>
                <span className="font-bold text-slate-800 text-lg">Último Smoke Test</span>
                <Tag
                  color="orange"
                  className="rounded-full px-3 font-bold border-orange-200 bg-orange-50 text-orange-600"
                >
                  {latestCycle.cycleId} (FINALIZADA)
                </Tag>
              </div>

              <Row gutter={16}>
                <Col span={5}>
                  <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text
                          type="secondary"
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Total Tests
                        </Text>
                        <div className="text-3xl font-bold text-slate-800 mt-1">
                          {latestCycle.totalTests}
                        </div>
                      </div>
                      <Tag
                        color="orange"
                        className="m-0 border-none bg-orange-50 text-orange-600 font-bold rounded-full px-3"
                      >
                        Total
                      </Tag>
                    </div>
                  </Card>
                </Col>
                <Col span={5}>
                  <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text
                          type="secondary"
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Aprobados
                        </Text>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-3xl font-bold text-emerald-600">
                            {latestCycle.passed}
                          </span>
                        </div>
                      </div>
                      <Tag
                        color="green"
                        className="m-0 border-none bg-emerald-50 text-emerald-500 font-bold rounded-full px-3"
                      >
                        {latestCycle.totalTests > 0
                          ? Math.round((latestCycle.passed / latestCycle.totalTests) * 100)
                          : 0}
                        %
                      </Tag>
                    </div>
                  </Card>
                </Col>
                <Col span={5}>
                  <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text
                          type="secondary"
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Fallidos
                        </Text>
                        <div className="text-3xl font-bold text-red-600 mt-1">
                          {latestCycle.failed}
                        </div>
                      </div>
                      <Tag
                        color="red"
                        className="m-0 border-none bg-rose-50 text-rose-500 font-bold rounded-full px-3"
                      >
                        {latestCycle.totalTests > 0
                          ? Math.round((latestCycle.failed / latestCycle.totalTests) * 100)
                          : 0}
                        %
                      </Tag>
                    </div>
                  </Card>
                </Col>
                <Col span={5}>
                  <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text
                          type="secondary"
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Bloqueados
                        </Text>
                        <div className="text-3xl font-bold text-amber-600 mt-1">
                          {latestCycle.blocked || 0}
                        </div>
                      </div>
                      <Tag
                        color="orange"
                        className="m-0 border-none bg-amber-50 text-amber-500 font-bold rounded-full px-3"
                      >
                        {latestCycle.totalTests > 0
                          ? Math.round(((latestCycle.blocked || 0) / latestCycle.totalTests) * 100)
                          : 0}
                        %
                      </Tag>
                    </div>
                  </Card>
                </Col>
                <Col span={4}>
                  <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text
                          type="secondary"
                          className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Aprobación
                        </Text>
                        <div className="text-3xl font-bold text-orange-600 mt-1">
                          {latestCycle.passRate}%
                        </div>
                      </div>
                      <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                        <BarChartOutlined className="text-orange-600" />
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <Row gutter={16} align="bottom">
              <Col span={8}>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Rango de Fecha
                  </span>
                  <RangePicker
                    className="w-full h-10 rounded-lg"
                    value={dateRange}
                    onChange={val => setDateRange(val as any)}
                  />
                </div>
              </Col>
              <Col span={6}>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Sprint
                  </span>
                  <Select
                    placeholder="Todos los Sprints"
                    className="w-full h-10 rounded-lg"
                    allowClear
                    value={sprintFilter}
                    onChange={setSprintFilter}
                    options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                  />
                </div>
              </Col>
              <Col span={6}>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Buscar Ciclo
                  </span>
                  <Input
                    prefix={<SearchOutlined className="text-slate-400" />}
                    placeholder="ID del ciclo..."
                    className="h-10 rounded-lg"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                  />
                </div>
              </Col>
              <Col span={4}>
                <Button
                  className="h-10 w-full rounded-lg text-slate-500"
                  onClick={() => {
                    setSearchText('');
                    setDateRange(null);
                    setSprintFilter(undefined);
                  }}
                >
                  Limpiar
                </Button>
              </Col>
            </Row>
          </Card>

          <Card
            className="rounded-2xl border-slate-100 shadow-sm"
            title={<span className="text-slate-800 font-bold">Historial de Smoke Tests</span>}
          >
            <Table
              columns={columns}
              dataSource={filteredCycles}
              rowKey="id"
              pagination={{
                pageSize: 5,
                showTotal: (total, range) =>
                  `Mostrando ${range[0]}-${range[1]} de ${total} registros`,
              }}
              className="executive-table"
            />
          </Card>
        </div>
      )}

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            {editingCycle ? 'Editar Ciclo de Smoke' : 'Registrar Nuevo Ciclo de Smoke'}
          </span>
        }
        open={isModalOpen}
        onOk={!isViewer ? handleSave : undefined}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingCycle(null);
          setSelectedFunctionalityIds([]);
          setSelectionInitialized(false);
        }}
        width={800}
        centered
        okText={editingCycle ? 'Guardar Cambios' : 'Crear Ciclo y Comenzar'}
        cancelText="Cancelar"
        className="executive-modal"
        okButtonProps={{ style: { display: isViewer ? 'none' : undefined } }}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
          initialValues={{ date: dayjs(), status: 'EN_PROGRESO' }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="cycleId"
                label={<span className="font-semibold text-slate-600">ID del Ciclo</span>}
                rules={[{ required: true }]}
              >
                <Input placeholder="Ej: S-01" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="status"
                label={<span className="font-semibold text-slate-600">Estado</span>}
                rules={[{ required: true }]}
              >
                <Select className="h-10 rounded-lg">
                  <Select.Option value="EN_PROGRESO">EN PROGRESO</Select.Option>
                  <Select.Option value="FINALIZADA">FINALIZADA</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="date"
                label={<span className="font-semibold text-slate-600">Fecha de Inicio</span>}
                rules={[{ required: true }]}
              >
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sprint"
                label={<span className="font-semibold text-slate-600">Sprint</span>}
                rules={[{ required: true, message: 'Selecciona un sprint' }]}
              >
                <Select
                  placeholder="Selecciona Sprint"
                  className="h-10 rounded-lg"
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label={
                  <span className="font-semibold text-slate-600">Funcionalidades a Incluir</span>
                }
              >
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-orange-600 font-bold">
                    {editingCycle ? selectedCycle?.executions?.length || 0 : selectedFunctionalityIds.length}
                  </span>{' '}
                  funcionalidades sugeridas/seleccionadas para
                  <Tag color="orange" className="m-0 ml-1">
                    Smoke
                  </Tag>
                  .
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="tester"
                label={<span className="font-semibold text-slate-600">Tester</span>}
                rules={[{ required: true }]}
              >
                <SlackMemberSelect
                  members={slackMembers}
                  valueField="fullName"
                  multiple
                  placeholder="Selecciona uno o mas testers desde Slack"
                  className="h-10 rounded-lg"
                  loading={isSlackMembersLoading}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="environment"
                label={<span className="font-semibold text-slate-600">Environment</span>}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Selecciona Environment"
                  className="h-10 rounded-lg"
                  options={[
                    { label: Environment.TEST, value: Environment.TEST },
                    { label: Environment.LOCAL, value: Environment.LOCAL },
                    { label: Environment.PRODUCTION, value: Environment.PRODUCTION },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="buildVersion"
                label={<span className="font-semibold text-slate-600">Build version</span>}
              >
                <Input placeholder="Ej: v1.2.3 (1234)" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="note"
            label={<span className="font-semibold text-slate-600">Objetivo del Smoke Test</span>}
          >
            <Input.TextArea
              rows={3}
              placeholder="Ej: Validar flujos críticos después de despliegue en staging..."
              className="rounded-lg"
            />
          </Form.Item>

          {!editingCycle ? (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">
                  Sugerencia Automatica de Funcionalidades
                </span>
                <Space size={8} wrap>
                  <Button
                    size="small"
                    onClick={() =>
                      setSelectedFunctionalityIds(
                        Array.from(
                          new Set([
                            ...smokeMandatoryFuncs.map(item => item.id),
                            ...smokeRecommendedFuncs.map(item => item.id),
                          ]),
                        ),
                      )
                    }
                  >
                    Aplicar sugeridas
                  </Button>
                  <Button size="small" onClick={() => setSelectedFunctionalityIds([])}>
                    Limpiar
                  </Button>
                  <Select
                    allowClear
                    size="small"
                    placeholder="Filtrar por modulo"
                    className="min-w-[180px]"
                    value={suggestionModuleFilter}
                    onChange={value => setSuggestionModuleFilter(value)}
                    options={smokeModuleOptions}
                  />
                </Space>
              </div>

              <Space direction="vertical" size={12} className="w-full">
                {renderSuggestionSection(
                  'Obligatorias',
                  'Funcionalidades core marcadas para smoke.',
                  'bg-orange-50',
                  filterByModule(smokeMandatoryFuncs),
                )}
                {renderSuggestionSection(
                  'Recomendadas',
                  'Funcionalidades con cambio reciente para revisar en el smoke.',
                  'bg-amber-50',
                  filterByModule(smokeRecommendedFuncs),
                )}
                {renderSuggestionSection(
                  'Opcionales',
                  'Cobertura adicional para ampliar la validación rápida.',
                  'bg-slate-50',
                  filterByModule(smokeOptionalFuncs),
                )}
              </Space>
            </div>
          ) : (
            <div className="mt-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-3">
                Vista Previa de Funcionalidades
              </span>
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-100">
                <Table
                  dataSource={Array.from(
                    new Map(
                      (selectedCycle?.executions || []).map(execution => [
                        execution.functionalityId,
                        {
                          id: execution.functionalityId,
                          module: execution.module,
                          name: execution.functionalityName,
                        },
                      ]),
                    ).values(),
                  )}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'Módulo',
                      dataIndex: 'module',
                      key: 'module',
                      render: m => <span className="text-xs font-bold text-slate-700">{m}</span>,
                    },
                    {
                      title: 'Funcionalidad',
                      dataIndex: 'name',
                      key: 'name',
                      render: n => <span className="text-xs text-slate-500">{n}</span>,
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </Form>
      </Modal>

      {/* Evidence Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-orange-500" />
            <span className="text-lg font-bold text-slate-800">Evidencia de Ejecución</span>
          </div>
        }
        open={evidenceModalOpen}
        onOk={async () => {
          try {
            if (currentExecution && selectedCycle) {
              const values = await evidenceForm.validateFields();

              const evidencePayload = {
                evidence: values.evidence,
                evidenceImage: evidenceImage,
                bugTitle: values.bugTitle,
                bugId: values.bugId,
                bugLink: values.bugLink,
                severity: values.severity,
              };

              let linkedBugId = currentExecution.linkedBugId;
              if (currentExecution.result === TestResult.FAILED) {
                const syncedBug = await syncBugReport({
                  linkedBugId: currentExecution.linkedBugId,
                  internalBugId: values.bugId,
                  title: values.bugTitle,
                  description: values.evidence,
                  severity: values.severity,
                  bugLink: values.bugLink,
                  evidenceImage,
                  origin: BugOrigin.SMOKE_CYCLE,
                  projectId: selectedCycle.projectId,
                  functionalityId: currentExecution.functionalityId,
                  functionalityName: currentExecution.functionalityName,
                  module: currentExecution.module,
                  sprint: selectedCycle.sprint,
                  cycleId: selectedCycle.cycleId,
                  reportedBy: selectedCycle.tester,
                  executionId: currentExecution.id,
                });
                linkedBugId = syncedBug?.internalBugId;
                if (syncedBug) {
                  await queryClient.invalidateQueries({
                    queryKey: ['bugs', selectedCycle.projectId],
                  });
                }
              }

              console.log('Payload - Save Smoke Evidence:', {
                executionId: currentExecution.id,
                ...evidencePayload,
              });
              await updateExecution(selectedCycle.id, currentExecution.id, {
                ...evidencePayload,
                linkedBugId,
              });
              message.success('Evidencia guardada correctamente');
              setEvidenceModalOpen(false);
              setCurrentExecution(null);
            }
          } catch (error) {
            console.error('Error saving evidence:', error);
            if (isPayloadTooLargeError(error)) {
              showPayloadTooLargeMessage();
              return;
            }
            message.error('Error al guardar la evidencia. Por favor revisa los campos.');
          }
        }}
        onCancel={() => {
          setEvidenceModalOpen(false);
          setCurrentExecution(null);
        }}
        width={600}
        centered
        okText="Guardar Evidencia"
        cancelText="Cerrar"
        footer={
          isReadOnly
            ? [
                <Button key="close" onClick={() => setEvidenceModalOpen(false)}>
                  Cerrar
                </Button>,
              ]
            : undefined
        }
        className="evidence-modal"
      >
        <div className="space-y-6 py-4">
          {currentExecution && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Row gutter={16}>
                <Col span={12}>
                  <Text
                    type="secondary"
                    className="text-[10px] font-bold uppercase tracking-wider block"
                  >
                    ID Test
                  </Text>
                  <Text strong className="text-orange-600">
                    {currentExecution.functionalityId}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text
                    type="secondary"
                    className="text-[10px] font-bold uppercase tracking-wider block"
                  >
                    Módulo
                  </Text>
                  <Text strong className="text-slate-700">
                    {currentExecution.module}
                  </Text>
                </Col>
              </Row>
              <div className="mt-3">
                <Text
                  type="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider block"
                >
                  Funcionalidad
                </Text>
                <Text strong className="text-slate-800">
                  {currentExecution.functionalityName}
                </Text>
              </div>
            </div>
          )}

          <Form form={evidenceForm} layout="vertical">
            <Form.Item
              name="evidence"
              label={<span className="font-semibold text-slate-600">Notas / Observaciones</span>}
              rules={
                isFailureEvidenceRequired
                  ? [{ required: true, message: 'Las notas de ejecucion son obligatorias.' }]
                  : undefined
              }
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe el resultado de la prueba, errores encontrados o detalles relevantes..."
                className="rounded-xl border-slate-200 focus:border-orange-500"
                disabled={isReadOnly}
              />
            </Form.Item>

            <Divider titlePlacement="left" className="!m-0 !mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Reporte de Bug
              </span>
            </Divider>

            <Form.Item
              name="bugTitle"
              label="Titulo del bug"
              rules={
                isFailureEvidenceRequired
                  ? [{ required: true, message: 'El titulo del bug es obligatorio.' }]
                  : undefined
              }
            >
              <Input
                placeholder="Resume el error detectado"
                className="rounded-lg"
                disabled={isReadOnly}
              />
            </Form.Item>

            <Row gutter={16}>
              <Form.Item name="bugId" hidden>
                <Input />
              </Form.Item>
              <Col span={24}>
                <Form.Item
                  name="severity"
                  label="Severidad"
                  rules={
                    isFailureEvidenceRequired
                      ? [{ required: true, message: 'La severidad es obligatoria.' }]
                      : undefined
                  }
                >
                  <Select
                    placeholder="Selecciona severidad"
                    className="rounded-lg"
                    disabled={isReadOnly}
                  >
                    {Object.values(Severity).map(s => (
                      <Select.Option key={s} value={s}>
                        {s}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="bugLink" label="Link al Bug">
                  <Input placeholder="https://..." className="rounded-lg" disabled={isReadOnly} />
                </Form.Item>
              </Col>
            </Row>

            <Text type="secondary" className="text-[11px] block -mt-2 mb-3">
              Al guardar una prueba fallida, este bug tambien se registrara automaticamente en el
              Historial de Bugs con estado Pendiente.
            </Text>

            <Form.Item
              label={
                <span className="font-semibold text-slate-600">Evidencia Visual (Imagen)</span>
              }
            >
              <div className="mt-2">
                {evidenceImage ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={evidenceImage}
                      alt="Evidencia"
                      className="w-full h-auto max-h-64 object-contain bg-slate-100"
                    />
                    {!isReadOnly && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => setEvidenceImage(undefined)}
                          className="rounded-lg"
                        >
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Upload.Dragger
                    maxCount={1}
                    showUploadList={false}
                    disabled={isReadOnly}
                    beforeUpload={file => {
                      if (!validateInlineImageFile(file)) return false;
                      void readFileAsDataUrl(file).then(base64 => {
                        setEvidenceImage(base64);
                      });
                      return false;
                    }}
                    className="rounded-xl"
                  >
                    <div className="py-4">
                      <p className="ant-upload-drag-icon">
                        <UploadOutlined className="text-orange-500 text-3xl" />
                      </p>
                      <p className="ant-upload-text font-medium text-slate-600">
                        Haz clic o arrastra una imagen aquí
                      </p>
                      <p className="ant-upload-hint text-xs text-slate-400">
                        Soporta JPG, PNG. Máximo 1 archivo.
                      </p>
                    </div>
                  </Upload.Dragger>
                )}
              </div>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </>
  );
}
