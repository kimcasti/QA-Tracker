import React from 'react';
import { Card, Col, Progress, Row, Statistic, Table, Tag, Typography } from 'antd';
import {
  BarChartOutlined,
  BugOutlined,
  CheckCircleFilled,
  CloudFilled,
  DatabaseFilled,
  FileSearchOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell } from 'recharts';
import dayjs from 'dayjs';
import { useBugs } from '../modules/bugs/hooks/useBugs';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useRegressionCycles } from '../modules/test-cycles/hooks/useRegressionCycles';
import { useSmokeCycles } from '../modules/test-cycles/hooks/useSmokeCycles';
import { useExecutions } from '../modules/test-runs/hooks/useExecutions';
import { ExecutionStatus, Severity, TestResult, TestStatus, TestType } from '../types';
import { qaPalette, softSurface } from '../theme/palette';
import { functionalityStatusColors, softTagStyle } from '../theme/statusStyles';

const { Title, Text } = Typography;

const CHART_COLORS = {
  passed: qaPalette.functionalityStatus.completed,
  failed: qaPalette.functionalityStatus.failed,
  remaining: qaPalette.border,
  smoke: qaPalette.functionalityStatus.inProgress,
  regression: qaPalette.primary,
  automation: qaPalette.functionalityStatus.postMvp,
} as const;

function FixedPie({
  data,
  innerRadius,
  outerRadius,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  innerRadius: number;
  outerRadius: number;
}) {
  return (
    <PieChart width={160} height={160}>
      <Pie
        data={data}
        dataKey="value"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        cx={80}
        cy={80}
        stroke="none"
      >
        {data.map((entry, index) => (
          <Cell key={`${entry.name}-${index}`} fill={entry.color} />
        ))}
      </Pie>
    </PieChart>
  );
}

