import React, { useMemo, useState } from 'react';
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
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FilterOutlined,
  LineChartOutlined,
  ProjectOutlined,
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
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useRegressionCycles } from '../modules/test-cycles/hooks/useRegressionCycles';
import { useSmokeCycles } from '../modules/test-cycles/hooks/useSmokeCycles';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { BugStatus, RegressionCycle, RiskLevel, TestResult, TestStatus } from '../types';
import { exportToPdf } from '../utils/reportUtils';

const { Title, Text, Paragraph } = Typography;

type ReportVariant = 'QA_STATUS_SUMMARY' | 'QA_PROGRESS_REPORT' | 'PROJECT_STATUS_REPORT';

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
}

const normalizeSprintKey = (value?: string | null) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/^sprint\s*/i, '');

const getCycleTypeLabel = (cycle: RegressionCycle) => {
  if (cycle.type === 'SMOKE') return 'Smoke';
  if (cycle.type === 'REGRESSION') return 'Regresion';
  return cycle.cycleId?.startsWith('S-') ? 'Smoke' : 'Regresion';
};

const getExecutedCount = (cycle: RegressionCycle) =>
  Math.max(cycle.totalTests - cycle.pending - cycle.blocked, 0);

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

const SelectionCard: React.FC<SelectionCardProps> = ({
  type,
  title,
  description,
  format,
  selected,
  onSelect,
  icon,
}) => (
  <Card
    hoverable
    className={`relative overflow-hidden transition-all duration-300 border-2 ${
      selected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'
    }`}
    onClick={() => onSelect(type)}
  >
    {selected && (
      <div className="absolute top-3 right-3 text-blue-500 text-xl">
        <CheckCircleFilled />
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

const QAStatusSummary: React.FC<{ projectId: string; cycle: RegressionCycle | null }> = ({
  projectId,
  cycle,
}) => {
  const { data: bugs = [] } = useBugs(projectId);

  if (!cycle) return <Empty description="Seleccione un ciclo para ver el reporte" />;

  const cycleBugs = useMemo(
    () => bugs.filter(bug => bug.cycleId === cycle.cycleId),
    [bugs, cycle.cycleId],
  );

  const activeCycleBugs = useMemo(
    () => cycleBugs.filter(bug => bug.status !== BugStatus.RESOLVED),
    [cycleBugs],
  );

  const executedTests = getExecutedCount(cycle);
  const executionCoverage = getPercent(executedTests, cycle.totalTests);
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
      label: 'Cobertura de ejecucion',
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
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic
              title="Tasa de aprobacion"
              value={cycle.passRate}
              suffix="%"
              valueStyle={{ color: '#10b981', fontWeight: 800 }}
            />
            <Progress percent={cycle.passRate} showInfo={false} strokeColor="#10b981" />
          </Card>
        </Col>
        <Col span={8}>
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
        <Col span={8}>
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
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="Distribucion de resultados" className="rounded-2xl border-slate-100 h-full">
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
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Metricas de calidad" className="rounded-2xl border-slate-100 h-full">
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

      <Card title="Detalle de ejecucion" className="rounded-2xl border-slate-100 overflow-hidden">
        <Table
          dataSource={cycle.executions}
          rowKey="id"
          columns={[
            { title: 'Funcionalidad', dataIndex: 'functionalityName', key: 'name' },
            { title: 'Modulo', dataIndex: 'module', key: 'module' },
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
              render: bugId => bugId || '-',
            },
          ]}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

const QAProgressReport: React.FC<{ projectId: string; sprint: string | null }> = ({
  projectId,
  sprint,
}) => {
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
    };
  }, [filteredCycles]);

  const recentMilestones = useMemo(
    () =>
      [...filteredCycles]
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
        .slice(0, 3),
    [filteredCycles],
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
            Tendencia de calidad y evolucion de las pruebas
            {sprint ? ` en ${sprint}` : ' en los ultimos ciclos'}.
          </Paragraph>
        </div>
        {sprint && (
          <Tag color="blue" className="mb-6 rounded-full px-4 py-1 font-bold">
            {sprint}
          </Tag>
        )}
      </div>

      <Card title="Tendencia de tasa de aprobacion (%)" className="rounded-2xl border-slate-100">
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

      <Row gutter={24}>
        <Col span={12}>
          <Card title="Metricas de evolucion" className="rounded-2xl border-slate-100">
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
                  <Text strong>Velocidad de ejecucion</Text>
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
            </div>
          </Card>
        </Col>
        <Col span={12}>
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
  );
};

