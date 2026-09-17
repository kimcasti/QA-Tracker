import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Form,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd';
import { Priority, TestType, type TestCase } from '../../../types';
import {
  countSteps,
  draftErrors,
  draftToTestCase,
  parseBulkPaste,
  type Draft,
} from '../utils/bulkPaste';
import type { BatchResult } from '../utils/saveBatch';

const labels = {
  title: 'Título',
  description: 'Descripción',
  preconditions: 'Precondiciones',
  testSteps: 'Pasos de prueba',
  expectedResult: 'Resultado esperado',
};
const priorityLabels = {
  [Priority.CRITICAL]: 'Crítica',
  [Priority.HIGH]: 'Alta',
  [Priority.MEDIUM]: 'Media',
  [Priority.LOW]: 'Baja',
};
const example = `Título:
Registro exitoso de una institución

Descripción:
Verificar que el usuario pueda registrar correctamente una institución.

Precondiciones:
- El usuario inició sesión.
- Tiene permisos para crear instituciones.

Pasos de prueba:
1. Acceder al módulo de Instituciones.
2. Hacer clic en Crear.
3. Completar los campos requeridos.
4. Hacer clic en Guardar.

Resultado esperado:
La institución se registra correctamente y aparece en el listado.`;

type Props = {
  projectId: string;
  functionalityId: string;
  functionalityName: string;
  existingCases: TestCase[];
  onClose: () => void;
  onSave: (cases: TestCase[], onProgress: (count: number) => void) => Promise<BatchResult>;
};

