import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, DatePicker, Row, Col } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import { useFunctionalities, useExecutions } from '../hooks';
import { TestExecution, TestResult, TestType } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function TestExecutionView() {
  const { data: functionalities = [] } = useFunctionalities();
  const { data: executions = [], save } = useExecutions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // Filters state
  const [funcFilter, setFuncFilter] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<TestResult | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const filteredExecutions = executions.filter(exec => {
    const matchesFunc = !funcFilter || exec.functionalityId === funcFilter;
    const matchesResult = !resultFilter || exec.result === resultFilter;
    const matchesDate = !dateRange || !dateRange[0] || !dateRange[1] || 
      (dayjs(exec.executionDate).isSame(dateRange[0], 'day') || dayjs(exec.executionDate).isAfter(dateRange[0], 'day')) && 
      (dayjs(exec.executionDate).isSame(dateRange[1], 'day') || dayjs(exec.executionDate).isBefore(dateRange[1], 'day'));
    return matchesFunc && matchesResult && matchesDate;
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
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Funcionalidad</span>,
      dataIndex: 'functionalityId',
      key: 'functionalityId',
      render: (id: string) => {
        const func = functionalities.find(f => f.id === id);
        return (
          <div>
            <Text strong>{id}</Text>
            <br />
            <Text type="secondary" size="small">{func?.name || 'Desconocida'}</Text>
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
      render: (result: TestResult) => {
        let color = 'default';
        let icon = <ClockCircleOutlined />;
        if (result === TestResult.PASSED) { color = 'success'; icon = <CheckCircleOutlined />; }
        if (result === TestResult.FAILED) { color = 'error'; icon = <CloseCircleOutlined />; }
        if (result === TestResult.BLOCKED) { color = 'warning'; }
        return <Tag color={color} icon={icon}>{result}</Tag>;
      },
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Notas</span>, 
      dataIndex: 'notes', 
      key: 'notes' 
    },
  ];

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const newExec: TestExecution = {
        id: Date.now().toString(),
        ...values,
        executionDate: values.executionDate.format('YYYY-MM-DD'),
        executed: true,
      };
      save(newExec);
      setIsModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
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
        title="Registrar Resultado de Prueba"
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical" initialValues={{ executionDate: dayjs() }}>
          <Form.Item name="functionalityId" label="Funcionalidad" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Selecciona una funcionalidad"
              optionFilterProp="children"
              options={functionalities.map(f => ({ label: `${f.id} - ${f.name}`, value: f.id }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="testType" label="Tipo de Test" rules={[{ required: true }]}>
                <Select options={Object.values(TestType).map(v => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="result" label="Resultado" rules={[{ required: true }]}>
                <Select options={Object.values(TestResult).map(v => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="executionDate" label="Fecha de Ejecución" rules={[{ required: true }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="notes" label="Notas / Evidencia">
            <Input.TextArea rows={3} placeholder="Detalles del error o notas de la prueba" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// Helper Row/Col for the modal
