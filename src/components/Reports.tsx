import React, { useState, useMemo } from 'react';
import { 
  Card, 
  Typography, 
  Row, 
  Col, 
  Button, 
  Select, 
  Space, 
  Tag, 
  Divider, 
  Empty, 
  Statistic, 
  Progress, 
  Table, 
  Badge,
  Tooltip,
  message
} from 'antd';
import { 
  FileTextOutlined, 
  LineChartOutlined, 
  ProjectOutlined, 
  CheckCircleFilled,
  ArrowLeftOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  BugOutlined,
  SafetyCertificateOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  FilterOutlined,
  ExportOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  AlertOutlined
} from '@ant-design/icons';
import { 
  useRegressionCycles, 
  useSmokeCycles, 
  useFunctionalities, 
  useTestCases, 
  useExecutions,
  useSprints
} from '../hooks';
import { 
  TestResult, 
  RiskLevel, 
  TestStatus, 
  TestType,
  RegressionCycle
} from '../types';
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
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import dayjs from 'dayjs';
import { exportToPdf } from '../utils/reportUtils';

const { Title, Text, Paragraph } = Typography;

type ReportVariant = 'QA_STATUS_SUMMARY' | 'QA_PROGRESS_REPORT' | 'PROJECT_STATUS_REPORT';

interface SelectionCardProps {
  type: ReportVariant;
  title: string;
  description: string;
  format: string;
  selected: boolean;
  onSelect: (type: ReportVariant) => void;
  icon: React.ReactNode;
}

const SelectionCard: React.FC<SelectionCardProps> = ({ type, title, description, format, selected, onSelect, icon }) => (
  <Card 
    hoverable 
    className={`relative overflow-hidden transition-all duration-300 border-2 ${selected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100'}`}
    onClick={() => onSelect(type)}
  >
    {selected && (
      <div className="absolute top-3 right-3 text-blue-500 text-xl">
        <CheckCircleFilled />
      </div>
    )}
    <div className="flex flex-col gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${selected ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
        {icon}
      </div>
      <div>
        <Title level={5} className="!mb-1">{title}</Title>
        <Paragraph type="secondary" className="text-xs !mb-3 line-clamp-2">{description}</Paragraph>
        <Tag color={selected ? 'blue' : 'default'} className="rounded-full px-3 border-none font-medium">
          {format}
        </Tag>
      </div>
    </div>
  </Card>
);

