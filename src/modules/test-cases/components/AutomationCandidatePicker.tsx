import { Checkbox, Empty, Tag } from 'antd';
import { AutomationStatus, deriveAutomationStatus, type Functionality, type TestCase } from '../../../types';

type Props = {
  functionalities: Functionality[];
  cases: TestCase[];
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
};

export function AutomationCandidatePicker({ functionalities, cases, selectedIds, disabled, onChange }: Props) {
  const selected = new Set(selectedIds);
  const toggle = (ids: string[], checked: boolean) => {
    const next = new Set(selected);
    ids.forEach(id => checked ? next.add(id) : next.delete(id));
    onChange([...next]);
  };
  const modules = [...new Set(functionalities.map(item => item.module))];
  return <div className="mt-3 max-h-[min(28rem,50vh)] space-y-4 overflow-y-auto pr-2" data-testid="automation-candidate-picker">
    {modules.map(module => <section className="min-w-0" key={module || 'none'}>
      <div className="mb-2 text-xs font-semibold text-slate-500">{module || 'Sin módulo'}</div>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
      {functionalities.filter(item => item.module === module).map(functionality => {
        const rows = cases.filter(item => item.functionalityId === functionality.id);
        const manual = rows.filter(item => deriveAutomationStatus(item) === AutomationStatus.NOT_AUTOMATED);
        const count = manual.filter(item => selected.has(item.id)).length;
        return <div key={functionality.id} className="min-w-0 rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-sm font-medium">{functionality.name}</div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <Checkbox aria-label={`Seleccionar todos de ${functionality.name}`}
              disabled={disabled || !manual.length} checked={manual.length > 0 && count === manual.length}
              indeterminate={count > 0 && count < manual.length}
              onChange={event => toggle(manual.map(item => item.id), event.target.checked)}>
              <span className="text-sm font-medium">Seleccionar todos</span>
            </Checkbox>
            <span className="shrink-0 text-xs tabular-nums text-slate-500" aria-label={`${count} de ${manual.length} casos manuales seleccionados`}>
              {count}/{manual.length}
            </span>
          </div>
          <div className="mt-3 space-y-2 px-1">
            {rows.map(item => {
              const status = deriveAutomationStatus(item);
              const eligible = status === AutomationStatus.NOT_AUTOMATED;
              return <div key={item.id} className="flex items-start justify-between gap-2 text-sm">
                <Checkbox disabled={disabled || !eligible} checked={eligible && selected.has(item.id)}
                  onChange={event => toggle([item.id], event.target.checked)}>{item.title}</Checkbox>
                {!eligible && <Tag>{status}</Tag>}
              </div>;
            })}
            {!rows.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin casos de prueba" />}
          </div>
        </div>;
      })}
      </div>
    </section>)}
  </div>;
}
