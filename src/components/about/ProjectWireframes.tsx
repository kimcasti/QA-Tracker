import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Image, Modal, Skeleton, Space, Tag, Typography } from 'antd';
import { generateWireframe, loadWireframes, safeStitchUrl, safeWireframeImage, type WireframeGallery } from '../../services/stitchService';

const statusLabels = { generating: 'Generando', completed: 'Completado', partial: 'Resultado parcial', error: 'Error', uncertain: 'Resultado por verificar' };
type Props = { projectId: string; hasBrief: boolean; canGenerate: boolean };

export function ProjectWireframes(props: Props) {
  return <ProjectWireframesContent key={props.projectId} {...props} />;
}

function ProjectWireframesContent({ projectId, hasBrief, canGenerate }: Props) {
  const [gallery, setGallery] = useState<WireframeGallery | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const gate = useRef(false);
  const alive = useRef(true);
  const requestId = useRef<string | null>(null);
  const inFlight = gallery?.versions.some(v => ['generating', 'uncertain', 'partial'].includes(v.status)) ?? false;
  const refresh = async (explicit = false) => {
    setLoading(true);
    try {
      const next = await loadWireframes(projectId);
      if (!alive.current) return;
      setGallery(next);
      if (explicit) { setError(''); setLocked(false); }
    } catch {
      if (!alive.current) return;
      setError('No pudimos cargar los diseños. Reintenta para continuar.'); setLocked(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; };
  }, [projectId]);
  useEffect(() => {
    if (!gallery?.versions.some(v => v.status === 'generating')) return;
    const timer = window.setInterval(() => { void refresh(); }, 4000);
    return () => window.clearInterval(timer);
  }, [gallery?.versions, projectId]);
  const generate = async () => {
    if (gate.current || !alive.current || !canGenerate || !hasBrief || loading || locked || inFlight) return;
    gate.current = true; setBusy(true);
    requestId.current ||= crypto.randomUUID();
    try {
      await generateWireframe(projectId, requestId.current);
      if (!alive.current) return;
      setConfirm(false);
      // A successful POST is not enough: reload the persisted gallery.
      const next = await loadWireframes(projectId);
      if (!alive.current) return;
      setGallery(next); setError(''); requestId.current = null;
    } catch {
      if (!alive.current) return;
      setConfirm(false); setLocked(true);
      setError('La solicitud pudo haberse enviado. Actualiza para verificar el resultado; no la repitas todavía.');
    } finally { gate.current = false; if (alive.current) setBusy(false); }
  };
  return <section aria-label="Wireframes lo-fi" style={{ marginTop: 24 }}>
    <Space wrap style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>Wireframes lo-fi</Typography.Title>
      <Space wrap>
        {(Boolean(gallery?.versions.length) || error) && <Button onClick={() => void refresh(true)} disabled={busy || loading}>{!gallery && error ? 'Reintentar' : 'Actualizar wireframes'}</Button>}
        {canGenerate && <Button type="primary" disabled={!gallery?.configured || !hasBrief || loading || busy || locked || inFlight} onClick={() => setConfirm(true)}>Generar flujo lo-fi</Button>}
      </Space>
    </Space>
    <Typography.Paragraph type="secondary">Una acción genera un flujo simple de principio a fin como una versión con varias pantallas lo-fi. Revisa el brief antes de enviarlo. Un flujo completo puede consumir más cuota de Stitch que una pantalla aislada.</Typography.Paragraph>

    {gallery && !gallery.configured && canGenerate && <Alert type="warning" title="Stitch no está configurado en el servidor." style={{ marginBottom: 12 }} />}
    {gallery?.versions.some(v => v.status === 'partial' || v.status === 'uncertain') && <Alert type="warning" title="Hay un resultado por verificar. Revisa el proyecto en Stitch; generar otro flujo requiere conciliación manual." style={{ marginBottom: 12 }} />}
    {error && <Alert type="warning" title={error} style={{ marginBottom: 12 }} />}
    {!gallery ? (loading ? <Skeleton active title={false} paragraph={{ rows: 2 }} /> : null) : !gallery.versions.length ? <Empty description={<>
      <Typography.Text strong>Dale forma a tu proyecto</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>{hasBrief ? 'Tu brief está listo. Genera el flujo propuesto para comenzar a trabajar con diseño.' : 'Convierte la información de este proyecto en un flujo visual. Comienza generando el brief.'}</Typography.Paragraph>
    </>} /> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
        {gallery.versions.map((version, index) => <Card key={version.id} size="small" title={`Versión ${gallery.versions.length - index}`}>
          <Space wrap style={{ marginBottom: 12 }}><Tag>{statusLabels[version.status] || 'Resultado por verificar'}</Tag><Typography.Text type="secondary">{new Date(version.createdAt).toLocaleString('es')}</Typography.Text></Space>
          {version.message && <Typography.Paragraph>{version.message}</Typography.Paragraph>}
          {version.flowSummary && <><Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Recorrido propuesto (brief)</Typography.Text><Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{version.flowSummary}</Typography.Paragraph></>}
          <Typography.Paragraph type="secondary">{version.screens.length === 1 ? 'Versión de una pantalla (histórica o resultado parcial).' : 'Orden de lectura propuesto: secuencia devuelta por Stitch.'} Imágenes estáticas; no es un prototipo navegable ni hay transiciones automáticas.</Typography.Paragraph>
          <ol aria-label="Pantallas del flujo" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
          {version.screens.map((screen, step) => <li key={screen.id} style={{ marginBottom: 12, minWidth: 0 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>{step + 1}. {screen.title}</Typography.Text>
            {safeWireframeImage(screen.imageDataUrl) ? <Image src={safeWireframeImage(screen.imageDataUrl)} alt={screen.title} style={{ width: '100%', maxHeight: 360, objectFit: 'contain' }} /> : <Typography.Text type="secondary">Imagen pendiente o no disponible.</Typography.Text>}
          </li>)}
          </ol>
          {safeStitchUrl(version.stitchUrl) && <a href={safeStitchUrl(version.stitchUrl)} target="_blank" rel="noopener noreferrer">Abrir en Stitch</a>}
        </Card>)}
      </div>}
    <Modal title="Generar un flujo lo-fi en Stitch" open={confirm} onCancel={() => { if (!busy) setConfirm(false); }} onOk={() => void generate()} okText="Enviar brief a Stitch" cancelText="Cancelar" confirmLoading={busy} closable={!busy} maskClosable={!busy} keyboard={!busy} okButtonProps={{ disabled: busy || locked || inFlight }}>
      <p>Se enviará el brief guardado de este proyecto a Stitch (Google). Revisa que no contenga datos personales, secretos ni información confidencial.</p>
      <p>Se generará un flujo completo y simple con varias pantallas en blanco, negro y grises, normalmente de 4 a 7 y con un máximo de 12. Puede consumir más cuota del proveedor que una sola pantalla; el costo depende de Stitch. Las versiones anteriores se conservan. QA Tracker registra un uso IA por solicitud completada; no equivale al costo de Stitch. Esto no publica el proyecto ni genera código funcional dentro de QA Tracker.</p>
    </Modal>
  </section>;
}
