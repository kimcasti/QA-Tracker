import React from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { FileSearchOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import { Flame, Info, RefreshCw, ShieldAlert, Star, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { ExpandableConfig, FilterValue } from 'antd/es/table/interface';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  Functionality,
  FUNCTIONALITY_DEVELOPMENT_STATUSES,
  Priority,
  RiskLevel,
  TestCase,
  TestStatus,
} from '../types';
import { labelPriority, labelRisk, labelTestStatus } from '../i18n/labels';

const { Title, Text, Paragraph } = Typography;
const TestCaseManagement = React.lazy(() => import('./TestCaseManagement'));
const INFO_TOOLTIP_OVERLAY_STYLE = { maxWidth: 320 };
const INFO_TOOLTIP_INNER_STYLE: React.CSSProperties = {
  whiteSpace: 'normal',
  lineHeight: 1.45,
};
const COVERAGE_CHART_COLORS = ['#f59e0b', '#7c3aed', '#f97316', '#cbd5e1'];
const PRIORITY_CHART_COLORS = ['#ef4444', '#f97316', '#0ea5e9', '#94a3b8'];

type MetricCardProps = {
  label: string;
  value: number;
  valueClassName: string;
};

type RecommendationKey =
  | 'critical_outside_smoke'
  | 'high_risk_without_cases'
  | 'high_priority_without_regression'
  | 'without_coverage'
  | 'recent_changes';

type RecommendationCardProps = {
  active: boolean;
  count: number;
  description: string;
  label: string;
  onClick: () => void;
  toneClassName: string;
};

type GuidanceItemProps = {
  label: string;
  message: string;
  toneClassName: string;
  icon: React.ReactNode;
};

type PlanningTableFilters = {
  module: React.Key[] | null;
  coverage: React.Key[] | null;
  riskLevel: React.Key[] | null;
  priority: React.Key[] | null;
  status: React.Key[] | null;
};

const INITIAL_TABLE_FILTERS: PlanningTableFilters = {
  module: null,
  coverage: null,
  riskLevel: null,
  priority: null,
  status: null,
};

const RISK_BADGE_CLASSNAMES: Record<RiskLevel, string> = {
  [RiskLevel.HIGH]: 'border-red-200 bg-red-50 text-red-700',
  [RiskLevel.MEDIUM]: 'border-amber-200 bg-amber-50 text-amber-700',
  [RiskLevel.LOW]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const PRIORITY_BADGE_CLASSNAMES: Record<Priority, string> = {
  [Priority.CRITICAL]: 'border-red-200 bg-red-50 text-red-700',
  [Priority.HIGH]: 'border-orange-200 bg-orange-50 text-orange-700',
  [Priority.MEDIUM]: 'border-sky-200 bg-sky-50 text-sky-700',
  [Priority.LOW]: 'border-slate-200 bg-slate-50 text-slate-600',
};

const STATUS_CHIP_CLASSNAMES: Partial<Record<TestStatus, string>> = {
  [TestStatus.BACKLOG]: 'border-slate-200 bg-slate-50 text-slate-600',
  [TestStatus.IN_PROGRESS]: 'border-blue-200 bg-blue-50 text-blue-700',
  [TestStatus.COMPLETED]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  [TestStatus.MVP]: 'border-amber-200 bg-amber-50 text-amber-700',
  [TestStatus.FAILED]: 'border-blue-200 bg-blue-50 text-blue-700',
};

const STATUS_BADGE_CONFIG: Partial<Record<TestStatus, { bg: string; text: string; dot: string }>> =
  {
    [TestStatus.BACKLOG]: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
    [TestStatus.IN_PROGRESS]: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    [TestStatus.COMPLETED]: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    [TestStatus.MVP]: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    [TestStatus.FAILED]: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  };

const FALLBACK_STATUS_BADGE_CONFIG = {
  bg: 'bg-gray-100',
  text: 'text-gray-600',
  dot: 'bg-gray-400',
};

function getRiskImpactText(risk: RiskLevel) {
  switch (risk) {
    case RiskLevel.HIGH:
      return 'Alto: resalta brechas sin cobertura y aumenta la atención en planificación.';
    case RiskLevel.MEDIUM:
      return 'Medio: mantiene seguimiento regular dentro del alcance QA.';
    case RiskLevel.LOW:
      return 'Bajo: menor urgencia funcional, pero sigue visible en el inventario.';
    default:
      return '';
  }
}

function getPriorityImpactText(priority: Priority) {
  switch (priority) {
    case Priority.CRITICAL:
      return 'Crítico: se prioriza en regresión y ejecución.';
    case Priority.HIGH:
      return 'Alto: gana peso para regresión y seguimiento de salida.';
    case Priority.MEDIUM:
      return 'Medio: seguimiento normal dentro del flujo QA.';
    case Priority.LOW:
      return 'Bajo: menor urgencia frente a otras funcionalidades.';
    default:
      return '';
  }
}

function getCoverageImpactText(type: 'isCore' | 'isRegression' | 'isSmoke') {
  switch (type) {
    case 'isCore':
      return 'Core business: funcionalidad base o crítica para validar los flujos esenciales.';
    case 'isRegression':
      return 'Regresión: se incluye dentro del alcance de validaciones de regresión.';
    case 'isSmoke':
      return 'Smoke: entra en la revisión rápida inicial para comprobar estabilidad básica.';
    default:
      return '';
  }
}

function MetricCard({ label, value, valueClassName }: MetricCardProps) {
  return (
    <Col xs={24} sm={12} lg={4}>
      <Card className="h-full rounded-2xl border-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <Text type="secondary" className="text-xs font-semibold uppercase tracking-wider">
          {label}
        </Text>
        <div className={`mt-2 text-3xl font-bold ${valueClassName}`}>{value}</div>
      </Card>
    </Col>
  );
}

function RecommendationCard({
  active,
  count,
  description,
  label,
  onClick,
  toneClassName,
}: RecommendationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full w-full rounded-2xl border px-4 py-4 text-left transition ${
        active
          ? 'border-sky-300 bg-sky-50 ring-1 ring-sky-200 shadow-[0_10px_28px_rgba(14,116,144,0.10)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          <div className="mt-1 text-sm leading-5 text-slate-500">{description}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-bold ${toneClassName}`}>{count}</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-sky-700">
          {active ? 'Filtro activo en tabla' : 'Ver detalles'}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {active ? 'Activo' : 'Aplicar'}
        </span>
      </div>
    </button>
  );
}

function GuidanceItem({ label, message, toneClassName, icon }: GuidanceItemProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClassName}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <Tooltip
        title={message}
        placement="top"
        overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
        overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
      >
        <span className="inline-flex cursor-help items-center text-slate-400 transition hover:text-slate-600">
          <Info size={12} />
        </span>
      </Tooltip>
    </div>
  );
}

