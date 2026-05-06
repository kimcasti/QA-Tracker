import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, Upload, message } from 'antd';
import { BugOutlined, DeleteOutlined, EditOutlined, PlusOutlined, MinusOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useBugs } from '../modules/bugs/hooks/useBugs';
import { BugOrigin, BugStatus, Severity, type QABug } from '../types';
import { qaPalette } from '../theme/palette';
import { bugStatusColors, softTagStyle } from '../theme/statusStyles';
import { normalizeEvidenceHtml, stripHtmlToText } from '../utils/evidenceRichText';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { readFileAsDataUrl, validateInlineImageFile } from '../utils/uploadValidation';

const { Text } = Typography;
const { TextArea } = Input;

function renderRichTextContent(value?: string | null) {
  const normalizedHtml = normalizeEvidenceHtml(value);
  const plainText = stripHtmlToText(value);

  if (!normalizedHtml || !plainText) {
    return <p className="mt-1 text-sm text-slate-500">-</p>;
  }

  return (
    <div
      className="qa-rich-text-content mt-1 text-sm text-slate-700"
      dangerouslySetInnerHTML={{ __html: normalizedHtml }}
    />
  );
}

function formatOriginLabel(record: QABug) {
  const showCycleId =
    record.cycleId &&
    (record.origin === BugOrigin.REGRESSION_CYCLE || record.origin === BugOrigin.SMOKE_CYCLE);

  return showCycleId ? `${record.origin} - ${record.cycleId}` : record.origin;
}

