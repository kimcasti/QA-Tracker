import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
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
import { useProjectProposals } from '../modules/project-proposals/hooks/useProjectProposals';
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
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useTestRunSummaries } from '../modules/test-runs/hooks/useTestRunSummaries';
import { useTestRuns } from '../modules/test-runs/hooks/useTestRuns';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  analyzeTechnicalReportWithAI,
  generateDeliveryUnitSummaryWithAI,
  hasAiProviderConfigured,
  type TechnicalReportAnalysisInput,
} from '../services/geminiService';
import { exportDeliveryUnitProgressToDocx } from '../utils/reportUtils';
import {
  AutomationResultStatus,
  AutomationTool,
  BugStatus,
  DeliveryUnit,
  DeliveryUnitType,
  ExecutionMode,
  ExecutionStatus,
  Functionality,
  RiskLevel,
  TestCase,
  TestRun,
  TestResult,
  TestType,
  TestStatus,
  isAutomatedCoverageStatus,
} from '../types';

const { Title, Text, Paragraph } = Typography;

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

type AiInsightTone = {
  accent: string;
  background: string;
  border: string;
  icon: React.ReactNode;
};

type ParsedAnalysisSections = {
  general: string;
  highlights: string;
  risks: string;
  recommendations: string;
  additionalInfo: string;
};

const normalizeSprintKey = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/^sprint\s*/i, '');

const isExecutionSourceType = (value?: TestType) =>
  value === TestType.SMOKE || value === TestType.REGRESSION;

const getTestRunTypeLabel = (testRun: TestRun) => {
  if (testRun.testType === TestType.SMOKE) return 'Smoke';
  if (testRun.testType === TestType.REGRESSION) return 'Regresion';
  return testRun.testType;
};

const getExecutionModeLabel = (mode?: ExecutionMode) => mode || ExecutionMode.MANUAL;

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

const getTestRunSummary = (testRun?: TestRun | null) => {
  const results = testRun?.results || [];
  const totalTests = results.length;
  const passed = results.filter(result => result.result === TestResult.PASSED).length;
  const failed = results.filter(result => result.result === TestResult.FAILED).length;
  const blocked = results.filter(result => result.result === TestResult.BLOCKED).length;
  const pending = results.filter(result => result.result === TestResult.NOT_EXECUTED).length;
  const executed = totalTests - pending;
  const passRate = getPercent(passed, executed);
  const executionCoverage = getPercent(executed, totalTests);

  return {
    totalTests,
    passed,
    failed,
    blocked,
    pending,
    executed,
    passRate,
    executionCoverage,
  };
};

const getTestRunAutomationMetrics = (
  testRun: TestRun | null,
  testCaseMap: Map<
    string,
    Pick<
      TestCase,
      | 'isAutomated'
      | 'automationStatus'
      | 'automationTool'
      | 'lastAutomationStatus'
      | 'lastAutomationRunAt'
    >
  >,
) => {
  const totalTests = testRun?.results.length || 0;
  const relatedTestCases =
    testRun?.results
      .map(result => testCaseMap.get(result.testCaseId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)) || [];
  const automatedCount = relatedTestCases.filter(
    testCase =>
      isAutomatedCoverageStatus(testCase.automationStatus || null) || Boolean(testCase.isAutomated),
  ).length;
  const leadingAutomationTool =
    [
      ...relatedTestCases
        .reduce<Map<AutomationTool, number>>((acc, testCase) => {
          if (testCase.automationTool) {
            acc.set(testCase.automationTool, (acc.get(testCase.automationTool) || 0) + 1);
          }
          return acc;
        }, new Map())
        .entries(),
    ].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
  const latestAutomationResult =
    [...relatedTestCases]
      .filter(testCase => testCase.lastAutomationStatus)
      .sort(
        (left, right) =>
          new Date(right.lastAutomationRunAt || 0).getTime() -
          new Date(left.lastAutomationRunAt || 0).getTime(),
      )[0]?.lastAutomationStatus || null;

  return {
    automatedCount,
    manualCount: Math.max(totalTests - automatedCount, 0),
    automationRate: getPercent(automatedCount, totalTests),
    leadingAutomationTool,
    latestAutomationResult,
  };
};

