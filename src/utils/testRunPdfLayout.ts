import { jsPDF } from 'jspdf';
import { normalizePdfEvidenceBody } from './pdfEvidenceText';

/** Decode editor markup without dropping paragraphs surrounding lists. */
export function pdfReportParagraphs(value?: string | null, numbered = false): string[] {
  const raw = String(value || '').trim();
  if (!raw) return ['Sin información registrada.'];
  const paragraphs: string[] = [];
  if (/<\/?(?:p|div|ol|ul|li|br|strong|span|b|em)\b/i.test(raw)) {
    const root = document.createElement('div');
    root.innerHTML = raw;
    let buffer = '';
    const flush = () => {
      if (buffer.trim()) paragraphs.push(buffer.trim());
      buffer = '';
    };
    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { buffer += node.textContent || ''; return; }
      if (!(node instanceof HTMLElement)) return;
      if (['SCRIPT', 'STYLE', 'IMG'].includes(node.tagName)) return;
      if (node.tagName === 'BR') { flush(); return; }
      const block = ['P', 'DIV', 'OL', 'UL', 'LI'].includes(node.tagName);
      // TipTap wraps each list item's text in a paragraph. Keep its marker
      // attached to that first paragraph rather than emitting a separate line.
      if (block && !(['P', 'DIV'].includes(node.tagName) && /^(?:\d+\.|•)\s*$/.test(buffer))) flush();
      if (node.tagName === 'LI') {
        const list = node.parentElement;
        const index = list ? Array.from(list.children).indexOf(node) + Number(list.getAttribute('start') || 1) : 1;
        buffer = numbered || list?.tagName === 'OL' ? `${index}. ` : '• ';
      }
      node.childNodes.forEach(visit);
      if (block) flush();
    };
    root.childNodes.forEach(visit);
    flush();
  } else {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = raw;
    paragraphs.push(...decoder.value.split(/\r?\n/).filter(line => line.trim()));
  }
  return paragraphs.map(text => normalizePdfEvidenceBody(text
    .replace(/\u2260/g, ' != ').replace(/\u2264/g, ' <= ').replace(/\u2265/g, ' >= ')
    .replace(/[\u2192\u2794]/g, ' -> ').replace(/\u2190/g, ' <- ')))
    .filter(Boolean);
}

/** All coordinates use the same explicit line height, including page checks. */
export class TestRunPdfLayout {
  readonly margin = 16;
  readonly width: number;
  readonly bottom: number;
  y = 22;
  private caseTitle = '';
  constructor(readonly pdf: jsPDF, private readonly reportTitle: string) {
    this.width = pdf.internal.pageSize.getWidth() - this.margin * 2;
    this.bottom = pdf.internal.pageSize.getHeight() - 20;
    pdf.setLineHeightFactor(1.35);
  }
  private style(size = 10.5, bold = false) {
    this.pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    this.pdf.setFontSize(size);
    this.pdf.setTextColor(39, 51, 68);
    this.pdf.setCharSpace(0);
  }
  ensure(height: number) {
    if (this.y + height <= this.bottom) return false;
    this.pdf.addPage();
    this.y = 25;
    if (this.caseTitle) {
      this.style(9, true);
      const lines = this.pdf.splitTextToSize(`${this.caseTitle} · continuación`, this.width);
      for (const line of lines) {
        this.pdf.text(line, this.margin, this.y, { charSpace: 0 });
        this.y += 4.5;
      }
      this.y += 4;
    }
    return true;
  }
  text(value: string, size = 10.5, bold = false, indent = 0) {
    this.style(size, bold);
    const lines: string[] = this.pdf.splitTextToSize(normalizePdfEvidenceBody(value), this.width - indent);
    const lineHeight = size * 0.352778 * 1.35;
    // Keep ordinary steps and paragraphs together. Very long paragraphs
    // still flow across pages instead of overflowing or leaving a blank page.
    if (lines.length * lineHeight <= this.bottom - 50) this.ensure(lines.length * lineHeight);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.style(size, bold);
      this.pdf.text(line, this.margin + indent, this.y, { charSpace: 0 });
      this.y += lineHeight;
    }
  }
  startCase(title: string, metadata: string, status: string) {
    this.style(12, true);
    const height = this.pdf.splitTextToSize(normalizePdfEvidenceBody(title), this.width - 8).length * 5.72;
    this.caseTitle = '';
    this.y += 6;
    this.ensure(height + 32);
    this.caseTitle = normalizePdfEvidenceBody(title);
    this.pdf.setFillColor(239, 244, 250);
    this.pdf.roundedRect(this.margin, this.y - 4.5, this.width, height + 6, 2, 2, 'F');
    this.text(title, 12, true, 4);
    this.y += 4;
    this.text(metadata, 9);
    this.y += 1;
    this.text(`Resultado: ${status}`, 10, true);
    this.y += 3;
  }
  section(label: string, paragraphs: string[]) {
    this.y += 3;
    this.style();
    const firstLines = this.pdf.splitTextToSize(paragraphs[0] || '', this.width - 2).length;
    const firstHeight = firstLines * 5;
    this.ensure(7 + (firstHeight <= this.bottom - 65 ? firstHeight : 10));
    this.text(label, 10.5, true);
    this.y += 1;
    for (const paragraph of paragraphs) {
      this.text(paragraph, 10.5, false, 2);
      this.y += 1.2;
    }
  }
  finish() {
    const count = this.pdf.getNumberOfPages();
    for (let page = 1; page <= count; page++) {
      this.pdf.setPage(page);
      this.style(8);
      this.pdf.setTextColor(100, 116, 139);
      const title = normalizePdfEvidenceBody(this.reportTitle);
      // Wrap before truncating so even long report names stay inside the margin.
      const firstLine = this.pdf.splitTextToSize(title, this.width - 30)[0] || '';
      this.pdf.text(firstLine, this.margin, 12, { charSpace: 0 });
      this.pdf.setDrawColor(220, 227, 236);
      this.pdf.line(this.margin, 15, this.margin + this.width, 15);
      const footerY = this.pdf.internal.pageSize.getHeight() - 11;
      this.pdf.line(this.margin, footerY - 4, this.margin + this.width, footerY - 4);
      this.pdf.text('Reporte de ejecución de pruebas', this.margin, footerY);
      this.pdf.text(`Página ${page} de ${count}`, this.margin + this.width, footerY, { align: 'right' });
    }
  }
}
