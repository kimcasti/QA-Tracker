import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { RegressionCycle, TestResult, Functionality, TestCase } from '../types';
import dayjs from 'dayjs';

/**
 * Generates an Excel report for a specific cycle
 */
export const exportCycleToExcel = (cycle: RegressionCycle) => {
  const data = cycle.executions.map(ex => ({
    'ID': ex.functionalityId,
    'Módulo': ex.module,
    'Funcionalidad': ex.functionalityName,
    'Caso de Prueba': ex.testCaseTitle || 'N/A',
    'Resultado': ex.result,
    'Ejecutado': ex.executed ? 'SÍ' : 'NO',
    'Fecha': ex.date || 'N/A',
    'Bug ID': ex.bugId || '',
    'Severidad': ex.severity || '',
    'Evidencia': ex.evidence || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Reporte_${cycle.cycleId}_${dayjs().format('YYYYMMDD')}.xlsx`);
};

/**
 * Generates a DOCX report for a specific cycle
 */
export const exportCycleToDocx = async (cycle: RegressionCycle) => {
  const tableRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'ID', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Funcionalidad / Caso', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Resultado', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Bug', style: 'Strong' })] }),
      ],
    }),
    ...cycle.executions.map(ex => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(ex.functionalityId)] }),
        new TableCell({ children: [new Paragraph(`${ex.functionalityName}${ex.testCaseTitle ? ` - ${ex.testCaseTitle}` : ''}`)] }),
        new TableCell({ children: [new Paragraph(ex.result)] }),
        new TableCell({ children: [new Paragraph(ex.bugId || '-')] }),
      ],
    })),
  ];

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: `Reporte de Pruebas: ${cycle.cycleId}`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Fecha: ${dayjs(cycle.date).format('DD/MM/YYYY')}`, bold: true }),
            new TextRun({ text: ` | Sprint: ${cycle.sprint || 'N/A'}`, bold: true }),
          ],
          spacing: { before: 200, after: 400 },
        }),
        new Paragraph({
          text: `Resumen: ${cycle.passed} Aprobados, ${cycle.failed} Fallidos, ${cycle.pending} Pendientes.`,
          spacing: { after: 400 },
        }),
        new DocxTable({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Reporte_${cycle.cycleId}_${dayjs().format('YYYYMMDD')}.docx`);
};

/**
 * Generates a PDF report from an HTML element
 */
export const exportToPdf = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
};
