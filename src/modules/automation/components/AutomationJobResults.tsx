import { useState } from 'react';
import { Alert, Button, Collapse, Descriptions, Empty, Image, Space, Tag, Typography } from 'antd';
import { stripHtmlToText } from '../../../utils/evidenceRichText';
import type { AutomationJob } from '../services/runnerService';

const statuses: Record<string, { label: string; color: string; marker: string }> = {
  passed: { label: 'Aprobado', color: 'green', marker: 'PASS' },
  failed: { label: 'Fallido', color: 'red', marker: 'FAIL' },
  skipped: { label: 'Omitido', color: 'gold', marker: 'SKIP' },
  unknown: { label: 'Sin resultado', color: 'default', marker: 'UNKNOWN' },
};
function timestamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No disponible';
  return new Date(value).toLocaleString('es-CO');
}
function elapsed(job: AutomationJob) {
  const milliseconds = Date.parse(job.finishedAt || '') - Date.parse(job.startedAt || '');
  return Number.isFinite(milliseconds) && milliseconds >= 0
    ? `${(milliseconds / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s`
    : 'No disponible';
}

export function AutomationJobResults({ job }: { job: AutomationJob }) {
  const [capture, setCapture] = useState<string>();
  const outcomes = job.outcomes || [];
  if (!outcomes.length) return <Empty description="Esta ejecución no contiene resultados detallados." />;
  const counts = Object.entries(statuses).map(([status, info]) => ({
    ...info, status, count: outcomes.filter(result => result.status === status).length,
  }));
  const summary = [
    `PLAYWRIGHT · Ejecución ${job.id}`,
    `Inicio: ${timestamp(job.startedAt)}`,
    `Fin: ${timestamp(job.finishedAt)}`,
    `Tiempo de ejecución: ${elapsed(job)}`,
    `Resultados recibidos: ${outcomes.length}/${job.cases.length}`,
    '',
    ...outcomes.map((result, index) =>
      `[${index + 1}/${outcomes.length}] ${(statuses[result.status] || statuses.unknown).marker}  ${result.automationReference}`),
    '',
    counts.filter(item => item.count).map(item => `${item.count} ${item.status}`).join(' · '),
  ].join('\n');

  return <Space orientation="vertical" size="middle" style={{ width: '100%', minWidth: 0 }}>
    <Image.PreviewGroup items={capture ? [capture] : []} preview={{
      visible: Boolean(capture), onVisibleChange: visible => { if (!visible) setCapture(undefined); },
    }} />
    <Space wrap>{counts.filter(item => item.count > 0).map(item =>
      <Tag key={item.status} color={item.color}>{item.label}: {item.count}</Tag>)}</Space>
    <div style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: 16, minWidth: 0 }}>
      <Typography.Paragraph copyable={{ text: summary }} style={{ color: '#e5e7eb', marginBottom: 8 }}>
        Resumen de ejecución
      </Typography.Paragraph>
      <pre role="region" aria-label="Resumen de ejecución de Playwright" tabIndex={0} style={{
        margin: 0, fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        maxHeight: 280, overflowY: 'auto',
      }}>{summary}</pre>
    </div>
    <Typography.Text type="secondary">
      Resumen generado con los resultados recibidos. La salida completa de la terminal y los pasos de Playwright no están incluidos en este reporte.
    </Typography.Text>
    <Collapse bordered={false} expandIconPlacement="end" style={{ width: '100%', background: 'transparent' }} items={outcomes.map((result, index) => {
      const selected = job.cases.find(item => item.reference === result.automationReference);
      const status = statuses[result.status] || statuses.unknown;
      const separator = result.automationReference.indexOf('::');
      const file = separator >= 0 ? result.automationReference.slice(0, separator) : result.automationReference;
      const test = separator >= 0 ? result.automationReference.slice(separator + 2) : result.automationReference;
      const notes = result.notes ? stripHtmlToText(result.notes).trim() : '';
      return {
        key: result.automationReference,
        style: { marginBottom: 12, border: '1px solid var(--qa-color-border, #d9e5ef)', borderRadius: 14, overflow: 'hidden', background: '#fff' },
        styles: { header: { background: '#fff', padding: '12px 16px', alignItems: 'center' },
          body: { background: '#fff', padding: '16px', borderTop: '1px solid var(--qa-color-border, #d9e5ef)' } },
        label: <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 14px' }}>
          <Typography.Text strong style={{ fontSize: 14, overflowWrap: 'anywhere' }}>
            Caso {index + 1} — {selected?.title || test}
          </Typography.Text>
          <Tag color={status.color} style={{ margin: 0, fontSize: 12 }}>{status.label}</Tag>
          {selected?.module && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{selected.module}</Typography.Text>}
          {notes && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Diagnóstico disponible</Typography.Text>}
          {result.evidenceImage && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Captura adjunta</Typography.Text>}
        </div>,
        children: <Space orientation="vertical" size="middle" style={{ width: '100%', minWidth: 0 }}>
          <Descriptions size="small" column={1} items={[
            { key: 'module', label: 'Módulo', children: selected?.module || 'No disponible' },
            { key: 'file', label: 'Archivo', children: <Typography.Text code style={{ overflowWrap: 'anywhere' }}>{file}</Typography.Text> },
            { key: 'test', label: 'Prueba', children: <span style={{ overflowWrap: 'anywhere' }}>{test}</span> },
            { key: 'status', label: 'Resultado Playwright', children: result.status },
          ]} />
          {notes ? <div style={{ width: '100%' }}>
            <Typography.Text strong>Notas y diagnóstico</Typography.Text>
            <Typography.Paragraph copyable={{ text: notes }} style={{
              whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace',
              maxHeight: 320, overflowY: 'auto', marginTop: 8, marginBottom: 0,
            }}>{notes}</Typography.Paragraph>
          </div> : <Alert type="info" showIcon title="El ejecutor no envió notas ni diagnóstico adicional para esta prueba." />}
          {result.evidenceImage && <Button size="small" onClick={() => setCapture(result.evidenceImage)}>
            Ver captura adjunta
          </Button>}
        </Space>,
      };
    })} />
  </Space>;
}
