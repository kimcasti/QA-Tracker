import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { stripHtmlToText } from './evidenceRichText';
import {
  PublicUatSessionSummary,
  RegressionCycle,
  TestCase,
  TestResult,
  TestRun,
  TestRunResult,
  Functionality,
} from '../types';
import dayjs from 'dayjs';

export interface TestRunPdfExportData {
  testRun: TestRun;
  results: TestRunResult[];
  functionalities: Functionality[];
  testCases: TestCase[];
  publicUatSession?: PublicUatSessionSummary | null;
}

export interface DeliveryUnitProgressDocxData {
  projectName: string;
  deliveryUnitName: string;
  typeLabel: string;
  statusLabel: string;
  generatedAtLabel: string;
  periodLabel: string;
  proposalName?: string;
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
    category?: string;
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

export interface QaStrategyCandidatesPdfData {
  projectName?: string;
  generatedAt?: string;
  summary: {
    actionableCount: number;
    highPriorityCount: number;
    coveredCount: number;
    suggestedCoveragePercent: number;
    uiCount: number;
    postmanCount: number;
    k6Count: number;
    total: number;
  };
  recommendations: Array<{
    functionalityName: string;
    module: string;
    currentCoverage: {
      totalCases: number;
      automatedCases: number;
      candidateCases: number;
      manualCases: number;
    };
    recommendedCategory: string;
    recommendedTool: string;
    priority: string;
    score: number;
    reasons: string[];
    relatedTestCases: Array<{
      id: string;
      title: string;
      automationStatus?: string | null;
    }>;
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
          new Paragraph(activity.category || 'Sin categoria asignada.'),
        ])
      : [new Paragraph('No hay actividades operativas registradas en esta unidad.')];

  const functionalityRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: 'Funcionalidad', style: 'Strong' })] }),
        new TableCell({ children: [new Paragraph({ text: 'Módulo', style: 'Strong' })] }),
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
              new TextRun({ text: 'Propuesta: ', bold: true }),
              new TextRun(report.proposalName || 'No definida'),
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

async function convertImageUrlToDataUrl(imageUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('IMAGE_CONTEXT_MISSING'));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = imageUrl;
  });
}

async function normalizeImageSourceForPdf(imageSource: string) {
  const source = String(imageSource || '').trim();
  if (!source) {
    throw new Error('IMAGE_SOURCE_MISSING');
  }

  if (!source.startsWith('data:')) {
    return convertImageUrlToDataUrl(source);
  }

  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('IMAGE_CONTEXT_MISSING'));
        return;
      }

      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    image.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    image.src = source;
  });
}

function pdfText(pdf: jsPDF, text: string, x: number, y: number, maxWidth: number) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim() || 'N/A';
  const lines = pdf.splitTextToSize(normalizedText, maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * 6;
}

function buildPdfRichTextLines(
  pdf: jsPDF,
  label: string,
  content: string | null | undefined,
  maxWidth: number,
  options?: { numberedList?: boolean },
) {
  const rawContent = String(content || '').trim();

  if (!rawContent) {
    return pdf.splitTextToSize(`${label}: N/A`, maxWidth);
  }

  const hasHtmlTags = /<[^>]+>/.test(rawContent);

  if (!hasHtmlTags) {
    return pdf.splitTextToSize(`${label}: ${rawContent}`, maxWidth);
  }

  const listItemMatches = Array.from(rawContent.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match, index) => {
      const itemText = stripHtmlToText(match[1] || '').replace(/\s+/g, ' ').trim();
      if (!itemText) return '';
      return `${options?.numberedList ? `${index + 1}.` : '•'} ${itemText}`;
    })
    .filter(Boolean);

  if (listItemMatches.length > 0) {
    const lines = pdf.splitTextToSize(`${label}:`, maxWidth);
    listItemMatches.forEach(item => {
      lines.push(...pdf.splitTextToSize(item, maxWidth - 2));
    });
    return lines;
  }

  const normalizedText = stripHtmlToText(
    rawContent
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n'),
  )
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (normalizedText.length === 0) {
    return pdf.splitTextToSize(`${label}: N/A`, maxWidth);
  }

  const [firstLine, ...otherLines] = normalizedText;
  const lines = pdf.splitTextToSize(`${label}: ${firstLine}`, maxWidth);
  otherLines.forEach(line => {
    lines.push(...pdf.splitTextToSize(line, maxWidth));
  });
  return lines;
}