export default function BugHistoryView({ projectId }: { projectId?: string }) {
  const { data: bugsData = [], save: saveBug } = useBugs(projectId);
  const { isViewer } = useWorkspaceAccess();
  const bugs = Array.isArray(bugsData) ? bugsData : [];

  const [searchText, setSearchText] = useState('');
  const [originFilter, setOriginFilter] = useState<BugOrigin | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<BugStatus | undefined>(undefined);
  const [editingBug, setEditingBug] = useState<QABug | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editingEvidenceImage, setEditingEvidenceImage] = useState<string | undefined>(undefined);
  const [editForm] = Form.useForm<QABug>();

  const filteredBugs = useMemo(() => {
    return bugs.filter(bug => {
      const search = searchText.trim().toLowerCase();
      const matchesSearch =
        !search ||
        bug.internalBugId.toLowerCase().includes(search) ||
        (bug.externalBugId || '').toLowerCase().includes(search) ||
        bug.title.toLowerCase().includes(search) ||
        bug.functionalityName.toLowerCase().includes(search) ||
        bug.module.toLowerCase().includes(search);

      const matchesOrigin = !originFilter || bug.origin === originFilter;
      const matchesStatus = !statusFilter || bug.status === statusFilter;

      return matchesSearch && matchesOrigin && matchesStatus;
    });
  }, [bugs, originFilter, searchText, statusFilter]);

  const handleOpenEdit = (bug: QABug) => {
    setEditingBug(bug);
    setEditingEvidenceImage(bug.evidenceImage || undefined);
    editForm.setFieldsValue({
      internalBugId: bug.internalBugId,
      externalBugId: bug.externalBugId,
      title: bug.title,
      description: bug.description,
      severity: bug.severity,
      bugLink: bug.bugLink,
      status: bug.status,
    } as any);
  };

  const handleCloseEdit = () => {
    setEditingBug(null);
    setEditingEvidenceImage(undefined);
    editForm.resetFields();
  };

  const handleEvidenceUpload = async (file: File) => {
    if (!validateInlineImageFile(file)) return false;

    try {
      const base64 = await readFileAsDataUrl(file);
      setEditingEvidenceImage(base64 || undefined);
      message.success('Evidencia actualizada. Guarda los cambios para persistirla.');
    } catch (error) {
      console.error('Failed to read bug evidence image:', error);
      message.error('No pudimos cargar la imagen.');
    }

    return false;
  };

  const handleSaveEdit = async () => {
    if (!editingBug) return;

    try {
      const values = await editForm.validateFields();
      setIsSavingEdit(true);

      await saveBug({
        ...editingBug,
        externalBugId: values.externalBugId?.trim() || undefined,
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        severity: values.severity,
        bugLink: values.bugLink?.trim() || undefined,
        evidenceImage: editingEvidenceImage,
        status: values.status,
        updatedAt: dayjs().toISOString(),
      });

      message.success('Bug actualizado correctamente.');
      handleCloseEdit();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      message.error('No pudimos guardar los cambios del bug.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl qa-surface-card">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Buscar
            </span>
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="ID, título, funcionalidad o módulo"
              className="w-72 h-10 rounded-lg"
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Origen
            </span>
            <Select
              allowClear
              placeholder="Todos"
              className="w-52 h-10"
              value={originFilter}
              onChange={setOriginFilter}
              options={Object.values(BugOrigin).map(origin => ({ label: origin, value: origin }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Estado
            </span>
            <Select
              allowClear
              placeholder="Todos"
              className="w-40 h-10"
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.values(BugStatus).map(status => ({ label: status, value: status }))}
            />
          </div>
        </div>
      </Card>

      <Card
        className="rounded-2xl qa-surface-card"
        title={
          <div className="flex items-center gap-2">
            <BugOutlined style={{ color: qaPalette.functionalityStatus.failed }} />
            <span className="font-bold text-slate-800">Historial de Bugs</span>
            <Tag className="m-0 rounded-full bg-slate-100 border-slate-200 text-slate-600">
              {filteredBugs.length}
            </Tag>
          </div>
        }
      >
        <Table
          rowKey="internalBugId"
          dataSource={filteredBugs}
          pagination={{ pageSize: 8 }}
          tableLayout="auto"
          expandable={{
            expandedRowRender: (record: QABug) => (
              <div className="rounded-xl bg-slate-50 p-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <Text strong>Descripción:</Text>
                    {renderRichTextContent(record.description)}
                  </div>
                  <div>
                    <Text strong>Evidencia:</Text>
                    {record.evidenceImage ? (
                      <div className="mt-2">
                        <img
                          src={record.evidenceImage}
                          alt={`Evidencia ${record.internalBugId}`}
                          className="max-h-72 rounded-xl border border-slate-200"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">-</p>
                    )}
                  </div>
                </div>
              </div>
            ),
            expandIcon: ({ expanded, onExpand, record }) => (
              <button
                type="button"
                aria-label={expanded ? 'Ocultar detalle del bug' : 'Ver detalle del bug'}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-sky-300 hover:text-sky-600"
                onClick={event => onExpand(record, event)}
              >
                {expanded ? (
                  <MinusOutlined className="text-[10px]" />
                ) : (
                  <PlusOutlined className="text-[10px]" />
                )}
              </button>
            ),
          }}
          columns={[
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Bug
                </span>
              ),
              key: 'bug',
              width: '24%',
              render: (_, record: QABug) => (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Text strong className="text-slate-800">
                      {record.title}
                    </Text>
                    {record.severity && (
                      <Tag
                        className="m-0 text-[9px] font-black uppercase border-none px-1.5 rounded-sm"
                        style={{ backgroundColor: qaPalette.text, color: qaPalette.card }}
                      >
                        {record.severity}
                      </Tag>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {record.bugLink ? (
                      <a
                        href={record.bugLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={event => event.stopPropagation()}
                      >
                        <Tag className="m-0 cursor-pointer rounded-md border-slate-200 bg-slate-100 text-slate-600">
                          {record.internalBugId}
                        </Tag>
                      </a>
                    ) : (
                      <Tag className="m-0 rounded-md bg-slate-100 border-slate-200 text-slate-600">
                        {record.internalBugId}
                      </Tag>
                    )}
                    {record.externalBugId && (
                      record.bugLink ? (
                        <a
                          key={`${record.internalBugId}-external`}
                          href={record.bugLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={event => event.stopPropagation()}
                        >
                          <Tag
                            className="m-0 cursor-pointer rounded-md"
                            style={softTagStyle(qaPalette.functionalityStatus.failed)}
                          >
                            {record.externalBugId}
                          </Tag>
                        </a>
                      ) : (
                        <Tag
                          className="m-0 rounded-md"
                          style={softTagStyle(qaPalette.functionalityStatus.failed)}
                        >
                          {record.externalBugId}
                        </Tag>
                      )
                    )}
                  </div>
                </div>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Trazabilidad
                </span>
              ),
              key: 'traceability',
              width: '20%',
              render: (_, record: QABug) => (
                <div className="min-w-0">
                  <div className="font-semibold text-slate-700">{record.functionalityName}</div>
                  <div className="text-xs text-slate-500">
                    {record.functionalityId} • {record.module}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {record.sprint || 'Sin sprint'}
                    {record.cycleId ? ` • ${record.cycleId}` : ''}
                  </div>
                </div>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Origen
                </span>
              ),
              dataIndex: 'origin',
              key: 'origin',
              width: '17%',
              render: (_: BugOrigin, record: QABug) => (
                <Tag className="m-0 rounded-full bg-slate-100 border-slate-200 text-slate-600">
                  {formatOriginLabel(record)}
                </Tag>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Detectado
                </span>
              ),
              key: 'detectedAt',
              width: '12%',
              render: (_, record: QABug) => (
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {dayjs(record.detectedAt).format('DD/MM/YYYY')}
                  </div>
                  <div className="text-xs text-slate-400">
                    {record.reportedBy || 'Sin responsable'}
                  </div>
                </div>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Estado
                </span>
              ),
              key: 'status',
              width: '16%',
              render: (_, record: QABug) => (
                <Space direction="vertical" size={6}>
                  <Tag
                    className="m-0 rounded-full px-3 font-bold uppercase text-[10px]"
                    style={softTagStyle(bugStatusColors[record.status])}
                  >
                    {record.status}
                  </Tag>
                  <Select
                    size="small"
                    className="w-full max-w-[164px]"
                    value={record.status}
                    disabled={record.status === BugStatus.RESOLVED || isViewer}
                    onChange={async status => {
                      await saveBug({ ...record, status, updatedAt: dayjs().toISOString() });
                      message.success(`Estado actualizado a ${status}`);
                    }}
                    options={Object.values(BugStatus).map(status => ({
                      label: status,
                      value: status,
                    }))}
                  />
                </Space>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Accion
                </span>
              ),
              key: 'actions',
              width: '11%',
              render: (_, record: QABug) => (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEdit(record)}
                  disabled={isViewer}
                  className="w-full rounded-lg border-slate-200 px-3 text-slate-600 font-semibold"
                >
                  Editar
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">Editar bug</span>}
        open={Boolean(editingBug)}
        onCancel={handleCloseEdit}
        onOk={() => void handleSaveEdit()}
        okText="Guardar cambios"
        cancelText="Cancelar"
        confirmLoading={isSavingEdit}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Form.Item name="internalBugId" label="ID interno del bug">
            <Input disabled className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="externalBugId" label="ID externo del bug">
            <Input placeholder="Ej: QA-245 o LPAS-567" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="title"
            label="Titulo"
            rules={[{ required: true, message: 'Ingresa el título del bug.' }]}
          >
            <Input placeholder="Resume el error reportado" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="description" label="Descripción">
            <TextArea
              rows={4}
              className="rounded-lg"
              placeholder="Describe el bug, el contexto y el impacto observado."
            />
          </Form.Item>

          <Form.Item label="Evidencia">
            <div className="space-y-3">
              {editingEvidenceImage ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img
                    src={editingEvidenceImage}
                    alt="Evidencia del bug"
                    className="max-h-64 w-full object-contain bg-white"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                  Este bug no tiene imagen de evidencia.
                </div>
              )}

              <Space wrap>
                <Upload
                  accept=".png,.jpg,.jpeg,.webp"
                  beforeUpload={handleEvidenceUpload}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} className="rounded-lg border-slate-200">
                    {editingEvidenceImage ? 'Reemplazar imagen' : 'Subir imagen'}
                  </Button>
                </Upload>

                {editingEvidenceImage ? (
                  <Button
                    icon={<DeleteOutlined />}
                    onClick={() => setEditingEvidenceImage(undefined)}
                    className="rounded-lg border-rose-200 text-rose-600"
                  >
                    Eliminar imagen
                  </Button>
                ) : null}
              </Space>
            </div>
          </Form.Item>

          <Form.Item name="severity" label="Severidad">
            <Select
              allowClear
              placeholder="Selecciona severidad"
              options={Object.values(Severity).map(severity => ({
                label: severity,
                value: severity,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="bugLink"
            label="Link al bug"
            rules={[{ type: 'url', warningOnly: true, message: 'Usa una URL valida.' }]}
          >
            <Input placeholder="https://jira.atlassian.net/browse/..." className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="status"
            label="Estado"
            rules={[{ required: true, message: 'Selecciona el estado del bug.' }]}
          >
            <Select
              options={Object.values(BugStatus).map(status => ({
                label: status,
                value: status,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
