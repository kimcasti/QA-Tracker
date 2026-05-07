import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { RegressionCycle, TestResult, Functionality, TestCase } from '../types';
import dayjs from 'dayjs';

export interface DeliveryUnitProgressDocxData {
  projectName: string;
  deliveryUnitName: string;
  typeLabel: string;
  statusLabel: string;
  generatedAtLabel: string;
  periodLabel: string;
  proposalOwner: string;
  scopeDescription: string;
  executiveSummary: string;
  aiIntroduction?: string;
  aiObjectives?: string;
  aiConclusion?: string;
  metrics: {
    totalFunctionalities: number;
    completedCount: number;
    inProgressCount: number;
    pendingCount: number;
    failedCount: number;
    activeBugsCount: number;
    testCasesCount: number;
    progressPercent: number;
  };
  activities: Array<{
    name: string;
    description?: string;
  }>;
  functionalities: Array<{
    functionality: string;
    module: string;
    status: string;
    priority: string;
    qaStatus: string;
    bugs: number;
    observations: string;
  }>;
}

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

export const exportDeliveryUnitProgressToDocx = async (
  report: DeliveryUnitProgressDocxData,
) => {
  const metricRows = [
    ['Funcionalidades', String(report.metrics.totalFunctionalities)],
    ['Completadas', String(report.metrics.completedCount)],
    ['En progreso', String(report.metrics.inProgressCount)],
    ['Pendientes / backlog', String(report.metrics.pendingCount)],
    ['Fallidas / bloqueadas', String(report.metrics.failedCount)],
    ['Bugs activos', String(report.metrics.activeBugsCount)],
    ['Casos asociados', String(report.metrics.testCasesCount)],
    ['Avance general', `${report.metrics.progressPercent}%`],
  ];

  const metricsTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: metricRows.map(([label, value], index) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: label,
                    bold: index === 0,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: value,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ),
  });

  const activityParagraphs =
    report.activities.length > 0
      ? report.activities.flatMap(activity => [
          new Paragraph({
            children: [new TextRun({ text: activity.name, bold: true })],
            spacing: { before: 140 },
          }),
          new Paragraph(activity.description || 'Sin descripcion adicional.'),
        ])
      : [new Paragraph('No hay actividades operativas registradas en esta unidad.')];

  const functionalityRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Funcionalidad', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Modulo', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Estado', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Prioridad', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'QA status', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Bugs', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Observaciones', style: 'Strong' })] }),
      ],
    }),
    ...(report.functionalities.length > 0
      ? report.functionalities.map(item =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(item.functionality || '-')] }),
              new TableCell({ children: [new Paragraph(item.module || '-')] }),
              new TableCell({ children: [new Paragraph(item.status || '-')] }),
              new TableCell({ children: [new Paragraph(item.priority || '-')] }),
              new TableCell({ children: [new Paragraph(item.qaStatus || '-')] }),
              new TableCell({ children: [new Paragraph(String(item.bugs ?? 0))] }),
              new TableCell({ children: [new Paragraph(item.observations || '-')] }),
            ],
          }),
        )
      : [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 7,
                children: [
                  new Paragraph('No hay funcionalidades asociadas a esta unidad de entrega.'),
                ],
              }),
            ],
          }),
        ]),
  ];

  const objectiveLines = (report.aiObjectives || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*]\s*/, ''));

  const objectivesParagraphs =
    objectiveLines.length > 0
      ? objectiveLines.map(
          line =>
            new Paragraph({
              text: line,
              bullet: { level: 0 },
            }),
        )
      : [new Paragraph('No se registraron objetivos asistidos por IA para este reporte.')];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'Reporte de progreso',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: report.deliveryUnitName,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Proyecto: ', bold: true }),
              new TextRun(report.projectName),
            ],
            spacing: { before: 240 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Unidad: ', bold: true }),
              new TextRun(`${report.typeLabel} | ${report.statusLabel}`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Periodo: ', bold: true }),
              new TextRun(report.periodLabel),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Responsable: ', bold: true }),
              new TextRun(report.proposalOwner),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Fecha de generacion: ', bold: true }),
              new TextRun(report.generatedAtLabel),
            ],
            spacing: { after: 320 },
          }),
          new Paragraph({
            text: 'Alcance de la unidad',
            heading: HeadingLevel.HEADING_3,
          }),
          new Paragraph(report.scopeDescription),
          new Paragraph({
            text: 'Resumen ejecutivo',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 280 },
          }),
          new Paragraph(report.executiveSummary),
          new Paragraph({
            text: 'Metricas principales',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 280 },
          }),
          metricsTable,
          new Paragraph({
            text: 'Resumen asistido por IA',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 280 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Introduccion', bold: true })],
          }),
          new Paragraph(report.aiIntroduction || 'No se genero introduccion para este reporte.'),
          new Paragraph({
            children: [new TextRun({ text: 'Objetivos', bold: true })],
            spacing: { before: 180 },
          }),
          ...objectivesParagraphs,
          new Paragraph({
            children: [new TextRun({ text: 'Conclusion', bold: true })],
            spacing: { before: 180 },
          }),
          new Paragraph(report.aiConclusion || 'No se genero conclusion para este reporte.'),
          new Paragraph({
            text: 'Actividades realizadas',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 280 },
          }),
          ...activityParagraphs,
          new Paragraph({
            text: 'Funcionalidades incluidas en esta unidad de entrega',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 280 },
          }),
          new DocxTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: functionalityRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = report.deliveryUnitName.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'unidad';
  saveAs(blob, `Reporte_Progreso_${safeName}_${dayjs().format('YYYYMMDD')}.docx`);
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

async function captureElementAsCanvas(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element ${elementId} not found`);
  }

  return html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });
}

export const exportReportAsImage = async (elementId: string, filename: string) => {
  const canvas = await captureElementAsCanvas(elementId);
  const imageUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = `${filename}.png`;
  link.click();
};

export const printReportCapture = async (elementId: string, title: string) => {
  const canvas = await captureElementAsCanvas(elementId);
  const imageUrl = canvas.toDataURL('image/png');
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');

  if (!printWindow) {
    throw new Error('PRINT_WINDOW_BLOCKED');
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            margin: 0;
            padding: 24px;
            background: #ffffff;
            font-family: Arial, sans-serif;
            text-align: center;
          }
          img {
            width: 100%;
            max-width: 1100px;
            height: auto;
            display: block;
            margin: 0 auto;
          }
          @media print {
            body {
              padding: 0;
            }
            img {
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <img src="${imageUrl}" alt="${title}" />
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 250);
};
