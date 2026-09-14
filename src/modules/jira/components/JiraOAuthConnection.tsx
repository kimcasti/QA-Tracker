import { useState } from 'react';
import { Alert, App, Button, Select, Space, Typography } from 'antd';
import { toApiError } from '../../../config/http';
import { useJiraOAuth } from '../hooks/useJiraOAuth';
export function JiraOAuthConnection() {
  const { status, start, select } = useJiraOAuth();
  const { message } = App.useApp();
  const [cloudId, setCloudId] = useState<string>();
  const data = status.data;
  return <Space orientation="vertical" className="w-full" size="middle">
    <Typography.Paragraph>Autoriza tu cuenta en Atlassian para conectar Jira sin copiar un token. Los reportes seguirán requiriendo tu revisión y el clic en Crear en Jira.</Typography.Paragraph>
    {status.isError && <Alert type="error" title="No se pudo consultar la conexión OAuth" action={<Button onClick={() => status.refetch()}>Reintentar</Button>} />}
    {data && !data.configured && <Alert type="info" title="OAuth pendiente de configuración" description="Falta registrar la aplicación en Atlassian y configurar sus credenciales en el backend." />}
    {data?.reconnect && <Alert type="warning" title="Reconecta tu cuenta de Jira" description="El acceso anterior ya no se puede utilizar. Autoriza nuevamente tu cuenta." />}
    <Button type="primary" disabled={!data?.configured || select.isPending} loading={start.isPending || status.isLoading} onClick={async () => {
      try {
        const result = await start.mutateAsync();
        const url = new URL(result.authorizationUrl);
        if (url.origin !== 'https://auth.atlassian.com' || url.pathname !== '/authorize') throw new Error('La URL de autorización no es válida.');
        window.location.assign(url.href);
      } catch (error) { message.error(toApiError(error).message); }
    }}>{data?.connected || data?.reconnect ? 'Reconectar con Jira' : 'Conectar con Jira'}</Button>
    {data?.pending && <>
      <Alert type="info" title="Selecciona el sitio que usarás" description="Elige el sitio de Jira donde están tus proyectos." />
      <Select aria-label="Sitio de Jira autorizado" className="w-full" placeholder="Selecciona tu sitio Jira" value={data.pending.sites.some(site => site.id === cloudId) ? cloudId : undefined} onChange={setCloudId} options={data.pending.sites.map(site => ({ value: site.id, label: `${site.name} · ${site.url}` }))} />
      <Button disabled={!cloudId || !data.pending.sites.some(site => site.id === cloudId)} loading={select.isPending} onClick={async () => {
        try { await select.mutateAsync({ selectionId: data.pending!.selectionId, cloudId: cloudId! }); message.success('Sitio de Jira conectado'); }
        catch (error) { message.error(toApiError(error).message); }
      }}>Guardar sitio de Jira</Button>
    </>}
  </Space>;
}
