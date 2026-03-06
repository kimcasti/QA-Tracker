import { Button, Card, Col, DatePicker, Form, Input, Modal, Progress, Row, Select, Space, Table, Tag, Typography, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, BarChartOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, EyeOutlined, FileTextOutlined, ArrowLeftOutlined, SettingOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRegressionCycles, useFunctionalities } from '../hooks';
import { RegressionCycle, TestResult, TestType, RegressionExecution } from '../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function RegressionCycles() {
  const { data: cycles = [], save } = useRegressionCycles();
  const { data: functionalities = [] } = useFunctionalities();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<RegressionCycle | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  // Filter regression functionalities for new cycles
  const regressionFuncs = functionalities.filter(f => f.testTypes.includes(TestType.REGRESSION));

  const columns = [
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">CICLO</span>,
      dataIndex: 'cycleId',
      key: 'cycleId',
      render: (text: string, record: RegressionCycle) => (
        <Button 
          type="link" 
          className="p-0 h-auto font-bold text-blue-600"
          onClick={() => setSelectedCycle(record)}
        >
          {text}
        </Button>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FECHA</span>,
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => (
        <div className="flex flex-col">
          <span className="text-slate-700 font-medium">{dayjs(date).format('DD MMM')}</span>
          <span className="text-slate-400 text-xs">{dayjs(date).format('YYYY')}</span>
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">TOTAL TEST</span>,
      dataIndex: 'totalTests',
      key: 'totalTests',
      render: (val: number) => <Text strong>{val}</Text>,
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">APROBADOS</span>,
      dataIndex: 'passed',
      key: 'passed',
      render: (val: number) => (
        <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-bold inline-block">
          {val}
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FALLIDOS</span>,
      dataIndex: 'failed',
      key: 'failed',
      render: (val: number) => (
        <div className="bg-red-50 text-red-700 px-3 py-1 rounded-lg font-bold inline-block">
          {val}
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">PENDIENTES</span>,
      dataIndex: 'pending',
      key: 'pending',
      render: (val: number) => (
        <div className="bg-slate-50 text-slate-500 px-3 py-1 rounded-lg font-bold inline-block">
          {val || 0}
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">% APROB.</span>,
      dataIndex: 'approvalRate',
      key: 'approvalRate',
      render: (rate: number) => (
        <div className="flex items-center gap-3 min-w-[120px]">
          <Progress 
            percent={rate} 
            size="small" 
            showInfo={false} 
            strokeColor={rate >= 85 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444'}
            trailColor="#f1f5f9"
          />
          <span className="font-bold text-slate-700">{rate}%</span>
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ACCIONES</span>,
      key: 'actions',
      render: (_: any, record: RegressionCycle) => (
        <Button 
          icon={<EyeOutlined />} 
          onClick={() => setSelectedCycle(record)}
          className="rounded-lg border-slate-200 text-slate-600"
        >
          Ver Detalle
        </Button>
      ),
    },
  ];

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Initialize executions from regression functionalities
      const initialExecutions: RegressionExecution[] = regressionFuncs.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        functionalityId: f.id,
        module: f.module,
        functionalityName: f.name,
        executed: false,
        result: TestResult.NOT_EXECUTED,
      }));

      const newCycle: RegressionCycle = {
        id: Date.now().toString(),
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        totalTests: initialExecutions.length,
        passed: 0,
        failed: 0,
        blocked: 0,
        pending: initialExecutions.length,
        approvalRate: 0,
        status: 'EN_PROGRESO',
        executions: initialExecutions,
      };

      save(newCycle);
      setIsModalOpen(false);
      form.resetFields();
      setSelectedCycle(newCycle); // Open detail view immediately
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const updateExecution = (cycleId: string, executionId: string, updates: Partial<RegressionExecution>) => {
    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return;

    const updatedExecutions = cycle.executions.map(ex => 
      ex.id === executionId ? { ...ex, ...updates, date: updates.executed ? dayjs().format('YYYY-MM-DD') : ex.date } : ex
    );

    const passed = updatedExecutions.filter(ex => ex.result === TestResult.PASSED).length;
    const failed = updatedExecutions.filter(ex => ex.result === TestResult.FAILED).length;
    const blocked = updatedExecutions.filter(ex => ex.result === TestResult.BLOCKED).length;
    const total = updatedExecutions.length;
    const pending = updatedExecutions.filter(ex => !ex.executed).length;
    const rate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

    const updatedCycle: RegressionCycle = {
      ...cycle,
      executions: updatedExecutions,
      passed,
      failed,
      blocked,
      pending,
      approvalRate: rate,
      status: pending === 0 ? 'FINALIZADA' : 'EN_PROGRESO'
    };

    save(updatedCycle);
    if (selectedCycle?.id === cycleId) {
      setSelectedCycle(updatedCycle);
    }
  };

  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilter, setDetailFilter] = useState<'ALL' | 'FAILED'>('ALL');

  const handleExecuteAll = (cycle: RegressionCycle) => {
    const updatedExecutions = cycle.executions.map(ex => ({
      ...ex,
      executed: true,
      result: TestResult.PASSED,
      date: dayjs().format('YYYY-MM-DD')
    }));

    const updatedCycle: RegressionCycle = {
      ...cycle,
      executions: updatedExecutions,
      passed: updatedExecutions.length,
      failed: 0,
      blocked: 0,
      pending: 0,
      approvalRate: 100,
      status: 'FINALIZADA'
    };

    save(updatedCycle);
    setSelectedCycle(updatedCycle);
  };

  const filteredExecutions = selectedCycle?.executions.filter(ex => {
    const matchesSearch = 
      ex.functionalityId.toLowerCase().includes(detailSearch.toLowerCase()) ||
      ex.module.toLowerCase().includes(detailSearch.toLowerCase()) ||
      ex.functionalityName.toLowerCase().includes(detailSearch.toLowerCase());
    
    const matchesFilter = detailFilter === 'ALL' || ex.result === TestResult.FAILED;

    return matchesSearch && matchesFilter;
  }) || [];

  if (selectedCycle) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={() => setSelectedCycle(null)}
              className="rounded-xl h-10 w-10 flex items-center justify-center border-slate-200"
            />
            <div>
              <div className="flex items-center gap-3">
                <Tag color={selectedCycle.status === 'FINALIZADA' ? 'green' : 'blue'} className="rounded-full px-3 font-bold uppercase text-[10px]">
                  {selectedCycle.status === 'FINALIZADA' ? 'Finalizada' : 'Active Run'}
                </Tag>
                <span className="text-slate-400 text-sm">• {selectedCycle.sprint || 'Sin Sprint'}</span>
              </div>
              <Title level={2} className="!m-0 uppercase tracking-tight">{selectedCycle.cycleId}</Title>
              <Paragraph type="secondary" className="!m-0">{selectedCycle.note}</Paragraph>
            </div>
          </div>
          <Space size="middle">
            <Button icon={<FileTextOutlined />} className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 font-semibold">
              Export Report
            </Button>
            <Button 
              type="primary" 
              icon={<BarChartOutlined />} 
              size="large" 
              className="rounded-xl h-11 px-8 shadow-lg shadow-blue-200 font-bold"
              onClick={() => handleExecuteAll(selectedCycle)}
            >
              Execute All
            </Button>
          </Space>
        </div>

        <Row gutter={20}>
          <Col span={6}>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                  <BarChartOutlined className="text-slate-400 text-xl" />
                </div>
                <div>
                  <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Total Tests</Text>
                  <div className="text-2xl font-bold text-slate-800 leading-none mt-1">{selectedCycle.totalTests}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                  <CheckCircleOutlined className="text-emerald-500 text-xl" />
                </div>
                <div>
                  <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Approved</Text>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold text-emerald-600 leading-none">{selectedCycle.passed}</span>
                    <span className="text-xs text-emerald-500 font-bold">({Math.round((selectedCycle.passed / selectedCycle.totalTests) * 100)}%)</span>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                  <CloseCircleOutlined className="text-red-500 text-xl" />
                </div>
                <div>
                  <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Failed</Text>
                  <div className="text-2xl font-bold text-red-600 leading-none mt-1">{selectedCycle.failed}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                  <ClockCircleOutlined className="text-amber-500 text-xl" />
                </div>
                <div>
                  <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Pending</Text>
                  <div className="text-2xl font-bold text-amber-600 leading-none mt-1">{selectedCycle.pending}</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4 flex-1 max-w-md">
              <Input 
                prefix={<SearchOutlined className="text-slate-400" />} 
                placeholder="Search by ID, Module or Functionality..." 
                className="h-11 rounded-xl bg-slate-50 border-none"
                value={detailSearch}
                onChange={e => setDetailSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                type={detailFilter === 'ALL' ? 'primary' : 'default'} 
                className="rounded-lg h-9"
                onClick={() => setDetailFilter('ALL')}
              >
                All
              </Button>
              <Button 
                type={detailFilter === 'FAILED' ? 'primary' : 'default'} 
                className="rounded-lg h-9"
                onClick={() => setDetailFilter('FAILED')}
              >
                Failed Only
              </Button>
            </div>
          </div>

          <Table 
            dataSource={filteredExecutions}
            rowKey="id"
            pagination={false}
            className="regression-table"
            columns={[
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">ID</span>,
                dataIndex: 'functionalityId',
                key: 'id',
                render: (id) => <span className="font-bold text-blue-600">{id}</span>
              },
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">MODULO</span>,
                dataIndex: 'module',
                key: 'module',
                render: (m) => <span className="font-bold text-slate-800">{m}</span>
              },
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">FUNCIONALIDAD</span>,
                dataIndex: 'functionalityName',
                key: 'name',
                render: (n) => <span className="text-slate-600">{n}</span>
              },
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">EJECUTADO</span>,
                dataIndex: 'executed',
                key: 'executed',
                align: 'center',
                render: (executed, record) => (
                  <div 
                    className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-colors ${executed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'}`}
                    onClick={() => updateExecution(selectedCycle.id, record.id, { executed: !executed, result: !executed ? TestResult.PASSED : TestResult.NOT_EXECUTED })}
                  >
                    <CheckCircleOutlined />
                  </div>
                )
              },
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">FECHA</span>,
                dataIndex: 'date',
                key: 'date',
                render: (d) => <span className="text-slate-400">{d ? dayjs(d).format('DD MMM, YYYY') : '—'}</span>
              },
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">RESULTADO</span>,
                dataIndex: 'result',
                key: 'result',
                render: (result, record) => (
                  <Select
                    value={result}
                    onChange={(val) => updateExecution(selectedCycle.id, record.id, { result: val, executed: val !== TestResult.NOT_EXECUTED })}
                    className="w-32"
                    bordered={false}
                    dropdownStyle={{ borderRadius: '12px' }}
                    options={Object.values(TestResult).map(r => ({
                      label: (
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            r === TestResult.PASSED ? 'bg-emerald-500' : 
                            r === TestResult.FAILED ? 'bg-red-500' : 
                            r === TestResult.BLOCKED ? 'bg-amber-500' : 'bg-slate-300'
                          }`} />
                          <span className={
                            r === TestResult.PASSED ? 'text-emerald-600' : 
                            r === TestResult.FAILED ? 'text-red-600' : 
                            r === TestResult.BLOCKED ? 'text-amber-600' : 'text-slate-400'
                          }>{r}</span>
                        </div>
                      ),
                      value: r
                    }))}
                  />
                )
              },
              {
                title: <span className="text-[11px] font-bold text-slate-400 uppercase">EVIDENCIA</span>,
                dataIndex: 'evidence',
                key: 'evidence',
                render: (ev, record) => (
                  <div className="flex items-center gap-2 text-blue-500 cursor-pointer hover:text-blue-700 font-medium">
                    {ev ? (
                      <div className="flex items-center gap-1" onClick={() => {
                        const newEv = prompt('Editar evidencia:', ev);
                        if (newEv !== null) updateExecution(selectedCycle.id, record.id, { evidence: newEv });
                      }}>
                        <EyeOutlined /> <span>View</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-slate-400" onClick={() => {
                        const newEv = prompt('Agregar evidencia/nota:');
                        if (newEv) updateExecution(selectedCycle.id, record.id, { evidence: newEv });
                      }}>
                        <PlusOutlined /> <span>Note</span>
                      </div>
                    )}
                  </div>
                )
              }
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Title level={2} className="!mb-1">Control de Regresión</Title>
          <Paragraph type="secondary">Gestión y seguimiento de ejecuciones históricas de calidad.</Paragraph>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          size="large" 
          className="rounded-xl h-12 px-6 shadow-lg shadow-blue-200"
          onClick={() => setIsModalOpen(true)}
        >
          Nuevo Ciclo de Regresión
        </Button>
      </div>

      {latestCycle && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChartOutlined className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg">Última Regresión</span>
            <Tag color="blue" className="rounded-full px-3 font-bold border-blue-200 bg-blue-50 text-blue-600">
              {latestCycle.cycleId} (FINALIZADA)
            </Tag>
          </div>

          <Row gutter={16}>
            <Col span={5}>
              <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Tests</Text>
                    <div className="text-3xl font-bold text-slate-800 mt-1">{latestCycle.totalTests}</div>
                  </div>
                  <Tag color="blue" className="m-0 border-none bg-blue-50 text-blue-600 font-bold rounded-full px-3">Total</Tag>
                </div>
              </Card>
            </Col>
            <Col span={5}>
              <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aprobados</Text>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-bold text-emerald-600">{latestCycle.passed}</span>
                    </div>
                  </div>
                  <Tag color="green" className="m-0 border-none bg-emerald-50 text-emerald-500 font-bold rounded-full px-3">
                    {latestCycle.totalTests > 0 ? Math.round((latestCycle.passed / latestCycle.totalTests) * 100) : 0}%
                  </Tag>
                </div>
              </Card>
            </Col>
            <Col span={5}>
              <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fallidos</Text>
                    <div className="text-3xl font-bold text-red-600 mt-1">{latestCycle.failed}</div>
                  </div>
                  <Tag color="red" className="m-0 border-none bg-rose-50 text-rose-500 font-bold rounded-full px-3">
                    {latestCycle.totalTests > 0 ? Math.round((latestCycle.failed / latestCycle.totalTests) * 100) : 0}%
                  </Tag>
                </div>
              </Card>
            </Col>
            <Col span={5}>
              <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pendientes</Text>
                    <div className="text-3xl font-bold text-amber-600 mt-1">{latestCycle.pending || 0}</div>
                  </div>
                  <Tag color="orange" className="m-0 border-none bg-amber-50 text-amber-500 font-bold rounded-full px-3">
                    {latestCycle.totalTests > 0 ? Math.round(((latestCycle.pending || 0) / latestCycle.totalTests) * 100) : 0}%
                  </Tag>
                </div>
              </Card>
            </Col>
            <Col span={4}>
              <Card className="rounded-2xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aprobación</Text>
                    <div className="text-3xl font-bold text-blue-600 mt-1">{latestCycle.approvalRate}%</div>
                  </div>
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <BarChartOutlined className="text-blue-600" />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      <Card className="rounded-2xl border-slate-100 shadow-sm">
        <Row gutter={16} align="bottom">
          <Col span={8}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rango de Fecha</span>
              <RangePicker className="w-full h-10 rounded-lg" />
            </div>
          </Col>
          <Col span={6}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sprint</span>
              <Select 
                placeholder="Todos los Sprints" 
                className="w-full h-10 rounded-lg" 
                allowClear
                options={[
                  { value: 's24', label: 'Sprint 24' },
                  { value: 's23', label: 'Sprint 23' },
                  { value: 's22', label: 'Sprint 22' },
                ]}
              />
            </div>
          </Col>
          <Col span={6}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Buscar Ciclo</span>
              <Input 
                prefix={<SearchOutlined className="text-slate-400" />} 
                placeholder="ID del ciclo..." 
                className="h-10 rounded-lg"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
          </Col>
          <Col span={4}>
            <Button className="h-10 w-full rounded-lg text-slate-500">Limpiar</Button>
          </Col>
        </Row>
      </Card>

      <Card 
        className="rounded-2xl border-slate-100 shadow-sm"
        title={<span className="text-slate-800 font-bold">Historial de Ciclos</span>}
      >
        <Table 
          columns={columns} 
          dataSource={filteredCycles} 
          rowKey="id"
          pagination={{ 
            pageSize: 5,
            showTotal: (total, range) => `Mostrando ${range[0]}-${range[1]} de ${total} registros`
          }}
          className="executive-table"
        />
      </Card>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Registrar Nuevo Ciclo de Regresión</span>}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={800}
        centered
        okText="Crear Ciclo y Comenzar"
        cancelText="Cancelar"
        className="executive-modal"
      >
        <Form form={form} layout="vertical" className="mt-4" initialValues={{ date: dayjs() }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cycleId" label={<span className="font-semibold text-slate-600">ID del Ciclo</span>} rules={[{ required: true }]}>
                <Input placeholder="Ej: C-49" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label={<span className="font-semibold text-slate-600">Fecha de Inicio</span>} rules={[{ required: true }]}>
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sprint" label={<span className="font-semibold text-slate-600">Sprint</span>}>
                <Input placeholder="Ej: Sprint 25" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="font-semibold text-slate-600">Funcionalidades a Incluir</span>}>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="text-blue-600 font-bold">{regressionFuncs.length}</span> funcionalidades de tipo <Tag color="blue" className="m-0 ml-1">Regresión</Tag> detectadas.
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label={<span className="font-semibold text-slate-600">Objetivo de la Regresión</span>}>
            <Input.TextArea rows={3} placeholder="Ej: Asegurar estabilidad de módulos core antes de despliegue..." className="rounded-lg" />
          </Form.Item>

          <div className="mt-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase block mb-3">Vista Previa de Funcionalidades</span>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-slate-100">
              <Table 
                dataSource={regressionFuncs}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id', render: (id) => <span className="text-xs font-bold text-blue-600">{id}</span> },
                  { title: 'Módulo', dataIndex: 'module', key: 'module', render: (m) => <span className="text-xs font-medium">{m}</span> },
                  { title: 'Funcionalidad', dataIndex: 'name', key: 'name', render: (n) => <span className="text-xs text-slate-500">{n}</span> },
                ]}
              />
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