function stripLeadingEvidenceEmoji(value: string) {
  return value
    .replace(/^(?:\u2705|âœ…|Ã¢Å“â€¦)\s*/u, '')
    .replace(/^(?:\u26A0\uFE0F|\u26A0|âš ï¸|âš |Ã¢Å¡Â Ã¯Â¸Â|Ã¢Å¡Â )\s*/u, '')
    .replace(/^(?:\u274C|âŒ|Ã¢ÂÅ’)\s*/u, '')
    .trim();
}

function normalizePdfEvidenceText(notes?: string | null) {
  return stripHtmlToText(notes || '')
    .replace(/âœ…|✅/g, '[Verificado]')
    .replace(/âš ï¸|⚠️|⚠/g, '[Advertencia]')
    .replace(/âŒ|❌/g, '[Error]')
    .replace(/\s+/g, ' ')
    .trim();
}

type PdfEvidenceIconKind = 'verified' | 'warning' | 'error';

function parsePdfEvidenceNotesWithIcon(notes?: string | null) {
  const normalized = stripHtmlToText(notes || '').replace(/\s+/g, ' ').trim();

  const iconMatchers: Array<{ icon: PdfEvidenceIconKind; pattern: RegExp }> = [
    { icon: 'verified', pattern: /^(?:Ã¢Å“â€¦|âœ…|✅)\s*/ },
    { icon: 'warning', pattern: /^(?:Ã¢Å¡Â Ã¯Â¸Â|âš ï¸|âš |⚠️|⚠)\s*/ },
    { icon: 'error', pattern: /^(?:Ã¢ÂÅ’|âŒ|❌)\s*/ },
  ];

  for (const matcher of iconMatchers) {
    if (matcher.pattern.test(normalized)) {
      return {
        icon: matcher.icon,
        text: normalized.replace(matcher.pattern, '').trim(),
      };
    }
  }

  return {
    icon: null as PdfEvidenceIconKind | null,
    text: normalized,
  };
}

function buildPdfEvidenceIconDataUrl(icon: PdfEvidenceIconKind) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('PDF_ICON_CONTEXT_MISSING');
  }

  if (icon === 'verified') {
    context.fillStyle = '#dcfce7';
    context.strokeStyle = '#86efac';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(3, 3, 26, 26, 6);
    context.fill();
    context.stroke();

    context.strokeStyle = '#16a34a';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(9, 16);
    context.lineTo(14, 21);
    context.lineTo(23, 10);
    context.stroke();
  }

  if (icon === 'warning') {
    context.fillStyle = '#fef3c7';
    context.strokeStyle = '#f59e0b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(16, 4);
    context.lineTo(28, 27);
    context.lineTo(4, 27);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = '#92400e';
    context.fillRect(14.5, 11, 3, 8);
    context.beginPath();
    context.arc(16, 23, 1.8, 0, Math.PI * 2);
    context.fill();
  }

  if (icon === 'error') {
    context.fillStyle = '#fee2e2';
    context.strokeStyle = '#fca5a5';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(16, 16, 12, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.strokeStyle = '#dc2626';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(11, 11);
    context.lineTo(21, 21);
    context.moveTo(21, 11);
    context.lineTo(11, 21);
    context.stroke();
  }

  return canvas.toDataURL('image/png');
}

