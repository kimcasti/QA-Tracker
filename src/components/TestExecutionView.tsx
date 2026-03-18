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
  Upload,
  message,
  Tooltip,
  Divider,
  Checkbox,
  Popconfirm,
  List,
  Image,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UploadOutlined,
  DeleteOutlined,
  FileImageOutlined,
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
} from '@ant-design/icons';
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useSlackMembers } from '../modules/slack-members/hooks/useSlackMembers';
import { SlackMemberSelect } from '../modules/slack-members/components/SlackMemberSelect';
import { useModules } from '../modules/settings/hooks/useModules';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useTestRuns } from '../modules/test-runs/hooks/useTestRuns';
import { useWorkspace } from '../modules/workspace/hooks/useWorkspace';
import {
  TestExecution,
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
} from '../types';
import {
  labelEnvironment,
  labelExecutionStatus,
  labelPriority,
  labelTestResult,
} from '../i18n/labels';
import { previewNextInternalBugId, syncBugReport } from '../services/bugTrackerService';
import BugHistoryView from './BugHistoryView';
import dayjs from 'dayjs';
import {
  isPayloadTooLargeError,
  readFileAsDataUrl,
  showPayloadTooLargeMessage,
  validateInlineImageFile,
} from '../utils/uploadValidation';
import {
  getGeminiApiKey,
  recommendExecutionFunctionalitiesWithAI,
  type ExecutionRecommendationCandidate,
} from '../services/geminiService';

const { Text, Title } = Typography;

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

