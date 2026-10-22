import { jsPDF } from 'jspdf';
import { normalizePdfEvidenceBody } from './pdfEvidenceText';

import { loadPdfInlineImage, validatePdfImageDimensions } from './pdfInlineImage';

export type PdfReportCell = { text: string; header: boolean };
export type PdfReportBlock = { kind: 'text'; text: string } | { kind: 'image'; source: string; alt: string }
  | { kind: 'table'; rows: PdfReportCell[][] };

const normalizeReportText = (text: string) => normalizePdfEvidenceBody(text
  .replace(/\u2260/g, ' != ').replace(/\u2264/g, ' <= ').replace(/\u2265/g, ' >= ')
  .replace(/[\u2192\u2794]/g, ' -> ').replace(/\u2190/g, ' <- '));

/** Extract only inert text; preserve paragraph/line boundaries inside cells. */
function tableCellText(cell: Element): string {
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { parts.push(node.textContent || ''); return; }
    if (!(node instanceof HTMLElement)) return;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'].includes(node.tagName)) return;
    const block = ['P', 'DIV', 'LI', 'BR', 'TR'].includes(node.tagName);
    if (block) parts.push('\n');
    if (node.tagName === 'IMG') parts.push('[Imagen en celda no disponible]');
    node.childNodes.forEach(visit);
    if (block) parts.push('\n');
  };
  cell.childNodes.forEach(visit);
  return parts.join('').split('\n').map(line => normalizeReportText(line.trim())).filter(Boolean).join('\n');
}

/** Preserve editor image positions in the same flow as paragraphs and lists. */
export function pdfReportBlocks(value?: string | null, numbered = false): PdfReportBlock[] {
  const raw = String(value || '').trim();
  if (!raw) return [{ kind: 'text', text: 'Sin información registrada.' }];
  const blocks: PdfReportBlock[] = [];
  if (/<\/?(?:p|div|ol|ul|li|br|strong|span|b|em|img|table)\b/i.test(raw)) {
    // An inert document avoids requesting editor image URLs before validation.
    const root = new DOMParser().parseFromString(raw, 'text/html').body;
    let buffer = '';
    const flush = () => {
      if (buffer.trim()) blocks.push({ kind: 'text', text: buffer.trim() });
      buffer = '';
    };
    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { buffer += node.textContent || ''; return; }
      if (!(node instanceof HTMLElement)) return;
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'].includes(node.tagName)) return;
      if (node.tagName === 'TABLE') {
        flush();
        const sourceRows = Array.from(node.querySelectorAll('tr')).filter(row => row.closest('table') === node);
        const caption = Array.from(node.children).find(child => child.tagName === 'CAPTION');
        const cells = Array.from(node.querySelectorAll('th,td')).filter(cell => cell.closest('table') === node);
        const merged = cells.some(cell => Number(cell.getAttribute('colspan') || 1) !== 1 || Number(cell.getAttribute('rowspan') || 1) !== 1);
        if (node.querySelector('img')) {
          // Text-only cells cannot carry images. Retain their ordered rich flow
          // and source-cell context; richSection still validates every source.
          blocks.push({ kind: 'text', text: merged
            ? '[Tabla con celdas combinadas e imágenes: vista por filas; distribución simplificada.]'
            : '[Tabla con imágenes: vista por filas y celdas; distribución simplificada.]' });
          if (caption) { caption.childNodes.forEach(visit); flush(); }
          sourceRows.forEach((row, rowIndex) => {
            Array.from(row.children).filter(cell => ['TD', 'TH'].includes(cell.tagName)).forEach((cell, columnIndex) => {
              blocks.push({ kind: 'text', text: `Fila ${rowIndex + 1}, columna ${columnIndex + 1}:` });
              cell.childNodes.forEach(visit);
              flush();
            });
          });
          return;
        }
        const rows = sourceRows.map(row => Array.from(row.children).filter(cell => ['TD', 'TH'].includes(cell.tagName))
          .map(cell => ({ text: tableCellText(cell), header: cell.tagName === 'TH' })));
        if (caption) blocks.push({ kind: 'text', text: tableCellText(caption) });
        if (merged) {
          // Do not invent associations when a pasted grid merges cells. Retain
          // every cell in source-row order with an explicit searchable warning.
          blocks.push({ kind: 'text', text: '[Tabla con celdas combinadas: vista por filas; distribución simplificada.]' });
          rows.forEach((row, index) => blocks.push({ kind: 'text', text: `Fila ${index + 1}: ${row.map(cell => cell.text).join(' | ')}` }));
        } else blocks.push({ kind: 'table', rows });
        return;
      }
      if (node.tagName === 'IMG') {
        flush();
        blocks.push({ kind: 'image', source: node.getAttribute('src') || '', alt: node.getAttribute('alt') || '' });
        return;
      }
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
    blocks.push(...decoder.value.split(/\r?\n/).filter(line => line.trim()).map(text => ({ kind: 'text' as const, text })));
  }
  return blocks.map(block => block.kind !== 'text' ? block : { kind: 'text' as const, text: normalizeReportText(block.text) })
    .filter(block => block.kind !== 'text' || Boolean(block.text));
}

