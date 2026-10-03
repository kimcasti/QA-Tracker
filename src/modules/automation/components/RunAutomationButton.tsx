import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Collapse, Empty, Modal, Progress, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { AutomationJobResults } from './AutomationJobResults';
import { useAutomationRunner } from '../hooks/useAutomationRunner';
import { runnerReferenceProblem, runnerService, type AutomationEnvironment, type AutomationJob, type RunnerCase } from '../services/runnerService';

interface Props {
  runId: string;
  hasUnsavedChanges: boolean;
  onResults: (job: AutomationJob) => Promise<void>;
}
const states = { pending: 'Pendiente', running: 'Ejecutando', completed: 'Finalizado', interrupted: 'Interrumpido' };
function errorMessage(error: unknown) {
  const response = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
  return response?.response?.data?.error?.message || response?.message || 'No se pudo contactar con QA Tracker.';
}
function JobResults({ runId, jobId, executionNumber }: { runId: string; jobId: number; executionNumber: number }) {
  const query = useQuery({ queryKey: ['automation-job-results', runId, jobId],
    queryFn: () => runnerService.details(runId, jobId), staleTime: Infinity });
  if (query.isPending) return <Typography.Text>Cargando resultados…</Typography.Text>;
  if (query.isError) return <Alert type="error" title={errorMessage(query.error)}
    action={<Button onClick={() => void query.refetch()}>Reintentar</Button>} />;
  return <AutomationJobResults job={query.data} executionNumber={executionNumber} />;
}
function JobProgress({ runId, job }: { runId: string; job: AutomationJob }) {
  const { data } = useQuery({ queryKey: ['automation-job-results', runId, job.id],
    queryFn: () => runnerService.details(runId, job.id), staleTime: Infinity, enabled: job.state === 'completed' });
  const outcomes = data?.outcomes || [];
  const passed = job.state === 'completed' && outcomes.length > 0 && outcomes.length === job.cases.length && outcomes.every(item => item.status === 'passed');
  const failed = outcomes.some(item => item.status === 'failed');
  const interrupted = job.state === 'interrupted';
  const label = interrupted ? states.interrupted : failed ? 'Con fallos' : passed ? 'Aprobado' : states[job.state];
  return <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px',
    padding: '10px 12px', marginBottom: 12, border: '1px solid #d9e5ef', borderRadius: 10, background: '#f7fafc' }}>
    <Progress style={{ flex: '1 1 140px', minWidth: 0, margin: 0 }}
      percent={job.cases.length ? Math.round(job.completedCount / job.cases.length * 100) : 0}
      showInfo={false} size="small" strokeLinecap="round"
      strokeColor={{ '0%': '#00a9ee', '100%': interrupted || failed ? '#f3b56a' : passed ? '#93e58d' : '#38c5d5' }}
      status={job.state === 'running' ? 'active' : 'normal'} />
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5d748b' }}>
      {job.completedCount}/{job.cases.length} {label}
      {passed && <CheckCircleFilled style={{ color: '#52c878', fontSize: 16 }} />}
      {(failed || interrupted) && <CloseCircleFilled style={{ color: '#df8950', fontSize: 16 }} />}
    </span>
  </div>;
}
export function RunAutomationButton({ runId, hasUnsavedChanges, onResults }: Props) {
  const [open, setOpen] = useState(false);
  const [connectionKey, setConnectionKey] = useState<string>();
  const [environment, setEnvironment] = useState<AutomationEnvironment>('local');
  const [selected, setSelected] = useState<string[]>([]);
  const [refreshError, setRefreshError] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [section, setSection] = useState<string>();
  const requestId = useRef(crypto.randomUUID());
  const refreshed = useRef(new Set<number>());
  const submitting = useRef(false);
  const { inspection, enqueue } = useAutomationRunner(runId, open);
  const data = inspection.data;
  const jobs = [...(data?.jobs || [])].sort((a, b) => b.id - a.id);
  const totalJobs = data?.totalJobs ?? jobs.length;
  const activeJobKey = jobs.some(job => String(job.id) === selectedJobId) ? selectedJobId : jobs[0] && String(jobs[0].id);
  const hasExecutedTests = data?.jobs.some(job => job.state === 'completed' || job.state === 'interrupted');
  const automationTitle = hasExecutedTests ? 'Consultar Test Automatizados' : 'Ejecutar automatizados';
  const connections = data?.connections
    ? data.connections.map(item => ({ ...item, key: `connection:${item.id}` }))
    : (data?.runners || []).map(item => ({ ...item, key: `runner:${item.id}`, runnerId: item.id, isOwnConnection: false }));
  const connection = connections.find(item => item.key === connectionKey);
  const runner = data?.runners.find(item => item.id === connection?.runnerId);
  const supportedEnvironments = runner?.environments || ['local'];
  const environmentAvailable = supportedEnvironments.includes(environment);
  const active = data?.jobs.find(job => ['pending', 'running'].includes(job.state));
  const problem = (item: RunnerCase) => runnerReferenceProblem(item.reference, runner, data?.duplicateReferences);
  const selectedCases = data?.cases.filter(item => selected.includes(item.caseId)) || [];
  const invalid = selectedCases.some(item => problem(item));
  const blocked = !data?.canRun || !runner?.online || runner.busy || Boolean(active) || !selected.length ||
    selectedCases.length !== selected.length || invalid || !environmentAvailable || hasUnsavedChanges || inspection.isError;

  useEffect(() => {
    if (!open || !data || hasUnsavedChanges) return;
    for (const job of data.jobs) {
      if (job.state !== 'completed' || refreshed.current.has(job.id)) continue;
      refreshed.current.add(job.id);
      void onResults(job).catch(error => {
        refreshed.current.delete(job.id);
        setRefreshError(errorMessage(error));
      });
    }
  }, [data, open, onResults, hasUnsavedChanges]);

  const submit = async () => {
    if (blocked || submitting.current) return;
    submitting.current = true;
    try {
      const job = await enqueue.mutateAsync({ runnerId: runner!.id, caseIds: selected, requestId: requestId.current, environment });
      setSelectedJobId(String(job.id));
      setSection('history');
      requestId.current = crypto.randomUUID();
      setSelected([]);
    } catch { /* Mutation error is rendered below; keep request id for safe retry. */ }
    finally { submitting.current = false; }
  };
  return <>
    <Button onClick={() => { setSelectedJobId(undefined); setSection(undefined); setOpen(true); }}>{automationTitle}</Button>
    <Modal title={automationTitle} open={open} onCancel={() => setOpen(false)}
      width="min(1400px, 94vw)" style={{ top: 24, paddingBottom: 24 }}
      styles={{ body: { maxHeight: 'calc(100dvh - 160px)', overflowY: 'auto' } }}
      footer={<Space><Button onClick={() => setOpen(false)}>Cerrar</Button>
        <Button type="primary" loading={enqueue.isPending} disabled={blocked} onClick={() => void submit()}>
          Ejecutar {selected.length} caso{selected.length === 1 ? '' : 's'}
        </Button></Space>}>
      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
        {(section || (jobs.length ? 'history' : 'cases')) === 'cases' && <Typography.Paragraph>
          Selecciona casos de cualquier módulo de esta ejecución.
        </Typography.Paragraph>}
        {hasUnsavedChanges && <Alert type="warning" title="Guarda el borrador antes de iniciar las pruebas." />}
        {(inspection.isError || enqueue.isError || refreshError) && <Alert type="error"
          title={refreshError || errorMessage(enqueue.error || inspection.error)} />}
        <Tabs activeKey={section || (jobs.length ? 'history' : 'cases')} onChange={setSection} tabBarGutter={32}
          items={[{ key: 'cases', label: 'Casos automatizados', children: <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Select aria-label="Ejecutor" placeholder="Selecciona una conexión" style={{ width: '100%' }}
          loading={inspection.isLoading}
          value={connection?.key} onChange={key => { setConnectionKey(key); setSelected([]); requestId.current = crypto.randomUUID(); }}
          options={connections.map(item => ({ value: item.key,
            label: item.label + (item.isOwnConnection ? ' · Tu conexión' : '') +
              (!item.online ? ' · Ejecutor desconectado' : item.busy ? ' · Ocupado' : ' · Disponible'),
            disabled: !item.online || item.busy }))} />
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>Ambiente de las pruebas</Typography.Text>
          <Select aria-label="Ambiente de las pruebas" value={environment} style={{ width: '100%' }}
            disabled={Boolean(active) || enqueue.isPending}
            onChange={value => { setEnvironment(value); requestId.current = crypto.randomUUID(); }}
            options={[{ value: 'local', label: 'Local' }, { value: 'test', label: 'Test' }]} />
          {runner && !environmentAvailable && <Alert type="warning"
            title="Este ejecutor no tiene disponible el ambiente seleccionado. Actualiza el ejecutor, configura la URL del ambiente en su .env y reinicia npm run qa:runner." />}
        </Space>
        {data && connections.some(item => !item.online) && <Typography.Paragraph type="secondary">
          Si tu conexión aparece con el ejecutor desconectado, inicia npm run qa:runner en la carpeta qa-automation de tu equipo.
        </Typography.Paragraph>}
        {data && !data.runners.some(item => item.online) && <Alert type="info"
          title="No hay ejecutores conectados. Inicia npm run qa:runner en la carpeta qa-automation de tu equipo." />}
        <Card className="rounded-2xl shadow-sm border-slate-100"
          title={<div className="flex flex-col gap-1 py-2">
            <span className="text-slate-800 font-bold">Casos automatizados</span>
            <span className="text-xs text-slate-400 font-normal whitespace-normal">Selecciona los casos que deseas ejecutar.</span>
          </div>}>
        <Table<RunnerCase> rowKey="caseId" className="executive-table [&_thead_th]:whitespace-nowrap"
          tableLayout="fixed" loading={inspection.isLoading} scroll={{ x: 1000 }}
          dataSource={data?.cases || []} pagination={{ pageSize: 8 }}
          rowSelection={{ selectedRowKeys: selected, onChange: keys => {
            setSelected(keys.map(String)); requestId.current = crypto.randomUUID();
          }, getCheckboxProps: row => ({ disabled: Boolean(problem(row)) || Boolean(active) }) }}
          locale={{ emptyText: 'Esta ejecución no contiene casos automatizados con Playwright.' }}
          columns={[
            { title: 'Caso', dataIndex: 'title', width: '32%', render: (title: string) => <Typography.Text strong>{title}</Typography.Text> },
            { title: 'Módulo', dataIndex: 'module', width: 150, render: (module: string) => <Tag bordered={false}>{module || 'Sin módulo'}</Tag> },
            { title: 'Referencia', dataIndex: 'reference', render: (ref: string) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12, overflowWrap: 'anywhere' }}>{ref || 'Sin referencia'}</Typography.Text> },
            { title: 'Vinculación', width: 180, render: (_, row) => problem(row) ? <Tag color="red">{problem(row)}</Tag> : <Tag color="green">Válida</Tag> },
          ]} />
        </Card>
        </Space> }, { key: 'history', label: 'Historial de ejecuciones', children: jobs.length > 0 ? <Tabs activeKey={activeJobKey} onChange={setSelectedJobId}
          tabBarGutter={32} destroyOnHidden style={{ minWidth: 0 }}
          items={jobs.map((job, index) => ({
            key: String(job.id), label: `Ejecución ${totalJobs - index}`,
            children: <Card className="rounded-2xl shadow-sm border-slate-100"
              title={<div className="flex flex-col gap-1 py-2">
                <span className="text-slate-800 font-bold">Ejecución {totalJobs - index} · {states[job.state]}</span>
                <span className="text-xs text-slate-400 font-normal whitespace-normal">Progreso, resultados y evidencias de la ejecución.</span>
              </div>}>
          <JobProgress runId={runId} job={job} />
          <Typography.Paragraph>Ambiente: <Tag>{job.environment === 'test' ? 'Test' : 'Local'}</Tag></Typography.Paragraph>
          {job.message && <Alert type="warning" title={job.message} />}
          {job.state === 'completed' && <Collapse ghost defaultActiveKey={['results']} items={[{
            key: 'results', label: 'Ver resultados y capturas',
            children: <JobResults runId={runId} jobId={job.id} executionNumber={totalJobs - index} />,
          }]} />}
        </Card>,
          }))} /> : <Empty description="Aún no hay ejecuciones automatizadas." /> }]} />
      </Space>
    </Modal>
  </>;
}
