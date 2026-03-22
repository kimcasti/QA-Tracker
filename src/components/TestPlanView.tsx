import {
  Button,
  Calendar,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  NotificationOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useMemo, useState } from 'react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useModules } from '../modules/settings/hooks/useModules';
import { SlackMemberSelect } from '../modules/slack-members/components/SlackMemberSelect';
import { useSlackMembers } from '../modules/slack-members/hooks/useSlackMembers';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useTestPlans } from '../modules/test-plans/hooks/useTestPlans';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import {
  CalendarEventType,
  FunctionalityScope,
  Priority,
  TestPlan,
  TestType,
} from '../types';
import { labelPriority } from '../i18n/labels';

const { Title, Text, Paragraph } = Typography;
const EVENT_COLORS: Record<CalendarEventType, string> = {
  [CalendarEventType.TEST]: 'blue',
  [CalendarEventType.CLIENT_MEETING]: 'cyan',
  [CalendarEventType.DEMO]: 'purple',
  [CalendarEventType.ONBOARDING]: 'gold',
  [CalendarEventType.FOLLOW_UP]: 'green',
  [CalendarEventType.REMINDER]: 'orange',
};

function getEventColor(type: CalendarEventType) {
  return EVENT_COLORS[type] || 'default';
}

function formatTimeLabel(value?: string) {
  if (!value) return '';
  const parsed = dayjs(value, 'HH:mm', true);
  return parsed.isValid() ? parsed.format('hh:mm A') : value;
}

