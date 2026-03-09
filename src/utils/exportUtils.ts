import { RegressionCycle } from '../types';

export const exportCycleToCSV = (cycle: RegressionCycle) => {
  const headers = ['ID', 'Modulo', 'Funcionalidad', 'Ejecutado', 'Fecha', 'Resultado', 'Evidencia'];
  
  const rows = cycle.executions.map(ex => [
    ex.functionalityId,
    ex.module,
    ex.functionalityName,
    ex.executed ? 'Sí' : 'No',
    ex.date || '—',
    ex.result,
    ex.evidence || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Reporte_${cycle.cycleId}_${cycle.date}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
