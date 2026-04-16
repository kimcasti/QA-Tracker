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
  SaveOutlined,
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import type { FilterValue } from 'antd/es/table/interface';
import { useTranslation } from 'react-i18next';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useSlackMembers } from '../modules/slack-members/hooks/useSlackMembers';
import { SlackMemberSelect } from '../modules/slack-members/components/SlackMemberSelect';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useRegressionCycles } from '../modules/test-cycles/hooks/useRegressionCycles';
import { saveTestCycleExecution } from '../modules/test-cycles/services/testCyclesService';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { useAuthSession } from '../modules/auth/context/AuthSessionProvider';
import {
  buildModuleAssignmentState,
  canEditAssignedExecution,
  getCycleTesterAssignmentValue,
  groupItemsByModule,
  normalizeModuleAssignmentKey,
  resolveAssignmentSelection,
  resolveCycleTesterAssignments,
  resolveSelectedTesterAssignment,
} from '../modules/test-cycles/utils/executionIntegrity';
import {
  RegressionCycle,
  TestResult,
  TestType,
  RegressionExecution,
  Severity,
  Environment,
  ExecutionMode,
  BugOrigin,
  Priority,
  RiskLevel,
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

function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;

  const candidate = error as {
    message?: string;
    response?: {
      data?: {
        error?: {
          message?: string;
        };
      };
    };
  };

  return candidate.response?.data?.error?.message || candidate.message;
}

function isExecutionConflictError(error: unknown) {
  const message = getApiErrorMessage(error) || '';

  return (
    message.includes(
      'This execution already contains progress. Refresh the cycle before making destructive changes.',
    ) ||
    message.includes('This execution was updated by another tester. Refresh the cycle before saving again.')
  );
}

function isRecentlyChanged(functionality: Functionality) {
  if (!functionality.lastFunctionalChangeAt) return false;

  const changedAt = dayjs(functionality.lastFunctionalChangeAt);
  return changedAt.isValid() && dayjs().diff(changedAt, 'day') <= RECENT_CHANGE_WINDOW_DAYS;
}

function getExecutionModeLabel(mode?: ExecutionMode) {
  return mode || ExecutionMode.MANUAL;
}

function hasFunctionalTestCases(
  functionalityId: string,
  functionalityIdsWithTestCases: Set<string>,
) {
  return functionalityIdsWithTestCases.has(functionalityId);
}

