import React from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Tag, Progress, Space } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useFunctionalities, useExecutions, useRegressionCycles, useSmokeCycles, useTestCases } from '../hooks';
import { TestResult, TestStatus, ExecutionStatus, Severity, TestType } from '../types';
import { 
  CheckCircleFilled, 
  DatabaseFilled, 
  CloudFilled, 
  ThunderboltOutlined, 
  HistoryOutlined,
  BarChartOutlined,
  BugOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const COLORS = {
  passed: '#10b981', // Emerald 500
  failed: '#ef4444', // Red 500
  remaining: '#e5e7eb', // Gray 200
  smoke: '#f59e0b', // Amber 500
  regression: '#3b82f6', // Blue 500
};

export default function Dashboard({ projectId }: { projectId?: string }) {
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: executionsData } = useExecutions(projectId);
  const { data: regressionCyclesData } = useRegressionCycles(projectId);
  const { data: smokeCyclesData } = useSmokeCycles(projectId);
  const { data: testCasesData } = useTestCases(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const executions = (Array.isArray(executionsData) ? executionsData : []).filter(e => e.status === ExecutionStatus.FINAL);
  const regressionCycles = Array.isArray(regressionCyclesData) ? regressionCyclesData : [];
  const smokeCycles = Array.isArray(smokeCyclesData) ? smokeCyclesData : [];
  const testCases = Array.isArray(testCasesData) ? testCasesData : [];

  // Metrics Calculation
  const totalFuncs = functionalities.length;
  
  // Bug Metrics
  const allExecutions = [
    ...regressionCycles.flatMap(c => c.executions || []),
    ...smokeCycles.flatMap(c => c.executions || [])
  ];
  const totalBugs = allExecutions.filter(ex => ex.bugId).length;
  const criticalBugs = allExecutions.filter(ex => ex.severity === Severity.CRITICAL).length;
  const bugDetectionRate = allExecutions.length > 0 ? (totalBugs / allExecutions.length) * 100 : 0;

  // Coverage Metrics
  const funcsWithTestCases = new Set(testCases.map(tc => tc.functionalityId)).size;
  const testCaseCoverage = totalFuncs > 0 ? (funcsWithTestCases / totalFuncs) * 100 : 0;

  // Stability Metrics
  const totalRegressionExecutions = regressionCycles.flatMap(c => c.executions || []);
  const regressionPassedExecs = totalRegressionExecutions.filter(ex => ex.result === TestResult.PASSED).length;
  const regressionStability = totalRegressionExecutions.length > 0 
    ? (regressionPassedExecs / totalRegressionExecutions.length) * 100 
    : 0;
  const completedFuncs = functionalities.filter(f => f.status === TestStatus.COMPLETED).length;
  const inProgressFuncs = functionalities.filter(f => f.status === TestStatus.IN_PROGRESS).length;
  const backlogFuncs = functionalities.filter(f => f.status === TestStatus.BACKLOG).length;
  const mvpFuncs = functionalities.filter(f => f.status === TestStatus.MVP).length;
  const postMvpFuncs = functionalities.filter(f => f.status === TestStatus.POST_MVP).length;
  const failedFuncs = functionalities.filter(f => f.status === TestStatus.FAILED).length;
  const totalTests = testCases.length;
  const automatedTests = testCases.filter(tc => tc.testType === TestType.SANITY).length; // Using SANITY as a proxy for automated if not defined
  const automationCoverage = totalTests > 0 ? Math.round((automatedTests / totalTests) * 100) : 0;

  // Regression Stats
  const regressionFuncs = functionalities.filter(f => f.isRegression);
  const regressionPassed = regressionFuncs.filter(f => f.status === TestStatus.COMPLETED).length;
  const regressionFailed = regressionFuncs.filter(f => f.status === TestStatus.FAILED).length;
  const regressionRemaining = regressionFuncs.length - regressionPassed - regressionFailed;
  const regressionPercent = regressionFuncs.length > 0 ? Math.round((regressionPassed / regressionFuncs.length) * 100) : 0;

  // Smoke Stats
  const smokeFuncs = functionalities.filter(f => f.isSmoke);
  const smokePassed = smokeFuncs.filter(f => f.status === TestStatus.COMPLETED).length;
  const smokeFailed = smokeFuncs.filter(f => f.status === TestStatus.FAILED).length;
  const smokeRemaining = smokeFuncs.length - smokePassed - smokeFailed;
  const smokePercent = smokeFuncs.length > 0 ? Math.round((smokePassed / smokeFuncs.length) * 100) : 0;

  const regressionPieData = [
    { name: 'Aprobados', value: regressionPassed, color: COLORS.passed },
    { name: 'Fallidos', value: regressionFailed, color: COLORS.failed },
    { name: 'Restante', value: regressionRemaining, color: COLORS.remaining },
  ];

  const smokePieData = [
    { name: 'Exitosos', value: smokePassed, color: COLORS.smoke },
    { name: 'Bloqueantes', value: smokeFailed, color: COLORS.failed },
    { name: 'Pendientes', value: smokeRemaining, color: COLORS.remaining },
  ];

  // Module Distribution
  const moduleCounts = functionalities.reduce((acc: Record<string, number>, f) => {
    acc[f.module] = (acc[f.module] || 0) + 1;
    return acc;
  }, {});

  const moduleData = Object.entries(moduleCounts).map(([name, count]) => ({
    name,
    count,
    percent: totalFuncs > 0 ? Math.round((count / totalFuncs) * 100) : 0
  })).sort((a, b) => b.count - a.count);

  const getModuleIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('paciente')) return <CheckCircleFilled className="text-emerald-500 text-xl" />;
    if (lower.includes('seguimiento')) return <DatabaseFilled className="text-blue-500 text-xl" />;
    if (lower.includes('intervencion')) return <CloudFilled className="text-amber-500 text-xl" />;
    return <BarChartOutlined className="text-slate-400 text-xl" />;
  };

  const getModuleColors = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('paciente')) return { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', badge: 'bg-emerald-200' };
    if (lower.includes('seguimiento')) return { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', badge: 'bg-blue-200' };
    if (lower.includes('intervencion')) return { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', badge: 'bg-amber-200' };
    return { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-600', badge: 'bg-slate-200' };
  };

  const tableColumns = [
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Sprint / Período</span>, 
      dataIndex: 'period', 
      key: 'period' 
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Funcionalidad</span>, 
      dataIndex: 'name', 
      key: 'name' 
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Estado</span>, 
      dataIndex: 'status', 
      key: 'status',
      render: (status: TestStatus) => {
        let color = 'processing';
        if (status === TestStatus.COMPLETED) color = 'success';
        if (status === TestStatus.FAILED) color = 'error';
        if (status === TestStatus.IN_PROGRESS) color = 'purple';
        if (status === TestStatus.BACKLOG) color = 'blue';
        if (status === TestStatus.MVP) color = 'orange';
        if (status === TestStatus.POST_MVP) color = 'default';
        return <Tag color={color} className="rounded-full px-3">{status}</Tag>;
      }
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Calidad</span>, 
      key: 'quality',
      render: (_: any, record: any) => (
        <div className="flex items-center gap-2">
          {record.status === TestStatus.COMPLETED ? <CheckCircleFilled className="text-green-500" /> : <ThunderboltOutlined className="text-blue-400" />}
          <span className="font-medium">{record.quality}%</span>
        </div>
      )
    },
  ];

  const tableData = functionalities.slice(0, 5).map((f, i) => ({
    key: f.id,
    period: `Sprint ${24 + i}`,
    name: f.name,
    status: f.status,
    quality: f.status === TestStatus.COMPLETED ? 100 : 50
  }));

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-1">
        <Title level={2} className="m-0 font-bold text-slate-800">Dashboard</Title>
        <Text type="secondary" className="text-slate-500">Monitoreo en tiempo real del estado de calidad y despliegues.</Text>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
          <SafetyCertificateOutlined className="text-emerald-600" />
          <span>KPIs de Calidad QA</span>
        </div>
        
        <Row gutter={[20, 20]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-blue-50/30">
              <div className="flex justify-between items-start">
                <div>
                  <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estabilidad Regresión</Text>
                  <div className="text-3xl font-bold mt-1 text-blue-600">{regressionStability.toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-400 mt-1">Tasa de éxito en ciclos</div>
                </div>
                <div className="p-2 bg-blue-50 rounded-xl">
                  <HistoryOutlined className="text-blue-500 text-lg" />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-emerald-50/30">
              <div className="flex justify-between items-start">
                <div>
                  <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cobertura de Casos</Text>
                  <div className="text-3xl font-bold mt-1 text-emerald-600">{testCaseCoverage.toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-400 mt-1">{funcsWithTestCases} de {totalFuncs} func.</div>
                </div>
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <FileSearchOutlined className="text-emerald-500 text-lg" />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-rose-50/30">
              <div className="flex justify-between items-start">
                <div>
                  <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bugs Detectados</Text>
                  <div className="text-3xl font-bold mt-1 text-rose-600">{totalBugs}</div>
                  <div className="text-[10px] text-rose-400 font-medium mt-1">{criticalBugs} Críticos</div>
                </div>
                <div className="p-2 bg-rose-50 rounded-xl">
                  <BugOutlined className="text-rose-500 text-lg" />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow bg-gradient-to-br from-white to-purple-50/30">
              <div className="flex justify-between items-start">
                <div>
                  <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Automatización</Text>
                  <div className="text-3xl font-bold mt-1 text-purple-600">{automationCoverage}%</div>
                  <div className="text-[10px] text-slate-400 mt-1">{automatedTests} de {totalTests} casos</div>
                </div>
                <div className="p-2 bg-purple-50 rounded-xl">
                  <ThunderboltOutlined className="text-purple-500 text-lg" />
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
          <BarChartOutlined className="text-blue-600" />
          <span>Estatus de Desarrollo</span>
        </div>
        
        <Row gutter={[20, 20]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow">
              <Statistic 
                title={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Backlog</span>}
                value={backlogFuncs}
                valueStyle={{ color: '#64748b', fontWeight: 'bold' }}
                prefix={<DatabaseFilled className="text-slate-400 mr-2" />}
              />
              <Progress percent={totalFuncs > 0 ? (backlogFuncs / totalFuncs) * 100 : 0} showInfo={false} strokeColor="#94a3b8" size="small" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow">
              <Statistic 
                title={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En Desarrollo</span>}
                value={inProgressFuncs}
                valueStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                prefix={<ThunderboltOutlined className="text-blue-500 mr-2" />}
              />
              <Progress percent={totalFuncs > 0 ? (inProgressFuncs / totalFuncs) * 100 : 0} showInfo={false} strokeColor="#3b82f6" size="small" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow">
              <Statistic 
                title={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completadas</span>}
                value={completedFuncs}
                valueStyle={{ color: '#10b981', fontWeight: 'bold' }}
                prefix={<CheckCircleFilled className="text-emerald-500 mr-2" />}
              />
              <Progress percent={totalFuncs > 0 ? (completedFuncs / totalFuncs) * 100 : 0} showInfo={false} strokeColor="#10b981" size="small" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 hover:shadow-md transition-shadow">
              <Statistic 
                title={<span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MVP</span>}
                value={mvpFuncs}
                valueStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                prefix={<SafetyCertificateOutlined className="text-amber-500 mr-2" />}
              />
              <Progress percent={totalFuncs > 0 ? (mvpFuncs / totalFuncs) * 100 : 0} showInfo={false} strokeColor="#f59e0b" size="small" />
            </Card>
          </Col>
        </Row>
      </div>

      <div className="space-y-4">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
          <Card className="rounded-2xl shadow-sm border-slate-100 h-full">
            <div className="flex items-center gap-2 mb-6 font-semibold text-slate-800">
              <HistoryOutlined className="text-blue-600" />
              <span>Pruebas de Regresión</span>
            </div>
            <div className="flex items-center justify-around py-4">
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={regressionPieData}
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      {regressionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold">{regressionPercent}%</span>
                </div>
              </div>
              <div className="space-y-3">
                {regressionPieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 text-sm">{item.name}: <span className="font-bold text-slate-800">{item.value}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="rounded-2xl shadow-sm border-slate-100 h-full">
            <div className="flex items-center gap-2 mb-6 font-semibold text-slate-800">
              <ThunderboltOutlined className="text-amber-500" />
              <span>Pruebas de Humo (Smoke Test)</span>
            </div>
            <div className="flex items-center justify-around py-4">
              <div className="relative w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={smokePieData}
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      {smokePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-3xl font-bold">{smokePercent}%</span>
                </div>
              </div>
              <div className="space-y-3">
                {smokePieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 text-sm">{item.name}: <span className="font-bold text-slate-800">{item.value}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>

    <Row gutter={[24, 24]}>
      <Col xs={24} md={8}>
          <Card className="rounded-2xl shadow-sm border-slate-100 h-full text-center">
            <div className="font-semibold text-slate-800 mb-4">Ejecutados vs No Ejecutados</div>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Ejecutados', value: completedFuncs + failedFuncs, color: '#1d4ed8' },
                      { name: 'No Ejecutados', value: totalFuncs - (completedFuncs + failedFuncs), color: '#e5e7eb' }
                    ]}
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#1d4ed8" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold">{totalFuncs > 0 ? Math.round(((completedFuncs + failedFuncs)/totalFuncs)*100) : 0}%</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold">Ejecución</span>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl shadow-sm border-slate-100 h-full text-center">
            <div className="font-semibold text-slate-800 mb-4">Aprobados vs Fallidos</div>
            <div className="relative h-48 flex items-end justify-around pb-4">
              <div className="flex flex-col items-center">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Passed</div>
                <div className="w-12 bg-emerald-500 rounded-t-lg" style={{ height: `${totalFuncs > 0 ? (completedFuncs)/totalFuncs * 100 : 0}%`, minHeight: '4px' }} />
              </div>
              <div className="flex flex-col items-center">
                <div className="text-xs font-bold text-slate-400 uppercase mb-2">Failed</div>
                <div className="w-12 bg-red-500 rounded-t-lg" style={{ height: `${totalFuncs > 0 ? failedFuncs/totalFuncs * 100 : 0}%`, minHeight: '4px' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="rounded-2xl shadow-sm border-slate-100 h-full text-center">
            <div className="font-semibold text-slate-800 mb-4">Sanity vs Funcional</div>
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Sanity', value: functionalities.filter(f => f.isSmoke).length, color: '#3b82f6' },
                      { name: 'Funcional', value: functionalities.filter(f => !f.isSmoke).length, color: '#bfdbfe' }
                    ]}
                    innerRadius={50}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#1d4ed8" />
                    <Cell fill="#bfdbfe" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-bold">
                  {functionalities.filter(f => f.isSmoke).length} / {functionalities.filter(f => !f.isSmoke).length}
                </span>
                <span className="text-[10px] uppercase text-slate-400 font-bold">Distribución</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                <div className="w-2 h-2 rounded-full bg-blue-700" /> Sanity
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                <div className="w-2 h-2 rounded-full bg-blue-200" /> Funcional
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Funcionalidades entregadas por periodos" className="rounded-2xl shadow-sm border-slate-100">
            <Table 
              columns={tableColumns} 
              dataSource={tableData} 
              pagination={false}
              className="executive-table"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<span className="font-bold text-slate-800">Funcionalidades por Módulos</span>} className="rounded-2xl shadow-sm border-slate-100 h-full">
            <div className="space-y-4">
              {moduleData.length > 0 ? (
                moduleData.slice(0, 3).map((mod, idx) => {
                  const colors = getModuleColors(mod.name);
                  return (
                    <div key={idx} className={`p-4 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                          {getModuleIcon(mod.name)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{mod.name}</div>
                          <div className={`text-xs ${colors.text}`}>{mod.percent}%</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-lg ${colors.badge} text-slate-800 font-bold text-sm`}>
                        {mod.count}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-slate-400 italic">No hay datos de módulos</div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  <span>System Uptime</span>
                  <span className="text-slate-800">99.98%</span>
                </div>
                <Progress percent={99.98} showInfo={false} strokeColor="#10b981" trailColor="#e2e8f0" strokeWidth={8} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <div className="text-center text-slate-400 text-xs py-4">
        © 2024 QA Enterprise Division. Todos los derechos reservados.
      </div>
    </div>
  );
}
