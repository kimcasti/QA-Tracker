import { useState } from 'react';
import { Alert, Button, Image, Modal, Space, Typography, message } from 'antd';
import { ArrowRightOutlined, FolderOutlined, LinkOutlined, SendOutlined } from '@ant-design/icons';
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
    {destination && <section aria-label="Destino del reporte para Jira"
      style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
        borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 600 }}>
        <SendOutlined style={{ color: '#64748b' }} /> Destino del reporte
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 11, fontWeight: 400 }}>Jira</span>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, color: '#64748b' }}>
          <FolderOutlined />
          <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <Typography.Text strong style={{ fontSize: 12 }}>
              {destination.projectKey}{destination.projectName && destination.projectName !== destination.projectKey ? ` · ${destination.projectName}` : ''}
            </Typography.Text>
            <span style={{ display: 'block', fontSize: 11, marginTop: 2 }}>{destination.issueTypeName}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, color: '#64748b' }}>
          <LinkOutlined />
          <Typography.Link href={destination.site} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, overflowWrap: 'anywhere', minWidth: 0 }}>
            {destination.site.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </Typography.Link>
        </div>
      <Button size="small" block disabled={disabled} style={{ marginTop: 2, fontSize: 12 }} onClick={async () => {
        try { setDraft(await prepare()); setCreated(undefined); create.reset(); } catch { message.error('Escribe el título del bug para revisar el reporte.'); }
      }}>Vista previa del reporte <ArrowRightOutlined /></Button>
      </div>
    </section>}
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
