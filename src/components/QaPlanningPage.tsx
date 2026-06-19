import React from 'react';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Drawer,
  Dropdown,
  Grid,
  Input,
  Modal,
  Popover,
  Row,
  Select,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { FileSearchOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUp,
  Clock3,
  Flame,
  Info,
  RefreshCw,
  Settings2,
  Star,
  TriangleAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { ExpandableConfig, FilterValue } from 'antd/es/table/interface';
import type { MenuProps } from 'antd';
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
  AutomationResultStatus,
  AutomationStatus,
  AutomationTool,
  Functionality,
  FUNCTIONALITY_DEVELOPMENT_STATUSES,
  ImpactLevel,
  Priority,
  ProbabilityLevel,
  RiskLevel,
  TestCase,
  TestStatus,
  deriveAutomationStatus,
  isAutomatedCoverageStatus,
} from '../types';
import {
  labelImpact,
  labelPriority,
  labelProbability,
  labelRisk,
  labelTestStatus,
} from '../i18n/labels';
import { calculateRiskLevel } from '../modules/functionalities/utils/riskMatrix';

const { Title, Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;
const TestCaseManagement = React.lazy(() => import('./TestCaseManagement'));
const INFO_TOOLTIP_OVERLAY_STYLE = { maxWidth: 320 };
const INFO_TOOLTIP_INNER_STYLE: React.CSSProperties = {
  whiteSpace: 'normal',
  lineHeight: 1.45,
};
const COVERAGE_CHART_COLORS = ['#f59e0b', '#7c3aed', '#f97316', '#cbd5e1'];
const PRIORITY_CHART_COLORS = ['#ef4444', '#f97316', '#0ea5e9', '#94a3b8'];
const PLANNING_TABLE_COLUMN_STORAGE_KEY = 'qa-planning-table-visible-columns-v2';
const PLANNING_TABLE_COLUMN_ORDER = [
  'name',
  'cases',
  'priority',
  'riskLevel',
  'coverage',
  'status',
  'module',
  'id',
  'impactLevel',
  'probabilityLevel',
] as const;
const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'name',
  'cases',
  'priority',
  'riskLevel',
  'coverage',
  'status',
] as const satisfies readonly (typeof PLANNING_TABLE_COLUMN_ORDER)[number][];

type PlanningColumnKey = (typeof PLANNING_TABLE_COLUMN_ORDER)[number];

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
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  outlineClassName: string;
  toneClassName: string;
};

type GuidanceItemProps = {
  label: string;
  message: string;
  toneClassName: string;
  icon: React.ReactNode;
};

type PlanningColumnOption = {
  key: PlanningColumnKey;
  label: string;
};

type ChipSelectOption<TValue extends string> = {
  label: React.ReactNode;
  value: TValue;
};

type PlanningTableFilters = {
  module: React.Key[] | null;
  coverage: React.Key[] | null;
  riskLevel: React.Key[] | null;
  priority: React.Key[] | null;
  status: React.Key[] | null;
};

type BulkEditDraft = {
  priority?: Priority;
  status?: TestStatus;
  isCore?: boolean;
  isSmoke?: boolean;
  isRegression?: boolean;
};

type DetailEditDraft = {
  priority: Priority;
  impactLevel: ImpactLevel;
  probabilityLevel: ProbabilityLevel;
  isCore: boolean;
  isSmoke: boolean;
  isRegression: boolean;
  status: TestStatus;
  sprint: string;
  markRecentChange: boolean;
};

type BulkCoverageValue = boolean | undefined;

const INITIAL_TABLE_FILTERS: PlanningTableFilters = {
  module: null,
  coverage: null,
  riskLevel: null,
  priority: null,
  status: null,
};

const INITIAL_BULK_EDIT_DRAFT: BulkEditDraft = {
  priority: undefined,
  status: undefined,
  isCore: undefined,
  isSmoke: undefined,
  isRegression: undefined,
};

const PLANNING_TABLE_COLUMN_OPTIONS: PlanningColumnOption[] = [
  { key: 'id', label: 'ID' },
  { key: 'module', label: 'Módulo' },
  { key: 'name', label: 'Funcionalidad' },
  { key: 'cases', label: 'Casos' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'impactLevel', label: 'Impacto' },
  { key: 'probabilityLevel', label: 'Probabilidad' },
  { key: 'riskLevel', label: 'Riesgo' },
  { key: 'coverage', label: 'Cobertura' },
  { key: 'status', label: 'Estado de desarrollo' },
];

