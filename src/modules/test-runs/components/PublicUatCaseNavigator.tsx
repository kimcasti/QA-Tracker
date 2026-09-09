import { Collapse, Tag } from 'antd';
import { useMemo } from 'react';
import type { TestRunResult } from '../../../types';

type Props = {
  results: TestRunResult[];
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
};

export default function PublicUatCaseNavigator({ results, selectedCaseId, onSelectCase }: Props) {
  const groups = useMemo(() => {
    const modules = new Map<string, { result: TestRunResult; number: number }[]>();
    results.forEach((result, index) => {
      const name = result.moduleName?.trim() || 'Sin módulo';
      const cases = modules.get(name) || [];
      cases.push({ result, number: index + 1 });
      modules.set(name, cases);
    });
    return [...modules.entries()];
  }, [results]);

  return (
    <nav aria-label="Casos de prueba por módulo" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4">
        <h2 className="m-0 text-sm font-semibold text-slate-800">Casos por módulo</h2>
        <p className="mb-0 mt-1 text-xs text-slate-500">{results.length} casos · {groups.length} módulos</p>
      </div>
      <div className="max-h-72 overflow-y-auto lg:max-h-[calc(100vh-10rem)]">
        <Collapse
          ghost
          defaultActiveKey={groups.map(([name]) => name)}
          items={groups.map(([name, cases]) => ({
            key: name,
            label: (
              <div className="flex min-w-0 items-start justify-between gap-2">
                <span className="break-words text-sm font-semibold text-slate-700">{name}</span>
                <Tag className="!m-0 shrink-0">{cases.length}</Tag>
              </div>
            ),
            children: (
              <ul className="m-0 list-none space-y-1 p-0">
                {cases.map(({ result, number }) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      aria-current={selectedCaseId === result.id ? 'location' : undefined}
                      onClick={() => onSelectCase(result.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
                        selectedCaseId === result.id
                          ? 'bg-sky-50 text-sky-800'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs font-semibold">Caso {number}</span>
                      <span className="mt-0.5 block break-words text-xs">{result.testCaseTitle || 'Caso de prueba'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ),
          }))}
        />
      </div>
    </nav>
  );
}
