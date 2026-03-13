import React, { useState } from 'react';
import { Card, Row, Col, Typography, Button, Modal, Form, Input, Upload, message, Divider, Space, List, Tag, Empty, Avatar } from 'antd';
import { 
  EditOutlined, 
  UploadOutlined, 
  PlusOutlined, 
  RobotOutlined, 
  CalendarOutlined, 
  UserOutlined, 
  ClockCircleOutlined, 
  FileTextOutlined,
  BulbOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  MessageOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { Project, MeetingNote } from '../types';
import { useProjects, useMeetingNotes } from '../hooks';
import { getGeminiApiKey } from '../services/geminiService';
import { GoogleGenAI } from "@google/genai";

const { Title, Text, Paragraph } = Typography;

export default function AboutView({ project }: { project: Project }) {
  const { save: saveProject } = useProjects();
  const { data: meetingNotes = [], save: saveMeetingNote, delete: deleteMeetingNote } = useMeetingNotes(project.id);
  
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isViewNoteModalOpen, setIsViewNoteModalOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<MeetingNote | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  
  const [projectForm] = Form.useForm();
  const [noteForm] = Form.useForm();

  const handleEditProject = () => {
    projectForm.setFieldsValue({
      organizationName: project.organizationName || project.name,
      description: project.description,
      purpose: project.purpose,
      coreRequirements: Array.isArray(project.coreRequirements) ? project.coreRequirements.join('\n') : project.coreRequirements,
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
        coreRequirements: values.coreRequirements ? values.coreRequirements.split('\n').filter((r: string) => r.trim()) : [],
        businessRules: values.businessRules,
      };
      await saveProject(updatedProject);
      setIsEditProjectModalOpen(false);
      message.success('Información de la organización actualizada');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleAddNote = () => {
    setSelectedNote(null);
    noteForm.resetFields();
    noteForm.setFieldsValue({ date: new Date().toISOString().split('T')[0] });
    setIsNoteModalOpen(true);
  };

  const handleSaveNote = async () => {
    try {
      const values = await noteForm.validateFields();
      const note: MeetingNote = {
        id: selectedNote?.id || `note-${Date.now()}`,
        projectId: project.id,
        ...values,
        aiSummary: selectedNote?.aiSummary,
        aiDecisions: selectedNote?.aiDecisions,
        aiActions: selectedNote?.aiActions,
        aiNextSteps: selectedNote?.aiNextSteps,
      };
      await saveMeetingNote(note);
      setIsNoteModalOpen(false);
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
      const prompt = `Reorganiza las siguientes notas de reunión en un formato estructurado con las siguientes secciones:
      1. Resumen de la reunión
      2. Decisiones
      3. Acciones a realizar
      4. Próximos pasos

      Notas:
      ${notes}

      Responde ÚNICAMENTE con un objeto JSON que tenga las llaves: summary, decisions, actions, nextSteps.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text || '{}');
      
      // Update selectedNote state so when saving it includes the AI parts
      setSelectedNote(prev => prev ? {
        ...prev,
        aiSummary: result.summary,
        aiDecisions: result.decisions,
        aiActions: result.actions,
        aiNextSteps: result.nextSteps,
      } : {
        id: `note-${Date.now()}`,
        projectId: project.id,
        date: noteForm.getFieldValue('date'),
        time: noteForm.getFieldValue('time'),
        participants: noteForm.getFieldValue('participants'),
        notes: notes,
        aiSummary: result.summary,
        aiDecisions: result.decisions,
        aiActions: result.actions,
        aiNextSteps: result.nextSteps,
      } as MeetingNote);

      message.success('Notas mejoradas con IA');
    } catch (error) {
      console.error('AI Improvement failed:', error);
      const anyErr: any = error as any;
      const msg = (error instanceof Error ? error.message : anyErr?.message) || '';
      const nestedMessage = (anyErr?.error?.message || anyErr?.message || '').toString();
      const reason = anyErr?.error?.details?.[0]?.reason || anyErr?.details?.[0]?.reason;
      const isLeakedKey = /reported as leaked/i.test(nestedMessage);
      const isInvalidKey =
        reason === 'API_KEY_INVALID' ||
        /api key not valid/i.test(nestedMessage) ||
        isLeakedKey;

      if (msg === 'GEMINI_API_KEY_MISSING') {
        message.warning('Configura tu API Key de Gemini para usar la mejora con IA.');
        setIsApiKeyModalOpen(true);
      } else if (isInvalidKey) {
        localStorage.removeItem('GEMINI_API_KEY');
        message.error(
          isLeakedKey
            ? 'API Key comprometida (reportada como filtrada). Genera una nueva API Key.'
            : 'API Key inválida. Ingresa una API Key válida de Gemini.'
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
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
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
    <div className="space-y-6 pb-10">
      {/* Header Card */}
      <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar 
                size={80} 
                src={project.logo} 
                icon={!project.logo && <BulbOutlined />}
                className="bg-slate-100 border-2 border-slate-200 text-slate-400 flex items-center justify-center"
              />
              <Upload
                showUploadList={false}
                beforeUpload={handleBeforeUpload}
                accept=".png,.jpg,.jpeg,.svg"
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center bg-black/20 rounded-full"
              >
                <UploadOutlined className="text-white text-xl" />
              </Upload>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <Title level={2} className="m-0 font-bold text-slate-800">
                  {project.organizationName || project.name}
                </Title>
                <Tag color="blue" className="rounded-full px-3 font-bold uppercase text-[10px]">Organización</Tag>
              </div>
              <Text type="secondary" className="text-slate-500">
                {project.description || 'Gestión de identidad corporativa y lineamientos de negocio.'}
              </Text>
            </div>
          </div>
          <Button 
            icon={<EditOutlined />} 
            onClick={handleEditProject}
            className="rounded-lg h-10 px-4 flex items-center gap-2"
          >
            Editar Organización
          </Button>
        </div>
      </Card>

      <Row gutter={[24, 24]}>
        {/* Left Column: Info Cards */}
        <Col xs={24} lg={16} className="space-y-6">
          <Card 
            className="rounded-2xl border-slate-100 shadow-sm"
            title={
              <div className="flex items-center gap-2">
                <BulbOutlined className="text-blue-500" />
                <span className="font-bold text-slate-800">Propósito y Visión</span>
              </div>
            }
          >
            <Paragraph className="text-slate-600 leading-relaxed m-0">
              {project.purpose || 'No se ha definido el propósito del proyecto.'}
            </Paragraph>
          </Card>

          <Card 
            className="rounded-2xl border-slate-100 shadow-sm"
            title={
              <div className="flex items-center gap-2">
                <SafetyOutlined className="text-emerald-500" />
                <span className="font-bold text-slate-800">Requerimientos Core</span>
              </div>
            }
          >
            {Array.isArray(project.coreRequirements) && project.coreRequirements.length > 0 ? (
              <ul className="space-y-2 m-0 p-0 list-none">
                {project.coreRequirements.map((req, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-slate-600">
                    <CheckCircleOutlined className="text-emerald-500 mt-1 flex-shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Text type="secondary" italic>No hay requerimientos core definidos.</Text>
            )}
          </Card>

          <Card 
            className="rounded-2xl border-slate-100 shadow-sm"
            title={
              <div className="flex items-center gap-2">
                <CheckCircleOutlined className="text-amber-500" />
                <span className="font-bold text-slate-800">Reglas de Negocio</span>
              </div>
            }
          >
            <Paragraph className="text-slate-600 leading-relaxed m-0 whitespace-pre-wrap">
              {project.businessRules || 'No hay reglas de negocio definidas.'}
            </Paragraph>
          </Card>
        </Col>

        {/* Right Column: Meeting Notes */}
        <Col xs={24} lg={8}>
          <Card 
            className="rounded-2xl border-slate-100 shadow-sm h-full"
            title={
              <div className="flex items-center gap-2">
                <MessageOutlined className="text-purple-500" />
                <span className="font-bold text-slate-800">Minutas de Reunión</span>
              </div>
            }
            extra={
              <Button 
                type="text" 
                icon={<PlusOutlined />} 
                onClick={handleAddNote}
                className="text-slate-400 hover:text-blue-600"
              />
            }
          >
            {meetingNotes.length > 0 ? (
              <List
                dataSource={meetingNotes}
                renderItem={(note: MeetingNote) => (
                  <List.Item 
                    className="px-0 py-4 hover:bg-slate-50 transition-colors cursor-pointer rounded-lg px-2"
                    onClick={() => renderNoteDetails(note)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <CalendarOutlined className="text-purple-500" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <Text strong className="text-slate-800">{note.date}</Text>
                          <Text type="secondary" className="text-[10px]">{note.time}</Text>
                        </div>
                        <Text type="secondary" className="text-xs block truncate">
                          {note.participants}
                        </Text>
                        {note.aiSummary && (
                          <Tag color="purple" className="mt-2 rounded-full text-[10px] font-bold border-none bg-purple-50 text-purple-600">
                            <RobotOutlined className="mr-1" /> IA
                          </Tag>
                        )}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Empty description={<span className="text-slate-400">No hay minutas registradas</span>} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Edit Project Modal */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">Editar Información de la Organización</span>}
        open={isEditProjectModalOpen}
        onOk={handleSaveProject}
        onCancel={() => setIsEditProjectModalOpen(false)}
        width={700}
        centered
        okText="Guardar Cambios"
        cancelText="Cancelar"
        className="executive-modal"
      >
        <Form form={projectForm} layout="vertical" className="mt-4">
          <Form.Item name="organizationName" label={<span className="font-semibold text-slate-600">Nombre de la Organización</span>} rules={[{ required: true }]}>
            <Input className="h-10 rounded-lg" />
          </Form.Item>
          <Form.Item name="description" label={<span className="font-semibold text-slate-600">Descripción General</span>}>
            <Input.TextArea rows={3} className="rounded-lg" />
          </Form.Item>
          <Form.Item name="purpose" label={<span className="font-semibold text-slate-600">Objetivo del Proyecto</span>}>
            <Input.TextArea rows={3} className="rounded-lg" />
          </Form.Item>
          <Form.Item name="coreRequirements" label={<span className="font-semibold text-slate-600">Requisitos Básicos (uno por línea)</span>}>
            <Input.TextArea rows={4} className="rounded-lg" placeholder="Ej: Autenticación biométrica&#10;Pasarela de pagos" />
          </Form.Item>
          <Form.Item name="businessRules" label={<span className="font-semibold text-slate-600">Normas Empresariales</span>}>
            <Input.TextArea rows={4} className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add/Edit Note Modal */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">{selectedNote ? 'Editar Minuta' : 'Nueva Minuta de Reunión'}</span>}
        open={isNoteModalOpen}
        onOk={handleSaveNote}
        onCancel={() => setIsNoteModalOpen(false)}
        width={800}
        centered
        okText="Guardar Minuta"
        cancelText="Cancelar"
        className="executive-modal"
      >
        <Form form={noteForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label={<span className="font-semibold text-slate-600">Fecha de la Reunión</span>} rules={[{ required: true }]}>
                <Input type="date" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="time" label={<span className="font-semibold text-slate-600">Hora de la Reunión</span>} rules={[{ required: true }]}>
                <Input type="time" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="participants" label={<span className="font-semibold text-slate-600">Participantes</span>} rules={[{ required: true }]}>
            <Input placeholder="Ej: Juan Pérez, María García, Cliente X" className="h-10 rounded-lg" />
          </Form.Item>
          <Form.Item 
            name="notes" 
            label={
              <div className="flex justify-between items-center w-full">
                <span className="font-semibold text-slate-600">Notas de la Reunión</span>
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
                  className="rounded-full bg-purple-600 hover:bg-purple-700 border-none text-[10px] font-bold h-7"
                >
                  Mejorar con IA
                </Button>
                </Space>
              </div>
            } 
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={8} className="rounded-lg" placeholder="Escribe las notas libres aquí..." />
          </Form.Item>
          
          {selectedNote?.aiSummary && (
            <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <RobotOutlined className="text-purple-600" />
                <span className="font-bold text-purple-800 text-sm">Vista Previa de Mejora IA</span>
              </div>
              <div className="space-y-3">
                <div>
                  <Text strong className="text-xs text-purple-700 block">Resumen:</Text>
                  <Text className="text-xs text-slate-600">{selectedNote.aiSummary}</Text>
                </div>
              </div>
              <Text type="secondary" className="text-[10px] block mt-3 italic">
                * El resumen completo se guardará y podrá verse en el detalle de la minuta.
              </Text>
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
        onOk={async () => {
          const trimmed = apiKeyInput.trim();
          if (!trimmed) {
            message.warning('Ingresa una API Key válida');
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
        <div className="space-y-2">
          <Text type="secondary">
            Esta llave se guardará en tu navegador (localStorage) para habilitar la mejora con IA.
          </Text>
          <Input.Password
            placeholder="AIza..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
        </div>
      </Modal>

      {/* View Note Modal */}
      <Modal
        title={null}
        open={isViewNoteModalOpen}
        onCancel={() => setIsViewNoteModalOpen(false)}
        footer={[
          <Button key="delete" danger onClick={() => {
            if (selectedNote) {
              Modal.confirm({
                title: '¿Eliminar minuta?',
                content: 'Esta acción no se puede deshacer.',
                onOk: () => {
                  deleteMeetingNote(selectedNote.id);
                  setIsViewNoteModalOpen(false);
                }
              });
            }
          }}>Eliminar</Button>,
          <Button key="close" onClick={() => setIsViewNoteModalOpen(false)}>Cerrar</Button>
        ]}
        width={900}
        centered
        className="executive-modal"
      >
        {selectedNote && (
          <div className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <FileTextOutlined className="text-purple-600 text-xl" />
                </div>
                <div>
                  <Title level={4} className="m-0 text-slate-800">Minuta de Reunión</Title>
                  <Space className="text-slate-400 text-xs">
                    <span><CalendarOutlined /> {selectedNote.date}</span>
                    <span><ClockCircleOutlined /> {selectedNote.time}</span>
                  </Space>
                </div>
              </div>
              {selectedNote.aiSummary && <Tag color="purple" className="rounded-full px-4 py-1 font-bold border-none bg-purple-50 text-purple-600"><RobotOutlined /> Mejorado con IA</Tag>}
            </div>

            <Row gutter={24}>
              <Col span={selectedNote.aiSummary ? 12 : 24}>
                <div className="space-y-6">
                  <div>
                    <Text strong className="text-slate-500 uppercase text-[10px] tracking-widest block mb-2">Participantes</Text>
                    <div className="flex items-center gap-2 text-slate-700">
                      <UserOutlined className="text-slate-400" />
                      <span>{selectedNote.participants}</span>
                    </div>
                  </div>
                  <Divider className="m-0" />
                  <div>
                    <Text strong className="text-slate-500 uppercase text-[10px] tracking-widest block mb-2">Notas Originales</Text>
                    <Paragraph className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {selectedNote.notes}
                    </Paragraph>
                  </div>
                </div>
              </Col>

              {selectedNote.aiSummary && (
                <Col span={12}>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-6 h-full">
                    <div>
                      <Text strong className="text-purple-600 uppercase text-[10px] tracking-widest block mb-2">Resumen de la Reunión</Text>
                      <Paragraph className="text-slate-700 text-sm leading-relaxed">
                        {selectedNote.aiSummary}
                      </Paragraph>
                    </div>
                    <div>
                      <Text strong className="text-purple-600 uppercase text-[10px] tracking-widest block mb-2">Decisiones</Text>
                      <Paragraph className="text-slate-700 text-sm leading-relaxed">
                        {selectedNote.aiDecisions}
                      </Paragraph>
                    </div>
                    <div>
                      <Text strong className="text-purple-600 uppercase text-[10px] tracking-widest block mb-2">Acciones a Realizar</Text>
                      <Paragraph className="text-slate-700 text-sm leading-relaxed">
                        {selectedNote.aiActions}
                      </Paragraph>
                    </div>
                    <div>
                      <Text strong className="text-purple-600 uppercase text-[10px] tracking-widest block mb-2">Próximos Pasos</Text>
                      <Paragraph className="text-slate-700 text-sm leading-relaxed">
                        {selectedNote.aiNextSteps}
                      </Paragraph>
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
