import { useEffect, useState } from 'react';
import { Alert, Button, Card, Select, Space, Typography, message } from 'antd';
import { toApiError } from '../../../config/http';
import { useJiraConfigure, useJiraProjects, useJiraStatus, useJiraTypes } from '../hooks/useJira';

export function JiraProjectSettings({ projectKey }: { projectKey: string }) {
  const status = useJiraStatus(projectKey);
  const [showProjects, setShowProjects] = useState(false);
  const [projectId, setProjectId] = useState<string>();
  const [issueTypeId, setIssueTypeId] = useState<string>();
  const projects = useJiraProjects(projectKey, showProjects);
  const types = useJiraTypes(projectKey, showProjects ? projectId : undefined);
  const save = useJiraConfigure(projectKey);
  useEffect(() => {
    setShowProjects(false);
  }, [projectKey]);
  useEffect(() => {
    setProjectId(status.data?.destination?.projectId);
    setIssueTypeId(status.data?.destination?.issueTypeId);
  }, [status.data?.destination]);
  const error = status.error || (showProjects && (projects.error || types.error || save.error));
  return <Card title="Destino de Jira para este proyecto" className="mb-8">
    <Space orientation="vertical" className="w-full" size="middle">
      {status.isLoading && <Typography.Text>Cargando conexión…</Typography.Text>}
      {error && <Alert type="error" title={toApiError(error).message} action={<Button onClick={() => { void status.refetch(); if (showProjects) void projects.refetch(); if (projectId && showProjects) void types.refetch(); }}>Reintentar</Button>} />}
      {status.data && !status.data.configured && <Alert type="info" title="Conecta tu cuenta de Jira" description="Ve a Mi cuenta de Jira y pulsa Conectar con Jira para autorizar tu cuenta en Atlassian." />}
      {status.data?.configured && <>
        <Typography.Text>{status.data.site}</Typography.Text>
        {status.data.destination && <Typography.Text strong>Destino guardado: {status.data.destination.projectKey} · {status.data.destination.issueTypeName}</Typography.Text>}
        {!status.data.sendingEnabled && <Alert type="info" title="Envío deshabilitado" description="Puedes configurar el destino y revisar reportes. La creación en Jira está bloqueada hasta aprobar la prueba." />}
        {!showProjects && <Button onClick={() => {
          setProjectId(status.data.destination?.projectId);
          setIssueTypeId(status.data.destination?.issueTypeId);
          save.reset();
          setShowProjects(true);
        }}>{status.data.destination ? 'Editar destino de Jira' : 'Comprobar cuenta y consultar proyectos'}</Button>}
        {showProjects && projects.isFetching && <Typography.Text>Consultando proyectos…</Typography.Text>}
        {showProjects && projects.data && <>
          <Typography.Text>Cuenta conectada: {projects.data.accountName}</Typography.Text>
          <Select disabled={save.isPending} aria-label="Proyecto de Jira" className="w-full" showSearch optionFilterProp="label" placeholder="Selecciona el proyecto de Jira" value={projectId} onChange={value => { setProjectId(value); setIssueTypeId(undefined); }} options={projects.data.projects.map(p => ({ value: p.id, label: `${p.key} · ${p.name}` }))} />
          {!projects.data.projects.length && <Typography.Text>No hay proyectos disponibles para crear incidencias.</Typography.Text>}
          <Select aria-label="Tipo de incidencia de Jira" className="w-full" placeholder="Selecciona Error u otro tipo" value={issueTypeId} loading={types.isFetching} disabled={!projectId || save.isPending} onChange={setIssueTypeId} options={(types.data || []).map(type => ({ value: type.id, label: type.name }))} />
          <Button type="primary" disabled={!projectId || !issueTypeId || types.isFetching} loading={save.isPending} onClick={async () => {
            try { await save.mutateAsync({ projectId: projectId!, issueTypeId: issueTypeId! }); setShowProjects(false); message.success('Destino de Jira guardado para este proyecto.'); } catch { /* Error shown above. */ }
          }}>Guardar destino de Jira</Button>
        </>}
        {showProjects && <Button disabled={save.isPending} onClick={() => {
          setShowProjects(false);
          setProjectId(status.data.destination?.projectId);
          setIssueTypeId(status.data.destination?.issueTypeId);
          save.reset();
        }}>Cancelar</Button>}
      </>}
    </Space>
  </Card>;
}
