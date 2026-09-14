import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Spin } from 'antd';
import { jiraOAuthService } from '../services/jiraOAuthService';

export default function JiraOAuthCallback() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const data = { code: params.get('code') || undefined, state: params.get('state') || undefined, error: params.get('error') || undefined };
    // Remove the one-use code from browser history before any API call.
    window.history.replaceState(window.history.state, '', window.location.pathname);
    if (!data.state) { setError('No hay una autorización pendiente. Inicia la conexión desde Mis integraciones.'); return; }
    void jiraOAuthService.complete(data).then(async () => {
      await cache.invalidateQueries({ queryKey: ['jira-oauth'] });
      navigate('/settings/integrations', { replace: true });
    }).catch(error => setError(error instanceof Error ? error.message : 'No se pudo completar la autorización.'));
  }, [cache, navigate]);
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><Card title="Conectar con Jira" className="mx-auto max-w-xl">
    {error ? <Alert type="error" title="No se completó la conexión" description={error} action={<Button onClick={() => navigate('/settings/integrations', { replace: true })}>Volver</Button>} /> : <Spin tip="Comprobando autorización…"><div className="h-24" /></Spin>}
  </Card></main>;
}
