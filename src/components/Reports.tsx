import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  BugOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  FlagOutlined,
  FilterOutlined,
  FolderOpenOutlined,
  LineChartOutlined,
  LockOutlined,
  PrinterOutlined,
  ProjectOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { useBugs } from '../modules/bugs/hooks/useBugs';
import { useDeliveryUnits } from '../modules/delivery-units/hooks/useDeliveryUnits';
import {
  authorizeAiAccess,
  authorizeReportAccess,
  runTrackedExport,
} from '../modules/plans/services/planAccessService';
import { startUpgradeRequestFlow } from '../modules/plans/services/billingService';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useProjects } from '../modules/projects/hooks/useProjects';
import { PlanCenterSection } from '../modules/plans/components/PlanCenterSection';
import { PlanUpgradeCard } from '../modules/plans/components/PlanUpgradeCard';
import { UpgradeModal } from '../modules/plans/components/UpgradeModal';
import {
  buildProjectUpgradeWhatsAppUrl,
  normalizeOrganizationPlan,
} from '../modules/projects/utils/projectUpgrade';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useRegressionCycleSummaries } from '../modules/test-cycles/hooks/useRegressionCycleSummaries';
import { useRegressionCycles } from '../modules/test-cycles/hooks/useRegressionCycles';
import { useSmokeCycleSummaries } from '../modules/test-cycles/hooks/useSmokeCycleSummaries';
import { useSmokeCycles } from '../modules/test-cycles/hooks/useSmokeCycles';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  analyzeTechnicalReportWithAI,
  generateDeliveryUnitSummaryWithAI,
  hasAiProviderConfigured,
  type TechnicalReportAnalysisInput,
} from '../services/geminiService';
import { exportDeliveryUnitProgressToDocx } from '../utils/reportUtils';
import {
  BugStatus,
  DeliveryUnit,
  DeliveryUnitType,
  ExecutionMode,
  RegressionCycle,
  RiskLevel,
  TestResult,
  TestStatus,
} from '../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const REPORT_ACCESS_KEYS = {
  QA_STATUS_SUMMARY: 'qaStatusSummary',
  QA_PROGRESS_REPORT: 'qaProgress',
  PROJECT_STATUS_REPORT: 'executiveProjectStatus',
  DELIVERY_UNIT_PROGRESS_REPORT: 'deliveryUnitProgress',
} as const;

type ReportVariant =
  | 'QA_STATUS_SUMMARY'
  | 'QA_PROGRESS_REPORT'
  | 'PROJECT_STATUS_REPORT'
  | 'DELIVERY_UNIT_PROGRESS_REPORT';

type RiskTone = {
  label: string;
  color: 'green' | 'orange' | 'red';
};

interface SelectionCardProps {
  type: ReportVariant;
  title: string;
  description: string;
  format: string;
  selected: boolean;
  onSelect: (type: ReportVariant) => void;
  icon: React.ReactNode;
  locked?: boolean;
}

interface TechnicalAnalysisCardProps {
  projectId: string;
  input: TechnicalReportAnalysisInput;
  resetKey: string;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}

const normalizeSprintKey = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/^sprint\s*/i, '');

const getCycleTypeLabel = (cycle: RegressionCycle) => {
  if (cycle.type === 'SMOKE') return 'Smoke';
  if (cycle.type === 'REGRESSION') return 'Regresión';
  return cycle.cycleId?.startsWith('S-') ? 'Smoke' : 'Regresión';
};

const getExecutedCount = (cycle: RegressionCycle) =>
  Math.max(cycle.totalTests - cycle.pending - cycle.blocked, 0);

const getExecutionModeLabel = (mode?: ExecutionMode) => mode || ExecutionMode.MANUAL;

const getAutomatedCount = (cycle: RegressionCycle) =>
  cycle.executions.filter(
    execution => getExecutionModeLabel(execution.executionMode) === ExecutionMode.AUTOMATED,
  ).length;

const getManualCount = (cycle: RegressionCycle) =>
  Math.max(cycle.executions.length - getAutomatedCount(cycle), 0);

const getAutomationRate = (cycle: RegressionCycle) =>
  cycle.totalTests > 0 ? Math.round((getAutomatedCount(cycle) / cycle.totalTests) * 100) : 0;

const getPercent = (value: number, total: number) =>
  total > 0 ? Math.round((value / total) * 100) : 0;

const average = (values: number[]) =>
  values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

const calculatePercentChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const getPassRateTone = (passRate: number): RiskTone => {
  if (passRate >= 85) return { label: 'Alta', color: 'green' };
  if (passRate >= 60) return { label: 'Media', color: 'orange' };
  return { label: 'Baja', color: 'red' };
};

const getCycleRiskTone = (failed: number, executed: number, activeBugCount: number): RiskTone => {
  const failureRate = getPercent(failed, Math.max(executed, 1));

  if (failureRate >= 40 || activeBugCount >= 3) return { label: 'Alto', color: 'red' };
  if (failureRate >= 15 || activeBugCount > 0) return { label: 'Medio', color: 'orange' };
  return { label: 'Bajo', color: 'green' };
};

const getProjectRiskTone = (
  activeBugCount: number,
  highRiskCount: number,
  averagePassRate: number,
): RiskTone => {
  if (activeBugCount >= 3 || highRiskCount >= 2 || averagePassRate < 60) {
    return { label: 'Alto', color: 'red' };
  }

  if (activeBugCount > 0 || highRiskCount > 0 || averagePassRate < 85) {
    return { label: 'Medio', color: 'orange' };
  }

  return { label: 'Bajo', color: 'green' };
};

const getDeliveryUnitStatusTag = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return <Tag color="green">Completada</Tag>;
  if (value === 'in_progress') return <Tag color="blue">En progreso</Tag>;
  if (value === 'paused') return <Tag color="orange">Pausada</Tag>;
  if (value === 'cancelled') return <Tag color="red">Cancelada</Tag>;
  return <Tag color="default">Planeada</Tag>;
};

const getDeliveryUnitStatusLabel = (status?: string) => {
  const value = String(status || '').toLowerCase();
  if (value === 'completed') return 'Completada';
  if (value === 'in_progress') return 'En progreso';
  if (value === 'paused') return 'Pausada';
  if (value === 'cancelled') return 'Cancelada';
  return 'Planeada';
};

const getDeliveryUnitTypeLabel = (type?: DeliveryUnitType) => {
  if (type === DeliveryUnitType.PHASE) return 'Fase';
  if (type === DeliveryUnitType.SERVICE) return 'Servicio';
  if (type === DeliveryUnitType.MAINTENANCE) return 'Mantenimiento';
  if (type === DeliveryUnitType.SUPPORT) return 'Soporte';
  if (type === DeliveryUnitType.MILESTONE) return 'Hito';
  return 'Otro';
};

const getDeliveryUnitPeriodText = (unit?: DeliveryUnit | null) => {
  if (!unit) return '-';
  if (unit.periodLabel) return unit.periodLabel;

  const start = unit.startDate ? dayjs(unit.startDate).format('DD/MM/YYYY') : '-';
  const end = unit.estimatedEndDate ? dayjs(unit.estimatedEndDate).format('DD/MM/YYYY') : '-';
  return `${start} - ${end}`;
};

const getFunctionalityStatusTag = (status?: string) => {
  const value = String(status || '');
  if (value === TestStatus.COMPLETED) return <Tag color="green">Completado</Tag>;
  if (value === TestStatus.IN_PROGRESS) return <Tag color="blue">En progreso</Tag>;
  if (value === TestStatus.FAILED) return <Tag color="red">Fallido</Tag>;
  if (value === TestStatus.MVP) return <Tag color="gold">MVP</Tag>;
  if (value === TestStatus.POST_MVP) return <Tag color="purple">Post MVP</Tag>;
  return <Tag color="default">Backlog</Tag>;
};

const getQaStatusTag = (status?: string) => {
  const value = String(status || '');
  const color =
    value === TestStatus.COMPLETED
      ? '#16a34a'
      : value === TestStatus.IN_PROGRESS
        ? '#2563eb'
        : value === TestStatus.FAILED
          ? '#dc2626'
          : '#64748b';

  return (
    <Tag
      className="rounded-full border px-3 py-0.5 text-xs font-medium"
      style={{ color, borderColor: `${color}33`, backgroundColor: '#ffffff' }}
    >
      {value || 'Sin estado'}
    </Tag>
  );
};

const getPriorityTag = (priority?: string) => {
  const value = String(priority || '');
  const color =
    value === 'Crítico'
      ? '#be123c'
      : value === 'Alto'
        ? '#dc2626'
        : value === 'Medio'
          ? '#d97706'
          : '#059669';

  return (
    <Tag
      className="rounded-full border-none px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}14` }}
    >
      {value || 'Sin prioridad'}
    </Tag>
  );
};