// --- Variant 1: QA Status Summary ---
const QAStatusSummary: React.FC<{ projectId: string, cycle: RegressionCycle | null }> = ({ projectId, cycle }) => {
  if (!cycle) return <Empty description="Seleccione un ciclo para ver el reporte" />;

  const pieData = [
    { name: 'Aprobados', value: cycle.passed, color: '#10b981' },
    { name: 'Fallidos', value: cycle.failed, color: '#ef4444' },
    { name: 'Pendientes', value: cycle.pending, color: '#f59e0b' },
  ];

  return (
    <div id="report-content" className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-start border-b border-slate-100 pb-6">
        <div>
          <Title level={3} className="!mb-1">Resumen de Estado QA</Title>
          <Space split={<Divider type="vertical" />}>
            <Text type="secondary"><CalendarOutlined /> {dayjs(cycle.date).format('DD MMM, YYYY')}</Text>
            <Text type="secondary"><Tag color="blue">{cycle.type}</Tag></Text>
            <Text type="secondary">Sprint: {cycle.sprint || 'N/A'}</Text>
          </Space>
        </div>
        <div className="text-right">
          <Text strong className="text-lg block">{cycle.cycleId}</Text>
          <Text type="secondary">ID de Ciclo</Text>
        </div>
      </div>

      <Row gutter={24}>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic 
              title="Tasa de Aprobación" 
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
              title="Total Pruebas" 
              value={cycle.totalTests} 
              valueStyle={{ fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">Ejecutadas en este ciclo</Text>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 bg-slate-50/50">
            <Statistic 
              title="Bugs Encontrados" 
              value={cycle.failed} 
              valueStyle={{ color: '#ef4444', fontWeight: 800 }}
            />
            <Text type="secondary" className="text-xs">Casos fallidos reportados</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="Distribución de Resultados" className="rounded-2xl border-slate-100 h-full">
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
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
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
          <Card title="Métricas de Calidad" className="rounded-2xl border-slate-100 h-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Text>Estabilidad del Sistema</Text>
                <Tag color="green">ALTA</Tag>
              </div>
              <Divider className="!my-2" />
              <div className="flex justify-between items-center">
                <Text>Riesgo de Regresión</Text>
                <Tag color="orange">MEDIO</Tag>
              </div>
              <Divider className="!my-2" />
              <div className="flex justify-between items-center">
                <Text>Cobertura Funcional</Text>
                <Text strong>{Math.round((cycle.passed / cycle.totalTests) * 100)}%</Text>
              </div>
              <Divider className="!my-2" />
              <div className="flex justify-between items-center">
                <Text>Tiempo de Ejecución</Text>
                <Text strong>4.5h</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Detalle de Ejecución" className="rounded-2xl border-slate-100 overflow-hidden">
        <Table 
          dataSource={cycle.executions}
          columns={[
            { title: 'Funcionalidad', dataIndex: 'functionalityName', key: 'name' },
            { title: 'Módulo', dataIndex: 'module', key: 'module' },
            { 
              title: 'Resultado', 
              dataIndex: 'result', 
              key: 'result',
              render: (res) => (
                <Tag color={res === TestResult.PASSED ? 'green' : res === TestResult.FAILED ? 'red' : 'orange'}>
                  {res}
                </Tag>
              )
            },
            { title: 'Bug ID', dataIndex: 'bugId', key: 'bugId', render: (id) => id || '-' }
          ]}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

// --- Variant 2: QA Progress Report ---
const QAProgressReport: React.FC<{ projectId: string, sprint: string | null }> = ({ projectId, sprint }) => {
  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  
  const chartData = useMemo(() => {
    const filtered = sprint 
      ? regressionCycles.filter(c => c.sprint === sprint)
      : regressionCycles.slice(-5);
      
    return filtered.map(c => ({
      name: c.cycleId,
      passRate: c.passRate,
      total: c.totalTests
    }));
  }, [regressionCycles, sprint]);

  return (
    <div id="report-content" className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
      <div className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <Title level={3} className="!mb-1">Reporte de Progreso QA</Title>
          <Paragraph type="secondary">Tendencia de calidad y evolución de las pruebas{sprint ? ` en ${sprint}` : ' en los últimos ciclos'}.</Paragraph>
        </div>
        {sprint && <Tag color="blue" className="mb-6 rounded-full px-4 py-1 font-bold">{sprint}</Tag>}
      </div>

      <Card title="Tendencia de Tasa de Aprobación (%)" className="rounded-2xl border-slate-100">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPass" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
              <RechartsTooltip />
              <Area type="monotone" dataKey="passRate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPass)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Row gutter={24}>
        <Col span={12}>
          <Card title="Métricas de Evolución" className="rounded-2xl border-slate-100">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Crecimiento de Casos de Prueba</Text>
                  <Text type="success">+15%</Text>
                </div>
                <Progress percent={85} strokeColor="#8b5cf6" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Reducción de Deuda Técnica</Text>
                  <Text type="success">-10%</Text>
                </div>
                <Progress percent={45} strokeColor="#10b981" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Text strong>Velocidad de Ejecución</Text>
                  <Text type="warning">+5%</Text>
                </div>
                <Progress percent={60} strokeColor="#f59e0b" />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Hitos Recientes" className="rounded-2xl border-slate-100">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                  <CheckCircleOutlined />
                </div>
                <div>
                  <Text strong className="block">Certificación de Módulo de Pagos</Text>
                  <Text type="secondary" className="text-xs">Ciclo REG-004 completado con 100% éxito</Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <ThunderboltOutlined />
                </div>
                <div>
                  <Text strong className="block">Automatización de Smoke Tests</Text>
                  <Text type="secondary" className="text-xs">80% de cobertura alcanzada</Text>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <ClockCircleOutlined />
                </div>
                <div>
                  <Text strong className="block">Inicio de Pruebas de Carga</Text>
                  <Text type="secondary" className="text-xs">Planificación de Fase 2 en curso</Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// --- Variant 3: Project Status Report ---
const ProjectStatusReport: React.FC<{ projectId: string, sprint: string | null }> = ({ projectId, sprint }) => {
  const { data: functionalities = [] } = useFunctionalities(projectId);
  const { data: testCases = [] } = useTestCases(projectId);
  
  const stats = useMemo(() => {
    const filteredFuncs = sprint 
      ? functionalities.filter(f => f.sprint === sprint)
      : functionalities;
      
    const total = filteredFuncs.length;
    const completed = filteredFuncs.filter(f => f.status === TestStatus.COMPLETED).length;
    const highRisk = filteredFuncs.filter(f => f.riskLevel === RiskLevel.HIGH).length;
    
    // Filter test cases by functionality if sprint is selected
    const sprintFuncIds = new Set(filteredFuncs.map(f => f.id));
    const filteredTestCases = sprint 
      ? testCases.filter(tc => sprintFuncIds.has(tc.functionalityId))
      : testCases;

    return {
      total,
      completed,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      highRisk,
      testCasesCount: filteredTestCases.length
    };
  }, [functionalities, testCases, sprint]);

  const barData = [
    { name: 'Total', value: stats.total, fill: '#3b82f6' },
    { name: 'Completadas', value: stats.completed, fill: '#10b981' },
    { name: 'Críticas', value: stats.highRisk, fill: '#ef4444' },
  ];

  return (
    <div id="report-content" className="space-y-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
      <div className="border-b border-slate-100 pb-6 flex justify-between items-end">
        <div>
          <Title level={3} className="!mb-1">Reporte de Estado del Proyecto</Title>
          <Paragraph type="secondary">Visión global del avance funcional y riesgos{sprint ? ` para ${sprint}` : ''}.</Paragraph>
        </div>
        {sprint && <Tag color="blue" className="mb-6 rounded-full px-4 py-1 font-bold">{sprint}</Tag>}
      </div>

      <Row gutter={24}>
        <Col span={16}>
          <Card title="Avance por Categoría" className="rounded-2xl border-slate-100 h-full">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Resumen Ejecutivo" className="rounded-2xl border-slate-100 h-full">
            <div className="space-y-6">
              <Statistic title="Progreso General" value={stats.progress} suffix="%" />
              <Progress percent={stats.progress} status="active" strokeColor="#3b82f6" />
              <Divider />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Text type="secondary">Funcionalidades:</Text>
                  <Text strong>{stats.total}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Casos de Prueba:</Text>
                  <Text strong>{stats.testCasesCount}</Text>
                </div>
                <div className="flex justify-between">
                  <Text type="secondary">Nivel de Riesgo:</Text>
                  <Tag color="red">ALTO</Tag>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Análisis de Riesgos" className="rounded-2xl border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100">
            <Text strong className="text-rose-900 block mb-1">Riesgo Funcional</Text>
            <Text className="text-xs text-rose-700">Existen {stats.highRisk} funcionalidades críticas sin certificar.</Text>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <Text strong className="text-amber-900 block mb-1">Riesgo de Tiempo</Text>
            <Text className="text-xs text-amber-700">El cronograma presenta un retraso estimado de 3 días.</Text>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <Text strong className="text-blue-900 block mb-1">Riesgo de Calidad</Text>
            <Text className="text-xs text-blue-700">La tasa de defectos en el módulo central es superior al 5%.</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

// --- Main Reports Component ---
export default function Reports({ projectId }: { projectId: string }) {
  const [selectedVariant, setSelectedVariant] = useState<ReportVariant>('QA_STATUS_SUMMARY');
  const [selectedSprint, setSelectedSprint] = useState<string | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [view, setView] = useState<'CONFIG' | 'REPORT'>('CONFIG');

  const { data: regressionCycles = [] } = useRegressionCycles(projectId);
  const { data: smokeCycles = [] } = useSmokeCycles(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  
  const allCycles = useMemo(() => [...regressionCycles, ...smokeCycles], [regressionCycles, smokeCycles]);
  
  const normalizeSprintKey = (value?: string | null) =>
    (value || '').trim().toLowerCase().replace(/^sprint\s*/i, '');

  const filteredCycles = useMemo(() => {
    if (!selectedSprint) return allCycles;
    const selectedKey = normalizeSprintKey(selectedSprint);
    return allCycles.filter(c => normalizeSprintKey(c.sprint) === selectedKey);
  }, [allCycles, selectedSprint]);

  const selectedCycle = useMemo(() => allCycles.find(c => c.id === selectedCycleId) || null, [allCycles, selectedCycleId]);

  const handleGenerate = () => {
    if (selectedVariant === 'QA_STATUS_SUMMARY' && !selectedCycleId) {
      message.warning('Por favor seleccione un ciclo para este tipo de reporte');
      return;
    }
    setView('REPORT');
  };

  const handleExportPdf = async () => {
    try {
      await exportToPdf('report-content', `Reporte_${selectedVariant}_${dayjs().format('YYYYMMDD')}`);
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
            Volver a Configuración
          </Button>
          <Space>
            <Button icon={<FileWordOutlined />} className="rounded-xl border-slate-200">Word</Button>
            <Button icon={<FileExcelOutlined />} className="rounded-xl border-slate-200">Excel</Button>
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

        {selectedVariant === 'QA_STATUS_SUMMARY' && <QAStatusSummary projectId={projectId} cycle={selectedCycle} />}
        {selectedVariant === 'QA_PROGRESS_REPORT' && <QAProgressReport projectId={projectId} sprint={selectedSprint} />}
        {selectedVariant === 'PROJECT_STATUS_REPORT' && <ProjectStatusReport projectId={projectId} sprint={selectedSprint} />}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <Title level={2} className="!mb-0">Generar Reportes de Proyecto</Title>
        <Paragraph type="secondary" className="text-lg">
          Seleccione el tipo de reporte y configure los filtros para obtener información detallada.
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
            <FilterOutlined /> Configuración de Filtros
          </div>
        </div>
        <div className="p-8">
          <Row gutter={24}>
            <Col span={selectedVariant === 'QA_STATUS_SUMMARY' ? 12 : 24}>
              <div className="space-y-2">
                <Text strong className="text-xs uppercase tracking-wider text-slate-500">Seleccionar Sprint</Text>
                <Select 
                  className="w-full h-12 rounded-xl"
                  placeholder="Todos los Sprints"
                  value={selectedSprint}
                  onChange={(val) => {
                    setSelectedSprint(val);
                    setSelectedCycleId(null);
                  }}
                  allowClear
                  options={sprints.map(s => ({ label: s.name, value: s.name }))}
                />
              </div>
            </Col>
            {selectedVariant === 'QA_STATUS_SUMMARY' && (
              <Col span={12}>
                <div className="space-y-2">
                  <Text strong className="text-xs uppercase tracking-wider text-slate-500">Seleccionar Ciclo</Text>
                  <Select 
                    className="w-full h-12 rounded-xl"
                    placeholder="Elija un ciclo de prueba..."
                    value={selectedCycleId}
                    onChange={setSelectedCycleId}
                    options={filteredCycles.map(c => ({ 
                      label: `${c.cycleId} - ${c.type || (c.cycleId?.startsWith('S-') ? 'SMOKE' : 'REGRESSION')} (${dayjs(c.date).format('DD/MM/YYYY')})`, 
                      value: c.id 
                    }))}
                  />
                </div>
              </Col>
            )}
          </Row>

          <Divider className="my-8" />

          <div className="flex justify-end gap-4">
            <Button className="h-12 px-8 rounded-xl border-slate-200 font-medium">
              Cancelar
            </Button>
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
