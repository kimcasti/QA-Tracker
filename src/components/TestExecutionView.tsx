import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, DatePicker, Row, Col, Upload, message, Tooltip, Divider } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UploadOutlined, DeleteOutlined, FileImageOutlined, EyeOutlined, EditOutlined, BugOutlined, UserOutlined } from '@ant-design/icons';
import React, { useState, useEffect } from 'react';
import { useFunctionalities, useExecutions, useTestCases } from '../hooks';
import { TestExecution, TestResult, TestType, ExecutionStatus, Priority, FunctionalityScope, Severity } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function TestExecutionView({ projectId }: { projectId?: string }) {
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: executionsData, save } = useExecutions(projectId);
  const { data: allTestCases } = useTestCases(projectId);
  
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const executions = Array.isArray(executionsData) ? executionsData : [];
  const testCases = Array.isArray(allTestCases) ? allTestCases : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [batchExecutions, setBatchExecutions] = useState<Record<string, { result: TestResult, notes: string, image?: string }>>({});
  const [viewingExecution, setViewingExecution] = useState<TestExecution | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExecution, setEditingExecution] = useState<TestExecution | null>(null);
  const [editForm] = Form.useForm();

  // Get unique modules
  const modules = Array.from(new Set(functionalities.map(f => f.module)));

  // Update batch executions when module changes
  useEffect(() => {
    if (selectedModule) {
      const moduleFuncs = functionalities.filter(f => f.module === selectedModule);
      const newBatch: Record<string, { result: TestResult, notes: string, image?: string }> = {};
      moduleFuncs.forEach(f => {
        newBatch[f.id] = { result: TestResult.NOT_EXECUTED, notes: '' };
      });
      setBatchExecutions(newBatch);
    } else {
      setBatchExecutions({});
    }
  }, [selectedModule, functionalities]);

  const handleBatchUpdate = (funcId: string, field: string, value: any) => {
    setBatchExecutions(prev => ({
      ...prev,
      [funcId]: { ...prev[funcId], [field]: value }
    }));
  };

  const handleSaveBatch = async (status: ExecutionStatus) => {
    try {
      const values = await form.validateFields(['executionDate', 'testType']);
      const date = values.executionDate.format('YYYY-MM-DD');
      const testType = values.testType;

      const newExecs: TestExecution[] = Object.entries(batchExecutions)
        .filter(([_, data]) => status === ExecutionStatus.FINAL ? data.result !== TestResult.NOT_EXECUTED : true)
        .map(([funcId, data]) => ({
          id: `${Date.now()}-${funcId}`,
          projectId: projectId || '',
          functionalityId: funcId,
          testType,
          result: data.result,
          notes: data.notes,
          evidenceImage: data.image,
          executionDate: date,
          executed: data.result !== TestResult.NOT_EXECUTED,
          status,
          tester: 'QA Engineer',
          scope: values.scope,
          impactModules: values.impactModules,
          sprint: values.sprint,
          priority: values.priority,
          jiraId: values.jiraId,
          description: values.description
        }));

      if (newExecs.length === 0) {
        message.warning('No hay resultados para guardar.');
        return;
      }

      newExecs.forEach(exec => save(exec));
      message.success(`Resultados guardados como ${status.toLowerCase()}`);
      setIsModalOpen(false);
      form.resetFields();
      setSelectedModule(null);
      setBatchExecutions({});
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  // Filters state
  const [funcFilter, setFuncFilter] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<TestResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const filteredExecutions = executions.filter(exec => {
    const matchesFunc = !funcFilter || exec.functionalityId === funcFilter;
    const matchesResult = !resultFilter || exec.result === resultFilter;
    const matchesStatus = !statusFilter || exec.status === statusFilter;
    const matchesDate = !dateRange || !dateRange[0] || !dateRange[1] || 
      (dayjs(exec.executionDate).isSame(dateRange[0], 'day') || dayjs(exec.executionDate).isAfter(dateRange[0], 'day')) && 
      (dayjs(exec.executionDate).isSame(dateRange[1], 'day') || dayjs(exec.executionDate).isBefore(dateRange[1], 'day'));
    return matchesFunc && matchesResult && matchesStatus && matchesDate;
  });

  const { Title, Text } = Typography;

  // Metrics Calculation
  const totalExecs = executions.length;
  const passedExecs = executions.filter(e => e.result === TestResult.PASSED).length;
  const failedExecs = executions.filter(e => e.result === TestResult.FAILED).length;
  const blockedExecs = executions.filter(e => e.result === TestResult.BLOCKED).length;

  const columns = [
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FECHA</span>,
      dataIndex: 'executionDate',
      key: 'executionDate',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Funcionalidad / Caso</span>,
      dataIndex: 'functionalityId',
      key: 'functionalityId',
      render: (id: string, record: TestExecution) => {
        const func = functionalities.find(f => f.id === id);
        const tc = testCases.find(t => t.id === record.testCaseId);
        return (
          <div>
            <Text strong>{id}</Text>
            <br />
            <Text type="secondary" className="text-xs">{func?.name || 'Desconocida'}</Text>
            {tc && (
              <div className="mt-1 flex items-center gap-1">
                <Tag color="cyan" className="text-[10px] m-0">{tc.id}</Tag>
                <Text className="text-[11px] italic">{tc.title}</Text>
              </div>
            )}
          </div>
        );
      },
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Tipo de Test</span>, 
      dataIndex: 'testType', 
      key: 'testType' 
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Resultado</span>,
      dataIndex: 'result',
      key: 'result',
      render: (result: TestResult, record: TestExecution) => {
        let color = 'default';
        let icon = <ClockCircleOutlined />;
        if (result === TestResult.PASSED) { color = 'success'; icon = <CheckCircleOutlined />; }
        if (result === TestResult.FAILED) { color = 'error'; icon = <CloseCircleOutlined />; }
        if (result === TestResult.BLOCKED) { color = 'warning'; }
        return (
          <Space direction="vertical" size={0}>
            <Space>
              <Tag color={color} icon={icon}>{result}</Tag>
              <Tag color={record.status === ExecutionStatus.FINAL ? 'blue' : 'orange'} className="text-[10px] uppercase font-bold">
                {record.status}
              </Tag>
            </Space>
            {record.bugId && (
              <Tag color="magenta" icon={<BugOutlined />} className="mt-1 text-[10px]">
                {record.bugId}
              </Tag>
            )}
          </Space>
        );
      },
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Notas</span>, 
      dataIndex: 'notes', 
      key: 'notes' 
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Acciones</span>,
      key: 'actions',
      render: (_: any, record: TestExecution) => (
        <Space>
          <Button 
            icon={<EyeOutlined />} 
            size="small"
            onClick={() => {
              setViewingExecution(record);
              setIsDetailModalOpen(true);
            }}
            className="text-slate-600 hover:text-blue-600"
          >
            Detalle
          </Button>
          {record.status === ExecutionStatus.DRAFT && (
            <Button 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => {
                setEditingExecution(record);
                editForm.setFieldsValue({
                  ...record,
                  executionDate: dayjs(record.executionDate)
                });
                setIsEditModalOpen(true);
              }}
              className="text-amber-600 hover:text-amber-700"
            >
              Editar
            </Button>
          )}
        </Space>
      )
    },
  ];

  const handleUpdateSingle = async (status: ExecutionStatus) => {
    try {
      const values = await editForm.validateFields();
      if (!editingExecution) return;

      const updatedExec: TestExecution = {
        ...editingExecution,
        ...values,
        executionDate: values.executionDate.format('YYYY-MM-DD'),
        status,
        executed: values.result !== TestResult.NOT_EXECUTED
      };

      save(updatedExec);
      message.success(`Registro actualizado como ${status.toLowerCase()}`);
      setIsEditModalOpen(false);
      setEditingExecution(null);
      editForm.resetFields();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header Pattern */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">Ejecución de Pruebas</Title>
          <Text type="secondary" className="text-slate-500">Registra y monitorea los resultados de las ejecuciones de pruebas manuales y automatizadas.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg h-10 px-6"
        >
          Registrar Resultado
        </Button>
      </div>

      {/* Metrics Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Ejecuciones</Text>
            <div className="text-3xl font-bold mt-1 text-slate-800">{totalExecs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pasadas</Text>
            <div className="text-3xl font-bold mt-1 text-emerald-600">{passedExecs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fallidas</Text>
            <div className="text-3xl font-bold mt-1 text-rose-600">{failedExecs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bloqueadas</Text>
            <div className="text-3xl font-bold mt-1 text-amber-600">{blockedExecs}</div>
          </Card>
        </Col>
      </Row>

      {/* Filters Card */}
      <Card className="rounded-2xl shadow-sm border-slate-100">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Funcionalidad</span>
            <Select
              placeholder="Todas"
              className="w-64 h-10"
              allowClear
              showSearch
              onChange={setFuncFilter}
              value={funcFilter}
              options={functionalities.map(f => ({ label: `${f.id} - ${f.name}`, value: f.id }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resultado</span>
            <Select
              placeholder="Todos"
              className="w-40 h-10"
              allowClear
              onChange={setResultFilter}
              value={resultFilter}
              options={Object.values(TestResult).map(r => ({ label: r, value: r }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado</span>
            <Select
              placeholder="Todos"
              className="w-32 h-10"
              allowClear
              onChange={setStatusFilter}
              value={statusFilter}
              options={Object.values(ExecutionStatus).map(s => ({ label: s, value: s }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rango de Fecha</span>
            <DatePicker.RangePicker 
              className="h-10 rounded-lg"
              onChange={(dates) => setDateRange(dates as any)}
              value={dateRange as any}
            />
          </div>
          <Button 
            onClick={() => {
              setFuncFilter(null);
              setResultFilter(null);
              setStatusFilter(null);
              setDateRange(null);
            }}
            className="h-10 rounded-lg text-slate-500"
          >
            Limpiar Filtros
          </Button>
        </div>
      </Card>

      {/* Table Card */}
      <Card
        className="rounded-2xl shadow-sm border-slate-100"
        title={<span className="text-slate-800 font-bold">Historial de Ejecuciones</span>}
      >
        <Table 
          columns={columns} 
          dataSource={filteredExecutions} 
          rowKey="id" 
          className="executive-table"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={<span className="text-xl font-bold text-slate-800">Editar Ejecución (Borrador)</span>}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>,
          <Button 
            key="draft" 
            className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
            onClick={() => handleUpdateSingle(ExecutionStatus.DRAFT)}
          >
            Mantener Borrador
          </Button>,
          <Button 
            key="final" 
            type="primary"
            onClick={() => handleUpdateSingle(ExecutionStatus.FINAL)}
          >
            Finalizar Registro
          </Button>
        ]}
        width={600}
        centered
      >
        {editingExecution && (
          <Form form={editForm} layout="vertical" className="py-4">
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Funcionalidad</div>
              <div className="text-lg font-bold text-slate-800">{editingExecution.functionalityId}</div>
              <div className="text-slate-500">{functionalities.find(f => f.id === editingExecution.functionalityId)?.name}</div>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="testType" label="Tipo de Test" rules={[{ required: true }]}>
                  <Select options={Object.values(TestType).map(v => ({ label: v, value: v }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="executionDate" label="Fecha de Ejecución" rules={[{ required: true }]}>
                  <DatePicker className="w-full" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="tester" label="Tester" rules={[{ required: true }]}>
              <Input prefix={<UserOutlined />} placeholder="Nombre del tester" />
            </Form.Item>

            <Form.Item name="testCaseId" label="Caso de Prueba">
              <Select 
                allowClear 
                placeholder="Selecciona un caso de prueba (opcional)"
                options={testCases
                  .filter(tc => tc.functionalityId === editingExecution.functionalityId)
                  .map(tc => ({ label: `${tc.id} - ${tc.title}`, value: tc.id }))
                }
              />
            </Form.Item>

            <Form.Item name="result" label="Resultado" rules={[{ required: true }]}>
              <Select options={Object.values(TestResult).map(v => ({ label: v, value: v }))} />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.result !== currentValues.result}>
              {({ getFieldValue }) => {
                const result = getFieldValue('result');
                if (result === TestResult.FAILED || result === TestResult.BLOCKED) {
                  return (
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-4">
                      <Title level={5} className="text-red-800 mb-3 flex items-center gap-2">
                        <BugOutlined /> Información del Bug
                      </Title>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="bugId" label="Bug ID">
                            <Input placeholder="Ej: BUG-001" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="severity" label="Severidad">
                            <Select placeholder="Selecciona severidad">
                              {Object.values(Severity).map(s => (
                                <Select.Option key={s} value={s}>{s}</Select.Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={24}>
                          <Form.Item name="bugLink" label="Link al Bug">
                            <Input placeholder="https://jira.com/browse/BUG-001" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  );
                }
                return null;
              }}
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="scope" label="Alcance" rules={[{ required: true }]}>
                  <Select options={Object.values(FunctionalityScope).map(v => ({ label: v, value: v }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
                  <Select options={Object.values(Priority).map(v => ({ label: v, value: v }))} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="sprint" label="Sprint" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="jiraId" label="Jira ID">
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="impactModules" label="Módulos de Impacto" rules={[{ required: true }]}>
              <Select mode="multiple" options={modules.map(m => ({ label: m, value: m }))} />
            </Form.Item>

            <Form.Item name="description" label="Descripción">
              <Input.TextArea rows={2} />
            </Form.Item>

            <Form.Item name="notes" label="Notas / Evidencia">
              <Input.TextArea rows={3} placeholder="Detalles del error o notas de la prueba" />
            </Form.Item>

            <Form.Item label="Evidencia Visual">
              <div className="flex items-center gap-4">
                <Upload
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      editForm.setFieldValue('evidenceImage', e.target?.result as string);
                      setEditingExecution(prev => prev ? { ...prev, evidenceImage: e.target?.result as string } : null);
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />}>Cambiar Imagen</Button>
                </Upload>
                {editingExecution.evidenceImage && (
                  <Tag color="blue" icon={<FileImageOutlined />}>Imagen cargada</Tag>
                )}
              </div>
              <Form.Item name="evidenceImage" hidden><Input /></Form.Item>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title={<span className="text-xl font-bold text-slate-800">Detalle de Ejecución</span>}
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
        ]}
        width={600}
        centered
      >
        {viewingExecution && (
          <div className="space-y-6 py-4">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Funcionalidad</div>
                <div className="text-lg font-bold text-slate-800">{viewingExecution.functionalityId}</div>
                <div className="text-slate-500">{functionalities.find(f => f.id === viewingExecution.functionalityId)?.name}</div>
              </div>
              <Tag color={viewingExecution.status === ExecutionStatus.FINAL ? 'blue' : 'orange'} className="rounded-full px-3 font-bold uppercase text-[10px]">
                {viewingExecution.status}
              </Tag>
            </div>

            <Row gutter={24}>
              <Col span={12}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Test</div>
                <div className="font-semibold text-slate-700">{viewingExecution.testType}</div>
              </Col>
              <Col span={12}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</div>
                <div className="font-semibold text-slate-700">{dayjs(viewingExecution.executionDate).format('DD/MM/YYYY')}</div>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={8}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alcance</div>
                <div className="font-semibold text-slate-700">{viewingExecution.scope || '-'}</div>
              </Col>
              <Col span={8}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sprint</div>
                <div className="font-semibold text-slate-700">{viewingExecution.sprint || '-'}</div>
              </Col>
              <Col span={8}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prioridad</div>
                <Tag color={viewingExecution.priority === Priority.HIGH ? 'red' : viewingExecution.priority === Priority.MEDIUM ? 'orange' : 'green'} className="m-0">
                  {viewingExecution.priority || '-'}
                </Tag>
              </Col>
            </Row>

            {viewingExecution.impactModules && viewingExecution.impactModules.length > 0 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Módulos de Impacto</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {viewingExecution.impactModules.map(m => <Tag key={m} className="m-0 text-[10px]">{m}</Tag>)}
                </div>
              </div>
            )}

            {viewingExecution.jiraId && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jira ID</div>
                <Text className="text-blue-600 font-semibold">{viewingExecution.jiraId}</Text>
              </div>
            )}

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Resultado</div>
              <Space>
                <Tag 
                  color={viewingExecution.result === TestResult.PASSED ? 'success' : viewingExecution.result === TestResult.FAILED ? 'error' : 'warning'}
                  className="font-bold"
                >
                  {viewingExecution.result}
                </Tag>
                {viewingExecution.tester && (
                  <Tag icon={<UserOutlined />} className="bg-slate-50 border-slate-200">
                    Tester: {viewingExecution.tester}
                  </Tag>
                )}
              </Space>
            </div>

            {viewingExecution.bugId && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Información del Bug</div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <div className="text-xs text-red-600 font-semibold">Bug ID</div>
                    <div className="text-slate-800 font-bold">{viewingExecution.bugId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-red-600 font-semibold">Severidad</div>
                    <Tag color="red" className="m-0">{viewingExecution.severity}</Tag>
                  </div>
                  {viewingExecution.bugLink && (
                    <div>
                      <div className="text-xs text-red-600 font-semibold">Link</div>
                      <a href={viewingExecution.bugLink} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                        Ver en Jira/Herramienta
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas / Observaciones</div>
              <div className="bg-slate-50 p-4 rounded-xl text-slate-700 border border-slate-100 italic">
                {viewingExecution.notes || 'Sin notas adicionales.'}
              </div>
            </div>

            {viewingExecution.evidenceImage && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Evidencia Visual</div>
                <img src={viewingExecution.evidenceImage} className="w-full rounded-xl border border-slate-200 shadow-sm" alt="Evidencia" />
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={<span className="text-xl font-bold text-slate-800">Registrar Resultados por Módulo</span>}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setSelectedModule(null);
          setBatchExecutions({});
        }}
        width={1000}
        centered
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)}>Cancelar</Button>,
          <Button 
            key="draft" 
            className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
            onClick={() => handleSaveBatch(ExecutionStatus.DRAFT)}
          >
            Guardar como Borrador
          </Button>,
          <Button 
            key="final" 
            type="primary"
            onClick={() => handleSaveBatch(ExecutionStatus.FINAL)}
          >
            Guardar Final
          </Button>
        ]}
      >
        <Form form={form} layout="vertical" initialValues={{ executionDate: dayjs(), testType: TestType.FUNCTIONAL, scope: FunctionalityScope.TOTAL, priority: Priority.MEDIUM }}>
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label={<span className="font-semibold text-slate-600">Módulo</span>} required>
                <Select
                  placeholder="Selecciona un módulo"
                  className="h-10 rounded-lg"
                  onChange={setSelectedModule}
                  value={selectedModule}
                  options={modules.map(m => ({ label: m, value: m }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="testType" label={<span className="font-semibold text-slate-600">Tipo de Test</span>} rules={[{ required: true }]}>
                <Select className="h-10 rounded-lg" options={Object.values(TestType).map(v => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="executionDate" label={<span className="font-semibold text-slate-600">Fecha de Ejecución</span>} rules={[{ required: true }]}>
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="scope" label={<span className="font-semibold text-slate-600">Alcance</span>} rules={[{ required: true }]}>
                <Select options={Object.values(FunctionalityScope).map(v => ({ label: v, value: v }))} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="impactModules" label={<span className="font-semibold text-slate-600">Módulos de Impacto</span>} rules={[{ required: true }]}>
                <Select 
                  mode="multiple" 
                  placeholder="Selecciona módulos" 
                  options={modules.map(m => ({ label: m, value: m }))} 
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="sprint" label={<span className="font-semibold text-slate-600">Sprint</span>} rules={[{ required: true }]}>
                <Input placeholder="Ej: 24" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label={<span className="font-semibold text-slate-600">Prioridad</span>} rules={[{ required: true }]}>
                <Select options={Object.values(Priority).map(v => ({ label: v, value: v }))} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="jiraId" label={<span className="font-semibold text-slate-600">Jira ID</span>}>
                <Input placeholder="Ej: JIRA-123" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label={<span className="font-semibold text-slate-600">Descripción</span>} rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Descripción de la ejecución..." className="rounded-lg" />
          </Form.Item>

          {selectedModule && (
            <div className="mt-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase block mb-3">Funcionalidades del Módulo</span>
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <Table
                  dataSource={functionalities.filter(f => f.module === selectedModule)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: 'FUNCIONALIDAD',
                      dataIndex: 'name',
                      key: 'name',
                      width: '25%',
                      render: (name, record) => (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700">{record.id}</span>
                          <span className="text-xs text-slate-500">{name}</span>
                        </div>
                      )
                    },
                    {
                      title: 'RESULTADO',
                      key: 'result',
                      width: '20%',
                      render: (_, record) => (
                        <Select
                          className="w-full"
                          value={batchExecutions[record.id]?.result}
                          onChange={(val) => handleBatchUpdate(record.id, 'result', val)}
                          options={Object.values(TestResult).map(r => ({ label: r, value: r }))}
                        />
                      )
                    },
                    {
                      title: 'NOTAS / EVIDENCIA',
                      key: 'notes',
                      width: '35%',
                      render: (_, record) => (
                        <Input.TextArea
                          rows={1}
                          placeholder="Notas..."
                          value={batchExecutions[record.id]?.notes}
                          onChange={(e) => handleBatchUpdate(record.id, 'notes', e.target.value)}
                          className="rounded-lg"
                        />
                      )
                    },
                    {
                      title: 'IMAGEN',
                      key: 'image',
                      width: '20%',
                      align: 'center',
                      render: (_, record) => (
                        <Space>
                          <Upload
                            beforeUpload={(file) => {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                handleBatchUpdate(record.id, 'image', e.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                              return false;
                            }}
                            showUploadList={false}
                          >
                            <Button 
                              icon={<UploadOutlined />} 
                              type={batchExecutions[record.id]?.image ? 'primary' : 'default'}
                              className="rounded-lg"
                            />
                          </Upload>
                          {batchExecutions[record.id]?.image && (
                            <Tooltip title="Ver Imagen">
                              <Button 
                                icon={<FileImageOutlined />} 
                                onClick={() => {
                                  Modal.info({
                                    title: 'Evidencia Visual',
                                    content: <img src={batchExecutions[record.id]?.image} className="w-full mt-4 rounded-lg" />,
                                    width: 600,
                                    centered: true
                                  });
                                }}
                                className="rounded-lg text-blue-600"
                              />
                            </Tooltip>
                          )}
                        </Space>
                      )
                    }
                  ]}
                />
              </div>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

// Helper Row/Col for the modal