export default function TestExecutionView({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: workspace } = useWorkspace();
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: testRunsData, save: saveTestRun, delete: deleteTestRun } = useTestRuns(projectId);
  const { data: allTestCases } = useTestCases(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testRuns = Array.isArray(testRunsData) ? testRunsData : [];
  const testCases = Array.isArray(allTestCases) ? allTestCases : [];
  const activeMembership = workspace?.memberships[0];
  const canDeleteTestRuns = ['owner', 'qa-lead'].includes(activeMembership?.role?.code || '');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: slackMembers = [], isLoading: isSlackMembersLoading } =
    useSlackMembers(isModalOpen);
  const [activeTestRun, setActiveTestRun] = useState<TestRun | null>(null);
  const [form] = Form.useForm();

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

  const functionalityIdsWithTestCases = useMemo(() => {
    return new Set(testCases.map(testCase => testCase.functionalityId).filter(Boolean));
  }, [testCases]);

  const functionalitiesWithTestCases = useMemo(() => {
    return functionalities.filter(func => functionalityIdsWithTestCases.has(func.id));
  }, [functionalities, functionalityIdsWithTestCases]);

  const moduleOptions = useMemo(() => {
    const validModules = new Set(functionalitiesWithTestCases.map(func => func.module));

    return modulesData
      .filter(module => validModules.has(module.name))
      .map(module => ({ label: module.name, value: module.name }));
  }, [functionalitiesWithTestCases, modulesData]);

  const openEvidenceModal = (record: TestRunResult) => {
    setOriginalEvidenceRecord({ ...record });
    setCurrentEvidenceTestCaseId(record.testCaseId);
    setIsEvidenceModalOpen(true);

    if (
      record.result === TestResult.FAILED &&
      !record.bugId?.trim() &&
      activeTestRun?.projectId
    ) {
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

    if (
      currentEvidenceRecord.result === TestResult.FAILED &&
      !currentEvidenceRecord.bugTitle?.trim()
    ) {
      message.error('El titulo del bug es obligatorio para pruebas fallidas.');
      return;
    }

    try {
      if (
        currentEvidenceRecord.result === TestResult.FAILED &&
        activeTestRun &&
        activeEvidenceFunctionality
      ) {
        const syncedBug = await syncBugReport({
          linkedBugId: currentEvidenceRecord.linkedBugId,
          internalBugId: currentEvidenceRecord.bugId,
          title: currentEvidenceRecord.bugTitle,
          description: currentEvidenceRecord.notes,
          severity: currentEvidenceRecord.severity,
          bugLink: currentEvidenceRecord.bugLink,
          evidenceImage: currentEvidenceRecord.evidenceImage,
          origin: BugOrigin.GENERAL_EXECUTION,
          projectId: activeTestRun.projectId,
          functionalityId: activeEvidenceFunctionality.id,
          functionalityName: activeEvidenceFunctionality.name,
          module: activeEvidenceFunctionality.module,
          sprint: activeTestRun.sprint,
          reportedBy: activeTestRun.tester,
          testCaseId: currentEvidenceRecord.testCaseId,
          testCaseTitle: activeEvidenceTestCase?.title,
          testRunId: activeTestRun.id,
          executionId: currentEvidenceRecord.id,
        });

        if (syncedBug) {
          updateResult(currentEvidenceRecord.testCaseId, 'linkedBugId', syncedBug.internalBugId);
          updateResult(currentEvidenceRecord.testCaseId, 'bugId', syncedBug.internalBugId);
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
    return functionalitiesWithTestCases.filter(f => selectedModules.includes(f.module));
  }, [selectedModules, functionalitiesWithTestCases]);

  const selectedTestType = Form.useWatch('testType', form) as TestType | undefined;

  const testCaseCountByFunctionality = useMemo(() => {
    const counts = new Map<string, number>();
    testCases.forEach(testCase => {
      counts.set(
        testCase.functionalityId,
        (counts.get(testCase.functionalityId) || 0) + 1,
      );
    });
    return counts;
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

    const scored = functionalitiesWithTestCases
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
          reasons.push('pertenece a un modulo seleccionado');
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
          reasons.push('encaja bien para una validacion sanity');
        }
        if (selectedTestType === TestType.INTEGRATION && (hasHighRisk || recentChange)) {
          score += 2;
          reasons.push('podria impactar integraciones relacionadas');
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
          reasons.push('podria afectar un flujo relevante para negocio');
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
    functionalitiesWithTestCases,
    selectedFuncIds,
    selectedFunctionalityModels,
    selectedModules,
    selectedTestType,
  ]);

  const visibleAiSuggestions = useMemo(() => {
    return aiSuggestions.filter(suggestion => !selectedFuncIds.includes(suggestion.functionalityId));
  }, [aiSuggestions, selectedFuncIds]);

  const groupedFunctionalities = useMemo(() => {
    const groups: Record<string, typeof functionalities> = {};
    availableFunctionalities.forEach(f => {
      if (!groups[f.module]) groups[f.module] = [];
      groups[f.module].push(f);
    });
    return groups;
  }, [availableFunctionalities]);

  const executionTestTypeOptions = useMemo(
    () =>
      Object.values(TestType)
        .filter(type => type !== TestType.REGRESSION && type !== TestType.SMOKE)
        .map(type => ({ label: type, value: type })),
    [],
  );

  useEffect(() => {
    // Auto-select all functionalities when modules change
    const newIds = availableFunctionalities.map(f => f.id);
    setSelectedFuncIds(newIds);
  }, [availableFunctionalities]);

  useEffect(() => {
    setAiSuggestions([]);
    setAiSuggestionMode(null);
  }, [selectedModules, selectedTestType]);

  const buildRuleBasedSuggestions = () => {
    return ruleBasedSuggestionPool.slice(0, 5).map(item => ({
      functionalityId: item.func.id,
      reason: item.reasons.slice(0, 2).join(' y '),
      source: 'rules' as const,
    }));
  };

  const handleSuggestWithAI = async () => {
    if (!selectedModules.length) {
      message.warning('Selecciona al menos un modulo antes de pedir sugerencias.');
      return;
    }

    if (ruleBasedSuggestionPool.length === 0) {
      setAiSuggestions([]);
      setAiSuggestionMode(null);
      message.info('No hay candidatas relevantes para sugerir en este momento.');
      return;
    }

    const fallbackSuggestions = buildRuleBasedSuggestions();

    if (!getGeminiApiKey()) {
      setAiSuggestions(fallbackSuggestions);
      setAiSuggestionMode('rules');
      message.warning(
        'No se encontro configuracion de Gemini. Se muestran sugerencias automaticas basadas en reglas.',
      );
      return;
    }

    setIsSuggestingAi(true);
    try {
      const response =
        (await recommendExecutionFunctionalitiesWithAI({
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
        message.info('La IA no encontro nuevas candidatas claras. Se muestran sugerencias automaticas.');
        return;
      }

      setAiSuggestions(nextSuggestions);
      setAiSuggestionMode('ai');
      message.success('Sugerencias con IA listas');
    } catch (error) {
      console.error('AI suggestion error:', error);
      const msg = (error instanceof Error ? error.message : (error as any)?.message) || '';
      if (msg === 'GEMINI_API_KEY_MISSING') {
        message.warning(
          'Configura VITE_GEMINI_API_KEY en el .env del cliente para usar sugerencias con IA.',
        );
      } else if (msg === 'GEMINI_API_KEY_INVALID' || msg === 'GEMINI_API_KEY_LEAKED') {
        message.error('La configuracion actual de Gemini no es valida. Se usaran sugerencias automaticas.');
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
      setIsModalOpen(false);
      form.resetFields();
      setSelectedModules([]);
      setSelectedFuncIds([]);

      message.success('Ejecución de pruebas creada. Iniciando fase de ejecución...');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleSaveExecution = async (status: ExecutionStatus) => {
    if (!activeTestRun) return;

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

  const handleExportReport = () => {
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

      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
        XLSX.writeFile(wb, `Reporte_${activeTestRun.id}_${dayjs().format('YYYYMMDD')}.xlsx`);
        message.success('Reporte exportado correctamente');
      });
    } catch (error) {
      message.error('Error al exportar el reporte');
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
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);

  const filteredRuns = testRuns.filter(run => {
    const matchesStatus = !statusFilter || run.status === statusFilter;
    const matchesSprint = !sprintFilter || run.sprint === sprintFilter;
    return matchesStatus && matchesSprint;
  });

  const columns = [
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          TÍTULO
        </span>
      ),
      key: 'title',
      width: 300,
      render: (_: any, record: TestRun) => (
        <Text strong className="text-slate-700">
          {record.title}
        </Text>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FECHA</span>
      ),
      dataIndex: 'executionDate',
      key: 'executionDate',
      width: 140,
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
      width: 140,
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
      width: 140,
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          TESTER
        </span>
      ),
      dataIndex: 'tester',
      key: 'tester',
      width: 160,
      ellipsis: true,
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
      width: 160,
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
      width: 120,
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
      width: 200,
      render: (_: any, record: TestRun) => {
        const total = record.results.length;
        const executed = record.results.filter(r => r.result !== TestResult.NOT_EXECUTED).length;
        const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
        return (
          <div className="w-32">
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
      width: 160,
      render: (_: any, record: TestRun) => (
        <Space>
          <Button
            icon={record.status === ExecutionStatus.DRAFT ? <EditOutlined /> : <EyeOutlined />}
            size="small"
            onClick={() => {
              setActiveTestRun(record);
              setExecutionResults(record.results);
            }}
            className={record.status === ExecutionStatus.DRAFT ? 'text-amber-600' : 'text-blue-600'}
          >
            {record.status === ExecutionStatus.DRAFT ? 'Continuar' : 'Ver'}
          </Button>
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

  if (activeTestRun) {
    const isReadOnly = activeTestRun.status === ExecutionStatus.FINAL;

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
                    color="success"
                    className="m-0 font-bold uppercase text-[10px] px-2 py-0.5 rounded-sm"
                  >
                    FINALIZADA
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
            </div>
          </Space>
          <Space>
            {!isReadOnly && (
              <Button icon={<EditOutlined />} className="rounded-lg">
                Editar Info
              </Button>
            )}
            <Button icon={<ExportOutlined />} onClick={handleExportReport} className="rounded-lg">
              Export Report
            </Button>
            {!isReadOnly && (
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
                  const func = functionalities.find(f => f.id === record.functionalityId);
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
                  const tc = testCases.find(t => t.id === record.testCaseId);
                  const func = functionalities.find(f => f.id === record.functionalityId);
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
          />
        </Card>
        {!isReadOnly && (
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

        {/* Evidence Modal */}
        <Modal
          title={<span className="text-lg font-bold text-slate-800">Evidencia de Ejecución</span>}
          open={isEvidenceModalOpen}
          onCancel={restoreEvidenceChanges}
          width={520}
          centered
          footer={[
            <Button
              key="close"
              onClick={restoreEvidenceChanges}
              className="rounded-lg"
            >
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
            <div className="space-y-5 py-2">
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

              <div>
                <Text className="text-sm font-semibold text-slate-700 block mb-2">
                  Notas de Ejecución
                </Text>
                <Input.TextArea
                  rows={4}
                  placeholder="Escribe aquí las notas de la ejecución..."
                  value={currentEvidenceRecord.notes}
                  disabled={isReadOnly}
                  onChange={e =>
                    updateResult(currentEvidenceRecord.testCaseId, 'notes', e.target.value)
                  }
                  className="rounded-xl border-slate-200"
                />
              </div>

              <Divider className="m-0">
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-widest">
                  Reporte de Bug
                </Text>
              </Divider>

              <div>
                <Text className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Titulo del Bug
                </Text>
                <Input
                  placeholder="Resume el error detectado"
                  value={currentEvidenceRecord.bugTitle}
                  disabled={isReadOnly}
                  onChange={e =>
                    updateResult(currentEvidenceRecord.testCaseId, 'bugTitle', e.target.value)
                  }
                  className="rounded-lg border-slate-200"
                />
              </div>

              <Row gutter={16}>
                <Col span={24}>
                  <Text className="text-xs font-semibold text-slate-600 block mb-1.5">
                    Severidad
                  </Text>
                  <Select
                    className="w-full rounded-lg"
                    placeholder="Seleccionar"
                    value={currentEvidenceRecord.severity}
                    disabled={isReadOnly}
                    onChange={val =>
                      updateResult(currentEvidenceRecord.testCaseId, 'severity', val)
                    }
                    options={Object.values(Severity).map(s => ({ label: s, value: s }))}
                  />
                </Col>
              </Row>

              <div>
                <Text className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Link al Bug
                </Text>
                <Input
                  placeholder="https://jira.atlassian.net/browse/..."
                  value={currentEvidenceRecord.bugLink}
                  disabled={isReadOnly}
                  onChange={e =>
                    updateResult(currentEvidenceRecord.testCaseId, 'bugLink', e.target.value)
                  }
                  className="rounded-lg border-slate-200"
                />
              </div>

              <Text type="secondary" className="text-[11px] block -mt-2">
                Al registrar un bug desde una prueba fallida, se creara o actualizara
                automaticamente en el Historial de Bugs con estado inicial Pendiente.
              </Text>

              <div>
                <Text className="text-sm font-semibold text-slate-700 block mb-2">
                  Evidencia Visual (Imagen)
                </Text>
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[200px]">
                  {currentEvidenceRecord.evidenceImage ? (
                    <div className="relative group">
                      <Image
                        src={currentEvidenceRecord.evidenceImage}
                        className="max-h-[300px] object-contain rounded-xl shadow-sm"
                      />
                      {!isReadOnly && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <Upload
                            showUploadList={false}
                            beforeUpload={file => {
                              if (!validateInlineImageFile(file)) return false;
                              void readFileAsDataUrl(file).then(base64 =>
                                updateResult(
                                  currentEvidenceRecord.testCaseId,
                                  'evidenceImage',
                                  base64,
                                ),
                              );
                              return false;
                            }}
                          >
                            <Button icon={<UploadOutlined />} ghost>
                              Cambiar Imagen
                            </Button>
                          </Upload>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Upload
                      showUploadList={false}
                      disabled={isReadOnly}
                      beforeUpload={file => {
                        if (!validateInlineImageFile(file)) return false;
                        void readFileAsDataUrl(file).then(base64 =>
                          updateResult(currentEvidenceRecord.testCaseId, 'evidenceImage', base64),
                        );
                        return false;
                      }}
                    >
                      <div className="flex flex-col items-center gap-2 cursor-pointer">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <UploadOutlined className="text-blue-500 text-xl" />
                        </div>
                        <Text type="secondary" className="text-xs">
                          Haz clic para subir evidencia
                        </Text>
                      </div>
                    </Upload>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
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
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg h-10 px-6"
        >
          Crear Ejecución de Pruebas
        </Button>
      </div>

      <Tabs
        defaultActiveKey="executions"
        items={[
          {
            key: 'executions',
            label: 'Historial de Ejecuciones',
            children: (
              <div className="space-y-6">
                <Card className="rounded-2xl shadow-sm border-slate-100">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Estado
                      </span>
                      <Select
                        placeholder="Todos"
                        className="w-40 h-10"
                        allowClear
                        onChange={setStatusFilter}
                        options={Object.values(ExecutionStatus).map(s => ({
                          label: labelExecutionStatus(s, t),
                          value: s,
                        }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Sprint
                      </span>
                      <Select
                        placeholder="Todos"
                        className="w-40 h-10"
                        allowClear
                        onChange={setSprintFilter}
                        options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                      />
                    </div>
                  </div>
                </Card>

                <Card
                  className="rounded-2xl shadow-sm border-slate-100"
                  title={<span className="text-slate-800 font-bold">Historial de Ejecuciones</span>}
                >
                  <Table
                    columns={columns}
                    dataSource={filteredRuns}
                    rowKey="id"
                    className="executive-table"
                    scroll={{ x: 'max-content' }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'bugs',
            label: 'Historial de Bugs',
            children: <BugHistoryView projectId={projectId} />,
          },
        ]}
      />

      <Modal
        title={<span className="text-xl font-bold text-slate-800">Nueva Ejecución de Pruebas</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={800}
        centered
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)}>
            Cancelar
          </Button>,
          <Button key="create" type="primary" onClick={handleCreateTestRun}>
            Crear Ejecución de Pruebas
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            executionDate: dayjs(),
            testType: TestType.FUNCTIONAL,
            priority: Priority.MEDIUM,
          }}
        >
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="title" label="Título de la Ejecución" rules={[{ required: true }]}>
                <Input
                  placeholder="Ej: Regresión Módulo de Pagos - Sprint 25"
                  className="h-10 rounded-lg"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="testType" label="Tipo de Test" rules={[{ required: true }]}>
                <Select className="h-10 rounded-lg" options={executionTestTypeOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="executionDate"
                label="Fecha de Ejecución"
                rules={[{ required: true }]}
              >
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sprint" label="Sprint" rules={[{ required: true }]}>
                <Select
                  placeholder="Selecciona el Sprint"
                  className="h-10 rounded-lg"
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            <Col span={12}>
              <Form.Item name="tester" label="Tester" rules={[{ required: true }]}>
                <SlackMemberSelect
                  members={slackMembers}
                  valueField="fullName"
                  multiple={false}
                  placeholder="Selecciona el tester desde Slack"
                  className="h-10 rounded-lg"
                  loading={isSlackMembersLoading}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="environment" label="Environment" rules={[{ required: true }]}>
                <Select
                  placeholder="Selecciona el Environment"
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
              <Form.Item name="buildVersion" label="Build version">
                <Input placeholder="Ej: v1.2.3 (1234)" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Seleccionar Módulos Relacionados" required>
            <Select
              mode="multiple"
              placeholder="Selecciona uno o más módulos"
              className="w-full rounded-lg"
              onChange={setSelectedModules}
              value={selectedModules}
              options={moduleOptions}
            />
          </Form.Item>

          {selectedModules.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Funcionalidades por Módulo
                </span>
                <Space>
                  <Tooltip title="Analiza el tipo de prueba, los modulos seleccionados y cambios recientes para sugerir funcionalidades relacionadas.">
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      loading={isSuggestingAi}
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
                    Seleccionar Todas
                  </Button>
                  <Divider type="vertical" />
                  <Button
                    size="small"
                    type="link"
                    danger
                    onClick={() => setSelectedFuncIds([])}
                    className="text-[11px] p-0"
                  >
                    Limpiar Selección
                  </Button>
                </Space>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(groupedFunctionalities).map(([moduleName, funcs]) => {
                  const moduleFuncIds = funcs.map(f => f.id);
                  const selectedInModule = selectedFuncIds.filter(id => moduleFuncIds.includes(id));
                  const isAllSelected = selectedInModule.length === moduleFuncIds.length;

                  return (
                    <div
                      key={moduleName}
                      className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden"
                    >
                      <div className="bg-white px-4 py-2 border-b border-slate-100 flex justify-between items-center">
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
                          <span className="font-bold text-slate-700 text-sm">{moduleName}</span>
                          <Tag className="m-0 text-[10px] rounded-full bg-slate-100 border-none text-slate-500">
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
                                  className={`p-2 rounded-lg border transition-all ${selectedFuncIds.includes(item.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
                                >
                                  <Checkbox value={item.id} className="w-full">
                                    <div className="flex flex-col ml-1">
                                      <span className="font-bold text-slate-800 text-xs leading-tight">
                                        {item.id}
                                      </span>
                                      <span
                                        className="text-[11px] text-slate-500 truncate max-w-[200px]"
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
                    No hay funcionalidades con casos de prueba registrados en los modulos seleccionados.
                  </div>
                )}
              </div>

              {(visibleAiSuggestions.length > 0 || aiSuggestionMode) && (
                <Card
                  className="mt-4 rounded-2xl border border-slate-200 shadow-none"
                  styles={{ body: { padding: 16 } }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ThunderboltOutlined className="text-cyan-600" />
                        <span className="font-semibold text-slate-800">
                          Funcionalidades sugeridas
                        </span>
                        <Tag
                          className="m-0 rounded-full border-none"
                          color={aiSuggestionMode === 'ai' ? 'blue' : 'gold'}
                        >
                          {aiSuggestionMode === 'ai' ? 'IA' : 'Reglas'}
                        </Tag>
                      </div>
                      <Text type="secondary" className="text-xs">
                        Recomendaciones complementarias para ampliar el alcance de esta ejecucion.
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

                  {visibleAiSuggestions.length > 0 ? (
                    <List
                      dataSource={visibleAiSuggestions}
                      split
                      renderItem={item => {
                        const functionality = functionalityById.get(item.functionalityId);
                        if (!functionality) return null;

                        return (
                          <List.Item
                            actions={[
                              <Button
                                key="add"
                                size="small"
                                type="primary"
                                ghost
                                onClick={() => addSuggestedFunctionality(item.functionalityId)}
                              >
                                Agregar
                              </Button>,
                            ]}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-800">
                                  {functionality.name}
                                </span>
                                <Tag className="m-0 rounded-full border-none bg-slate-100 text-slate-600">
                                  {functionality.module}
                                </Tag>
                              </div>
                              <Text type="secondary" className="text-xs">
                                {item.reason}
                              </Text>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      No hay sugerencias adicionales para esta combinacion.
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          <Form.Item name="description" label="Descripción / Objetivo" className="mt-4">
            <Input.TextArea
              rows={2}
              placeholder="Objetivo de esta ejecución..."
              className="rounded-lg"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
