import { AutomationStatus, deriveAutomationStatus, type TestCase, type Functionality } from '../../../types';
import type { AutomationImportHistoryRecord } from '../../automation-import-history/types/model';

const normalize = (value?: string) => (value || '').trim().toLowerCase();

export function buildAutomationReferenceRows(
  projectId: string,
  cases: TestCase[],
  functionalities: Pick<Functionality, 'id' | 'name' | 'module'>[],
  history: AutomationImportHistoryRecord[],
) {
  const automated = cases.filter(item => item.projectId === projectId && deriveAutomationStatus(item) === AutomationStatus.AUTOMATED);
  const functionalityById = new Map(functionalities.map(item => [item.id, item]));
  const referenceCounts = new Map<string, number>();
  for (const item of automated) {
    const reference = normalize(item.automationReference);
    if (reference) referenceCounts.set(reference, (referenceCounts.get(reference) || 0) + 1);
  }
  const matches = new Map<string, { date: string; result: string; run: string }>();
  for (const entry of [...history].filter(item => item.projectId === projectId)
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt))) {
    for (const match of entry.matchedCases) {
      const key = JSON.stringify([match.testCaseId, normalize(match.reference)]);
      if (!matches.has(key)) matches.set(key, { date: entry.importedAt, result: match.status, run: entry.testRunTitle });
    }
  }
  return automated.map(item => {
    const reference = normalize(item.automationReference);
    const match = matches.get(JSON.stringify([item.id, reference]));
    const duplicated = (referenceCounts.get(reference) || 0) > 1;
    const functionality = functionalityById.get(item.functionalityId);
    return {
      'ID del caso': item.id,
      'Módulo': functionality?.module || '',
      'Funcionalidad': functionality?.name || item.functionalityId,
      'Caso de prueba': item.title,
      'Herramienta': item.automationTool || '',
      'Referencia': item.automationReference || '',
      'Responsable': item.automationOwner || '',
      'Match': !reference ? 'Sin referencia' : match ? 'Match registrado' : 'Sin match registrado',
      'Referencia duplicada': duplicated ? 'Sí' : 'No',
      'Acción sugerida': !reference ? 'Registrar la referencia del test automatizado.'
        : duplicated ? 'Revisar los casos que comparten esta referencia.'
        : !match ? 'Comparar con el reporte automatizado y ajustar la referencia si corresponde.' : '',
      'Fecha del último match': match?.date || '',
      'Ejecución del último match': match?.run || '',
      'Resultado del último match': match?.result || '',
    };
  });
}

export async function downloadAutomationReferences(
  projectId: string,
  cases: TestCase[],
  functionalities: Pick<Functionality, 'id' | 'name' | 'module'>[],
  history: AutomationImportHistoryRecord[],
  scopeName: string,
) {
  const XLSX = await import('xlsx');
  const rows = buildAutomationReferenceRows(projectId, cases, functionalities, history);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [20, 25, 35, 55, 18, 80, 25, 25, 22, 80, 28, 40, 25].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1:M1' };
  XLSX.utils.book_append_sheet(workbook, sheet, 'Referencias');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Criterio', 'Descripción'],
    ['Alcance', 'Todos los casos con estado Automatizada del alcance descargado, sin aplicar filtros de pantalla.'],
    ['Match registrado', 'El historial contiene una coincidencia para este ID de caso y su referencia actual. No equivale a un resultado exitoso.'],
    ['Sin match registrado', 'No existe una coincidencia guardada para la referencia actual. Puede faltar importar el reporte o ser necesario ajustar la referencia.'],
    ['Sin referencia', 'El caso automatizado no tiene una referencia registrada.'],
    ['Referencia duplicada', 'Varios casos del alcance descargado comparten la referencia. Revisar si el vínculo es intencional.'],
    ['Fecha del último match', 'Fecha de importación del último match guardado; no verifica el catálogo actual del ejecutor.'],
  ]), 'Criterios');
  const safeName = scopeName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 100) || 'proyecto';
  XLSX.writeFile(workbook, `referencias-automatizadas-${safeName}.xlsx`);
}