function KpiCard({
  title,
  value,
  hint,
  accent,
  icon,
}: {
  title: string;
  value: string | number;
  hint: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <Card
      variant="borderless"
      className="rounded-2xl qa-surface-card hover:shadow-md transition-shadow"
      style={{
        background: `linear-gradient(135deg, ${qaPalette.card} 0%, ${softSurface(accent)} 100%)`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </Text>
          <div className="mt-1 text-3xl font-bold" style={{ color: accent }}>
            {value}
          </div>
          <div className="mt-1 text-[10px] text-slate-400">{hint}</div>
        </div>
        <div className="rounded-xl p-2" style={{ backgroundColor: softSurface(accent) }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  percent,
  accent,
  icon,
}: {
  title: string;
  value: number;
  percent: number;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <Card
      variant="borderless"
      className="rounded-2xl qa-surface-card hover:shadow-md transition-shadow"
    >
      <Statistic
        title={
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </span>
        }
        value={value}
        prefix={icon}
        styles={{ content: { color: accent, fontWeight: 'bold' } }}
      />
      <Progress percent={percent} showInfo={false} strokeColor={accent} size="small" />
    </Card>
  );
}

export default function Dashboard({ projectId }: { projectId?: string }) {
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: executionsData } = useExecutions(projectId);
  const { data: regressionCyclesData } = useRegressionCycles(projectId);
  const { data: smokeCyclesData } = useSmokeCycles(projectId);
  const { data: testCasesData } = useTestCases(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const { data: bugsData = [] } = useBugs(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const executions = (Array.isArray(executionsData) ? executionsData : []).filter(
    execution => execution.status === ExecutionStatus.FINAL,
  );
  const regressionCycles = Array.isArray(regressionCyclesData) ? regressionCyclesData : [];
  const smokeCycles = Array.isArray(smokeCyclesData) ? smokeCyclesData : [];
  const testCases = Array.isArray(testCasesData) ? testCasesData : [];
  const sprints = Array.isArray(sprintsData) ? sprintsData : [];
  const bugs = Array.isArray(bugsData) ? bugsData : [];

  const totalFunctionalities = functionalities.length;
  const completedFuncs = functionalities.filter(
    item => item.status === TestStatus.COMPLETED,
  ).length;
  const inProgressFuncs = functionalities.filter(
    item => item.status === TestStatus.IN_PROGRESS,
  ).length;
  const backlogFuncs = functionalities.filter(item => item.status === TestStatus.BACKLOG).length;
  const mvpFuncs = functionalities.filter(item => item.status === TestStatus.MVP).length;
  const failedFuncs = functionalities.filter(item => item.status === TestStatus.FAILED).length;

  const allCycleExecutions = [
    ...regressionCycles.flatMap(cycle => cycle.executions || []),
    ...smokeCycles.flatMap(cycle => cycle.executions || []),
  ];

  const totalBugs = bugs.length;
  const criticalBugs = bugs.filter(item => item.severity === Severity.CRITICAL).length;
  const funcsWithTestCases = new Set(testCases.map(item => item.functionalityId)).size;
  const testCaseCoverage =
    totalFunctionalities > 0 ? (funcsWithTestCases / totalFunctionalities) * 100 : 0;

  const regressionExecutions = regressionCycles.flatMap(cycle => cycle.executions || []);
  const regressionPassedExecutions = regressionExecutions.filter(
    execution => execution.result === TestResult.PASSED,
  ).length;
  const regressionStability =
    regressionExecutions.length > 0
      ? (regressionPassedExecutions / regressionExecutions.length) * 100
      : 0;

  const automatedTests = testCases.filter(item => item.testType === TestType.SANITY).length;
  const automationCoverage =
    testCases.length > 0 ? Math.round((automatedTests / testCases.length) * 100) : 0;

  const regressionFuncs = functionalities.filter(item => item.isRegression);
  const regressionPassed = regressionFuncs.filter(
    item => item.status === TestStatus.COMPLETED,
  ).length;
  const regressionFailed = regressionFuncs.filter(item => item.status === TestStatus.FAILED).length;
  const regressionRemaining = Math.max(
    regressionFuncs.length - regressionPassed - regressionFailed,
    0,
  );
  const regressionPercent =
    regressionFuncs.length > 0 ? Math.round((regressionPassed / regressionFuncs.length) * 100) : 0;

  const smokeFuncs = functionalities.filter(item => item.isSmoke);
  const smokePassed = smokeFuncs.filter(item => item.status === TestStatus.COMPLETED).length;
  const smokeFailed = smokeFuncs.filter(item => item.status === TestStatus.FAILED).length;
  const smokeRemaining = Math.max(smokeFuncs.length - smokePassed - smokeFailed, 0);
  const smokePercent =
    smokeFuncs.length > 0 ? Math.round((smokePassed / smokeFuncs.length) * 100) : 0;

  const regressionPieData = [
    { name: 'Aprobados', value: regressionPassed, color: CHART_COLORS.passed },
    { name: 'Fallidos', value: regressionFailed, color: CHART_COLORS.failed },
    { name: 'Restante', value: regressionRemaining, color: CHART_COLORS.remaining },
  ];

  const smokePieData = [
    { name: 'Exitosos', value: smokePassed, color: CHART_COLORS.smoke },
    { name: 'Bloqueantes', value: smokeFailed, color: CHART_COLORS.failed },
    { name: 'Pendientes', value: smokeRemaining, color: CHART_COLORS.remaining },
  ];

  const executionMixData = [
    {
      name: 'Ejecutados',
      value: completedFuncs + failedFuncs,
      color: qaPalette.primary,
    },
    {
      name: 'No ejecutados',
      value: Math.max(totalFunctionalities - (completedFuncs + failedFuncs), 0),
      color: qaPalette.border,
    },
  ];

  const sanityMixData = [
    {
      name: 'Sanity',
      value: functionalities.filter(item => item.isSmoke).length,
      color: qaPalette.primary,
    },
    {
      name: 'Funcional',
      value: functionalities.filter(item => !item.isSmoke).length,
      color: softSurface(qaPalette.primary),
    },
  ];

  const moduleCounts = functionalities.reduce<Record<string, number>>((acc, item) => {
    acc[item.module] = (acc[item.module] || 0) + 1;
    return acc;
  }, {});

  const moduleData = Object.entries(moduleCounts)
    .map(([name, count]) => ({
      name,
      count,
      percent: totalFunctionalities > 0 ? Math.round((count / totalFunctionalities) * 100) : 0,
    }))
    .sort((left, right) => right.count - left.count);

  const getModuleAccent = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('paciente')) return qaPalette.functionalityStatus.completed;
    if (lower.includes('seguimiento')) return qaPalette.primary;
    if (lower.includes('intervencion')) return qaPalette.functionalityStatus.inProgress;
    return qaPalette.secondary;
  };

  const getModuleIcon = (name: string) => {
    const accent = getModuleAccent(name);
    const lower = name.toLowerCase();
    if (lower.includes('paciente')) {
      return <CheckCircleFilled className="text-xl" style={{ color: accent }} />;
    }
    if (lower.includes('seguimiento')) {
      return <DatabaseFilled className="text-xl" style={{ color: accent }} />;
    }
    if (lower.includes('intervencion')) {
      return <CloudFilled className="text-xl" style={{ color: accent }} />;
    }
    return <BarChartOutlined className="text-xl" style={{ color: accent }} />;
  };

  const sprintByName = new Map(sprints.map(sprint => [sprint.name, sprint]));

  const tableData = functionalities
    .filter(item => item.status === TestStatus.COMPLETED)
    .filter(item => {
      const sprint = item.sprint ? sprintByName.get(item.sprint) : undefined;
      if (!sprint) return true;

      const delivery = dayjs(item.deliveryDate);
      const start = dayjs(sprint.startDate);
      const end = dayjs(sprint.endDate);
      if (!delivery.isValid() || !start.isValid() || !end.isValid()) return true;
      return delivery.isAfter(start.subtract(1, 'day')) && delivery.isBefore(end.add(1, 'day'));
    })
    .sort((left, right) => dayjs(right.deliveryDate).valueOf() - dayjs(left.deliveryDate).valueOf())
    .slice(0, 5)
    .map(item => {
      const sprint = item.sprint ? sprintByName.get(item.sprint) : undefined;
      const period =
        sprint && dayjs(sprint.startDate).isValid() && dayjs(sprint.endDate).isValid()
          ? `${sprint.name} (${dayjs(sprint.startDate).format('DD/MM/YYYY')} - ${dayjs(sprint.endDate).format('DD/MM/YYYY')})`
          : item.sprint || 'Sin Sprint';

      return {
        key: item.id,
        period,
        name: item.name,
        status: item.status,
        quality: 100,
      };
    });

  const tableColumns = [
    {
      title: (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Sprint / Periodo
        </span>
      ),
      dataIndex: 'period',
      key: 'period',
    },
    {
      title: (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Funcionalidad
        </span>
      ),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Estado
        </span>
      ),
      dataIndex: 'status',
      key: 'status',
      render: (status: TestStatus) => (
        <Tag className="rounded-full px-3" style={softTagStyle(functionalityStatusColors[status])}>
          {status}
        </Tag>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Calidad
        </span>
      ),
      key: 'quality',
      render: (_: unknown, record: { status: TestStatus; quality: number }) => (
        <div className="flex items-center gap-2">
          {record.status === TestStatus.COMPLETED ? (
            <CheckCircleFilled style={{ color: qaPalette.functionalityStatus.completed }} />
          ) : (
            <ThunderboltOutlined style={{ color: qaPalette.primary }} />
          )}
          <span className="font-medium">{record.quality}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-1">
        <Title level={2} className="m-0 font-bold text-slate-800">
          Dashboard
        </Title>
        <Text type="secondary" className="text-slate-500">
          Monitoreo del estado de calidad, cobertura y ciclos del proyecto.
        </Text>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <SafetyCertificateOutlined style={{ color: qaPalette.functionalityStatus.completed }} />
          <span>KPIs de calidad</span>
        </div>

        <Row gutter={[20, 20]}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Estabilidad regresion"
              value={`${regressionStability.toFixed(1)}%`}
              hint="Tasa de exito en ciclos"
              accent={qaPalette.primary}
              icon={<HistoryOutlined className="text-lg" style={{ color: qaPalette.primary }} />}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Cobertura de casos"
              value={`${testCaseCoverage.toFixed(1)}%`}
              hint={`${funcsWithTestCases} de ${totalFunctionalities} funcionalidades`}
              accent={qaPalette.functionalityStatus.completed}
              icon={
                <FileSearchOutlined
                  className="text-lg"
                  style={{ color: qaPalette.functionalityStatus.completed }}
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Bugs detectados"
              value={totalBugs}
              hint={`${criticalBugs} criticos`}
              accent={qaPalette.functionalityStatus.failed}
              icon={
                <BugOutlined
                  className="text-lg"
                  style={{ color: qaPalette.functionalityStatus.failed }}
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Automatizacion"
              value={`${automationCoverage}%`}
              hint={`${automatedTests} de ${testCases.length} casos`}
              accent={qaPalette.functionalityStatus.postMvp}
              icon={
                <ThunderboltOutlined
                  className="text-lg"
                  style={{ color: qaPalette.functionalityStatus.postMvp }}
                />
              }
            />
          </Col>
        </Row>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <BarChartOutlined style={{ color: qaPalette.primary }} />
          <span>Estatus de desarrollo</span>
        </div>

        <Row gutter={[20, 20]}>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="Backlog"
              value={backlogFuncs}
              percent={totalFunctionalities > 0 ? (backlogFuncs / totalFunctionalities) * 100 : 0}
              accent={qaPalette.functionalityStatus.backlog}
              icon={<DatabaseFilled className="mr-2 text-slate-400" />}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="En desarrollo"
              value={inProgressFuncs}
              percent={
                totalFunctionalities > 0 ? (inProgressFuncs / totalFunctionalities) * 100 : 0
              }
              accent={qaPalette.functionalityStatus.inProgress}
              icon={
                <ThunderboltOutlined
                  className="mr-2"
                  style={{ color: qaPalette.functionalityStatus.inProgress }}
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="Completadas"
              value={completedFuncs}
              percent={totalFunctionalities > 0 ? (completedFuncs / totalFunctionalities) * 100 : 0}
              accent={qaPalette.functionalityStatus.completed}
              icon={
                <CheckCircleFilled
                  className="mr-2"
                  style={{ color: qaPalette.functionalityStatus.completed }}
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              title="MVP"
              value={mvpFuncs}
              percent={totalFunctionalities > 0 ? (mvpFuncs / totalFunctionalities) * 100 : 0}
              accent={qaPalette.functionalityStatus.inProgress}
              icon={
                <SafetyCertificateOutlined
                  className="mr-2"
                  style={{ color: qaPalette.functionalityStatus.inProgress }}
                />
              }
            />
          </Col>
        </Row>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card variant="borderless" className="h-full rounded-2xl qa-surface-card">
            <div className="mb-6 flex items-center gap-2 font-semibold text-slate-800">
              <HistoryOutlined style={{ color: qaPalette.primary }} />
              <span>Pruebas de regresion</span>
            </div>
            <div className="flex flex-col items-center justify-between gap-6 py-4 sm:flex-row">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <FixedPie data={regressionPieData} innerRadius={55} outerRadius={75} />
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold">{regressionPercent}%</span>
                </div>
              </div>
              <div className="space-y-3">
                {regressionPieData.map(item => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-600">
                      {item.name}: <span className="font-bold text-slate-800">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card variant="borderless" className="h-full rounded-2xl qa-surface-card">
            <div className="mb-6 flex items-center gap-2 font-semibold text-slate-800">
              <ThunderboltOutlined style={{ color: qaPalette.functionalityStatus.inProgress }} />
              <span>Pruebas de humo</span>
            </div>
            <div className="flex flex-col items-center justify-between gap-6 py-4 sm:flex-row">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <FixedPie data={smokePieData} innerRadius={55} outerRadius={75} />
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold">{smokePercent}%</span>
                </div>
              </div>
              <div className="space-y-3">
                {smokePieData.map(item => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-slate-600">
                      {item.name}: <span className="font-bold text-slate-800">{item.value}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card variant="borderless" className="h-full rounded-2xl qa-surface-card text-center">
            <div className="mb-4 font-semibold text-slate-800">Ejecutados vs no ejecutados</div>
            <div className="relative flex h-48 items-center justify-center">
              <FixedPie data={executionMixData} innerRadius={50} outerRadius={70} />
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold">
                  {totalFunctionalities > 0
                    ? Math.round(((completedFuncs + failedFuncs) / totalFunctionalities) * 100)
                    : 0}
                  %
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">Ejecucion</span>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card variant="borderless" className="h-full rounded-2xl qa-surface-card text-center">
            <div className="mb-4 font-semibold text-slate-800">Aprobados vs fallidos</div>
            <div className="flex h-48 items-end justify-around pb-4">
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-bold uppercase text-slate-400">Passed</div>
                <div
                  className="w-12 rounded-t-lg"
                  style={{
                    backgroundColor: qaPalette.functionalityStatus.completed,
                    height: `${totalFunctionalities > 0 ? (completedFuncs / totalFunctionalities) * 100 : 0}%`,
                    minHeight: '4px',
                  }}
                />
              </div>
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-bold uppercase text-slate-400">Failed</div>
                <div
                  className="w-12 rounded-t-lg"
                  style={{
                    backgroundColor: qaPalette.functionalityStatus.failed,
                    height: `${totalFunctionalities > 0 ? (failedFuncs / totalFunctionalities) * 100 : 0}%`,
                    minHeight: '4px',
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card variant="borderless" className="h-full rounded-2xl qa-surface-card text-center">
            <div className="mb-4 font-semibold text-slate-800">Sanity vs funcional</div>
            <div className="relative flex h-48 items-center justify-center">
              <FixedPie data={sanityMixData} innerRadius={50} outerRadius={70} />
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold">
                  {sanityMixData[0].value} / {sanityMixData[1].value}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">Distribucion</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title="Funcionalidades entregadas por periodos"
            variant="borderless"
            className="rounded-2xl qa-surface-card"
          >
            <Table
              columns={tableColumns}
              dataSource={tableData}
              pagination={false}
              className="executive-table"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span className="font-bold text-slate-800">Funcionalidades por modulos</span>}
            variant="borderless"
            className="h-full rounded-2xl qa-surface-card"
          >
            <div className="space-y-4">
              {moduleData.length > 0 ? (
                moduleData.slice(0, 3).map(item => {
                  const accent = getModuleAccent(item.name);
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border p-4"
                      style={{
                        backgroundColor: softSurface(accent),
                        borderColor: softSurface(accent),
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                          {getModuleIcon(item.name)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-xs" style={{ color: accent }}>
                            {item.percent}%
                          </div>
                        </div>
                      </div>
                      <div
                        className="rounded-lg px-3 py-1 text-sm font-bold text-slate-800"
                        style={{ backgroundColor: softSurface(accent) }}
                      >
                        {item.count}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center italic text-slate-400">
                  No hay datos de modulos
                </div>
              )}

              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>System uptime</span>
                  <span className="text-slate-800">99.98%</span>
                </div>
                <Progress
                  percent={99.98}
                  showInfo={false}
                  strokeColor={qaPalette.functionalityStatus.completed}
                  railColor={qaPalette.border}
                  size={{ height: 8 }}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <div className="py-4 text-center text-xs text-slate-400">QA Enterprise Division 2024</div>
    </div>
  );
}
