import { Button, Card, Form, Input, Modal, Select, Space, Typography, DatePicker, Row, Col, message, Tooltip, Calendar, Tag } from 'antd';
import { PlusOutlined, CalendarOutlined, DeleteOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import { useFunctionalities, useTestPlans, useModules, useSprints } from '../hooks';
import { TestType, Priority, FunctionalityScope, TestPlan } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function TestPlanView({ projectId }: { projectId?: string }) {
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: plansData, save: savePlan, delete: deletePlan } = useTestPlans(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const plans = Array.isArray(plansData) ? plansData : [];

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planForm] = Form.useForm();

  const handleSavePlan = async () => {
    try {
      const values = await planForm.validateFields();
      const newPlan: TestPlan = {
        id: `plan-${Date.now()}`,
        projectId: projectId || '',
        ...values,
        date: values.date.format('YYYY-MM-DD'),
      };
      console.log('Payload - Create Test Plan:', newPlan);
      savePlan(newPlan);
      message.success('Prueba planificada correctamente');
      setIsPlanModalOpen(false);
      planForm.resetFields();
    } catch (error) {
      console.error('Plan save failed:', error);
    }
  };

  const dateCellRender = (value: dayjs.Dayjs) => {
    const listData = plans.filter(p => dayjs(p.date).isSame(value, 'day'));
    return (
      <ul className="list-none p-0 m-0">
        {listData.map(item => (
          <li key={item.id} className="mb-1">
            <Tooltip title={`${item.title} - ${item.priority}`}>
              <div 
                className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer
                  ${item.priority === Priority.HIGH ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                    item.priority === Priority.MEDIUM ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                    'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                onClick={() => {
                  Modal.info({
                    title: 'Detalle de Planificación',
                    content: (
                      <div className="space-y-4 mt-4">
                        <div className="flex justify-between">
                          <Tag color="blue">{item.testType}</Tag>
                          <Tag color={item.priority === Priority.HIGH ? 'red' : item.priority === Priority.MEDIUM ? 'orange' : 'green'}>{item.priority}</Tag>
                        </div>
                        <div>
                          <Text strong className="block">Título:</Text>
                          <Text>{item.title}</Text>
                        </div>
                        <div>
                          <Text strong className="block">Alcance:</Text>
                          <Text>{item.scope}</Text>
                        </div>
                        <div>
                          <Text strong className="block">Módulos de Impacto:</Text>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.impactModules.map(m => <Tag key={m} className="m-0 text-[10px]">{m}</Tag>)}
                          </div>
                        </div>
                        <div>
                          <Text strong className="block">Sprint:</Text>
                          <Text>{item.sprint}</Text>
                        </div>
                        {item.jiraId && (
                          <div>
                            <Text strong className="block">Jira ID:</Text>
                            <Text className="text-blue-600">{item.jiraId}</Text>
                          </div>
                        )}
                        <div>
                          <Text strong className="block">Descripción:</Text>
                          <Text className="italic text-slate-500">{item.description}</Text>
                        </div>
                        <Button 
                          danger 
                          size="small" 
                          icon={<DeleteOutlined />} 
                          onClick={() => {
                            deletePlan(item.id);
                            Modal.destroyAll();
                            message.success('Planificación eliminada');
                          }}
                        >
                          Eliminar Planificación
                        </Button>
                      </div>
                    ),
                    width: 400,
                    centered: true
                  });
                }}
              >
                {item.title}
              </div>
            </Tooltip>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">Planes de Prueba</Title>
          <Text type="secondary" className="text-slate-500">Planifica y gestiona el calendario de pruebas para los próximos sprints.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsPlanModalOpen(true)}
          className="rounded-lg h-10 px-6 bg-indigo-600 hover:bg-indigo-700"
        >
          Planificar Prueba
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 p-0 overflow-hidden">
        <div className="p-6 bg-white border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <Title level={4} className="m-0">Calendario de Planificación</Title>
              <Text type="secondary">Visualiza y gestiona las pruebas programadas para el mes.</Text>
            </div>
          </div>
        </div>
        <div className="p-4">
          <Calendar 
            cellRender={(date) => dateCellRender(date)} 
            className="test-calendar"
          />
        </div>
      </Card>

      <Modal
        title={<span className="text-xl font-bold text-slate-800">Planificar Nueva Prueba</span>}
        open={isPlanModalOpen}
        onCancel={() => setIsPlanModalOpen(false)}
        onOk={handleSavePlan}
        okText="Planificar"
        cancelText="Cancelar"
        width={700}
        centered
      >
        <Form form={planForm} layout="vertical" className="mt-4" initialValues={{ scope: FunctionalityScope.TOTAL, priority: Priority.MEDIUM, testType: TestType.REGRESSION, date: dayjs() }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="title" label="Título de la Planificación" rules={[{ required: true }]}>
                <Input placeholder="Ej: Smoke Test - Login UI" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="scope" label="Alcance Funcionalidad" rules={[{ required: true }]}>
                <Select options={Object.values(FunctionalityScope).map(v => ({ label: v, value: v }))} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="impactModules" label="Módulos de Impacto" rules={[{ required: true }]}>
                <Select 
                  mode="multiple" 
                  placeholder="Selecciona módulos" 
                  options={modulesData.map(m => ({ label: m.name, value: m.name }))} 
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="sprint" label="Número de Sprint" rules={[{ required: true }]}>
                <Select 
                  placeholder="Selecciona el Sprint" 
                  className="h-10 rounded-lg"
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="testType" label="Tipo de Prueba" rules={[{ required: true }]}>
                <Select options={Object.values(TestType).map(v => ({ label: v, value: v }))} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Nivel de Prioridad" rules={[{ required: true }]}>
                <Select options={Object.values(Priority).map(v => ({ label: v, value: v }))} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="jiraId" label="Historia de Jira (Opcional)">
            <Input placeholder="Ej: JIRA-123" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="description" label="Descripción" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Detalles adicionales de la planificación..." className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// End of file
