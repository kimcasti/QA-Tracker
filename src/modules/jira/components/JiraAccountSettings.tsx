import { Alert, App, Button, Card, Popconfirm, Space, Spin, Typography } from 'antd';
import { toApiError } from '../../../config/http';
import { useJiraAccount } from '../hooks/useJiraAccount';
import { JiraOAuthConnection } from './JiraOAuthConnection';

export function JiraAccountSettings() {
  const { status, disconnect } = useJiraAccount();
  const { message } = App.useApp();
  const account = status.data;
  return <Card title="Mi cuenta de Jira" className="mb-6">
    <Space orientation="vertical" size="middle" className="w-full">
      <JiraOAuthConnection />
      <Typography.Paragraph>Esta conexión pertenece a tu usuario de QA Tracker. Puedes utilizarla en los proyectos que tengan configurado el mismo sitio de Jira.</Typography.Paragraph>
      {status.isLoading && <Spin />}
      {status.isError && <Alert type="error" title={toApiError(status.error).message} action={<Button onClick={() => status.refetch()}>Reintentar</Button>} />}
      {(account?.connected || (account?.source === 'oauth' && account.site)) && <>
        {account.connected && <Alert type="success" showIcon title={account.source === 'environment' ? 'Conexión actual configurada en el servidor' : 'Cuenta conectada'} description={<><div>{account.accountName || account.email}</div><div>{account.site}</div>{account.validatedAt && <div>Validada: {new Date(account.validatedAt).toLocaleString()}</div>}</>} />}
        <Space wrap>
          <Popconfirm title="¿Desconectar tu cuenta de Jira?" description="Se eliminarán las credenciales guardadas en QA Tracker. Los tickets se conservan. Puedes retirar también el acceso desde tu cuenta de Atlassian." onConfirm={async () => {
            try { await disconnect.mutateAsync(); message.success('Cuenta de Jira desconectada'); }
            catch (error) { message.error(toApiError(error).message); }
          }}><Button danger loading={disconnect.isPending}>Desconectar</Button></Popconfirm>
        </Space>
      </>}
      {account && !account.canStore && <Alert type="warning" title="Falta configurar el cifrado en el servidor" description="El administrador debe habilitar el almacenamiento seguro antes de guardar una conexión." />}
    </Space>
  </Card>;
}
