import { useState } from 'react';
import { Alert, Button, Image, Modal, Space, Typography, message } from 'antd';
import { toApiError } from '../../../config/http';
import { useJiraCreate, useJiraStatus } from '../hooks/useJira';
import type { JiraIssueDraft, JiraIssueResult } from '../services/jiraService';

export function JiraIssueButton({ projectKey, disabled, prepare, onCreated }: {
  projectKey: string; disabled?: boolean; prepare: () => Promise<JiraIssueDraft>; onCreated: (result: JiraIssueResult) => void;
}) {
  const status = useJiraStatus(projectKey);
  const create = useJiraCreate(projectKey);
  const [draft, setDraft] = useState<JiraIssueDraft>();
  const [created, setCreated] = useState<JiraIssueResult>();
  const destination = status.data?.destination;
  return <div className="mt-4">
    {status.error && <Alert type="error" title={toApiError(status.error).message} action={<Button onClick={() => void status.refetch()}>Reintentar</Button>} />}
    {status.data && !destination && <Typography.Text type="secondary">Configura el destino de Jira en Editar Proyecto.</Typography.Text>}
    {destination && <Space orientation="vertical" className="w-full">
      <Typography.Text>Destino: {destination.site} · {destination.projectKey} · {destination.issueTypeName}</Typography.Text>
      <Button disabled={disabled} onClick={async () => {
        try { setDraft(await prepare()); setCreated(undefined); create.reset(); } catch { message.error('Escribe el título del bug para revisar el reporte.'); }
      }}>Vista previa del reporte para Jira</Button>
    </Space>}
    <Modal title="Revisar reporte para Jira" open={Boolean(draft)} onCancel={() => { if (!create.isPending) setDraft(undefined); }} closable={!create.isPending} maskClosable={!create.isPending} footer={<Space>
      <Button disabled={create.isPending} onClick={() => setDraft(undefined)}>Cerrar</Button>
      <Button type="primary" disabled={!status.data?.sendingEnabled || Boolean(created)} loading={create.isPending} onClick={async () => {
        if (!draft) return;
        try { const result = await create.mutateAsync(draft); setCreated(result); onCreated(result); } catch { /* Error shown in modal. */ }
      }}>Crear en Jira</Button>
    </Space>}>
      <Space orientation="vertical" className="w-full" size="middle">
        {!status.data?.sendingEnabled && <Alert type="info" title="Solo vista previa: envío deshabilitado" description="No se creará ningún ticket hasta que apruebes y se habilite la prueba." />}
        <Typography.Text>{destination?.site} · {destination?.projectKey} · {destination?.issueTypeName}</Typography.Text>
        <Typography.Text strong>{draft?.title}</Typography.Text>
        <Typography.Paragraph className="whitespace-pre-wrap">{draft?.description || 'Sin descripción adicional.'}</Typography.Paragraph>
        {draft?.evidenceImage && <Image src={draft.evidenceImage} alt="Captura que se adjuntará al reporte" />}
        {create.error && <Alert type="error" title={toApiError(create.error).message} />}
        {created && <Alert type={created.warning ? 'warning' : 'success'} title={<a href={created.url} target="_blank" rel="noreferrer">{created.key}: abrir en Jira</a>} description={created.warning || 'Enlace guardado en QA Tracker.'} />}
      </Space>
    </Modal>
  </div>;
}