function getPlanningMetrics(functionalities: Functionality[]) {
  return {
    total: functionalities.length,
    withoutCoverage: functionalities.filter(
      item => !item.isCore && !item.isRegression && !item.isSmoke,
    ).length,
    smoke: functionalities.filter(item => item.isSmoke).length,
    regression: functionalities.filter(item => item.isRegression).length,
    highRisk: functionalities.filter(item => item.riskLevel === RiskLevel.HIGH).length,
    highPriority: functionalities.filter(
      item => item.priority === Priority.CRITICAL || item.priority === Priority.HIGH,
    ).length,
  };
}

function matchesCoverageFilter(record: Functionality, value: string) {
  switch (value) {
    case 'core':
      return Boolean(record.isCore);
    case 'regression':
      return Boolean(record.isRegression);
    case 'smoke':
      return Boolean(record.isSmoke);
    case 'without-coverage':
      return !record.isCore && !record.isRegression && !record.isSmoke;
    default:
      return false;
  }
}

function getRowClassName(record: Functionality) {
  const hasCoverage = record.isCore || record.isRegression || record.isSmoke;
  const isHighRisk = record.riskLevel === RiskLevel.HIGH;
  const isHighPriority = record.priority === Priority.CRITICAL || record.priority === Priority.HIGH;

  if (!hasCoverage && isHighRisk && isHighPriority) return 'bg-red-50/60';
  if (!hasCoverage && (isHighRisk || isHighPriority)) return 'bg-amber-50/60';
  return '';
}

function isHighPriorityFunctionality(record: Functionality) {
  return record.priority === Priority.CRITICAL || record.priority === Priority.HIGH;
}

function isRecentlyChanged(record: Functionality) {
  if (!record.lastFunctionalChangeAt) return false;

  const changedAt = new Date(record.lastFunctionalChangeAt);
  if (Number.isNaN(changedAt.getTime())) return false;

  const today = new Date();
  const diffInDays = (today.getTime() - changedAt.getTime()) / (1000 * 60 * 60 * 24);

  return diffInDays <= 14;
}

