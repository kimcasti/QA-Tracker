import { Link } from 'react-router-dom';
import { Typography } from 'antd';
import { JiraAccountSettings } from './JiraAccountSettings';

export default function PersonalIntegrationsPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl space-y-5">
    <Link to="/">← Volver a proyectos</Link>
    <Typography.Title level={2}>Mis integraciones</Typography.Title>
    <JiraAccountSettings />
    <Typography.Paragraph type="secondary">El destino de los reportes se selecciona en Configuración → Integraciones de cada proyecto por una persona con permisos de administración.</Typography.Paragraph>
  </div></main>;
}