function splitPeople(value?: string) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export default function TestPlanView({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { isViewer } = useWorkspaceAccess();
  const { data: plansData, save: savePlan, delete: deletePlan } = useTestPlans(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);

  const plans = Array.isArray(plansData) ? plansData : [];

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [planForm] = Form.useForm();
  const { data: slackMembers = [] } = useSlackMembers(isEventModalOpen);
  const selectedEventType =
    Form.useWatch('eventType', planForm) || editingPlan?.eventType || CalendarEventType.TEST;
  const watchedOwnerSelection = Form.useWatch('ownerSelection', planForm) as string[] | undefined;
  const watchedAttendeeList = Form.useWatch('attendeeList', planForm) as string[] | undefined;
  const isTestEvent = selectedEventType === CalendarEventType.TEST;
  const ownerExtraOptions = useMemo(
    () => (watchedOwnerSelection || []).map(value => ({ label: value, value })),
    [watchedOwnerSelection],
  );
  const attendeeExtraOptions = useMemo(
    () => (watchedAttendeeList || []).map(value => ({ label: value, value })),
    [watchedAttendeeList],
  );

  const countsByType = useMemo(() => {
    return Object.values(CalendarEventType).map(type => ({
      type,
      count: plans.filter(plan => plan.eventType === type).length,
    }));
  }, [plans]);

  const closeEventModal = () => {
    setIsEventModalOpen(false);
    setEditingPlan(null);
    planForm.resetFields();
  };

  const openNewEventModal = () => {
    setEditingPlan(null);
    setIsEventModalOpen(true);
    planForm.resetFields();
    planForm.setFieldsValue({
      eventType: CalendarEventType.TEST,
      scope: FunctionalityScope.TOTAL,
      priority: Priority.MEDIUM,
      testType: TestType.REGRESSION,
      date: dayjs(),
      time: null,
      ownerSelection: [],
      attendeeList: [],
    });
  };

  const openEditEventModal = (plan: TestPlan) => {
    setEditingPlan(plan);
    setIsEventModalOpen(true);
    planForm.resetFields();
    planForm.setFieldsValue({
      ...plan,
      date: dayjs(plan.date),
      time: plan.time ? dayjs(plan.time, 'HH:mm') : null,
      ownerSelection: plan.owner ? [plan.owner] : [],
      attendeeList: splitPeople(plan.attendees),
    });
  };

  const handleDeleteEvent = async () => {
    if (!editingPlan) return;

    Modal.confirm({
      title: '¿Eliminar evento?',
      content: 'Esta acción no se puede deshacer.',
      okText: 'Eliminar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      centered: true,
      onOk: async () => {
        await deletePlan(editingPlan.id);
        message.success('Evento eliminado');
        closeEventModal();
      },
    });
  };

  const handleSaveEvent = async () => {
    try {
      const values = await planForm.validateFields();
      const eventType = values.eventType as CalendarEventType;
      const nextIsTestEvent = eventType === CalendarEventType.TEST;

      const payload: TestPlan = {
        id: editingPlan?.id || `plan-${Date.now()}`,
        projectId: editingPlan?.projectId || projectId || '',
        eventType,
        title: values.title,
        date: values.date.format('YYYY-MM-DD'),
        time: values.time ? (values.time as Dayjs).format('HH:mm') : undefined,
        description: values.description,
        owner: values.ownerSelection?.[0]?.trim() || undefined,
        attendees:
          values.attendeeList
            ?.map((item: string) => item.trim())
            .filter(Boolean)
            .join(', ') || undefined,
        scope: nextIsTestEvent ? values.scope : undefined,
        impactModules: nextIsTestEvent ? values.impactModules || [] : undefined,
        sprint: nextIsTestEvent ? values.sprint : undefined,
        testType: nextIsTestEvent ? values.testType : undefined,
        priority: nextIsTestEvent ? values.priority : undefined,
        jiraId: nextIsTestEvent ? values.jiraId?.trim() || undefined : undefined,
      };

      await savePlan(payload);
      message.success(editingPlan ? 'Evento actualizado' : 'Evento guardado correctamente');
      closeEventModal();
    } catch (error) {
      console.error('Event save failed:', error);
    }
  };

  const dateCellRender = (value: Dayjs) => {
    const listData = plans.filter(plan => dayjs(plan.date).isSame(value, 'day'));

    if (listData.length === 0) return null;

    return (
      <ul className="list-none p-0 m-0 space-y-1">
        {listData.slice(0, 3).map(item => (
          <li key={item.id}>
            <Tooltip
              title={
                <div className="space-y-1">
                  <div className="font-semibold">{item.title}</div>
                  <div>{item.eventType}</div>
                  {item.time && <div>Hora: {formatTimeLabel(item.time)}</div>}
                  {item.owner && <div>Responsable: {item.owner}</div>}
                  {item.sprint && <div>Sprint: {item.sprint}</div>}
                </div>
              }
            >
              <button
                type="button"
                className="w-full text-left rounded-lg border px-2 py-1 text-[10px] font-medium truncate bg-white hover:bg-slate-50"
                onClick={event => {
                  event.stopPropagation();
                  openEditEventModal(item);
                }}
              >
                <div className="flex items-center gap-1">
                  <Tag color={getEventColor(item.eventType)} className="m-0 rounded-full text-[9px]">
                    {item.eventType}
                  </Tag>
                  <span className="truncate">
                    {item.time ? `${formatTimeLabel(item.time)} · ` : ''}
                    {item.title}
                  </span>
                </div>
              </button>
            </Tooltip>
          </li>
        ))}
        {listData.length > 3 && (
          <li className="text-[10px] text-slate-400 font-medium px-1">
            +{listData.length - 3} más
          </li>
        )}
      </ul>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">
            Calendario
          </Title>
          <Text type="secondary" className="text-slate-500">
            Organiza pruebas, reuniones con cliente, demos, inducciones y recordatorios del
            proyecto en una sola agenda.
          </Text>
          {isViewer && (
            <Space size={[8, 8]} wrap>
              <Tag color="default" className="rounded-full px-3 py-1 font-semibold">
                Solo lectura
              </Tag>
              <Text type="secondary">
                Puedes consultar la agenda, pero no crear ni modificar eventos.
              </Text>
            </Space>
          )}
        </div>
        {!isViewer && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openNewEventModal}
            className="rounded-lg h-10 px-6 bg-indigo-600 hover:bg-indigo-700"
          >
            Nuevo evento
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {countsByType.map(item => (
          <Card key={item.type} className="rounded-2xl border-slate-100 shadow-sm">
            <div>
              <div>
                <Text type="secondary" className="text-[11px] uppercase tracking-wider font-bold">
                  {item.type}
                </Text>
                <div className="text-2xl font-bold text-slate-800 mt-1">{item.count}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 p-0 overflow-hidden">
        <div className="p-6 bg-white border-b border-slate-100">
          <div className="flex justify-between items-center gap-4">
            <div>
              <Title level={4} className="m-0">
                Agenda del proyecto
              </Title>
              <Text type="secondary">
                Visualiza y gestiona las actividades programadas del mes por tipo de evento.
              </Text>
            </div>
            <Space wrap>
              {Object.values(CalendarEventType).map(type => (
                <Tag key={type} color={getEventColor(type)} className="rounded-full px-3 py-1">
                  {type}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
        <div className="p-4">
          <Calendar cellRender={date => dateCellRender(date as Dayjs)} className="test-calendar" />
        </div>
      </Card>

      <Modal
        title={
          <span className="text-xl font-bold text-slate-800">
            {editingPlan ? 'Editar evento' : 'Crear nuevo evento'}
          </span>
        }
        open={isEventModalOpen}
        onCancel={closeEventModal}
        width={760}
        centered
        footer={
          isViewer
            ? [
                <Button key="close" onClick={closeEventModal}>
                  Cerrar
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={closeEventModal}>
                  Cancelar
                </Button>,
                editingPlan ? (
                  <Button key="delete" danger icon={<DeleteOutlined />} onClick={handleDeleteEvent}>
                    Eliminar
                  </Button>
                ) : null,
                <Button key="ok" type="primary" onClick={handleSaveEvent}>
                  {editingPlan ? 'Guardar cambios' : 'Guardar evento'}
                </Button>,
              ]
        }
      >
        <Form form={planForm} layout="vertical" className="mt-4" disabled={isViewer}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="title" label="Título" rules={[{ required: true }]}>
                <Input placeholder="Ej: Demo de avance con cliente" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="eventType" label="Tipo de evento" rules={[{ required: true }]}>
                <Select
                  className="h-10 rounded-lg"
                  options={Object.values(CalendarEventType).map(type => ({
                    label: type,
                    value: type,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Fecha" rules={[{ required: true }]}>
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="time" label="Hora">
                <TimePicker
                  className="w-full h-10 rounded-lg"
                  format="HH:mm"
                  popupClassName="calendar-time-picker-popup"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ownerSelection" label="Responsable">
                <SlackMemberSelect
                  members={slackMembers}
                  valueField="fullName"
                  multiple
                  maxCount={1}
                  placeholder="Selecciona desde Slack o escribe un responsable"
                  extraOptions={ownerExtraOptions}
                  onChange={values => planForm.setFieldValue('ownerSelection', values.slice(-1))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="attendeeList" label="Participantes">
                <SlackMemberSelect
                  members={slackMembers}
                  valueField="fullName"
                  multiple
                  placeholder="Selecciona desde Slack o escribe participantes extra"
                  extraOptions={attendeeExtraOptions}
                />
              </Form.Item>
            </Col>
          </Row>

          {isTestEvent ? (
            <>
              <Divider className="!mt-2 !mb-5" />
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="scope"
                    label="Alcance funcional"
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={Object.values(FunctionalityScope).map(value => ({
                        label: value,
                        value,
                      }))}
                      className="h-10 rounded-lg"
                    />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    name="impactModules"
                    label="Módulos de impacto"
                    rules={[{ required: true }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Selecciona módulos"
                      options={modulesData.map(module => ({
                        label: module.name,
                        value: module.name,
                      }))}
                      className="rounded-lg"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="sprint" label="Sprint" rules={[{ required: true }]}>
                    <Select
                      placeholder="Selecciona el sprint"
                      className="h-10 rounded-lg"
                      options={sprintsData.map(sprint => ({
                        label: sprint.name,
                        value: sprint.name,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="testType" label="Tipo de prueba" rules={[{ required: true }]}>
                    <Select
                      options={Object.values(TestType).map(type => ({
                        label: type,
                        value: type,
                      }))}
                      className="h-10 rounded-lg"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="priority" label="Nivel de prioridad" rules={[{ required: true }]}>
                    <Select
                      options={Object.values(Priority).map(priority => ({
                        label: labelPriority(priority, t),
                        value: priority,
                      }))}
                      className="h-10 rounded-lg"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="jiraId" label="Historia de Jira (opcional)">
                <Input placeholder="Ej: JIRA-123" className="h-10 rounded-lg" />
              </Form.Item>
            </>
          ) : (
            <Card className="rounded-2xl border-slate-100 bg-slate-50/70 mb-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shrink-0">
                  <NotificationOutlined className="text-slate-500" />
                </div>
                <div>
                  <Text strong className="block text-slate-800">
                    Evento operativo del proyecto
                  </Text>
                  <Paragraph type="secondary" className="!mb-0 text-sm">
                    Usa este tipo para reuniones con cliente, demos, inducciones, seguimientos o
                    recordatorios. Solo necesitas la información general del evento.
                  </Paragraph>
                </div>
              </div>
            </Card>
          )}

          <Form.Item name="description" label="Descripción" rules={[{ required: true }]}>
            <Input.TextArea
              rows={4}
              placeholder={
                isTestEvent
                  ? 'Describe el objetivo, alcance o detalles de la planificación de pruebas...'
                  : 'Describe el propósito, acuerdos esperados o pendiente a recordar...'
              }
              className="rounded-lg"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
