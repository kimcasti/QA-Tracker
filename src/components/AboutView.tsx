import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Space,
  Tag,
  TimePicker,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  BulbOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  KeyOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { GoogleGenAI } from '@google/genai';
import { appBranding } from '../assets/branding';
import { useMeetingNotes } from '../modules/meeting-notes/hooks/useMeetingNotes';
import { useProjects } from '../modules/projects/hooks/useProjects';
import { useSlackMembers } from '../modules/slack-members/hooks/useSlackMembers';
import { SlackMemberSelect } from '../modules/slack-members/components/SlackMemberSelect';
import type { SlackMember } from '../modules/slack-members/types/model';
import { getGeminiApiKey } from '../services/geminiService';
import { MeetingNote, Project } from '../types';
import { qaPalette, softSurface } from '../theme/palette';

const { Title, Text, Paragraph } = Typography;

type NoteFormValues = {
  date: Dayjs;
  time: Dayjs;
  participants: string[];
  notes: string;
};

function splitParticipants(value?: string) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function normalizeParticipantKey(value?: string) {
  return (value || '').trim().toLowerCase();
}

function buildParticipantLookup(members: SlackMember[]) {
  const entries: Array<[string, SlackMember]> = [];

  members.forEach(member => {
    [member.fullName, member.realName, member.displayName, member.username].forEach(candidate => {
      const key = normalizeParticipantKey(candidate);
      if (key) {
        entries.push([key, member]);
      }
    });
  });

  return new Map(entries);
}

function normalizeRules(businessRules?: string) {
  return (businessRules || '')
    .split('\n')
    .map(rule => rule.trim())
    .filter(Boolean);
}

