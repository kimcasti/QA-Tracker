import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, Card, Checkbox, Empty, Form, Input, Popconfirm, Select, Space, Spin, Typography } from 'antd';
import { useProjects } from '../../projects/hooks/useProjects';
import { useConnections } from '../hooks/useConnections';

export default function AutomationConnectionsPage() {
  const [params] = useSearchParams();
  const projects = useProjects();
  const { list, approve, revoke } = useConnections();
  const { message } = App.useApp();
  const [confirmed, setConfirmed] = useState(false);
  const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'No se pudo completar la operación. Intenta nuevamente.';
  return <main className="min-h-screen bg-slate-50 px-4 py-10">
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to="/">← Volver a proyectos</Link>
      <Typography.Title level={2}>Conexiones de automatización</Typography.Title>
      <Card title="Conectar una carpeta de pruebas">
        {approve.isSuccess ? <Alert type="success" showIcon title="Conexión autorizada" description="Regresa a tu terminal. La conexión conservará este proyecto aunque cambies de proyecto en QA Tracker." /> : <>
          <Typography.Paragraph>Ejecuta <Typography.Text code>npm run qa:connect</Typography.Text> en tu carpeta de pruebas y autoriza aquí el proyecto que recibirá los resultados.</Typography.Paragraph>
          <Form layout="vertical" initialValues={{ code: params.get('code') || '' }} onFinish={async values => {
            try { await approve.mutateAsync({ code: values.code.trim().toUpperCase().replace(/\s/g, ''), projectKey: values.projectKey }); }
            catch (error) { message.error(errorMessage(error)); }
          }}>
            <Form.Item name="code" label="Código mostrado en tu terminal" rules={[{ required: true }, { pattern: /^[a-fA-F0-9]{16}$/, message: 'Introduce los 16 caracteres del código.' }]}><Input maxLength={16} autoComplete="off" /></Form.Item>
            <Form.Item name="projectKey" label="Proyecto que recibirá los resultados" rules={[{ required: true, message: 'Selecciona un proyecto.' }]}>
              <Select loading={projects.isLoading} showSearch optionFilterProp="label" placeholder="Selecciona el proyecto" options={(projects.data || []).map(project => ({ value: project.id, label: `${project.name} · ${project.id}` }))} />
            </Form.Item>
            {projects.isError && <Alert type="error" title="No se pudieron cargar los proyectos" action={<Button onClick={() => projects.refetch()}>Reintentar</Button>} />}
            <Typography.Paragraph type="secondary">Permiso: crear ejecuciones y publicar resultados y evidencias en este proyecto durante 90 días. Podrás revocar la conexión en cualquier momento.</Typography.Paragraph>
            <Checkbox checked={confirmed} onChange={event => setConfirmed(event.target.checked)}>Inicié esta conexión y el código coincide con mi terminal.</Checkbox>
            <div className="mt-4"><Button type="primary" htmlType="submit" disabled={!confirmed} loading={approve.isPending}>Autorizar conexión</Button></div>
          </Form>
        </>}
      </Card>
      <Card title="Mis conexiones activas">
        {list.isLoading ? <Spin /> : list.isError ? <Alert type="error" title="No se pudieron cargar las conexiones" action={<Button onClick={() => list.refetch()}>Reintentar</Button>} /> : !list.data?.length ? <Empty description="No tienes conexiones activas" /> : <Space orientation="vertical" className="w-full" size="middle">{list.data.map(connection => <div key={connection.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div><Typography.Text strong>{connection.label}</Typography.Text><div>{connection.projectName} · {connection.projectKey}</div><Typography.Text type="secondary">Vence: {new Date(connection.expiresAt).toLocaleDateString()}</Typography.Text></div>
          <Popconfirm title="¿Revocar esta conexión?" description="El script necesitará una nueva autorización." onConfirm={async () => { try { await revoke.mutateAsync(connection.id); message.success('Conexión revocada'); } catch (error) { message.error(errorMessage(error)); } }}><Button danger loading={revoke.isPending}>Revocar</Button></Popconfirm>
        </div>)}</Space>}
      </Card>
    </div>
  </main>;
}
