import type { TestCase } from '../../../types';

export function caseFieldToText(value: string = ''): string {
  if (!/<\/?[a-z][^>]*>/i.test(value)) return value.trim();
  const doc = new DOMParser().parseFromString(value, 'text/html');
  doc.querySelectorAll('script, style').forEach(node => node.remove());
  doc.querySelectorAll('li').forEach(node => {
    const siblings = Array.from(node.parentElement?.children || []);
    const prefix = node.parentElement?.tagName === 'OL' ? `${siblings.indexOf(node) + 1}. ` : '- ';
    node.prepend(doc.createTextNode(prefix));
  });
  doc.querySelectorAll('br').forEach(node => node.replaceWith(doc.createTextNode('\n')));
  doc.querySelectorAll('p, div, li, h1, h2, h3, h4, pre, tr').forEach(node => node.append(doc.createTextNode('\n')));
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}

export function buildCasesText(functionalityName: string, cases: TestCase[]): string {
  return [
    `Casos de prueba · ${functionalityName}`, `Total: ${cases.length}`, '',
    ...cases.map((item, index) => [
      `Caso ${index + 1} — ${item.title}`, `Tipo: ${item.testType}`, `Prioridad: ${item.priority}`,
      '', 'Descripción:', caseFieldToText(item.description) || 'Sin descripción.',
      '', 'Precondiciones:', caseFieldToText(item.preconditions) || 'Sin precondiciones.',
      '', 'Pasos:', caseFieldToText(item.testSteps) || 'Sin pasos.',
      '', 'Resultado esperado:', caseFieldToText(item.expectedResult) || 'Sin resultado esperado.',
    ].join('\n')),
  ].join('\n\n');
}

export function downloadCasesText(functionalityName: string, cases: TestCase[]) {
  const name = functionalityName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 100) || 'funcionalidad';
  const blob = new Blob(['\uFEFF', buildCasesText(functionalityName, cases)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `casos-${name}.txt`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
