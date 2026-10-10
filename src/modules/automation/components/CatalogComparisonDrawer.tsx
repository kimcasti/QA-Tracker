import React from 'react';
import { Alert, Button, Drawer, Empty, List, Modal, Select, Space, Spin, Tabs, Tag, Typography, message } from 'antd';
import { ArrowRightOutlined, CheckCircleOutlined, CodeOutlined, CopyOutlined, FolderOpenOutlined, HistoryOutlined, LinkOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import CatalogTabGuide from './CatalogTabGuide';
import './CatalogComparisonDrawer.css';
import { toApiError } from '../../../config/http';
import { useCatalogComparison } from '../hooks/useCatalogComparison';
import { compareCatalog, suggestCatalogCases } from '../utils/catalogComparison';
import type { AutomationEnvironment } from '../services/runnerService';

export default function CatalogComparisonDrawer({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [requestId, setRequestId] = React.useState<number>();
  const [connectionId, setConnectionId] = React.useState<number>();
  const [environment, setEnvironment] = React.useState<AutomationEnvironment>('local');
  const [selection, setSelection] = React.useState<Record<string, string>>({});
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [savedCount, setSavedCount] = React.useState(0);
  // Keep identifiers across network retries so lost responses cannot duplicate operations.
  const detectionAttempt = React.useRef<{ key: string; id: string }>(undefined);
  const assignmentAttempt = React.useRef<{ key: string; id: string }>(undefined);
  const { connections, request, details, assign } = useCatalogComparison(projectId, requestId);
  const connection = connections.data?.find(item => item.id === connectionId);
  React.useEffect(() => {
    if (connectionId == null && connections.data?.length === 1) setConnectionId(connections.data[0].id);
  }, [connections.data, connectionId]);
  React.useEffect(() => {
    if (connection && !connection.environments.includes(environment)) setEnvironment(connection.environments[0]);
  }, [connection, environment]);
  const catalog = details.data;
  const cases = catalog?.cases || [];
  const comparison = React.useMemo(() => compareCatalog(catalog?.references || [], cases), [catalog]);
  const busy = request.isPending || (Boolean(requestId) && details.isPending) || ['pending', 'running'].includes(catalog?.state || '');
  const selected = Object.entries(selection).map(([reference, caseId]) => ({ reference, item: cases.find(item => item.id === caseId) }))
    .filter(row => row.item && comparison.unassigned.includes(row.reference));
  const selectedIds = new Set(selected.map(row => row.item!.id));
  const selectCase = (reference: string, caseId?: string) => {
    setSavedCount(0);
    setSelection(previous => {
      const next = { ...previous };
      if (caseId) next[reference] = caseId; else delete next[reference];
      return next;
    });
  };
  const start = async () => {
    if (!connection?.runnerId || busy) return;
    const key = `${connection.runnerId}:${environment}`;
    if (detectionAttempt.current?.key !== key) detectionAttempt.current = { key, id: crypto.randomUUID() };
    try {
      const result = await request.mutateAsync({ runnerId: connection.runnerId, environment, requestId: detectionAttempt.current.id });
      setRequestId(result.id); setSelection({}); setSavedCount(0);
      detectionAttempt.current = undefined;
    } catch (error) { message.error(toApiError(error).message); }
  };
  const save = async () => {
    if (!catalog?.catalogHash || !selected.length) return;
    const assignments = selected.map(row => ({ caseId: row.item!.id, reference: row.reference, snapshot: row.item!.snapshot }));
    const key = JSON.stringify(assignments);
    if (assignmentAttempt.current?.key !== key) assignmentAttempt.current = { key, id: crypto.randomUUID() };
    try {
      const result = await assign.mutateAsync({ requestId: assignmentAttempt.current.id, catalogHash: catalog.catalogHash, assignments });
      setSavedCount(result.saved.length); setSelection({}); setReviewOpen(false); assignmentAttempt.current = undefined;
      message.success(`${result.saved.length} referencias asignadas.`);
    } catch (error) { message.error(toApiError(error).message); }
  };
  const labels = (item: typeof cases[number]) => `${item.module} · ${item.functionality} · ${item.title}`;
  const catalogConnection = connections.data?.find(item => item.runnerId === catalog?.runnerId);
  return <>
    <Drawer open rootClassName="catalog-comparison" title={<div className="catalog-title"><span className="catalog-title-icon"><LinkOutlined /></span><div>Comparar referencias automatizadas<div className="catalog-title-caption">Conecta tus tests con los casos de tu proyecto</div></div></div>} onClose={() => { if (!assign.isPending) onClose(); }} closable={!assign.isPending} size="large"
      styles={{ wrapper: { width: 'min(1100px, 100vw)' } }}
      footer={<div className="catalog-footer">
        <div role="status" aria-live="polite"><strong>{selected.length ? `${selected.length} vínculos listos para revisar` : 'Selecciona un caso para comenzar'}</strong><div className="catalog-footer-caption">{selected.length}/200 vínculos seleccionados · {comparison.unassigned.length} referencias sin asignar</div></div>
        <Button type="primary" icon={<CheckCircleOutlined />} disabled={!selected.length || selected.length > 200 || busy || assign.isPending || details.isFetching || details.isError} onClick={() => setReviewOpen(true)}>Revisar vínculos</Button>
      </div>}>
      <div className="catalog-content">
        <div className="catalog-intro"><Typography.Paragraph>Detecta, vincula y revisa. Tus cambios solo se guardan al confirmar.</Typography.Paragraph><div className="catalog-steps" aria-label="Pasos para vincular referencias"><span><b>1</b> Detectar pruebas</span><span><b>2</b> Elegir casos</span><span><b>3</b> Revisar y guardar</span></div></div>
        <section className="catalog-source" aria-labelledby="catalog-source-title">
        <h3 id="catalog-source-title"><FolderOpenOutlined /> 1. Detecta tus pruebas</h3>
        <p className="catalog-help">Elige la carpeta conectada y el ambiente donde quieres buscar tus tests.</p>
        {connections.isError ? <Alert type="error" showIcon title="No se pudieron cargar las conexiones" action={<Button onClick={() => void connections.refetch()}>Reintentar</Button>} /> : connections.isLoading ? <Spin /> : !connections.data?.length ?
          <Alert type="info" showIcon title="Conecta tu carpeta de pruebas" description={<>Ejecuta <Typography.Text code>npm run qa:connect</Typography.Text> en tu carpeta de automatización y autoriza este proyecto.</>} /> : null}
        <div className="catalog-controls">
          <div className="catalog-field"><label>Carpeta conectada</label><Select aria-label="Conexión de automatización" placeholder="Selecciona una conexión" value={connectionId} disabled={busy || assign.isPending}
            options={connections.data?.map(item => ({ value: item.id, label: `${item.label}${!item.online ? ' · Desconectado' : item.busy ? ' · Ocupado' : ''}` }))}
            onChange={id => { setConnectionId(id); detectionAttempt.current = undefined; }} /></div>
          <div className="catalog-field"><label>Ambiente</label><Select aria-label="Ambiente de detección" value={environment} disabled={!connection || busy || assign.isPending}
            options={(connection?.environments || ['local']).map(value => ({ value, label: value === 'local' ? 'Local' : 'Test' }))} onChange={value => setEnvironment(value)} /></div>
          <Button type="primary" icon={<ReloadOutlined />} loading={busy}
            disabled={!connection?.online || !connection.compatible || connection.busy || assign.isPending}
            onClick={() => void start()}>Obtener y comparar referencias</Button>
        </div>
        {connection && <div className="catalog-connection-status"><span className={`catalog-dot${connection.online ? ' is-online' : ''}`} />{connection.online ? 'Carpeta conectada' : 'Carpeta desconectada'}<span>Solo se detectan referencias; no se ejecutan pruebas.</span></div>}
        </section>
        {connection && !connection.online && <Alert type="info" showIcon title="Ejecutor desconectado" description={<>Inicia <Typography.Text code>npm run qa:runner</Typography.Text> en la carpeta conectada.</>} />}
        {connection?.online && !connection.compatible && <Alert type="warning" showIcon title="Actualiza tu ejecutor" description="Instala la actualización de detección de referencias en tu carpeta de pruebas y reinicia npm run qa:runner." />}
        {connection?.busy && !busy && <Alert type="info" showIcon title="El ejecutor está ocupado" description="Espera a que termine su trabajo y vuelve a intentar." />}
        {details.isError && <Alert type="error" showIcon title="No se pudo actualizar la comparación" action={<Button onClick={() => void details.refetch()}>Reintentar</Button>} />}
        {busy && <Alert type="info" showIcon icon={<Spin size="small" />} title="Detectando referencias en la carpeta conectada…" description="La detección puede tardar hasta dos minutos." />}
        {catalog?.state === 'failed' && <Alert type="error" showIcon title="No se pudieron detectar las referencias" description={catalog.error} />}
        {assign.isError && <Alert type="error" showIcon title={toApiError(assign.error).message}
          action={<Button disabled={details.isFetching} onClick={() => { setReviewOpen(false); setSelection({}); assignmentAttempt.current = undefined; void details.refetch(); }}>Actualizar comparación</Button>} />}
        {!!savedCount && <Alert type="success" showIcon title={`${savedCount} vínculos guardados`} description={`${comparison.unassigned.length} referencias siguen pendientes de asignación.`} />}
        {catalog?.state === 'completed' && <>
          <div className="catalog-results-heading"><div><h3>2. Vincula cada prueba con su caso</h3><p className="catalog-help">Usa una sugerencia o busca el caso correcto. Después revisa los vínculos antes de guardarlos.</p></div><Tag color="cyan">{catalog.references.length} tests detectados</Tag></div>
          <div className="catalog-detection-meta"><CheckCircleOutlined /> Catálogo actualizado<span>{catalogConnection?.label || 'Conexión seleccionada'} · {catalog.environment === 'local' ? 'Local' : 'Test'} · Detectado: {new Date(catalog.finishedAt!).toLocaleString('es-CO')}</span></div>
          {!catalog.references.length && <Alert type="info" showIcon title="No se encontraron tests en este catálogo" description="Revisa el ambiente y la configuración de Playwright de la carpeta conectada." />}
          <Tabs items={[
            { key: 'unassigned', label: `Sin asignar (${comparison.unassigned.length})`, icon: <LinkOutlined aria-hidden="true" />, children: <><CatalogTabGuide tab="unassigned" />
              <List dataSource={comparison.unassigned} locale={{ emptyText: <Empty description="No hay referencias pendientes de asignación" /> }} renderItem={reference => {
                const available = cases.filter(item => !selectedIds.has(item.id) || selection[reference] === item.id);
                const suggestions = suggestCatalogCases(reference, available);
                const separator = reference.indexOf('::');
                const chosenCase = cases.find(item => item.id === selection[reference]);
                const replacesReference = Boolean(chosenCase?.reference && chosenCase.reference !== reference);
                const displacesReference = replacesReference && comparison.registered.some(row => row.reference === chosenCase!.reference && row.cases.length === 1);
                return <List.Item className={`catalog-reference-card${selection[reference] ? ' is-selected' : ''}`}><div className="catalog-reference-content">
                  <div className="catalog-reference-heading"><div className="catalog-reference-name"><span className="catalog-test-icon"><CodeOutlined /></span><Typography.Text strong>{reference.slice(separator + 2)}</Typography.Text></div><Tag color={selection[reference] ? 'green' : 'gold'}>{selection[reference] ? 'Lista para revisar' : 'Pendiente de vincular'}</Tag></div>
                  <div className="catalog-reference-path">{reference.slice(0, separator)}</div>
                  {suggestions.length > 0 && <div className="catalog-suggestions"><Typography.Text type="secondary">Casos sugeridos</Typography.Text><Space wrap>{suggestions.map(item =>
                    <Button key={item.id} size="small" icon={<LinkOutlined aria-hidden="true" />} title={labels(item)} onClick={() => selectCase(reference, item.id)}>{item.title}</Button>)}</Space></div>}
                  {!suggestions.length && <Typography.Text type="secondary">No hay sugerencias de casos libres. Busca el caso correcto; cada caso admite una sola referencia.</Typography.Text>}
                  <div className="catalog-case-field"><label>Vincular con un caso de prueba</label><Select aria-label={`Caso para ${reference}`} className="w-full" showSearch allowClear optionFilterProp="label" placeholder="Buscar caso por módulo, funcionalidad o título"
                    value={selection[reference]} options={available.map(item => ({ value: item.id, label: `${labels(item)}${item.reference ? ' · Ya vinculado (reemplazar)' : ''}` }))} onChange={id => selectCase(reference, id)} /></div>
                  {replacesReference && <Alert type="warning" showIcon title="Este caso ya tiene una referencia" description={<><div className="break-all font-mono text-xs">{chosenCase!.reference}</div><div>{displacesReference ? 'La referencia anterior volverá a Sin asignar al guardar. Elige otro caso si quieres conservar ambos vínculos.' : 'Al guardar se reemplazará su referencia actual. Elige otro caso si quieres conservarla.'}</div></>} />}
                  {selection[reference] && <div className="catalog-selection-note"><CheckCircleOutlined /> Selección pendiente de guardar. Puedes cambiarla o quitarla.</div>}
                </div></List.Item>;
              }} /></> },
            { key: 'registered', label: `Registradas (${comparison.registered.length})`, icon: <CheckCircleOutlined aria-hidden="true" />, children: <><CatalogTabGuide tab="registered" />
              <List dataSource={comparison.registered} locale={{ emptyText: 'No hay referencias registradas del catálogo' }} renderItem={row => <List.Item><div><div className="break-all font-mono text-sm">{row.reference}</div>{row.cases.map(item => <div key={item.id}>{labels(item)} <Tag>{item.status === 'automated' ? 'Automatizada' : item.status === 'obsolete' ? 'Obsoleta' : 'Revisar estado'}</Tag></div>)}</div></List.Item>} /></> },
            { key: 'missing', label: `Casos por revisar (${comparison.missing.length})`, icon: <SearchOutlined aria-hidden="true" />, children: <><CatalogTabGuide tab="missing" />
              <List dataSource={comparison.missing} locale={{ emptyText: 'Todos los casos automatizados tienen referencia en el catálogo' }} renderItem={item => <List.Item><div>{labels(item)}<div className="break-all text-sm text-slate-500">{item.reference || 'Sin referencia registrada'}</div><Tag color="orange">{item.reference ? 'No aparece en este catálogo' : 'Falta referencia'}</Tag></div></List.Item>} /></> },
            { key: 'duplicates', label: `Duplicadas (${comparison.duplicated.length})`, icon: <CopyOutlined aria-hidden="true" />, children: <><CatalogTabGuide tab="duplicates" />
              <List dataSource={comparison.duplicated} locale={{ emptyText: 'Sin referencias duplicadas' }} renderItem={row => <List.Item><div><div className="break-all font-mono text-sm">{row.reference}</div><Tag color="red">{row.catalogCount} tests en catálogo · {row.cases.length} casos registrados</Tag>{row.cases.map(item => <div key={item.id}>{labels(item)}</div>)}<Typography.Text type="secondary">Revisa la duplicidad antes de asignar esta referencia.</Typography.Text></div></List.Item>} /></> },
          ]} />
        </>}
      </div>
    </Drawer>
    <Modal rootClassName="catalog-review" centered title={<div className="catalog-title"><span className="catalog-title-icon"><CheckCircleOutlined aria-hidden="true" /></span><div>Revisar asignaciones de referencias<div className="catalog-title-caption">Un último vistazo antes de guardar tus vínculos</div></div></div>} open={reviewOpen} onCancel={() => { if (!assign.isPending) setReviewOpen(false); }}
      onOk={() => void save()} okText="Guardar vínculos" cancelText="Cancelar" confirmLoading={assign.isPending} okButtonProps={{ disabled: !selected.length }}
      cancelButtonProps={{ disabled: assign.isPending }} maskClosable={!assign.isPending} closable={!assign.isPending} width={900}
      footer={(_, { OkBtn, CancelBtn }) => <div className="catalog-review-footer"><div><strong>{selected.length} {selected.length === 1 ? 'vínculo listo' : 'vínculos listos'} para guardar</strong><span>Los cambios se aplican al confirmar.</span></div><Space><CancelBtn /><OkBtn /></Space></div>}>
      <div className="catalog-review-intro"><Typography.Paragraph>Revisa qué referencia tendrá cada caso. Cada caso admite una sola referencia.</Typography.Paragraph><Tag color="cyan">Playwright</Tag></div>
      <div className="catalog-review-list">{selected.map(row => <article className="catalog-review-card" key={row.reference}>
        <div className="catalog-review-case"><span className="catalog-test-icon"><CodeOutlined aria-hidden="true" /></span><div><div className="catalog-review-context">{row.item!.module} · {row.item!.functionality}</div><h3>{row.item!.title}</h3></div><Tag color={row.item!.reference && row.item!.reference !== row.reference ? 'gold' : 'green'}>{row.item!.reference && row.item!.reference !== row.reference ? 'Reemplazo' : 'Nuevo vínculo'}</Tag></div>
        {!!row.item!.reference && row.item!.reference !== row.reference && <Alert type="warning" showIcon title="Vas a reemplazar un vínculo existente" description={comparison.registered.some(item => item.reference === row.item!.reference && item.cases.length === 1) ? 'La referencia anterior volverá a Sin asignar. Para conservar ambas pruebas, vincula la nueva con otro caso.' : 'El caso dejará de usar su referencia anterior. Para conservarla, selecciona otro caso.'} />}
        <div className="catalog-review-references">
          <section className="catalog-review-reference is-before" aria-label="Referencia anterior"><div className="catalog-review-reference-label">Referencia anterior <Tag>Actual</Tag></div>{row.item!.reference ? <><code title={row.item!.reference}>{row.item!.reference.split('::')[0]}</code>{row.item!.reference.includes('::') && <p>{row.item!.reference.slice(row.item!.reference.indexOf('::') + 2)}</p>}</> : <p className="catalog-review-empty">Este caso todavía no tiene una referencia.</p>}</section>
          <span className="catalog-review-arrow"><ArrowRightOutlined aria-hidden="true" /></span>
          <section className="catalog-review-reference is-after" aria-label="Referencia nueva"><div className="catalog-review-reference-label">Referencia nueva <Tag color="cyan">Al guardar</Tag></div><code title={row.reference}>{row.reference.split('::')[0]}</code>{row.reference.includes('::') && <p>{row.reference.slice(row.reference.indexOf('::') + 2)}</p>}</section>
        </div>
        <div className="catalog-review-summary"><h4>Resumen de cambios</h4><div className="catalog-review-properties">
          <div><span className="catalog-review-property-label">Estado</span><div>{({ automated: 'Automatizada', not_automated: 'Manual', candidate: 'Candidata', obsolete: 'Obsoleta' }[row.item!.status] || row.item!.status)}{' → '}<strong>Automatizada</strong></div></div>
          <div><span className="catalog-review-property-label">Herramienta</span><div>{row.item!.tool || 'Sin herramienta'}{' → '}<strong>Playwright</strong></div></div>
          <div><span className="catalog-review-property-label">Tipo de prueba</span><div><strong>{({ ui: 'UI', api: 'API', integration: 'Integración', performance: 'Rendimiento' }[row.item!.type] || row.item!.type || 'UI')}</strong></div></div>
        </div></div>
        <div className="catalog-review-history"><HistoryOutlined aria-hidden="true" /><div><strong>Tu historial se conserva</strong><p>Si cambia la referencia o la herramienta, se reiniciará el último resultado. Las ejecuciones anteriores no se eliminan.</p></div></div>
      </article>)}</div>
    </Modal>
  </>;
}