export function BulkPasteCasesModal({
  projectId,
  functionalityId,
  functionalityName,
  existingCases,
  onClose,
  onSave,
}: Props) {
  const [source, setSource] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [edited, setEdited] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [uncertainId, setUncertainId] = useState<string>();
  const busy = useRef(false);
  const highestSavedOrder = useRef(-1);
  const [modal, contextHolder] = Modal.useModal();
  const selected = drafts.filter(draft => draft.selected && !draft.created);
  const createLabel = `Crear ${selected.length} ${selected.length === 1 ? 'caso de prueba' : 'casos de prueba'}`;
  const hasCreated = drafts.some(draft => draft.created);
  const patch = (id: string, changes: Partial<Draft>) => {
    setEdited(true);
    setDrafts(previous =>
      previous.map(draft => (draft.id === id ? { ...draft, ...changes } : draft)),
    );
  };
  const close = () => {
    if (busy.current) return;
    if (source.trim() && (!drafts.length || drafts.some(draft => !draft.created))) {
      modal.confirm({
        title: '¿Descartar los casos sin guardar?',
        content: 'Los casos ya creados se conservarán.',
        okText: 'Descartar',
        cancelText: 'Seguir revisando',
        onOk: onClose,
      });
    } else onClose();
  };
  const process = () => {
    const run = () => {
      const result = parseBulkPaste(source);
      setDrafts(result.drafts);
      setWarnings(result.warnings);
      setEdited(false);
      setValidating(false);
      setFeedback(
        result.drafts.length
          ? ''
          : 'No se detectaron casos. Inicia cada caso con el encabezado Título:.',
      );
      setReview(result.drafts.length > 0);
    };
    if (edited)
      modal.confirm({
        title: '¿Reemplazar la vista previa?',
        content: 'Se perderán las ediciones y selecciones realizadas.',
        okText: 'Reprocesar',
        cancelText: 'Cancelar',
        onOk: run,
      });
    else run();
  };
  const save = async () => {
    if (busy.current || uncertainId || !selected.length) return;
    setValidating(true);
    if (selected.some(draft => draftErrors(draft).length)) {
      setFeedback(
        'Completa los campos obligatorios de los casos seleccionados antes de continuar.',
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setProgress(0);
    setFeedback('');
    const nextOrder =
      Math.max(
        -1,
        highestSavedOrder.current,
        ...existingCases
          .filter(item => item.functionalityId === functionalityId)
          .map((item, index) =>
            typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder)
              ? item.sortOrder
              : index,
          ),
      ) + 1;
    const cases = selected.map((draft, index) =>
      draftToTestCase(draft, projectId, functionalityId, nextOrder + index),
    );
    try {
      const result = await onSave(cases, setProgress);
      const confirmed = new Set(result.confirmed.map(item => item.localId));
      const updated = drafts.map(draft =>
        confirmed.has(draft.id) ? { ...draft, created: true, selected: false } : draft,
      );
      setDrafts(updated);
      if (confirmed.size) highestSavedOrder.current = nextOrder + confirmed.size - 1;
      if (result.failed) {
        const failed = drafts.find(draft => draft.id === result.failed!.localId);
        setFeedback(
          `${result.confirmed.length} casos creados. No se pudo confirmar el caso ${failed?.number}: ${result.failed.message}${result.failed.ambiguous ? ' La respuesta es incierta. Cierra este modal y verifica el listado antes de volver a intentar crear los pendientes.' : ' Corrige el problema y continúa con los pendientes.'}`,
        );
        if (result.failed.ambiguous) setUncertainId(result.failed.localId);
      } else if (updated.every(draft => draft.created)) {
        message.success(
          `${result.confirmed.length} ${result.confirmed.length === 1 ? 'caso de prueba creado' : 'casos de prueba creados'}`,
        );
        onClose();
      } else setFeedback(`${result.confirmed.length} casos creados. Quedan casos sin seleccionar.`);
    } catch {
      setUncertainId(selected[0].id);
      setFeedback(
        'No se pudo confirmar el resultado del guardado. Cierra este modal y verifica el listado antes de reintentar.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Pegar casos en bloque"
      width={960}
      onCancel={close}
      maskClosable={false}
      keyboard={!saving}
      closable={!saving}
      footer={[
        <Button key="cancel" disabled={saving} onClick={close}>
          Cerrar
        </Button>,
        review ? (
          <Button key="back" disabled={saving} onClick={() => setReview(false)}>
            Ver contenido original
          </Button>
        ) : null,
        review ? (
          <Button
            key="save"
            type="primary"
            aria-label={createLabel}
            loading={saving}
            disabled={!selected.length || !!uncertainId}
            onClick={() => void save()}
          >
            {createLabel}
          </Button>
        ) : (
          <Button
            key="process"
            type="primary"
            disabled={!source.trim() || hasCreated || !!uncertainId}
            onClick={process}
          >
            Procesar casos
          </Button>
        ),
        !review && drafts.length ? (
          <Button key="review" onClick={() => setReview(true)}>
            Volver a la revisión
          </Button>
        ) : null,
      ]}
    >
      {contextHolder}
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          Los casos se crearán en {functionalityName}.
        </Typography.Text>
        <Steps
          size="small"
          current={saving ? 2 : review ? 1 : 0}
          items={[
            { title: 'Pegar contenido' },
            { title: 'Revisar casos detectados' },
            { title: 'Crear casos' },
          ]}
        />
        {feedback && <Alert role="alert" type="info" showIcon title={feedback} />}
        {warnings.map((warning, index) => (
          <Alert key={index} type="warning" showIcon title={warning} />
        ))}
        {saving && (
          <Progress
            percent={Math.round((progress / Math.max(selected.length, 1)) * 100)}
            format={() => `${progress} / ${selected.length}`}
          />
        )}
        {!review ? (
          <>
            <Typography.Paragraph>
              Pega aquí uno o varios casos de prueba. El sistema identificará y separará
              automáticamente cada caso.
            </Typography.Paragraph>
            <Input.TextArea
              aria-label="Contenido de los casos"
              value={source}
              onChange={event => setSource(event.target.value)}
              rows={16}
              readOnly={hasCreated || !!uncertainId}
            />
            {(hasCreated || uncertainId) && (
              <Alert
                type="info"
                title="El contenido original queda disponible para consulta. Continúa con los pendientes desde la revisión."
              />
            )}
            <Collapse
              items={[
                {
                  key: 'example',
                  label: 'Ver ejemplo del formato',
                  children: <pre style={{ whiteSpace: 'pre-wrap' }}>{example}</pre>,
                },
              ]}
            />
          </>
        ) : (
          <>
            <Checkbox
              disabled={saving || !!uncertainId}
              checked={
                selected.length > 0 &&
                selected.length === drafts.filter(draft => !draft.created).length
              }
              indeterminate={
                selected.length > 0 &&
                selected.length < drafts.filter(draft => !draft.created).length
              }
              onChange={event => {
                setEdited(true);
                setDrafts(previous =>
                  previous.map(draft =>
                    draft.created ? draft : { ...draft, selected: event.target.checked },
                  ),
                );
              }}
            >
              Seleccionar todos los pendientes
            </Checkbox>
            {drafts.map(draft => {
              const errors =
                validating && draft.selected && !draft.created ? draftErrors(draft) : [];
              const disabled = saving || draft.created || !!uncertainId;
              const steps = countSteps(draft.testSteps);
              return (
                <Card
                  key={draft.id}
                  size="small"
                  title={`Caso ${draft.number} — ${draft.title || 'Sin título'}`}
                >
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Space wrap>
                      <Checkbox
                        disabled={disabled}
                        checked={draft.selected}
                        onChange={event => patch(draft.id, { selected: event.target.checked })}
                      >
                        Seleccionar caso {draft.number}
                      </Checkbox>
                      {draft.created ? (
                        <Tag color="green">Creado</Tag>
                      ) : (
                        <Button
                          danger
                          disabled={disabled}
                          onClick={() => {
                            setEdited(true);
                            setDrafts(previous => previous.filter(item => item.id !== draft.id));
                          }}
                        >
                          Eliminar caso {draft.number}
                        </Button>
                      )}
                    </Space>
                    <Space wrap>
                      <Tag>
                        {draft.description.trim()
                          ? 'Descripción detectada'
                          : 'Sin descripción (opcional)'}
                      </Tag>
                      <Tag>
                        {draft.preconditions.trim()
                          ? 'Precondiciones detectadas'
                          : 'Sin precondiciones (opcional)'}
                      </Tag>
                      <Tag>
                        {steps
                          ? `${steps} pasos identificados`
                          : draft.testSteps.trim()
                            ? 'Pasos detectados'
                            : 'Sin pasos'}
                      </Tag>
                      <Tag>
                        {draft.expectedResult.trim()
                          ? 'Resultado esperado detectado'
                          : 'Sin resultado esperado'}
                      </Tag>
                      <Tag>Tipo de prueba: {draft.testType}</Tag>
                      <Tag>Prioridad: {priorityLabels[draft.priority]}</Tag>
                    </Space>
                    {draft.warnings.map((warning, index) => (
                      <Alert key={index} type="warning" title={warning} />
                    ))}
                    {Object.entries(labels).map(([key, label]) => {
                      const field = key as keyof typeof labels;
                      const invalid = errors.includes(field as (typeof errors)[number]);
                      const id = `${draft.id}-${field}`;
                      return (
                        <Form.Item
                          key={field}
                          label={<label htmlFor={id}>{label}</label>}
                          required={['title', 'testSteps', 'expectedResult'].includes(field)}
                          validateStatus={invalid ? 'error' : undefined}
                          help={
                            invalid
                              ? `El caso ${draft.number} no tiene ${label.toLowerCase()}. Complétalo antes de continuar.`
                              : undefined
                          }
                        >
                          {field === 'title' ? (
                            <Input
                              id={id}
                              value={draft[field]}
                              disabled={disabled}
                              onChange={event => patch(draft.id, { [field]: event.target.value })}
                            />
                          ) : (
                            <Input.TextArea
                              id={id}
                              value={draft[field]}
                              disabled={disabled}
                              autoSize={{ minRows: 2, maxRows: 12 }}
                              onChange={event => patch(draft.id, { [field]: event.target.value })}
                            />
                          )}
                        </Form.Item>
                      );
                    })}
                    <Space wrap>
                      <span>Tipo de prueba</span>
                      <Select
                        aria-label={`Tipo de prueba del caso ${draft.number}`}
                        disabled={disabled}
                        value={draft.testType}
                        style={{ minWidth: 150 }}
                        options={Object.values(TestType).map(value => ({ value, label: value }))}
                        onChange={testType => patch(draft.id, { testType })}
                      />
                      <span>Prioridad</span>
                      <Select
                        aria-label={`Prioridad del caso ${draft.number}`}
                        disabled={disabled}
                        value={draft.priority}
                        style={{ minWidth: 120 }}
                        options={Object.values(Priority).map(value => ({
                          value,
                          label: priorityLabels[value],
                        }))}
                        onChange={priority => patch(draft.id, { priority })}
                      />
                    </Space>
                  </Space>
                </Card>
              );
            })}
            {!drafts.length && (
              <Alert
                type="info"
                title="No quedan casos. Vuelve al contenido original para procesar otro bloque."
              />
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}