/** Backward-compatible text-only API for other report consumers. */
export function pdfReportParagraphs(value?: string | null, numbered = false): string[] {
  return pdfReportBlocks(value, numbered).flatMap(block => block.kind === 'text' ? [block.text]
    : block.kind === 'table' ? block.rows.map(row => row.map(cell => cell.text).join(' | ')) : []);
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
  private table(rows: PdfReportCell[][]) {
    const columns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (!columns) return;
    // Keep even extreme pasted grids legible without shrinking fonts or losing
    // columns. Each equal-width panel carries its explicit source-column range.
    if (columns > 12) {
      for (let start = 0; start < columns; start += 12) {
        this.text(`Tabla: columnas ${start + 1}-${Math.min(start + 12, columns)} de ${columns}`, 9, true);
        this.y += 2;
        this.table(rows.map(row => Array.from({ length: Math.min(12, columns - start) }, (_, index) =>
          row[start + index] || { text: '', header: row.length > 0 && row.every(cell => cell.header) })));
      }
      return;
    }
    const cellWidth = this.width / columns;
    const lineHeight = 4.2;
    const prepared = rows.map(row => ({ row, lines: Array.from({ length: columns }, (_, index) => {
      this.style(9, row[index]?.header);
      return this.pdf.splitTextToSize(row[index]?.text || '', cellWidth - 4) as string[];
    }) }));
    const count = (lines: string[][]) => Math.max(1, ...lines.map(cell => cell.length));
    const draw = (row: PdfReportCell[], lines: string[][], offset: number, length: number) => {
      const height = length * lineHeight + 4;
      for (let column = 0; column < columns; column++) {
        const x = this.margin + column * cellWidth;
        this.pdf.setDrawColor(180, 191, 205);
        this.pdf.setLineWidth(0.2);
        this.pdf.rect(x, this.y, cellWidth, height);
        this.style(9, row[column]?.header);
        lines[column].slice(offset, offset + length).forEach((line, index) =>
          this.pdf.text(line, x + 2, this.y + 5.2 + index * lineHeight, { charSpace: 0 }));
      }
      this.y += height;
    };
    // Repeat leading header rows, but bound repeated furniture. Original header
    // content is always rendered in full, even when it alone spans pages.
    let headerRows = 0;
    while (headerRows < prepared.length && prepared[headerRows].row.length && prepared[headerRows].row.every(cell => cell.header)) headerRows++;
    let headers = prepared.slice(0, headerRows);
    let headerHeight = headers.reduce((sum, item) => sum + count(item.lines) * lineHeight + 4, 0);
    if (headerHeight > 60) {
      const first = headers[0];
      headers = [{ row: first.row, lines: first.lines.map((cell, column) => {
        this.style(9, first.row[column]?.header);
        return [...cell.slice(0, 2), ...this.pdf.splitTextToSize('[Encabezado resumido]', cellWidth - 4)];
      }) }];
      headerHeight = count(headers[0].lines) * lineHeight + 4;
    }
    const nextPage = (repeat: boolean) => {
      this.ensure(this.bottom - this.y + 1);
      if (repeat) for (const header of headers) draw(header.row, header.lines, 0, count(header.lines));
    };
    for (let index = 0; index < prepared.length; index++) {
      const { row, lines } = prepared[index];
      const total = count(lines);
      let offset = 0;
      const repeat = index >= headerRows || total * lineHeight + 4 > 60;
      // Keep ordinary rows together where possible; split oversized rows into
      // bordered fragments, advancing every cell by the same line offset.
      const availableOnFreshPage = this.bottom - 50 - (repeat ? headerHeight : 0);
      if (total * lineHeight + 4 <= availableOnFreshPage && this.y + total * lineHeight + 4 > this.bottom) nextPage(repeat);
      while (offset < total) {
        let capacity = Math.floor((this.bottom - this.y - 4) / lineHeight);
        if (capacity < 1) {
          nextPage(repeat);
          capacity = Math.floor((this.bottom - this.y - 4) / lineHeight);
          if (capacity < 1) throw new Error('PDF_TABLE_NO_PAGE_SPACE');
        }
        const length = Math.min(total - offset, capacity);
        draw(row, lines, offset, length);
        offset += length;
        if (offset < total) nextPage(repeat);
      }
    }
    this.y += 3;
  }
  /** Images remain atomic; scale to one content page, never into the footer. */
  async richSection(label: string, blocks: PdfReportBlock[]) {
    let headingPending = true;
    for (const block of blocks) {
      if (block.kind === 'text') {
        if (headingPending) { this.section(label, [block.text]); headingPending = false; }
        else { this.text(block.text, 10.5, false, 2); this.y += 1.2; }
        continue;
      }
      if (block.kind === 'table') {
        if (headingPending) { this.section(label, []); headingPending = false; }
        this.table(block.rows);
        continue;
      }
      try {
        const data = await loadPdfInlineImage(block.source);
        const dimensions = this.pdf.getImageProperties(data);
        validatePdfImageDimensions(dimensions.width, dimensions.height);
        // Reserve enough room for continuation headings and section labels.
        const scale = Math.min((this.width - 4) / dimensions.width, (this.bottom - 70) / dimensions.height, 25.4 / 96);
        const height = dimensions.height * scale;
        this.ensure(height + (headingPending ? 16 : 4));
        if (headingPending) { this.section(label, []); headingPending = false; }
        // ensure() may draw a multi-line case continuation. Fit once more to
        // its actual remaining space, not an assumed fixed heading height.
        const fittedScale = Math.min(scale, (this.bottom - this.y - 4) / dimensions.height);
        if (fittedScale <= 0) throw new Error('PDF_IMAGE_NO_PAGE_SPACE');
        const fittedWidth = dimensions.width * fittedScale;
        const fittedHeight = dimensions.height * fittedScale;
        this.pdf.addImage(data, dimensions.fileType, this.margin + (this.width - fittedWidth) / 2, this.y, fittedWidth, fittedHeight);
        this.y += fittedHeight + 4;
      } catch {
        // Do not expose signed URLs/base64 payloads. A visible, searchable
        // placeholder makes incomplete exports explicit, without losing text.
        const warning = '[Imagen no disponible: origen no permitido, datos inválidos o carga/CORS fallida.]';
        if (headingPending) { this.section(label, [warning]); headingPending = false; }
        else { this.text(warning, 10.5, false, 2); this.y += 1.2; }
      }
    }
    if (headingPending) this.section(label, []);
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
