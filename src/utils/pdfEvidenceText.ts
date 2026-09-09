/** Keep evidence compatible with the PDF's built-in Helvetica/WinAnsi font. */
export function normalizePdfEvidenceBody(text: string) {
  return text
    .normalize('NFC')
    .replace(/\u2705/g, '[Verificado]')
    .replace(/\u26a0\ufe0f?/g, '[Advertencia]')
    .replace(/\u274c/g, '[Error]')
    .replace(/[\u200b-\u200d\u2060\ufeff\ufe0e\ufe0f]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    // Unsupported characters otherwise make jsPDF encode the entire line as
    // UTF-16, which the built-in font cannot render. Keep an explicit fallback.
    .replace(/[^\n\x20-\xff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac]/gu,
      character => `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`)
    .trim();
}