const RISK_BADGE_CLASSNAMES: Record<RiskLevel, string> = {
  [RiskLevel.HIGH]: 'border-red-200 bg-red-50 text-red-700',
  [RiskLevel.MEDIUM]: 'border-amber-200 bg-amber-50 text-amber-700',
  [RiskLevel.LOW]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const RISK_DOT_CLASSNAMES: Record<RiskLevel, string> = {
  [RiskLevel.HIGH]: 'bg-gradient-to-br from-rose-300 to-red-600',
  [RiskLevel.MEDIUM]: 'bg-gradient-to-br from-amber-200 to-yellow-500',
  [RiskLevel.LOW]: 'bg-gradient-to-br from-emerald-300 to-green-500',
};

const PRIORITY_BADGE_CLASSNAMES: Record<Priority, string> = {
  [Priority.CRITICAL]: 'border-red-200 bg-red-50 text-red-700',
  [Priority.HIGH]: 'border-orange-200 bg-orange-50 text-orange-700',
  [Priority.MEDIUM]: 'border-sky-200 bg-sky-50 text-sky-700',
  [Priority.LOW]: 'border-slate-200 bg-slate-50 text-slate-600',
};

function getAutomationStatusBadgeClassName(status: AutomationStatus) {
  switch (status) {
    case AutomationStatus.AUTOMATED:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case AutomationStatus.CANDIDATE:
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case AutomationStatus.OBSOLETE:
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case AutomationStatus.NOT_AUTOMATED:
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function getAutomationResultBadgeClassName(status?: AutomationResultStatus) {
  switch (status) {
    case AutomationResultStatus.PASSED:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case AutomationResultStatus.FAILED:
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case AutomationResultStatus.SKIPPED:
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case AutomationResultStatus.UNKNOWN:
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

const PRIORITY_TEXT_CLASSNAMES: Record<Priority, string> = {
  [Priority.CRITICAL]: 'text-red-700',
  [Priority.HIGH]: 'text-orange-700',
  [Priority.MEDIUM]: 'text-sky-700',
  [Priority.LOW]: 'text-slate-600',
};

const IMPACT_BADGE_CLASSNAMES: Record<ImpactLevel, string> = {
  [ImpactLevel.HIGH]: 'border-red-200 bg-red-50 text-red-700',
  [ImpactLevel.MEDIUM]: 'border-amber-200 bg-amber-50 text-amber-700',
  [ImpactLevel.LOW]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const PROBABILITY_BADGE_CLASSNAMES: Record<ProbabilityLevel, string> = {
  [ProbabilityLevel.HIGH]: 'border-red-200 bg-red-50 text-red-700',
  [ProbabilityLevel.MEDIUM]: 'border-amber-200 bg-amber-50 text-amber-700',
  [ProbabilityLevel.LOW]: 'border-emerald-200 bg-emerald-50 text-emerald-700',
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

const MOJIBAKE_PATTERN = /Ãƒ.|Ã‚/g;

function repairMojibakeText(text: string) {
  if (!MOJIBAKE_PATTERN.test(text)) {
    return text;
  }

  let normalizedText = text;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decodedText = new TextDecoder('utf-8').decode(
        Uint8Array.from(normalizedText, character => character.charCodeAt(0)),
      );

      if (decodedText === normalizedText) {
        break;
      }

      normalizedText = decodedText;
      if (!MOJIBAKE_PATTERN.test(normalizedText)) {
        break;
      }
    } catch {
      break;
    }
  }

  return normalizedText;
}

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

function getImpactLevelText(impact: ImpactLevel) {
  switch (impact) {
    case ImpactLevel.HIGH:
      return 'Alto: si falla, el impacto en negocio o usuarios es significativo.';
    case ImpactLevel.MEDIUM:
      return 'Medio: afecta el flujo, pero existe contención operativa.';
    case ImpactLevel.LOW:
      return 'Bajo: el daño esperado es acotado.';
    default:
      return '';
  }
}

function getProbabilityImpactText(probability: ProbabilityLevel) {
  switch (probability) {
    case ProbabilityLevel.HIGH:
      return 'Alta: es más probable que falle por complejidad o cambios recientes.';
    case ProbabilityLevel.MEDIUM:
      return 'Media: requiere seguimiento normal.';
    case ProbabilityLevel.LOW:
      return 'Baja: se espera estabilidad relativa.';
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
  icon,
  label,
  onClick,
  outlineClassName,
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
        <div className="min-w-0 flex items-start gap-2.5">
          <span
            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${outlineClassName}`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-5 text-slate-800">{label}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{description}</div>
          </div>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClassName}`}>{count}</div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-sky-700">
        <span>{active ? 'Filtro activo' : 'Ver detalle'}</span>
        <span aria-hidden="true">&rarr;</span>
      </div>
    </button>
  );
}

function InlineChipSelect<TValue extends string>({
  value,
  options,
  disabled,
  chipClassName,
  onSelect,
  getDescription,
}: {
  value: TValue;
  options: ChipSelectOption<TValue>[];
  disabled?: boolean;
  chipClassName: string;
  onSelect: (value: TValue) => void;
  getDescription: (value: TValue) => string;
}) {
  const selectedOption = options.find(option => option.value === value) || options[0];

  const items: NonNullable<MenuProps['items']> = options.map(option => ({
    key: option.value,
    label: (
      <div className="py-0.5 pr-2">
        <div className="text-xs font-semibold text-slate-700">{option.label}</div>
        <div className="mt-1 whitespace-normal text-[11px] leading-4 text-slate-400">
          {getDescription(option.value)}
        </div>
      </div>
    ),
  }));

  return (
    <Dropdown
      trigger={disabled ? [] : ['click']}
      placement="bottomLeft"
      menu={{
        items,
        selectable: true,
        selectedKeys: [value],
        onClick: ({ key }) => onSelect(key as TValue),
      }}
      overlayClassName="[&_.ant-dropdown-menu]:rounded-2xl [&_.ant-dropdown-menu]:p-1 [&_.ant-dropdown-menu-item]:rounded-xl [&_.ant-dropdown-menu-item]:px-3 [&_.ant-dropdown-menu-item]:py-2"
    >
      <button
        type="button"
        disabled={disabled}
        className={`relative inline-flex h-6 w-full min-w-0 items-center justify-center gap-1 rounded-full border px-3 pr-7 text-[10px] font-semibold leading-none transition ${chipClassName} ${
          disabled ? 'cursor-not-allowed opacity-70' : 'hover:brightness-95'
        }`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60">
          <ChevronDown size={12} strokeWidth={2} />
        </span>
      </button>
    </Dropdown>
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

function matchesTableFilters(record: Functionality, filters: PlanningTableFilters) {
  if (filters.module?.length && !filters.module.some(value => record.module === String(value))) {
    return false;
  }

  if (
    filters.coverage?.length &&
    !filters.coverage.some(value => matchesCoverageFilter(record, String(value)))
  ) {
    return false;
  }

  if (
    filters.riskLevel?.length &&
    !filters.riskLevel.some(value => record.riskLevel === String(value))
  ) {
    return false;
  }

  if (
    filters.priority?.length &&
    !filters.priority.some(value => record.priority === String(value))
  ) {
    return false;
  }

  if (filters.status?.length && !filters.status.some(value => record.status === String(value))) {
    return false;
  }

  return true;
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

function getCoverageSummary(record: Functionality) {
  const coverageItems: Array<{ key: 'core' | 'smoke' | 'regression'; label: string }> = [];

  if (record.isCore) coverageItems.push({ key: 'core', label: 'Core' });
  if (record.isSmoke) coverageItems.push({ key: 'smoke', label: 'Smoke' });
  if (record.isRegression) coverageItems.push({ key: 'regression', label: 'Regresión' });

  return coverageItems;
}

function getCoverageChipClassName(key: 'core' | 'smoke' | 'regression') {
  switch (key) {
    case 'core':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'smoke':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'regression':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function getCoverageChipIcon(key: 'core' | 'smoke' | 'regression') {
  const iconClassName = 'h-4 w-4';

  switch (key) {
    case 'core':
      return (
        <span className={`${iconClassName} text-sky-600`}>
          <Building2 size={13} strokeWidth={2} />
        </span>
      );
    case 'smoke':
      return (
        <span className={`${iconClassName} text-orange-500`}>
          <Flame size={13} strokeWidth={2} />
        </span>
      );
    case 'regression':
      return (
        <span className={`${iconClassName} text-violet-600`}>
          <RefreshCw size={13} strokeWidth={2} />
        </span>
      );
    default:
      return null;
  }
}

function getPriorityVisualLabel(priority: Priority) {
  switch (priority) {
    case Priority.CRITICAL:
      return {
        icon: <ChevronsUp size={15} strokeWidth={2.25} />,
        label: 'Crítico',
      };
    case Priority.HIGH:
      return {
        icon: <ChevronUp size={15} strokeWidth={2.5} />,
        label: 'Alto',
      };
    case Priority.MEDIUM:
      return {
        icon: <ChevronRight size={15} strokeWidth={2.5} />,
        label: 'Medio',
      };
    case Priority.LOW:
      return {
        icon: <ChevronDown size={15} strokeWidth={2.5} />,
        label: 'Bajo',
      };
    default:
      return {
        icon: <ChevronRight size={15} strokeWidth={2.5} />,
        label: String(priority),
      };
  }
}

function getBulkCoverageOptionClassName(
  currentValue: BulkCoverageValue,
  optionValue: BulkCoverageValue,
) {
  const isActive = currentValue === optionValue;

  if (optionValue === undefined) {
    return isActive
      ? 'border-slate-300 bg-slate-100 text-slate-700'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300';
  }

  if (optionValue) {
    return isActive
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200';
  }

  return isActive
    ? 'border-rose-300 bg-rose-50 text-rose-700'
    : 'border-slate-200 bg-white text-slate-600 hover:border-rose-200';
}

export default function QaPlanningPage({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const screens = useBreakpoint();
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
  const [visibleColumnKeys, setVisibleColumnKeys] = React.useState<PlanningColumnKey[]>([
    ...DEFAULT_VISIBLE_COLUMN_KEYS,
  ]);
  const [moduleCoverageFilter, setModuleCoverageFilter] = React.useState<string[]>([]);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = React.useState(false);
  const [selectedFunctionality, setSelectedFunctionality] = React.useState<Functionality | null>(
    null,
  );
  const [isBulkDrawerOpen, setIsBulkDrawerOpen] = React.useState(false);
  const [detailEditDraft, setDetailEditDraft] = React.useState<DetailEditDraft | null>(null);
  const [bulkEditDraft, setBulkEditDraft] = React.useState<BulkEditDraft>(INITIAL_BULK_EDIT_DRAFT);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testCases = Array.isArray(testCasesData) ? testCasesData : [];

  const testCaseCountByFunctionality = React.useMemo(() => {
    return testCases.reduce((acc, testCase: TestCase) => {
      if (!testCase.functionalityId) return acc;
      acc.set(testCase.functionalityId, (acc.get(testCase.functionalityId) || 0) + 1);
      return acc;
    }, new Map<string, number>());
  }, [testCases]);

  const openTestCaseModal = React.useCallback((record: Functionality) => {
    setSelectedFunctionality(record);
    setIsTestCaseModalOpen(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = `${PLANNING_TABLE_COLUMN_STORAGE_KEY}:${projectId || 'default'}`;
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) return;

    try {
      const parsed = JSON.parse(storedValue);
      if (!Array.isArray(parsed)) return;

      const sanitizedKeys = PLANNING_TABLE_COLUMN_ORDER.filter(columnKey =>
        parsed.includes(columnKey),
      );

      if (sanitizedKeys.length > 0) {
        setVisibleColumnKeys(sanitizedKeys);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageKey = `${PLANNING_TABLE_COLUMN_STORAGE_KEY}:${projectId || 'default'}`;
    window.localStorage.setItem(storageKey, JSON.stringify(visibleColumnKeys));
  }, [projectId, visibleColumnKeys]);

  React.useEffect(() => {
    if (!selectedFunctionality) return;

    const refreshedSelection =
      functionalities.find(item => item.id === selectedFunctionality.id) || null;
    setSelectedFunctionality(refreshedSelection);
  }, [functionalities, selectedFunctionality]);

  React.useEffect(() => {
    if (!selectedFunctionality) {
      setDetailEditDraft(null);
      return;
    }

    setDetailEditDraft({
      priority: selectedFunctionality.priority,
      impactLevel: selectedFunctionality.impactLevel,
      probabilityLevel: selectedFunctionality.probabilityLevel,
      isCore: Boolean(selectedFunctionality.isCore),
      isSmoke: Boolean(selectedFunctionality.isSmoke),
      isRegression: Boolean(selectedFunctionality.isRegression),
      status: selectedFunctionality.status,
      sprint: selectedFunctionality.sprint || '',
      markRecentChange: false,
    });
  }, [selectedFunctionality]);

  React.useEffect(() => {
    if (selectedRowKeys.length === 0) {
      setBulkEditDraft(INITIAL_BULK_EDIT_DRAFT);
    }
  }, [selectedRowKeys]);

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
        icon: <TriangleAlert size={12} className="text-red-500" />,
        outlineClassName: 'border-red-200 bg-red-50 text-red-600',
        toneClassName: 'bg-red-50 text-red-700',
      },
      {
        key: 'high_risk_without_cases' as RecommendationKey,
        label: 'Alto riesgo sin casos',
        description: 'Puntos sensibles que siguen sin casos de prueba asociados.',
        icon: <TriangleAlert size={12} className="text-amber-500" />,
        outlineClassName: 'border-amber-200 bg-amber-50 text-amber-600',
        toneClassName: 'bg-amber-50 text-amber-700',
      },
      {
        key: 'high_priority_without_regression' as RecommendationKey,
        label: 'Alta prioridad fuera de Regresión',
        description: 'Ítems de negocio relevantes que aún no quedaron cubiertos en regresión.',
        icon: <Star size={12} className="text-orange-500" />,
        outlineClassName: 'border-orange-200 bg-orange-50 text-orange-600',
        toneClassName: 'bg-orange-50 text-orange-700',
      },
      {
        key: 'without_coverage' as RecommendationKey,
        label: 'Sin clasificación QA',
        description: 'Funcionalidades sin marca en Core business, Smoke o Regresión.',
        icon: <Info size={12} className="text-blue-500" />,
        outlineClassName: 'border-blue-200 bg-blue-50 text-blue-600',
        toneClassName: 'bg-slate-100 text-slate-700',
      },
      {
        key: 'recent_changes' as RecommendationKey,
        label: 'Cambios recientes',
        description: 'Funcionalidades con actualización funcional reciente para revisar primero.',
        icon: <RefreshCw size={12} className="text-emerald-500" />,
        outlineClassName: 'border-emerald-200 bg-emerald-50 text-emerald-600',
        toneClassName: 'bg-sky-50 text-sky-700',
      },
    ],
    [],
  );

  const recommendationFilteredFunctionalities = React.useMemo(() => {
    if (!activeRecommendation) return filteredFunctionalities;
    return recommendationBuckets[activeRecommendation];
  }, [activeRecommendation, filteredFunctionalities, recommendationBuckets]);

  const visibleFunctionalities = React.useMemo(
    () =>
      recommendationFilteredFunctionalities.filter(record =>
        matchesTableFilters(record, tableFilters),
      ),
    [recommendationFilteredFunctionalities, tableFilters],
  );

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
        const hasQaClassification = Boolean(item.isCore || item.isRegression || item.isSmoke);
        const hasTestCases = (testCaseCountByFunctionality.get(item.id) || 0) > 0;
        const current = acc.get(key) || {
          module: key,
          total: 0,
          qaCovered: 0,
          tested: 0,
          classifiedAndTested: 0,
          withoutCoverage: 0,
        };
        current.total += 1;
        if (hasQaClassification) current.qaCovered += 1;
        if (hasTestCases) current.tested += 1;
        if (hasQaClassification && hasTestCases) current.classifiedAndTested += 1;
        if (!hasTestCases) current.withoutCoverage += 1;
        acc.set(key, current);
        return acc;
      }, new Map<
        string,
        {
          module: string;
          total: number;
          qaCovered: number;
          tested: number;
          classifiedAndTested: number;
          withoutCoverage: number;
        }
      >()),
    )
      .map(([, value]) => ({
        ...value,
        testedPercent: value.total > 0 ? Math.round((value.tested / value.total) * 100) : 0,
        classifiedAndTestedPercent:
          value.total > 0 ? Math.round((value.classifiedAndTested / value.total) * 100) : 0,
      }))
      .sort((left, right) => right.total - left.total);

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
  }, [testCaseCountByFunctionality, visibleFunctionalities]);

  const visibleModuleCoverage = React.useMemo(() => {
    if (moduleCoverageFilter.length === 0) {
      return analytics.moduleCoverage;
    }

    const selectedModules = new Set(moduleCoverageFilter);
    return analytics.moduleCoverage.filter(item => selectedModules.has(item.module));
  }, [analytics.moduleCoverage, moduleCoverageFilter]);

  const selectedFunctionalityCasesCount = React.useMemo(
    () =>
      selectedFunctionality ? testCaseCountByFunctionality.get(selectedFunctionality.id) || 0 : 0,
    [selectedFunctionality, testCaseCountByFunctionality],
  );

  const selectedFunctionalityAutomationSummary = React.useMemo(() => {
    if (!selectedFunctionality) {
      return null;
    }

    const functionalityCases = testCases.filter(
      testCase => testCase.functionalityId === selectedFunctionality.id,
    );
    const byStatus = {
      automated: 0,
      candidate: 0,
      obsolete: 0,
      manual: 0,
    };
    const toolCounts = new Map<string, number>();
    const resultCounts = new Map<string, number>();

    for (const testCase of functionalityCases) {
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

    const automatedCoverage =
      functionalityCases.length > 0
        ? Math.round((byStatus.automated / functionalityCases.length) * 100)
        : 0;
    const leadingTool =
      [...toolCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const leadingResult =
      [...resultCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
    const highlightedCases = functionalityCases
      .filter(testCase => {
        const status = deriveAutomationStatus(testCase);
        return status !== AutomationStatus.NOT_AUTOMATED || Boolean(testCase.lastAutomationStatus);
      })
      .slice(0, 3);

    return {
      total: functionalityCases.length,
      automatedCoverage,
      byStatus,
      leadingTool,
      leadingResult,
      highlightedCases,
    };
  }, [selectedFunctionality, testCases]);

  const selectedFunctionalityGuidance = React.useMemo(() => {
    if (!selectedFunctionality) {
      return {
        recommendations: [] as string[],
        reasons: [] as string[],
        actionable: false,
      };
    }

    const recommendations: string[] = [];
    const reasons: string[] = [];

    if (selectedFunctionality.priority === Priority.CRITICAL && !selectedFunctionality.isSmoke) {
      recommendations.push('Debe permanecer en Smoke');
      reasons.push('Funcionalidad crítica para validación rápida.');
    }

    if (isHighPriorityFunctionality(selectedFunctionality) && !selectedFunctionality.isRegression) {
      recommendations.push('Debe permanecer en Regresión');
      reasons.push('Alta prioridad con necesidad de cobertura transversal.');
    }

    if (
      selectedFunctionality.riskLevel === RiskLevel.HIGH &&
      selectedFunctionalityCasesCount === 0
    ) {
      recommendations.push('Necesita casos de prueba');
      reasons.push('Alto riesgo sin casos asociados.');
    }

    if (
      !selectedFunctionality.isCore &&
      !selectedFunctionality.isSmoke &&
      !selectedFunctionality.isRegression
    ) {
      recommendations.push('Requiere clasificación QA');
      reasons.push('Aún no tiene cobertura QA definida.');
    }

    if (isRecentlyChanged(selectedFunctionality)) {
      recommendations.push('Conviene revisar cambio reciente');
      reasons.push('Tuvo cambios funcionales recientes.');
    }

    if (selectedFunctionality.isCore) {
      reasons.push('Está marcada como funcionalidad core del negocio.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Tiene cobertura suficiente');
    }

    return {
      recommendations,
      reasons,
      actionable:
        (selectedFunctionality.priority === Priority.CRITICAL && !selectedFunctionality.isSmoke) ||
        (isHighPriorityFunctionality(selectedFunctionality) &&
          !selectedFunctionality.isRegression) ||
        isRecentlyChanged(selectedFunctionality),
    };
  }, [selectedFunctionality, selectedFunctionalityCasesCount]);

  const selectedFunctionalityRelations = React.useMemo(() => {
    if (!selectedFunctionality) {
      return {
        moduleCount: 0,
        sprintCount: 0,
      };
    }

    const siblings = functionalities.filter(item => item.id !== selectedFunctionality.id);

    return {
      moduleCount: siblings.filter(item => item.module === selectedFunctionality.module).length,
      sprintCount: selectedFunctionality.sprint
        ? siblings.filter(item => item.sprint === selectedFunctionality.sprint).length
        : 0,
    };
  }, [functionalities, selectedFunctionality]);

  const selectedFunctionalityCoverageItems = React.useMemo(
    () => (selectedFunctionality ? getCoverageSummary(selectedFunctionality) : []),
    [selectedFunctionality],
  );

  const selectedFunctionalityQaScore = React.useMemo(() => {
    if (!selectedFunctionality) {
      return { value: 0, label: 'Sin evaluar' };
    }

    const coveragePoints = selectedFunctionalityCoverageItems.length * 22;
    const casesPoints = selectedFunctionalityCasesCount > 0 ? 16 : 0;
    const corePoints = selectedFunctionality.isCore ? 12 : 0;
    const recentPenalty = isRecentlyChanged(selectedFunctionality) ? -6 : 4;
    const riskPoints =
      selectedFunctionality.riskLevel === RiskLevel.LOW
        ? 18
        : selectedFunctionality.riskLevel === RiskLevel.MEDIUM
          ? 10
          : 2;

    const value = Math.max(
      0,
      Math.min(100, coveragePoints + casesPoints + corePoints + recentPenalty + riskPoints),
    );

    const label =
      value >= 85
        ? 'Muy bueno'
        : value >= 70
          ? 'Bueno'
          : value >= 50
            ? 'Aceptable'
            : 'Por reforzar';

    return { value, label };
  }, [selectedFunctionality, selectedFunctionalityCasesCount, selectedFunctionalityCoverageItems]);

  const detailCalculatedRisk = React.useMemo(() => {
    if (!detailEditDraft) return RiskLevel.MEDIUM;

    return calculateRiskLevel(detailEditDraft.impactLevel, detailEditDraft.probabilityLevel);
  }, [detailEditDraft]);

  const selectedBulkFunctionalities = React.useMemo(
    () => functionalities.filter(item => selectedRowKeys.includes(item.documentId || item.id)),
    [functionalities, selectedRowKeys],
  );

  const selectedBulkCount = selectedRowKeys.length;

  const previousBulkCountRef = React.useRef(0);

  React.useEffect(() => {
    setSelectedRowKeys([]);
  }, [activeRecommendation]);

  React.useEffect(() => {
    const previousCount = previousBulkCountRef.current;

    if (selectedBulkCount > 0 && previousCount === 0) {
      setIsBulkDrawerOpen(true);
    }

    if (selectedBulkCount === 0) {
      setIsBulkDrawerOpen(false);
    }

    previousBulkCountRef.current = selectedBulkCount;
  }, [selectedBulkCount]);

  const priorityOptions = React.useMemo(
    () =>
      Object.values(Priority).map(priority => ({
        label: (
          <span className="inline-flex items-center gap-1.5">
            {getPriorityVisualLabel(priority).icon}
            <span>{getPriorityVisualLabel(priority).label}</span>
          </span>
        ),
        value: priority,
      })),
    [],
  );

  const impactOptions = React.useMemo(
    () =>
      Object.values(ImpactLevel).map(impact => ({
        label: labelImpact(impact),
        value: impact,
      })),
    [],
  );

  const probabilityOptions = React.useMemo(
    () =>
      Object.values(ProbabilityLevel).map(probability => ({
        label: labelProbability(probability),
        value: probability,
      })),
    [],
  );

  const hasCoverageChanges =
    bulkEditDraft.isCore !== undefined ||
    bulkEditDraft.isSmoke !== undefined ||
    bulkEditDraft.isRegression !== undefined;

  const bulkChangesCount =
    Number(bulkEditDraft.priority !== undefined) +
    Number(bulkEditDraft.status !== undefined) +
    Number(hasCoverageChanges);

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

  const applyBulkDraft = React.useCallback(async () => {
    if (
      bulkEditDraft.priority === undefined &&
      bulkEditDraft.status === undefined &&
      !hasCoverageChanges
    ) {
      message.info('Selecciona al menos un cambio antes de aplicar la edición masiva.');
      return;
    }

    const updates: Partial<Functionality> = {};

    if (bulkEditDraft.priority !== undefined) {
      updates.priority = bulkEditDraft.priority;
    }

    if (bulkEditDraft.status !== undefined) {
      updates.status = bulkEditDraft.status;
    }

    if (bulkEditDraft.isCore !== undefined) {
      updates.isCore = bulkEditDraft.isCore;
    }
    if (bulkEditDraft.isSmoke !== undefined) {
      updates.isSmoke = bulkEditDraft.isSmoke;
    }
    if (bulkEditDraft.isRegression !== undefined) {
      updates.isRegression = bulkEditDraft.isRegression;
    }

    await saveBulkUpdate(updates, 'Cambios masivos aplicados correctamente.');
  }, [bulkEditDraft, hasCoverageChanges, saveBulkUpdate]);

  const saveDetailChanges = React.useCallback(async () => {
    if (!selectedFunctionality || !detailEditDraft) return;

    const updates: Partial<Functionality> = {};

    if (detailEditDraft.priority !== selectedFunctionality.priority) {
      updates.priority = detailEditDraft.priority;
    }

    if (detailEditDraft.impactLevel !== selectedFunctionality.impactLevel) {
      updates.impactLevel = detailEditDraft.impactLevel;
    }

    if (detailEditDraft.probabilityLevel !== selectedFunctionality.probabilityLevel) {
      updates.probabilityLevel = detailEditDraft.probabilityLevel;
    }

    if (
      detailEditDraft.impactLevel !== selectedFunctionality.impactLevel ||
      detailEditDraft.probabilityLevel !== selectedFunctionality.probabilityLevel
    ) {
      updates.riskLevel = detailCalculatedRisk;
    }

    if (detailEditDraft.isCore !== Boolean(selectedFunctionality.isCore)) {
      updates.isCore = detailEditDraft.isCore;
    }

    if (detailEditDraft.isSmoke !== Boolean(selectedFunctionality.isSmoke)) {
      updates.isSmoke = detailEditDraft.isSmoke;
    }

    if (detailEditDraft.isRegression !== Boolean(selectedFunctionality.isRegression)) {
      updates.isRegression = detailEditDraft.isRegression;
    }

    if (detailEditDraft.status !== selectedFunctionality.status) {
      updates.status = detailEditDraft.status;
    }

    if ((detailEditDraft.sprint || '') !== (selectedFunctionality.sprint || '')) {
      updates.sprint = detailEditDraft.sprint || undefined;
    }

    if (detailEditDraft.markRecentChange) {
      updates.lastFunctionalChangeAt = new Date().toISOString().split('T')[0];
    }

    if (Object.keys(updates).length === 0) {
      message.info('No hay cambios por guardar en esta funcionalidad.');
      return;
    }

    await saveRowUpdate(selectedFunctionality, updates, 'Funcionalidad actualizada correctamente.');
  }, [detailCalculatedRisk, detailEditDraft, saveRowUpdate, selectedFunctionality]);

  const applyDetailRecommendation = React.useCallback(() => {
    if (!selectedFunctionality || !detailEditDraft) return;

    let changed = false;
    const nextDraft: DetailEditDraft = { ...detailEditDraft };

    if (selectedFunctionality.priority === Priority.CRITICAL && !nextDraft.isSmoke) {
      nextDraft.isSmoke = true;
      changed = true;
    }

    if (isHighPriorityFunctionality(selectedFunctionality) && !nextDraft.isRegression) {
      nextDraft.isRegression = true;
      changed = true;
    }

    if (isRecentlyChanged(selectedFunctionality) && !nextDraft.markRecentChange) {
      nextDraft.markRecentChange = true;
      changed = true;
    }

    if (!changed) {
      message.info('Esta funcionalidad ya refleja la recomendación actual.');
      return;
    }

    setDetailEditDraft(nextDraft);
    message.success('Recomendación aplicada al formulario. Recuerda guardar los cambios.');
  }, [detailEditDraft, selectedFunctionality]);

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
        align: 'center',
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
        align: 'center',
        width: 120,
        filters: moduleFilters,
        filteredValue: tableFilters.module,
        onFilter: (value: boolean | React.Key, record: Functionality) =>
          record.module === String(value),
        render: (value?: string) => value || 'N/A',
      },
      {
        title: (
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Funcionalidad
          </span>
        ),
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        width: 320,
        render: (value: string, record: Functionality) => {
          const recentChangeLabel = formatRecentChangeBadge(record.lastFunctionalChangeAt);

          return (
            <div className="flex min-w-0 max-w-[360px] flex-col gap-1">
              <Tooltip title={value}>
                <span className="block truncate text-sm font-medium leading-5 text-slate-700">
                  {value}
                </span>
              </Tooltip>
              {recentChangeLabel ? (
                <Tooltip title={`Último cambio funcional: ${record.lastFunctionalChangeAt}`}>
                  <span className="inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
                    <Clock3 size={11} strokeWidth={2} />
                    <span className="truncate">{recentChangeLabel}</span>
                  </span>
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
      {
        title: (
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Casos
          </span>
        ),
        key: 'cases',
        align: 'center',
        width: 60,
        render: (_: unknown, record: Functionality) => {
          const count = testCaseCountByFunctionality.get(record.id) || 0;

          return (
            <div className="flex min-w-[24px] flex-col items-center">
              <span
                className={`text-sm font-semibold ${
                  count > 0 ? 'text-slate-700' : 'text-amber-700'
                }`}
              >
                {count}
              </span>
            </div>
          );
        },
      },
      {
        title: (
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cobertura
          </span>
        ),
        key: 'coverage',
        align: 'center',
        width: 170,
        filters: coverageFilters,
        filteredValue: tableFilters.coverage,
        onFilter: (value: boolean | React.Key, record: Functionality) =>
          matchesCoverageFilter(record, String(value)),
        render: (_: unknown, record: Functionality) => {
          const coverageItems = getCoverageSummary(record);

          return (
            <div className="flex min-w-0 flex-wrap justify-center gap-1">
              {coverageItems.length > 0 ? (
                coverageItems.map(item => (
                  <Tooltip key={item.key} title={item.label} placement="top">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-900">
                      {getCoverageChipIcon(item.key)}
                      <span>{item.label}</span>
                    </span>
                  </Tooltip>
                ))
              ) : (
                <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[10px] font-semibold text-slate-500">
                  Sin cobertura
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: (
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Prioridad
          </span>
        ),
        dataIndex: 'priority',
        key: 'priority',
        align: 'center',
        width: 88,
        filters: Object.values(Priority).map(priority => ({
          text: getPriorityVisualLabel(priority).label,
          value: priority,
        })),
        filteredValue: tableFilters.priority,
        onFilter: (value: boolean | React.Key, record: Functionality) => record.priority === value,
        render: (priority: Priority, record: Functionality) => (
          <Tooltip
            title={getPriorityVisualLabel(priority).label}
            placement="top"
            overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
            overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
          >
            <div onClick={event => event.stopPropagation()}>
              <Dropdown
                trigger={isViewer || isRowSaving(record.documentId || record.id) ? [] : ['click']}
                placement="bottomLeft"
                menu={{
                  items: Object.values(Priority).map(value => ({
                    key: value,
                    label: (
                      <div className="inline-flex items-center gap-1.5 py-0.5">
                        <span className={PRIORITY_TEXT_CLASSNAMES[value]}>
                          {getPriorityVisualLabel(value).icon}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {getPriorityVisualLabel(value).label}
                        </span>
                      </div>
                    ),
                  })),
                  selectable: true,
                  selectedKeys: [priority],
                  onClick: ({ key }) => void saveRowUpdate(record, { priority: key as Priority }),
                }}
                overlayClassName="[&_.ant-dropdown-menu]:rounded-2xl [&_.ant-dropdown-menu]:p-1 [&_.ant-dropdown-menu-item]:rounded-xl [&_.ant-dropdown-menu-item]:px-3 [&_.ant-dropdown-menu-item]:py-2"
              >
                <button
                  type="button"
                  disabled={isViewer || isRowSaving(record.documentId || record.id)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${PRIORITY_TEXT_CLASSNAMES[priority]} ${
                    isViewer || isRowSaving(record.documentId || record.id)
                      ? 'cursor-not-allowed opacity-70'
                      : 'hover:bg-slate-100 hover:opacity-85'
                  }`}
                >
                  {getPriorityVisualLabel(priority).icon}
                </button>
              </Dropdown>
            </div>
          </Tooltip>
        ),
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Impacto
          </span>
        ),
        dataIndex: 'impactLevel',
        key: 'impactLevel',
        align: 'center',
        width: 110,
        render: (impact: ImpactLevel, record: Functionality) => (
          <Tooltip
            title={repairMojibakeText(getImpactLevelText(impact))}
            placement="topLeft"
            overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
            overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
          >
            <div onClick={event => event.stopPropagation()}>
              <InlineChipSelect
                value={impact}
                disabled={isViewer || isRowSaving(record.documentId || record.id)}
                options={impactOptions}
                chipClassName={IMPACT_BADGE_CLASSNAMES[impact]}
                onSelect={value => void saveRowUpdate(record, { impactLevel: value })}
                getDescription={value => repairMojibakeText(getImpactLevelText(value))}
              />
            </div>
          </Tooltip>
        ),
      },
      {
        title: (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Probabilidad
          </span>
        ),
        dataIndex: 'probabilityLevel',
        key: 'probabilityLevel',
        align: 'center',
        width: 122,
        render: (probability: ProbabilityLevel, record: Functionality) => (
          <Tooltip
            title={repairMojibakeText(getProbabilityImpactText(probability))}
            placement="topLeft"
            overlayStyle={INFO_TOOLTIP_OVERLAY_STYLE}
            overlayInnerStyle={INFO_TOOLTIP_INNER_STYLE}
          >
            <div onClick={event => event.stopPropagation()}>
              <InlineChipSelect
                value={probability}
                disabled={isViewer || isRowSaving(record.documentId || record.id)}
                options={probabilityOptions}
                chipClassName={PROBABILITY_BADGE_CLASSNAMES[probability]}
                onSelect={value => void saveRowUpdate(record, { probabilityLevel: value })}
                getDescription={value => repairMojibakeText(getProbabilityImpactText(value))}
              />
            </div>
          </Tooltip>
        ),
      },
      {
        title: (
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Riesgo
          </span>
        ),
        dataIndex: 'riskLevel',
        key: 'riskLevel',
        align: 'center',
        width: 88,
        filters: riskOptions.map(option => ({ text: option.label, value: option.value })),
        filteredValue: tableFilters.riskLevel,
        onFilter: (value: boolean | React.Key, record: Functionality) => record.riskLevel === value,
        render: (risk: RiskLevel) => (
          <Tooltip title={labelRisk(risk, t)} placement="top">
            <span
              className={`inline-flex h-3 w-3 rounded-full shadow-sm ring-1 ring-black/5 ${RISK_DOT_CLASSNAMES[risk]}`}
            />
          </Tooltip>
        ),
      },
      {
        title: (
          <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Estado
          </span>
        ),
        dataIndex: 'status',
        key: 'status',
        align: 'center',
        width: 120,
        filters: statusFilters,
        filteredValue: tableFilters.status,
        onFilter: (value: boolean | React.Key, record: Functionality) => record.status === value,
        render: (status: TestStatus) => {
          const config = STATUS_BADGE_CONFIG[status] || FALLBACK_STATUS_BADGE_CONFIG;
          const statusChipClassName =
            STATUS_CHIP_CLASSNAMES[status] || 'border-slate-200 bg-slate-50 text-slate-600';

          return (
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-none ${statusChipClassName}`}
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
      impactOptions,
      isRowSaving,
      isViewer,
      moduleFilters,
      priorityOptions,
      probabilityOptions,
      riskOptions,
      saveRowUpdate,
      statusFilters,
      t,
      tableFilters,
      testCaseCountByFunctionality,
    ],
  );

  const orderedColumns = React.useMemo<ColumnsType<Functionality>>(() => {
    return PLANNING_TABLE_COLUMN_ORDER.map(columnKey =>
      columns.find(column => String(column.key) === columnKey),
    )
      .filter((column): column is ColumnsType<Functionality>[number] => Boolean(column))
      .filter(column => visibleColumnKeys.includes(String(column.key) as PlanningColumnKey));
  }, [columns, visibleColumnKeys]);

  const tableColumns = React.useMemo<ColumnsType<Functionality>>(
    () => [
      ...orderedColumns,
      {
        title: '',
        key: 'actions',
        width: 32,
        align: 'center',
        render: (_: unknown, record: Functionality) => (
          <div
            className="flex items-center justify-center"
            onClick={event => event.stopPropagation()}
          >
            <Button
              size="small"
              aria-label={`Ver detalle de ${record.name}`}
              className="rounded-full border-slate-200 px-1.5 text-xs font-medium text-slate-700"
              onClick={() => setSelectedFunctionality(record)}
            >
              ...
            </Button>
          </div>
        ),
      },
    ],
    [orderedColumns],
  );

  const visibleColumnCount = visibleColumnKeys.length;

  const handleVisibleColumnToggle = React.useCallback((columnKey: PlanningColumnKey) => {
    setVisibleColumnKeys(previous => {
      if (previous.includes(columnKey)) {
        if (previous.length === 1) return previous;
        return previous.filter(key => key !== columnKey);
      }

      return PLANNING_TABLE_COLUMN_ORDER.filter(key => key === columnKey || previous.includes(key));
    });
  }, []);

  const restoreAllColumns = React.useCallback(() => {
    setVisibleColumnKeys([...DEFAULT_VISIBLE_COLUMN_KEYS]);
  }, []);

  const columnSettingsContent = React.useMemo(
    () => (
      <div className="w-[260px] space-y-3">
        <div className="border-b border-slate-100 pb-2">
          <div className="text-sm font-semibold text-slate-800">Columnas visibles</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Elige qué columnas quieres ver en la tabla. Esta preferencia se guarda automáticamente.
          </div>
        </div>
        <div className="grid gap-2">
          {PLANNING_TABLE_COLUMN_OPTIONS.map(option => {
            const checked = visibleColumnKeys.includes(option.key);
            const disableToggle = checked && visibleColumnCount === 1;

            return (
              <label
                key={option.key}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition ${
                  disableToggle ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50'
                }`}
              >
                <Checkbox
                  checked={checked}
                  disabled={disableToggle}
                  onChange={() => handleVisibleColumnToggle(option.key)}
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-xs text-slate-500">{visibleColumnCount} columnas activas</span>
          <Button type="link" size="small" className="px-0" onClick={restoreAllColumns}>
            Mostrar todas
          </Button>
        </div>
      </div>
    ),
    [handleVisibleColumnToggle, restoreAllColumns, visibleColumnCount, visibleColumnKeys],
  );

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

  const sidePanelContent =
    selectedBulkCount > 0 ? (
      <div className="space-y-5">
        <div
          data-testid="qa-bulk-drawer-header"
          className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Title level={5} className="!mb-1 !mt-0 text-slate-800">
                Edición masiva
              </Title>
              <Text type="secondary" className="text-sm">
                Estás editando {selectedBulkCount} funcionalidades.
              </Text>
            </div>
            <Button type="text" onClick={() => setSelectedRowKeys([])}>
              Cerrar
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Los cambios solo se aplicarán a los campos que modifiques aquí.
          </div>
        </div>

        <div
          data-testid="qa-bulk-selected-list"
          className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <Text strong>Funcionalidades seleccionadas</Text>
            <Text type="secondary" className="text-xs">
              {selectedBulkFunctionalities.length} en total
            </Text>
          </div>
          <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-3">
            {selectedBulkFunctionalities.map(item => (
              <div
                key={item.documentId || item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
              >
                <Checkbox
                  checked
                  className="mt-1"
                  onChange={event => {
                    if (!event.target.checked) {
                      setSelectedRowKeys(current =>
                        current.filter(key => key !== (item.documentId || item.id)),
                      );
                    }
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.id} · {item.module || 'Sin módulo'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          data-testid="qa-bulk-edit-fields"
          className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <Text strong className="block">
                Prioridad
              </Text>

              <Select
                value={bulkEditDraft.priority}
                allowClear
                placeholder="Sin cambio"
                options={priorityOptions}
                onChange={value =>
                  setBulkEditDraft(current => ({
                    ...current,
                    priority: value,
                  }))
                }
              />
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <Text strong>Cobertura</Text>
              <div className="space-y-3">
                {[
                  { key: 'isCore' as const, label: 'Core business' },
                  { key: 'isSmoke' as const, label: 'Smoke' },
                  { key: 'isRegression' as const, label: 'Regresión' },
                ].map(item => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      <div className="flex items-center gap-2">
                        {[
                          { label: 'Sin cambio', value: undefined as BulkCoverageValue },
                          { label: 'Marcar', value: true as BulkCoverageValue },
                          { label: 'Quitar', value: false as BulkCoverageValue },
                        ].map(option => (
                          <button
                            key={option.label}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${getBulkCoverageOptionClassName(
                              bulkEditDraft[item.key],
                              option.value,
                            )}`}
                            onClick={() =>
                              setBulkEditDraft(current => ({
                                ...current,
                                [item.key]: option.value,
                              }))
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Solo se aplican las marcas que cambies aquí. Lo demás permanece igual.
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div>
                <Text strong>Estado</Text>
              </div>

              <Select
                value={bulkEditDraft.status}
                allowClear
                placeholder="Sin cambio"
                options={FUNCTIONALITY_DEVELOPMENT_STATUSES.map(status => ({
                  label: labelTestStatus(status, t),
                  value: status,
                }))}
                onChange={value =>
                  setBulkEditDraft(current => ({
                    ...current,
                    status: value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div
          data-testid="qa-bulk-summary"
          className="rounded-[24px] border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
        >
          Se aplicarán {bulkChangesCount} cambios configurados.
        </div>

        <div
          data-testid="qa-bulk-actions"
          className="sticky bottom-0 z-10 rounded-[24px] border border-slate-100 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] backdrop-blur"
        >
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                setIsBulkDrawerOpen(false);
                setSelectedRowKeys([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="primary"
              className="flex-1"
              loading={isBulkSaving}
              disabled={bulkChangesCount === 0}
              onClick={() => void applyBulkDraft()}
            >
              Aplicar cambios
            </Button>
          </div>
        </div>
      </div>
    ) : selectedFunctionality ? (
      <div className="space-y-5">
        <div
          data-testid="qa-detail-header"
          className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <Title level={4} className="!mb-1 !mt-0 text-slate-800">
                  {selectedFunctionality.name}
                </Title>
                <Text type="secondary">
                  {selectedFunctionality.id} · {selectedFunctionality.module || 'Sin módulo'}
                </Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  (
                    STATUS_BADGE_CONFIG[selectedFunctionality.status] ||
                    FALLBACK_STATUS_BADGE_CONFIG
                  ).bg
                } ${(STATUS_BADGE_CONFIG[selectedFunctionality.status] || FALLBACK_STATUS_BADGE_CONFIG).text}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    (
                      STATUS_BADGE_CONFIG[selectedFunctionality.status] ||
                      FALLBACK_STATUS_BADGE_CONFIG
                    ).dot
                  }`}
                />
                {labelTestStatus(selectedFunctionality.status, t)}
              </span>
              <Button type="text" onClick={() => setSelectedFunctionality(null)}>
                Cerrar
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Casos
              </div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                {selectedFunctionalityCasesCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">registrados</div>
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Prioridad
              </div>
              <div
                className={`mt-1 inline-flex items-center gap-2 text-sm font-semibold ${PRIORITY_TEXT_CLASSNAMES[selectedFunctionality.priority]}`}
              >
                {getPriorityVisualLabel(selectedFunctionality.priority).icon}
                <span className="text-slate-800">
                  {labelPriority(selectedFunctionality.priority, t)}
                </span>
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Riesgo
              </div>
              <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <span
                  className={`h-3.5 w-3.5 rounded-full shadow-sm ${RISK_DOT_CLASSNAMES[selectedFunctionality.riskLevel]}`}
                />
                {labelRisk(selectedFunctionality.riskLevel, t)}
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Score QA
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-blue-100 text-lg font-bold text-blue-700">
                  {selectedFunctionalityQaScore.value}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {selectedFunctionalityQaScore.label}
                  </div>
                  <div className="text-xs text-slate-500">Basado en cobertura y casos</div>
                </div>
              </div>
            </div>
          </div>

          {selectedFunctionalityAutomationSummary ? (
            <div className="mt-4 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Automatización</div>
                  <div className="text-xs text-slate-500">
                    Resumen operativo de automatización para esta funcionalidad.
                  </div>
                </div>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {selectedFunctionalityAutomationSummary.automatedCoverage}% automatizada
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Automatizadas
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">
                    {selectedFunctionalityAutomationSummary.byStatus.automated}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Candidatas
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">
                    {selectedFunctionalityAutomationSummary.byStatus.candidate}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Herramienta líder
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {selectedFunctionalityAutomationSummary.leadingTool || 'Sin definir'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Último estado
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getAutomationResultBadgeClassName(
                        selectedFunctionalityAutomationSummary.leadingResult as
                          | AutomationResultStatus
                          | undefined,
                      )}`}
                    >
                      {selectedFunctionalityAutomationSummary.leadingResult || 'Sin datos'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getAutomationStatusBadgeClassName(
                    AutomationStatus.AUTOMATED,
                  )}`}
                >
                  Automatizadas: {selectedFunctionalityAutomationSummary.byStatus.automated}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getAutomationStatusBadgeClassName(
                    AutomationStatus.CANDIDATE,
                  )}`}
                >
                  Candidatas: {selectedFunctionalityAutomationSummary.byStatus.candidate}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getAutomationStatusBadgeClassName(
                    AutomationStatus.OBSOLETE,
                  )}`}
                >
                  Obsoletas: {selectedFunctionalityAutomationSummary.byStatus.obsolete}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getAutomationStatusBadgeClassName(
                    AutomationStatus.NOT_AUTOMATED,
                  )}`}
                >
                  Manuales: {selectedFunctionalityAutomationSummary.byStatus.manual}
                </span>
              </div>

              {selectedFunctionalityAutomationSummary.highlightedCases.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {selectedFunctionalityAutomationSummary.highlightedCases.map(testCase => (
                    <div key={testCase.id} className="rounded-2xl border border-slate-100 px-3 py-3">
                      <div className="text-sm font-medium text-slate-700">{testCase.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 font-semibold ${getAutomationStatusBadgeClassName(
                            deriveAutomationStatus(testCase),
                          )}`}
                        >
                          {deriveAutomationStatus(testCase)}
                        </span>
                        {testCase.automationTool ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-600">
                            {testCase.automationTool}
                          </span>
                        ) : null}
                        {testCase.lastAutomationStatus ? (
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 font-semibold ${getAutomationResultBadgeClassName(
                              testCase.lastAutomationStatus,
                            )}`}
                          >
                            {testCase.lastAutomationStatus}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {testCase.automationReference || 'Sin referencia registrada'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">
                  Aún no hay metadata de automatización destacada en los casos de esta funcionalidad.
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <div className="space-y-5">
            <div
              data-testid="qa-detail-coverage"
              className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"
            >
              <Text strong>Cobertura QA</Text>
              <div className="mt-3 flex flex-wrap gap-3">
                {getCoverageSummary(selectedFunctionality).length > 0 ? (
                  getCoverageSummary(selectedFunctionality).map(item => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-900"
                    >
                      {getCoverageChipIcon(item.key)}
                      {item.label}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-amber-700">Sin cobertura</span>
                )}
              </div>
            </div>

            <div
              data-testid="qa-detail-cases"
              className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"
            >
              <Text strong>Casos de prueba</Text>
              <div className="mt-2">
                {selectedFunctionalityCasesCount > 0 ? (
                  <Text type="secondary" className="block text-sm">
                    {selectedFunctionalityCasesCount} casos registrados para esta funcionalidad.
                  </Text>
                ) : (
                  <Text className="block text-sm text-amber-700">Sin casos asociados todavía.</Text>
                )}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button type="primary" onClick={() => openTestCaseModal(selectedFunctionality)}>
                  {selectedFunctionalityCasesCount > 0
                    ? `Ver casos (${selectedFunctionalityCasesCount})`
                    : 'Crear caso'}
                </Button>
              </div>
            </div>

            {detailEditDraft ? (
              <div
                data-testid="qa-detail-classification"
                className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="text-sm font-semibold text-slate-800">Clasificación QA</div>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex flex-col gap-3">
                        <Text strong className="block">
                          Prioridad
                        </Text>

                        <Select
                          value={detailEditDraft.priority}
                          disabled={
                            isViewer ||
                            isRowSaving(
                              selectedFunctionality.documentId || selectedFunctionality.id,
                            )
                          }
                          options={Object.values(Priority).map(priority => ({
                            label: (
                              <span className="inline-flex items-center gap-2">
                                <span className={PRIORITY_TEXT_CLASSNAMES[priority]}>
                                  {getPriorityVisualLabel(priority).icon}
                                </span>
                                <span>{labelPriority(priority, t)}</span>
                              </span>
                            ),
                            value: priority,
                          }))}
                          onChange={value =>
                            setDetailEditDraft(current =>
                              current ? { ...current, priority: value } : current,
                            )
                          }
                        />

                        <div className="text-xs text-slate-500">
                          {getPriorityImpactText(detailEditDraft.priority)}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`rounded-2xl border p-3 ${RISK_BADGE_CLASSNAMES[detailCalculatedRisk]}`}
                    >
                      <Text strong className="!text-current">
                        Riesgo calculado
                      </Text>
                      <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                        <span
                          className={`h-3.5 w-3.5 rounded-full ${RISK_DOT_CLASSNAMES[detailCalculatedRisk]}`}
                        />
                        {labelRisk(detailCalculatedRisk, t)}
                      </div>
                      <div className="mt-2 text-xs opacity-80">
                        {getRiskImpactText(detailCalculatedRisk)}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex flex-col gap-3">
                        <Text strong className="block">
                          Impacto
                        </Text>

                        <Select
                          value={detailEditDraft.impactLevel}
                          disabled={
                            isViewer ||
                            isRowSaving(
                              selectedFunctionality.documentId || selectedFunctionality.id,
                            )
                          }
                          options={impactOptions}
                          onChange={value =>
                            setDetailEditDraft(current =>
                              current ? { ...current, impactLevel: value } : current,
                            )
                          }
                        />

                        <div className="text-xs text-slate-500">
                          {getImpactLevelText(detailEditDraft.impactLevel)}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex flex-col gap-3">
                        <Text strong>Probabilidad</Text>

                        <Select
                          value={detailEditDraft.probabilityLevel}
                          disabled={
                            isViewer ||
                            isRowSaving(
                              selectedFunctionality.documentId || selectedFunctionality.id,
                            )
                          }
                          options={probabilityOptions}
                          onChange={value =>
                            setDetailEditDraft(current =>
                              current ? { ...current, probabilityLevel: value } : current,
                            )
                          }
                        />

                        <div className="text-xs text-slate-500">
                          {getProbabilityImpactText(detailEditDraft.probabilityLevel)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-3">
                    <Text strong>Cobertura (editar)</Text>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Checkbox
                        checked={detailEditDraft.isCore}
                        disabled={
                          isViewer ||
                          isRowSaving(selectedFunctionality.documentId || selectedFunctionality.id)
                        }
                        onChange={event =>
                          setDetailEditDraft(current =>
                            current ? { ...current, isCore: event.target.checked } : current,
                          )
                        }
                      >
                        Core business
                      </Checkbox>
                      <Checkbox
                        checked={detailEditDraft.isSmoke}
                        disabled={
                          isViewer ||
                          isRowSaving(selectedFunctionality.documentId || selectedFunctionality.id)
                        }
                        onChange={event =>
                          setDetailEditDraft(current =>
                            current ? { ...current, isSmoke: event.target.checked } : current,
                          )
                        }
                      >
                        Smoke
                      </Checkbox>
                      <Checkbox
                        checked={detailEditDraft.isRegression}
                        disabled={
                          isViewer ||
                          isRowSaving(selectedFunctionality.documentId || selectedFunctionality.id)
                        }
                        onChange={event =>
                          setDetailEditDraft(current =>
                            current ? { ...current, isRegression: event.target.checked } : current,
                          )
                        }
                      >
                        Regresión
                      </Checkbox>
                      <Checkbox
                        checked={detailEditDraft.markRecentChange}
                        disabled={
                          isViewer ||
                          isRowSaving(selectedFunctionality.documentId || selectedFunctionality.id)
                        }
                        onChange={event =>
                          setDetailEditDraft(current =>
                            current
                              ? { ...current, markRecentChange: event.target.checked }
                              : current,
                          )
                        }
                      >
                        Marcar cambio reciente
                      </Checkbox>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex items-center gap-4">
                        <Text strong className="whitespace-nowrap">
                          Estado
                        </Text>

                        <Select
                          className="min-w-[150px]"
                          value={detailEditDraft.status}
                          disabled={
                            isViewer ||
                            isRowSaving(
                              selectedFunctionality.documentId || selectedFunctionality.id,
                            )
                          }
                          options={FUNCTIONALITY_DEVELOPMENT_STATUSES.map(status => ({
                            label: labelTestStatus(status, t),
                            value: status,
                          }))}
                          onChange={value =>
                            setDetailEditDraft(current =>
                              current ? { ...current, status: value } : current,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,1))] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">Recomendación QA</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Sugerencias basadas en cobertura, riesgo y cambios recientes.
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedFunctionalityGuidance.recommendations.map(item => (
                  <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Button
                  onClick={applyDetailRecommendation}
                  disabled={
                    !detailEditDraft || isViewer || !selectedFunctionalityGuidance.actionable
                  }
                >
                  Aplicar recomendación
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-800">Motivo de clasificación</div>
              <div className="mt-3 space-y-2">
                {selectedFunctionalityGuidance.reasons.length > 0 ? (
                  selectedFunctionalityGuidance.reasons.map(reason => (
                    <div key={reason} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                      <span>{reason}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">
                    No hay observaciones adicionales para esta clasificación.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-800">Relaciones</div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">Mismo módulo</div>
                    <div className="text-xs text-slate-500">
                      {selectedFunctionality.module || 'Sin módulo'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span>{selectedFunctionalityRelations.moduleCount}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">Mismo sprint</div>
                    <div className="text-xs text-slate-500">
                      {selectedFunctionality.sprint || 'Sin sprint'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <span>{selectedFunctionalityRelations.sprintCount}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-800">Información adicional</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Sprint
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {selectedFunctionality.sprint || 'Sin sprint'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Último cambio
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {selectedFunctionality.lastFunctionalChangeAt || 'No marcado'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Roles
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {selectedFunctionality.roles.length > 0
                      ? selectedFunctionality.roles.join(', ')
                      : 'Sin roles'}
                  </div>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Jira
                  </div>
                  <div className="mt-1 min-w-0 text-sm font-medium text-slate-700">
                    {selectedFunctionality.jiraTaskUrl ? (
                      <a
                        href={selectedFunctionality.jiraTaskUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all text-blue-600 hover:text-blue-700"
                      >
                        {selectedFunctionality.jiraTaskUrl}
                      </a>
                    ) : (
                      <span className="break-words">
                        {selectedFunctionality.jiraIssueKey || 'Sin vínculo'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Unidad de entrega
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {selectedFunctionality.deliveryUnitName || 'N/A'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 px-3 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Fecha de entrega
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {selectedFunctionality.deliveryDate || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {detailEditDraft ? (
          <div
            data-testid="qa-detail-actions"
            className="sticky bottom-0 z-10 rounded-[24px] border border-slate-100 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.05)] backdrop-blur"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="hidden flex-1 sm:block" />
              <Button className="sm:min-w-[140px]" onClick={() => setSelectedFunctionality(null)}>
                Cancelar
              </Button>
              <Button
                type="primary"
                className="sm:min-w-[160px]"
                loading={isRowSaving(selectedFunctionality.documentId || selectedFunctionality.id)}
                disabled={isViewer}
                onClick={() => void saveDetailChanges()}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    ) : (
      <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
        <FileSearchOutlined className="text-3xl text-slate-300" />
        <div className="mt-3 text-base font-semibold text-slate-700">
          Selecciona una funcionalidad
        </div>
        <div className="mt-1 max-w-[240px] text-sm text-slate-500">
          Haz click en una fila para ver su resumen QA y acceder a los casos de prueba.
        </div>
      </div>
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
              icon={card.icon}
              label={card.label}
              toneClassName={card.toneClassName}
              outlineClassName={card.outlineClassName}
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
              ? `${visibleFunctionalities.length} funcionalidades filtradas por recomendación`
              : 'Sin recomendación aplicada'}
          </div>
          <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
            El filtro actúa sobre la tabla actual y mantiene la edición inline.
          </div>
        </div>
      </Card>

      {!isViewer && selectedRowKeys.length > 0 ? (
        <Card className="mb-3 mt-4 rounded-2xl border border-sky-300 shadow-sm shadow-sky-100/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-700 text-white shadow-sm">
                <Check size={14} strokeWidth={2.75} />
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {selectedRowKeys.length} funcionalidades seleccionadas
              </div>
              <Button
                type="link"
                className="px-0 text-sm font-medium text-sky-600"
                disabled={isBulkSaving}
                onClick={() => setSelectedRowKeys([])}
              >
                Limpiar selección
              </Button>
              {isBulkSaving ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                  Guardando cambios...
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                placeholder="Prioridad"
                value={undefined}
                disabled={isBulkSaving}
                popupMatchSelectWidth={false}
                className="min-w-[140px]"
                onChange={value =>
                  void saveBulkUpdate(
                    { priority: value },
                    `Prioridad ${labelPriority(value, t).toLowerCase()} aplicada a la selección.`,
                  )
                }
                options={Object.values(Priority).map(priority => ({
                  label: getPriorityVisualLabel(priority).label,
                  value: priority,
                }))}
              />

              <Dropdown
                trigger={isBulkSaving ? [] : ['click']}
                placement="bottomLeft"
                menu={{
                  items: [
                    {
                      key: 'core',
                      label: 'Marcar Core business',
                    },
                    {
                      key: 'smoke',
                      label: 'Marcar Smoke',
                    },
                    {
                      key: 'regression',
                      label: 'Marcar Regresión',
                    },
                    {
                      type: 'divider',
                    },
                    {
                      key: 'clear',
                      label: 'Limpiar cobertura',
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'core') {
                      void saveBulkUpdate(
                        { isCore: true },
                        'Core business aplicado a la selección.',
                      );
                    }

                    if (key === 'smoke') {
                      void saveBulkUpdate({ isSmoke: true }, 'Smoke aplicado a la selección.');
                    }

                    if (key === 'regression') {
                      void saveBulkUpdate(
                        { isRegression: true },
                        'Regresión aplicada a la selección.',
                      );
                    }

                    if (key === 'clear') {
                      void saveBulkUpdate(
                        { isCore: false, isRegression: false, isSmoke: false },
                        'Cobertura limpiada para la selección.',
                      );
                    }
                  },
                }}
                overlayClassName="[&_.ant-dropdown-menu]:rounded-2xl [&_.ant-dropdown-menu]:p-1 [&_.ant-dropdown-menu-item]:rounded-xl [&_.ant-dropdown-menu-item]:px-3 [&_.ant-dropdown-menu-item]:py-2"
              >
                <Button
                  className="inline-flex h-10 items-center gap-2 rounded-xl border-slate-200 px-4 text-sm font-medium text-slate-700"
                  disabled={isBulkSaving}
                >
                  Cobertura
                  <ChevronDown size={14} strokeWidth={2} />
                </Button>
              </Dropdown>

              <Select
                placeholder="Estado"
                value={undefined}
                disabled={isBulkSaving}
                popupMatchSelectWidth={false}
                className="min-w-[140px]"
                onChange={value =>
                  void saveBulkUpdate(
                    { status: value },
                    `Estado ${labelTestStatus(value, t).toLowerCase()} aplicado a la selección.`,
                  )
                }
                options={FUNCTIONALITY_DEVELOPMENT_STATUSES.map(status => ({
                  label: labelTestStatus(status, t),
                  value: status,
                }))}
              />

              <Button
                className="inline-flex h-10 items-center gap-2 rounded-xl border-slate-200 px-4 text-sm font-medium text-slate-700"
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
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6">
        <Card className="mx-auto max-w-[1520px] rounded-2xl border-slate-100 shadow-sm xl:max-w-none">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
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
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end xl:max-w-[760px]">
              <div className="flex w-full flex-col gap-3 sm:flex-1 sm:flex-row sm:items-center">
                <Select
                  allowClear
                  placeholder="Filtrar por módulo"
                  value={tableFilters.module?.[0] ? String(tableFilters.module[0]) : undefined}
                  options={moduleFilters.map(option => ({
                    label: String(option.text),
                    value: String(option.value),
                  }))}
                  onChange={value =>
                    setTableFilters(current => ({
                      ...current,
                      module: value ? [value] : null,
                    }))
                  }
                  className="w-full sm:w-[220px]"
                />
                <Input.Search
                  allowClear
                  placeholder="Buscar por funcionalidad"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  className="w-full sm:flex-1"
                />
              </div>
              <Popover
                trigger="click"
                placement="bottomRight"
                content={columnSettingsContent}
                overlayClassName="[&_.ant-popover-inner]:rounded-2xl [&_.ant-popover-inner]:p-4"
              >
                <Button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border-slate-200 px-3 text-slate-600 shadow-sm hover:!border-sky-300 hover:!text-sky-700 sm:w-auto">
                  <Settings2 size={16} />
                  Columnas
                </Button>
              </Popover>
            </div>
          </div>

          {activeRecommendation ? (
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-sm">
              <div className="font-semibold">Vista filtrada por recomendación QA</div>
              <div className="mt-1 text-sky-700">
                Estás viendo solo funcionalidades priorizadas por la alerta activa.
              </div>
            </div>
          ) : null}

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
                    columnWidth: 36,
                  }
            }
            columns={tableColumns}
            dataSource={visibleFunctionalities}
            rowKey={record => record.documentId || record.id}
            loading={isLoading || (isFetching && visibleFunctionalities.length === 0)}
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
            className="[&_.ant-table-container]:rounded-2xl [&_.ant-table]:text-slate-700 [&_.ant-table-thead>tr>th]:sticky [&_.ant-table-thead>tr>th]:top-0 [&_.ant-table-thead>tr>th]:z-10 [&_.ant-table-thead>tr>th]:bg-sky-50 [&_.ant-table-thead>tr>th]:px-2.5 [&_.ant-table-thead>tr>th]:py-3 [&_.ant-table-tbody>tr:hover>td]:bg-sky-50/40 [&_.ant-table-tbody>tr>td]:px-2.5 [&_.ant-table-tbody>tr>td]:py-1.5 [&_.ant-table-tbody>tr>td]:align-middle [&_.ant-table-tbody>tr>td]:border-b-slate-100"
          />
        </Card>
        {false ? (
          <Card className="hidden rounded-2xl border-slate-100 shadow-sm xl:sticky xl:top-6 xl:block">
            {sidePanelContent}
          </Card>
        ) : null}
        <Drawer
          title={selectedBulkCount > 0 ? 'Edición masiva QA' : 'Detalle QA'}
          placement="right"
          width={
            selectedBulkCount > 0
              ? screens.md
                ? 520
                : '100%'
              : screens.xl
                ? 980
                : screens.lg
                  ? 860
                  : '100%'
          }
          open={Boolean(selectedFunctionality) || (selectedBulkCount > 0 && isBulkDrawerOpen)}
          onClose={() => {
            if (selectedBulkCount > 0 && isBulkDrawerOpen) {
              setIsBulkDrawerOpen(false);
              return;
            }

            setSelectedFunctionality(null);
          }}
          destroyOnHidden={false}
          rootClassName="[&_.ant-drawer-content-wrapper]:max-w-full"
          styles={{ body: { padding: screens.lg ? 20 : 16 } }}
        >
          {sidePanelContent}
        </Drawer>
      </div>

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
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Cobertura por módulo</div>
                <div className="mt-1 text-sm text-slate-500">
                  Compara cobertura mínima con casos y cobertura QA clasificada por módulo.
                </div>
              </div>
              <Select
                mode="multiple"
                allowClear
                placeholder="Filtrar módulos"
                value={moduleCoverageFilter}
                onChange={values => setModuleCoverageFilter(values)}
                options={analytics.moduleCoverage.map(item => ({
                  label: item.module,
                  value: item.module,
                }))}
                className="w-full sm:w-[260px]"
                maxTagCount="responsive"
              />
            </div>
            <div className="max-h-[440px] space-y-4 overflow-y-auto pr-1">
              {visibleModuleCoverage.map(item => (
                <div
                  key={item.module}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-700">
                      {item.module}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {item.total} funcionalidades
                    </span>
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-slate-600">Cobertura con casos</span>
                    <span className="font-semibold text-slate-700">
                      {item.testedPercent}% ({item.tested}/{item.total})
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                      style={{ width: `${item.testedPercent}%` }}
                    />
                  </div>
                  <div className="mb-2 mt-3 flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-slate-600">
                      Cobertura QA clasificada
                    </span>
                    <span className="font-semibold text-slate-700">
                      {item.classifiedAndTestedPercent}% ({item.classifiedAndTested}/{item.total})
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                      style={{ width: `${item.classifiedAndTestedPercent}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>
                      Clasificadas QA: {item.qaCovered} de {item.total}
                    </span>
                    <span>Sin casos: {item.withoutCoverage}</span>
                  </div>
                </div>
              ))}
              {visibleModuleCoverage.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No hay módulos para el filtro seleccionado.
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