export default function RegressionCycles({ projectId }: { projectId?: string }) {
  type NativeCycleTableFilterState = {
    cycleId: React.Key[] | null;
    date: React.Key[] | null;
    sprint: React.Key[] | null;
    status: React.Key[] | null;
  };

  const queryClient = useQueryClient();
  const testCyclesQueryKey = ['test-cycles', 'regression', projectId] as const;
  const { t } = useTranslation();
  const { data: cyclesData, save, isSaving } = useRegressionCycles(projectId);
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: allTestCases } = useTestCases(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const { user } = useAuthSession();
  const { isViewer, canManageCycleConfig } = useWorkspaceAccess();

  const cycles = Array.isArray(cyclesData) ? cyclesData : [];
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testCases = Array.isArray(allTestCases) ? allTestCases : [];
  const latestCycle = Array.isArray(cycles) && cycles.length > 0 ? cycles[0] : null;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: slackMembers = [], isLoading: isSlackMembersLoading } =
    useSlackMembers(isModalOpen);
  const [editingCycle, setEditingCycle] = useState<RegressionCycle | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedFunctionalityIds, setSelectedFunctionalityIds] = useState<string[]>([]);
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, string | undefined>>({});
  const [moduleAssignmentSelections, setModuleAssignmentSelections] = useState<
    Record<string, string | undefined>
  >({});
  const [suggestionModuleFilter, setSuggestionModuleFilter] = useState<string | undefined>(undefined);
  const [executionDrafts, setExecutionDrafts] = useState<Record<string, Partial<RegressionExecution>>>({});
  const [savingExecutionIds, setSavingExecutionIds] = useState<string[]>([]);
  const [form] = Form.useForm();
  const selectedCycle = selectedCycleId ? cycles.find(cycle => cycle.id === selectedCycleId) || null : null;
  const [tableFilters, setTableFilters] = useState<NativeCycleTableFilterState>({
    cycleId: null,
    date: null,
    sprint: null,
    status: null,
  });
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilter, setDetailFilter] = useState<'ALL' | 'FAILED'>('ALL');

  // Evidence Modal State
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<RegressionExecution | null>(null);
  const [evidenceForm] = Form.useForm();
  const [evidenceImage, setEvidenceImage] = useState<string | undefined>(undefined);
  const selectedTesterValues = (Form.useWatch('tester', form) as string[] | undefined) || [];
  const availableTesterAssignments = resolveCycleTesterAssignments(selectedTesterValues, slackMembers);
  const availableTesterOptions = availableTesterAssignments.map(assignment => ({
    label: assignment.name,
    value: getCycleTesterAssignmentValue(assignment),
  }));
  const editingExecutionGroups = groupItemsByModule(selectedCycle?.executions || []);
  const getEffectiveAssignmentSelection = (
    itemId: string,
    moduleName: string,
    fallbackSelection?: string,
  ) =>
    resolveAssignmentSelection(
      assignmentSelections[itemId],
      moduleAssignmentSelections[normalizeModuleAssignmentKey(moduleName)],
      fallbackSelection,
    );
  const handleModuleAssignmentChange = (moduleName: string, value?: string) => {
    const moduleKey = normalizeModuleAssignmentKey(moduleName);
    setModuleAssignmentSelections(current => ({
      ...current,
      [moduleKey]: value,
    }));
  };
  const handleItemAssignmentChange = (itemId: string, moduleName: string, value?: string) => {
    const moduleKey = normalizeModuleAssignmentKey(moduleName);
    setAssignmentSelections(current => ({
      ...current,
      [itemId]: value && value !== moduleAssignmentSelections[moduleKey] ? value : undefined,
    }));
  };

  const isReadOnly = selectedCycle?.status === 'FINALIZADA' || isViewer;
  const isFailureEvidenceRequired = currentExecution?.result === TestResult.FAILED;
  const currentUserEmail = user?.email || null;
  const currentUserName = user?.username || null;

  const canEditExecutionRecord = (execution: RegressionExecution) =>
    !isReadOnly &&
    canEditAssignedExecution(
      execution,
      currentUserEmail,
      canManageCycleConfig,
      currentUserName,
    );

  const getExecutionAssignmentLabel = (execution: RegressionExecution) =>
    execution.assignedTesterName || execution.assignedTesterEmail || null;
  const isCurrentExecutionReadOnly = currentExecution ? !canEditExecutionRecord(currentExecution) : isReadOnly;

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

  // Filter regression functionalities for new cycles
  const regressionFuncs = Array.isArray(functionalities)
    ? functionalities.filter(f => f?.isRegression || f?.testTypes?.includes(TestType.REGRESSION))
    : [];

  const regressionMandatoryFuncs = regressionFuncs.filter(
    functionality =>
      functionality.isCore ||
      (functionality.priority === Priority.CRITICAL ||
        functionality.priority === Priority.HIGH ||
        functionality.riskLevel === RiskLevel.HIGH),
  );

  const regressionRecommendedFuncs = regressionFuncs.filter(
    functionality =>
      !regressionMandatoryFuncs.some(item => item.id === functionality.id) &&
      isRecentlyChanged(functionality),
  );

  const getSuggestedFunctionalityIds = () =>
    Array.from(
      new Set([
        ...regressionMandatoryFuncs.map(item => item.id),
        ...regressionRecommendedFuncs.map(item => item.id),
      ]),
    );

  const regressionOptionalFuncs = regressionFuncs.filter(
    functionality =>
      !regressionMandatoryFuncs.some(item => item.id === functionality.id) &&
      !regressionRecommendedFuncs.some(item => item.id === functionality.id),
  );

  const functionalityIdsWithTestCases = new Set(
    testCases.map(item => item.functionalityId).filter(Boolean),
  );

  const regressionModuleOptions = Array.from(
    new Set(regressionFuncs.map(item => item.module).filter(Boolean)),
  )
    .sort((a, b) => a.localeCompare(b))
    .map(module => ({ label: module, value: module }));

  const filterByModule = (items: Functionality[]) =>
    suggestionModuleFilter ? items.filter(item => item.module === suggestionModuleFilter) : items;

  const resetCycleModal = () => {
    setIsModalOpen(false);
    setEditingCycle(null);
    setSelectedFunctionalityIds([]);
    setAssignmentSelections({});
    setModuleAssignmentSelections({});
    setSuggestionModuleFilter(undefined);
    form.resetFields();
  };

  const handleOpenModal = () => {
    resetCycleModal();
    const nextNumber =
      cycles.length > 0
        ? Math.max(
            ...cycles.map(c => {
              const match = c.cycleId?.match(/\d+/);
              return match ? parseInt(match[0], 10) : 0;
            }),
          ) + 1
        : 1;

    setSelectedFunctionalityIds(getSuggestedFunctionalityIds());
    setAssignmentSelections({});
    setModuleAssignmentSelections({});
    form.setFieldsValue({
      cycleId: `C-${nextNumber.toString().padStart(2, '0')}`,
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
    const assignmentState = buildModuleAssignmentState(cycle.executions);
    setEditingCycle(cycle);
    setSelectedCycleId(cycle.id); // Show the detail view in the background
    setSelectedFunctionalityIds([]);
    setAssignmentSelections(assignmentState.itemSelections);
    setModuleAssignmentSelections(assignmentState.moduleSelections);
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

  const renderReasonTags = (functionality: Functionality) => {
    const tags: { label: string; color: string }[] = [];

    if (functionality.isCore) tags.push({ label: 'Core', color: 'blue' });
    if (functionality.priority === Priority.CRITICAL || functionality.priority === Priority.HIGH) {
      tags.push({ label: 'Alta prioridad', color: 'gold' });
    }
    if (functionality.riskLevel === RiskLevel.HIGH) {
      tags.push({ label: 'Riesgo alto', color: 'red' });
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
          {groupItemsByModule(items).map(group => {
            const selectedItemsInModule = group.items.filter(item =>
              selectedFunctionalityIds.includes(item.id),
            );
            const moduleSelection = moduleAssignmentSelections[group.module];

            return (
              <div key={`${title}-${group.module}`} className="px-4 py-4">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag color="geekblue" className="m-0">
                          {group.module}
                        </Tag>
                        <span className="text-xs text-slate-500">
                          {selectedItemsInModule.length}/{group.items.length} funcionalidades seleccionadas
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-0 mt-2">
                        Asigna una QA al modulo y las funcionalidades heredaran ese valor.
                      </p>
                    </div>
                    <Select
                      placeholder="Asignar tester al modulo"
                      className="min-w-[240px]"
                      value={moduleSelection}
                      options={availableTesterOptions}
                      disabled={
                        availableTesterOptions.length === 0 || selectedItemsInModule.length === 0
                      }
                      allowClear
                      onChange={value => handleModuleAssignmentChange(group.module, value)}
                    />
                  </div>

                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                    {group.items.map(item => {
                      const isSelected = selectedFunctionalityIds.includes(item.id);
                      const effectiveSelection = getEffectiveAssignmentSelection(item.id, group.module);
                      const hasIndividualOverride = Boolean(assignmentSelections[item.id]);

                      return (
                        <label
                          key={item.id}
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <Checkbox
                            className="mt-1"
                            checked={isSelected}
                            onChange={event => {
                              setSelectedFunctionalityIds(current =>
                                event.target.checked
                                  ? Array.from(new Set([...current, item.id]))
                                  : current.filter(id => id !== item.id),
                              );
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-slate-800">
                                    {item.name}
                                  </span>
                                  {!hasFunctionalTestCases(item.id, functionalityIdsWithTestCases) && (
                                    <Tag color="orange" className="m-0">
                                      Sin casos de prueba
                                    </Tag>
                                  )}
                                </div>
                                <div className="mt-2">{renderReasonTags(item)}</div>
                              </div>
                              <div className="min-w-[240px]">
                                <Select
                                  placeholder={
                                    moduleSelection
                                      ? 'Hereda del modulo'
                                      : 'Asignar tester a la funcionalidad'
                                  }
                                  className="w-full"
                                  value={effectiveSelection}
                                  options={availableTesterOptions}
                                  disabled={!isSelected || availableTesterOptions.length === 0}
                                  allowClear
                                  onClick={event => event.stopPropagation()}
                                  onChange={value =>
                                    handleItemAssignmentChange(item.id, group.module, value)
                                  }
                                />
                                {isSelected && (
                                  <div className="mt-2 text-[11px] text-slate-400">
                                    {hasIndividualOverride
                                      ? 'Override individual para esta funcionalidad.'
                                      : moduleSelection
                                        ? 'Heredando asignacion del modulo.'
                                        : 'Sin tester asignado todavia.'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-5 text-sm text-slate-400">
          No hay funcionalidades en esta categoria.
        </div>
      )}
    </div>
  );

  const nativeSprintFilters = Array.from(
    new Set(
      [...sprintsData.map(sprint => sprint.name), ...cycles.map(cycle => cycle.sprint)].filter(
        Boolean,
      ),
    ),
  )
    .sort((a, b) => String(a).localeCompare(String(b)))
    .map(sprint => ({
      text: String(sprint),
      value: String(sprint),
    }));

  const nativeStatusFilters = [
    { text: 'Finalizado', value: 'FINALIZADA' },
    { text: 'En progreso', value: 'EN_PROGRESO' },
  ];

  const columns = [
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">CICLO</span>
      ),
      dataIndex: 'cycleId',
      key: 'cycleId',
      filteredValue: tableFilters.cycleId,
      filterDropdown: ({ selectedKeys, setSelectedKeys, confirm, clearFilters }) => (
        <div className="w-64 p-3" onKeyDown={event => event.stopPropagation()}>
          <Input
            autoFocus
            placeholder="Buscar ciclo..."
            value={(selectedKeys[0] as string) || ''}
            onChange={event =>
              setSelectedKeys(event.target.value ? [event.target.value] : [])
            }
            onPressEnter={() => confirm()}
            className="h-9 rounded-lg"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button type="primary" size="small" onClick={() => confirm()}>
              Aplicar
            </Button>
            <Button
              size="small"
              onClick={() => {
                clearFilters?.();
                confirm();
              }}
            >
              Limpiar
            </Button>
          </div>
        </div>
      ),
      filterIcon: filtered => (
        <SearchOutlined className={filtered ? 'text-blue-500' : 'text-slate-300'} />
      ),
      onFilter: (value: boolean | React.Key, record: RegressionCycle) =>
        (record.cycleId || '').toLowerCase().includes(String(value).toLowerCase()),
      render: (text: string, record: RegressionCycle) => (
        <Button
          type="link"
          className="p-0 h-auto font-bold text-blue-600"
          onClick={() => setSelectedCycleId(record.id)}
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
      filteredValue: tableFilters.date,
      filterDropdown: ({ selectedKeys, setSelectedKeys, confirm, clearFilters }) => {
        const serializedValue = (selectedKeys[0] as string) || '';
        const [start, end] = serializedValue.split('|');
        const rangeValue =
          start && end ? ([dayjs(start), dayjs(end)] as [dayjs.Dayjs, dayjs.Dayjs]) : null;

        return (
          <div className="w-72 p-3" onKeyDown={event => event.stopPropagation()}>
            <RangePicker
              className="w-full"
              value={rangeValue}
              onChange={value => {
                if (value?.[0] && value?.[1]) {
                  setSelectedKeys([
                    `${value[0].startOf('day').toISOString()}|${value[1].endOf('day').toISOString()}`,
                  ]);
                  return;
                }

                setSelectedKeys([]);
              }}
            />
            <div className="mt-2 flex items-center gap-2">
              <Button type="primary" size="small" onClick={() => confirm()}>
                Aplicar
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearFilters?.();
                  confirm();
                }}
              >
                Limpiar
              </Button>
            </div>
          </div>
        );
      },
      onFilter: (value: boolean | React.Key, record: RegressionCycle) => {
        const [start, end] = String(value).split('|');
        if (!start || !end || !record.date) return true;

        const currentDate = dayjs(record.date);
        return (
          currentDate.isValid() &&
          currentDate.isAfter(dayjs(start).subtract(1, 'millisecond')) &&
          currentDate.isBefore(dayjs(end).add(1, 'millisecond'))
        );
      },
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
          SPRINT
        </span>
      ),
      dataIndex: 'sprint',
      key: 'sprint',
      filters: nativeSprintFilters,
      filteredValue: tableFilters.sprint,
      onFilter: (value: boolean | React.Key, record: RegressionCycle) =>
        normalizeSprintKey(record.sprint) === normalizeSprintKey(String(value)),
      render: (sprint?: string) => sprint || '—',
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
      onFilter: (value: boolean | React.Key, record: RegressionCycle) =>
        record.status === String(value),
      render: (status: RegressionCycle['status']) => (
        <Tag
          color={status === 'FINALIZADA' ? 'green' : 'blue'}
          className="rounded-full px-3 py-[2px] font-semibold border-0"
        >
          {status === 'FINALIZADA' ? 'Finalizado' : 'En progreso'}
        </Tag>
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
            onClick={() => setSelectedCycleId(record.id)}
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

  const handleNativeTableChange = (filters: Record<string, FilterValue | null>) => {
    setTableFilters({
      cycleId: (filters.cycleId as React.Key[] | null) || null,
      date: (filters.date as React.Key[] | null) || null,
      sprint: (filters.sprint as React.Key[] | null) || null,
      status: (filters.status as React.Key[] | null) || null,
    });
  };

  const handleSave = async () => {
    if (isSaving) return;

    try {
      const values = await form.validateFields();
      const testerAssignments = resolveCycleTesterAssignments(values.tester || [], slackMembers);

      if (editingCycle) {
        const reassignedExecutions = editingCycle.executions.map(execution => {
          const selectionValue = getEffectiveAssignmentSelection(
            execution.id,
            execution.module,
            execution.assignedTesterEmail || execution.assignedTesterName,
          );
          const selectedAssignment = resolveSelectedTesterAssignment(
            testerAssignments,
            selectionValue,
          );

          if (!selectedAssignment) {
            throw new Error(
              `Completa la asignacion manual para "${execution.functionalityName}" antes de guardar el ciclo.`,
            );
          }

          return {
            ...execution,
            assignedTesterName: selectedAssignment.name,
            assignedTesterEmail: selectedAssignment.email,
          };
        });

        const updatedCycle: RegressionCycle = {
          ...editingCycle,
          ...values,
          sprint: normalizeSprintName(values.sprint),
          tester: serializeTesterValue(values.tester),
          date: values.date.format('YYYY-MM-DD'),
          executions: reassignedExecutions,
        };
        console.log('Payload - Update Regression Cycle:', updatedCycle);
        const savedCycle = await save(updatedCycle);
        setSelectedCycleId(savedCycle.id);
        message.success('Ciclo actualizado correctamente');
      } else {
        const selectedFunctionalities = regressionFuncs.filter(f =>
          selectedFunctionalityIds.includes(f.id),
        );

        if (selectedFunctionalities.length === 0) {
          message.error('Selecciona al menos una funcionalidad para el ciclo de regresión.');
          return;
        }

        const initialExecutions: RegressionExecution[] = selectedFunctionalities.map(functionality => {
          const selectedAssignment = resolveSelectedTesterAssignment(
            testerAssignments,
            getEffectiveAssignmentSelection(functionality.id, functionality.module),
          );

          if (!selectedAssignment) {
            throw new Error(
              `Asigna manualmente un tester para "${functionality.name}" antes de crear el ciclo.`,
            );
          }

          return {
            id: Math.random().toString(36).substr(2, 9),
            functionalityId: functionality.id,
            module: functionality.module,
            functionalityName: functionality.name,
            executionMode: ExecutionMode.MANUAL,
            executed: false,
            result: TestResult.NOT_EXECUTED,
            date: undefined,
            assignedTesterName: selectedAssignment.name,
            assignedTesterEmail: selectedAssignment.email,
          };
        });

        const newCycle: RegressionCycle = {
          id: Date.now().toString(),
          projectId: projectId || '',
          type: 'REGRESSION',
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

        console.log('Payload - Create Regression Cycle:', newCycle);
        const savedCycle = await save(newCycle);
        setSelectedCycleId(savedCycle.id);
        message.success('Ciclo creado correctamente');
      }

      resetCycleModal();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      if (error instanceof Error && error.message) {
        message.error(error.message);
        return;
      }

      console.error('Failed to save regression cycle:', error);
      message.error('No pudimos guardar el ciclo. Intenta nuevamente.');
    }
  };

  const updateExecution = async (
    cycleId: string,
    executionId: string,
    updates: Partial<RegressionExecution>,
  ): Promise<boolean> => {
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return false;
    const targetExecution = cycle.executions.find(item => item.id === executionId);
    if (!targetExecution) return false;
    if (
      !canEditAssignedExecution(
        targetExecution,
        currentUserEmail,
        canManageCycleConfig,
        currentUserName,
      )
    ) {
      message.warning(
        'Esta prueba esta asignada a otra QA. Solo la persona asignada o QA Lead/Owner puede guardarla.',
      );
      return false;
    }
    const nextUpdates: Partial<RegressionExecution> = {
      ...updates,
      ...(updates.executed ? { date: updates.date || dayjs().format('YYYY-MM-DD') } : {}),
    };
    const optimisticExecutions = cycle.executions.map(item =>
      item.id === executionId ? { ...item, ...nextUpdates } : item,
    );
    const optimisticPassed = optimisticExecutions.filter(
      item => item.result === TestResult.PASSED,
    ).length;
    const optimisticFailed = optimisticExecutions.filter(
      item => item.result === TestResult.FAILED,
    ).length;
    const optimisticBlocked = optimisticExecutions.filter(
      item => item.result === TestResult.BLOCKED,
    ).length;
    const optimisticPending = optimisticExecutions.filter(item => !item.executed).length;
    const optimisticCycle: RegressionCycle = {
      ...cycle,
      executions: optimisticExecutions,
      totalTests: optimisticExecutions.length,
      passed: optimisticPassed,
      failed: optimisticFailed,
      blocked: optimisticBlocked,
      pending: optimisticPending,
      passRate:
        optimisticExecutions.length > 0
          ? Math.round((optimisticPassed / optimisticExecutions.length) * 1000) / 10
          : 0,
    };
    const previousCycles = queryClient.getQueryData<RegressionCycle[] | undefined>(
      testCyclesQueryKey,
    );
    queryClient.setQueryData<RegressionCycle[] | undefined>(
      testCyclesQueryKey,
      previous =>
        previous
          ? previous.map(item => (item.id === cycleId ? optimisticCycle : item))
          : [optimisticCycle],
    );

    try {
      const savedCycle = await saveTestCycleExecution(
        cycleId,
        cycle.projectId,
        executionId,
        nextUpdates,
        targetExecution.updatedAt,
      );
      queryClient.setQueryData<RegressionCycle[] | undefined>(
        testCyclesQueryKey,
        previous =>
          previous
            ? previous.map(item => (item.id === savedCycle.id ? savedCycle : item))
            : [savedCycle],
      );
      if (selectedCycleId === cycleId) {
        setSelectedCycleId(savedCycle.id);
      }
      return true;
    } catch (error) {
      queryClient.setQueryData(testCyclesQueryKey, previousCycles);
      void queryClient.invalidateQueries({ queryKey: testCyclesQueryKey });
      if (isExecutionConflictError(error)) {
        message.warning(
          'Otra QA actualizó esta prueba antes que tú. Recargamos el ciclo para mostrar la versión más reciente.',
        );
        return false;
      }

      console.error('Failed to update regression execution:', error);
      message.error('No pudimos guardar este cambio. Intenta nuevamente.');
      return false;
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
    setSelectedCycleId(savedCycle.id);
  };

  const handleFinalizeCycle = async (cycle: RegressionCycle) => {
    if (cycle.pending > 0) {
      message.warning('AÃºn hay casos pendientes por ejecutar');
      return;
    }

    const updatedCycle: RegressionCycle = {
      ...cycle,
      status: 'FINALIZADA',
    };

    const savedCycle = await save(updatedCycle);
    setSelectedCycleId(savedCycle.id);
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
    setSelectedCycleId(savedCycle.id);
    message.success('Ciclo reabierto (EN PROGRESO)');
  };

  const hasActiveNativeTableFilters = Object.values(tableFilters).some(
    value => Array.isArray(value) && value.length > 0,
  );

  const clearNativeTableFilters = () => {
    setTableFilters({
      cycleId: null,
      date: null,
      sprint: null,
      status: null,
    });
  };

  const filteredExecutions = (selectedCycle?.executions || []).filter(ex => {
    if (!ex) return false;
    const normalizedSearch = detailSearch.toLowerCase();
    const matchesSearch =
      (ex.functionalityId || '').toLowerCase().includes(normalizedSearch) ||
      (ex.module || '').toLowerCase().includes(normalizedSearch) ||
      (ex.functionalityName || '').toLowerCase().includes(normalizedSearch) ||
      (ex.assignedTesterName || '').toLowerCase().includes(normalizedSearch) ||
      (ex.assignedTesterEmail || '').toLowerCase().includes(normalizedSearch);

    const matchesFilter = detailFilter === 'ALL' || ex.result === TestResult.FAILED;

    return matchesSearch && matchesFilter;
  });

  const automatedExecutionsCount = (selectedCycle?.executions || []).filter(
    execution => getExecutionModeLabel(execution.executionMode) === ExecutionMode.AUTOMATED,
  ).length;
  const manualExecutionsCount = Math.max(
    (selectedCycle?.executions || []).length - automatedExecutionsCount,
    0,
  );
  const automationRate = selectedCycle?.totalTests
    ? Math.round((automatedExecutionsCount / selectedCycle.totalTests) * 100)
    : 0;

  const functionalityLookup = new Map(functionalities.map(item => [item.id, item] as const));

  const getExecutionDraft = (executionId: string) => executionDrafts[executionId] || {};

  const mergeExecutionDraft = (execution: RegressionExecution): RegressionExecution => ({
    ...execution,
    ...getExecutionDraft(execution.id),
  });

  const stageExecutionDraft = (
    executionId: string,
    updates: Partial<RegressionExecution>,
  ) => {
    setExecutionDrafts(previous => ({
      ...previous,
      [executionId]: {
        ...previous[executionId],
        ...updates,
      },
    }));
  };

  const clearExecutionDraft = (executionId: string) => {
    setExecutionDrafts(previous => {
      if (!previous[executionId]) return previous;

      const next = { ...previous };
      delete next[executionId];
      return next;
    });
  };

  const saveExecutionDraft = async (record: RegressionExecution) => {
    if (!canEditExecutionRecord(record)) {
      message.warning(
        'Esta prueba esta asignada a otra QA. Solo la persona asignada o QA Lead/Owner puede guardarla.',
      );
      return;
    }

    const mergedExecution = mergeExecutionDraft(record);
    if (
      mergedExecution.result === TestResult.FAILED &&
      (!mergedExecution.evidence?.trim() ||
        !mergedExecution.bugTitle?.trim() ||
        !mergedExecution.severity)
    ) {
      setCurrentExecution(mergedExecution);
      setEvidenceModalOpen(true);
      message.warning(
        'Completa las notas, el título del bug y la severidad antes de guardar una prueba fallida.',
      );
      return;
    }

    const updates: Partial<RegressionExecution> = {
      executionMode: mergedExecution.executionMode,
      executed: mergedExecution.executed,
      date: mergedExecution.executed ? mergedExecution.date || dayjs().format('YYYY-MM-DD') : '',
      result: mergedExecution.result,
      evidence: mergedExecution.evidence,
      evidenceImage: mergedExecution.evidenceImage,
      bugTitle: mergedExecution.bugTitle,
      bugLink: mergedExecution.bugLink,
      severity: mergedExecution.severity,
      linkedBugId: mergedExecution.linkedBugId,
    };

    setSavingExecutionIds(previous =>
      previous.includes(record.id) ? previous : [...previous, record.id],
    );

    try {
      const didSave = await updateExecution(selectedCycle.id, record.id, updates);
      if (didSave) {
        clearExecutionDraft(record.id);
        message.success('Ejecución guardada correctamente.');
      }
    } finally {
      setSavingExecutionIds(previous => previous.filter(item => item !== record.id));
    }
  };

  return (
    <>
      {selectedCycle ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setExecutionDrafts({});
                  setSelectedCycleId(null);
                }}
                className="rounded-xl h-10 w-10 flex items-center justify-center border-slate-200"
              />
              <div>
                <div className="flex items-center gap-3 [&>span]:hidden">
                  <Tag
                    color={selectedCycle.status === 'FINALIZADA' ? 'green' : 'blue'}
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
              {!isReadOnly && canManageCycleConfig && !isViewer && (
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  size="large"
                  className="rounded-xl h-11 px-8 shadow-lg shadow-blue-200 font-bold"
                  onClick={() => void handleExecuteAll(selectedCycle)}
                >
                  Execute All
                </Button>
              )}
              {selectedCycle.totalTests > 0 && (
                <div className="ml-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2">
                  <Tag color="blue" className="m-0 rounded-full px-3 py-1 font-semibold">
                    Automatizadas {automatedExecutionsCount}/{selectedCycle.totalTests}
                  </Tag>
                  <Tag className="m-0 rounded-full px-3 py-1 font-semibold">
                    Manuales {manualExecutionsCount}
                  </Tag>
                  {automationRate === 100 && (
                    <Tag color="green" className="m-0 rounded-full px-3 py-1 font-semibold">
                      Todo automatizado
                    </Tag>
                  )}
                </div>
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
                  placeholder="Buscar por modulo, funcionalidad o tester..."
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
                    const assignmentLabel = getExecutionAssignmentLabel(record);

                    return (
                      <div>
                        <div className="text-slate-800 font-medium">{n}</div>
                        {functionality && (
                          <div className="mt-2">{renderReasonTags(functionality)}</div>
                        )}
                        {assignmentLabel && (
                          <div className="mt-2">
                            <Tag className="m-0 rounded-full border-slate-200 bg-slate-50 text-slate-500">
                              Asignada a {assignmentLabel}
                            </Tag>
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      EJECUCIÓN
                    </span>
                  ),
                  dataIndex: 'executionMode',
                  key: 'executionMode',
                  render: (_executionMode, record) => {
                    const draftRecord = mergeExecutionDraft(record);
                    const rowReadOnly = !canEditExecutionRecord(record);

                    return (
                      <Select
                        value={getExecutionModeLabel(draftRecord.executionMode)}
                        onChange={val =>
                          stageExecutionDraft(record.id, {
                            executionMode: val,
                          })
                        }
                        className="w-36"
                        variant="borderless"
                        disabled={rowReadOnly}
                        options={[
                          { label: ExecutionMode.AUTOMATED, value: ExecutionMode.AUTOMATED },
                          { label: ExecutionMode.MANUAL, value: ExecutionMode.MANUAL },
                        ]}
                      />
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
                  render: (_executed, record) => {
                    const draftRecord = mergeExecutionDraft(record);
                    const rowReadOnly = !canEditExecutionRecord(record);

                    return (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${!rowReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'} transition-colors ${draftRecord.executed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}
                        onClick={
                          !rowReadOnly
                            ? () =>
                                stageExecutionDraft(record.id, {
                                  executed: !draftRecord.executed,
                                  result: !draftRecord.executed
                                    ? TestResult.PASSED
                                    : TestResult.NOT_EXECUTED,
                                  date: !draftRecord.executed
                                    ? dayjs().format('YYYY-MM-DD')
                                    : '',
                                })
                            : undefined
                        }
                      >
                        <CheckCircleOutlined />
                      </div>
                    );
                  },
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">FECHA</span>
                  ),
                  dataIndex: 'date',
                  key: 'date',
                  render: (_date, record) => {
                    const draftRecord = mergeExecutionDraft(record);

                    return (
                      <span className="text-slate-400">
                        {draftRecord.date ? dayjs(draftRecord.date).format('DD MMM, YYYY') : '—'}
                      </span>
                    );
                  },
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      RESULTADO
                    </span>
                  ),
                  dataIndex: 'result',
                  key: 'result',
                  render: (_result, record) => {
                    const draftRecord = mergeExecutionDraft(record);
                    const rowReadOnly = !canEditExecutionRecord(record);

                    return (
                      <div className="flex flex-col gap-1">
                        <Select
                          value={draftRecord.result}
                          onChange={val => {
                            const nextExecution: RegressionExecution = {
                              ...draftRecord,
                              result: val,
                              executed: val !== TestResult.NOT_EXECUTED,
                              date:
                                val !== TestResult.NOT_EXECUTED
                                  ? draftRecord.date || dayjs().format('YYYY-MM-DD')
                                  : '',
                            };

                            stageExecutionDraft(record.id, {
                              result: val,
                              executed: val !== TestResult.NOT_EXECUTED,
                              date: nextExecution.date,
                            });

                            if (val === TestResult.FAILED) {
                              setCurrentExecution(nextExecution);
                              setEvidenceModalOpen(true);
                              message.info(
                                'Adjunta evidencia y registra el bug para completar la prueba fallida.',
                              );
                            }
                          }}
                          className="w-32"
                          variant="borderless"
                          disabled={rowReadOnly}
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
                          const raw = (draftRecord.bugLink || draftRecord.bugId || '').trim();
                          if (!raw) return null;

                          const isUrl = /^https?:\/\//i.test(raw) || /^www\./i.test(raw);
                          const href = isUrl
                            ? raw.startsWith('http')
                              ? raw
                              : `https://${raw}`
                            : null;
                          const label = (draftRecord.bugId || raw).trim();

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
                    );
                  },
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      EVIDENCIA
                    </span>
                  ),
                  dataIndex: 'evidence',
                  key: 'evidence',
                  render: (_ev, record) => {
                    const draftRecord = mergeExecutionDraft(record);
                    const rowReadOnly = !canEditExecutionRecord(record);
                    const hasEvidence = Boolean(draftRecord.evidence || draftRecord.evidenceImage);

                    return (
                      <div
                        className={`flex items-center gap-2 font-medium ${hasEvidence ? 'text-blue-500 hover:text-blue-700' : rowReadOnly ? 'text-slate-300 cursor-not-allowed' : 'text-blue-500 hover:text-blue-700'}`}
                      >
                        {hasEvidence ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={e => {
                              e.stopPropagation();
                              setCurrentExecution(draftRecord);
                              setEvidenceModalOpen(true);
                            }}
                          >
                            <EyeOutlined /> <span>View</span>
                          </div>
                        ) : rowReadOnly ? (
                          <div className="flex items-center gap-1">
                            <PlusOutlined /> <span>Asignada</span>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center gap-1 ${draftRecord.result === TestResult.FAILED ? 'text-red-500' : 'text-slate-400'}`}
                            onClick={e => {
                              e.stopPropagation();
                              setCurrentExecution(draftRecord);
                              setEvidenceModalOpen(true);
                            }}
                          >
                            <PlusOutlined />{' '}
                            <span>
                              {draftRecord.result === TestResult.FAILED ? 'Requerida' : 'Note'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: (
                    <span className="text-[11px] font-bold text-slate-400 uppercase">ACCIÓN</span>
                  ),
                  key: 'save',
                  align: 'center',
                  render: (_, record) => {
                    const hasDraft = Boolean(executionDrafts[record.id]);
                    const isSavingRow = savingExecutionIds.includes(record.id);
                    const rowReadOnly = !canEditExecutionRecord(record);

                    return (
                      <Button
                        type={hasDraft ? 'primary' : 'default'}
                        icon={<SaveOutlined />}
                        size="small"
                        disabled={rowReadOnly || !hasDraft}
                        loading={isSavingRow}
                        onClick={event => {
                          event.stopPropagation();
                          void saveExecutionDraft(record);
                        }}
                      >
                        Guardar
                      </Button>
                    );
                  },
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
                Control de Regresión
              </Title>
              <Paragraph type="secondary">
                Gestión y seguimiento de ejecuciones históricas de calidad.
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
              className="rounded-xl h-12 px-6 shadow-lg shadow-blue-200"
              onClick={handleOpenModal}
            >
              Nuevo Ciclo de Regresión
            </Button>
            )}
          </div>

          {latestCycle && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BarChartOutlined className="text-white" />
                </div>
                <span className="font-bold text-slate-800 text-lg">Última Regresión</span>
                <Tag
                  color="blue"
                  className="rounded-full px-3 font-bold border-blue-200 bg-blue-50 text-blue-600"
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
                        color="blue"
                        className="m-0 border-none bg-blue-50 text-blue-600 font-bold rounded-full px-3"
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
                        <div className="text-3xl font-bold text-blue-600 mt-1">
                          {latestCycle.passRate}%
                        </div>
                      </div>
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <BarChartOutlined className="text-blue-600" />
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </div>
          )}

          <Card
            className="rounded-2xl border-slate-100 shadow-sm"
            title={
              <div className="flex flex-col gap-1">
                <span className="text-slate-800 font-bold">Historial de Ciclos</span>
                <span className="text-xs text-slate-400">
                  Usa los filtros nativos en ciclo, fecha, sprint y estado.
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
              dataSource={cycles}
              rowKey="id"
              pagination={{
                pageSize: 5,
                showTotal: (total, range) =>
                  `Mostrando ${range[0]}-${range[1]} de ${total} registros`,
              }}
              className="executive-table"
              onChange={(_, filters) => handleNativeTableChange(filters)}
            />
          </Card>
        </div>
      )}

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            {editingCycle ? 'Editar Ciclo de Regresión' : 'Registrar Nuevo Ciclo de Regresión'}
          </span>
        }
        open={isModalOpen}
        onOk={!isViewer ? () => void handleSave() : undefined}
        onCancel={() => {
          if (isSaving) return;
          resetCycleModal();
        }}
        width={800}
        centered
        confirmLoading={isSaving}
        okText={editingCycle ? 'Guardar Cambios' : 'Crear Ciclo y Comenzar'}
        cancelText="Cancelar"
        className="executive-modal"
        okButtonProps={{
          style: { display: isViewer ? 'none' : undefined },
          loading: isSaving,
        }}
        cancelButtonProps={{ disabled: isSaving }}
        maskClosable={!isSaving}
        keyboard={!isSaving}
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
                <Input placeholder="Ej: C-49" className="h-10 rounded-lg" />
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
                rules={[{ required: true }]}
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
                  <span className="text-blue-600 font-bold">
                    {editingCycle ? selectedCycle?.executions?.length || 0 : selectedFunctionalityIds.length}
                  </span>{' '}
                  funcionalidades sugeridas/seleccionadas para
                  <Tag color="blue" className="m-0 ml-1">
                    Regresión
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
            label={<span className="font-semibold text-slate-600">Objetivo de la Regresión</span>}
          >
            <Input.TextArea
              rows={3}
              placeholder="Ej: Asegurar estabilidad de módulos core antes de despliegue..."
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
                            ...regressionMandatoryFuncs.map(item => item.id),
                            ...regressionRecommendedFuncs.map(item => item.id),
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
                    options={regressionModuleOptions}
                  />
                </Space>
              </div>

              <Space direction="vertical" size={12} className="w-full">
                {renderSuggestionSection(
                  'Obligatorias',
                  'Core de regresión con prioridad o riesgo elevado.',
                  'bg-blue-50',
                  filterByModule(regressionMandatoryFuncs),
                )}
                {renderSuggestionSection(
                  'Recomendadas',
                  'Funcionalidades con cambio reciente para revisar en el ciclo.',
                  'bg-amber-50',
                  filterByModule(regressionRecommendedFuncs),
                )}
                {renderSuggestionSection(
                  'Opcionales',
                  'Cobertura adicional para ampliar el alcance del ciclo.',
                  'bg-slate-50',
                  filterByModule(regressionOptionalFuncs),
                )}
              </Space>
            </div>
          ) : (
            <div className="mt-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-3">
                Vista Previa de Funcionalidades
              </span>
              <Space direction="vertical" size={12} className="w-full mb-3">
                {editingExecutionGroups.map(group => (
                  <div
                    key={`edit-module-${group.module}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag color="geekblue" className="m-0">
                          {group.module}
                        </Tag>
                        <span className="text-xs text-slate-500">
                          {group.items.length} funcionalidades
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        La asignacion del modulo se puede sobrescribir por funcionalidad en la tabla.
                      </div>
                    </div>
                    <Select
                      placeholder="Asignar tester al modulo"
                      className="min-w-[240px]"
                      value={moduleAssignmentSelections[group.module]}
                      options={availableTesterOptions}
                      allowClear
                      onChange={value => handleModuleAssignmentChange(group.module, value)}
                    />
                  </div>
                ))}
              </Space>
              <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-100">
                <Table
                  dataSource={(selectedCycle?.executions || []).map(execution => ({
                    id: execution.id,
                    module: execution.module,
                    name: execution.functionalityName,
                    assignedTesterName: execution.assignedTesterName,
                    assignedTesterEmail: execution.assignedTesterEmail,
                  }))}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'Módulo',
                      dataIndex: 'module',
                      key: 'module',
                      render: m => <span className="text-xs font-medium">{m}</span>,
                    },
                    {
                      title: 'Funcionalidad',
                      dataIndex: 'name',
                      key: 'name',
                      render: n => <span className="text-xs text-slate-500">{n}</span>,
                    },
                    {
                      title: 'Tester asignado',
                      key: 'assignedTester',
                      render: (
                        _,
                        row: {
                          id: string;
                          module: string;
                          assignedTesterName?: string;
                          assignedTesterEmail?: string;
                        },
                      ) => (
                        <Select
                          placeholder={
                            moduleAssignmentSelections[row.module]
                              ? 'Hereda del modulo'
                              : 'Asignar tester'
                          }
                          className="min-w-[220px]"
                          value={getEffectiveAssignmentSelection(
                            row.id,
                            row.module,
                            row.assignedTesterEmail || row.assignedTesterName,
                          )}
                          options={availableTesterOptions}
                          allowClear
                          onChange={value => handleItemAssignmentChange(row.id, row.module, value)}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Evidencia de Ejecución</span>}
        open={evidenceModalOpen}
        onCancel={() => {
          setEvidenceModalOpen(false);
          setCurrentExecution(null);
        }}
        onOk={async () => {
          try {
            if (!selectedCycle || !currentExecution) {
              message.error('No se pudo identificar la ejecución actual');
              return;
            }
            if (isCurrentExecutionReadOnly) {
              setEvidenceModalOpen(false);
              setCurrentExecution(null);
              return;
            }
            const values = await evidenceForm.validateFields();
            const mergedExecution = mergeExecutionDraft(currentExecution);
            const evidencePayload = {
              evidence: values.evidence,
              evidenceImage: evidenceImage,
              bugTitle: values.bugTitle,
              bugId: values.bugId,
              bugLink: values.bugLink,
              severity: values.severity,
            };

            let linkedBugId = mergedExecution.linkedBugId;
            if (mergedExecution.result === TestResult.FAILED) {
              const syncedBug = await syncBugReport({
                linkedBugId: mergedExecution.linkedBugId,
                internalBugId: values.bugId,
                title: values.bugTitle,
                description: values.evidence,
                severity: values.severity,
                bugLink: values.bugLink,
                evidenceImage,
                origin: BugOrigin.REGRESSION_CYCLE,
                projectId: selectedCycle.projectId,
                functionalityId: mergedExecution.functionalityId,
                functionalityName: mergedExecution.functionalityName,
                module: mergedExecution.module,
                sprint: selectedCycle.sprint,
                cycleId: selectedCycle.cycleId,
                reportedBy: selectedCycle.tester,
                executionId: mergedExecution.id,
              });
              linkedBugId = syncedBug?.internalBugId;
              if (syncedBug) {
                void queryClient.invalidateQueries({
                  queryKey: ['bugs', selectedCycle.projectId],
                });
              }
            }

            console.log('Payload - Save Evidence:', {
              executionId: mergedExecution.id,
              ...evidencePayload,
            });
            const didSave = await updateExecution(selectedCycle.id, mergedExecution.id, {
              executionMode: mergedExecution.executionMode,
              executed: mergedExecution.executed,
              date: mergedExecution.executed ? mergedExecution.date || dayjs().format('YYYY-MM-DD') : '',
              result: mergedExecution.result,
              ...evidencePayload,
              linkedBugId,
            });
            if (!didSave) return;
            clearExecutionDraft(mergedExecution.id);
            setEvidenceModalOpen(false);
            setCurrentExecution(null);
            message.success('Evidencia guardada correctamente');
          } catch (error) {
            console.error('Error saving evidence:', error);
            if (isPayloadTooLargeError(error)) {
              showPayloadTooLargeMessage();
              return;
            }
            message.error('Error al guardar la evidencia. Por favor revisa los campos.');
          }
        }}
        width={600}
        centered
        okText="Guardar Evidencia"
        cancelText="Cerrar"
        footer={
          isCurrentExecutionReadOnly
            ? [
                <Button key="close" onClick={() => setEvidenceModalOpen(false)}>
                  Cerrar
                </Button>,
              ]
            : undefined
        }
      >
        <div className="space-y-4 mt-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Funcionalidad</div>
            <div className="font-bold text-slate-700">
              {currentExecution?.functionalityId} - {currentExecution?.functionalityName}
            </div>
          </div>

          <Form form={evidenceForm} layout="vertical">
            <Form.Item
              name="evidence"
              label={<span className="font-semibold text-slate-600">Notas de Ejecución</span>}
              rules={
                isFailureEvidenceRequired
                  ? [{ required: true, message: 'Las notas de ejecución son obligatorias.' }]
                  : undefined
              }
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe los hallazgos, errores encontrados o pasos realizados..."
                className="rounded-lg"
                disabled={isCurrentExecutionReadOnly}
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
                disabled={isCurrentExecutionReadOnly}
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
                    disabled={isCurrentExecutionReadOnly}
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
                  <Input
                    placeholder="https://..."
                    className="rounded-lg"
                    disabled={isCurrentExecutionReadOnly}
                  />
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
                    {!isCurrentExecutionReadOnly && (
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
                    disabled={isCurrentExecutionReadOnly}
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
                        <UploadOutlined className="text-blue-500 text-3xl" />
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
