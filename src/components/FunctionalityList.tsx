import {
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Row,
  Col,
  Divider,
  Typography,
  Upload,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { saveAs } from 'file-saver';
import { useDeliveryUnits } from '../modules/delivery-units/hooks/useDeliveryUnits';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import {
  buildNextFunctionalityCode,
  getNextFunctionalityCode,
} from '../modules/functionalities/services/functionalitiesService';
import { runTrackedExport } from '../modules/plans/services/planAccessService';
import { useModules } from '../modules/settings/hooks/useModules';
import { useRoles } from '../modules/settings/hooks/useRoles';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { toApiError } from '../config/http';
import {
  Functionality,
  FUNCTIONALITY_DEVELOPMENT_STATUSES,
  ImpactLevel,
  ProbabilityLevel,
  TestStatus,
  Priority,
  RiskLevel,
  TestType,
} from '../types';
import {
  labelImpact,
  labelPriority,
  labelProbability,
  labelRisk,
  labelTestStatus,
} from '../i18n/labels';
import { calculateRiskLevel } from '../modules/functionalities/utils/riskMatrix';
import type { FormInstance, InputRef } from 'antd';
import type { ColumnsType, FilterValue } from 'antd/es/table/interface';

const { Title, Text } = Typography;

type NativeTableFilterState = {
  module: React.Key[] | null;
  riskLevel: React.Key[] | null;
  priority: React.Key[] | null;
  status: React.Key[] | null;
  deliveryUnit: React.Key[] | null;
  qaCoverage: React.Key[] | null;
};

type SummaryMetricCardProps = {
  label: string;
  value: number;
  valueClassName: string;
  lgSpan?: number;
};

type FunctionalityTableTitleProps = {
  planningMode: boolean;
  selectedCount: number;
};

type FunctionalityTableToolbarProps = {
  functionalitySearch: string;
  hasActiveFilters: boolean;
  isViewer: boolean;
  planningMode: boolean;
  selectedCount: number;
  selectedPreset: QaPlanningPreset;
  onSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onOpenBulkEdit: () => void;
  onPresetChange: (value: QaPlanningPreset) => void;
  onTogglePlanningMode: () => void;
};

type FunctionalityColumnFilters = NonNullable<ColumnsType<Functionality>[number]['filters']>;

type FunctionalityColumnsConfig = {
  isViewer: boolean;
  tableFilters: NativeTableFilterState;
  nativeModuleFilters: FunctionalityColumnFilters;
  nativeStatusFilters: FunctionalityColumnFilters;
  onView: (record: Functionality) => void;
  onDelete: (id: string) => void;
};

type ImportedFunctionalityRow = Record<string, unknown>;

type SelectOption = {
  label: string;
  value: string;
};

type QaPlanningPreset =
  | 'all'
  | 'withoutCoverage'
  | 'smokeCandidates'
  | 'regressionCandidates'
  | 'highRisk'
  | 'highPriority';

type FunctionalityDeliveryUnitOption = {
  label: string;
  value: string;
};

type ImportedFunctionalityDraft = Functionality & {
  importReviewReasons: string[];
};

type PreparedFunctionalityImport = {
  functionalities: Functionality[];
  reviewRows: Array<{
    id: string;
    name: string;
    reasons: string[];
  }>;
  jiraRowsDetected: number;
};

type FunctionalityEditorFormProps = {
  form: FormInstance;
  moduleOptions: SelectOption[];
  roleOptions: SelectOption[];
  sprintOptions: SelectOption[];
  deliveryUnitOptions: FunctionalityDeliveryUnitOption[];
  priorityOptions: SelectOption[];
  impactOptions: SelectOption[];
  probabilityOptions: SelectOption[];
  statusOptions: SelectOption[];
  t: TFunction;
  onValuesChange: (changedValues: Record<string, unknown>) => void;
};

const INITIAL_NATIVE_TABLE_FILTERS: NativeTableFilterState = {
  module: null,
  riskLevel: null,
  priority: null,
  status: null,
  deliveryUnit: null,
  qaCoverage: null,
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

const FUNCTIONALITY_FORM_INITIAL_VALUES = {
  status: TestStatus.BACKLOG,
  priority: Priority.MEDIUM,
  impactLevel: ImpactLevel.MEDIUM,
  probabilityLevel: ProbabilityLevel.MEDIUM,
  isCore: false,
  isRegression: false,
  isSmoke: false,
};

function validateOptionalUrl(_: unknown, value?: string) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return Promise.resolve();

  try {
    const parsed = new URL(normalizedValue);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return Promise.reject(new Error('Ingresa una URL válida de Jira.'));
  }

  return Promise.resolve();
}

function valuesLooksLikeFunctionalityDuplicate(value?: string) {
  return String(value || '')
    .toLowerCase()
    .includes('already exists in this project');
}

function SummaryMetricCard({ label, value, valueClassName, lgSpan = 5 }: SummaryMetricCardProps) {
  return (
    <Col xs={24} sm={12} lg={lgSpan}>
      <Card className="rounded-2xl shadow-sm border-slate-100">
        <Text
          type="secondary"
          className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
        >
          {label}
        </Text>
        <div className={`text-3xl font-bold mt-1 ${valueClassName}`}>{value}</div>
      </Card>
    </Col>
  );
}

function FunctionalityEditorForm({
  form,
  moduleOptions,
  roleOptions,
  sprintOptions,
  deliveryUnitOptions,
  priorityOptions,
  impactOptions,
  probabilityOptions,
  statusOptions,
  t,
  onValuesChange,
}: FunctionalityEditorFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      className="mt-4"
      onValuesChange={onValuesChange}
      initialValues={FUNCTIONALITY_FORM_INITIAL_VALUES}
    >
      <Row gutter={20}>
        <Col span={10}>
          <Form.Item
            name="id"
            label={<span className="font-semibold text-slate-600">ID de Funcionalidad</span>}
            rules={[{ required: true }]}
          >
            <Input placeholder="Ej: AUTH-01" disabled className="h-10 rounded-lg" />
          </Form.Item>
        </Col>
        <Col span={14}>
          <Form.Item
            name="module"
            label={<span className="font-semibold text-slate-600">Módulo</span>}
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Selecciona un módulo"
              className="h-10 rounded-lg"
              options={moduleOptions}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="name"
        label={<span className="font-semibold text-slate-600">Nombre de la Funcionalidad</span>}
        rules={[{ required: true }]}
      >
        <Input placeholder="Ej: Inicio de sesión con Google" className="h-10 rounded-lg" />
      </Form.Item>

      <Form.Item
        name="jiraTaskUrl"
        label={<span className="font-semibold text-slate-600">Link de tarea Jira</span>}
        rules={[{ validator: validateOptionalUrl }]}
      >
        <Input
          placeholder="Opcional: https://tuempresa.atlassian.net/browse/PROJ-123"
          className="h-10 rounded-lg"
        />
      </Form.Item>

      <Form.Item
        name="roles"
        label={<span className="font-semibold text-slate-600">Roles Autorizados</span>}
      >
        <Select
          mode="multiple"
          placeholder="Selecciona roles"
          className="executive-select"
          options={roleOptions}
        />
      </Form.Item>

      <Form.Item
        label={<span className="font-semibold text-slate-600">Clasificación QA</span>}
        extra="Define si esta funcionalidad es crítica para el negocio y en qué ciclos de prueba debe aparecer: regresión, smoke o ambos."
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Space size={16} wrap>
          <Form.Item name="isCore" valuePropName="checked" noStyle>
            <Checkbox>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span>Es Core ⭐</span>
                <Tooltip
                  title={
                    <div className="space-y-2">
                      <p className="m-0">Funcionalidad crítica para el negocio.</p>
                      <p className="m-0">
                        Si falla, el proceso principal del sistema se ve afectado.
                      </p>
                      <p className="m-0">Ejemplos: Login, Crear paciente, Crear reporte.</p>
                    </div>
                  }
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <InfoCircleOutlined className="text-xs" />
                  </span>
                </Tooltip>
              </span>
            </Checkbox>
          </Form.Item>
          <Form.Item name="isRegression" valuePropName="checked" noStyle>
            <Checkbox>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span>Incluir en Regresión 🔄</span>
                <Tooltip
                  title={
                    <div className="space-y-2">
                      <p className="m-0">
                        Debe probarse cuando se realizan cambios para verificar que no se afectaron
                        funcionalidades existentes.
                      </p>
                      <p className="m-0">
                        Ejemplos: Filtros, Búsquedas, Exportaciones, Validaciones.
                      </p>
                    </div>
                  }
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <InfoCircleOutlined className="text-xs" />
                  </span>
                </Tooltip>
              </span>
            </Checkbox>
          </Form.Item>
          <Form.Item name="isSmoke" valuePropName="checked" noStyle>
            <Checkbox>
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span>Incluir en Smoke 🔥</span>
                <Tooltip
                  title={
                    <div className="space-y-2">
                      <p className="m-0">
                        Debe ejecutarse en cada despliegue para confirmar que la aplicación
                        funciona.
                      </p>
                      <p className="m-0">
                        Pregúntese: "Si esto falla, ¿el usuario puede seguir trabajando?"
                      </p>
                    </div>
                  }
                >
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-slate-600"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <InfoCircleOutlined className="text-xs" />
                  </span>
                </Tooltip>
              </span>
            </Checkbox>
          </Form.Item>
          </Space>
        </div>
      </Form.Item>

      <Row gutter={20}>
        <Col span={12}>
          <Form.Item
            name="priority"
            label={<span className="font-semibold text-slate-600">Prioridad</span>}
            rules={[{ required: true }]}
          >
            <Select className="h-10 rounded-lg" options={priorityOptions} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="impactLevel"
            label={<span className="font-semibold text-slate-600">Impacto</span>}
            rules={[{ required: true }]}
          >
            <Select className="h-10 rounded-lg" options={impactOptions} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={20}>
        <Col span={12}>
          <Form.Item
            name="probabilityLevel"
            label={<span className="font-semibold text-slate-600">Probabilidad</span>}
            rules={[{ required: true }]}
          >
            <Select className="h-10 rounded-lg" options={probabilityOptions} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label={<span className="font-semibold text-slate-600">Riesgo calculado</span>}>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600">
              {labelRisk(
                calculateRiskLevel(
                  form.getFieldValue('impactLevel') || ImpactLevel.MEDIUM,
                  form.getFieldValue('probabilityLevel') || ProbabilityLevel.MEDIUM,
                ),
                t,
              )}
            </div>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={20}>
        <Col span={12}>
          <Form.Item
            name="sprint"
            label={<span className="font-semibold text-slate-600">Sprint</span>}
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Selecciona un sprint"
              className="h-10 rounded-lg"
              options={sprintOptions}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="deliveryUnitId"
            label={<span className="font-semibold text-slate-600">Unidad de Entrega</span>}
          >
            <Select
              allowClear
              placeholder="Selecciona una unidad configurada"
              className="h-10 rounded-lg"
              options={deliveryUnitOptions}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={20}>
        <Col span={12}>
          <Form.Item
            name="status"
            label={<span className="font-semibold text-slate-600">Estado Actual</span>}
            rules={[{ required: true }]}
          >
            <Select className="h-10 rounded-lg" options={statusOptions} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="deliveryDate"
            label={<span className="font-semibold text-slate-600">Fecha de Entrega</span>}
            rules={[{ required: true }]}
          >
            <Input type="date" className="h-10 rounded-lg" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function FunctionalityTableTitle({ planningMode, selectedCount }: FunctionalityTableTitleProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-slate-800 font-bold">
            {planningMode ? 'Planificación QA' : 'Listado de Funcionalidades'}
          </span>
          {selectedCount > 0 && (
            <Tag
              color="blue"
              className="rounded-full px-3 m-0 border-none bg-blue-50 text-blue-600 font-bold"
            >
              {selectedCount} seleccionadas
            </Tag>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {planningMode
            ? 'Clasifica cobertura, riesgo y prioridad de forma masiva usando la tabla y sus filtros.'
            : 'Usa los filtros nativos en los encabezados de la tabla.'}
        </span>
      </div>
    </div>
  );
}

function FunctionalityTableToolbar({
  functionalitySearch,
  hasActiveFilters,
  isViewer,
  planningMode,
  selectedCount,
  selectedPreset,
  onSearchChange,
  onClearFilters,
  onOpenBulkEdit,
  onPresetChange,
  onTogglePlanningMode,
}: FunctionalityTableToolbarProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
      {planningMode ? (
        <Button
          type="primary"
          icon={<SafetyCertificateOutlined />}
          onClick={onTogglePlanningMode}
          className="rounded-lg h-9 px-4"
        >
          {planningMode ? 'Salir de planificación QA' : 'Planificación QA'}
        </Button>
      ) : null}
      {planningMode ? (
        <Select
          value={selectedPreset}
          onChange={value => onPresetChange(value)}
          className="w-[220px]"
          options={[
            { label: 'Todas', value: 'all' },
            { label: 'Sin cobertura', value: 'withoutCoverage' },
            { label: 'Candidatas a Smoke', value: 'smokeCandidates' },
            { label: 'Candidatas a Regresión', value: 'regressionCandidates' },
            { label: 'Alto riesgo', value: 'highRisk' },
            { label: 'Alta prioridad', value: 'highPriority' },
          ]}
        />
      ) : null}
      <Input.Search
        allowClear
        placeholder={
          planningMode ? 'Buscar por ID, funcionalidad o módulo' : 'Buscar por funcionalidad'
        }
        value={functionalitySearch}
        onChange={event => onSearchChange(event.target.value)}
        className="w-[260px]"
      />
      <Button
        onClick={onClearFilters}
        disabled={!hasActiveFilters && !functionalitySearch.trim()}
        className="rounded-lg h-9 px-4 text-slate-500"
      >
        Limpiar filtros
      </Button>
      {!isViewer && selectedCount > 0 && (
        <Button
          onClick={onOpenBulkEdit}
          className="rounded-lg h-9 px-4 border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-2"
        >
          <EditOutlined /> Edición Masiva
        </Button>
      )}
    </div>
  );
}

type QaPlanningFilterBarProps = {
  moduleOptions: SelectOption[];
  planningMode: boolean;
  qaPlanningPreset: QaPlanningPreset;
  riskOptions: SelectOption[];
  priorityOptions: SelectOption[];
  tableFilters: NativeTableFilterState;
  onPresetChange: (value: QaPlanningPreset) => void;
  onTableFilterChange: (key: keyof NativeTableFilterState, values: React.Key[] | null) => void;
};

type QaPlanningBulkActionsProps = {
  selectedCount: number;
  onMarkRecentChange: () => void;
  onMarkSmoke: () => void;
  onMarkRegression: () => void;
  onSetHighImpact: () => void;
  onSetHighPriority: () => void;
  onClearCoverage: () => void;
  onOpenBulkEdit: () => void;
};

function QaPlanningFilterBar({
  moduleOptions,
  planningMode,
  qaPlanningPreset,
  riskOptions,
  priorityOptions,
  tableFilters,
  onPresetChange,
  onTableFilterChange,
}: QaPlanningFilterBarProps) {
  if (!planningMode) return null;

  const presetButtons: Array<{ value: QaPlanningPreset; label: string }> = [
    { value: 'all', label: 'Todas' },
    { value: 'withoutCoverage', label: 'Sin cobertura' },
    { value: 'smokeCandidates', label: 'Candidatas Smoke' },
    { value: 'regressionCandidates', label: 'Candidatas Regresión' },
    { value: 'highRisk', label: 'Alto riesgo' },
    { value: 'highPriority', label: 'Alta prioridad' },
  ];

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {presetButtons.map(preset => (
            <Button
              key={preset.value}
              type={qaPlanningPreset === preset.value ? 'primary' : 'default'}
              className="rounded-full"
              onClick={() => onPresetChange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            allowClear
            placeholder="Filtrar por módulo"
            value={tableFilters.module?.[0] as string | undefined}
            onChange={value => onTableFilterChange('module', value ? [value] : null)}
            options={moduleOptions}
          />
          <Select
            allowClear
            placeholder="Filtrar por cobertura"
            value={tableFilters.qaCoverage?.[0] as string | undefined}
            onChange={value => onTableFilterChange('qaCoverage', value ? [value] : null)}
            options={[
              { label: 'Core', value: 'core' },
              { label: 'Sin cobertura', value: 'without-coverage' },
              { label: 'Regresión', value: 'regression' },
              { label: 'Smoke', value: 'smoke' },
              { label: 'Cambio reciente', value: 'recent-change' },
            ]}
          />
          <Select
            allowClear
            placeholder="Filtrar por riesgo"
            value={tableFilters.riskLevel?.[0] as string | undefined}
            onChange={value => onTableFilterChange('riskLevel', value ? [value] : null)}
            options={riskOptions}
          />
          <Select
            allowClear
            placeholder="Filtrar por prioridad"
            value={tableFilters.priority?.[0] as string | undefined}
            onChange={value => onTableFilterChange('priority', value ? [value] : null)}
            options={priorityOptions}
          />
        </div>
      </div>
    </Card>
  );
}

function QaPlanningBulkActions({
  selectedCount,
  onMarkRecentChange,
  onMarkSmoke,
  onMarkRegression,
  onSetHighImpact,
  onSetHighPriority,
  onClearCoverage,
  onOpenBulkEdit,
}: QaPlanningBulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50 shadow-sm">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Selecciona funcionalidades para aplicar acciones masivas rápidas."
        />
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-blue-100 bg-blue-50/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {selectedCount} funcionalidades seleccionadas
          </div>
          <div className="text-sm text-slate-500">
            Aplica clasificación inmediata sin abrir el modal completo.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-full" onClick={onMarkRecentChange}>
            Marcar cambio reciente
          </Button>
          <Button className="rounded-full" onClick={onMarkSmoke}>
            Marcar Smoke
          </Button>
          <Button className="rounded-full" onClick={onMarkRegression}>
            Marcar Regresión
          </Button>
          <Button className="rounded-full" danger onClick={onSetHighImpact}>
            Impacto Alto
          </Button>
          <Button className="rounded-full" type="primary" onClick={onSetHighPriority}>
            Prioridad Alta
          </Button>
          <Button className="rounded-full" onClick={onClearCoverage}>
            Limpiar cobertura
          </Button>
          <Button className="rounded-full" onClick={onOpenBulkEdit}>
            Más opciones
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FunctionalityDetailValue({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-700">{value || 'N/A'}</div>
    </div>
  );
}

function renderTruncatedText(
  value: string | undefined,
  className = 'block truncate text-slate-700',
) {
  const content = String(value || 'N/A');

  return (
    <Tooltip title={content}>
      <span className={className}>{content}</span>
    </Tooltip>
  );
}

function parseDateOnly(value?: string) {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatRecentChangeBadge(value?: string) {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;

  const today = new Date();
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffInDays = Math.round(
    (todayAtMidnight.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays <= 0) return 'Actualizado hoy';
  if (diffInDays === 1) return 'Actualizado hace 1 día';

  return `Actualizado hace ${diffInDays} días`;
}

function getFunctionalityMetrics(functionalities: Functionality[]) {
  return {
    total: functionalities.length,
    completed: functionalities.filter(f => f.status === TestStatus.COMPLETED).length,
    inProgress: functionalities.filter(f => f.status === TestStatus.IN_PROGRESS).length,
    backlog: functionalities.filter(f => f.status === TestStatus.BACKLOG).length,
    mvp: functionalities.filter(f => f.status === TestStatus.MVP).length,
  };
}

function getQaPlanningMetrics(functionalities: Functionality[]) {
  return {
    total: functionalities.length,
    withoutCoverage: functionalities.filter(f => !f.isSmoke && !f.isRegression).length,
    smoke: functionalities.filter(f => f.isSmoke).length,
    regression: functionalities.filter(f => f.isRegression).length,
    highRisk: functionalities.filter(f => f.riskLevel === RiskLevel.HIGH).length,
    highPriority: functionalities.filter(
      f => f.priority === Priority.CRITICAL || f.priority === Priority.HIGH,
    ).length,
  };
}

function matchesQaCoverageFilter(record: Functionality, value: string) {
  switch (value) {
    case 'core':
      return record.isCore;
    case 'without-coverage':
      return !record.isSmoke && !record.isRegression;
    case 'regression':
      return record.isRegression;
    case 'smoke':
      return record.isSmoke;
    case 'recent-change':
      return Boolean(record.lastFunctionalChangeAt);
    default:
      return false;
  }
}

function matchesQaPlanningPreset(record: Functionality, preset: QaPlanningPreset) {
  switch (preset) {
    case 'withoutCoverage':
      return !record.isSmoke && !record.isRegression;
    case 'smokeCandidates':
      return !record.isSmoke && (record.isCore || record.riskLevel === RiskLevel.HIGH);
    case 'regressionCandidates':
      return (
        !record.isRegression &&
        (record.isCore ||
          record.riskLevel === RiskLevel.HIGH ||
          record.priority === Priority.CRITICAL ||
          record.priority === Priority.HIGH)
      );
    case 'highRisk':
      return record.riskLevel === RiskLevel.HIGH;
    case 'highPriority':
      return record.priority === Priority.CRITICAL || record.priority === Priority.HIGH;
    case 'all':
    default:
      return true;
  }
}

function getFunctionalityAttentionLevel(record: Functionality) {
  const hasCoverage = record.isSmoke || record.isRegression;
  const isHighRisk = record.riskLevel === RiskLevel.HIGH;
  const isHighPriority = record.priority === Priority.CRITICAL || record.priority === Priority.HIGH;

  if (!hasCoverage && isHighRisk && isHighPriority) return 'critical-gap';
  if (!hasCoverage && (isHighRisk || isHighPriority)) return 'coverage-gap';
  if (isHighRisk || isHighPriority) return 'watch';
  return 'default';
}

function getFunctionalityRowClassName(record: Functionality) {
  const attention = getFunctionalityAttentionLevel(record);

  if (attention === 'critical-gap') {
    return 'bg-red-50/60';
  }

  if (attention === 'coverage-gap') {
    return 'bg-amber-50/60';
  }

  return '';
}

function getCoverageTags(record: Functionality) {
  const isHighPriority = record.priority === Priority.CRITICAL || record.priority === Priority.HIGH;
  const needsCoverageAttention =
    !record.isSmoke &&
    !record.isRegression &&
    (record.riskLevel === RiskLevel.HIGH || isHighPriority);

  return [
    record.isCore ? { key: 'core', className: 'bg-slate-900 text-white', label: 'Core' } : null,
    record.isRegression
      ? {
          key: 'regression',
          className: 'bg-purple-50 text-purple-700',
          label: 'Regresión',
        }
      : null,
    record.isSmoke
      ? { key: 'smoke', className: 'bg-orange-50 text-orange-700', label: 'Smoke' }
      : null,
    record.lastFunctionalChangeAt
      ? {
          key: 'recent-change',
          className: 'bg-sky-50 text-sky-700',
          label: 'Cambio reciente',
        }
      : null,
    needsCoverageAttention
      ? {
          key: 'coverage-gap',
          className: 'bg-red-50 text-red-700',
          label: 'Sin cobertura crítica',
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; className: string; label: string }>;
}

function getImportedFieldValue(item: ImportedFunctionalityRow, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function normalizeImportedStatus(value: unknown): TestStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'completado' || normalized === 'completed') return TestStatus.COMPLETED;
  if (normalized === 'fallido' || normalized === 'failed') return TestStatus.IN_PROGRESS;
  if (
    normalized === 'en progreso' ||
    normalized === 'in progress' ||
    normalized === 'in_progress'
  ) {
    return TestStatus.IN_PROGRESS;
  }
  if (normalized === 'mvp') return TestStatus.MVP;
  if (normalized === 'post mvp' || normalized === 'post-mvp' || normalized === 'post_mvp') {
    return TestStatus.POST_MVP;
  }

  return TestStatus.BACKLOG;
}

function normalizeImportedPriority(value: unknown): Priority {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'critical' || normalized === 'critico' || normalized === 'crítico') {
    return Priority.CRITICAL;
  }
  if (normalized === 'high' || normalized === 'alto') return Priority.HIGH;
  if (normalized === 'low' || normalized === 'bajo') return Priority.LOW;

  return Priority.MEDIUM;
}

function normalizeImportedImpactLevel(value: unknown): ImpactLevel {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'high' || normalized === 'alto') {
    return ImpactLevel.HIGH;
  }
  if (normalized === 'low' || normalized === 'bajo') {
    return ImpactLevel.LOW;
  }

  return ImpactLevel.MEDIUM;
}

function normalizeImportedProbabilityLevel(value: unknown): ProbabilityLevel {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  if (normalized === 'high' || normalized === 'alta' || normalized === 'probabilidad alta') {
    return ProbabilityLevel.HIGH;
  }
  if (normalized === 'low' || normalized === 'baja' || normalized === 'probabilidad baja') {
    return ProbabilityLevel.LOW;
  }

  return ProbabilityLevel.MEDIUM;
}

function parseBooleanLike(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();

  return (
    normalized === 'true' || normalized === 'sí' || normalized === 'si' || normalized === 'yes'
  );
}

function normalizeComparableText(value: string | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function resolveImportedSprint(
  value: unknown,
  availableSprints: string[],
): {
  sprint?: string;
  reviewReason?: string;
} {
  const candidate = String(value ?? '').trim();
  if (!candidate) {
    return {};
  }

  const normalizedCandidate = normalizeComparableText(candidate);
  const matchedSprint = availableSprints.find(
    sprintName => normalizeComparableText(sprintName) === normalizedCandidate,
  );

  if (matchedSprint) {
    return { sprint: matchedSprint };
  }

  return {
    reviewReason: `Sprint "${candidate}" no existe en la configuración del proyecto.`,
  };
}

function isJiraImportedRow(item: ImportedFunctionalityRow) {
  return Boolean(
    getImportedFieldValue(item, [
      'Clave de incidencia',
      'Issue key',
      'Issue Key',
      'Resumen',
      'Summary',
      'Tipo de Incidencia',
      'Issue Type',
    ]),
  );
}

function resolveImportedJiraTaskUrl(item: ImportedFunctionalityRow) {
  return String(
    getImportedFieldValue(item, [
      'jiraTaskUrl',
      'Jira',
      'Jira URL',
      'Link de tarea Jira',
      'Issue URL',
      'Issue Url',
      'URL',
      'Url',
    ]) ?? '',
  ).trim();
}

function mapImportedRowsToFunctionalities(
  importedData: ImportedFunctionalityRow[],
  projectId: string | undefined,
  availableSprints: string[],
): PreparedFunctionalityImport {
  const drafts = importedData.map((item, index) => {
    const rawRoles = getImportedFieldValue(item, ['roles', 'Roles', 'Roles Autorizados']);
    const roles = Array.isArray(rawRoles)
      ? rawRoles
      : String(rawRoles ?? '')
          .split(',')
          .map((role: string) => role.trim())
          .filter(Boolean);
    const isJiraRow = isJiraImportedRow(item);
    const importedSprint = resolveImportedSprint(
      getImportedFieldValue(item, ['sprint', 'Sprint']),
      availableSprints,
    );
    const reviewReasons = importedSprint.reviewReason ? [importedSprint.reviewReason] : [];
    const jiraIssueKey = String(
      getImportedFieldValue(item, ['Clave de incidencia', 'Issue key', 'Issue Key']) ?? '',
    ).trim();

    return {
      id:
        String(
          getImportedFieldValue(item, [
            'id',
            'ID',
            'Code',
            'Código',
            'Clave de incidencia',
            'Issue key',
            'Issue Key',
          ]) ?? '',
        ).trim() || `IMP-${Date.now()}-${index}`,
      projectId: projectId || '',
      module:
        String(
          getImportedFieldValue(item, ['module', 'Module', 'Módulo', 'Modulo']) ?? '',
        ).trim() || (isJiraRow ? 'Importado desde Jira' : 'Importado'),
      name:
        String(
          getImportedFieldValue(item, [
            'name',
            'Name',
            'Funcionalidad',
            'Nombre de la Funcionalidad',
            'Resumen',
            'Summary',
          ]) ?? '',
        ).trim() || 'Sin nombre',
      jiraIssueKey,
      jiraTaskUrl: resolveImportedJiraTaskUrl(item),
      jiraIssueType: String(
        getImportedFieldValue(item, ['Tipo de Incidencia', 'Issue Type']) ?? '',
      ).trim(),
      roles: roles.length > 0 ? roles : ['Todos'],
      testTypes: [TestType.FUNCTIONAL],
      isCore: parseBooleanLike(item.isCore ?? item['Core'] ?? item['Es Core']),
      isRegression: parseBooleanLike(item.isRegression ?? item['Regresión'] ?? item['Regresion']),
      isSmoke: parseBooleanLike(item.isSmoke ?? item['Smoke']),
      lastFunctionalChangeAt: String(
        item.lastFunctionalChangeAt ?? item['Último Cambio Funcional'] ?? '',
      ),
      deliveryDate:
        String(
          getImportedFieldValue(item, ['deliveryDate', 'Fecha Entrega', 'Fecha de Entrega']) ?? '',
        ).trim() || new Date().toISOString().split('T')[0],
      status: normalizeImportedStatus(getImportedFieldValue(item, ['status', 'Estado'])),
      priority: normalizeImportedPriority(getImportedFieldValue(item, ['priority', 'Prioridad'])),
      impactLevel: normalizeImportedImpactLevel(
        getImportedFieldValue(item, ['impactLevel', 'Impacto']),
      ),
      probabilityLevel: normalizeImportedProbabilityLevel(
        getImportedFieldValue(item, ['probabilityLevel', 'Probabilidad']),
      ),
      riskLevel: calculateRiskLevel(
        normalizeImportedImpactLevel(getImportedFieldValue(item, ['impactLevel', 'Impacto'])),
        normalizeImportedProbabilityLevel(
          getImportedFieldValue(item, ['probabilityLevel', 'Probabilidad']),
        ),
      ),
      sprint: importedSprint.sprint,
      importReviewReasons: reviewReasons,
    } satisfies ImportedFunctionalityDraft;
  });

  return {
    functionalities: drafts.map(({ importReviewReasons, ...functionality }) => functionality),
    reviewRows: drafts
      .filter(item => item.importReviewReasons.length > 0)
      .map(item => ({
        id: item.id,
        name: item.name,
        reasons: item.importReviewReasons,
      })),
    jiraRowsDetected: drafts.filter(item => Boolean(item.jiraIssueKey)).length,
  };
}

function resolveImportedFunctionalityIds(
  functionalities: Functionality[],
  reservedFunctionalities: Array<Pick<Functionality, 'id' | 'module'>>,
) {
  const usedIds = new Set(reservedFunctionalities.map(item => item.id));

  return functionalities.map(item => {
    const hasGeneratedImportId = /^IMP-\d+-\d+$/.test(item.id);
    const requestedId = item.id.trim();
    const needsGeneratedId = hasGeneratedImportId || !requestedId || usedIds.has(requestedId);
    const resolvedId = needsGeneratedId
      ? buildNextFunctionalityCode(item.module, reservedFunctionalities)
      : requestedId;

    usedIds.add(resolvedId);
    reservedFunctionalities.push({ id: resolvedId, module: item.module });

    return {
      ...item,
      id: resolvedId,
    };
  });
}

function buildFunctionalityExportData(functionalities: Functionality[]) {
  return functionalities.map(item => ({
    ID: item.id || '',
    Módulo: item.module || '',
    Funcionalidad: item.name || '',
    'Jira Key': item.jiraIssueKey || '',
    Jira: item.jiraTaskUrl || '',
    'Jira Tipo': item.jiraIssueType || '',
    Roles: Array.isArray(item.roles) ? item.roles.join(', ') : '',
    Core: item.isCore ? 'Sí' : 'No',
    Regresión: item.isRegression ? 'Sí' : 'No',
    Smoke: item.isSmoke ? 'Sí' : 'No',
    'Último Cambio Funcional': item.lastFunctionalChangeAt || '',
    'Fecha Entrega': item.deliveryDate || '',
    Sprint: item.sprint || '',
    Prioridad: item.priority || '',
    Impacto: item.impactLevel || '',
    Probabilidad: item.probabilityLevel || '',
    'Nivel de Riesgo': item.riskLevel || '',
    Estado: item.status || '',
  }));
}

function createFunctionalityColumns({
  isViewer,
  tableFilters,
  nativeModuleFilters,
  nativeStatusFilters,
  onView,
  onDelete,
}: FunctionalityColumnsConfig): ColumnsType<Functionality> {
  return [
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          Módulo
        </span>
      ),
      dataIndex: 'module',
      key: 'module',
      width: 150,
      ellipsis: true,
      filters: nativeModuleFilters,
      filterSearch: true,
      filteredValue: tableFilters.module,
      onFilter: (value: boolean | React.Key, record: Functionality) =>
        record.module === String(value),
      render: (module: string) => renderTruncatedText(module, 'block truncate text-slate-600'),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          Funcionalidad
        </span>
      ),
      dataIndex: 'name',
      key: 'name',
      width: 420,
      ellipsis: true,
      render: (name: string, record: Functionality) => {
        const recentChangeLabel = formatRecentChangeBadge(record.lastFunctionalChangeAt);

        return (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <Tooltip title={name}>
                <span className="block truncate text-[13px] font-medium text-slate-700">
                  {name}
                </span>
              </Tooltip>
            </div>
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
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase whitespace-nowrap">
          ESTADO DESARR.
        </span>
      ),
      dataIndex: 'status',
      key: 'status',
      width: 160,
      filters: nativeStatusFilters,
      filteredValue: tableFilters.status,
      onFilter: (value: boolean | React.Key, record: Functionality) => record.status === value,
      render: (status: TestStatus) => {
        const config = STATUS_BADGE_CONFIG[status] || FALLBACK_STATUS_BADGE_CONFIG;

        return (
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${config.bg} ${config.text} text-[11px] font-bold`}
          >
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {status}
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
      width: isViewer ? 112 : 104,
      render: (_: unknown, record: Functionality) => (
        <Space size={6} wrap>
          <Tooltip title="Ver detalle">
            <Button
              icon={<EyeOutlined />}
              onClick={() => onView(record)}
              size="small"
              className="rounded-full text-slate-700 border-slate-200 hover:bg-slate-50"
            />
          </Tooltip>
          {!isViewer ? (
            <>
              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={() => onDelete(record.id)}
                size="small"
                className="rounded-full"
              />
            </>
          ) : null}
        </Space>
      ),
    },
  ];
}

export default function FunctionalityList({
  filter,
  initialPlanningMode = false,
  projectId,
}: {
  filter?: 'regression' | 'smoke';
  initialPlanningMode?: boolean;
  projectId?: string;
}) {
  const { t } = useTranslation();
  const {
    data: functionalitiesData,
    save,
    delete: deleteFunc,
    bulkUpdate,
    bulkAdd,
  } = useFunctionalities(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: rolesData = [] } = useRoles(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const { data: deliveryUnitsData = [] } = useDeliveryUnits(projectId);
  const { isViewer } = useWorkspaceAccess();

  const allFunctionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];

  const [tableFilters, setTableFilters] = useState<NativeTableFilterState>(
    INITIAL_NATIVE_TABLE_FILTERS,
  );
  const [functionalitySearch, setFunctionalitySearch] = useState('');
  const [isQaPlanningMode, setIsQaPlanningMode] = useState(initialPlanningMode);
  const [qaPlanningPreset, setQaPlanningPreset] = useState<QaPlanningPreset>('all');

  React.useEffect(() => {
    setIsQaPlanningMode(initialPlanningMode);
  }, [initialPlanningMode]);

  const functionalities = allFunctionalities.filter(f => {
    if (!f) return false;

    return !filter || (filter === 'regression' ? f.isRegression : f.isSmoke);
  });

  const nativeModuleFilters = React.useMemo(
    () =>
      Array.from(new Set(allFunctionalities.map(item => item?.module).filter(Boolean)))
        .sort((left, right) => String(left).localeCompare(String(right)))
        .map(module => ({
          text: String(module),
          value: String(module),
        })),
    [allFunctionalities],
  );

  const nativeStatusFilters = React.useMemo(
    () =>
      FUNCTIONALITY_DEVELOPMENT_STATUSES.map(status => ({
        text: labelTestStatus(status, t),
        value: status,
      })),
    [t],
  );

  const nativeQaCoverageFilters = React.useMemo(
    () => [
      { text: 'Core', value: 'core' },
      { text: 'Sin cobertura', value: 'without-coverage' },
      { text: 'Regresión', value: 'regression' },
      { text: 'Smoke', value: 'smoke' },
      { text: 'Cambio reciente', value: 'recent-change' },
    ],
    [],
  );

  const hasActiveNativeTableFilters = React.useMemo(
    () => Object.values(tableFilters).some(value => Array.isArray(value) && value.length > 0),
    [tableFilters],
  );

  const filteredFunctionalities = React.useMemo(() => {
    const normalizedSearch = functionalitySearch.trim().toLowerCase();
    const sortByModule = (items: Functionality[]) =>
      [...items].sort((left, right) => {
        const moduleCompare = String(left?.module || '').localeCompare(String(right?.module || ''));

        if (moduleCompare !== 0) {
          return moduleCompare;
        }

        return String(left?.id || '').localeCompare(String(right?.id || ''));
      });

    if (!normalizedSearch) {
      const scopedItems = isQaPlanningMode
        ? functionalities.filter(item => matchesQaPlanningPreset(item, qaPlanningPreset))
        : functionalities;

      return sortByModule(scopedItems);
    }

    return sortByModule(
      functionalities.filter(item => {
        const matchesSearch =
          String(item?.name || '')
            .toLowerCase()
            .includes(normalizedSearch) ||
          String(item?.id || '')
            .toLowerCase()
            .includes(normalizedSearch) ||
          String(item?.module || '')
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesPreset = isQaPlanningMode
          ? matchesQaPlanningPreset(item, qaPlanningPreset)
          : true;

        return matchesSearch && matchesPreset;
      }),
    );
  }, [functionalities, functionalitySearch, isQaPlanningMode, qaPlanningPreset]);

  const clearNativeTableFilters = () => {
    setTableFilters(INITIAL_NATIVE_TABLE_FILTERS);
    setFunctionalitySearch('');
    setQaPlanningPreset('all');
  };

  const setSingleTableFilter = (key: keyof NativeTableFilterState, values: React.Key[] | null) => {
    setTableFilters(current => ({
      ...current,
      [key]: values,
    }));
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [detailFunctionality, setDetailFunctionality] = useState<Functionality | null>(null);
  const [editingFunc, setEditingFunc] = useState<Functionality | null>(null);
  const [nextFunctionalityIdPreview, setNextFunctionalityIdPreview] = useState('');
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const selectedModule = Form.useWatch('module', form);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const moduleOptions = React.useMemo(
    () => modulesData.map(item => ({ label: item.name, value: item.name })),
    [modulesData],
  );
  const roleOptions = React.useMemo(
    () => rolesData.map(item => ({ label: item.name, value: item.name })),
    [rolesData],
  );
  const sprintOptions = React.useMemo(
    () => sprintsData.map(item => ({ label: item.name, value: item.name })),
    [sprintsData],
  );
  const deliveryUnitOptions = React.useMemo(
    () =>
      deliveryUnitsData.map(item => ({
        label: item.periodLabel ? `${item.name} - ${item.periodLabel}` : item.name,
        value: item.documentId || item.id,
      })),
    [deliveryUnitsData],
  );
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
  const statusOptions = React.useMemo(
    () =>
      FUNCTIONALITY_DEVELOPMENT_STATUSES.map(status => ({
        label: labelTestStatus(status, t),
        value: status,
      })),
    [t],
  );
  const configuredSprintNames = React.useMemo(
    () => sprintsData.map(item => item.name).filter(Boolean),
    [sprintsData],
  );

  // Dynamic Roles State
  const [items, setItems] = useState([
    'Administrador',
    'Usuario',
    'Todos',
    'Manejador de Seguimiento',
    'Coordinador de Citas',
  ]);
  const [name, setName] = useState('');
  const inputRef = useRef<InputRef>(null);

  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const addItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    if (name && !items.includes(name)) {
      setItems([...items, name]);
      // Auto-select the new item
      const currentRoles = form.getFieldValue('roles') || [];
      form.setFieldsValue({ roles: [...currentRoles, name] });
      setName('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  React.useEffect(() => {
    if (!isModalOpen || editingFunc || !projectId || !selectedModule) {
      if (!editingFunc) {
        setNextFunctionalityIdPreview('');
      }
      return;
    }

    void syncNextFunctionalityId(selectedModule);
  }, [allFunctionalities, editingFunc, form, isModalOpen, projectId, selectedModule]);

  const syncNextFunctionalityId = async (moduleName: string) => {
    if (!moduleName) {
      setNextFunctionalityIdPreview('');
      form.setFieldsValue({ id: '' });
      return '';
    }

    const fallbackId = buildNextFunctionalityCode(moduleName, allFunctionalities);

    if (!projectId) {
      setNextFunctionalityIdPreview(fallbackId);
      form.setFieldsValue({ id: fallbackId });
      return fallbackId;
    }

    try {
      const nextId = await getNextFunctionalityCode(projectId, moduleName);
      setNextFunctionalityIdPreview(nextId || fallbackId);
      form.setFieldsValue({ id: nextId || fallbackId });
      return nextId || fallbackId;
    } catch (error) {
      console.error('Next functionality code sync failed:', error);
      setNextFunctionalityIdPreview(fallbackId);
      form.setFieldsValue({ id: fallbackId });
      return fallbackId;
    }
  };

  const handleEdit = (func: Functionality) => {
    setEditingFunc(func);
    setNextFunctionalityIdPreview(func.id);
    form.setFieldsValue(func);
    setIsModalOpen(true);
  };

  const handleView = (func: Functionality) => {
    setDetailFunctionality(func);
    setIsDetailModalOpen(true);
  };

  const handleEditFromDetail = () => {
    if (!detailFunctionality) return;

    setIsDetailModalOpen(false);
    handleEdit(detailFunctionality);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '¿Está seguro de eliminar esta funcionalidad?',
      onOk: () => deleteFunc(id),
      okButtonProps: { danger: true },
      centered: true,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const finalId = editingFunc?.id
        ? editingFunc.id
        : values.module
          ? await syncNextFunctionalityId(values.module)
          : values.id || nextFunctionalityIdPreview;

      const payload = {
        ...editingFunc,
        ...values,
        id: finalId,
        riskLevel: calculateRiskLevel(values.impactLevel, values.probabilityLevel),
        jiraTaskUrl: values.jiraTaskUrl?.trim() || '',
        roles: values.roles ?? editingFunc?.roles ?? [],
        testTypes: values.testTypes || editingFunc?.testTypes || [TestType.FUNCTIONAL],
        isCore: Boolean(values.isCore),
        isRegression: Boolean(values.isRegression),
        isSmoke: Boolean(values.isSmoke),
        projectId: projectId || '',
      };
      await save(payload);
      message.success(
        editingFunc
          ? 'Funcionalidad actualizada correctamente.'
          : 'Funcionalidad creada correctamente.',
      );
      setIsModalOpen(false);
      form.resetFields();
      setEditingFunc(null);
    } catch (error) {
      console.error('Validation failed:', error);
      const apiError = toApiError(error);
      const duplicateCodeError =
        !editingFunc &&
        valuesLooksLikeFunctionalityDuplicate(apiError.message) &&
        Boolean(form.getFieldValue('module'));

      if (duplicateCodeError) {
        const moduleName = form.getFieldValue('module');
        const nextId = await syncNextFunctionalityId(moduleName);
        message.warning(
          `Ese ID ya estaba ocupado. Actualicé el consecutivo al siguiente disponible: ${nextId}.`,
        );
        return;
      }

      message.error(apiError.message || 'No se pudo guardar la funcionalidad.');
    }
  };

  const handleBulkSave = async () => {
    try {
      const values = await bulkForm.validateFields();
      const updates: Partial<Functionality> = {};

      if (values.roles) updates.roles = values.roles;
      if (values.module) updates.module = values.module;
      if (values.sprint) updates.sprint = values.sprint;
      if (typeof values.isCore === 'boolean') updates.isCore = values.isCore;
      if (typeof values.isRegression === 'boolean') updates.isRegression = values.isRegression;
      if (typeof values.isSmoke === 'boolean') updates.isSmoke = values.isSmoke;
      if (values.priority) updates.priority = values.priority;
      if (values.impactLevel) updates.impactLevel = values.impactLevel;
      if (values.probabilityLevel) updates.probabilityLevel = values.probabilityLevel;
      if (values.status) updates.status = values.status;
      if (values.deliveryUnitId) {
        updates.deliveryUnitId = values.deliveryUnitId;
      }
      if (values.markRecentChange) {
        updates.lastFunctionalChangeAt = new Date().toISOString().split('T')[0];
      }

      if (Object.keys(updates).length > 0) {
        await bulkUpdate({ ids: selectedRowKeys as string[], updates });
        setIsBulkModalOpen(false);
        setSelectedRowKeys([]);
        bulkForm.resetFields();
      }
    } catch (error) {
      console.error('Bulk update failed:', error);
    }
  };

  const applyQuickBulkUpdate = async (updates: Partial<Functionality>, successMessage: string) => {
    if (selectedRowKeys.length === 0) return;

    try {
      await bulkUpdate({ ids: selectedRowKeys as string[], updates });
      message.success(successMessage);
    } catch (error) {
      console.error('Quick bulk update failed:', error);
      message.error('No se pudo aplicar la actualización masiva.');
    }
  };

  const handleBulkMarkRecentChange = async () => {
    await applyQuickBulkUpdate(
      { lastFunctionalChangeAt: new Date().toISOString().split('T')[0] },
      'Cambio reciente aplicado a la selección.',
    );
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const handleNativeTableChange = (filters: Record<string, FilterValue | null>) => {
    setTableFilters({
      module: (filters.module as React.Key[] | null) || null,
      riskLevel: (filters.riskLevel as React.Key[] | null) || null,
      priority: (filters.priority as React.Key[] | null) || null,
      status: (filters.status as React.Key[] | null) || null,
      deliveryUnit: (filters.deliveryUnit as React.Key[] | null) || null,
      qaCoverage: (filters.qaCoverage as React.Key[] | null) || null,
    });
  };

  const columns = React.useMemo(
    () =>
      createFunctionalityColumns({
        isViewer,
        tableFilters,
        nativeModuleFilters,
        nativeStatusFilters,
        onView: handleView,
        onDelete: handleDelete,
      }),
    [
      isViewer,
      tableFilters,
      nativeModuleFilters,
      nativeStatusFilters,
      handleDelete,
    ],
  );

  const handleImport = (file: File) => {
    const reader = new FileReader();
    const lowerFileName = file.name.toLowerCase();
    const isSpreadsheet =
      lowerFileName.endsWith('.xlsx') ||
      lowerFileName.endsWith('.xls') ||
      lowerFileName.endsWith('.csv');
    const isTxt = lowerFileName.endsWith('.txt');

    reader.onload = async e => {
      setIsImporting(true);
      message.open({
        key: 'functionality-import',
        type: 'loading',
        content: `Importando ${file.name}...`,
        duration: 0,
      });

      try {
        let importedData: any[] = [];

        if (isSpreadsheet) {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          importedData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        } else if (isTxt) {
          const text = e.target?.result as string;
          // Assume CSV-like format for TXT or one JSON per line
          try {
            importedData = JSON.parse(text);
          } catch {
            // Try CSV parsing
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            importedData = lines
              .slice(1)
              .filter(l => l.trim())
              .map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj: any = {};
                headers.forEach((h, i) => (obj[h] = values[i]));
                return obj;
              });
          }
        }

        if (importedData.length === 0) {
          message.destroy('functionality-import');
          message.warning('No se encontraron datos válidos en el archivo.');
          return;
        }

        const preparedImport = mapImportedRowsToFunctionalities(
          importedData as ImportedFunctionalityRow[],
          projectId,
          configuredSprintNames,
        );

        const reservedFunctionalities: Array<Pick<Functionality, 'id' | 'module'>> =
          allFunctionalities.map(item => ({
            id: item.id,
            module: item.module,
          }));
        const normalizedFuncs = resolveImportedFunctionalityIds(
          preparedImport.functionalities,
          reservedFunctionalities,
        );

        const count = await bulkAdd(normalizedFuncs);
        const skippedCount = Math.max(normalizedFuncs.length - count, 0);
        message.open({
          key: 'functionality-import',
          type: 'success',
          content:
            skippedCount > 0
              ? `Se importaron ${count} funcionalidades. ${skippedCount} se omitieron por ID existente.`
              : `Se importaron ${count} funcionalidades correctamente.`,
          duration: 4,
        });

        if (
          preparedImport.reviewRows.length > 0 ||
          preparedImport.jiraRowsDetected > 0 ||
          skippedCount > 0
        ) {
          Modal.info({
            title:
              preparedImport.jiraRowsDetected > 0
                ? 'Resumen de importación Jira'
                : 'Resumen de importación',
            width: 720,
            content: (
              <div className="space-y-3 pt-2">
                <p className="m-0 text-slate-600">
                  {count} funcionalidades importadas.{' '}
                  {skippedCount > 0 ? `${skippedCount} omitidas por ID existente. ` : ''}
                  {preparedImport.reviewRows.length > 0
                    ? `${preparedImport.reviewRows.length} requieren revisión manual.`
                    : 'No se detectaron observaciones de revisión.'}
                </p>
                {preparedImport.reviewRows.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-amber-900">
                      {preparedImport.reviewRows.map(row => (
                        <li key={`${row.id}-${row.name}`}>
                          <span className="font-semibold">{row.id}</span> - {row.name}
                          <div className="text-xs text-amber-800">{row.reasons.join(' ')}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ),
          });
        }
      } catch (err) {
        console.error('Import error:', err);
        message.destroy('functionality-import');
        message.error('Error al procesar el archivo. Verifica el formato.');
      } finally {
        setIsImporting(false);
      }
    };

    if (isSpreadsheet) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    return false; // Prevent auto-upload
  };

  const handleExport = async () => {
    try {
      if (!projectId) {
        message.warning('No se encontro el proyecto activo para exportar.');
        return;
      }

      if (!filteredFunctionalities || filteredFunctionalities.length === 0) {
        message.warning('No hay datos para exportar.');
        return;
      }

      const exportData = buildFunctionalityExportData(filteredFunctionalities);

      await runTrackedExport({
        projectId,
        action: async () => {
          const XLSX = await import('xlsx');
          const worksheet = XLSX.utils.json_to_sheet(exportData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Funcionalidades');

          const fileName = `Funcionalidades_${filter || 'Todas'}_${new Date().toISOString().split('T')[0]}.xlsx`;

          try {
            XLSX.writeFile(workbook, fileName);
          } catch (writeErr) {
            console.error('XLSX.writeFile error:', writeErr);
            const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([workbookBuffer], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            saveAs(blob, fileName);
          }
        },
      });

      message.success('Archivo Excel generado correctamente.');
    } catch (err) {
      console.error('Export error details:', err);
      message.error('Error al exportar a Excel. Revisa la consola para mas detalles.');
    }
  };

  const handleValuesChange = (changedValues: Record<string, unknown>) => {
    if (!editingFunc && changedValues.module) {
      void syncNextFunctionalityId(String(changedValues.module));
    }
  };

  const {
    total: totalFuncs,
    completed: completedFuncs,
    inProgress: inProgressFuncs,
    backlog: backlogFuncs,
    mvp: mvpFuncs,
  } = React.useMemo(() => getFunctionalityMetrics(allFunctionalities), [allFunctionalities]);
  const qaPlanningMetrics = React.useMemo(
    () => getQaPlanningMetrics(filteredFunctionalities),
    [filteredFunctionalities],
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header Pattern */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">
            {isQaPlanningMode ? 'Planificación QA' : 'Gestión de Funcionalidades'}
          </Title>
          <Text type="secondary" className="text-slate-500">
            {isQaPlanningMode
              ? 'Clasifica cobertura, riesgo y prioridad para organizar el alcance de smoke y regresión.'
              : 'Administra el inventario de funcionalidades y su estado de desarrollo.'}
          </Text>
        </div>
        <Space>
          <Button icon={<UploadOutlined />} onClick={handleExport} className="rounded-lg h-10">
            Exportar
          </Button>
          {!isViewer ? (
            <>
              <Upload
                beforeUpload={handleImport}
                showUploadList={false}
                accept=".xlsx,.xls,.csv,.txt"
                disabled={isImporting}
              >
                <Button
                  icon={<DownloadOutlined />}
                  className="rounded-lg h-10"
                  loading={isImporting}
                  disabled={isImporting}
                >
                  {isImporting ? 'Importando...' : 'Importar'}
                </Button>
              </Upload>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingFunc(null);
                  setNextFunctionalityIdPreview('');
                  form.resetFields();
                  form.setFieldsValue(FUNCTIONALITY_FORM_INITIAL_VALUES);
                  setIsModalOpen(true);
                }}
                className="rounded-lg h-10 px-6"
              >
                Nueva Funcionalidad
              </Button>
            </>
          ) : null}
        </Space>
      </div>

      <Card className="mb-6 rounded-2xl border-sky-100 bg-sky-50/70 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
            <InfoCircleOutlined className="text-lg" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">
              Antes de registrar funcionalidades, configura los sprints, módulos y roles del
              proyecto.
            </div>
            <div className="mt-1 text-sm text-slate-500">
              QA Tracker usa esa configuración para clasificar correctamente cada funcionalidad,
              mantener el alcance ordenado y facilitar su trazabilidad en ejecución, smoke y
              regresión.
            </div>
          </div>
        </div>
      </Card>

      {isQaPlanningMode ? (
        <Card className="rounded-2xl border-amber-100 bg-amber-50/70 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Vista enfocada en planificación y cobertura QA
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Selecciona funcionalidades, aplica filtros rápidos y usa la edición masiva para
                dejar listas las candidatas a smoke, regresión, riesgo y prioridad.
              </div>
            </div>
            <Tag className="m-0 rounded-full border-0 bg-white px-3 py-1 text-amber-700">
              {filteredFunctionalities.length} visibles
            </Tag>
          </div>
        </Card>
      ) : null}

      <QaPlanningFilterBar
        planningMode={isQaPlanningMode}
        qaPlanningPreset={qaPlanningPreset}
        moduleOptions={moduleOptions}
        riskOptions={riskOptions}
        priorityOptions={priorityOptions}
        tableFilters={tableFilters}
        onPresetChange={setQaPlanningPreset}
        onTableFilterChange={setSingleTableFilter}
      />

      {/* Metrics Cards */}
      <Row gutter={[20, 20]} className="mt-4">
        {isQaPlanningMode ? (
          <>
            <SummaryMetricCard
              label="Total visibles"
              value={qaPlanningMetrics.total}
              valueClassName="text-slate-800"
              lgSpan={4}
            />
            <SummaryMetricCard
              label="Sin cobertura"
              value={qaPlanningMetrics.withoutCoverage}
              valueClassName="text-slate-700"
            />
            <SummaryMetricCard
              label="Smoke"
              value={qaPlanningMetrics.smoke}
              valueClassName="text-orange-600"
            />
            <SummaryMetricCard
              label="Regresión"
              value={qaPlanningMetrics.regression}
              valueClassName="text-violet-600"
            />
            <SummaryMetricCard
              label="Alto riesgo"
              value={qaPlanningMetrics.highRisk}
              valueClassName="text-red-600"
            />
            <SummaryMetricCard
              label="Alta prioridad"
              value={qaPlanningMetrics.highPriority}
              valueClassName="text-amber-600"
            />
          </>
        ) : (
          <>
            <SummaryMetricCard
              label="Total"
              value={totalFuncs}
              valueClassName="text-slate-800"
              lgSpan={4}
            />
            <SummaryMetricCard
              label="Completadas"
              value={completedFuncs}
              valueClassName="text-emerald-600"
            />
            <SummaryMetricCard
              label="En Desarrollo"
              value={inProgressFuncs}
              valueClassName="text-blue-600"
            />
            <SummaryMetricCard
              label="Backlog"
              value={backlogFuncs}
              valueClassName="text-slate-500"
            />
            <SummaryMetricCard label="MVP" value={mvpFuncs} valueClassName="text-amber-600" />
          </>
        )}
      </Row>

      {isQaPlanningMode && !isViewer ? (
        <QaPlanningBulkActions
          selectedCount={selectedRowKeys.length}
          onMarkRecentChange={() => void handleBulkMarkRecentChange()}
          onMarkSmoke={() =>
            applyQuickBulkUpdate({ isSmoke: true }, 'Funcionalidades marcadas para Smoke.')
          }
          onMarkRegression={() =>
            applyQuickBulkUpdate({ isRegression: true }, 'Funcionalidades marcadas para Regresión.')
          }
          onSetHighImpact={() =>
            applyQuickBulkUpdate({ impactLevel: ImpactLevel.HIGH }, 'Impacto alto aplicado.')
          }
          onSetHighPriority={() =>
            applyQuickBulkUpdate({ priority: Priority.HIGH }, 'Prioridad alta aplicada.')
          }
          onClearCoverage={() =>
            applyQuickBulkUpdate(
              { isSmoke: false, isRegression: false, isCore: false },
              'Cobertura QA limpiada para la selección.',
            )
          }
          onOpenBulkEdit={() => setIsBulkModalOpen(true)}
        />
      ) : null}

      {/* Table Card */}
      <Card
        className="rounded-2xl shadow-sm border-slate-100"
        title={
          <FunctionalityTableTitle
            planningMode={isQaPlanningMode}
            selectedCount={selectedRowKeys.length}
          />
        }
        extra={
          <FunctionalityTableToolbar
            functionalitySearch={functionalitySearch}
            onSearchChange={value => setFunctionalitySearch(value)}
            onClearFilters={clearNativeTableFilters}
            hasActiveFilters={hasActiveNativeTableFilters}
            isViewer={isViewer}
            planningMode={isQaPlanningMode}
            selectedCount={selectedRowKeys.length}
            selectedPreset={qaPlanningPreset}
            onOpenBulkEdit={() => setIsBulkModalOpen(true)}
            onPresetChange={setQaPlanningPreset}
            onTogglePlanningMode={() => {
              setIsQaPlanningMode(current => !current);
              setSelectedRowKeys([]);
              setTableFilters(INITIAL_NATIVE_TABLE_FILTERS);
              setQaPlanningPreset('all');
            }}
          />
        }
      >
        <Table
          rowSelection={
            isViewer
              ? undefined
              : {
                  ...rowSelection,
                  columnWidth: 44,
                }
          }
          columns={columns}
          dataSource={filteredFunctionalities}
          rowKey="id"
          rowClassName={record => getFunctionalityRowClassName(record)}
          className="executive-table functionality-table"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20 }}
          onChange={(_, filters) => handleNativeTableChange(filters)}
        />
      </Card>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            {editingFunc ? 'Editar Funcionalidad' : 'Nueva Funcionalidad'}
          </span>
        }
        open={isModalOpen}
        onOk={isViewer ? undefined : handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={650}
        centered
        okText="Guardar"
        cancelText="Cancelar"
        className="executive-modal"
        okButtonProps={{ disabled: isViewer }}
      >
        <FunctionalityEditorForm
          form={form}
          moduleOptions={moduleOptions}
          roleOptions={roleOptions}
          sprintOptions={sprintOptions}
          deliveryUnitOptions={deliveryUnitOptions}
          priorityOptions={priorityOptions}
          impactOptions={impactOptions}
          probabilityOptions={probabilityOptions}
          statusOptions={statusOptions}
          t={t}
          onValuesChange={handleValuesChange}
        />
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Detalle de Funcionalidad</span>}
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        centered
        width={760}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
            {!isViewer && detailFunctionality ? (
              <Button type="primary" icon={<EditOutlined />} onClick={handleEditFromDetail}>
                Editar funcionalidad
              </Button>
            ) : null}
          </div>
        }
      >
        {detailFunctionality ? (
          <div className="space-y-4 bg-slate-50/80 px-1 py-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <AppstoreOutlined className="text-lg" />
                  </div>
                  <div className="text-sm text-slate-500">
                    Datos base y contexto general de la funcionalidad.
                  </div>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Identificación
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FunctionalityDetailValue label="ID" value={detailFunctionality.id} />
                  <FunctionalityDetailValue label="Módulo" value={detailFunctionality.module} />
                  <FunctionalityDetailValue
                    label="Funcionalidad"
                    value={detailFunctionality.name}
                  />
                  <FunctionalityDetailValue
                    label="Roles autorizados"
                    value={
                      detailFunctionality.roles.length > 0
                        ? detailFunctionality.roles.join(', ')
                        : 'N/A'
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <LinkOutlined className="text-lg" />
                  </div>
                  <div className="text-sm text-slate-500">
                    Vinculaci&oacute;n externa con la tarea o incidencia de origen.
                  </div>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Jira
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FunctionalityDetailValue
                    label="Jira key"
                    value={detailFunctionality.jiraIssueKey}
                  />
                  <FunctionalityDetailValue
                    label="Tipo de incidencia Jira"
                    value={detailFunctionality.jiraIssueType}
                  />
                </div>
                <div className="mt-3">
                  <FunctionalityDetailValue
                    label="Link de tarea Jira"
                    value={
                      detailFunctionality.jiraTaskUrl ? (
                        <a
                          href={detailFunctionality.jiraTaskUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {detailFunctionality.jiraTaskUrl}
                        </a>
                      ) : undefined
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <SafetyCertificateOutlined className="text-lg" />
                  </div>
                  <div className="text-sm text-slate-500">
                    Estado funcional, cobertura y se&ntilde;ales de riesgo para seguimiento.
                  </div>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  QA
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FunctionalityDetailValue
                    label="Estado"
                    value={labelTestStatus(detailFunctionality.status, t)}
                  />
                  <FunctionalityDetailValue
                    label="Prioridad"
                    value={labelPriority(detailFunctionality.priority, t)}
                  />
                  <FunctionalityDetailValue
                    label="Impacto"
                    value={labelImpact(detailFunctionality.impactLevel)}
                  />
                  <FunctionalityDetailValue
                    label="Probabilidad"
                    value={labelProbability(detailFunctionality.probabilityLevel)}
                  />
                  <FunctionalityDetailValue
                    label="Riesgo"
                    value={labelRisk(detailFunctionality.riskLevel, t)}
                  />
                  <FunctionalityDetailValue label="Sprint" value={detailFunctionality.sprint} />
                </div>
                <div className="mt-3">
                  <FunctionalityDetailValue
                    label="Cobertura QA"
                    value={
                      <div className="flex flex-wrap gap-2">
                        {getCoverageTags(detailFunctionality).length > 0 ? (
                          getCoverageTags(detailFunctionality).map(tag => (
                            <Tag
                              key={tag.key}
                              className={`m-0 rounded-full border-0 ${tag.className}`}
                            >
                              {tag.label}
                            </Tag>
                          ))
                        ) : (
                          <span>N/A</span>
                        )}
                      </div>
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <DeploymentUnitOutlined className="text-lg" />
                  </div>
                  <div className="text-sm text-slate-500">
                    Datos operativos para planificaci&oacute;n y seguimiento de releases.
                  </div>
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Entrega
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FunctionalityDetailValue
                    label="Fecha de entrega"
                    value={detailFunctionality.deliveryDate}
                  />
                  <FunctionalityDetailValue
                    label="Último cambio funcional"
                    value={detailFunctionality.lastFunctionalChangeAt}
                  />
                  <FunctionalityDetailValue
                    label="Unidad de entrega"
                    value={detailFunctionality.deliveryUnitName}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            Edición Masiva ({selectedRowKeys.length} items)
          </span>
        }
        open={isBulkModalOpen}
        onOk={isViewer ? undefined : handleBulkSave}
        onCancel={() => setIsBulkModalOpen(false)}
        width={500}
        centered
        okText="Actualizar Todo"
        cancelText="Cancelar"
        className="executive-modal"
        okButtonProps={{ disabled: isViewer }}
      >
        <Typography.Paragraph type="secondary" className="mb-4">
          Selecciona solo los campos que deseas actualizar para todas las funcionalidades
          seleccionadas.
        </Typography.Paragraph>
        <Form form={bulkForm} layout="vertical">
          <Form.Item
            name="roles"
            label={<span className="font-semibold text-slate-600">Roles Autorizados</span>}
          >
            <Select
              mode="multiple"
              placeholder="Cambiar roles para todos..."
              className="executive-select"
              options={rolesData.map(item => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>

          <Form.Item
            name="module"
            label={<span className="font-semibold text-slate-600">Módulo</span>}
          >
            <Select
              placeholder="Cambiar módulo para todos..."
              className="h-10 rounded-lg"
              options={moduleOptions}
            />
          </Form.Item>

          <Form.Item
            name="sprint"
            label={<span className="font-semibold text-slate-600">Sprint</span>}
          >
            <Select
              allowClear
              placeholder="Cambiar sprint para todos..."
              className="h-10 rounded-lg"
              options={sprintOptions}
            />
          </Form.Item>

          <Form.Item label={<span className="font-semibold text-slate-600">Cobertura QA</span>}>
            <Space direction="vertical" size={10}>
              <Form.Item name="isCore" valuePropName="checked" noStyle>
                <Checkbox>Marcar como Core</Checkbox>
              </Form.Item>
              <Form.Item name="isRegression" valuePropName="checked" noStyle>
                <Checkbox>Marcar para Regresión</Checkbox>
              </Form.Item>
              <Form.Item name="isSmoke" valuePropName="checked" noStyle>
                <Checkbox>Marcar para Smoke</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            name="priority"
            label={<span className="font-semibold text-slate-600">Prioridad</span>}
          >
            <Select
              placeholder="Cambiar prioridad para todos..."
              className="h-10 rounded-lg"
              options={priorityOptions}
            />
          </Form.Item>

          <Form.Item
            name="impactLevel"
            label={<span className="font-semibold text-slate-600">Impacto</span>}
          >
            <Select
              placeholder="Cambiar impacto para todos..."
              className="h-10 rounded-lg"
              options={impactOptions}
            />
          </Form.Item>

          <Form.Item
            name="probabilityLevel"
            label={<span className="font-semibold text-slate-600">Probabilidad</span>}
          >
            <Select
              placeholder="Cambiar probabilidad para todos..."
              className="h-10 rounded-lg"
              options={probabilityOptions}
            />
          </Form.Item>

          <Form.Item
            name="status"
            label={<span className="font-semibold text-slate-600">Estado Actual</span>}
          >
            <Select
              placeholder="Cambiar estado para todos..."
              className="h-10 rounded-lg"
              options={FUNCTIONALITY_DEVELOPMENT_STATUSES.map(v => ({
                label: labelTestStatus(v, t),
                value: v,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="deliveryUnitId"
            label={<span className="font-semibold text-slate-600">Unidad de Entrega</span>}
          >
            <Select
              allowClear
              placeholder="Aplicar unidad a todas..."
              className="h-10 rounded-lg"
              options={deliveryUnitsData.map(item => ({
                label: item.periodLabel ? `${item.name} - ${item.periodLabel}` : item.name,
                value: item.documentId || item.id,
              }))}
            />
          </Form.Item>

          <Form.Item name="markRecentChange" valuePropName="checked">
            <Checkbox>Marcar cambio reciente con fecha de hoy</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
