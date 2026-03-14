import React, { useMemo } from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Progress,
  Table,
  Tag,
  Space,
  Button,
  Divider,
  Statistic,
  Badge,
  Tooltip,
  Empty,
} from 'antd';
import {
  FileWordOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  AlertOutlined,
  DashboardOutlined,
  PieChartOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useProjects } from '../modules/projects/hooks/useProjects';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useRegressionCycles } from '../modules/test-cycles/hooks/useRegressionCycles';
import { useSmokeCycles } from '../modules/test-cycles/hooks/useSmokeCycles';
import { useExecutions } from '../modules/test-runs/hooks/useExecutions';
import { TestResult, Priority, RiskLevel, TestStatus, TestType } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import * as XLSX from 'xlsx';

const { Title, Text, Paragraph } = Typography;

interface ProjectProgressReportProps {
  projectId: string;
}

export default function ProjectProgressReport({ projectId }: ProjectProgressReportProps) {
  const { data: projects = [] } = useProjects();
  const project = projects.find(p => p.id === projectId);

  const { data: functionalities = [] } = useFunctionalities(projectId);
  const { data: testCases = [] } = useTestCases(projectId);
  const { data: executions = [] } = useExecutions(projectId);
  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  const { data: smokeCycles = [] } = useSmokeCycles(projectId);

  const stats = useMemo(() => {
    const totalFuncs = functionalities.length;
    const completedFuncs = functionalities.filter(f => f.status === TestStatus.COMPLETED).length;
    const testingFuncs = functionalities.filter(f => f.status === TestStatus.IN_PROGRESS).length;

    const totalTests = testCases.length;
    // Calculate from executions
    const lastExecutions = new Map();
    executions.forEach(ex => {
      if (ex.testCaseId) {
        const existing = lastExecutions.get(ex.testCaseId);
        if (!existing || new Date(ex.executionDate) > new Date(existing.executionDate)) {
          lastExecutions.set(ex.testCaseId, ex);
        }
      }
    });

    const executedTests = lastExecutions.size;
    const passedTests = Array.from(lastExecutions.values()).filter(
      ex => ex.result === TestResult.PASSED,
    ).length;
    const failedTests = Array.from(lastExecutions.values()).filter(
      ex => ex.result === TestResult.FAILED,
    ).length;

    const bugsCount = [...regressionCycles, ...smokeCycles].reduce(
      (acc, c) => acc + (c.executions || []).filter(ex => ex.bugId).length,
      0,
    );

    const highRiskFuncs = functionalities.filter(f => f.riskLevel === RiskLevel.HIGH).length;

    return {
      totalFuncs,
      completedFuncs,
      testingFuncs,
      funcProgress: totalFuncs > 0 ? Math.round((completedFuncs / totalFuncs) * 100) : 0,
      totalTests,
      executedTests,
      testProgress: totalTests > 0 ? Math.round((executedTests / totalTests) * 100) : 0,
      passRate: executedTests > 0 ? Math.round((passedTests / executedTests) * 100) : 0,
      bugsCount,
      highRiskFuncs,
      failedTests,
    };
  }, [functionalities, testCases, regressionCycles, smokeCycles]);

  const statusData = [
    { name: 'Completadas', value: stats.completedFuncs, color: '#10b981' },
    { name: 'En Pruebas', value: stats.testingFuncs, color: '#8b5cf6' },
    {
      name: 'Otras',
      value: stats.totalFuncs - stats.completedFuncs - stats.testingFuncs,
      color: '#cbd5e1',
    },
  ];

  const exportToExcel = () => {
    const data = [
      ['Reporte de Progreso del Proyecto', project?.name || ''],
      ['Fecha', new Date().toLocaleDateString()],
      [],
      ['Métrica', 'Valor'],
      ['Total Funcionalidades', stats.totalFuncs],
      ['Funcionalidades Completadas', stats.completedFuncs],
      ['Progreso Funcional', `${stats.funcProgress}%`],
      ['Total Casos de Prueba', stats.totalTests],
      ['Casos Ejecutados', stats.executedTests],
      ['Tasa de Aprobación', `${stats.passRate}%`],
      ['Bugs Encontrados', stats.bugsCount],
      ['Funcionalidades de Alto Riesgo', stats.highRiskFuncs],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen de Progreso');
    XLSX.writeFile(wb, `Reporte_Progreso_${project?.name || 'QA'}.xlsx`);
  };

  if (!project) return <Empty description="Proyecto no encontrado" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} className="!mb-1">
            Reporte de Progreso
          </Title>
          <Paragraph type="secondary">
            Resumen ejecutivo del estado de calidad y avance del proyecto.
          </Paragraph>
        </div>
        <Space>
          <Button icon={<FileWordOutlined />} className="rounded-xl h-11 border-slate-200">
            Exportar Word
          </Button>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={exportToExcel}
            className="rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 border-none"
          >
            Exportar Excel
          </Button>
        </Space>
      </div>

      {/* High Level Metrics */}
      <Row gutter={20}>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <Statistic
              title={
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  Progreso Funcional
                </Text>
              }
              value={stats.funcProgress}
              suffix="%"
              prefix={<DashboardOutlined className="text-blue-500 mr-2" />}
              valueStyle={{ color: '#1e293b', fontWeight: 800 }}
            />
            <Progress
              percent={stats.funcProgress}
              size="small"
              strokeColor="#3b82f6"
              className="mt-2"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <Statistic
              title={
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  QA Coverage
                </Text>
              }
              value={stats.testProgress}
              suffix="%"
              prefix={<SafetyCertificateOutlined className="text-emerald-500 mr-2" />}
              valueStyle={{ color: '#1e293b', fontWeight: 800 }}
            />
            <Progress
              percent={stats.testProgress}
              size="small"
              strokeColor="#10b981"
              className="mt-2"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <Statistic
              title={
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  Tasa de Éxito
                </Text>
              }
              value={stats.passRate}
              suffix="%"
              prefix={<CheckCircleOutlined className="text-emerald-500 mr-2" />}
              valueStyle={{ color: '#1e293b', fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              {stats.executedTests} ejecutados de {stats.totalTests}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <Statistic
              title={
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  Bugs Totales
                </Text>
              }
              value={stats.bugsCount}
              prefix={<BugOutlined className="text-rose-500 mr-2" />}
              valueStyle={{ color: '#e11d48', fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">
              {stats.failedTests} casos fallidos en total
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={20}>
        <Col span={12}>
          <Card
            className="rounded-3xl border-slate-100 shadow-sm h-full"
            title={
              <div className="flex items-center gap-2">
                <PieChartOutlined className="text-blue-500" />{' '}
                <span className="font-bold">Estado de Funcionalidades</span>
              </div>
            }
          >
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            className="rounded-3xl border-slate-100 shadow-sm h-full"
            title={
              <div className="flex items-center gap-2">
                <AlertOutlined className="text-rose-500" />{' '}
                <span className="font-bold">Indicadores de Riesgo</span>
              </div>
            }
          >
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <AlertOutlined className="text-rose-500" />
                  </div>
                  <div>
                    <div className="font-bold text-rose-900">Funcionalidades Críticas</div>
                    <div className="text-xs text-rose-700">Requieren atención inmediata</div>
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-600">{stats.highRiskFuncs}</div>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <CloseCircleOutlined className="text-amber-500" />
                  </div>
                  <div>
                    <div className="font-bold text-amber-900">Casos Fallidos</div>
                    <div className="text-xs text-amber-700">Bloqueos potenciales en el flujo</div>
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600">{stats.failedTests}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">
                    Cobertura de Automatización
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {testCases.length > 0
                      ? Math.round(
                          (testCases.filter(tc => tc.testType === TestType.SANITY).length /
                            testCases.length) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  percent={
                    testCases.length > 0
                      ? Math.round(
                          (testCases.filter(tc => tc.testType === TestType.SANITY).length /
                            testCases.length) *
                            100,
                        )
                      : 0
                  }
                  strokeColor="#8b5cf6"
                  size="small"
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Summary Table */}
      <Card
        className="rounded-3xl border-slate-100 shadow-sm overflow-hidden"
        title={<span className="font-bold">Detalle de Cobertura por Módulo</span>}
      >
        <Table
          dataSource={Array.from(new Set(functionalities.map(f => f.module))).map(module => {
            const moduleFuncs = functionalities.filter(f => f.module === module);
            const completed = moduleFuncs.filter(f => f.status === TestStatus.COMPLETED).length;
            return {
              module,
              total: moduleFuncs.length,
              completed,
              progress: Math.round((completed / moduleFuncs.length) * 100),
            };
          })}
          columns={[
            {
              title: 'Módulo',
              dataIndex: 'module',
              key: 'module',
              render: t => <Text strong>{t}</Text>,
            },
            { title: 'Total Funcionalidades', dataIndex: 'total', key: 'total', align: 'center' },
            { title: 'Completadas', dataIndex: 'completed', key: 'completed', align: 'center' },
            {
              title: 'Progreso',
              dataIndex: 'progress',
              key: 'progress',
              render: p => (
                <Progress
                  percent={p}
                  size="small"
                  strokeColor={p === 100 ? '#10b981' : '#3b82f6'}
                />
              ),
            },
          ]}
          pagination={false}
          className="executive-table"
        />
      </Card>
    </div>
  );
}