function formatRecentChangeBadge(value?: string) {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffInDays = Math.round(
    (todayAtMidnight.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays <= 0) return 'Actualizado hoy';
  if (diffInDays === 1) return 'Actualizado hace 1 día';

  return `Actualizado hace ${diffInDays} días`;
}

export default function QaPlanningPage({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { isViewer } = useWorkspaceAccess();
  const {
    data: functionalitiesData,
    isLoading,
    isFetching,
    bulkUpdate,
    save,
  } = useFunctionalities(projectId);
  const { data: testCasesData = [] } = useTestCases(projectId);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [savingIds, setSavingIds] = React.useState<string[]>([]);
  const [isBulkSaving, setIsBulkSaving] = React.useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<React.Key[]>([]);
  const [activeRecommendation, setActiveRecommendation] = React.useState<RecommendationKey | null>(
    null,
  );
  const [tableFilters, setTableFilters] =
    React.useState<PlanningTableFilters>(INITIAL_TABLE_FILTERS);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = React.useState(false);
  const [selectedFunctionality, setSelectedFunctionality] = React.useState<Functionality | null>(
    null,
  );

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testCases = Array.isArray(testCasesData) ? testCasesData : [];

  const testCaseCountByFunctionality = React.useMemo(() => {
    return testCases.reduce((acc, testCase: TestCase) => {
      if (!testCase.functionalityId) return acc;
      acc.set(testCase.functionalityId, (acc.get(testCase.functionalityId) || 0) + 1);
      return acc;
    }, new Map<string, number>());
  }, [testCases]);

  const filteredFunctionalities = React.useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    const items = !normalized
      ? functionalities
      : functionalities.filter(item => {
          return (
            String(item.id || '')
              .toLowerCase()
              .includes(normalized) ||
            String(item.module || '')
              .toLowerCase()
              .includes(normalized) ||
            String(item.name || '')
              .toLowerCase()
              .includes(normalized)
          );
        });

    return [...items].sort((left, right) => String(left.id).localeCompare(String(right.id)));
  }, [functionalities, searchTerm]);

  const metrics = React.useMemo(
    () => getPlanningMetrics(filteredFunctionalities),
    [filteredFunctionalities],
  );

  const recommendationBuckets = React.useMemo(() => {
    const criticalOutsideSmoke = filteredFunctionalities.filter(
      item => item.priority === Priority.CRITICAL && !item.isSmoke,
    );
    const highRiskWithoutCases = filteredFunctionalities.filter(
      item =>
        item.riskLevel === RiskLevel.HIGH && (testCaseCountByFunctionality.get(item.id) || 0) === 0,
    );
    const highPriorityWithoutRegression = filteredFunctionalities.filter(
      item => isHighPriorityFunctionality(item) && !item.isRegression,
    );
    const withoutCoverage = filteredFunctionalities.filter(
      item => !item.isCore && !item.isRegression && !item.isSmoke,
    );
    const recentChanges = filteredFunctionalities.filter(item => isRecentlyChanged(item));

    return {
      critical_outside_smoke: criticalOutsideSmoke,
      high_risk_without_cases: highRiskWithoutCases,
      high_priority_without_regression: highPriorityWithoutRegression,
      without_coverage: withoutCoverage,
      recent_changes: recentChanges,
    } satisfies Record<RecommendationKey, Functionality[]>;
  }, [filteredFunctionalities, testCaseCountByFunctionality]);

  const recommendationCards = React.useMemo(
    () => [
      {
        key: 'critical_outside_smoke' as RecommendationKey,
        label: 'Críticas fuera de Smoke',
        description: 'Funcionalidades críticas que todavía no entran en la validación rápida.',
        toneClassName: 'bg-red-50 text-red-700',
      },
      {
        key: 'high_risk_without_cases' as RecommendationKey,
        label: 'Alto riesgo sin casos',
        description: 'Puntos sensibles que siguen sin casos de prueba asociados.',
        toneClassName: 'bg-amber-50 text-amber-700',
      },
      {
        key: 'high_priority_without_regression' as RecommendationKey,
        label: 'Alta prioridad fuera de Regresión',
        description: 'Ítems de negocio relevantes que aún no quedaron cubiertos en regresión.',
        toneClassName: 'bg-orange-50 text-orange-700',
      },
      {
        key: 'without_coverage' as RecommendationKey,
        label: 'Sin clasificación QA',
        description: 'Funcionalidades sin marca en Core business, Smoke o Regresión.',
        toneClassName: 'bg-slate-100 text-slate-700',
      },
      {
        key: 'recent_changes' as RecommendationKey,
        label: 'Cambios recientes',
        description: 'Funcionalidades con actualización funcional reciente para revisar primero.',
        toneClassName: 'bg-sky-50 text-sky-700',
      },
    ],
    [],
  );

  const recommendationFilteredFunctionalities = React.useMemo(() => {
    if (!activeRecommendation) return filteredFunctionalities;
    return recommendationBuckets[activeRecommendation];
  }, [activeRecommendation, filteredFunctionalities, recommendationBuckets]);

  const visibleFunctionalities = recommendationFilteredFunctionalities;

  const analytics = React.useMemo(() => {
    const totalVisible = visibleFunctionalities.length;
    const withCoverage = visibleFunctionalities.filter(
      item => item.isCore || item.isRegression || item.isSmoke,
    ).length;

    const coverageByType = [
      {
        name: 'Core business',
        value: visibleFunctionalities.filter(item => item.isCore).length,
      },
      {
        name: 'Regresión',
        value: visibleFunctionalities.filter(item => item.isRegression).length,
      },
      {
        name: 'Smoke',
        value: visibleFunctionalities.filter(item => item.isSmoke).length,
      },
      {
        name: 'Sin cobertura',
        value: visibleFunctionalities.filter(
          item => !item.isCore && !item.isRegression && !item.isSmoke,
        ).length,
      },
    ];

    const priorityDistribution = [
      {
        name: 'Critica',
        value: visibleFunctionalities.filter(item => item.priority === Priority.CRITICAL).length,
      },
      {
        name: 'Alta',
        value: visibleFunctionalities.filter(item => item.priority === Priority.HIGH).length,
      },
      {
        name: 'Media',
        value: visibleFunctionalities.filter(item => item.priority === Priority.MEDIUM).length,
      },
      {
        name: 'Baja',
        value: visibleFunctionalities.filter(item => item.priority === Priority.LOW).length,
      },
    ];

    const moduleCoverage = Array.from(
      visibleFunctionalities.reduce((acc, item) => {
        const key = item.module || 'N/A';
        const current = acc.get(key) || { module: key, total: 0, covered: 0 };
        current.total += 1;
        if (item.isCore || item.isRegression || item.isSmoke) {
          current.covered += 1;
        }
        acc.set(key, current);
        return acc;
      }, new Map<string, { module: string; total: number; covered: number }>()),
    )
      .map(([, value]) => ({
        ...value,
        percent: value.total > 0 ? Math.round((value.covered / value.total) * 100) : 0,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);

    const riskCoverageMatrix = [
      {
        risk: 'Alto',
        cells: [
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.HIGH &&
              !item.isCore &&
              !item.isRegression &&
              !item.isSmoke,
          ).length,
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.HIGH &&
              Number(Boolean(item.isCore)) +
                Number(Boolean(item.isRegression)) +
                Number(Boolean(item.isSmoke)) ===
                1,
          ).length,
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.HIGH &&
              Number(Boolean(item.isCore)) +
                Number(Boolean(item.isRegression)) +
                Number(Boolean(item.isSmoke)) >=
                2,
          ).length,
        ],
      },
      {
        risk: 'Medio',
        cells: [
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.MEDIUM &&
              !item.isCore &&
              !item.isRegression &&
              !item.isSmoke,
          ).length,
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.MEDIUM &&
              Number(Boolean(item.isCore)) +
                Number(Boolean(item.isRegression)) +
                Number(Boolean(item.isSmoke)) ===
                1,
          ).length,
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.MEDIUM &&
              Number(Boolean(item.isCore)) +
                Number(Boolean(item.isRegression)) +
                Number(Boolean(item.isSmoke)) >=
                2,
          ).length,
        ],
      },
      {
        risk: 'Bajo',
        cells: [
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.LOW &&
              !item.isCore &&
              !item.isRegression &&
              !item.isSmoke,
          ).length,
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.LOW &&
              Number(Boolean(item.isCore)) +
                Number(Boolean(item.isRegression)) +
                Number(Boolean(item.isSmoke)) ===
                1,
          ).length,
          visibleFunctionalities.filter(
            item =>
              item.riskLevel === RiskLevel.LOW &&
              Number(Boolean(item.isCore)) +
                Number(Boolean(item.isRegression)) +
                Number(Boolean(item.isSmoke)) >=
                2,
          ).length,
        ],
      },
    ];

    return {
      coverageByType,
      coveragePercent: totalVisible > 0 ? Math.round((withCoverage / totalVisible) * 100) : 0,
      moduleCoverage,
      priorityDistribution,
      riskCoverageMatrix,
      totalVisible,
    };
  }, [visibleFunctionalities]);

  React.useEffect(() => {
    setSelectedRowKeys([]);
  }, [activeRecommendation]);

  const priorityOptions = React.useMemo(
    () =>
      Object.values(Priority).map(priority => ({
        label: labelPriority(priority, t),
        value: priority,
      })),
    [t],
  );

  const riskOptions = React.useMemo(
    () =>
      Object.values(RiskLevel).map(risk => ({
        label: labelRisk(risk, t),
        value: risk,
      })),
    [t],
  );

  const moduleFilters = React.useMemo(
    () =>
      Array.from(new Set(functionalities.map(item => item.module).filter(Boolean)))
        .sort((left, right) => String(left).localeCompare(String(right)))
        .map(module => ({
          text: String(module),
          value: String(module),
        })),
    [functionalities],
  );

  const statusFilters = React.useMemo(
    () =>
      FUNCTIONALITY_DEVELOPMENT_STATUSES.map(status => ({
        text: labelTestStatus(status, t),
        value: status,
      })),
    [t],
  );

  const coverageFilters = React.useMemo(
    () => [
      { text: 'Core business', value: 'core' },
      { text: 'Regresión', value: 'regression' },
      { text: 'Smoke', value: 'smoke' },
      { text: 'Sin cobertura', value: 'without-coverage' },
    ],
    [],
  );

  const isRowSaving = React.useCallback((id: string) => savingIds.includes(id), [savingIds]);

  const saveRowUpdate = React.useCallback(
    async (record: Functionality, updates: Partial<Functionality>, successMessage?: string) => {
      const rowId = record.documentId || record.id;
      setSavingIds(current => [...current, rowId]);

      try {
        await save({
          ...record,
          ...updates,
        });
        if (successMessage) {
          message.success(successMessage);
        }
      } catch (error) {
        console.error('Qa planning save failed:', error);
        message.error('No se pudo guardar el cambio en la funcionalidad.');
      } finally {
        setSavingIds(current => current.filter(id => id !== rowId));
      }
    },
    [save],
  );

  const saveBulkUpdate = React.useCallback(
    async (updates: Partial<Functionality>, successMessage: string) => {
      if (selectedRowKeys.length === 0 || isBulkSaving) return;

      const selectedRows = functionalities.filter(item =>
        selectedRowKeys.includes(item.documentId || item.id),
      );

      if (selectedRows.length === 0) return;

      const currentSavingIds = selectedRows.map(item => item.documentId || item.id);
      const selectedIds = selectedRows.map(item => item.id);
      setIsBulkSaving(true);
      setSavingIds(current => [...current, ...currentSavingIds]);

      try {
        await bulkUpdate({ ids: selectedIds, updates });
        message.success(successMessage);
        setSelectedRowKeys([]);
      } catch (error) {
        console.error('Qa planning bulk save failed:', error);
        message.error('No se pudo aplicar la actualización masiva.');
      } finally {
        setIsBulkSaving(false);
        setSavingIds(current => current.filter(id => !currentSavingIds.includes(id)));
      }
    },
    [bulkUpdate, functionalities, isBulkSaving, selectedRowKeys],
  );

  const handleTableChange = React.useCallback((filters: Record<string, FilterValue | null>) => {
    setTableFilters({
      module: (filters.module as React.Key[] | null) || null,
      coverage: (filters.coverage as React.Key[] | null) || null,
      riskLevel: (filters.riskLevel as React.Key[] | null) || null,
      priority: (filters.priority as React.Key[] | null) || null,
      status: (filters.status as React.Key[] | null) || null,
    });
  }, []);

  const columns = React.useMemo<ColumnsType<Functionality>>(
    () => [
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">ID</span>
        ),
        dataIndex: 'id',
        key: 'id',
        width: 92,
        render: (value: string) => (
          <span className="whitespace-nowrap font-medium text-slate-700">{value}</span>
        ),
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Módulo
          </span>
        ),
        dataIndex: 'module',
        key: 'module',
        width: 120,
        filters: moduleFilters,
        filteredValue: tableFilters.module,
        onFilter: (value: boolean | React.Key, record: Functionality) =>
          record.module === String(value),
        render: (value?: string) => value || 'N/A',
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Funcionalidad
          </span>
        ),
        dataIndex: 'name',
        key: 'name',
        width: 220,
        render: (value: string, record: Functionality) => {
          const recentChangeLabel = formatRecentChangeBadge(record.lastFunctionalChangeAt);

          return (
            <div className="flex min-w-[170px] flex-col gap-1">
              <Tooltip title={value}>
                <span className="block whitespace-normal break-words text-sm font-medium leading-5 text-slate-700">
                  {value}
                </span>
              </Tooltip>
              {recentChangeLabel ? (
                <Tooltip title={`Último cambio funcional: ${record.lastFunctionalChangeAt}`}>
                  <span className="inline-flex w-fit rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                    🕒 {recentChangeLabel}
                  </span>
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Casos
          </span>
        ),
        key: 'cases',
        width: 64,
        align: 'center',
        render: (_: unknown, record: Functionality) => {
          const count = testCaseCountByFunctionality.get(record.id) || 0;

          return (
            <Tooltip title="Ver y gestionar casos de prueba">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full px-2 py-1 transition hover:bg-slate-50"
                onClick={event => {
                  event.stopPropagation();
                  setSelectedFunctionality(record);
                  setIsTestCaseModalOpen(true);
                }}
              >
                <Badge count={count} color={count > 0 ? '#10b981' : '#cbd5e1'} size="small">
                  <FileSearchOutlined
                    className={`text-base transition ${
                      count > 0 ? 'text-emerald-500' : 'text-slate-400'
                    }`}
                  />
                </Badge>
                <span
                  className={`text-xs font-bold ${
                    count > 0 ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            </Tooltip>
          );
        },
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cobertura
          </span>
        ),
        key: 'coverage',
        width: 320,
        filters: coverageFilters,
        filteredValue: tableFilters.coverage,
        onFilter: (value: boolean | React.Key, record: Functionality) =>
          matchesCoverageFilter(record, String(value)),
        render: (_: unknown, record: Functionality) => {
          const saving = isRowSaving(record.documentId || record.id);
          const options = [
            {
              key: 'isCore',
              checked: Boolean(record.isCore),
              label: 'Core business',
              activeClassName:
                'border-amber-200 bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)]',
            },
            {
              key: 'isSmoke',
              checked: Boolean(record.isSmoke),
              label: 'Smoke',
              activeClassName:
                'border-orange-200 bg-orange-50 text-orange-700 shadow-[inset_0_0_0_1px_rgba(251,146,60,0.14)]',
            },
            {
              key: 'isRegression',
              checked: Boolean(record.isRegression),
              label: 'Regresión',
              activeClassName:
                'border-violet-200 bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.14)]',
            },
          ] as const;

          return (
            <div onClick={event => event.stopPropagation()}>
              <div className="inline-flex items-center gap-1.5">
                {options.map(option => (
                  <Tooltip
                    key={option.key}
                    title={getCoverageImpactText(option.key)}
                    placement="top"
                    overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
                    overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
                  >
                    <button
                      type="button"
                      disabled={isViewer || saving}
                      className={`inline-flex min-w-[66px] items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-[6px] text-[10px] font-semibold leading-none transition ${
                        option.checked
                          ? option.activeClassName
                          : 'border-slate-200 bg-white text-slate-500'
                      } ${
                        isViewer || saving
                          ? 'cursor-not-allowed opacity-60'
                          : 'hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() =>
                        void saveRowUpdate(record, {
                          [option.key]: !option.checked,
                        } as Partial<Functionality>)
                      }
                    >
                      <span
                        className={`mr-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                          option.checked ? 'border-current bg-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {option.checked ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        ) : null}
                      </span>
                      {option.label}
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          );
        },
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Riesgo
          </span>
        ),
        dataIndex: 'riskLevel',
        key: 'riskLevel',
        width: 126,
        filters: riskOptions.map(option => ({ text: option.label, value: option.value })),
        filteredValue: tableFilters.riskLevel,
        onFilter: (value: boolean | React.Key, record: Functionality) => record.riskLevel === value,
        render: (risk: RiskLevel, record: Functionality) => (
          <Tooltip
            title={getRiskImpactText(risk)}
            placement="topLeft"
            overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
            overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
          >
            <div
              className={`rounded-full border px-2 py-[2px] transition ${
                RISK_BADGE_CLASSNAMES[risk]
              } ${
                isViewer || isRowSaving(record.documentId || record.id)
                  ? 'opacity-70'
                  : 'hover:brightness-95'
              }`}
            >
              <Select
                value={risk}
                disabled={isViewer || isRowSaving(record.documentId || record.id)}
                options={riskOptions}
                variant="borderless"
                size="small"
                popupMatchSelectWidth={340}
                listHeight={240}
                popupClassName="[&_.ant-select-item-option-content]:whitespace-normal [&_.ant-select-item-option-content]:leading-5"
                className="w-full min-w-[108px] [&_.ant-select-arrow]:right-1.5 [&_.ant-select-arrow]:text-current [&_.ant-select-arrow]:opacity-60 [&_.ant-select-selector]:px-0 [&_.ant-select-selection-item]:leading-none"
                onClick={event => event.stopPropagation()}
                onChange={value => void saveRowUpdate(record, { riskLevel: value })}
                optionRender={option => (
                  <div className="py-0.5 pr-2">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <ShieldAlert size={13} className="text-slate-400" />
                      {option.label}
                    </span>
                    <div className="mt-1 pl-5 text-[11px] leading-4 text-slate-400 whitespace-normal">
                      {getRiskImpactText(option.value as RiskLevel)}
                    </div>
                  </div>
                )}
                labelRender={({ value }) => (
                  <span className="inline-flex w-full items-center justify-center gap-1 pr-3 text-[10px] font-semibold leading-none">
                    <ShieldAlert size={10} />
                    {labelRisk(value as RiskLevel, t)}
                  </span>
                )}
              />
            </div>
          </Tooltip>
        ),
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Prioridad
          </span>
        ),
        dataIndex: 'priority',
        key: 'priority',
        width: 116,
        filters: priorityOptions.map(option => ({ text: option.label, value: option.value })),
        filteredValue: tableFilters.priority,
        onFilter: (value: boolean | React.Key, record: Functionality) => record.priority === value,
        render: (priority: Priority, record: Functionality) => (
          <Tooltip
            title={getPriorityImpactText(priority)}
            placement="topLeft"
            overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
            overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
          >
            <div
              className={`rounded-full border px-2 py-[2px] transition ${
                PRIORITY_BADGE_CLASSNAMES[priority]
              } ${
                isViewer || isRowSaving(record.documentId || record.id)
                  ? 'opacity-70'
                  : 'hover:brightness-95'
              }`}
            >
              <Select
                value={priority}
                disabled={isViewer || isRowSaving(record.documentId || record.id)}
                options={priorityOptions}
                variant="borderless"
                size="small"
                popupMatchSelectWidth={340}
                listHeight={240}
                popupClassName="[&_.ant-select-item-option-content]:whitespace-normal [&_.ant-select-item-option-content]:leading-5"
                className="w-full min-w-[98px] [&_.ant-select-arrow]:right-1.5 [&_.ant-select-arrow]:text-current [&_.ant-select-arrow]:opacity-60 [&_.ant-select-selector]:px-0 [&_.ant-select-selection-item]:leading-none"
                onClick={event => event.stopPropagation()}
                onChange={value => void saveRowUpdate(record, { priority: value })}
                optionRender={option => (
                  <div className="py-0.5 pr-2">
                    <span className="text-xs font-semibold text-slate-700">{option.label}</span>
                    <div className="mt-1 text-[11px] leading-4 text-slate-400 whitespace-normal">
                      {getPriorityImpactText(option.value as Priority)}
                    </div>
                  </div>
                )}
                labelRender={({ value }) => (
                  <span className="inline-flex w-full items-center justify-center pr-3 text-[10px] font-semibold leading-none">
                    {labelPriority(value as Priority, t)}
                  </span>
                )}
              />
            </div>
          </Tooltip>
        ),
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Estado de desarrollo
          </span>
        ),
        dataIndex: 'status',
        key: 'status',
        width: 126,
        filters: statusFilters,
        filteredValue: tableFilters.status,
        onFilter: (value: boolean | React.Key, record: Functionality) => record.status === value,
        render: (status: TestStatus) => {
          const config = STATUS_BADGE_CONFIG[status] || FALLBACK_STATUS_BADGE_CONFIG;
          const statusChipClassName =
            STATUS_CHIP_CLASSNAMES[status] || 'border-slate-200 bg-slate-50 text-slate-600';

          return (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[6px] text-[10px] font-semibold leading-none ${statusChipClassName}`}
            >
              <span className={`h-2 w-2 rounded-full ${config.dot}`} />
              {labelTestStatus(status, t)}
            </div>
          );
        },
      },
    ],
    [
      coverageFilters,
      isRowSaving,
      isViewer,
      moduleFilters,
      priorityOptions,
      riskOptions,
      saveRowUpdate,
      statusFilters,
      t,
      tableFilters,
      testCaseCountByFunctionality,
    ],
  );

  const orderedColumns = React.useMemo<ColumnsType<Functionality>>(() => {
    const desiredOrder = [
      'id',
      'module',
      'name',
      'cases',
      'riskLevel',
      'priority',
      'coverage',
      'status',
    ];

    return desiredOrder
      .map(columnKey => columns.find(column => String(column.key) === columnKey))
      .filter((column): column is ColumnsType<Functionality>[number] => Boolean(column));
  }, [columns]);

  const expandable = React.useMemo<ExpandableConfig<Functionality>>(
    () => ({
      columnWidth: 56,
      expandIcon: ({ expanded, onExpand, record }) => (
        <button
          type="button"
          aria-label={
            expanded ? 'Ocultar detalle de la funcionalidad' : 'Ver detalle de la funcionalidad'
          }
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-sky-300 hover:text-sky-600"
          onClick={event => onExpand(record, event)}
        >
          {expanded ? (
            <MinusOutlined className="text-[10px]" />
          ) : (
            <PlusOutlined className="text-[10px]" />
          )}
        </button>
      ),
      expandedRowRender: record => (
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <Text strong>Funcionalidad</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">{record.name}</Paragraph>
            </div>
            <div>
              <Text strong>Módulo</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                {record.module || 'N/A'}
              </Paragraph>
            </div>
            <div>
              <Text strong>Sprint</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                {record.sprint || 'N/A'}
              </Paragraph>
            </div>
            <div>
              <Text strong>Roles autorizados</Text>
              <Paragraph className="!mb-0 !mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {record.roles.length > 0 ? record.roles.join(', ') : 'Sin roles registrados.'}
              </Paragraph>
            </div>
            <div>
              <Text strong>Jira</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                {record.jiraIssueKey || record.jiraTaskUrl || 'Sin vínculo Jira.'}
              </Paragraph>
            </div>
            <div>
              <Text strong>Último cambio funcional</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                {record.lastFunctionalChangeAt || 'No marcado.'}
              </Paragraph>
            </div>
            <div>
              <Text strong>Fecha de entrega</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                {record.deliveryDate || 'N/A'}
              </Paragraph>
            </div>
            <div>
              <Text strong>Unidad de entrega</Text>
              <Paragraph className="!mb-0 !mt-2 text-sm text-slate-700">
                {record.deliveryUnitName || 'N/A'}
              </Paragraph>
            </div>
          </div>
        </div>
      ),
    }),
    [],
  );

  return (
    <div className="mx-auto max-w-[1520px] space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Title level={2} className="!m-0 text-slate-800">
            Estrategia QA
          </Title>
          <Text type="secondary">
            Clasifica cobertura, riesgo y prioridad para organizar el alcance de smoke y regresión.
          </Text>
        </div>
      </div>

      <Row gutter={[20, 20]} wrap={false} className="overflow-x-auto pb-1">
        <MetricCard label="Total visibles" value={metrics.total} valueClassName="text-slate-800" />
        <MetricCard
          label="Sin cobertura"
          value={metrics.withoutCoverage}
          valueClassName="text-slate-700"
        />
        <MetricCard label="Smoke" value={metrics.smoke} valueClassName="text-orange-600" />
        <MetricCard label="Regresión" value={metrics.regression} valueClassName="text-violet-600" />
        <MetricCard label="Alto riesgo" value={metrics.highRisk} valueClassName="text-red-600" />
        <MetricCard
          label="Alta prioridad"
          value={metrics.highPriority}
          valueClassName="text-amber-600"
        />
      </Row>

      <Card className="rounded-2xl border-slate-100 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              Enfoque QA
            </div>
            <Title level={5} className="!mb-1 !mt-0 text-slate-800">
              Recomendaciones QA
            </Title>
            <Text type="secondary" className="text-sm">
              Usa estas alertas para enfocar la tabla sin agregar ruido ni columnas nuevas.
            </Text>
          </div>
          {activeRecommendation ? (
            <Button
              onClick={() => setActiveRecommendation(null)}
              className="rounded-full border-slate-200"
            >
              Mostrar todo
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {recommendationCards.map(card => (
            <RecommendationCard
              key={card.key}
              active={activeRecommendation === card.key}
              count={recommendationBuckets[card.key].length}
              description={card.description}
              label={card.label}
              toneClassName={card.toneClassName}
              onClick={() =>
                setActiveRecommendation(current => (current === card.key ? null : card.key))
              }
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <div
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeRecommendation
                ? 'border border-sky-200 bg-sky-50 text-sky-700'
                : 'border border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {activeRecommendation
              ? `${recommendationFilteredFunctionalities.length} funcionalidades filtradas por recomendación`
              : 'Sin recomendación aplicada'}
          </div>
          <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
            El filtro actúa sobre la tabla actual y mantiene la edición inline.
          </div>
        </div>
      </Card>

      {!isViewer && selectedRowKeys.length > 0 ? (
        <Card className="mt-4 mb-3 rounded-2xl border-sky-200 bg-gradient-to-r from-sky-50 via-white to-blue-50 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {selectedRowKeys.length} funcionalidades seleccionadas
              </div>
              <div className="text-sm text-slate-500">
                {isBulkSaving
                  ? 'Guardando cambios masivos sobre la selección...'
                  : 'Aplica cobertura masiva directamente sobre la funcionalidad.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {isBulkSaving ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                  Guardando cambios masivos...
                </div>
              ) : null}
              <Button
                className="rounded-full border-sky-200 bg-white px-4 font-semibold text-sky-700 shadow-sm hover:!border-sky-300 hover:!bg-sky-50 hover:!text-sky-800"
                disabled={isBulkSaving}
                onClick={() =>
                  void saveBulkUpdate(
                    { lastFunctionalChangeAt: new Date().toISOString().split('T')[0] },
                    'Cambio reciente aplicado a la selección.',
                  )
                }
              >
                Marcar cambio reciente
              </Button>
              <Button
                className="rounded-full border-amber-200 bg-amber-50 px-4 font-semibold text-amber-700 shadow-sm hover:!border-amber-300 hover:!bg-amber-100 hover:!text-amber-800"
                disabled={isBulkSaving}
                onClick={() =>
                  void saveBulkUpdate({ isCore: true }, 'Core business aplicado a la selección.')
                }
              >
                Marcar Core business
              </Button>
              <Button
                className="rounded-full border-violet-200 bg-violet-50 px-4 font-semibold text-violet-700 shadow-sm hover:!border-violet-300 hover:!bg-violet-100 hover:!text-violet-800"
                disabled={isBulkSaving}
                onClick={() =>
                  void saveBulkUpdate({ isRegression: true }, 'Regresión aplicada a la selección.')
                }
              >
                Marcar Regresión
              </Button>
              <Button
                className="rounded-full border-orange-200 bg-orange-50 px-4 font-semibold text-orange-700 shadow-sm hover:!border-orange-300 hover:!bg-orange-100 hover:!text-orange-800"
                disabled={isBulkSaving}
                onClick={() =>
                  void saveBulkUpdate({ isSmoke: true }, 'Smoke aplicado a la selección.')
                }
              >
                Marcar Smoke
              </Button>
              <Button
                className="rounded-full border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm hover:!border-slate-300 hover:!bg-slate-50 hover:!text-slate-800"
                disabled={isBulkSaving}
                onClick={() =>
                  void saveBulkUpdate(
                    { isCore: false, isRegression: false, isSmoke: false },
                    'Cobertura limpiada para la selección.',
                  )
                }
              >
                Limpiar cobertura
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mx-auto max-w-[1520px] rounded-2xl border-slate-100 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Operación
            </div>
            <Title level={5} className="!mb-1 !mt-0 text-slate-800">
              Tabla de planificación
            </Title>
            <Text type="secondary" className="text-sm">
              Clasifica cobertura, riesgo y prioridad directamente sobre cada funcionalidad.
            </Text>
          </div>
          {activeRecommendation ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-sm">
              <div className="font-semibold">Vista filtrada por recomendacion QA</div>
              <div className="mt-1 text-sky-700">
                Estas viendo solo funcionalidades priorizadas por la alerta activa.
              </div>
            </div>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <Input.Search
            allowClear
            placeholder="Buscar por funcionalidad"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            className="w-full max-w-[440px]"
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-slate-50/70 px-4 py-2.5">
          <GuidanceItem
            label="Riesgo"
            message="Medir impacto"
            toneClassName="bg-transparent text-slate-700"
            icon={<TriangleAlert size={14} className="text-amber-500" />}
          />
          <GuidanceItem
            label="Prioridad"
            message="Definir orden de ejecución"
            toneClassName="bg-transparent text-slate-700"
            icon={<Star size={14} className="text-sky-500" />}
          />
          <GuidanceItem
            label="Smoke"
            message="Validar en cada release"
            toneClassName="bg-transparent text-slate-700"
            icon={<Flame size={14} className="text-orange-500" />}
          />
          <GuidanceItem
            label="Regresión"
            message="Revalidar ante cambios"
            toneClassName="bg-transparent text-slate-700"
            icon={<RefreshCw size={14} className="text-violet-500" />}
          />
          {activeRecommendation ? (
            <div className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              Recomendacion activa
            </div>
          ) : null}
        </div>
        <Table
          rowSelection={
            isViewer
              ? undefined
              : {
                  selectedRowKeys,
                  onChange: keys => setSelectedRowKeys(keys),
                  columnWidth: 52,
                }
          }
          columns={orderedColumns}
          dataSource={recommendationFilteredFunctionalities}
          rowKey={record => record.documentId || record.id}
          loading={isLoading || (isFetching && recommendationFilteredFunctionalities.length === 0)}
          expandable={expandable}
          rowClassName={record => getRowClassName(record)}
          size="small"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
          }}
          sticky={{ offsetHeader: 0 }}
          locale={{
            emptyText: searchTerm.trim()
              ? 'No encontramos funcionalidades con esa búsqueda.'
              : activeRecommendation
                ? 'No hay funcionalidades para esta recomendación en la vista actual. Prueba otra alerta o vuelve a mostrar todo.'
                : 'No hay funcionalidades registradas para este proyecto.',
          }}
          onChange={(_, filters) => handleTableChange(filters)}
          className="[&_.ant-table-container]:rounded-2xl [&_.ant-table]:text-slate-700 [&_.ant-table-thead>tr>th]:sticky [&_.ant-table-thead>tr>th]:top-0 [&_.ant-table-thead>tr>th]:z-10 [&_.ant-table-thead>tr>th]:bg-sky-50 [&_.ant-table-thead>tr>th]:py-3 [&_.ant-table-tbody>tr:hover>td]:bg-sky-50/40 [&_.ant-table-tbody>tr>td]:py-1.5 [&_.ant-table-tbody>tr>td]:align-middle [&_.ant-table-tbody>tr>td]:border-b-slate-100"
        />
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              Analítica
            </div>
            <Title level={5} className="!mb-1 !mt-0 text-slate-800">
              Visión analítica QA
            </Title>
            <Text type="secondary" className="text-sm">
              Resumen ejecutivo de la vista actual. Sirve para validar panorama, no para reemplazar
              la tabla.
            </Text>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            Cobertura visible: {analytics.coveragePercent}% sobre {analytics.totalVisible}{' '}
            funcionalidades
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Cobertura por tipo</div>
                <div className="mt-1 text-sm text-slate-500">
                  Distribución visible entre Core business, Regresión, Smoke y sin cobertura.
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="mx-auto h-[220px] w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.coverageByType}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {analytics.coverageByType.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={COVERAGE_CHART_COLORS[index % COVERAGE_CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {analytics.coverageByType.map((entry, index) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor:
                            COVERAGE_CHART_COLORS[index % COVERAGE_CHART_COLORS.length],
                        }}
                      />
                      <span className="text-sm font-medium text-slate-700">{entry.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-800">Distribución de prioridad</div>
              <div className="mt-1 text-sm text-slate-500">
                Balance actual de prioridades dentro del alcance visible.
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.priorityDistribution}
                  margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <RechartsTooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {analytics.priorityDistribution.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={PRIORITY_CHART_COLORS[index % PRIORITY_CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-800">Cobertura por módulo top 5</div>
              <div className="mt-1 text-sm text-slate-500">
                Módulos con mayor volumen dentro de la vista actual.
              </div>
            </div>
            <div className="space-y-4">
              {analytics.moduleCoverage.map(item => (
                <div key={item.module}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-700">
                      {item.module}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.percent}% ({item.covered}/{item.total})
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              {analytics.moduleCoverage.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No hay módulos visibles para resumir ahora mismo.
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="mb-4">
              <div className="text-sm font-semibold text-slate-800">
                Mapa de riesgo vs. cobertura
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Identifica rápido dónde siguen las mayores brechas QA.
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="grid grid-cols-[92px_repeat(3,1fr)] bg-slate-50 text-[11px] font-semibold text-slate-500">
                <div className="px-3 py-2">Riesgo</div>
                <div className="px-3 py-2 text-center">Sin cobertura</div>
                <div className="px-3 py-2 text-center">Cobertura simple</div>
                <div className="px-3 py-2 text-center">Cobertura amplia</div>
              </div>
              {analytics.riskCoverageMatrix.map(row => (
                <div
                  key={row.risk}
                  className="grid grid-cols-[92px_repeat(3,1fr)] border-t border-slate-100"
                >
                  <div className="flex items-center px-3 py-3 text-sm font-semibold text-slate-700">
                    {row.risk}
                  </div>
                  {row.cells.map((value, index) => {
                    const toneClassName =
                      index === 0
                        ? 'bg-red-50 text-red-700'
                        : index === 1
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700';

                    return (
                      <div key={`${row.risk}-${index}`} className="px-2 py-2">
                        <div
                          className={`rounded-xl px-3 py-3 text-center text-sm font-bold ${toneClassName}`}
                        >
                          {value}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {selectedRowKeys.length > 0 ? (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setSelectedRowKeys([]);
              setTableFilters(INITIAL_TABLE_FILTERS);
            }}
            className="rounded-lg"
          >
            Limpiar selección
          </Button>
        </div>
      ) : null}

      <Modal
        title={null}
        open={isTestCaseModalOpen}
        onCancel={() => setIsTestCaseModalOpen(false)}
        footer={null}
        width={1000}
        centered
        destroyOnHidden
      >
        {selectedFunctionality ? (
          <React.Suspense
            fallback={
              <div className="py-6 text-center text-sm text-slate-400">
                Cargando casos de prueba...
              </div>
            }
          >
            <TestCaseManagement
              projectId={projectId || ''}
              functionalityId={selectedFunctionality.id}
              functionalityName={selectedFunctionality.name}
              moduleName={selectedFunctionality.module}
            />
          </React.Suspense>
        ) : null}
      </Modal>
    </div>
  );
}