const TechnicalReportAnalysisCard: React.FC<TechnicalAnalysisCardProps> = ({
  projectId,
  input,
  resetKey,
  canUseAi,
  onRequireUpgrade,
}) => {
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setAnalysis('');
  }, [resetKey]);

  const handleGenerate = async () => {
    if (!canUseAi) {
      onRequireUpgrade();
      message.warning('El análisis técnico con IA está disponible en el plan Growth.');
      return;
    }

    if (!hasAiProviderConfigured()) {
      message.warning(
        'Configura VITE_GEMINI_API_KEY o VITE_GROQ_API_KEY en el .env del cliente para usar la generación con IA.',
      );
      return;
    }

    setIsGenerating(true);
    try {
      await authorizeAiAccess(projectId);
      const result = await analyzeTechnicalReportWithAI(input, projectId);
      setAnalysis(String(result || '').trim());
      message.success('Análisis técnico generado con IA.');
    } catch (error) {
      console.error('Technical report AI analysis failed:', error);
      message.error(
        error instanceof Error ? error.message : 'No pudimos generar el análisis técnico.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-100 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <ReadOutlined />
          <Title level={4} className="!mb-0">
            Análisis técnico con IA
          </Title>
        </div>
        <Button onClick={() => void handleGenerate()} loading={isGenerating}>
          Generar análisis IA
        </Button>
      </div>
      <Paragraph className="!mb-4 max-w-4xl text-sm leading-7 text-slate-500">
        La IA interpreta este reporte con base exclusiva en sus métricas, alcance y señales de
        riesgo para devolver una lectura técnica alineada al objetivo del informe.
      </Paragraph>
      <TextArea
        rows={14}
        value={analysis}
        onChange={event => setAnalysis(event.target.value)}
        placeholder="Aquí aparecerá un análisis técnico accionable con foco en este reporte."
        className="rounded-2xl"
      />
    </Card>
  );
};

const QAStatusExecutiveAnalysisCard: React.FC<{
  projectId: string;
  input: TechnicalReportAnalysisInput;
  resetKey: string;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
  insightCards: Array<{
    title: string;
    value: string;
    helper?: string;
  }>;
}> = ({ projectId, input, resetKey, canUseAi, onRequireUpgrade, insightCards }) => {
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setAnalysis('');
  }, [resetKey]);

  const handleGenerate = async () => {
    if (!canUseAi) {
      onRequireUpgrade();
      message.warning('El analisis ejecutivo con IA esta disponible en el plan Growth.');
      return;
    }

    if (!hasAiProviderConfigured()) {
      message.warning(
        'Configura VITE_GEMINI_API_KEY o VITE_GROQ_API_KEY en el .env del cliente para usar la generacion con IA.',
      );
      return;
    }

    setIsGenerating(true);
    try {
      await authorizeAiAccess(projectId);
      const result = await analyzeTechnicalReportWithAI(input, projectId);
      setAnalysis(String(result || '').trim());
      message.success('Analisis ejecutivo del ciclo generado con IA.');
    } catch (error) {
      console.error('QA status executive AI analysis failed:', error);
      message.error(
        error instanceof Error ? error.message : 'No pudimos generar el analisis del ciclo.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-100 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <ReadOutlined />
          <Title level={4} className="!mb-0">
            Analisis ejecutivo y tecnico con IA
          </Title>
        </div>
        <Button onClick={() => void handleGenerate()} loading={isGenerating}>
          Generar analisis IA
        </Button>
      </div>
      <Paragraph className="!mb-4 max-w-4xl text-sm leading-7 text-slate-500">
        Este bloque sintetiza el estado del ciclo con una lectura profesional, facil de revisar y
        lista para compartir en PDF con clientes o lideres tecnicos.
      </Paragraph>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {insightCards.map(card => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4"
          >
            <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {card.title}
            </Text>
            <Text strong className="mt-2 block text-base text-slate-900">
              {card.value}
            </Text>
            {card.helper ? (
              <Text className="mt-1 block text-xs leading-6 text-slate-500">{card.helper}</Text>
            ) : null}
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
        <div className="mb-3 flex items-center gap-2 text-slate-700">
          <FileTextOutlined />
          <Text strong>Lectura del ciclo</Text>
        </div>
        <div className="min-h-[280px] whitespace-pre-line text-sm leading-7 text-slate-700">
          {analysis || 'Aqui aparecera un analisis ejecutivo y tecnico listo para compartir.'}
        </div>
      </div>
    </Card>
  );
};

const SelectionCard: React.FC<SelectionCardProps> = ({
  type,
  title,
  description,
  format,
  selected,
  onSelect,
  icon,
  locked = false,
}) => (
  <Card
    hoverable
    className={`relative overflow-hidden transition-all duration-300 border-2 ${
      selected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'
    }`}
    onClick={() => onSelect(type)}
  >
    {locked && (
      <div className="absolute inset-0 z-10 rounded-[inherit] bg-white/55 backdrop-blur-[1px]" />
    )}
    {selected && (
      <div className="absolute top-3 right-3 text-blue-500 text-xl">
        <CheckCircleFilled />
      </div>
    )}
    {locked && (
      <div className="absolute right-3 top-3 z-20">
        <Tag color="gold" className="rounded-full px-3 py-1 font-semibold">
          <LockOutlined /> Disponible en Growth
        </Tag>
      </div>
    )}
    <div className="flex flex-col gap-4">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
          selected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {icon}
      </div>
      <div>
        <Title level={5} className="!mb-1">
          {title}
        </Title>
        <Paragraph type="secondary" className="text-xs !mb-3 line-clamp-2">
          {description}
        </Paragraph>
        {locked ? (
          <Text className="mb-3 block text-xs font-semibold text-amber-600">
            Reporte premium disponible en Growth
          </Text>
        ) : null}
        <Tag
          color={selected ? 'blue' : 'default'}
          className="rounded-full px-3 border-none font-medium"
        >
          {format}
        </Tag>
      </div>
    </div>
  </Card>
);

const QAStatusSummary: React.FC<{
  projectId: string;
  cycleId: string | null;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}> = ({
  projectId,
  cycleId,
  canUseAi,
  onRequireUpgrade,
}) => {
  const { data: bugs = [] } = useBugs(projectId);
  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  const { data: smokeCycles = [] } = useSmokeCycles(projectId);

  const cycle = useMemo(
    () => [...regressionCycles, ...smokeCycles].find(item => item.id === cycleId) || null,
    [cycleId, regressionCycles, smokeCycles],
  );

  const cycleBugs = useMemo(
    () => (cycle ? bugs.filter(bug => bug.cycleId === cycle.cycleId) : []),
    [bugs, cycle],
  );

  const activeCycleBugs = useMemo(
    () => cycleBugs.filter(bug => bug.status !== BugStatus.RESOLVED),
    [cycleBugs],
  );

  if (!cycle) return <Empty description="Seleccione un ciclo para ver el reporte" />;

  const executedTests = getExecutedCount(cycle);
  const executionCoverage = getPercent(executedTests, cycle.totalTests);
  const automatedCount = getAutomatedCount(cycle);
  const manualCount = getManualCount(cycle);
  const automationRate = getAutomationRate(cycle);
  const stabilityTone = getPassRateTone(cycle.passRate);
  const riskTone = getCycleRiskTone(cycle.failed, executedTests, activeCycleBugs.length);

  const pieData = [
    { name: 'Aprobados', value: cycle.passed, color: '#10b981' },
    { name: 'Fallidos', value: cycle.failed, color: '#ef4444' },
    { name: 'Bloqueados', value: cycle.blocked, color: '#f59e0b' },
    { name: 'Pendientes', value: cycle.pending, color: '#94a3b8' },
  ].filter(item => item.value > 0);

  const qualityMetrics = [
    {
      label: 'Estabilidad del sistema',
      value: <Tag color={stabilityTone.color}>{stabilityTone.label}</Tag>,
    },
    {
      label: 'Riesgo del ciclo',
      value: <Tag color={riskTone.color}>{riskTone.label}</Tag>,
    },
    {
      label: 'Cobertura de ejecución',
      value: <Text strong>{executionCoverage}%</Text>,
    },
    {
      label: 'Bugs activos del ciclo',
      value: <Text strong>{activeCycleBugs.length}</Text>,
    },
    {
      label: 'Pruebas ejecutadas',
      value: (
        <Text strong>
          {executedTests}/{cycle.totalTests}
        </Text>
      ),
    },
  ];

  const technicalAnalysisInput = useMemo<TechnicalReportAnalysisInput>(
    () => ({
      reportType: 'qa-status-summary',
      reportTitle: 'Resumen de Estado QA',
      reportPurpose:
        'Evaluar la salud técnica de un ciclo puntual, su cobertura real de ejecución, estabilidad y hallazgos de calidad.',
      scope: {
        cycleId: cycle.cycleId,
        cycleType: getCycleTypeLabel(cycle),
        sprint: cycle.sprint || 'N/A',
        executionDate: dayjs(cycle.date).format('YYYY-MM-DD'),
      },
      metrics: {
        passRate: cycle.passRate,
        totalTests: cycle.totalTests,
        executedTests,
        executionCoverage,
        automatedCount,
        manualCount,
        automationRate,
        failed: cycle.failed,
        blocked: cycle.blocked,
        pending: cycle.pending,
        activeBugs: activeCycleBugs.length,
      },
      highlights: [
        `La estabilidad del sistema para este ciclo fue catalogada como ${stabilityTone.label}.`,
        `El riesgo operativo del ciclo quedó en nivel ${riskTone.label}.`,
        `${executedTests} de ${cycle.totalTests} pruebas fueron ejecutadas.`,
      ],
      risks: [
        cycle.failed > 0 ? `${cycle.failed} pruebas fallidas requieren validación funcional o técnica.` : null,
        cycle.blocked > 0 ? `${cycle.blocked} pruebas bloqueadas limitan la lectura completa del ciclo.` : null,
        activeCycleBugs.length > 0 ? `${activeCycleBugs.length} bugs activos siguen abiertos para este ciclo.` : null,
      ].filter(Boolean),
      details: {
        impactedModules: Array.from(
          new Set(cycle.executions.map(execution => execution.module).filter(Boolean)),
        ),
        relatedBugs: cycleBugs.map(bug => ({
          id: bug.internalBugId,
          title: bug.title || 'Bug relacionado',
          status: bug.status,
          severity: bug.severity || null,
        })),
        executions: cycle.executions.slice(0, 15).map(execution => ({
          functionalityName: execution.functionalityName,
          module: execution.module,
          executionMode: getExecutionModeLabel(execution.executionMode),
          result: execution.result,
          bugId: execution.bugId || execution.linkedBugId || null,
        })),
      },
    }),
    [
      activeCycleBugs.length,
      automatedCount,
      automationRate,
      cycle,
      cycleBugs,
      executedTests,
      executionCoverage,
      manualCount,
      riskTone.label,
      stabilityTone.label,
    ],
  );

  const insightCards = [
    {
      title: 'Estado del ciclo',
      value: `${cycle.passRate}% de aprobacion`,
      helper: `${executedTests} de ${cycle.totalTests} pruebas ejecutadas`,
    },
    {
      title: 'Cobertura real',
      value: `${executionCoverage}% de cobertura`,
      helper: `${cycle.pending} pendientes y ${cycle.blocked} bloqueadas`,
    },
    {
      title: 'Riesgo actual',
      value: riskTone.label,
      helper: `${activeCycleBugs.length} bugs activos en el ciclo`,
    },
    {
      title: 'Automatizacion',
      value: `${automationRate}% automatizada`,
      helper: `${automatedCount} automatizadas y ${manualCount} manuales`,
    },
  ];

  return (
    <div
      id="report-content"
      className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
    >
      <div className="flex justify-between items-start border-b border-slate-100 pb-6">
        <div>
          <Title level={3} className="!mb-1">
            Resumen de Estado QA
          </Title>
          <Space split={<Divider type="vertical" />}>
            <Text type="secondary">
              <CalendarOutlined /> {dayjs(cycle.date).format('DD MMM, YYYY')}
            </Text>
            <Text type="secondary">
              <Tag color="blue">{getCycleTypeLabel(cycle)}</Tag>
            </Text>
            <Text type="secondary">Sprint: {cycle.sprint || 'N/A'}</Text>
          </Space>
        </div>
        <div className="text-right">
          <Text strong className="text-lg block">
            {cycle.cycleId}
          </Text>
          <Text type="secondary">ID de ciclo</Text>
        </div>
      </div>

      <Row gutter={24}>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Tasa de aprobación"
              value={cycle.passRate}
              suffix="%"
              valueStyle={{ color: '#10b981', fontWeight: 800 }}
            />
            <Progress percent={cycle.passRate} showInfo={false} strokeColor="#10b981" />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Total pruebas"
              value={cycle.totalTests}
              valueStyle={{ fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              Incluidas en este ciclo
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Bugs encontrados"
              value={cycleBugs.length}
              valueStyle={{ color: '#ef4444', fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              Bugs vinculados al ciclo
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Ejecución automatizada"
              value={automationRate}
              suffix="%"
              valueStyle={{ color: '#2563eb', fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              {automatedCount} automatizadas / {manualCount} manuales
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[32, 24]} className="mt-2">
        <Col xs={24} lg={12} className="!px-1">
          <Card title="Distribución de resultados" className="rounded-2xl border-slate-100 h-full">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              {pieData.map(entry => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-slate-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12} className="!px-1">
          <Card title="Métricas de calidad" className="rounded-2xl border-slate-100 h-full">
            <div className="space-y-4">
              {qualityMetrics.map((metric, index) => (
                <React.Fragment key={metric.label}>
                  <div className="flex justify-between items-center gap-4">
                    <Text>{metric.label}</Text>
                    {metric.value}
                  </div>
                  {index < qualityMetrics.length - 1 && <Divider className="!my-2" />}
                </React.Fragment>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <QAStatusExecutiveAnalysisCard
        projectId={projectId}
        input={technicalAnalysisInput}
        resetKey={cycle.id}
        canUseAi={canUseAi}
        onRequireUpgrade={onRequireUpgrade}
        insightCards={insightCards}
      />

      <div className="pt-3">
        <Card title="Detalle de ejecución" className="rounded-2xl border-slate-100 overflow-hidden">
        <Table
          dataSource={cycle.executions}
          rowKey="id"
          columns={[
            { title: 'Funcionalidad', dataIndex: 'functionalityName', key: 'name' },
            { title: 'Modulo', dataIndex: 'module', key: 'module' },
            {
              title: 'Ejecución',
              dataIndex: 'executionMode',
              key: 'executionMode',
              render: mode => (
                <Tag
                  color={
                    getExecutionModeLabel(mode) === ExecutionMode.AUTOMATED ? 'blue' : 'default'
                  }
                >
                  {getExecutionModeLabel(mode)}
                </Tag>
              ),
            },
            {
              title: 'Resultado',
              dataIndex: 'result',
              key: 'result',
              render: result => (
                <Tag
                  color={
                    result === TestResult.PASSED
                      ? 'green'
                      : result === TestResult.FAILED
                        ? 'red'
                        : result === TestResult.BLOCKED
                          ? 'orange'
                          : 'default'
                  }
                >
                  {result}
                </Tag>
              ),
            },
            {
              title: 'Bug ID',
              dataIndex: 'bugId',
              key: 'bugId',
              render: (_, record) => record.bugId || record.linkedBugId || '-',
            },
          ]}
          pagination={false}
          size="small"
        />
        </Card>
      </div>
    </div>
  );
};

const QAProgressReport: React.FC<{
  projectId: string;
  sprint: string | null;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}> = ({
  projectId,
  sprint,
  canUseAi,
  onRequireUpgrade,
}) => {
  const { data: bugs = [] } = useBugs(projectId);
  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  const { data: smokeCycles = [] } = useSmokeCycles(projectId);

  const filteredCycles = useMemo(() => {
    const finalizedCycles = [...regressionCycles, ...smokeCycles]
      .filter(cycle => cycle.status === 'FINALIZADA')
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

    if (!sprint) return finalizedCycles.slice(-6);

    const selectedKey = normalizeSprintKey(sprint);
    return finalizedCycles.filter(cycle => normalizeSprintKey(cycle.sprint) === selectedKey);
  }, [regressionCycles, smokeCycles, sprint]);

  const chartData = useMemo(
    () =>
      filteredCycles.map(cycle => ({
        name: cycle.cycleId,
        passRate: cycle.passRate,
        totalTests: cycle.totalTests,
        executed: getExecutedCount(cycle),
        automationRate: getAutomationRate(cycle),
      })),
    [filteredCycles],
  );

  const evolutionMetrics = useMemo(() => {
    const firstCycle = filteredCycles[0];
    const lastCycle = filteredCycles[filteredCycles.length - 1];

    if (!firstCycle || !lastCycle) {
      return {
        casesGrowth: 0,
        failureReduction: 0,
        executionVelocity: 0,
        latestExecutionCoverage: 0,
        averageAutomationRate: 0,
      };
    }

    const firstExecutionCoverage = getPercent(getExecutedCount(firstCycle), firstCycle.totalTests);
    const latestExecutionCoverage = getPercent(getExecutedCount(lastCycle), lastCycle.totalTests);

    return {
      casesGrowth: calculatePercentChange(lastCycle.totalTests, firstCycle.totalTests),
      failureReduction: calculatePercentChange(
        firstCycle.failed - lastCycle.failed,
        firstCycle.failed,
      ),
      executionVelocity: calculatePercentChange(latestExecutionCoverage, firstExecutionCoverage),
      latestExecutionCoverage,
      averageAutomationRate: average(filteredCycles.map(cycle => getAutomationRate(cycle))),
    };
  }, [filteredCycles]);

  const recentMilestones = useMemo(
    () =>
      [...filteredCycles]
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
        .slice(0, 3),
    [filteredCycles],
  );

  const averageExecutionFrequencyDays = useMemo(() => {
    if (filteredCycles.length < 2) return null;

    const gaps = filteredCycles
      .slice(1)
      .map((cycle, index) => dayjs(cycle.date).diff(dayjs(filteredCycles[index].date), 'day'))
      .filter(value => value >= 0);

    if (gaps.length === 0) return null;
    return average(gaps);
  }, [filteredCycles]);

  const technicalAnalysisInput = useMemo<TechnicalReportAnalysisInput>(
    () => ({
      reportType: 'qa-progress-report',
      reportTitle: 'Reporte de Progreso QA',
      reportPurpose:
        'Analizar la evolución de la calidad por ciclos, identificar tendencias y detectar cambios en cobertura y automatización.',
      scope: {
        sprint: sprint || 'ultimos-ciclos',
        analyzedCycles: filteredCycles.length,
        executionFrequencyDays: averageExecutionFrequencyDays,
        dateRange:
          filteredCycles.length > 0
            ? {
                from: dayjs(filteredCycles[0].date).format('YYYY-MM-DD'),
                to: dayjs(filteredCycles[filteredCycles.length - 1].date).format('YYYY-MM-DD'),
              }
            : null,
      },
      metrics: {
        averagePassRate: average(filteredCycles.map(cycle => cycle.passRate)),
        averageAutomationRate: evolutionMetrics.averageAutomationRate,
        latestExecutionCoverage: evolutionMetrics.latestExecutionCoverage,
        casesGrowth: evolutionMetrics.casesGrowth,
        failureReduction: evolutionMetrics.failureReduction,
        executionVelocity: evolutionMetrics.executionVelocity,
        totalBugsFound: filteredCycles.reduce(
          (sum, cycle) => sum + bugs.filter(bug => bug.cycleId === cycle.cycleId).length,
          0,
        ),
      },
      highlights: recentMilestones.map(
        cycle =>
          `${cycle.cycleId} (${getCycleTypeLabel(cycle)}): ${cycle.passRate}% pass rate, ${cycle.failed} fallidas, ${getAutomationRate(cycle)}% automatización.`,
      ),
      risks: [
        evolutionMetrics.failureReduction < 0
          ? 'La reducción de fallos es negativa y sugiere deterioro frente al ciclo base.'
          : null,
        evolutionMetrics.latestExecutionCoverage < 80
          ? 'La cobertura de ejecución más reciente sigue por debajo del 80%.'
          : null,
        evolutionMetrics.averageAutomationRate < 40
          ? 'La automatización promedio es baja para sostener velocidad y repetibilidad.'
          : null,
      ].filter(Boolean),
      details: {
        cycles: filteredCycles.map(cycle => ({
          cycleId: cycle.cycleId,
          cycleType: getCycleTypeLabel(cycle),
          sprint: cycle.sprint,
          date: dayjs(cycle.date).format('YYYY-MM-DD'),
          passRate: cycle.passRate,
          totalTests: cycle.totalTests,
          executed: getExecutedCount(cycle),
          failed: cycle.failed,
          automationRate: getAutomationRate(cycle),
          bugsFound: bugs.filter(bug => bug.cycleId === cycle.cycleId).length,
          impactedModules: Array.from(
            new Set(cycle.executions.map(execution => execution.module).filter(Boolean)),
          ),
          includedFunctionalities: cycle.executions.map(execution => execution.functionalityName),
          resultsSummary: {
            passed: cycle.passed,
            failed: cycle.failed,
            blocked: cycle.blocked,
            pending: cycle.pending,
          },
        })),
      },
    }),
    [averageExecutionFrequencyDays, bugs, evolutionMetrics, filteredCycles, recentMilestones, sprint],
  );

  if (filteredCycles.length === 0) {
    return <Empty description="No hay ciclos finalizados para el filtro seleccionado" />;
  }

  return (
    <div
      id="report-content"
      className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
    >
      <div className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <Title level={3} className="!mb-1">
            Reporte de Progreso QA
          </Title>
          <Paragraph type="secondary">
            Tendencia de calidad funcional y evolución de los ciclos
            {sprint ? ` en ${sprint}` : ' en los últimos ciclos'}.
          </Paragraph>
        </div>
        {sprint && (
          <Tag color="blue" className="mb-6 rounded-full px-4 py-1 font-bold">
            {sprint}
          </Tag>
        )}
      </div>

      <Card title="Tendencia de tasa de aprobación (%)" className="rounded-2xl border-slate-100">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="report-pass-rate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <RechartsTooltip />
              <Area
                type="monotone"
                dataKey="passRate"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#report-pass-rate)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="px-2 pt-2">
        <Row gutter={[36, 24]}>
        <Col xs={24} lg={12} className="!px-2">
          <Card title="Métricas de evolución" className="rounded-2xl border-slate-100">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Crecimiento de casos</Text>
                  <Text type={evolutionMetrics.casesGrowth >= 0 ? 'success' : 'danger'}>
                    {evolutionMetrics.casesGrowth > 0 ? '+' : ''}
                    {evolutionMetrics.casesGrowth}%
                  </Text>
                </div>
                <Progress
                  percent={Math.min(Math.abs(evolutionMetrics.casesGrowth), 100)}
                  strokeColor="#8b5cf6"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Reduccion de fallos</Text>
                  <Text type={evolutionMetrics.failureReduction >= 0 ? 'success' : 'danger'}>
                    {evolutionMetrics.failureReduction > 0 ? '+' : ''}
                    {evolutionMetrics.failureReduction}%
                  </Text>
                </div>
                <Progress
                  percent={Math.min(Math.abs(evolutionMetrics.failureReduction), 100)}
                  strokeColor="#10b981"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Velocidad de ejecución</Text>
                  <Text type={evolutionMetrics.executionVelocity >= 0 ? 'success' : 'danger'}>
                    {evolutionMetrics.executionVelocity > 0 ? '+' : ''}
                    {evolutionMetrics.executionVelocity}%
                  </Text>
                </div>
                <Progress
                  percent={evolutionMetrics.latestExecutionCoverage}
                  strokeColor="#f59e0b"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Promedio automatizado</Text>
                  <Text>{evolutionMetrics.averageAutomationRate}%</Text>
                </div>
                <Progress percent={evolutionMetrics.averageAutomationRate} strokeColor="#2563eb" />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12} className="!px-2">
          <Card title="Hitos recientes" className="rounded-2xl border-slate-100">
            <div className="space-y-4">
              {recentMilestones.map(cycle => {
                const tone = getPassRateTone(cycle.passRate);
                const icon =
                  tone.color === 'green' ? (
                    <CheckCircleOutlined />
                  ) : tone.color === 'orange' ? (
                    <ClockCircleOutlined />
                  ) : (
                    <CloseCircleOutlined />
                  );

                const iconClass =
                  tone.color === 'green'
                    ? 'bg-green-100 text-green-600'
                    : tone.color === 'orange'
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-rose-100 text-rose-600';

                return (
                  <div className="flex gap-3" key={cycle.id}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}
                    >
                      {icon}
                    </div>
                    <div>
                      <Text strong className="block">
                        {cycle.cycleId} · {getCycleTypeLabel(cycle)}
                      </Text>
                      <Text type="secondary" className="text-xs">
                        {dayjs(cycle.date).format('DD/MM/YYYY')} · {cycle.passed}/{cycle.totalTests}{' '}
                        aprobadas · {cycle.failed} fallidas
                      </Text>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
        </Row>
      </div>

      <TechnicalReportAnalysisCard
        projectId={projectId}
        input={technicalAnalysisInput}
        resetKey={`${sprint || 'all'}-${filteredCycles.map(cycle => cycle.id).join(',')}`}
        canUseAi={canUseAi}
        onRequireUpgrade={onRequireUpgrade}
      />
    </div>
  );
};

const ProjectStatusReport: React.FC<{
  projectId: string;
  sprint: string | null;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}> = ({
  projectId,
  sprint,
  canUseAi,
  onRequireUpgrade,
}) => {
  const { data: functionalities = [] } = useFunctionalities(projectId);
  const { data: testCases = [] } = useTestCases(projectId);
  const { data: bugs = [] } = useBugs(projectId);
  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  const { data: smokeCycles = [] } = useSmokeCycles(projectId);

  const stats = useMemo(() => {
    const selectedSprintKey = normalizeSprintKey(sprint);
    const filteredFunctionalities = sprint
      ? functionalities.filter(item => normalizeSprintKey(item.sprint) === selectedSprintKey)
      : functionalities;

    const functionalityIds = new Set(filteredFunctionalities.map(item => item.id));
    const filteredTestCases = sprint
      ? testCases.filter(item => functionalityIds.has(item.functionalityId))
      : testCases;

    const filteredCycles = [...regressionCycles, ...smokeCycles].filter(cycle => {
      if (!sprint) return true;
      return normalizeSprintKey(cycle.sprint) === selectedSprintKey;
    });

    const filteredBugs = bugs.filter(bug => {
      if (!sprint) return true;

      const bugSprintMatches = normalizeSprintKey(bug.sprint) === selectedSprintKey;
      const bugFunctionalityMatches = functionalityIds.has(bug.functionalityId);
      const bugCycleMatches = filteredCycles.some(cycle => cycle.cycleId === bug.cycleId);

      return bugSprintMatches || bugFunctionalityMatches || bugCycleMatches;
    });

    const activeBugs = filteredBugs.filter(bug => bug.status !== BugStatus.RESOLVED);
    const finalizedCycles = filteredCycles.filter(cycle => cycle.status === 'FINALIZADA');
    const averagePassRate = average(finalizedCycles.map(cycle => cycle.passRate));
    const averageAutomationRate = average(filteredCycles.map(cycle => getAutomationRate(cycle)));
    const pendingCycleTests = filteredCycles.reduce(
      (sum, cycle) => sum + cycle.pending + cycle.blocked,
      0,
    );
    const completed = filteredFunctionalities.filter(
      item => item.status === TestStatus.COMPLETED,
    ).length;
    const highRisk = filteredFunctionalities.filter(
      item => item.riskLevel === RiskLevel.HIGH,
    ).length;
    const core = filteredFunctionalities.filter(item => item.isCore).length;
    const regression = filteredFunctionalities.filter(item => item.isRegression).length;
    const smoke = filteredFunctionalities.filter(item => item.isSmoke).length;
    const riskTone = getProjectRiskTone(activeBugs.length, highRisk, averagePassRate);

    return {
      total: filteredFunctionalities.length,
      completed,
      progress:
        filteredFunctionalities.length > 0
          ? getPercent(completed, filteredFunctionalities.length)
          : 0,
      highRisk,
      testCasesCount: filteredTestCases.length,
      activeBugsCount: activeBugs.length,
      cycleCount: filteredCycles.length,
      averagePassRate,
      averageAutomationRate,
      pendingCycleTests,
      riskTone,
      core,
      regression,
      smoke,
    };
  }, [bugs, functionalities, regressionCycles, smokeCycles, sprint, testCases]);

  const barData = [
    { name: 'Total', value: stats.total, fill: '#3b82f6' },
    { name: 'Completadas', value: stats.completed, fill: '#10b981' },
    { name: 'Casos', value: stats.testCasesCount, fill: '#8b5cf6' },
    { name: 'Bugs activos', value: stats.activeBugsCount, fill: '#ef4444' },
    { name: 'Ciclos', value: stats.cycleCount, fill: '#f59e0b' },
  ];

  const selectedSprintKey = normalizeSprintKey(sprint);
  const filteredFunctionalities = useMemo(
    () =>
      sprint
        ? functionalities.filter(item => normalizeSprintKey(item.sprint) === selectedSprintKey)
        : functionalities,
    [functionalities, selectedSprintKey, sprint],
  );

  const filteredCycles = useMemo(
    () =>
      [...regressionCycles, ...smokeCycles].filter(cycle => {
        if (!sprint) return true;
        return normalizeSprintKey(cycle.sprint) === selectedSprintKey;
      }),
    [regressionCycles, selectedSprintKey, smokeCycles, sprint],
  );

  const filteredBugs = useMemo(
    () => {
      if (!sprint) return bugs;
      const functionalityIds = new Set(filteredFunctionalities.map(item => item.id));
      return bugs.filter(bug => {
        const bugSprintMatches = normalizeSprintKey(bug.sprint) === selectedSprintKey;
        const bugFunctionalityMatches = functionalityIds.has(bug.functionalityId);
        const bugCycleMatches = filteredCycles.some(cycle => cycle.cycleId === bug.cycleId);
        return bugSprintMatches || bugFunctionalityMatches || bugCycleMatches;
      });
    },
    [bugs, filteredCycles, filteredFunctionalities, selectedSprintKey, sprint],
  );

  const activeProjectBugs = useMemo(
    () => filteredBugs.filter(bug => bug.status !== BugStatus.RESOLVED),
    [filteredBugs],
  );

  const technicalAnalysisInput = useMemo<TechnicalReportAnalysisInput>(
    () => ({
      reportType: 'project-status-report',
      reportTitle: 'Estado del Proyecto',
      reportPurpose:
        'Ofrecer una lectura técnica del avance global del proyecto, su cobertura de prueba y el riesgo actual para la operación QA.',
      scope: {
        sprint: sprint || 'global',
      },
      metrics: {
        totalFunctionalities: stats.total,
        completedFunctionalities: stats.completed,
        progressPercent: stats.progress,
        highRiskFunctionalities: stats.highRisk,
        testCasesCount: stats.testCasesCount,
        activeBugsCount: stats.activeBugsCount,
        cycleCount: stats.cycleCount,
        averagePassRate: stats.averagePassRate,
        averageAutomationRate: stats.averageAutomationRate,
        pendingCycleTests: stats.pendingCycleTests,
        coreFunctionalities: stats.core,
        regressionFunctionalities: stats.regression,
        smokeFunctionalities: stats.smoke,
        projectRiskLevel: stats.riskTone.label,
      },
      highlights: [
        `El proyecto presenta un avance funcional del ${stats.progress}%.`,
        `La tasa promedio de aprobación en ciclos es ${stats.averagePassRate}%.`,
        `Actualmente existen ${stats.activeBugsCount} bugs activos en el alcance analizado.`,
      ],
      risks: [
        stats.highRisk > 0
          ? `${stats.highRisk} funcionalidades están marcadas con riesgo alto.`
          : null,
        stats.pendingCycleTests > 0
          ? `${stats.pendingCycleTests} pruebas siguen pendientes o bloqueadas en ciclos asociados.`
          : null,
        stats.averagePassRate < 85
          ? `La tasa promedio de aprobación aún está por debajo del objetivo saludable (85%).`
          : null,
      ].filter(Boolean),
      details: {
        categoryBars: barData,
        impactedModules: Array.from(
          new Set(filteredFunctionalities.map(item => item.module).filter(Boolean)),
        ),
        functionalityStatusBreakdown: {
          completed: filteredFunctionalities.filter(item => item.status === TestStatus.COMPLETED)
            .length,
          inProgress: filteredFunctionalities.filter(item => item.status === TestStatus.IN_PROGRESS)
            .length,
          failed: filteredFunctionalities.filter(item => item.status === TestStatus.FAILED).length,
          other:
            filteredFunctionalities.length -
            filteredFunctionalities.filter(item =>
              [TestStatus.COMPLETED, TestStatus.IN_PROGRESS, TestStatus.FAILED].includes(
                item.status as TestStatus,
              ),
            ).length,
        },
        activeBugs: activeProjectBugs.slice(0, 20).map(bug => ({
          id: bug.internalBugId,
          title: bug.title,
          severity: bug.severity || null,
          module: bug.module,
          status: bug.status,
        })),
        cycles: filteredCycles.map(cycle => ({
          cycleId: cycle.cycleId,
          sprint: cycle.sprint,
          type: getCycleTypeLabel(cycle),
          passRate: cycle.passRate,
          pending: cycle.pending,
          blocked: cycle.blocked,
        })),
      },
    }),
    [activeProjectBugs, barData, filteredCycles, filteredFunctionalities, sprint, stats],
  );

  return (
    <div
      id="report-content"
      className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
    >
      <div className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <Title level={3} className="!mb-1">
            Reporte de Estado del Proyecto
          </Title>
          <Paragraph type="secondary">
            Visión global del avance funcional, cobertura por casos y riesgos
            {sprint ? ` para ${sprint}` : ''}.
          </Paragraph>
        </div>
        {sprint && (
          <Tag color="blue" className="mb-6 rounded-full px-4 py-1 font-bold">
            {sprint}
          </Tag>
        )}
      </div>

      <Row gutter={24}>
        <Col span={15}>
          <Card title="Avance por categoría" className="rounded-2xl border-slate-100 h-full">
            <div className="mb-4 flex flex-wrap gap-2">
              {barData.map(item => (
                <Tag
                  key={item.name}
                  className="m-0 rounded-full border-none px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: `${item.fill}1A`, color: item.fill }}
                >
                  {item.name}: {item.value}
                </Tag>
              ))}
            </div>
            <div className="h-[280px] pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 28, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Bar
                    dataKey="value"
                    radius={[10, 10, 0, 0]}
                    barSize={44}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={9}>
          <Card title="Resumen ejecutivo" className="rounded-2xl border-slate-100 h-full">
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 px-5 py-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Progreso general
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-4xl font-bold text-slate-800">{stats.progress}%</span>
                  <span className="text-sm font-semibold text-slate-500">
                    {stats.completed}/{stats.total || 0}
                  </span>
                </div>
                <Progress
                  percent={stats.progress}
                  showInfo={false}
                  strokeColor="#3b82f6"
                  className="mt-3"
                />
              </div>
              <Divider />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Text type="secondary">Funcionalidades:</Text>
                  <Text strong>{stats.total}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Casos de prueba:</Text>
                  <Text strong>{stats.testCasesCount}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Bugs activos:</Text>
                  <Text strong>{stats.activeBugsCount}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Promedio de ciclos:</Text>
                  <Text strong>{stats.averagePassRate}%</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Promedio automatizado:</Text>
                  <Text strong>{stats.averageAutomationRate}%</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Core / Regresión / Smoke:</Text>
                  <Text strong>
                    {stats.core} / {stats.regression} / {stats.smoke}
                  </Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Nivel de riesgo:</Text>
                  <Tag color={stats.riskTone.color}>{stats.riskTone.label}</Tag>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Análisis de riesgos" className="rounded-2xl border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
            <div className="flex items-center gap-2 mb-2 text-rose-700">
              <SafetyCertificateOutlined />
              <Text strong className="!text-rose-900">
                Riesgo funcional
              </Text>
            </div>
            <Text className="text-xs text-rose-700">
              {stats.highRisk > 0
                ? `Existen ${stats.highRisk} funcionalidades de alto riesgo dentro del alcance del reporte.`
                : 'No hay funcionalidades de alto riesgo dentro del alcance del reporte.'}
            </Text>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-center gap-2 mb-2 text-amber-700">
              <ClockCircleOutlined />
              <Text strong className="!text-amber-900">
                Riesgo de tiempo
              </Text>
            </div>
            <Text className="text-xs text-amber-700">
              {stats.pendingCycleTests > 0
                ? `Quedan ${stats.pendingCycleTests} pruebas pendientes o bloqueadas en los ciclos filtrados.`
                : 'No hay pruebas pendientes ni bloqueadas en los ciclos filtrados.'}
            </Text>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="flex items-center gap-2 mb-2 text-blue-700">
              <BugOutlined />
              <Text strong className="!text-blue-900">
                Riesgo de calidad
              </Text>
            </div>
            <Text className="text-xs text-blue-700">
              {stats.activeBugsCount > 0
                ? `Hay ${stats.activeBugsCount} bugs activos y una tasa promedio de aprobación de ${stats.averagePassRate}%.`
                : `No hay bugs activos y la tasa promedio de aprobación de los ciclos es ${stats.averagePassRate}%.`}
            </Text>
          </div>
        </div>
      </Card>

      <div className="pt-3">
        <TechnicalReportAnalysisCard
        projectId={projectId}
        input={technicalAnalysisInput}
        resetKey={`${sprint || 'global'}-${stats.total}-${stats.activeBugsCount}-${stats.averagePassRate}`}
        canUseAi={canUseAi}
        onRequireUpgrade={onRequireUpgrade}
        />
      </div>
    </div>
  );
};

const DeliveryUnitProgressReport: React.FC<{
  projectId: string;
  deliveryUnitId: string | null;
  projectName?: string;
  proposalOwner?: string;
  canUseExports?: boolean;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}> = ({
  projectId,
  deliveryUnitId,
  projectName,
  proposalOwner,
  canUseExports = false,
  canUseAi,
  onRequireUpgrade,
}) => {
  const { data: deliveryUnits = [] } = useDeliveryUnits(projectId);
  const { data: functionalities = [] } = useFunctionalities(projectId);
  const { data: testCases = [] } = useTestCases(projectId);
  const { data: bugs = [] } = useBugs(projectId);

  const selectedDeliveryUnit = useMemo(
    () => deliveryUnits.find(item => (item.documentId || item.id) === deliveryUnitId) || null,
    [deliveryUnitId, deliveryUnits],
  );

  const scopedFunctionalities = useMemo(
    () =>
      functionalities.filter(
        item => item.deliveryUnitId && item.deliveryUnitId === (selectedDeliveryUnit?.documentId || selectedDeliveryUnit?.id),
      ),
    [functionalities, selectedDeliveryUnit],
  );

  const functionalityIds = useMemo(
    () => new Set(scopedFunctionalities.map(item => item.id)),
    [scopedFunctionalities],
  );

  const scopedTestCases = useMemo(
    () => testCases.filter(item => functionalityIds.has(item.functionalityId)),
    [functionalityIds, testCases],
  );

  const scopedBugs = useMemo(
    () => bugs.filter(item => functionalityIds.has(item.functionalityId)),
    [bugs, functionalityIds],
  );

  const activeBugs = useMemo(
    () => scopedBugs.filter(item => item.status !== BugStatus.RESOLVED),
    [scopedBugs],
  );
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
  const [aiIntroduction, setAiIntroduction] = useState('');
  const [aiObjectives, setAiObjectives] = useState('');
  const [aiConclusion, setAiConclusion] = useState('');

  const completedCount = scopedFunctionalities.filter(item => item.status === TestStatus.COMPLETED).length;
  const inProgressCount = scopedFunctionalities.filter(item => item.status === TestStatus.IN_PROGRESS).length;
  const failedCount = scopedFunctionalities.filter(item => item.status === TestStatus.FAILED).length;
  const pendingCount = scopedFunctionalities.length - completedCount - inProgressCount - failedCount;
  const highRiskCount = scopedFunctionalities.filter(item => item.riskLevel === RiskLevel.HIGH).length;
  const mediumRiskCount = scopedFunctionalities.filter(item => item.riskLevel === RiskLevel.MEDIUM).length;
  const progressPercent = scopedFunctionalities.length
    ? Math.round((completedCount / scopedFunctionalities.length) * 100)
    : 0;
  const selectedActivities = Array.isArray(selectedDeliveryUnit?.activities)
    ? selectedDeliveryUnit.activities
    : [];

  const aiContext = useMemo(
    () => ({
      deliveryUnit: {
        name: selectedDeliveryUnit?.name || '',
        type: selectedDeliveryUnit?.type,
        status: selectedDeliveryUnit?.status,
        periodLabel: selectedDeliveryUnit?.periodLabel,
        startDate: selectedDeliveryUnit?.startDate,
        estimatedEndDate: selectedDeliveryUnit?.estimatedEndDate,
        baseDescription: selectedDeliveryUnit?.baseDescription,
      },
      activities: selectedActivities.map(activity => ({
        name: activity.name,
        description: activity.description,
      })),
      functionalities: scopedFunctionalities.map(item => ({
        name: item.name,
        status: item.status,
        priority: item.priority,
        module: item.module,
      })),
      metrics: {
        totalFunctionalities: scopedFunctionalities.length,
        completed: completedCount,
        inProgress: inProgressCount,
        pending: pendingCount,
        activeBugs: activeBugs.length,
        testCasesCount: scopedTestCases.length,
        progressPercent,
      },
    }),
    [
      activeBugs.length,
      completedCount,
      inProgressCount,
      pendingCount,
      progressPercent,
      scopedFunctionalities,
      scopedTestCases.length,
      selectedActivities,
      selectedDeliveryUnit,
    ],
  );

  const reportRows = scopedFunctionalities.map(item => {
    const itemBugs = activeBugs.filter(bug => bug.functionalityId === item.id);
    return {
      key: item.id,
      functionality: item.name,
      module: item.module,
      status: item.status,
      priority: item.priority,
      qaStatus: item.status,
      bugs: itemBugs.length,
      observations:
        itemBugs.length > 0
          ? `${itemBugs.length} bug(s) activo(s)`
          : item.riskLevel === RiskLevel.HIGH
            ? 'Riesgo alto detectado'
            : 'Sin alertas críticas',
    };
  });

  const typeLabel = getDeliveryUnitTypeLabel(selectedDeliveryUnit?.type);
  const statusLabel = getDeliveryUnitStatusLabel(selectedDeliveryUnit?.status);
  const periodText = getDeliveryUnitPeriodText(selectedDeliveryUnit);

  const executiveSummary = `Durante esta unidad de entrega se registraron ${selectedActivities.length} actividades realizadas y ${scopedFunctionalities.length} funcionalidades asociadas. De las funcionalidades asociadas, ${completedCount} estan completadas, ${inProgressCount} en progreso y ${pendingCount + failedCount} pendientes, fallidas o con riesgo operativo.`;
  const generatedAtLabel = dayjs().format('DD/MM/YYYY');

  const buildConservativeFallback = () => {
    const deliveryUnitName = selectedDeliveryUnit?.name || 'la unidad seleccionada';
    const introduction = selectedDeliveryUnit?.baseDescription?.trim()
      ? `La unidad de entrega "${deliveryUnitName}" se presenta con base en el alcance definido y la informacion operativa registrada para su seguimiento.`
      : `La unidad de entrega "${deliveryUnitName}" consolida la informacion operativa y funcional registrada para esta etapa del proyecto.`;

    const objectivesLines = [
      selectedActivities.length > 0
        ? `- Ejecutar las actividades operativas registradas para la unidad seleccionada.`
        : `- Mantener seguimiento operativo del alcance definido para la unidad seleccionada.`,
      scopedFunctionalities.length > 0
        ? `- Dar trazabilidad a las funcionalidades asociadas dentro del alcance actual.`
        : `- Preparar el seguimiento funcional conforme se registren nuevas funcionalidades en la unidad.`,
      activeBugs.length > 0
        ? `- Dar visibilidad a los hallazgos activos relacionados con esta unidad de entrega.`
        : `- Mantener control del avance funcional y de la cobertura registrada para esta unidad.`,
    ].join('\n');

    const conclusion =
      scopedFunctionalities.length > 0
        ? `Actualmente se registran ${scopedFunctionalities.length} funcionalidades asociadas, con ${completedCount} completadas y ${inProgressCount} en progreso. La informacion disponible permite continuar el seguimiento de la unidad y preparar la siguiente etapa con base en datos reales.`
        : `La unidad cuenta con informacion operativa disponible y puede seguir ampliandose a medida que se registren funcionalidades y evidencias adicionales.`;

    return {
      introduction,
      objectives: objectivesLines,
      conclusion,
    };
  };

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAiSummary(true);

    try {
      const result = await generateDeliveryUnitSummaryWithAI(aiContext, projectId);
      setAiIntroduction(String(result?.introduction || '').trim());
      setAiObjectives(String(result?.objectives || '').trim());
      setAiConclusion(String(result?.conclusion || '').trim());
      message.success('Resumen IA generado correctamente.');
    } catch (error) {
      console.error('AI delivery unit summary failed:', error);
      const fallback = buildConservativeFallback();
      setAiIntroduction(fallback.introduction);
      setAiObjectives(fallback.objectives);
      setAiConclusion(fallback.conclusion);
      message.warning('No se pudo generar el resumen con IA. Se cargo un borrador conservador.');
    } finally {
      setIsGeneratingAiSummary(false);
    }
  };

  useEffect(() => {
    setAiIntroduction('');
    setAiObjectives('');
    setAiConclusion('');
  }, [deliveryUnitId]);

  const deliveryUnitDocxData = useMemo(
    () => ({
      projectName: projectName || 'Proyecto actual',
      deliveryUnitName: selectedDeliveryUnit?.name || 'Unidad de entrega',
      typeLabel,
      statusLabel,
      generatedAtLabel,
      periodLabel: periodText,
      proposalOwner: proposalOwner || 'No definido',
      scopeDescription:
        selectedDeliveryUnit?.baseDescription || 'Sin descripcion base registrada.',
      executiveSummary,
      aiIntroduction: aiIntroduction.trim(),
      aiObjectives: aiObjectives.trim(),
      aiConclusion: aiConclusion.trim(),
      metrics: {
        totalFunctionalities: scopedFunctionalities.length,
        completedCount,
        inProgressCount,
        pendingCount,
        failedCount,
        activeBugsCount: activeBugs.length,
        testCasesCount: scopedTestCases.length,
        progressPercent,
      },
      activities: selectedActivities.map(activity => ({
        name: activity.name,
        description: activity.description,
      })),
      functionalities: reportRows.map(row => ({
        functionality: row.functionality,
        module: row.module,
        status: row.status,
        priority: row.priority,
        qaStatus: row.qaStatus,
        bugs: row.bugs,
        observations: row.observations,
      })),
    }),
    [
      activeBugs.length,
      aiConclusion,
      aiIntroduction,
      aiObjectives,
      completedCount,
      executiveSummary,
      failedCount,
      generatedAtLabel,
      inProgressCount,
      pendingCount,
      periodText,
      projectName,
      progressPercent,
      proposalOwner,
      reportRows,
      scopedFunctionalities.length,
      scopedTestCases.length,
      selectedActivities,
      selectedDeliveryUnit,
      statusLabel,
      typeLabel,
    ],
  );

  const technicalAnalysisInput = useMemo<TechnicalReportAnalysisInput>(
    () => ({
      reportType: 'delivery-unit-progress-report',
      reportTitle: 'Progreso por Unidad',
      reportPurpose:
        'Interpretar el avance técnico y funcional de una unidad de entrega, su nivel de riesgo y la preparación QA del alcance asociado.',
      scope: {
        deliveryUnitName: selectedDeliveryUnit?.name || 'Unidad de entrega',
        deliveryUnitType: typeLabel,
        status: statusLabel,
        period: periodText,
      },
      metrics: {
        totalFunctionalities: scopedFunctionalities.length,
        completedCount,
        inProgressCount,
        pendingCount,
        failedCount,
        activeBugsCount: activeBugs.length,
        testCasesCount: scopedTestCases.length,
        progressPercent,
        highRiskCount,
        mediumRiskCount,
        activitiesCount: selectedActivities.length,
      },
      highlights: [
        executiveSummary,
        `La unidad registra ${selectedActivities.length} actividades operativas y ${scopedFunctionalities.length} funcionalidades asociadas.`,
      ],
      risks: [
        highRiskCount > 0 ? `${highRiskCount} funcionalidades de esta unidad tienen riesgo alto.` : null,
        failedCount > 0 ? `${failedCount} funcionalidades aparecen como fallidas dentro de la unidad.` : null,
        activeBugs.length > 0 ? `${activeBugs.length} bugs activos impactan el alcance de la unidad.` : null,
      ].filter(Boolean),
      details: {
        unitSummary: {
          name: selectedDeliveryUnit?.name || 'Unidad de entrega',
          status: statusLabel,
          type: typeLabel,
          period: periodText,
        },
        impactedModules: Array.from(
          new Set(reportRows.map(row => row.module).filter(Boolean)),
        ),
        bugDetails: activeBugs.map(bug => ({
          id: bug.internalBugId,
          title: bug.title,
          severity: bug.severity || null,
          module: bug.module,
          status: bug.status,
        })),
        functionalities: reportRows.map(row => ({
          functionality: row.functionality,
          module: row.module,
          status: row.status,
          priority: row.priority,
          bugs: row.bugs,
          observations: row.observations,
        })),
        activities: selectedActivities.map(activity => ({
          name: activity.name,
          description: activity.description,
        })),
      },
    }),
    [
      activeBugs.length,
      completedCount,
      executiveSummary,
      failedCount,
      highRiskCount,
      inProgressCount,
      mediumRiskCount,
      pendingCount,
      periodText,
      progressPercent,
      reportRows,
      scopedFunctionalities.length,
      scopedTestCases.length,
      selectedActivities,
      selectedDeliveryUnit,
      statusLabel,
      typeLabel,
    ],
  );

  const handleExportWord = async () => {
    try {
      await runTrackedExport({
        projectId,
        action: () => exportDeliveryUnitProgressToDocx(deliveryUnitDocxData),
      });
      message.success('Reporte Word generado correctamente.');
    } catch (error) {
      console.error('Delivery unit DOCX export failed:', error);
      message.error('No se pudo generar el reporte en Word.');
    }
  };

  if (!selectedDeliveryUnit) {
    return <Empty description="Selecciona una unidad de entrega para ver el reporte." />;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm print:shadow-none">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
            <div className="space-y-3">
              <Text className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Reporte de progreso
              </Text>
              <Title level={2} className="!mb-0 !text-slate-900">
                {selectedDeliveryUnit.name}
              </Title>
              <Space wrap size={[8, 8]}>
                <Tag color="blue">{typeLabel}</Tag>
                {getDeliveryUnitStatusTag(selectedDeliveryUnit.status)}
                {selectedDeliveryUnit.periodLabel ? <Tag>{selectedDeliveryUnit.periodLabel}</Tag> : null}
              </Space>
            </div>
            <div className="grid min-w-[260px] grid-cols-1 gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div>
                <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Proyecto
                </Text>
                <Text strong>{projectName || 'Proyecto actual'}</Text>
              </div>
              <div>
                <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Fecha de generación
                </Text>
                <Text strong>{generatedAtLabel}</Text>
              </div>
              <div>
                <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Periodo
                </Text>
                <Text strong>{periodText}</Text>
              </div>
              <div>
                <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Responsable
                </Text>
                <Text strong>{proposalOwner || 'No definido'}</Text>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              icon={<FileTextOutlined />}
              onClick={() => void handleExportWord()}
              disabled={!canUseExports}
            >
              Exportar Word (.docx)
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Alcance de la unidad
            </Text>
            <Paragraph className="!mb-0 max-w-4xl text-sm leading-7 text-slate-600">
              {selectedDeliveryUnit.baseDescription || 'Sin descripcion base registrada.'}
            </Paragraph>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-12">
        <Card className="rounded-2xl border-slate-100 md:col-span-3">
          <Statistic title="Funcionalidades" value={scopedFunctionalities.length} />
        </Card>
        <Card className="rounded-2xl border-slate-100 md:col-span-3">
          <Statistic title="Completadas" value={completedCount} />
        </Card>
        <Card className="rounded-2xl border-slate-100 md:col-span-3">
          <Statistic title="En progreso" value={inProgressCount} />
        </Card>
        <Card className="rounded-2xl border-slate-100 md:col-span-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <Text className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Avance general
              </Text>
              <Title level={3} className="!mb-0 !text-slate-900">
                {progressPercent}%
              </Title>
            </div>
            <CheckCircleOutlined className="text-lg text-emerald-500" />
          </div>
          <Progress
            percent={progressPercent}
            showInfo={false}
            strokeColor="#2563eb"
            trailColor="#e2e8f0"
            strokeWidth={12}
          />
        </Card>
      </div>

      <div className="pt-3">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800">
            <CheckCircleOutlined />
            <Title level={4} className="!mb-0">
              Resumen ejecutivo
            </Title>
          </div>
          <Button
            type="default"
            onClick={() => void handleGenerateAiSummary()}
            loading={isGeneratingAiSummary}
          >
            Generar resumen IA
          </Button>
        </div>
        <Paragraph className="!mb-5 max-w-4xl text-base leading-8 text-slate-600">
          {executiveSummary}
        </Paragraph>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
            <Text className="block text-xs uppercase tracking-wider text-slate-400">Pendientes / backlog</Text>
            <Text strong className="text-base text-slate-900">{pendingCount}</Text>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-rose-50/60 px-4 py-4">
            <Text className="block text-xs uppercase tracking-wider text-slate-400">Bugs activos</Text>
            <Text strong className="text-base text-slate-900">{activeBugs.length}</Text>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-emerald-50/50 px-4 py-4">
            <Text className="block text-xs uppercase tracking-wider text-slate-400">Casos asociados</Text>
            <Text strong className="text-base text-slate-900">{scopedTestCases.length}</Text>
          </div>
        </div>
        </Card>
      </div>

      <div className="pt-3">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <ReadOutlined />
          <Title level={4} className="!mb-0">
            Resumen asistido por IA
          </Title>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileTextOutlined className="text-slate-400" />
              <Text strong className="text-slate-800">
                Introducción
              </Text>
            </div>
            <TextArea
              rows={4}
              value={aiIntroduction}
              onChange={event => setAiIntroduction(event.target.value)}
              bordered={false}
              className="rounded-xl bg-white/70 px-0 text-sm leading-7 text-slate-700"
              placeholder="Aqui se mostrara la introduccion generada con base exclusiva en esta unidad."
            />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <FlagOutlined className="text-slate-400" />
              <Text strong className="text-slate-800">
                Objetivos
              </Text>
            </div>
            <TextArea
              rows={5}
              value={aiObjectives}
              onChange={event => setAiObjectives(event.target.value)}
              bordered={false}
              className="rounded-xl bg-white/70 px-0 text-sm leading-7 text-slate-700"
              placeholder="Aqui se mostraran los objetivos generados con base exclusiva en esta unidad."
            />
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckOutlined className="text-slate-400" />
              <Text strong className="text-slate-800">
                Conclusión
              </Text>
            </div>
            <TextArea
              rows={4}
              value={aiConclusion}
              onChange={event => setAiConclusion(event.target.value)}
              bordered={false}
              className="rounded-xl bg-white/70 px-0 text-sm leading-7 text-slate-700"
              placeholder="Aqui se mostrara la conclusion generada con base exclusiva en esta unidad."
            />
          </div>
        </div>
        </Card>
      </div>

      <div className="pt-3">
        <TechnicalReportAnalysisCard
          projectId={projectId}
          input={technicalAnalysisInput}
          resetKey={selectedDeliveryUnit.documentId || selectedDeliveryUnit.id}
          canUseAi={canUseAi}
          onRequireUpgrade={onRequireUpgrade}
        />
      </div>

      <div className="pt-3">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <FolderOpenOutlined />
          <Title level={4} className="!mb-0">
            Actividades realizadas
          </Title>
        </div>
        {selectedActivities.length > 0 ? (
          <div className="space-y-4">
            {selectedActivities.map((activity, index) => (
              <div key={activity.documentId || activity.id} className="flex gap-4">
                <div className="flex w-10 flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <CalendarOutlined />
                  </div>
                  {index < selectedActivities.length - 1 ? (
                    <div className="mt-2 h-full w-px bg-slate-200" />
                  ) : null}
                </div>
                <div
                  className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Text strong className="text-slate-800">{activity.name}</Text>
                    {selectedDeliveryUnit.periodLabel ? (
                      <Tag className="rounded-full border-none bg-slate-100 px-3 py-1 text-xs text-slate-500">
                        {selectedDeliveryUnit.periodLabel}
                      </Tag>
                    ) : null}
                  </div>
                  <Text type="secondary" className="mt-2 block text-sm leading-7">
                    {activity.description || 'Sin descripcion adicional.'}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="No hay actividades operativas seleccionadas en esta unidad." />
        )}
        </Card>
      </div>

      <div className="pt-3">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Title level={4} className="!mb-0">
            Funcionalidades incluidas en esta unidad de entrega
          </Title>
          <Space wrap>
            <Tag color={highRiskCount > 0 ? 'red' : mediumRiskCount > 0 ? 'orange' : 'green'}>
              Riesgo {highRiskCount > 0 ? 'alto' : mediumRiskCount > 0 ? 'medio' : 'bajo'}
            </Tag>
            <Tag color={failedCount > 0 ? 'red' : 'blue'}>
              Fallidas / bloqueadas: {failedCount}
            </Tag>
          </Space>
        </div>
        <Table
          dataSource={reportRows}
          pagination={false}
          columns={[
            {
              title: 'Funcionalidad',
              dataIndex: 'functionality',
              key: 'functionality',
              render: (value: string) => <Text strong className="text-slate-800">{value}</Text>,
            },
            { title: 'Modulo', dataIndex: 'module', key: 'module' },
            {
              title: 'Estado',
              dataIndex: 'status',
              key: 'status',
              render: (value: string) => getFunctionalityStatusTag(value),
            },
            {
              title: 'Prioridad',
              dataIndex: 'priority',
              key: 'priority',
              render: (value: string) => getPriorityTag(value),
            },
            {
              title: 'QA status',
              dataIndex: 'qaStatus',
              key: 'qaStatus',
              render: (value: string) => getQaStatusTag(value),
            },
            { title: 'Bugs relacionados', dataIndex: 'bugs', key: 'bugs' },
            { title: 'Observaciones', dataIndex: 'observations', key: 'observations' },
          ]}
          locale={{ emptyText: 'No hay funcionalidades asociadas a esta unidad de entrega.' }}
          rowClassName={() => 'align-top'}
        />
        </Card>
      </div>
    </div>
  );
};

export default function Reports({ projectId }: { projectId: string }) {
  const [selectedVariant, setSelectedVariant] = useState<ReportVariant>('QA_STATUS_SUMMARY');
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedDeliveryUnitId, setSelectedDeliveryUnitId] = useState<string | null>(null);
  const [view, setView] = useState<'CONFIG' | 'REPORT'>('CONFIG');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const { activeMembership, projectQuota, canUseAi, canUseExports } = useWorkspaceAccess();
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
  const activeOrganizationName = activeMembership?.organization?.name;
  const projectUsageCount = projectQuota?.usage?.projects ?? projectQuota?.currentCount ?? 0;
  const projectLimit = projectQuota?.limits?.projects ?? projectQuota?.limit ?? 3;
  const upgradePriceMonthlyUsd = projectQuota?.upgradePriceMonthlyUsd ?? 5;
  const upgradeUrl = buildProjectUpgradeWhatsAppUrl({
    organizationName: activeOrganizationName,
    currentCount: projectUsageCount,
    limit: projectLimit,
    upgradePriceMonthlyUsd,
  });
  const reportAccess = {
    QA_STATUS_SUMMARY: projectQuota?.reports?.qaStatusSummary ?? false,
    QA_PROGRESS_REPORT: projectQuota?.reports?.qaProgress ?? false,
    PROJECT_STATUS_REPORT: projectQuota?.reports?.executiveProjectStatus ?? false,
    DELIVERY_UNIT_PROGRESS_REPORT: projectQuota?.reports?.deliveryUnitProgress ?? false,
  } as const;
  const selectedReportLocked = !reportAccess[selectedVariant];

  const { data: regressionCycleSummaries = [] } = useRegressionCycleSummaries(projectId);
  const { data: smokeCycleSummaries = [] } = useSmokeCycleSummaries(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: deliveryUnits = [] } = useDeliveryUnits(projectId);
  const { data: projects = [] } = useProjects();
  const currentProject = useMemo(
    () => projects.find(project => project.id === projectId) || null,
    [projectId, projects],
  );

  const allCycles = useMemo(
    () =>
      [...regressionCycleSummaries, ...smokeCycleSummaries].filter(
        cycle => cycle.status === 'FINALIZADA',
      ),
    [regressionCycleSummaries, smokeCycleSummaries],
  );

  const filteredCycles = useMemo(() => {
    if (!selectedSprint) return allCycles;
    const selectedKey = normalizeSprintKey(selectedSprint);
    return allCycles.filter(cycle => normalizeSprintKey(cycle.sprint) === selectedKey);
  }, [allCycles, selectedSprint]);

  useEffect(() => {
    if (!selectedCycleId) return;

    const cycleStillAvailable = filteredCycles.some(cycle => cycle.id === selectedCycleId);
    if (!cycleStillAvailable) {
      setSelectedCycleId(null);
    }
  }, [filteredCycles, selectedCycleId]);

  const handleGenerate = async () => {
    if (selectedReportLocked) {
      message.warning('Este reporte está disponible en Growth.');
      return;
    }

    if (selectedVariant === 'QA_STATUS_SUMMARY' && !selectedCycleId) {
      message.warning('Por favor seleccione un ciclo para este tipo de reporte');
      return;
    }

    if (selectedVariant === 'DELIVERY_UNIT_PROGRESS_REPORT' && !selectedDeliveryUnitId) {
      message.warning('Por favor selecciona una unidad de entrega para este reporte');
      return;
    }

    try {
      await authorizeReportAccess(projectId, REPORT_ACCESS_KEYS[selectedVariant]);
    } catch (error) {
      message.warning(error instanceof Error ? error.message : 'No tienes acceso a este reporte.');
      return;
    }

    setView('REPORT');
  };

  const handleExportPdf = async () => {
    try {
      await runTrackedExport({
        projectId,
        action: async () => {
          document.body.classList.add('report-print-mode');

          const cleanupPrintMode = () => {
            document.body.classList.remove('report-print-mode');
            window.removeEventListener('afterprint', cleanupPrintMode);
          };

          window.addEventListener('afterprint', cleanupPrintMode);
          window.print();

          window.setTimeout(() => {
            cleanupPrintMode();
          }, 1200);
        },
      });
    } catch (error) {
      message.error('Error al preparar la impresion del reporte');
    }
  };

  const handlePrintReport = async () => {
    try {
      await handleExportPdf();
    } catch {
      message.error('Error al preparar la impresion del reporte');
    }
  };

  const handleUpgradeClick = async (source: string) => {
    try {
      await startUpgradeRequestFlow({
        requestedPlan: 'growth',
        source,
        currentCount: projectUsageCount,
        limitValue: projectLimit,
        priceMonthlyUsd: upgradePriceMonthlyUsd,
        contactUrl: upgradeUrl,
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
        source: 'reports-upgrade-modal-enterprise',
        currentCount: projectUsageCount,
        limitValue: projectLimit,
        priceMonthlyUsd: null,
        contactUrl: upgradeUrl,
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'No pudimos iniciar la solicitud de upgrade.',
      );
    }
  };

  if (view === 'REPORT') {
    return (
      <div className="report-page-shell max-w-6xl mx-auto space-y-6 pb-12">
        <div className="report-print-toolbar flex items-center justify-between">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setView('CONFIG')}
            className="rounded-xl border-slate-200 hover:text-blue-500"
          >
            Volver a configuración
          </Button>
          <Space>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrintReport}
              disabled={!canUseExports}
              className="rounded-xl border-none bg-[#0f4d7a] !text-white hover:bg-[#13608f] hover:!text-white"
            >
              Imprimir / Guardar PDF
            </Button>
          </Space>
        </div>

        {selectedVariant === 'QA_STATUS_SUMMARY' && (
          <QAStatusSummary
            projectId={projectId}
            cycleId={selectedCycleId}
            canUseAi={canUseAi}
            onRequireUpgrade={() => setIsUpgradeModalOpen(true)}
          />
        )}
        {selectedVariant === 'QA_PROGRESS_REPORT' && (
          <QAProgressReport
            projectId={projectId}
            sprint={selectedSprint}
            canUseAi={canUseAi}
            onRequireUpgrade={() => setIsUpgradeModalOpen(true)}
          />
        )}
        {selectedVariant === 'PROJECT_STATUS_REPORT' && (
          <ProjectStatusReport
            projectId={projectId}
            sprint={selectedSprint}
            canUseAi={canUseAi}
            onRequireUpgrade={() => setIsUpgradeModalOpen(true)}
          />
        )}
          {selectedVariant === 'DELIVERY_UNIT_PROGRESS_REPORT' && (
            <DeliveryUnitProgressReport
              projectId={projectId}
              deliveryUnitId={selectedDeliveryUnitId}
              projectName={currentProject?.name}
              proposalOwner={currentProject?.proposalOwner}
              canUseExports={canUseExports}
              canUseAi={canUseAi}
              onRequireUpgrade={() => setIsUpgradeModalOpen(true)}
            />
          )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <Title level={2} className="!mb-0">
          Generar Reportes de Proyecto
        </Title>
        <Paragraph type="secondary" className="text-lg">
          Selecciona el tipo de reporte y configura los filtros para obtener información detallada.
        </Paragraph>
      </div>

      <PlanCenterSection
        title="Mantén reportes, exportaciones e IA bajo control"
        description="Antes de generar reportes, revisa el estado del plan, el cupo mensual disponible y la ruta más simple para ampliar capacidad cuando el equipo lo necesite."
        organizationName={activeOrganizationName}
        contractedPlan={activeOrganizationPlan}
        effectivePlan={effectiveOrganizationPlan}
        billing={activeBillingState}
        aiUsage={projectQuota?.aiUsage}
        exportUsage={projectQuota?.exportUsage}
        upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
        onViewPlans={() => setIsUpgradeModalOpen(true)}
        onUpgradeAi={() => handleUpgradeClick('reports-ai-usage')}
        onUpgradeExport={() => handleUpgradeClick('reports-export-usage')}
        onRenewPlan={() => handleUpgradeClick('reports-billing-banner')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <SelectionCard
          type="QA_STATUS_SUMMARY"
          title="Resumen de Estado QA"
          description="Visión detallada de un ciclo específico, métricas de aprobación y fallos."
          format="PDF / EXCEL / WORD"
          icon={<FileTextOutlined />}
          selected={selectedVariant === 'QA_STATUS_SUMMARY'}
          onSelect={setSelectedVariant}
          locked={!reportAccess.QA_STATUS_SUMMARY}
        />
        <SelectionCard
          type="QA_PROGRESS_REPORT"
          title="Reporte de Progreso QA"
          description="Tendencias de calidad funcional por ciclos y evolución de la ejecución."
          format="PDF / EXCEL"
          icon={<LineChartOutlined />}
          selected={selectedVariant === 'QA_PROGRESS_REPORT'}
          onSelect={setSelectedVariant}
          locked={!reportAccess.QA_PROGRESS_REPORT}
        />
        <SelectionCard
          type="PROJECT_STATUS_REPORT"
          title="Estado del Proyecto"
          description="Resumen ejecutivo del avance funcional, cobertura por casos y riesgos."
          format="PDF / WORD"
          icon={<ProjectOutlined />}
          selected={selectedVariant === 'PROJECT_STATUS_REPORT'}
          onSelect={setSelectedVariant}
          locked={!reportAccess.PROJECT_STATUS_REPORT}
        />
        <SelectionCard
          type="DELIVERY_UNIT_PROGRESS_REPORT"
          title="Progreso por Unidad"
          description="Avance premium por fase, servicio, mantenimiento o hito configurado."
          format="PDF / WORD"
          icon={<FolderOpenOutlined />}
          selected={selectedVariant === 'DELIVERY_UNIT_PROGRESS_REPORT'}
          onSelect={setSelectedVariant}
          locked={!reportAccess.DELIVERY_UNIT_PROGRESS_REPORT}
        />
      </div>

      {selectedReportLocked ? (
        <PlanUpgradeCard
          title="Desbloquea los reportes avanzados"
          description="Actualiza a Growth para acceder a tendencias, comparativos y vistas ejecutivas del proyecto."
          benefits={[
            'Reporte de Progreso QA',
            'Estado del Proyecto',
            'Mas exportaciones y capacidad',
            'IA y auditoría disponibles',
          ]}
          ctaHref={upgradeUrl}
          onCtaClick={() => handleUpgradeClick('reports-advanced-reports-lock')}
          onSecondaryAction={() => setIsUpgradeModalOpen(true)}
          className="shadow-sm"
        />
      ) : null}

      <UpgradeModal
        open={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        organizationName={activeOrganizationName}
        currentPlan={effectiveOrganizationPlan}
        title="Elige el plan para desbloquear más visibilidad"
        description="Si tu equipo ya necesita reportes avanzados, IA y mas capacidad operativa, aqui puedes comparar el siguiente paso con claridad."
        onUpgradeGrowth={() => handleUpgradeClick('reports-upgrade-modal-growth')}
        onContactEnterprise={() => handleEnterpriseClick()}
      />

      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <FilterOutlined /> Configuración de filtros
          </div>
        </div>
        <div className="p-8">
          <Row gutter={24}>
              {selectedVariant !== 'DELIVERY_UNIT_PROGRESS_REPORT' && (
                <Col span={selectedVariant === 'QA_STATUS_SUMMARY' ? 12 : 24}>
                  <div className="space-y-2">
                    <Text strong className="text-xs uppercase tracking-wider text-slate-500">
                      Seleccionar Sprint
                    </Text>
                    <Select
                      className="w-full h-12 rounded-xl"
                      placeholder="Todos los sprints"
                      value={selectedSprint}
                      onChange={value => {
                        setSelectedSprint(value);
                        setSelectedCycleId(null);
                      }}
                      allowClear
                      options={sprints.map(sprintItem => ({
                        label: sprintItem.name,
                        value: sprintItem.name,
                      }))}
                    />
                  </div>
                </Col>
              )}
            {selectedVariant === 'QA_STATUS_SUMMARY' && (
              <Col span={12}>
                <div className="space-y-2">
                  <Text strong className="text-xs uppercase tracking-wider text-slate-500">
                    Seleccionar Ciclo
                  </Text>
                  <Select
                    className="w-full h-12 rounded-xl"
                    placeholder="Elija un ciclo de prueba..."
                    value={selectedCycleId}
                    onChange={setSelectedCycleId}
                    options={filteredCycles.map(cycle => ({
                      label: `${cycle.cycleId} - ${getCycleTypeLabel(cycle)} (${dayjs(cycle.date).format('DD/MM/YYYY')})`,
                      value: cycle.id,
                    }))}
                  />
                </div>
              </Col>
            )}
            {selectedVariant === 'DELIVERY_UNIT_PROGRESS_REPORT' && (
              <Col span={24}>
                <div className="space-y-2">
                  <Text strong className="text-xs uppercase tracking-wider text-slate-500">
                    Seleccionar Unidad de Entrega
                  </Text>
                  <Select
                    className="w-full h-12 rounded-xl"
                    placeholder="Elige una unidad configurada..."
                    value={selectedDeliveryUnitId}
                    onChange={value => setSelectedDeliveryUnitId(value)}
                    allowClear
                    options={deliveryUnits.map(item => ({
                      label: item.periodLabel ? `${item.name} - ${item.periodLabel}` : item.name,
                      value: item.documentId || item.id,
                    }))}
                  />
                </div>
              </Col>
            )}
          </Row>

          <Divider className="my-8" />

          <div className="flex justify-end gap-4">
            <Button className="h-12 px-8 rounded-xl border-slate-200 font-medium">Cancelar</Button>
            <Button
              type="primary"
              className="h-12 px-10 rounded-xl bg-blue-600 hover:bg-blue-700 border-none font-bold shadow-lg shadow-blue-200"
              onClick={handleGenerate}
            >
              Generar Reporte
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