function ExecutiveInfoCard({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <Card
      variant="borderless"
      className="h-full rounded-[28px] qa-surface-card"
      styles={{ body: { padding: 28 } }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white shadow-sm"
          style={{ color: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <Title level={4} className="!mb-2 !text-slate-900">
            {title}
          </Title>
          <div className="text-slate-600">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function MeetingInsightCard({
  title,
  value,
  helper,
  accent,
}: {
  title: string;
  value: string | number;
  helper: string;
  accent: string;
}) {
  return (
    <Card
      variant="borderless"
      className="rounded-3xl"
      styles={{ body: { padding: 18 } }}
      style={{
        background: `linear-gradient(135deg, ${qaPalette.card} 0%, ${softSurface(accent)} 100%)`,
      }}
    >
      <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </Text>
      <div className="mt-2 text-3xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <Text className="mt-2 block text-slate-500">{helper}</Text>
    </Card>
  );
}

export default function AboutView({ project }: { project: Project }) {
  const { save: saveProject } = useProjects();
  const {
    data: meetingNotes = [],
    save: saveMeetingNote,
    delete: deleteMeetingNote,
  } = useMeetingNotes(project.id);
  const {
    data: slackMembers = [],
    isLoading: isSlackMembersLoading,
    error: slackMembersError,
  } = useSlackMembers(Boolean(project.id));

  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isViewNoteModalOpen, setIsViewNoteModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const [projectForm] = Form.useForm();
  const [noteForm] = Form.useForm<NoteFormValues>();

  const participantOptions = useMemo(() => {
    const candidates = new Set<string>();
    (project.teamMembers || []).forEach(member => {
      if (member.trim()) candidates.add(member.trim());
    });
    meetingNotes.forEach(note => {
      splitParticipants(note.participants).forEach(participant => candidates.add(participant));
    });
    return Array.from(candidates)
      .sort((left, right) => left.localeCompare(right))
      .map(value => ({ label: value, value }));
  }, [meetingNotes, project.teamMembers]);

  const participantLookup = useMemo(
    () => buildParticipantLookup(slackMembers),
    [slackMembers],
  );

  const businessRuleItems = useMemo(
    () => normalizeRules(project.businessRules),
    [project.businessRules],
  );

  const noteStats = useMemo(() => {
    const totalNotes = meetingNotes.length;
    const aiEnhanced = meetingNotes.filter(note => Boolean(note.aiSummary)).length;
    const allParticipants = new Set(
      meetingNotes.flatMap(note => splitParticipants(note.participants)),
    );
    return {
      totalNotes,
      aiEnhanced,
      uniqueParticipants: allParticipants.size,
    };
  }, [meetingNotes]);

  const completionPercent = useMemo(() => {
    const requirementCount = project.coreRequirements?.length || 0;
    const ruleCount = businessRuleItems.length;
    const total = requirementCount + ruleCount;
    if (total === 0) return 0;
    return Math.min(100, Math.round(((requirementCount + ruleCount) / Math.max(total, 4)) * 100));
  }, [businessRuleItems.length, project.coreRequirements]);

  const latestMeetingDate = useMemo(() => {
    if (meetingNotes.length === 0) return null;
    return [...meetingNotes].sort(
      (left, right) => dayjs(right.date).valueOf() - dayjs(left.date).valueOf(),
    )[0].date;
  }, [meetingNotes]);

  const projectStatusMeta = useMemo(() => {
    const statusMap = {
      Active: {
        label: 'Activo',
        color: qaPalette.functionalityStatus.completed,
      },
      Paused: {
        label: 'En pausa',
        color: qaPalette.functionalityStatus.inProgress,
      },
      Completed: {
        label: 'Completado',
        color: qaPalette.primary,
      },
    } as const;

    return statusMap[project.status] || statusMap.Active;
  }, [project.status]);

  const handleEditProject = () => {
    projectForm.setFieldsValue({
      organizationName: project.organizationName || project.name,
      description: project.description,
      purpose: project.purpose,
      coreRequirements: Array.isArray(project.coreRequirements)
        ? project.coreRequirements.join('\n')
        : project.coreRequirements,
      businessRules: project.businessRules,
    });
    setIsEditProjectModalOpen(true);
  };

  const handleSaveProject = async () => {
    try {
      const values = await projectForm.validateFields();
      const updatedProject = {
        ...project,
        organizationName: values.organizationName,
        description: values.description,
        purpose: values.purpose,
        coreRequirements: values.coreRequirements
          ? values.coreRequirements
              .split('\n')
              .map((rule: string) => rule.trim())
              .filter(Boolean)
          : [],
        businessRules: values.businessRules,
      };
      await saveProject(updatedProject);
      setIsEditProjectModalOpen(false);
      message.success('Informacion de la organizacion actualizada');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleAddNote = () => {
    setSelectedNote(null);
    noteForm.resetFields();
    noteForm.setFieldsValue({
      date: dayjs(),
      time: dayjs().startOf('hour'),
      participants: [],
      notes: '',
    });
    setIsNoteModalOpen(true);
  };

  const handleEditNote = (note: MeetingNote) => {
    setSelectedNote(note);
    noteForm.setFieldsValue({
      date: dayjs(note.date),
      time: dayjs(`2000-01-01T${note.time}`),
      participants: splitParticipants(note.participants),
      notes: note.notes,
    });
    setIsViewNoteModalOpen(false);
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async () => {
    try {
      const values = await noteForm.validateFields();
      const note: MeetingNote = {
        id: selectedNote?.id || `note-${Date.now()}`,
        projectId: project.id,
        date: values.date.format('YYYY-MM-DD'),
        time: values.time.format('HH:mm'),
        participants: values.participants.join(', '),
        notes: values.notes,
        aiSummary: selectedNote?.aiSummary,
        aiDecisions: selectedNote?.aiDecisions,
        aiActions: selectedNote?.aiActions,
        aiNextSteps: selectedNote?.aiNextSteps,
      };
      await saveMeetingNote(note);
      setIsNoteModalOpen(false);
      setSelectedNote(null);
      noteForm.resetFields();
      message.success('Minuta guardada correctamente');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleImproveWithAI = async () => {
    const notes = noteForm.getFieldValue('notes');
    if (!notes) {
      message.warning('Por favor ingresa algunas notas primero');
      return;
    }
    if (!getGeminiApiKey()) {
      setIsApiKeyModalOpen(true);
      return;
    }
    setIsImproving(true);
    try {
      const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() || '' });
      const prompt = `Reorganiza las siguientes notas de reunion en un formato estructurado con las siguientes secciones:
1. Resumen de la reunion
2. Decisiones
3. Acciones a realizar
4. Proximos pasos

Notas:
${notes}

Responde unicamente con un objeto JSON con las llaves: summary, decisions, actions, nextSteps.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });
      const result = JSON.parse(response.text || '{}');
      const formValues = noteForm.getFieldsValue();
      setSelectedNote(prev =>
        prev
          ? {
              ...prev,
              aiSummary: result.summary,
              aiDecisions: result.decisions,
              aiActions: result.actions,
              aiNextSteps: result.nextSteps,
            }
          : {
              id: `note-${Date.now()}`,
              projectId: project.id,
              date: formValues.date?.format?.('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
              time: formValues.time?.format?.('HH:mm') || dayjs().format('HH:mm'),
              participants: (formValues.participants || []).join(', '),
              notes,
              aiSummary: result.summary,
              aiDecisions: result.decisions,
              aiActions: result.actions,
              aiNextSteps: result.nextSteps,
            },
      );
      message.success('Notas mejoradas con IA');
    } catch (error) {
      console.error('AI Improvement failed:', error);
      const anyErr: any = error as any;
      const msg = (error instanceof Error ? error.message : anyErr?.message) || '';
      const nestedMessage = (anyErr?.error?.message || anyErr?.message || '').toString();
      const reason = anyErr?.error?.details?.[0]?.reason || anyErr?.details?.[0]?.reason;
      const isLeakedKey = /reported as leaked/i.test(nestedMessage);
      const isInvalidKey =
        reason === 'API_KEY_INVALID' || /api key not valid/i.test(nestedMessage) || isLeakedKey;
      if (msg === 'GEMINI_API_KEY_MISSING') {
        message.warning('Configura tu API Key de Gemini para usar la mejora con IA.');
        setIsApiKeyModalOpen(true);
      } else if (isInvalidKey) {
        localStorage.removeItem('GEMINI_API_KEY');
        message.error(
          isLeakedKey
            ? 'API Key comprometida. Genera una nueva API Key.'
            : 'API Key invalida. Ingresa una API Key valida de Gemini.',
        );
        setIsApiKeyModalOpen(true);
      } else {
        message.error('Error al mejorar las notas con IA');
      }
    } finally {
      setIsImproving(false);
    }
  };

  const handleBeforeUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async event => {
      const base64 = event.target?.result as string;
      try {
        await saveProject({ ...project, logo: base64 });
        message.success('Logotipo actualizado');
      } catch (error) {
        console.error('Error updating logo:', error);
        message.error('Error al actualizar el logotipo');
      }
    };
    reader.readAsDataURL(file);
    return false;
  };

  const renderNoteDetails = (note: MeetingNote) => {
    setSelectedNote(note);
    setIsViewNoteModalOpen(true);
  };

  return (
    <div
      className="space-y-6 pb-10"
      style={{
        background: `
          radial-gradient(circle at 0% 0%, ${softSurface(qaPalette.accent)} 0%, transparent 22%),
          radial-gradient(circle at 100% 18%, ${softSurface(qaPalette.primary)} 0%, transparent 18%)
        `,
      }}
    >
      <Row gutter={[24, 24]} align="stretch">
        <Col xs={24} xl={17}>
          <Card
            variant="borderless"
            className="overflow-hidden rounded-[30px] qa-surface-card"
            styles={{ body: { padding: 32 } }}
            style={{
              background: `linear-gradient(180deg, ${qaPalette.card} 0%, ${softSurface(qaPalette.accent)} 100%)`,
            }}
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-5">
                  <div className="relative shrink-0 group">
                    <Avatar
                      size={96}
                      shape="square"
                      src={project.logo || appBranding.logoUrl}
                      className="border border-slate-100 shadow-lg"
                      style={{
                        borderRadius: 26,
                        background:
                          project.logo || appBranding.logoUrl
                            ? undefined
                            : `linear-gradient(135deg, ${qaPalette.primary} 0%, ${qaPalette.accent} 100%)`,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 28,
                      }}
                    >
                      {!project.logo &&
                        !appBranding.logoUrl &&
                        getInitials(project.organizationName || project.name)}
                    </Avatar>
                    <Upload
                      showUploadList={false}
                      beforeUpload={handleBeforeUpload}
                      accept=".png,.jpg,.jpeg,.svg"
                      className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <div className="flex h-full w-full cursor-pointer items-center justify-center rounded-[26px] bg-slate-950/25 text-white">
                        <UploadOutlined className="text-xl" />
                      </div>
                    </Upload>
                  </div>

                  <div className="space-y-3">
                    <Space size={[8, 8]} wrap>
                      <Tag
                        variant="filled"
                        className="rounded-full px-3 py-1 font-semibold"
                        style={{
                          color: qaPalette.primary,
                          backgroundColor: softSurface(qaPalette.primary),
                        }}
                      >
                        Workspace Overview
                      </Tag>
                      <Tag
                        variant="filled"
                        className="rounded-full px-3 py-1 font-semibold"
                        style={{
                          color: qaPalette.accent,
                          backgroundColor: softSurface(qaPalette.accent),
                        }}
                      >
                        Organizacion
                      </Tag>
                      <Tag
                        variant="filled"
                        className="rounded-full px-3 py-1 font-semibold"
                        style={{
                          color: projectStatusMeta.color,
                          backgroundColor: softSurface(projectStatusMeta.color),
                        }}
                      >
                        {projectStatusMeta.label}
                      </Tag>
                    </Space>

                    <div>
                      <Title level={2} className="!mb-2 !text-slate-950">
                        {project.organizationName || project.name}
                      </Title>
                      <Space size={16} wrap className="text-sm text-slate-500">
                        <span className="inline-flex items-center gap-2">
                          <FileTextOutlined />
                          {project.version}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CalendarOutlined />
                          {latestMeetingDate
                            ? `Ultima actualizacion ${dayjs(latestMeetingDate).format('DD MMM YYYY')}`
                            : 'Sin minutas registradas'}
                        </span>
                      </Space>
                    </div>

                    <Paragraph className="!mb-0 max-w-3xl text-base leading-7 text-slate-500">
                      {project.description ||
                        'Gestiona el contexto del proyecto, su narrativa de negocio y las minutas clave del equipo QA en un solo espacio.'}
                    </Paragraph>

                    <Space size={[10, 10]} wrap>
                      <Tag variant="filled" className="rounded-full px-3 py-1 text-slate-500">
                        {project.teamMembers?.length || 0} participantes base
                      </Tag>
                      <Tag variant="filled" className="rounded-full px-3 py-1 text-slate-500">
                        {businessRuleItems.length} reglas activas
                      </Tag>
                    </Space>
                  </div>
                </div>

                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleEditProject}
                  className="h-12 rounded-2xl px-6 font-semibold"
                >
                  Editar organizacion
                </Button>
              </div>

              <Row gutter={[20, 20]}>
                <Col xs={24} md={12}>
                  <ExecutiveInfoCard
                    icon={<BulbOutlined className="text-2xl" />}
                    title="Project Overview"
                    accent={qaPalette.primary}
                  >
                    <Paragraph className="!mb-0 text-base leading-8 text-slate-600">
                      {project.description ||
                        'Main enterprise platform for core services and operational quality management.'}
                    </Paragraph>
                  </ExecutiveInfoCard>
                </Col>
                <Col xs={24} md={12}>
                  <ExecutiveInfoCard
                    icon={<EyeOutlined className="text-2xl" />}
                    title="Purpose and Vision"
                    accent={qaPalette.accent}
                  >
                    <Paragraph className="!mb-0 text-base leading-8 text-slate-600">
                      {project.purpose ||
                        'Define aqui el objetivo estrategico del proyecto y la vision que guia al equipo.'}
                    </Paragraph>
                  </ExecutiveInfoCard>
                </Col>
              </Row>

              <Row gutter={[20, 20]}>
                <Col xs={24} md={12}>
                  <Card
                    variant="borderless"
                    className="h-full rounded-[28px] qa-surface-card"
                    styles={{ body: { padding: 28 } }}
                  >
                    <div className="mb-6 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"
                          style={{ color: qaPalette.primary }}
                        >
                          <SafetyOutlined className="text-xl" />
                        </div>
                        <div>
                          <Title level={4} className="!mb-0 !text-slate-900">
                            Core Requirements
                          </Title>
                          <Text className="text-slate-400">
                            {project.coreRequirements?.length || 0} items clave
                          </Text>
                        </div>
                      </div>
                    </div>

                    {Array.isArray(project.coreRequirements) &&
                    project.coreRequirements.length > 0 ? (
                      <div className="space-y-4">
                        {project.coreRequirements.map((requirement, index) => (
                          <div key={`${requirement}-${index}`} className="flex items-start gap-3">
                            <div
                              className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: softSurface(qaPalette.primary),
                                color: qaPalette.primary,
                              }}
                            >
                              <CheckCircleOutlined />
                            </div>
                            <Text className="text-base leading-7 text-slate-700">
                              {requirement}
                            </Text>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No hay requerimientos core definidos."
                      />
                    )}
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card
                    variant="borderless"
                    className="h-full rounded-[28px] qa-surface-card"
                    styles={{ body: { padding: 28 } }}
                  >
                    <div className="mb-6 flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"
                        style={{ color: qaPalette.functionalityStatus.inProgress }}
                      >
                        <CheckCircleOutlined className="text-xl" />
                      </div>
                      <div>
                        <Title level={4} className="!mb-0 !text-slate-900">
                          Business Rules
                        </Title>
                        <Text className="text-slate-400">Lineamientos operativos del proyecto</Text>
                      </div>
                    </div>

                    {businessRuleItems.length > 0 ? (
                      <div className="space-y-4">
                        {businessRuleItems.map((rule, index) => {
                          const accent = index % 2 === 0 ? qaPalette.primary : qaPalette.accent;
                          return (
                            <div
                              key={`${rule}-${index}`}
                              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
                              style={{ borderLeft: `4px solid ${accent}` }}
                            >
                              <Text className="block text-base font-semibold text-slate-800">
                                {rule}
                              </Text>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No hay reglas de negocio definidas."
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            variant="borderless"
            className="h-full rounded-[30px] qa-surface-card"
            styles={{ body: { padding: 24 } }}
          >
            <div className="flex h-full flex-col gap-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: softSurface(qaPalette.primary),
                      color: qaPalette.primary,
                    }}
                  >
                    <MessageOutlined className="text-xl" />
                  </div>
                  <div>
                    <Title level={4} className="!mb-0 !text-slate-900">
                      Minutas de Reunion
                    </Title>
                    <Text className="text-slate-400">Seguimiento de conversaciones y acuerdos</Text>
                  </div>
                </div>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={handleAddNote}
                  className="rounded-2xl"
                />
              </div>

              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <MeetingInsightCard
                    title="Minutas"
                    value={noteStats.totalNotes}
                    helper="sesiones registradas"
                    accent={qaPalette.primary}
                  />
                </Col>
                <Col span={12}>
                  <MeetingInsightCard
                    title="Participantes"
                    value={noteStats.uniqueParticipants}
                    helper="personas unicas"
                    accent={qaPalette.accent}
                  />
                </Col>
              </Row>

              <div className="space-y-4">
                {meetingNotes.length > 0 ? (
                  meetingNotes
                    .slice()
                    .sort((left, right) => dayjs(right.date).valueOf() - dayjs(left.date).valueOf())
                    .map(note => {
                      const noteParticipants = splitParticipants(note.participants);
                      return (
                        <Card
                          key={note.id}
                          hoverable
                          variant="borderless"
                          className="rounded-[24px] border border-slate-100 bg-white/90"
                          styles={{ body: { padding: 18 } }}
                          onClick={() => renderNoteDetails(note)}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <Tag
                                variant="filled"
                                className="rounded-full px-3 py-1 font-semibold"
                                style={{
                                  color: qaPalette.primary,
                                  backgroundColor: softSurface(qaPalette.primary),
                                }}
                              >
                                General
                              </Tag>
                              <Text className="text-xs text-slate-400">{note.date}</Text>
                            </div>

                            <div>
                              <Title level={5} className="!mb-2 !text-slate-900">
                                Reunion de Avance Semanal
                              </Title>
                              <Space size={12} wrap className="text-sm text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <ClockCircleOutlined />
                                  {note.time}
                                </span>
                              </Space>
                            </div>

                            <Avatar.Group size="small" max={{ count: 3 }}>
                              {noteParticipants.map(participant => (
                                <Avatar
                                  key={`${note.id}-${participant}`}
                                  src={participantLookup.get(normalizeParticipantKey(participant))?.avatarUrl}
                                  style={{
                                    background: `linear-gradient(135deg, ${qaPalette.primary} 0%, ${qaPalette.accent} 100%)`,
                                  }}
                                >
                                  {getInitials(participant)}
                                </Avatar>
                              ))}
                            </Avatar.Group>

                            <Space size={[8, 8]} wrap>
                              {note.aiSummary && (
                                <Tag
                                  variant="filled"
                                  className="rounded-full px-3 py-1"
                                  style={{ color: '#6d28d9', backgroundColor: '#efe7ff' }}
                                >
                                  IA
                                </Tag>
                              )}
                              {noteParticipants.slice(0, 2).map(participant => (
                                <Tag
                                  key={`${note.id}-tag-${participant}`}
                                  variant="filled"
                                  className="rounded-full px-3 py-1 text-slate-500"
                                >
                                  {participant}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        </Card>
                      );
                    })
                ) : (
                  <Card
                    variant="borderless"
                    className="rounded-[24px] border border-dashed border-slate-200 bg-white/60 text-center"
                    styles={{ body: { padding: 28 } }}
                  >
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No hay minutas registradas"
                    >
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAddNote}
                        className="rounded-2xl px-5 font-semibold"
                      >
                        Nueva minuta
                      </Button>
                    </Empty>
                  </Card>
                )}

                <button
                  type="button"
                  onClick={handleAddNote}
                  className="flex w-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white/55 px-6 py-10 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--qa-color-accent)] hover:bg-white"
                >
                  <div className="space-y-3">
                    <div
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: softSurface(qaPalette.primary),
                        color: qaPalette.primary,
                      }}
                    >
                      <PlusOutlined className="text-lg" />
                    </div>
                    <div>
                      <Text className="block text-base font-semibold text-slate-700">
                        Nueva minuta de reunion
                      </Text>
                      <Text className="text-slate-400">
                        Documenta acuerdos, bloqueos y siguientes pasos.
                      </Text>
                    </div>
                  </div>
                </button>
              </div>

              <div
                className="mt-auto rounded-[28px] p-6 text-white"
                style={{
                  background: `linear-gradient(135deg, ${qaPalette.primary} 0%, ${qaPalette.primary} 100%)`,
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Text className="!text-white">Project Progress</Text>
                  <Text className="!text-white/75">{completionPercent}%</Text>
                </div>
                <Progress
                  percent={completionPercent}
                  showInfo={false}
                  strokeColor={qaPalette.accent}
                  railColor="rgba(255,255,255,0.16)"
                  size={{ height: 8 }}
                />
                <Text className="mt-4 block !text-white/80">
                  {noteStats.aiEnhanced} minutas mejoradas con IA y{' '}
                  {project.coreRequirements?.length || 0} requerimientos documentados.
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            Editar Informacion de la Organizacion
          </span>
        }
        open={isEditProjectModalOpen}
        onOk={handleSaveProject}
        onCancel={() => setIsEditProjectModalOpen(false)}
        width={760}
        centered
        okText="Guardar cambios"
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={projectForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="organizationName"
                label="Nombre de la organizacion"
                rules={[{ required: true }]}
              >
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="description" label="Descripcion general">
                <Input size="large" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purpose" label="Objetivo del proyecto">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="coreRequirements" label="Requisitos basicos (uno por linea)">
            <Input.TextArea
              rows={5}
              placeholder="Ej: Autenticacion biometrica&#10;Pasarela de pagos"
            />
          </Form.Item>
          <Form.Item name="businessRules" label="Normas empresariales">
            <Input.TextArea rows={5} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            {selectedNote ? 'Editar Minuta' : 'Nueva Minuta de Reunion'}
          </span>
        }
        open={isNoteModalOpen}
        onOk={handleSaveNote}
        onCancel={() => setIsNoteModalOpen(false)}
        width={860}
        centered
        okText="Guardar minuta"
        cancelText="Cancelar"
        destroyOnHidden
      >
        <Form form={noteForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="date" label="Fecha de la reunion" rules={[{ required: true }]}>
                <DatePicker className="h-11 w-full rounded-2xl" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="time" label="Hora de la reunion" rules={[{ required: true }]}>
                <TimePicker className="h-11 w-full rounded-2xl" format="HH:mm" minuteStep={5} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="participants" label="Participantes" rules={[{ required: true }]}>
            <SlackMemberSelect
              size="large"
              members={slackMembers}
              valueField="fullName"
              extraOptions={participantOptions}
              placeholder="Selecciona participantes de la reunion"
              className="rounded-2xl"
              loading={isSlackMembersLoading}
            />
          </Form.Item>

          {slackMembersError ? (
            <Alert
              type="warning"
              showIcon
              className="mb-4 rounded-2xl"
              message="No se pudieron cargar los miembros de Slack"
              description="Puedes seguir escribiendo participantes manualmente mientras revisamos la configuracion del token o los permisos users:read."
            />
          ) : (
            <div className="mb-4 text-xs text-slate-500">
              Selecciona desde Slack o escribe nombres manualmente si necesitas agregar invitados.
            </div>
          )}

          <Form.Item
            name="notes"
            label={
              <div className="flex w-full items-center justify-between gap-3">
                <span>Notas de la reunion</span>
                <Space size={8}>
                  <Button
                    size="small"
                    icon={<KeyOutlined />}
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className="rounded-full text-[10px] font-bold h-7"
                  >
                    API Key
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<RobotOutlined />}
                    onClick={handleImproveWithAI}
                    loading={isImproving}
                    className="rounded-full text-[10px] font-bold h-7"
                  >
                    Mejorar con IA
                  </Button>
                </Space>
              </div>
            }
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={8}
              className="rounded-2xl"
              placeholder="Escribe acuerdos, bloqueos, decisiones y proximos pasos..."
            />
          </Form.Item>

          {selectedNote?.aiSummary && (
            <div className="mt-4 rounded-2xl border border-purple-100 bg-purple-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <RobotOutlined className="text-purple-600" />
                <span className="text-sm font-bold text-purple-800">Vista previa de mejora IA</span>
              </div>
              <Text className="text-sm text-slate-700">{selectedNote.aiSummary}</Text>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title="Configurar Gemini API Key"
        open={isApiKeyModalOpen}
        onCancel={() => setIsApiKeyModalOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
        zIndex={2100}
        maskClosable={false}
        destroyOnHidden
        onOk={async () => {
          const trimmed = apiKeyInput.trim();
          if (!trimmed) {
            message.warning('Ingresa una API Key valida');
            return;
          }
          localStorage.setItem('GEMINI_API_KEY', trimmed);
          setIsApiKeyModalOpen(false);
          setApiKeyInput('');

          const currentNotes = noteForm.getFieldValue('notes');
          if (currentNotes) {
            await handleImproveWithAI();
          }
        }}
      >
        <div className="space-y-3">
          <Text type="secondary">
            Esta llave se guardara en tu navegador para habilitar la mejora con IA.
          </Text>
          <Input.Password
            placeholder="AIza..."
            value={apiKeyInput}
            onChange={event => setApiKeyInput(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        title={null}
        open={isViewNoteModalOpen}
        onCancel={() => setIsViewNoteModalOpen(false)}
        footer={[
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              if (!selectedNote) return;
              handleEditNote(selectedNote);
            }}
          >
            Editar minuta
          </Button>,
          <Button
            key="delete"
            danger
            onClick={() => {
              if (!selectedNote) return;
              Modal.confirm({
                title: 'Eliminar minuta',
                content: 'Esta accion no se puede deshacer.',
                onOk: async () => {
                  await deleteMeetingNote(selectedNote.id);
                  setIsViewNoteModalOpen(false);
                },
              });
            }}
          >
            Eliminar
          </Button>,
          <Button key="close" onClick={() => setIsViewNoteModalOpen(false)}>
            Cerrar
          </Button>,
        ]}
        width={960}
        centered
        destroyOnHidden
      >
        {selectedNote && (
          <div className="pt-6">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: softSurface(qaPalette.primary),
                    color: qaPalette.primary,
                  }}
                >
                  <FileTextOutlined className="text-2xl" />
                </div>
                <div>
                  <Title level={4} className="!mb-1 !text-slate-900">
                    Minuta de Reunion
                  </Title>
                  <Space size={16} wrap className="text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <CalendarOutlined />
                      {selectedNote.date}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <ClockCircleOutlined />
                      {selectedNote.time}
                    </span>
                  </Space>
                </div>
              </div>

              {selectedNote.aiSummary && (
                <Tag
                  variant="filled"
                  className="rounded-full px-4 py-1 font-bold"
                  style={{ color: '#6d28d9', backgroundColor: '#efe7ff' }}
                >
                  <RobotOutlined /> Mejorado con IA
                </Tag>
              )}
            </div>

            <Row gutter={[24, 24]}>
              <Col xs={24} lg={selectedNote.aiSummary ? 11 : 24}>
                <div className="space-y-6">
                  <Card
                    variant="borderless"
                    className="rounded-[24px] qa-surface-card"
                    styles={{ body: { padding: 24 } }}
                  >
                    <Text className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Participantes
                    </Text>
                    <Space size={[8, 8]} wrap>
                      {splitParticipants(selectedNote.participants).map(participant => (
                        <Tag
                          key={`${selectedNote.id}-${participant}`}
                          variant="filled"
                          className="rounded-full px-3 py-1"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Avatar
                              size={20}
                              src={
                                participantLookup.get(normalizeParticipantKey(participant))?.avatarUrl
                              }
                              icon={<UserOutlined />}
                            />
                            <span>{participant}</span>
                          </span>
                        </Tag>
                      ))}
                    </Space>
                  </Card>

                  <Card
                    variant="borderless"
                    className="rounded-[24px] qa-surface-card"
                    styles={{ body: { padding: 24 } }}
                  >
                    <Text className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Notas originales
                    </Text>
                    <Paragraph className="!mb-0 whitespace-pre-wrap leading-8 text-slate-700">
                      {selectedNote.notes}
                    </Paragraph>
                  </Card>
                </div>
              </Col>

              {selectedNote.aiSummary && (
                <Col xs={24} lg={13}>
                  <Card
                    variant="borderless"
                    className="h-full rounded-[24px]"
                    styles={{ body: { padding: 24 } }}
                    style={{ background: 'linear-gradient(180deg, #f7f2ff 0%, #ffffff 100%)' }}
                  >
                    <div className="space-y-5">
                      <div>
                        <Text className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600">
                          Resumen de la reunion
                        </Text>
                        <Paragraph className="!mb-0 text-slate-700">
                          {selectedNote.aiSummary}
                        </Paragraph>
                      </div>
                      <Divider className="my-0" />
                      <div>
                        <Text className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600">
                          Decisiones
                        </Text>
                        <Paragraph className="!mb-0 text-slate-700">
                          {selectedNote.aiDecisions}
                        </Paragraph>
                      </div>
                      <Divider className="my-0" />
                      <div>
                        <Text className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600">
                          Acciones a realizar
                        </Text>
                        <Paragraph className="!mb-0 text-slate-700">
                          {selectedNote.aiActions}
                        </Paragraph>
                      </div>
                      <Divider className="my-0" />
                      <div>
                        <Text className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600">
                          Proximos pasos
                        </Text>
                        <Paragraph className="!mb-0 text-slate-700">
                          {selectedNote.aiNextSteps}
                        </Paragraph>
                      </div>
                    </div>
                  </Card>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