const getAutomationPortfolioMetrics = (
  functionalities: Functionality[],
  testCases: TestCase[],
) => {
  const moduleCoverage = Array.from(
    functionalities.reduce<
      Map<
        string,
        {
          name: string;
          totalCases: number;
          automatedCases: number;
        }
      >
    >((acc, functionality) => {
      const moduleName = functionality.module || 'Sin modulo';
      const relatedCases = testCases.filter(testCase => testCase.functionalityId === functionality.id);
      if (relatedCases.length === 0) return acc;

      const current = acc.get(moduleName) || {
        name: moduleName,
        totalCases: 0,
        automatedCases: 0,
      };

      current.totalCases += relatedCases.length;
      current.automatedCases += relatedCases.filter(testCase =>
        isAutomatedCoverageStatus(testCase.automationStatus || null) || Boolean(testCase.isAutomated),
      ).length;

      acc.set(moduleName, current);
      return acc;
    }, new Map()),
  )
    .map(([, value]) => ({
      ...value,
      coverage: getPercent(value.automatedCases, value.totalCases),
    }))
    .sort((left, right) => right.coverage - left.coverage || right.automatedCases - left.automatedCases);

  const functionalityCoverage = functionalities
    .map(functionality => {
      const relatedCases = testCases.filter(testCase => testCase.functionalityId === functionality.id);
      const automatedCases = relatedCases.filter(testCase =>
        isAutomatedCoverageStatus(testCase.automationStatus || null) || Boolean(testCase.isAutomated),
      ).length;

      return {
        id: functionality.id,
        name: functionality.name,
        totalCases: relatedCases.length,
        automatedCases,
        coverage: getPercent(automatedCases, relatedCases.length),
      };
    })
    .filter(item => item.totalCases > 0)
    .sort((left, right) => right.coverage - left.coverage || right.automatedCases - left.automatedCases);

  const successByTool = Array.from(
    testCases.reduce<
      Map<
        string,
        {
          tool: string;
          total: number;
          passed: number;
        }
      >
    >((acc, testCase) => {
      if (!testCase.automationTool || !testCase.lastAutomationStatus) return acc;
      if (testCase.lastAutomationStatus === AutomationResultStatus.UNKNOWN) return acc;

      const current = acc.get(testCase.automationTool) || {
        tool: testCase.automationTool,
        total: 0,
        passed: 0,
      };

      current.total += 1;
      if (testCase.lastAutomationStatus === AutomationResultStatus.PASSED) {
        current.passed += 1;
      }

      acc.set(testCase.automationTool, current);
      return acc;
    }, new Map()),
  )
    .map(([, value]) => ({
      ...value,
      successRate: getPercent(value.passed, value.total),
    }))
    .sort((left, right) => right.successRate - left.successRate || right.total - left.total);

  return {
    moduleCoverage,
    functionalityCoverage,
    successByTool,
  };
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
  if (value === TestStatus.FAILED) return <Tag color="blue">En progreso</Tag>;
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
          ? '#2563eb'
          : '#64748b';

  return (
    <Tag
      className="rounded-full border px-3 py-0.5 text-xs font-medium"
      style={{ color, borderColor: `${color}33`, backgroundColor: '#ffffff' }}
    >
      {value === TestStatus.FAILED ? 'En desarrollo' : value || 'Sin estado'}
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

const normalizeAiText = (value?: string) =>
  String(value || '')
    .replace(/\r/g, '')
    .trim();

const extractAiBulletItems = (value?: string) =>
  normalizeAiText(value)
    .split('\n')
    .map(item => item.replace(/^[\-\u2022]\s*/, '').trim())
    .filter(Boolean);

const splitAiParagraphs = (value?: string) =>
  normalizeAiText(value)
    .split(/\n{2,}/)
    .map(paragraph => paragraph.replace(/\n+/g, ' ').trim())
    .filter(Boolean);

const condenseAiInsight = (value?: string, maxLength = 220) => {
  const [firstParagraph = ''] = splitAiParagraphs(value);
  if (!firstParagraph) return '';
  if (firstParagraph.length <= maxLength) return firstParagraph;

  return `${firstParagraph.slice(0, maxLength).trimEnd()}...`;
};

const parseTechnicalAnalysisSections = (analysis: string): ParsedAnalysisSections => {
  const normalized = normalizeAiText(analysis);

  if (!normalized) {
    return {
      general: '',
      highlights: '',
      risks: '',
      recommendations: '',
      additionalInfo: '',
    };
  }

  const sectionPatterns: Array<{
    key: keyof ParsedAnalysisSections;
    pattern: RegExp;
  }> = [
    { key: 'general', pattern: /(?:^|\n)\s*(?:1[\.\)]\s*)?Estado general de la unidad\s*/i },
    { key: 'highlights', pattern: /(?:^|\n)\s*(?:2[\.\)]\s*)?Aspectos destacados\s*/i },
    { key: 'risks', pattern: /(?:^|\n)\s*(?:3[\.\)]\s*)?Riesgos actuales\s*/i },
    {
      key: 'recommendations',
      pattern: /(?:^|\n)\s*(?:4[\.\)]\s*)?Recomendaciones sugeridas\s*/i,
    },
    {
      key: 'additionalInfo',
      pattern: /(?:^|\n)\s*(?:5[\.\)]\s*)?Informacion adicional recomendada\s*/i,
    },
  ];

  const matches = sectionPatterns
    .map(section => {
      const match = section.pattern.exec(normalized);
      return match ? { key: section.key, index: match.index, length: match[0].length } : null;
    })
    .filter(Boolean) as Array<{ key: keyof ParsedAnalysisSections; index: number; length: number }>;

  if (matches.length === 0) {
    return {
      general: normalized,
      highlights: '',
      risks: '',
      recommendations: '',
      additionalInfo: '',
    };
  }

  const sections: ParsedAnalysisSections = {
    general: '',
    highlights: '',
    risks: '',
    recommendations: '',
    additionalInfo: '',
  };

  matches.forEach((match, index) => {
    const start = match.index + match.length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    sections[match.key] = normalized.slice(start, end).trim();
  });

  return sections;
};

const buildInsightTone = (
  kind: 'stability' | 'coverage' | 'automation' | 'risks' | 'recommendations',
): AiInsightTone => {
  const tones: Record<typeof kind, AiInsightTone> = {
    stability: {
      accent: '#2563eb',
      background: '#eff6ff',
      border: '#bfdbfe',
      icon: <SafetyCertificateOutlined className="text-sm" />,
    },
    coverage: {
      accent: '#0f766e',
      background: '#ecfeff',
      border: '#99f6e4',
      icon: <FileTextOutlined className="text-sm" />,
    },
    automation: {
      accent: '#7c3aed',
      background: '#f5f3ff',
      border: '#ddd6fe',
      icon: <LineChartOutlined className="text-sm" />,
    },
    risks: {
      accent: '#dc2626',
      background: '#fef2f2',
      border: '#fecaca',
      icon: <BugOutlined className="text-sm" />,
    },
    recommendations: {
      accent: '#ca8a04',
      background: '#fefce8',
      border: '#fde68a',
      icon: <CheckCircleOutlined className="text-sm" />,
    },
  };

  return tones[kind];
};

const ReadonlyAiTextBlock: React.FC<{
  title: string;
  icon: React.ReactNode;
  content?: string;
  emptyText: string;
}> = ({ title, icon, content, emptyText }) => {
  const paragraphs = splitAiParagraphs(content);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
          {icon}
        </span>
        <Text strong className="text-sm text-slate-800">
          {title}
        </Text>
      </div>
      {paragraphs.length > 0 ? (
        <div className="space-y-2">
          {paragraphs.map(paragraph => (
            <Paragraph key={paragraph} className="!mb-0 text-sm leading-7 text-slate-700">
              {paragraph}
            </Paragraph>
          ))}
        </div>
      ) : (
        <Text className="text-sm leading-7 text-slate-400">{emptyText}</Text>
      )}
    </div>
  );
};

const ReadonlyAiObjectivesBlock: React.FC<{
  content?: string;
}> = ({ content }) => {
  const items = extractAiBulletItems(content);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
          <FlagOutlined className="text-sm" />
        </span>
        <Text strong className="text-sm text-slate-800">
          Objetivos detectados
        </Text>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item} className="rounded-xl border border-white bg-white/90 px-4 py-3">
              <Text className="text-sm leading-7 text-slate-700">{item}</Text>
            </div>
          ))}
        </div>
      ) : (
        <Text className="text-sm leading-7 text-slate-400">
          Aqui se mostraran los objetivos generados con base exclusiva en esta unidad.
        </Text>
      )}
    </div>
  );
};

const AiInsightCard: React.FC<{
  title: string;
  kind: 'stability' | 'coverage' | 'automation' | 'risks' | 'recommendations';
  description?: string;
  emptyText: string;
}> = ({ title, kind, description, emptyText }) => {
  const tone = buildInsightTone(kind);

  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{ backgroundColor: tone.background, borderColor: tone.border }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm"
          style={{ color: tone.accent }}
        >
          {tone.icon}
        </span>
        <Text strong className="text-sm text-slate-800">
          {title}
        </Text>
      </div>
      <Text className="block text-sm leading-7 text-slate-700">
        {normalizeAiText(description) || emptyText}
      </Text>
    </div>
  );
};

