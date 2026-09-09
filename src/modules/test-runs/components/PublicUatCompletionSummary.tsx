import { Button, Modal } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TestResult } from '../../../types';
import type { PublicUatSessionDetail } from '../types/model';
import './publicUatCompletionSummary.css';

type Props = {
  data: PublicUatSessionDetail;
  open: boolean;
  onClose: () => void;
};

function SummaryContent({ data }: { data: PublicUatSessionDetail }) {
  const results = [...(data.testRun?.results || [])].sort((a, b) =>
    (a.orderIndex ?? Number.MAX_SAFE_INTEGER) - (b.orderIndex ?? Number.MAX_SAFE_INTEGER)
    || a.testCaseId.localeCompare(b.testCaseId),
  );
  const counts = [
    { result: TestResult.PASSED, label: 'Aprobados', icon: '✓', color: 'text-emerald-700' },
    { result: TestResult.FAILED, label: 'Fallidos', icon: '✕', color: 'text-rose-700' },
    { result: TestResult.BLOCKED, label: 'Bloqueados', icon: '⊘', color: 'text-amber-700' },
  ];
  const completedDate = data.session.completedAt ? new Date(data.session.completedAt) : null;
  const completedAt = completedDate && !Number.isNaN(completedDate.getTime())
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(completedDate)
    : 'No disponible';

  return (
    <article className="uat-completion-summary text-slate-700">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700">Comprobante de evaluación UAT</p>
      <h2 className="mb-2 mt-0 break-words text-xl font-semibold text-slate-900">{data.testRun?.title}</h2>
      <p className="mb-4 mt-0 text-sm">Gracias por completar la evaluación. Tus resultados quedaron guardados.</p>
      <dl className="mb-5 grid gap-2 text-sm">
        <div><dt className="inline font-semibold">Participante: </dt><dd className="m-0 inline">{data.session.participantName || 'No disponible'}</dd></div>
        <div><dt className="inline font-semibold">Finalizada: </dt><dd className="m-0 inline">{completedAt}</dd></div>
        <div><dt className="inline font-semibold">Total de casos: </dt><dd className="m-0 inline">{results.length}</dd></div>
      </dl>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {counts.map(item => (
          <div key={item.result} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-center">
            <div className={`text-xl font-semibold ${item.color}`}>
              <span aria-hidden="true" className="mr-1 text-sm">{item.icon}</span>
              {results.filter(result => result.result === item.result).length}
            </div>
            <div className="text-xs">{item.label}</div>
          </div>
        ))}
      </div>
      <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
        <caption className="mb-2 text-left font-semibold text-slate-800">Resultados por caso</caption>
        <thead>
          <tr className="border-b border-slate-300">
            <th scope="col" className="w-1/4 py-2 pr-2">Módulo</th>
            <th scope="col" className="py-2 pr-2">Caso de prueba</th>
            <th scope="col" className="w-1/4 py-2">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {results.map(result => (
            <tr key={result.id} className="border-b border-slate-200 align-top">
              <td className="break-words py-3 pr-2">{result.moduleName || 'Sin módulo'}</td>
              <td className="break-words py-3 pr-2">{result.testCaseTitle || 'Caso de prueba'}</td>
              <td className="break-words py-3 font-medium">{result.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default function PublicUatCompletionSummary({ data, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.classList.add('uat-summary-printing');
    return () => document.body.classList.remove('uat-summary-printing');
  }, [open]);

  return (
    <>
      <Modal
        title="Evaluación finalizada"
        open={open}
        onCancel={onClose}
        width={760}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose}>Cerrar</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
              Imprimir / Guardar PDF
            </Button>
          </div>
        }
      >
        <SummaryContent data={data} />
      </Modal>
      {open ? createPortal(
        <div className="uat-summary-print-root"><SummaryContent data={data} /></div>,
        document.body,
      ) : null}
    </>
  );
}
