import { AutomationStatus, Priority, TestType, type TestCase } from '../../../types';
import { stripHtmlToText } from '../../../utils/evidenceRichText';

export type RichDraftField = 'description' | 'preconditions' | 'testSteps' | 'expectedResult';

export type Draft = {
  id: string;
  number: number;
  title: string;
  description: string;
  preconditions: string;
  testSteps: string;
  expectedResult: string;
  testType: TestType;
  priority: Priority;
  selected: boolean;
  created: boolean;
  warnings: string[];
  richFields?: Partial<Record<RichDraftField, boolean>>;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
const fields = {
  titulo: 'title',
  descripcion: 'description',
  precondiciones: 'preconditions',
  'pasos de prueba': 'testSteps',
  'resultado esperado': 'expectedResult',
  'tipo de prueba': 'testType',
  prioridad: 'priority',
} as const;
type Field = (typeof fields)[keyof typeof fields];

export function parseBulkPaste(text: string): { drafts: Draft[]; warnings: string[] } {
  const drafts: Draft[] = [];
  const warnings: string[] = [];
  let current: Partial<Record<Field, string>> | undefined;
  let active: Field | undefined;
  let seen = new Set<Field>();
  let caseWarnings: string[] = [];
  const finish = () => {
    if (!current) return;
    const type = Object.values(TestType).find(
      value => normalize(value) === normalize(current!.testType || ''),
    );
    const priorityAliases: Record<string, Priority> = {
      critica: Priority.CRITICAL,
      alta: Priority.HIGH,
      media: Priority.MEDIUM,
      baja: Priority.LOW,
    };
    const priority =
      Object.values(Priority).find(
        value => normalize(value) === normalize(current!.priority || ''),
      ) || priorityAliases[normalize(current.priority || '')];
    if (current.testType?.trim() && !type)
      caseWarnings.push(
        `Tipo de prueba no reconocido: ${current.testType}. Revisa el valor Funcional asignado.`,
      );
    if (current.priority?.trim() && !priority)
      caseWarnings.push(
        `Prioridad no reconocida: ${current.priority}. Revisa el valor Media asignado.`,
      );
    drafts.push({
      id: `TC-PASTE-${crypto.randomUUID()}`,
      number: drafts.length + 1,
      title: current.title?.trim() || '',
      description: current.description?.trim() || '',
      preconditions: current.preconditions?.trim() || '',
      testSteps: current.testSteps?.trim() || '',
      expectedResult: current.expectedResult?.trim() || '',
      testType: type || TestType.FUNCTIONAL,
      priority: priority || Priority.MEDIUM,
      selected: true,
      created: false,
      warnings: caseWarnings,
    });
  };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^\s*(?:\*\*|__)?([^:]+?)(?:\*\*|__)?\s*:\s*(.*)$/);
    const heading = match ? normalize(match[1]) : '';
    const field = Object.prototype.hasOwnProperty.call(fields, heading)
      ? fields[heading as keyof typeof fields]
      : undefined;
    if (field === 'title') {
      finish();
      current = {};
      active = undefined;
      seen = new Set();
      caseWarnings = [];
    }
    if (!current) {
      if (line.trim() && !warnings.length)
        warnings.push('Hay contenido antes del primer Título:; revísalo en el texto original.');
      continue;
    }
    if (field && match) {
      if (seen.has(field))
        caseWarnings.push(`Encabezado repetido: ${match[1]}. Se conservaron ambos contenidos.`);
      seen.add(field);
      active = field;
      const marker = line.trimStart().match(/^(\*\*|__)/)?.[1];
      const boldEndsAfterColon =
        marker && !line.slice(0, line.indexOf(':')).trimEnd().endsWith(marker);
      const value = boldEndsAfterColon ? match[2].replace(/^(?:\*\*|__)\s*/, '') : match[2];
      current[field] = current[field] ? `${current[field]}\n${value}` : value;
    } else if (active) {
      current[active] = `${current[active] || ''}\n${line}`;
      // A colon in ordinary content does not make it a section heading.
    }
  }
  finish();
  return { drafts, warnings };
}

export function draftErrors(draft: Draft) {
  return (['title', 'testSteps', 'expectedResult'] as const).filter(field =>
    field === 'title' ? !draft.title.trim() : !draftHasContent(draft, field),
  );
}

function richText(value: string) {
  return stripHtmlToText(value).replace(/&#(?:160|x0*a0);/gi, ' ').replace(/[\u200b-\u200d\ufeff]/g, '').trim();
}

export function draftHasContent(draft: Draft, field: RichDraftField) {
  return Boolean(draft.richFields?.[field] ? richText(draft[field]) : draft[field].trim());
}

export function draftFieldHtml(draft: Draft, field: RichDraftField) {
  return draft.richFields?.[field] ? draft[field] : literalTextHtml(draft[field]);
}

export function countSteps(value: string, isHtml = false) {
  if (isHtml) {
    const items = [...value.matchAll(/<li\b[^>]*>([\s\S]*?)(?=<li\b|<\/li>)/gi)];
    if (items.length) return items.filter(item => richText(item[1])).length;
    value = stripHtmlToText(value);
  }
  return value.split('\n').filter(line => /^\s*(?:\d+[.)]|[-*•])\s+\S/.test(line)).length;
}

// Treat pasted content as literal text, including strings that resemble HTML.
export function literalTextHtml(value: string) {
  if (!value.trim()) return '';
  return value
    .split('\n')
    .map(
      line =>
        `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') || '<br>'}</p>`,
    )
    .join('');
}

export function draftToTestCase(
  draft: Draft,
  projectId: string,
  functionalityId: string,
  sortOrder: number,
): TestCase {
  return {
    id: draft.id,
    projectId,
    functionalityId,
    sortOrder,
    title: draft.title.trim(),
    description: draftFieldHtml(draft, 'description'),
    preconditions: draftFieldHtml(draft, 'preconditions'),
    testSteps: draftFieldHtml(draft, 'testSteps'),
    expectedResult: draftFieldHtml(draft, 'expectedResult'),
    testType: draft.testType,
    priority: draft.priority,
    isAutomated: false,
    automationStatus: AutomationStatus.NOT_AUTOMATED,
  };
}