const AiPremiumTeaserCard: React.FC<{
  title: string;
  description: string;
  ctaLabel: string;
  canUseAi: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}> = ({ title, description, ctaLabel, canUseAi, isGenerating, onGenerate }) => (
  <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_55%,#eff6ff_100%)] px-5 py-5">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tag className="m-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
            <SafetyCertificateOutlined /> Premium IA
          </Tag>
          {!canUseAi ? (
            <Tag className="m-0 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
              <LockOutlined /> Growth
            </Tag>
          ) : null}
        </div>
        <Text strong className="mb-2 block text-base text-slate-900">
          {title}
        </Text>
        <Paragraph className="!mb-0 max-w-3xl text-sm leading-7 text-slate-600">
          {description}
        </Paragraph>
      </div>
      <Button
        onClick={() => onGenerate()}
        loading={isGenerating}
        icon={canUseAi ? <SafetyCertificateOutlined /> : <LockOutlined />}
        className="report-ai-action-button shrink-0 rounded-full border-blue-200 bg-white/90 px-4"
      >
        {ctaLabel}
      </Button>
    </div>
  </div>
);

const TechnicalReportAnalysisCard: React.FC<TechnicalAnalysisCardProps> = ({
  projectId,
  input,
  resetKey,
  canUseAi,
  onRequireUpgrade,
}) => {
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const parsedSections = useMemo(() => parseTechnicalAnalysisSections(analysis), [analysis]);
  const hasAnalysis = Boolean(normalizeAiText(analysis));
  const insightDescriptions = useMemo(() => {
    const metrics = (input.metrics || {}) as Record<string, unknown>;
    const testCasesCount = Number(metrics.testCasesCount || 0);
    const progressPercent = Number(metrics.progressPercent || 0);
    const activeBugsCount = Number(metrics.activeBugsCount || 0);

    return {
      stability: condenseAiInsight(parsedSections.general),
      coverage:
        condenseAiInsight(parsedSections.highlights) ||
        (testCasesCount > 0
          ? `La unidad registra ${testCasesCount} casos asociados y un avance general de ${progressPercent}%, lo que aporta contexto base para revisar cobertura y alcance real.`
          : ''),
      automation:
        condenseAiInsight(parsedSections.additionalInfo) ||
        'No se reportan señales especificas de automatizacion en este analisis, por lo que conviene complementar futuras lecturas con ejecuciones, cobertura automatizada o evidencia tecnica adicional.',
      risks:
        condenseAiInsight(parsedSections.risks) ||
        (activeBugsCount > 0
          ? `Se mantienen ${activeBugsCount} bugs activos vinculados al alcance actual, por lo que esta unidad requiere seguimiento cercano sobre impacto y cierre.`
          : ''),
      recommendations: condenseAiInsight(parsedSections.recommendations),
    };
  }, [input.metrics, parsedSections]);

  useEffect(() => {
    setAnalysis('');
  }, [resetKey]);

  const handleGenerate = async () => {
    if (!canUseAi) {
      onRequireUpgrade();
      message.warning('El análisis técnico con IA está disponible en el plan Growth.');
      return;
    }

    if (!(await hasAiProviderConfigured())) {
      message.warning(
        'Configura GEMINI_API_KEY o GROQ_API_KEY en el backend para usar la generacion con IA.',
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
    <Card
      className={`rounded-3xl border-slate-100 shadow-sm ${
        hasAnalysis ? '' : 'report-print-hide-when-empty'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <ReadOutlined />
          <Title level={4} className="!mb-0">
            Análisis técnico con IA
          </Title>
        </div>
        {hasAnalysis ? (
          <Button
            onClick={() => void handleGenerate()}
            loading={isGenerating}
            icon={canUseAi ? <SafetyCertificateOutlined /> : <LockOutlined />}
            className="report-ai-action-button"
          >
            Regenerar análisis IA
          </Button>
        ) : null}
      </div>
      {hasAnalysis ? (
        <div className="space-y-4">
          <Paragraph className="!mb-0 max-w-4xl text-sm leading-7 text-slate-500">
            La IA interpreta este reporte con base exclusiva en sus métricas, alcance y señales
            de riesgo para devolver una lectura técnica alineada al objetivo del informe.
          </Paragraph>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AiInsightCard
              title="Estabilidad"
              kind="stability"
              description={insightDescriptions.stability}
              emptyText="Aqui se resumira la lectura general de estabilidad cuando la IA genere el analisis."
            />
            <AiInsightCard
              title="Cobertura"
              kind="coverage"
              description={insightDescriptions.coverage}
              emptyText="Aqui se mostraran observaciones de cobertura y alcance cuando el analisis este disponible."
            />
            <AiInsightCard
              title="Automatizacion"
              kind="automation"
              description={insightDescriptions.automation}
              emptyText="Aqui se mostraran observaciones sobre automatizacion o datos faltantes relacionados."
            />
            <AiInsightCard
              title="Riesgos"
              kind="risks"
              description={insightDescriptions.risks}
              emptyText="Aqui se mostraran los riesgos principales detectados por la IA."
            />
            <AiInsightCard
              title="Recomendaciones"
              kind="recommendations"
              description={insightDescriptions.recommendations}
              emptyText="Aqui se mostraran recomendaciones accionables generadas para esta unidad."
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <div className="mb-3 flex items-center gap-2 text-slate-700">
              <ReadOutlined />
              <Text strong>Lectura completa</Text>
            </div>
            <div className="space-y-3">
              {splitAiParagraphs(analysis).map(paragraph => (
                <Paragraph key={paragraph} className="!mb-0 text-sm leading-7 text-slate-700">
                  {paragraph}
                </Paragraph>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <AiPremiumTeaserCard
          title="Genera una lectura tecnica premium para este reporte"
          description="Activa un analisis ejecutivo con foco en estabilidad, cobertura, automatizacion, riesgos y recomendaciones listas para revisar o compartir."
          ctaLabel="Generar analisis IA"
          canUseAi={canUseAi}
          isGenerating={isGenerating}
          onGenerate={() => void handleGenerate()}
        />
      )}
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
  const hasAnalysis = Boolean(normalizeAiText(analysis));

  useEffect(() => {
    setAnalysis('');
  }, [resetKey]);

  const handleGenerate = async () => {
    if (!canUseAi) {
      onRequireUpgrade();
      message.warning('El analisis ejecutivo con IA esta disponible en el plan Growth.');
      return;
    }

    if (!(await hasAiProviderConfigured())) {
      message.warning(
        'Configura GEMINI_API_KEY o GROQ_API_KEY en el backend para usar la generacion con IA.',
      );
      return;
    }

    setIsGenerating(true);
    try {
      await authorizeAiAccess(projectId);
      const result = await analyzeTechnicalReportWithAI(input, projectId);
      setAnalysis(String(result || '').trim());
      message.success('Analisis ejecutivo de la ejecución generado con IA.');
    } catch (error) {
      console.error('QA status executive AI analysis failed:', error);
      message.error(
        error instanceof Error ? error.message : 'No pudimos generar el analisis de la ejecución.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card
      className={`rounded-3xl border-slate-100 shadow-sm ${
        hasAnalysis ? '' : 'report-print-hide-when-empty'
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800">
          <ReadOutlined />
          <Title level={4} className="!mb-0">
            Analisis ejecutivo y tecnico con IA
          </Title>
        </div>
        {hasAnalysis ? (
          <Button
            onClick={() => void handleGenerate()}
            loading={isGenerating}
            icon={canUseAi ? <SafetyCertificateOutlined /> : <LockOutlined />}
            className="report-ai-action-button"
          >
            Regenerar analisis IA
          </Button>
        ) : null}
      </div>
      {hasAnalysis ? (
        <>
          <Paragraph className="!mb-4 max-w-4xl text-sm leading-7 text-slate-500">
            Este bloque sintetiza el estado de la ejecución con una lectura profesional, facil de revisar
            y lista para compartir en PDF con clientes o lideres tecnicos.
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
                  <Text className="mt-1 block text-xs leading-6 text-slate-500">
                    {card.helper}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <div className="mb-3 flex items-center gap-2 text-slate-700">
              <FileTextOutlined />
              <Text strong>Lectura de la ejecución</Text>
            </div>
            <div className="min-h-[280px] whitespace-pre-line text-sm leading-7 text-slate-700">
              {analysis}
            </div>
          </div>
        </>
      ) : (
        <AiPremiumTeaserCard
          title="Genera una lectura ejecutiva premium para esta ejecución"
          description="Obtén una interpretacion lista para compartir con foco en cobertura real, riesgo actual, automatizacion y estado general de la ejecución."
          ctaLabel="Generar analisis IA"
          canUseAi={canUseAi}
          isGenerating={isGenerating}
          onGenerate={() => void handleGenerate()}
        />
      )}
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
  executionId: string | null;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}> = ({
  projectId,
  executionId,
  canUseAi,
  onRequireUpgrade,
}) => {
  const { data: bugs = [] } = useBugs(projectId);
  const { data: testRuns = [] } = useTestRuns(projectId);
  const { data: functionalities = [] } = useFunctionalities(projectId);
  const { data: testCases = [] } = useTestCases(projectId);

  const testRun = useMemo(
    () =>
      testRuns.find(
        item =>
          item.id === executionId &&
          item.status === ExecutionStatus.FINAL &&
          isExecutionSourceType(item.testType),
      ) || null,
    [executionId, testRuns],
  );

  const testCaseMap = useMemo(
    () => new Map(testCases.map(testCase => [testCase.id, testCase])),
    [testCases],
  );

  const functionalityMap = useMemo(
    () => new Map(functionalities.map(functionality => [functionality.id, functionality])),
    [functionalities],
  );

  const summary = useMemo(() => getTestRunSummary(testRun), [testRun]);

  const testRunBugs = useMemo(
    () => (testRun ? bugs.filter(bug => bug.testRunId === testRun.id) : []),
    [bugs, testRun],
  );

  const activeTestRunBugs = useMemo(
    () => testRunBugs.filter(bug => bug.status !== BugStatus.RESOLVED),
    [testRunBugs],
  );

  const { automatedCount, manualCount, automationRate, leadingAutomationTool, latestAutomationResult } = useMemo(
    () => getTestRunAutomationMetrics(testRun, testCaseMap),
    [testCaseMap, testRun],
  );

  const stabilityTone = getPassRateTone(summary.passRate);
  const riskTone = getCycleRiskTone(summary.failed, summary.executed, activeTestRunBugs.length);

  const pieData = [
    { name: 'Aprobados', value: summary.passed, color: '#10b981' },
    { name: 'Fallidos', value: summary.failed, color: '#ef4444' },
    { name: 'Bloqueados', value: summary.blocked, color: '#f59e0b' },
    { name: 'Pendientes', value: summary.pending, color: '#94a3b8' },
  ].filter(item => item.value > 0);

  const qualityMetrics = [
    {
      label: 'Estabilidad del sistema',
      value: <Tag color={stabilityTone.color}>{stabilityTone.label}</Tag>,
    },
    {
      label: 'Riesgo de la ejecución',
      value: <Tag color={riskTone.color}>{riskTone.label}</Tag>,
    },
    {
      label: 'Cobertura de ejecución',
      value: <Text strong>{summary.executionCoverage}%</Text>,
    },
    {
      label: 'Bugs activos de la ejecución',
      value: <Text strong>{activeTestRunBugs.length}</Text>,
    },
    {
      label: 'Pruebas ejecutadas',
      value: (
        <Text strong>
          {summary.executed}/{summary.totalTests}
        </Text>
      ),
    },
    {
      label: 'Herramienta principal',
      value: <Text strong>{leadingAutomationTool || 'Sin definir'}</Text>,
    },
    {
      label: 'Último estado automático',
      value: <Text strong>{latestAutomationResult || 'Sin datos'}</Text>,
    },
  ];

  const technicalAnalysisInput = useMemo<TechnicalReportAnalysisInput | null>(
    () => {
      if (!testRun) {
        return null;
      }

      const impactedModules = Array.from(
        new Set(
          testRun.results
            .map(result => {
              const testCase = testCaseMap.get(result.testCaseId);
              return testCase ? functionalityMap.get(testCase.functionalityId)?.module : undefined;
            })
            .filter(Boolean),
        ),
      );

      return {
        reportType: 'qa-status-summary',
        reportTitle: 'Resumen de Estado QA',
        reportPurpose:
          'Evaluar la salud técnica de una ejecución puntual, su cobertura real, estabilidad y hallazgos de calidad.',
        scope: {
          executionId: testRun.id,
          executionType: getTestRunTypeLabel(testRun),
          sprint: testRun.sprint || 'N/A',
          executionDate: dayjs(testRun.executionDate).format('YYYY-MM-DD'),
        },
        metrics: {
          passRate: summary.passRate,
          totalTests: summary.totalTests,
          executedTests: summary.executed,
          executionCoverage: summary.executionCoverage,
          automatedCount,
          manualCount,
          automationRate,
          leadingAutomationTool: leadingAutomationTool || 'Sin definir',
          latestAutomationResult: latestAutomationResult || 'Sin datos',
          failed: summary.failed,
          blocked: summary.blocked,
          pending: summary.pending,
          activeBugs: activeTestRunBugs.length,
        },
        highlights: [
          `La estabilidad del sistema para esta ejecución fue catalogada como ${stabilityTone.label}.`,
          `El riesgo operativo de la ejecución quedó en nivel ${riskTone.label}.`,
          `${summary.executed} de ${summary.totalTests} pruebas fueron ejecutadas.`,
        ],
        risks: [
          summary.failed > 0
            ? `${summary.failed} pruebas fallidas requieren validación funcional o técnica.`
            : null,
          summary.blocked > 0
            ? `${summary.blocked} pruebas bloqueadas limitan la lectura completa de la ejecución.`
            : null,
          activeTestRunBugs.length > 0
            ? `${activeTestRunBugs.length} bugs activos siguen abiertos para esta ejecución.`
            : null,
        ].filter(Boolean),
        details: {
          impactedModules,
          relatedBugs: testRunBugs.map(bug => ({
            id: bug.internalBugId,
            title: bug.title || 'Bug relacionado',
            status: bug.status,
            severity: bug.severity || null,
          })),
          executions: testRun.results.slice(0, 15).map(result => {
            const testCase = testCaseMap.get(result.testCaseId);
            const functionality = testCase
              ? functionalityMap.get(testCase.functionalityId)
              : undefined;

            return {
              functionalityName:
                functionality?.name || result.functionalityName || result.testCaseTitle || 'N/A',
              module: functionality?.module || result.moduleName || 'N/A',
              executionMode: testCase?.isAutomated ? ExecutionMode.AUTOMATED : ExecutionMode.MANUAL,
              result: result.result,
              bugId: result.bugId || result.linkedBugId || null,
            };
          }),
        },
      };
    },
    [
      activeTestRunBugs.length,
      automatedCount,
      automationRate,
      leadingAutomationTool,
      latestAutomationResult,
      functionalityMap,
      manualCount,
      riskTone.label,
      stabilityTone.label,
      summary.blocked,
      summary.executionCoverage,
      summary.executed,
      summary.failed,
      summary.passRate,
      summary.pending,
      summary.totalTests,
      testCaseMap,
      testRun,
      testRunBugs,
    ],
  );

  if (!testRun || !technicalAnalysisInput) {
    return <Empty description="Seleccione una ejecución para ver el reporte" />;
  }

  const insightCards = [
    {
      title: 'Estado de la ejecución',
      value: `${summary.passRate}% de aprobacion`,
      helper: `${summary.executed} de ${summary.totalTests} pruebas ejecutadas`,
    },
    {
      title: 'Cobertura real',
      value: `${summary.executionCoverage}% de cobertura`,
      helper: `${summary.pending} pendientes y ${summary.blocked} bloqueadas`,
    },
    {
      title: 'Riesgo actual',
      value: riskTone.label,
      helper: `${activeTestRunBugs.length} bugs activos en la ejecución`,
    },
    {
      title: 'Automatizacion',
      value: `${automationRate}% automatizada`,
      helper: `${automatedCount} automatizadas, ${manualCount} manuales y ${leadingAutomationTool || 'sin herramienta líder'}`,
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
              <CalendarOutlined /> {dayjs(testRun.executionDate).format('DD MMM, YYYY')}
            </Text>
            <Text type="secondary">
              <Tag color="blue">{getTestRunTypeLabel(testRun)}</Tag>
            </Text>
            <Text type="secondary">Sprint: {testRun.sprint || 'N/A'}</Text>
          </Space>
        </div>
        <div className="text-right">
          <Text strong className="text-lg block">
            {testRun.title}
          </Text>
          <Text type="secondary">ID de ejecución: {testRun.id}</Text>
        </div>
      </div>

      <Row gutter={24}>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Tasa de aprobación"
              value={summary.passRate}
              suffix="%"
              valueStyle={{ color: '#10b981', fontWeight: 800 }}
            />
            <Progress percent={summary.passRate} showInfo={false} strokeColor="#10b981" />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Total pruebas"
              value={summary.totalTests}
              valueStyle={{ fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              Incluidas en esta ejecución
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Bugs encontrados"
              value={testRunBugs.length}
              valueStyle={{ color: '#ef4444', fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              Bugs vinculados a la ejecución
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

      <Row gutter={[32, 24]} className="report-print-stack-row mt-2">
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
        resetKey={testRun.id}
        canUseAi={canUseAi}
        onRequireUpgrade={onRequireUpgrade}
        insightCards={insightCards}
      />

      <div className="pt-3">
        <Card title="Detalle de ejecución" className="rounded-2xl border-slate-100 overflow-hidden">
        <Table
          dataSource={testRun.results.map(result => {
            const testCase = testCaseMap.get(result.testCaseId);
            const functionality = testCase
              ? functionalityMap.get(testCase.functionalityId)
              : undefined;

            return {
              ...result,
              functionalityName:
                functionality?.name || result.functionalityName || result.testCaseTitle || 'N/A',
              module: functionality?.module || result.moduleName || 'N/A',
              executionMode: testCase?.isAutomated ? ExecutionMode.AUTOMATED : ExecutionMode.MANUAL,
            };
          })}
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
  const { data: testRuns = [] } = useTestRuns(projectId);
  const { data: functionalities = [] } = useFunctionalities(projectId);
  const { data: testCases = [] } = useTestCases(projectId);

  const testCaseMap = useMemo(
    () => new Map(testCases.map(testCase => [testCase.id, testCase])),
    [testCases],
  );

  const functionalityMap = useMemo(
    () => new Map(functionalities.map(functionality => [functionality.id, functionality])),
    [functionalities],
  );

  const filteredRuns = useMemo(() => {
    const finalizedRuns = testRuns
      .filter(
        testRun =>
          testRun.status === ExecutionStatus.FINAL && isExecutionSourceType(testRun.testType),
      )
      .sort((a, b) => dayjs(a.executionDate).valueOf() - dayjs(b.executionDate).valueOf());

    if (!sprint) return finalizedRuns.slice(-6);

    const selectedKey = normalizeSprintKey(sprint);
    return finalizedRuns.filter(testRun => normalizeSprintKey(testRun.sprint) === selectedKey);
  }, [sprint, testRuns]);

  const chartData = useMemo(
    () =>
      filteredRuns.map(testRun => {
        const summary = getTestRunSummary(testRun);
        const automation = getTestRunAutomationMetrics(testRun, testCaseMap);

        return {
          name: testRun.title,
          passRate: summary.passRate,
          totalTests: summary.totalTests,
          executed: summary.executed,
          automationRate: automation.automationRate,
        };
      }),
    [filteredRuns, testCaseMap],
  );

  const evolutionMetrics = useMemo(() => {
    const firstRun = filteredRuns[0];
    const lastRun = filteredRuns[filteredRuns.length - 1];

    if (!firstRun || !lastRun) {
      return {
        casesGrowth: 0,
        failureReduction: 0,
        executionVelocity: 0,
        latestExecutionCoverage: 0,
        averageAutomationRate: 0,
      };
    }

    const firstSummary = getTestRunSummary(firstRun);
    const lastSummary = getTestRunSummary(lastRun);

    return {
      casesGrowth: calculatePercentChange(lastSummary.totalTests, firstSummary.totalTests),
      failureReduction: calculatePercentChange(
        firstSummary.failed - lastSummary.failed,
        firstSummary.failed,
      ),
      executionVelocity: calculatePercentChange(
        lastSummary.executionCoverage,
        firstSummary.executionCoverage,
      ),
      latestExecutionCoverage: lastSummary.executionCoverage,
      averageAutomationRate: average(
        filteredRuns.map(testRun => getTestRunAutomationMetrics(testRun, testCaseMap).automationRate),
      ),
    };
  }, [filteredRuns, testCaseMap]);

  const recentMilestones = useMemo(
    () =>
      [...filteredRuns]
        .sort((a, b) => dayjs(b.executionDate).valueOf() - dayjs(a.executionDate).valueOf())
        .slice(0, 3),
    [filteredRuns],
  );

  const averageExecutionFrequencyDays = useMemo(() => {
    if (filteredRuns.length < 2) return null;

    const gaps = filteredRuns
      .slice(1)
      .map((testRun, index) =>
        dayjs(testRun.executionDate).diff(dayjs(filteredRuns[index].executionDate), 'day'),
      )
      .filter(value => value >= 0);

    if (gaps.length === 0) return null;
    return average(gaps);
  }, [filteredRuns]);

  const technicalAnalysisInput = useMemo<TechnicalReportAnalysisInput>(
    () => ({
      reportType: 'qa-progress-report',
      reportTitle: 'Reporte de Progreso QA',
      reportPurpose:
        'Analizar la evolución de la calidad por ejecuciones, identificar tendencias y detectar cambios en cobertura y automatización.',
      scope: {
        sprint: sprint || 'ultimas-ejecuciones',
        analyzedExecutions: filteredRuns.length,
        executionFrequencyDays: averageExecutionFrequencyDays,
        dateRange:
          filteredRuns.length > 0
            ? {
                from: dayjs(filteredRuns[0].executionDate).format('YYYY-MM-DD'),
                to: dayjs(filteredRuns[filteredRuns.length - 1].executionDate).format('YYYY-MM-DD'),
              }
            : null,
      },
      metrics: {
        averagePassRate: average(filteredRuns.map(testRun => getTestRunSummary(testRun).passRate)),
        averageAutomationRate: evolutionMetrics.averageAutomationRate,
        latestExecutionCoverage: evolutionMetrics.latestExecutionCoverage,
        casesGrowth: evolutionMetrics.casesGrowth,
        failureReduction: evolutionMetrics.failureReduction,
        executionVelocity: evolutionMetrics.executionVelocity,
        totalBugsFound: filteredRuns.reduce(
          (sum, testRun) => sum + bugs.filter(bug => bug.testRunId === testRun.id).length,
          0,
        ),
      },
      highlights: recentMilestones.map(
        testRun => {
          const summary = getTestRunSummary(testRun);
          const automation = getTestRunAutomationMetrics(testRun, testCaseMap);
          return `${testRun.title} (${getTestRunTypeLabel(testRun)}): ${summary.passRate}% pass rate, ${summary.failed} fallidas, ${automation.automationRate}% automatización.`;
        },
      ),
      risks: [
        evolutionMetrics.failureReduction < 0
          ? 'La reducción de fallos es negativa y sugiere deterioro frente a la ejecución base.'
          : null,
        evolutionMetrics.latestExecutionCoverage < 80
          ? 'La cobertura de ejecución más reciente sigue por debajo del 80%.'
          : null,
        evolutionMetrics.averageAutomationRate < 40
          ? 'La automatización promedio es baja para sostener velocidad y repetibilidad.'
          : null,
      ].filter(Boolean),
      details: {
        executions: filteredRuns.map(testRun => {
          const summary = getTestRunSummary(testRun);
          const automation = getTestRunAutomationMetrics(testRun, testCaseMap);

          return {
            executionId: testRun.id,
            title: testRun.title,
            type: getTestRunTypeLabel(testRun),
            sprint: testRun.sprint,
            date: dayjs(testRun.executionDate).format('YYYY-MM-DD'),
            passRate: summary.passRate,
            totalTests: summary.totalTests,
            executed: summary.executed,
            failed: summary.failed,
            automationRate: automation.automationRate,
            bugsFound: bugs.filter(bug => bug.testRunId === testRun.id).length,
            impactedModules: Array.from(
              new Set(
                testRun.results
                  .map(result => {
                    const testCase = testCaseMap.get(result.testCaseId);
                    return testCase
                      ? functionalityMap.get(testCase.functionalityId)?.module
                      : undefined;
                  })
                  .filter(Boolean),
              ),
            ),
            includedFunctionalities: Array.from(
              new Set(
                testRun.results
                  .map(result => {
                    const testCase = testCaseMap.get(result.testCaseId);
                    return testCase
                      ? functionalityMap.get(testCase.functionalityId)?.name
                      : result.functionalityName;
                  })
                  .filter(Boolean),
              ),
            ),
            resultsSummary: {
              passed: summary.passed,
              failed: summary.failed,
              blocked: summary.blocked,
              pending: summary.pending,
            },
          };
        }),
      },
    }),
    [
      averageExecutionFrequencyDays,
      bugs,
      evolutionMetrics,
      filteredRuns,
      functionalityMap,
      recentMilestones,
      sprint,
      testCaseMap,
    ],
  );

  if (filteredRuns.length === 0) {
    return <Empty description="No hay ejecuciones finalizadas para el filtro seleccionado" />;
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
            Tendencia de calidad funcional y evolución de las ejecuciones
            {sprint ? ` en ${sprint}` : ' en las últimas ejecuciones'}.
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
                const summary = getTestRunSummary(cycle);
                const tone = getPassRateTone(summary.passRate);
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
                        {cycle.title} · {getTestRunTypeLabel(cycle)}
                      </Text>
                      <Text type="secondary" className="text-xs">
                        {dayjs(cycle.executionDate).format('DD/MM/YYYY')} · {summary.passed}/
                        {summary.totalTests} aprobadas · {summary.failed} fallidas
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
        resetKey={`${sprint || 'all'}-${filteredRuns.map(testRun => testRun.id).join(',')}`}
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
  const { data: testRuns = [] } = useTestRuns(projectId);

  const selectedSprintKey = normalizeSprintKey(sprint);
  const filteredFunctionalities = useMemo(
    () =>
      sprint
        ? functionalities.filter(item => normalizeSprintKey(item.sprint) === selectedSprintKey)
        : functionalities,
    [functionalities, selectedSprintKey, sprint],
  );

  const functionalityIds = useMemo(
    () => new Set(filteredFunctionalities.map(item => item.id)),
    [filteredFunctionalities],
  );

  const filteredTestCases = useMemo(
    () =>
      sprint ? testCases.filter(item => functionalityIds.has(item.functionalityId)) : testCases,
    [functionalityIds, sprint, testCases],
  );

  const filteredTestCaseMap = useMemo(
    () => new Map(filteredTestCases.map(testCase => [testCase.id, testCase])),
    [filteredTestCases],
  );

  const filteredRuns = useMemo(
    () =>
      testRuns.filter(testRun => {
        if (
          testRun.status !== ExecutionStatus.FINAL ||
          !isExecutionSourceType(testRun.testType)
        ) {
          return false;
        }

        if (!sprint) return true;
        return normalizeSprintKey(testRun.sprint) === selectedSprintKey;
      }),
    [selectedSprintKey, sprint, testRuns],
  );

  const stats = useMemo(() => {
    const filteredBugs = bugs.filter(bug => {
      if (!sprint) return true;

      const bugSprintMatches = normalizeSprintKey(bug.sprint) === selectedSprintKey;
      const bugFunctionalityMatches = functionalityIds.has(bug.functionalityId);
      const bugRunMatches = filteredRuns.some(testRun => testRun.id === bug.testRunId);

      return bugSprintMatches || bugFunctionalityMatches || bugRunMatches;
    });

    const activeBugs = filteredBugs.filter(bug => bug.status !== BugStatus.RESOLVED);
    const averagePassRate = average(filteredRuns.map(testRun => getTestRunSummary(testRun).passRate));
    const averageAutomationRate = average(
      filteredRuns.map(testRun => getTestRunAutomationMetrics(testRun, filteredTestCaseMap).automationRate),
    );
    const pendingExecutionTests = filteredRuns.reduce(
      (sum, testRun) => sum + getTestRunSummary(testRun).pending + getTestRunSummary(testRun).blocked,
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
    const automationPortfolio = getAutomationPortfolioMetrics(
      filteredFunctionalities,
      filteredTestCases,
    );

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
      executionCount: filteredRuns.length,
      averagePassRate,
      averageAutomationRate,
      pendingExecutionTests,
      riskTone,
      core,
      regression,
      smoke,
      automationPortfolio,
    };
  }, [bugs, filteredFunctionalities, filteredRuns, filteredTestCaseMap, filteredTestCases, functionalityIds, selectedSprintKey, sprint]);

  const barData = [
    { name: 'Total', value: stats.total, fill: '#3b82f6' },
    { name: 'Completadas', value: stats.completed, fill: '#10b981' },
    { name: 'Casos', value: stats.testCasesCount, fill: '#8b5cf6' },
    { name: 'Bugs activos', value: stats.activeBugsCount, fill: '#ef4444' },
    { name: 'Ejecuciones', value: stats.executionCount, fill: '#f59e0b' },
  ];

  const filteredBugs = useMemo(
    () => {
      if (!sprint) return bugs;
      return bugs.filter(bug => {
        const bugSprintMatches = normalizeSprintKey(bug.sprint) === selectedSprintKey;
        const bugFunctionalityMatches = functionalityIds.has(bug.functionalityId);
        const bugRunMatches = filteredRuns.some(testRun => testRun.id === bug.testRunId);
        return bugSprintMatches || bugFunctionalityMatches || bugRunMatches;
      });
    },
    [bugs, filteredRuns, functionalityIds, selectedSprintKey, sprint],
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
        executionCount: stats.executionCount,
        averagePassRate: stats.averagePassRate,
        averageAutomationRate: stats.averageAutomationRate,
        pendingExecutionTests: stats.pendingExecutionTests,
        coreFunctionalities: stats.core,
        regressionFunctionalities: stats.regression,
        smokeFunctionalities: stats.smoke,
        projectRiskLevel: stats.riskTone.label,
      },
      highlights: [
        `El proyecto presenta un avance funcional del ${stats.progress}%.`,
        `La tasa promedio de aprobación en ejecuciones es ${stats.averagePassRate}%.`,
        `Actualmente existen ${stats.activeBugsCount} bugs activos en el alcance analizado.`,
      ],
      risks: [
        stats.highRisk > 0
          ? `${stats.highRisk} funcionalidades están marcadas con riesgo alto.`
          : null,
        stats.pendingExecutionTests > 0
          ? `${stats.pendingExecutionTests} pruebas siguen pendientes o bloqueadas en ejecuciones asociadas.`
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
        executions: filteredRuns.map(testRun => {
          const summary = getTestRunSummary(testRun);
          return {
            executionId: testRun.id,
            title: testRun.title,
            sprint: testRun.sprint,
            type: getTestRunTypeLabel(testRun),
            passRate: summary.passRate,
            pending: summary.pending,
            blocked: summary.blocked,
          };
        }),
      },
    }),
    [activeProjectBugs, barData, filteredFunctionalities, filteredRuns, sprint, stats],
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
                  <Text type="secondary">Promedio de aprobacion:</Text>
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
              {stats.pendingExecutionTests > 0
                ? `Quedan ${stats.pendingExecutionTests} pruebas pendientes o bloqueadas en las ejecuciones filtradas.`
                : 'No hay pruebas pendientes ni bloqueadas en las ejecuciones filtradas.'}
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
                : `No hay bugs activos y la tasa promedio de aprobación de las ejecuciones es ${stats.averagePassRate}%.`}
            </Text>
          </div>
        </div>
      </Card>

      <Card title="Metricas de automatizacion" className="rounded-2xl border-slate-100">
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={8}>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 h-full">
              <Text strong>Cobertura por modulo</Text>
              <div className="mt-4 space-y-3">
                {stats.automationPortfolio.moduleCoverage.slice(0, 5).length > 0 ? (
                  stats.automationPortfolio.moduleCoverage.slice(0, 5).map(item => (
                    <div key={item.name}>
                      <div className="flex justify-between gap-3 text-sm">
                        <Text>{item.name}</Text>
                        <Text strong>{item.coverage}%</Text>
                      </div>
                      <Progress percent={item.coverage} showInfo={false} strokeColor="#2563eb" />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Sin cobertura automatizada registrada por modulo.</Text>
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 h-full">
              <Text strong>Cobertura por funcionalidad</Text>
              <div className="mt-4 space-y-3">
                {stats.automationPortfolio.functionalityCoverage.slice(0, 5).length > 0 ? (
                  stats.automationPortfolio.functionalityCoverage.slice(0, 5).map(item => (
                    <div key={item.id}>
                      <div className="flex justify-between gap-3 text-sm">
                        <Text>{item.name}</Text>
                        <Text strong>{item.coverage}%</Text>
                      </div>
                      <Progress percent={item.coverage} showInfo={false} strokeColor="#14b8a6" />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Sin funcionalidades con al menos un caso dentro del alcance.</Text>
                )}
              </div>
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4 h-full">
              <Text strong>Tasa de aprobacion por herramienta</Text>
              <div className="mt-4 space-y-3">
                {stats.automationPortfolio.successByTool.length > 0 ? (
                  stats.automationPortfolio.successByTool.map(item => (
                    <div key={item.tool}>
                      <div className="flex justify-between gap-3 text-sm">
                        <Text>{item.tool}</Text>
                        <Text strong>{item.successRate}%</Text>
                      </div>
                      <Progress percent={item.successRate} showInfo={false} strokeColor="#10b981" />
                    </div>
                  ))
                ) : (
                  <Text type="secondary">Sin resultados automaticos suficientes por herramienta.</Text>
                )}
              </div>
            </div>
          </Col>
        </Row>
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
  canUseExports?: boolean;
  canUseAi: boolean;
  onRequireUpgrade: () => void;
}> = ({
  projectId,
  deliveryUnitId,
  projectName,
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
        category: activity.category,
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
      proposalName: selectedDeliveryUnit?.proposalName || 'No definida',
      proposalOwner: selectedDeliveryUnit?.proposalOwner || 'No definido',
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
        category: activity.category,
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
          category: activity.category,
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

  const hasAiSummaryContent = Boolean(
    normalizeAiText(aiIntroduction) ||
      normalizeAiText(aiObjectives) ||
      normalizeAiText(aiConclusion),
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
                  Propuesta
                </Text>
                <Text strong>{selectedDeliveryUnit.proposalName || 'No definida'}</Text>
              </div>
              <div>
                <Text className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Responsable
                </Text>
                <Text strong>{selectedDeliveryUnit.proposalOwner || 'No definido'}</Text>
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
        <Card
          className={`rounded-3xl border-slate-100 shadow-sm ${
            hasAiSummaryContent ? '' : 'report-print-hide-when-empty'
          }`}
        >
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <ReadOutlined />
          <Title level={4} className="!mb-0">
            Resumen asistido por IA
          </Title>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ReadonlyAiTextBlock
            title="Introduccion"
            icon={<FileTextOutlined className="text-sm" />}
            content={aiIntroduction}
            emptyText="Aqui se mostrara la introduccion generada con base exclusiva en esta unidad."
          />
          <ReadonlyAiObjectivesBlock content={aiObjectives} />
          <ReadonlyAiTextBlock
            title="Conclusion"
            icon={<CheckOutlined className="text-sm" />}
            content={aiConclusion}
            emptyText="Aqui se mostrara la conclusion generada con base exclusiva en esta unidad."
          />
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
                    {activity.category || 'Sin categoria asignada.'}
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
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
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

  const { data: testRunSummaries = [] } = useTestRunSummaries(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: deliveryUnits = [] } = useDeliveryUnits(projectId);
  const { data: projectProposals = [] } = useProjectProposals(projectId);
  const { data: projects = [] } = useProjects();
  const currentProject = useMemo(
    () => projects.find(project => project.id === projectId) || null,
    [projectId, projects],
  );

  const availableExecutions = useMemo(
    () =>
      testRunSummaries.filter(
        testRun =>
          testRun.status === ExecutionStatus.FINAL && isExecutionSourceType(testRun.testType),
      ),
    [testRunSummaries],
  );

  const filteredExecutions = useMemo(() => {
    if (!selectedSprint) return availableExecutions;
    const selectedKey = normalizeSprintKey(selectedSprint);
    return availableExecutions.filter(testRun => normalizeSprintKey(testRun.sprint) === selectedKey);
  }, [availableExecutions, selectedSprint]);

  useEffect(() => {
    if (!selectedExecutionId) return;

    const executionStillAvailable = filteredExecutions.some(
      execution => execution.id === selectedExecutionId,
    );
    if (!executionStillAvailable) {
      setSelectedExecutionId(null);
    }
  }, [filteredExecutions, selectedExecutionId]);

  const filteredDeliveryUnits = useMemo(() => {
    if (!selectedProposalId) return deliveryUnits;
    return deliveryUnits.filter(
      item => (item.proposalDocumentId || '') === selectedProposalId,
    );
  }, [deliveryUnits, selectedProposalId]);

  useEffect(() => {
    if (!selectedDeliveryUnitId) return;

    const deliveryUnitStillAvailable = filteredDeliveryUnits.some(
      item => (item.documentId || item.id) === selectedDeliveryUnitId,
    );

    if (!deliveryUnitStillAvailable) {
      setSelectedDeliveryUnitId(null);
    }
  }, [filteredDeliveryUnits, selectedDeliveryUnitId]);

  const handleGenerate = async () => {
    if (selectedReportLocked) {
      message.warning('Este reporte está disponible en Growth.');
      return;
    }

    if (selectedVariant === 'QA_STATUS_SUMMARY' && !selectedExecutionId) {
      message.warning('Por favor seleccione una ejecución para este tipo de reporte');
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
            executionId={selectedExecutionId}
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
          description="Visión detallada de una ejecución específica, métricas de aprobación y fallos."
          format="PDF / EXCEL / WORD"
          icon={<FileTextOutlined />}
          selected={selectedVariant === 'QA_STATUS_SUMMARY'}
          onSelect={setSelectedVariant}
          locked={!reportAccess.QA_STATUS_SUMMARY}
        />
        <SelectionCard
          type="QA_PROGRESS_REPORT"
          title="Reporte de Progreso QA"
          description="Tendencias de calidad funcional por ejecuciones y evolución de la ejecución."
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
                        setSelectedExecutionId(null);
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
                      Seleccionar Ejecución
                  </Text>
                  <Select
                    className="w-full h-12 rounded-xl"
                    placeholder="Elija una ejecución de prueba..."
                    value={selectedExecutionId}
                    onChange={setSelectedExecutionId}
                    options={filteredExecutions.map(testRun => ({
                      label: `${testRun.title} - ${getTestRunTypeLabel(testRun)} (${dayjs(testRun.executionDate).format('DD/MM/YYYY')})`,
                      value: testRun.id,
                    }))}
                  />
                </div>
              </Col>
            )}
            {selectedVariant === 'DELIVERY_UNIT_PROGRESS_REPORT' && (
              <>
                <Col span={12}>
                  <div className="space-y-2">
                    <Text strong className="text-xs uppercase tracking-wider text-slate-500">
                      Filtrar por Propuesta
                    </Text>
                    <Select
                      className="w-full h-12 rounded-xl"
                      placeholder="Todas las propuestas"
                      value={selectedProposalId}
                      onChange={value => {
                        setSelectedProposalId(value);
                        setSelectedDeliveryUnitId(null);
                      }}
                      allowClear
                      options={projectProposals.map(proposal => ({
                        label: proposal.isPrimary ? `${proposal.name} (Principal)` : proposal.name,
                        value: proposal.documentId || proposal.id,
                      }))}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="space-y-2">
                    <Text strong className="text-xs uppercase tracking-wider text-slate-500">
                      Seleccionar Unidad de Entrega
                    </Text>
                    <Select
                      className="w-full h-12 rounded-xl"
                      placeholder={
                        selectedProposalId
                          ? 'Elige una unidad de la propuesta seleccionada...'
                          : 'Elige una unidad configurada...'
                      }
                      value={selectedDeliveryUnitId}
                      onChange={value => setSelectedDeliveryUnitId(value)}
                      allowClear
                      options={filteredDeliveryUnits.map(item => ({
                        label: item.periodLabel ? `${item.name} - ${item.periodLabel}` : item.name,
                        value: item.documentId || item.id,
                      }))}
                    />
                  </div>
                </Col>
              </>
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