function parsePdfEvidenceNotesForExport(notes?: string | null) {
  const normalized = stripHtmlToText(notes || '').replace(/\s+/g, ' ').trim();

  const iconMatchers: Array<{ icon: PdfEvidenceIconKind; pattern: RegExp }> = [
    { icon: 'verified', pattern: /^(?:\u2705|✅|âœ…)\s*/u },
    { icon: 'warning', pattern: /^(?:\u26A0\uFE0F|\u26A0|⚠️|⚠|âš ï¸|âš )\s*/u },
    { icon: 'error', pattern: /^(?:\u274C|❌|âŒ)\s*/u },
  ];

  for (const matcher of iconMatchers) {
    if (matcher.pattern.test(normalized)) {
      return {
        icon: matcher.icon,
        text: normalized.replace(matcher.pattern, '').trim(),
      };
    }
  }

  return {
    icon: null as PdfEvidenceIconKind | null,
    text: normalized,
  };
}

export const exportTestRunToPdf = async ({
  testRun,
  results,
  functionalities,
  testCases,
  publicUatSession,
}: TestRunPdfExportData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const safeResults = Array.isArray(results) ? results : [];
  const orderedResults = [...safeResults].sort((left, right) => {
    const leftOrder = typeof left.orderIndex === 'number' ? left.orderIndex : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.orderIndex === 'number' ? right.orderIndex : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.testCaseId.localeCompare(right.testCaseId);
  });
  const safeFunctionalities = Array.isArray(functionalities) ? functionalities : [];
  const safeTestCases = Array.isArray(testCases) ? testCases : [];
  const functionalityById = new Map<string, (typeof safeFunctionalities)[number]>();
  const testCaseById = new Map<string, (typeof safeTestCases)[number]>();

  safeFunctionalities.forEach(item => {
    if (item.id) {
      functionalityById.set(item.id, item);
    }

    if (item.documentId) {
      functionalityById.set(item.documentId, item);
    }
  });

  safeTestCases.forEach(item => {
    if (item.id) {
      testCaseById.set(item.id, item);
    }

    if (item.documentId) {
      testCaseById.set(item.documentId, item);
    }
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 18;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - margin) return;
    pdf.addPage();
    cursorY = 18;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(`Reporte de Ejecución - ${testRun.testType || 'QA'}`, margin, cursorY);
  cursorY += 9;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  cursorY = pdfText(pdf, `Ejecución: ${testRun.title}`, margin, cursorY, contentWidth);
  cursorY = pdfText(
    pdf,
    `Fecha: ${testRun.executionDate || 'N/A'} | Sprint: ${testRun.sprint || 'N/A'} | Tester: ${testRun.tester || 'N/A'}`,
    margin,
    cursorY + 2,
    contentWidth,
  );
  cursorY = pdfText(
    pdf,
    `Build: ${testRun.buildVersion || 'N/A'} | Environment: ${testRun.environment || 'N/A'} | Estado: ${testRun.status}`,
    margin,
    cursorY + 2,
    contentWidth,
  );

  if (publicUatSession) {
    cursorY = pdfText(
      pdf,
      `Sesión pública: ${publicUatSession.status} | Participante: ${publicUatSession.participant?.name || 'N/A'} | Correo: ${publicUatSession.participant?.email || 'N/A'}`,
      margin,
      cursorY + 2,
      contentWidth,
    );
  }

  const total = orderedResults.length;
  const passed = orderedResults.filter(result => result.result === TestResult.PASSED).length;
  const failed = orderedResults.filter(result => result.result === TestResult.FAILED).length;
  const blocked = orderedResults.filter(result => result.result === TestResult.BLOCKED).length;
  const pending = orderedResults.filter(result => result.result === TestResult.NOT_EXECUTED).length;

  cursorY += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Resumen', margin, cursorY);
  cursorY += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  cursorY = pdfText(
    pdf,
    `Total: ${total} | Aprobados: ${passed} | Fallidos: ${failed} | Bloqueados: ${blocked} | No ejecutados: ${pending}`,
    margin,
    cursorY,
    contentWidth,
  );

  for (const [index, result] of orderedResults.entries()) {
    const functionality = functionalityById.get(result.functionalityId);
    const testCase = testCaseById.get(result.testCaseId);
    const titleText = `${index + 1}. ${result.testCaseTitle || testCase?.title || 'Caso de prueba'}`;
    const metaText = `Módulo: ${result.moduleName || functionality?.module || 'N/A'} | Funcionalidad: ${result.functionalityName || functionality?.name || 'N/A'} | Resultado: ${result.result}`;
    const innerWidth = contentWidth - 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    const titleLines = pdf.splitTextToSize(titleText, innerWidth);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    const metaLines = pdf.splitTextToSize(metaText, innerWidth);
    const preconditionsLines = buildPdfRichTextLines(
      pdf,
      'Precondiciones',
      testCase?.preconditions,
      innerWidth,
    );
    const testStepsLines = buildPdfRichTextLines(
      pdf,
      'Pasos de prueba',
      testCase?.testSteps,
      innerWidth,
      { numberedList: true },
    );
    const expectedLines = buildPdfRichTextLines(
      pdf,
      'Resultado esperado',
      result.expectedResult || testCase?.expectedResult,
      innerWidth,
    );

    const cardHeight =
      6 +
      titleLines.length * 6 +
      2 +
      metaLines.length * 5 +
      2 +
      preconditionsLines.length * 5 +
      2 +
      testStepsLines.length * 5 +
      2 +
      expectedLines.length * 5 +
      4;

    ensureSpace(cardHeight + 12);
    cursorY += 6;

    const cardTopY = cursorY;
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, cardTopY, contentWidth, cardHeight, 3, 3);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(titleLines, margin + 4, cardTopY + 7);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(metaLines, margin + 4, cardTopY + 7 + titleLines.length * 6 + 2);
    pdf.text(
      preconditionsLines,
      margin + 4,
      cardTopY + 7 + titleLines.length * 6 + 2 + metaLines.length * 5 + 2,
    );
    pdf.text(
      testStepsLines,
      margin + 4,
      cardTopY + 7 + titleLines.length * 6 + 2 + metaLines.length * 5 + 2 + preconditionsLines.length * 5 + 2,
    );
    pdf.text(
      expectedLines,
      margin + 4,
      cardTopY +
        7 +
        titleLines.length * 6 +
        2 +
        metaLines.length * 5 +
        2 +
        preconditionsLines.length * 5 +
        2 +
        testStepsLines.length * 5 +
        2,
    );

    cursorY = cardTopY + cardHeight;

    const parsedNotes = parsePdfEvidenceNotesForExport(result.notes || '');
    if (parsedNotes.icon || parsedNotes.text) {
      cursorY += 3;
      const notesLines = pdf.splitTextToSize(
        `Notas / evidencia registrada: ${parsedNotes.text || 'N/A'}`,
        contentWidth - (parsedNotes.icon ? 8 : 0),
      );
      const notesBlockHeight = Math.max(notesLines.length * 5 + 4, 14);
      ensureSpace(notesBlockHeight);
      const notesStartY = cursorY + 5;

      if (parsedNotes.icon) {
        const iconSize = 4.5;
        try {
          const iconDataUrl = buildPdfEvidenceIconDataUrl(parsedNotes.icon);
          pdf.addImage(iconDataUrl, 'PNG', margin, notesStartY - 3.6, iconSize, iconSize);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.text(notesLines, margin + iconSize + 2.5, notesStartY);
          cursorY = notesStartY + notesLines.length * 5;
        } catch (error) {
          console.warn('Falling back to text-only PDF evidence icon.', error);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          pdf.text(notesLines, margin, notesStartY);
          cursorY = notesStartY + notesLines.length * 5;
        }
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.text(notesLines, margin, notesStartY);
        cursorY = notesStartY + notesLines.length * 5;
      }
    }

    if (result.evidenceImage) {
      try {
        ensureSpace(48);
        const imageData = await normalizeImageSourceForPdf(result.evidenceImage);
        const imageHeight = 40;
        const imageWidth = Math.min(contentWidth, 120);
        pdf.addImage(imageData, 'JPEG', margin, cursorY + 3, imageWidth, imageHeight);
        cursorY += imageHeight + 6;
      } catch (error) {
        console.warn('Skipping PDF evidence image because it could not be embedded.', error);
        cursorY = pdfText(
          pdf,
          `Evidencia adjunta: ${result.evidenceImage}`,
          margin,
          cursorY + 3,
          contentWidth,
        );
      }
    }
  }

  const safeName = (testRun.title || 'Reporte_UAT').replace(/[\\/:*?"<>|]+/g, '_').trim();
  pdf.save(`${safeName || 'Reporte_UAT'}_${dayjs().format('YYYYMMDD')}.pdf`);
};

export const exportQaStrategyCandidatesToPdf = async ({
  projectName,
  generatedAt,
  summary,
  recommendations,
}: QaStrategyCandidatesPdfData) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 18;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - margin) return;
    pdf.addPage();
    cursorY = 18;
  };

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Análisis de candidatos QA', margin, cursorY);
  cursorY += 9;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  cursorY = pdfText(
    pdf,
    `Proyecto: ${projectName || 'Proyecto QA Tracker'} | Generado: ${generatedAt || dayjs().format('YYYY-MM-DD HH:mm')}`,
    margin,
    cursorY,
    contentWidth,
  );

  cursorY += 4;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Resumen', margin, cursorY);
  cursorY += 7;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  cursorY = pdfText(
    pdf,
    `Accionables: ${summary.actionableCount} | Alta prioridad: ${summary.highPriorityCount} | Ya cubiertas: ${summary.coveredCount} | Cobertura sugerida: ${summary.suggestedCoveragePercent}%`,
    margin,
    cursorY,
    contentWidth,
  );
  cursorY = pdfText(
    pdf,
    `Distribución: UI ${summary.uiCount} | Postman ${summary.postmanCount} | k6 ${summary.k6Count} | Total analizado ${summary.total}`,
    margin,
    cursorY + 2,
    contentWidth,
  );

  for (const [index, item] of recommendations.entries()) {
    ensureSpace(48);
    cursorY += 6;

    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, cursorY, contentWidth, 28, 3, 3);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text(`${index + 1}. ${item.functionalityName}`, margin + 4, cursorY + 7);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    cursorY = pdfText(
      pdf,
      `Módulo: ${item.module} | Recomendación: ${item.recommendedCategory} | Herramienta: ${item.recommendedTool} | Prioridad: ${item.priority} | Score: ${item.score}`,
      margin + 4,
      cursorY + 13,
      contentWidth - 8,
    );

    cursorY = pdfText(
      pdf,
      `Cobertura actual: ${item.currentCoverage.totalCases} casos, ${item.currentCoverage.automatedCases} automatizados, ${item.currentCoverage.candidateCases} candidatas.`,
      margin + 4,
      cursorY + 1,
      contentWidth - 8,
    );

    if (item.reasons.length > 0) {
      cursorY += 3;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Razones:', margin, cursorY);
      pdf.setFont('helvetica', 'normal');
      cursorY = pdfText(pdf, item.reasons.join(' | '), margin + 2, cursorY + 5, contentWidth - 2);
    }

    if (item.relatedTestCases.length > 0) {
      cursorY += 2;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Casos relacionados:', margin, cursorY);
      pdf.setFont('helvetica', 'normal');
      cursorY = pdfText(
        pdf,
        item.relatedTestCases
          .map(testCase => `${testCase.title}${testCase.automationStatus ? ` (${testCase.automationStatus})` : ''}`)
          .join(' | '),
        margin + 2,
        cursorY + 5,
        contentWidth - 2,
      );
    }
  }

  const safeName = (projectName || 'Analisis_Candidatos_QA').replace(/[\\/:*?"<>|]+/g, '_').trim();
  pdf.save(`${safeName || 'Analisis_Candidatos_QA'}_${dayjs().format('YYYYMMDD')}.pdf`);
};
