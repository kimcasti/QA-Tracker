import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  DatePicker,
  Row,
  Col,
  message,
  Tooltip,
  Calendar,
  Tag,
} from 'antd';
import { PlusOutlined, CalendarOutlined, DeleteOutlined } from '@ant-design/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useModules } from '../modules/settings/hooks/useModules';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestPlans } from '../modules/test-plans/hooks/useTestPlans';
import { TestType, Priority, FunctionalityScope, TestPlan } from '../types';
import { labelPriority } from '../i18n/labels';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function TestPlanView({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: plansData, save: savePlan, delete: deletePlan } = useTestPlans(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const plans = Array.isArray(plansData) ? plansData : [];

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [planForm] = Form.useForm();

  const closePlanModal = () => {
    setIsPlanModalOpen(false);
    setEditingPlan(null);
    planForm.resetFields();
  };

  const openNewPlanModal = () => {
    setEditingPlan(null);
    setIsPlanModalOpen(true);
    planForm.resetFields();
    planForm.setFieldsValue({
      scope: FunctionalityScope.TOTAL,
      priority: Priority.MEDIUM,
      testType: TestType.REGRESSION,
      date: dayjs(),
    });
  };

  const openEditPlanModal = (plan: TestPlan) => {
    setEditingPlan(plan);
    setIsPlanModalOpen(true);
    planForm.resetFields();
    planForm.setFieldsValue({
      ...plan,
      date: dayjs(plan.date),
    });
  };

  const handleSavePlan = async () => {
    try {
      const values = await planForm.validateFields();
      const payload: TestPlan = {
        id: editingPlan?.id || `plan-${Date.now()}`,
        projectId: editingPlan?.projectId || projectId || '',
        ...values,
        date: values.date.format('YYYY-MM-DD'),
      };
      console.log('Payload - Save Test Plan:', payload);
      await savePlan(payload);
      message.success(
        editingPlan ? 'Planificación actualizada' : 'Prueba planificada correctamente',
      );
      closePlanModal();
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
                  ${
                    item.priority === Priority.HIGH
                      ? 'bg-rose-50 text-rose-600 border-rose-100'
                      : item.priority === Priority.MEDIUM
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }`}
                onClick={e => {
                  e.stopPropagation();
                  openEditPlanModal(item);
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
          <Title level={2} className="m-0 font-bold text-slate-800">
            Planes de Prueba
          </Title>
          <Text type="secondary" className="text-slate-500">
            Planifica y gestiona el calendario de pruebas para los próximos sprints.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openNewPlanModal}
          className="rounded-lg h-10 px-6 bg-indigo-600 hover:bg-indigo-700"
        >
          Planificar Prueba
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 p-0 overflow-hidden">
        <div className="p-6 bg-white border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <Title level={4} className="m-0">
                Calendario de Planificación
              </Title>
              <Text type="secondary">
                Visualiza y gestiona las pruebas programadas para el mes.
              </Text>
            </div>
          </div>
        </div>
        <div className="p-4">
          <Calendar cellRender={date => dateCellRender(date)} className="test-calendar" />
        </div>
      </Card>

      <Modal
        title={
          <span className="text-xl font-bold text-slate-800">
            {editingPlan ? 'Editar Planificación' : 'Planificar Nueva Prueba'}
          </span>
        }
        open={isPlanModalOpen}
        onCancel={closePlanModal}
        width={700}
        centered
        footer={[
          <Button key="cancel" onClick={closePlanModal}>
            Cancelar
          </Button>,
          editingPlan ? (
            <Button
              key="delete"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (!editingPlan) return;
                Modal.confirm({
                  title: '¿Eliminar planificación?',
                  content: 'Esta acción no se puede deshacer.',
                  okText: 'Eliminar',
                  okButtonProps: { danger: true },
                  cancelText: 'Cancelar',
                  centered: true,
                  onOk: async () => {
                    await deletePlan(editingPlan.id);
                    message.success('Planificación eliminada');
                    closePlanModal();
                  },
                });
              }}
            >
              Eliminar
            </Button>
          ) : null,
          <Button key="ok" type="primary" onClick={handleSavePlan}>
            {editingPlan ? 'Guardar Cambios' : 'Planificar'}
          </Button>,
        ]}
      >
        <Form form={planForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="title"
                label="Título de la Planificación"
                rules={[{ required: true }]}
              >
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
                <Select
                  options={Object.values(FunctionalityScope).map(v => ({ label: v, value: v }))}
                  className="h-10 rounded-lg"
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="impactModules"
                label="Módulos de Impacto"
                rules={[{ required: true }]}
              >
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
                <Select
                  options={Object.values(TestType).map(v => ({ label: v, value: v }))}
                  className="h-10 rounded-lg"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="priority" label="Nivel de Prioridad" rules={[{ required: true }]}>
                <Select
                  options={Object.values(Priority).map(v => ({
                    label: labelPriority(v, t),
                    value: v,
                  }))}
                  className="h-10 rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="jiraId" label="Historia de Jira (Opcional)">
            <Input placeholder="Ej: JIRA-123" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="description" label="Descripción" rules={[{ required: true }]}>
            <Input.TextArea
              rows={3}
              placeholder="Detalles adicionales de la planificación..."
              className="rounded-lg"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// End of file
