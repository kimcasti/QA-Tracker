import { useMemo, useState } from 'react';
import { Modal } from 'antd';
import { deriveAutomationStatus, type Functionality, type TestCase } from '../types';
import { buildModuleAutomationCoverage } from '../utils/moduleAutomationCoverage';

export function AutomationModuleCoverage({ functionalities, testCases, scopeLabel }: {
  functionalities: Functionality[];
  testCases: TestCase[];
  scopeLabel: string;
}) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const { modules } = useMemo(
    () => buildModuleAutomationCoverage(functionalities, testCases),
    [functionalities, testCases],
  );
  const selected = modules.find(item => item.name === selectedModule);

  return (
    <div data-testid="automation-module-coverage" className="min-w-0 space-y-3">
      <h3 className="m-0 text-base font-semibold text-slate-800">Casos automatizados por módulo</h3>
      <p className="m-0 text-xs text-slate-500">{scopeLabel}</p>
      <p className="m-0 text-sm text-slate-600">Cada barra compara los casos automatizados con todos los casos del módulo.</p>
      {modules.length === 0 ? <p className="text-sm text-slate-500">Sin módulos en este alcance.</p> : (
        <ul className="m-0 list-none space-y-4 p-0">
          {modules.map(item => (
            <li key={item.name} data-module-name={item.name} className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span className="min-w-0 break-words font-medium text-slate-800" style={{ overflowWrap: 'anywhere' }}>{item.name}</span>
                <span className="tabular-nums text-slate-600">{item.automatedCases} de {item.totalCases} automatizados · {item.coverage === null ? 'Sin casos' : `${item.coverage}%`}</span>
              </div>
              {item.coverage !== null ? (
                <div role="progressbar" aria-label={`Casos automatizados de ${item.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.coverage} aria-valuetext={`${item.automatedCases} de ${item.totalCases} automatizados (${item.coverage}%)`} className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${item.coverage}%` }} />
                </div>
              ) : null}
              <button type="button" aria-label={`Ver casos de ${item.name}`} className="min-h-10 max-w-full rounded px-1 text-left text-sm text-blue-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-600" style={{ overflowWrap: 'anywhere' }} onClick={() => setSelectedModule(item.name)}>
                Ver casos de {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(selected)} title={`Casos de ${selected?.name || ''}`} onCancel={() => setSelectedModule(null)} footer={null} width={760} styles={{ body: { maxHeight: '65vh', overflowY: 'auto', overflowWrap: 'anywhere' } }}>
        {selected ? (
          <div className="min-w-0 space-y-3">
            <p className="m-0 text-sm text-slate-600">Solo lectura · {scopeLabel}</p>
            <p className="m-0 text-sm font-medium">{selected.automatedCases} de {selected.totalCases} casos automatizados · {selected.coverage === null ? 'Sin casos' : `${selected.coverage}%`}</p>
            <p className="m-0 text-xs text-slate-500">Denominador: todos los casos listados, incluidos los no automatizados, candidatos y obsoletos.</p>
            {selected.cases.length === 0 ? <p>Sin casos en este módulo.</p> : (
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Casos incluidos en la cobertura de {selected.name}</caption>
                <thead><tr><th scope="col" className="w-1/4 border-b p-2">ID</th><th scope="col" className="border-b p-2">Caso</th><th scope="col" className="w-1/3 border-b p-2">Automatización</th></tr></thead>
                <tbody>{selected.cases.map((item, index) => (
                  <tr key={`${item.documentId || item.id}-${index}`}>
                    <td className="border-b p-2 align-top">{item.id}</td>
                    <td className="border-b p-2 align-top">{item.title}</td>
                    <td className="border-b p-2 align-top">{deriveAutomationStatus(item)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default AutomationModuleCoverage;