const ProjectStatusReport: React.FC<{ projectId: string; sprint: string | null }> = ({
  projectId,
  sprint,
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
      pendingCycleTests,
      riskTone,
    };
  }, [bugs, functionalities, regressionCycles, smokeCycles, sprint, testCases]);

  const barData = [
    { name: 'Total', value: stats.total, fill: '#3b82f6' },
    { name: 'Completadas', value: stats.completed, fill: '#10b981' },
    { name: 'Casos', value: stats.testCasesCount, fill: '#8b5cf6' },
    { name: 'Bugs activos', value: stats.activeBugsCount, fill: '#ef4444' },
    { name: 'Ciclos', value: stats.cycleCount, fill: '#f59e0b' },
  ];

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
            Vision global del avance funcional, cobertura y riesgos{sprint ? ` para ${sprint}` : ''}
            .
          </Paragraph>
        </div>
        {sprint && (
          <Tag color="blue" className="mb-6 rounded-full px-4 py-1 font-bold">
            {sprint}
          </Tag>
        )}
      </div>

      <Row gutter={24}>
        <Col span={16}>
          <Card title="Avance por categoria" className="rounded-2xl border-slate-100 h-full">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Resumen ejecutivo" className="rounded-2xl border-slate-100 h-full">
            <div className="space-y-6">
              <Statistic title="Progreso general" value={stats.progress} suffix="%" />
              <Progress percent={stats.progress} status="active" strokeColor="#3b82f6" />
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
                  <Text type="secondary">Nivel de riesgo:</Text>
                  <Tag color={stats.riskTone.color}>{stats.riskTone.label}</Tag>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Analisis de riesgos" className="rounded-2xl border-slate-100">
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
                ? `Hay ${stats.activeBugsCount} bugs activos y una tasa promedio de aprobacion de ${stats.averagePassRate}%.`
                : `No hay bugs activos y la tasa promedio de aprobacion de los ciclos es ${stats.averagePassRate}%.`}
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default function Reports({ projectId }: { projectId: string }) {
  const [selectedVariant, setSelectedVariant] = useState<ReportVariant>('QA_STATUS_SUMMARY');
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [view, setView] = useState<'CONFIG' | 'REPORT'>('CONFIG');

  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  const { data: smokeCycles = [] } = useSmokeCycles(projectId);
  const { data: sprints = [] } = useSprints(projectId);

  const allCycles = useMemo(
    () => [...regressionCycles, ...smokeCycles],
    [regressionCycles, smokeCycles],
  );

  const filteredCycles = useMemo(() => {
    if (!selectedSprint) return allCycles;
    const selectedKey = normalizeSprintKey(selectedSprint);
    return allCycles.filter(cycle => normalizeSprintKey(cycle.sprint) === selectedKey);
  }, [allCycles, selectedSprint]);

  const selectedCycle = useMemo(
    () => allCycles.find(cycle => cycle.id === selectedCycleId) || null,
    [allCycles, selectedCycleId],
  );

  const handleGenerate = () => {
    if (selectedVariant === 'QA_STATUS_SUMMARY' && !selectedCycleId) {
      message.warning('Por favor seleccione un ciclo para este tipo de reporte');
      return;
    }

    setView('REPORT');
  };

  const handleExportPdf = async () => {
    try {
      await exportToPdf(
        'report-content',
        `Reporte_${selectedVariant}_${dayjs().format('YYYYMMDD')}`,
      );
      message.success('Reporte exportado correctamente');
    } catch (error) {
      message.error('Error al exportar el reporte');
    }
  };

  if (view === 'REPORT') {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setView('CONFIG')}
            className="rounded-xl border-slate-200 hover:text-blue-500"
          >
            Volver a configuracion
          </Button>
          <Space>
            <Button icon={<FileWordOutlined />} className="rounded-xl border-slate-200">
              Word
            </Button>
            <Button icon={<FileExcelOutlined />} className="rounded-xl border-slate-200">
              Excel
            </Button>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={handleExportPdf}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 border-none"
            >
              Exportar PDF
            </Button>
          </Space>
        </div>

        {selectedVariant === 'QA_STATUS_SUMMARY' && (
          <QAStatusSummary projectId={projectId} cycle={selectedCycle} />
        )}
        {selectedVariant === 'QA_PROGRESS_REPORT' && (
          <QAProgressReport projectId={projectId} sprint={selectedSprint} />
        )}
        {selectedVariant === 'PROJECT_STATUS_REPORT' && (
          <ProjectStatusReport projectId={projectId} sprint={selectedSprint} />
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
          Seleccione el tipo de reporte y configure los filtros para obtener informacion detallada.
        </Paragraph>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SelectionCard
          type="QA_STATUS_SUMMARY"
          title="Resumen de Estado QA"
          description="Visión detallada de un ciclo específico, métricas de aprobación y fallos."
          format="PDF / EXCEL / WORD"
          icon={<FileTextOutlined />}
          selected={selectedVariant === 'QA_STATUS_SUMMARY'}
          onSelect={setSelectedVariant}
        />
        <SelectionCard
          type="QA_PROGRESS_REPORT"
          title="Reporte de Progreso QA"
          description="Tendencias de calidad, evolución de casos y hitos alcanzados en el tiempo."
          format="PDF / EXCEL"
          icon={<LineChartOutlined />}
          selected={selectedVariant === 'QA_PROGRESS_REPORT'}
          onSelect={setSelectedVariant}
        />
        <SelectionCard
          type="PROJECT_STATUS_REPORT"
          title="Estado del Proyecto"
          description="Resumen ejecutivo del avance funcional, riesgos y cobertura global."
          format="PDF / WORD"
          icon={<ProjectOutlined />}
          selected={selectedVariant === 'PROJECT_STATUS_REPORT'}
          onSelect={setSelectedVariant}
        />
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <FilterOutlined /> Configuración de filtros
          </div>
        </div>
        <div className="p-8">
          <Row gutter={24}>
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
