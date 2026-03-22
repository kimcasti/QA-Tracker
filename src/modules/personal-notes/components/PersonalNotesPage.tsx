import {
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { toApiError } from '../../../config/http';
import { qaPalette, softSurface } from '../../../theme/palette';
import { useAuthSession } from '../../auth/context/AuthSessionProvider';
import { useWorkspace } from '../../workspace/hooks/useWorkspace';
import { useWorkspaceAccess } from '../../workspace/hooks/useWorkspaceAccess';
import { usePersonalNotes } from '../hooks/usePersonalNotes';
import type { PersonalNote } from '../types/model';

const { Title, Text, Paragraph } = Typography;

type PersonalNoteFormValues = {
  activityDate: Dayjs;
  title: string;
  description: string;
};

function getGreeting(name: string) {
  const hour = dayjs().hour();
  const firstName = name.split(' ')[0] || name;

  if (hour < 12) return `Buenos dias, ${firstName}`;
  if (hour < 18) return `Buenas tardes, ${firstName}`;
  return `Buenas noches, ${firstName}`;
}

export default function PersonalNotesPage() {
  const { message } = AntdApp.useApp();
  const { user } = useAuthSession();
  const { data: workspace } = useWorkspace();
  const { isViewer } = useWorkspaceAccess();
  const { data: personalNotes = [], isLoading, error, save, isSaving } = usePersonalNotes();
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null);
  const [form] = Form.useForm<PersonalNoteFormValues>();

  const organizationName = workspace?.memberships?.[0]?.organization?.name || 'tu organizacion';
  const displayName = user?.username?.trim() || user?.email?.split('@')[0] || 'Usuario';
  const weeklyEntries = useMemo(
    () =>
      personalNotes.filter(note =>
        dayjs(note.activityDate).isAfter(dayjs().startOf('week').subtract(1, 'day')),
      ).length,
    [personalNotes],
  );

  const sortedNotes = useMemo(
    () =>
      [...personalNotes].sort((left, right) => {
        const byDate = dayjs(right.activityDate).valueOf() - dayjs(left.activityDate).valueOf();
        if (byDate !== 0) return byDate;

        return (
          dayjs(right.updatedAt || right.createdAt).valueOf() -
          dayjs(left.updatedAt || left.createdAt).valueOf()
        );
      }),
    [personalNotes],
  );

  const resetForm = () => {
    setEditingNote(null);
    form.resetFields();
    form.setFieldsValue({
      activityDate: dayjs(),
      title: '',
      description: '',
    });
  };

  const handleEdit = (note: PersonalNote) => {
    setEditingNote(note);
    form.setFieldsValue({
      activityDate: dayjs(note.activityDate),
      title: note.title,
      description: note.description,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await save({
        documentId: editingNote?.documentId,
        activityDate: values.activityDate.format('YYYY-MM-DD'),
        title: values.title,
        description: values.description,
      });
      message.success(editingNote ? 'Nota actualizada correctamente.' : 'Nota guardada correctamente.');
      resetForm();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }

      message.error(toApiError(error).message || 'No se pudo guardar la nota.');
    }
  };

  const productivityPercent = Math.min(
    100,
    Math.max(weeklyEntries * 20, weeklyEntries > 0 ? 20 : 0),
  );

  return (
    <div className="space-y-6 pb-10">
      <div
        className="rounded-[30px] border border-slate-100 p-8 shadow-sm"
        style={{
          background: `
            radial-gradient(circle at top right, ${softSurface(qaPalette.accent)} 0%, transparent 24%),
            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${softSurface(qaPalette.primary)} 100%)
          `,
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Personal Notes
            </Text>
            <Title level={2} className="!mb-0 !text-slate-950">
              {getGreeting(displayName)}
            </Title>
            <Paragraph className="!mb-0 max-w-3xl text-base text-slate-500">
              Lleva el registro diario de tus actividades QA dentro de {organizationName}. Estas notas son solo tuyas y no dependen del proyecto activo.
            </Paragraph>
            {isViewer && (
              <Space size={[8, 8]} wrap>
                <Tag color="default" className="rounded-full px-3 py-1 font-semibold">
                  Solo lectura
                </Tag>
                <Text className="text-slate-500">
                  Puedes consultar tu historial, pero no crear ni editar notas con este rol.
                </Text>
              </Space>
            )}
          </div>
          {!isViewer && (
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              className="h-11 rounded-2xl px-5 font-semibold"
              onClick={resetForm}
            >
              Agregar nota
            </Button>
          )}
        </div>
      </div>

      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} xl={8}>
          <div className="space-y-5">
            <Card
              variant="borderless"
              className="rounded-[28px] qa-surface-card"
              styles={{ body: { padding: 24 } }}
            >
              <div className="mb-6 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: softSurface(qaPalette.primary),
                    color: qaPalette.primary,
                  }}
                >
                  <CalendarOutlined className="text-xl" />
                </div>
                <div>
                  <Title level={4} className="!mb-0 !text-slate-900">
                    {editingNote ? 'Editar actividad' : 'Registrar actividad'}
                  </Title>
                  <Text className="text-slate-400">Documenta lo realizado durante el dia.</Text>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                disabled={isViewer}
                initialValues={{
                  activityDate: dayjs(),
                  title: '',
                  description: '',
                }}
              >
                <Form.Item
                  name="activityDate"
                  label="Fecha"
                  rules={[{ required: true, message: 'Selecciona la fecha de la actividad.' }]}
                >
                  <DatePicker className="h-11 w-full rounded-2xl" format="DD/MM/YYYY" />
                </Form.Item>

                <Form.Item
                  name="title"
                  label="Actividad"
                  rules={[{ required: true, message: 'Ingresa un titulo para la actividad.' }]}
                >
                  <Input
                    className="h-11 rounded-2xl"
                    placeholder="Ej: Regression del flujo de pacientes"
                  />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="Descripcion"
                  rules={[{ required: true, message: 'Describe lo realizado en el dia.' }]}
                >
                  <Input.TextArea
                    rows={7}
                    className="rounded-2xl"
                    placeholder="Que hiciste hoy? Que hallazgos, avances o bloqueos registraste?"
                  />
                </Form.Item>

                {!isViewer && (
                  <div className="flex gap-3">
                    <Button
                      type="primary"
                      onClick={handleSave}
                      loading={isSaving}
                      className="h-11 flex-1 rounded-2xl font-semibold"
                    >
                      {editingNote ? 'Guardar cambios' : 'Guardar actividad'}
                    </Button>
                    {editingNote && (
                      <Button onClick={resetForm} className="h-11 rounded-2xl px-5">
                        Cancelar
                      </Button>
                    )}
                  </div>
                )}
              </Form>
            </Card>

            <Card
              variant="borderless"
              className="overflow-hidden rounded-[28px]"
              styles={{ body: { padding: 24 } }}
              style={{
                background: `linear-gradient(160deg, ${qaPalette.primary} 0%, #10233d 100%)`,
              }}
            >
              <Text className="!text-white/70">Productividad semanal</Text>
              <div className="mt-2 text-4xl font-bold text-white">{weeklyEntries}</div>
              <Text className="mt-1 block !text-white/70">entradas registradas esta semana</Text>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${productivityPercent}%`,
                    background: `linear-gradient(90deg, ${qaPalette.accent} 0%, #8af3ff 100%)`,
                  }}
                />
              </div>
              <Text className="mt-4 block !text-white/75">
                Tu historial se organiza por fecha de actividad para que puedas revisar rapidamente lo ejecutado en el dia.
              </Text>
            </Card>
          </div>
        </Col>

        <Col xs={24} xl={16}>
          <Card
            variant="borderless"
            className="rounded-[28px] qa-surface-card"
            styles={{ body: { padding: 24 } }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: softSurface(qaPalette.accent),
                  color: qaPalette.accent,
                }}
              >
                <HistoryOutlined className="text-xl" />
              </div>
              <div>
                <Title level={4} className="!mb-0 !text-slate-900">
                  Historial de actividades
                </Title>
                <Text className="text-slate-400">
                  Registro personal dentro de la organizacion.
                </Text>
              </div>
            </div>

            {error ? (
              <Alert
                type="error"
                showIcon
                className="rounded-2xl"
                message="No se pudieron cargar tus notas"
                description={toApiError(error).message}
              />
            ) : isLoading ? (
              <div className="space-y-4">
                <Skeleton active paragraph={{ rows: 3 }} className="rounded-2xl" />
                <Skeleton active paragraph={{ rows: 3 }} className="rounded-2xl" />
              </div>
            ) : sortedNotes.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Aun no tienes actividades registradas."
              />
            ) : (
              <div className="space-y-4">
                {sortedNotes.map(note => (
                  <Card
                    key={note.documentId}
                    variant="borderless"
                    className="rounded-[24px] border border-slate-100 bg-white/90"
                    styles={{ body: { padding: 20 } }}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <Space size={[8, 8]} wrap>
                            <Tag
                              variant="filled"
                              className="rounded-full px-3 py-1 font-semibold"
                              style={{
                                color: qaPalette.primary,
                                backgroundColor: softSurface(qaPalette.primary),
                              }}
                            >
                              {dayjs(note.activityDate).format('DD/MM/YYYY')}
                            </Tag>
                            {note.updatedAt && (
                              <Text className="inline-flex items-center gap-1 text-xs text-slate-400">
                                <ClockCircleOutlined />
                                {dayjs(note.updatedAt).format('HH:mm')}
                              </Text>
                            )}
                          </Space>
                          <Title level={5} className="!mb-0 !text-slate-900">
                            {note.title}
                          </Title>
                        </div>

                        {!isViewer && (
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            className="rounded-xl text-slate-500"
                            onClick={() => handleEdit(note)}
                          />
                        )}
                      </div>

                      <Paragraph className="!mb-0 whitespace-pre-wrap leading-7 text-slate-600">
                        {note.description}
                      </Paragraph>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <FileTextOutlined />
                        <span>
                          Registrada{' '}
                          {dayjs(note.createdAt || note.updatedAt || note.activityDate).format(
                            'DD MMM YYYY',
                          )}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
