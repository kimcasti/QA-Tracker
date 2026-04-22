const IMAGE_TAG_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
const HTML_TAG_REGEX = /<[^>]*>/g;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractFirstImageSrc(html?: string | null) {
  if (!html) return undefined;

  const match = html.match(IMAGE_TAG_REGEX);
  return match?.[1]?.trim() || undefined;
}

export function stripHtmlToText(html?: string | null) {
  if (!html) return '';

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(HTML_TAG_REGEX, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function hasMeaningfulEvidenceContent(html?: string | null) {
  if (extractFirstImageSrc(html)) return true;
  return stripHtmlToText(html).length > 0;
}

export function normalizeEvidenceHtml(value?: string | null) {
  const trimmedValue = String(value || '').trim();

  if (!trimmedValue) return '';

  const decodedValue = decodeHtmlEntities(trimmedValue);
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(decodedValue);
  if (looksLikeHtml) {
    return decodedValue;
  }

  return decodedValue
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

export function mergeEvidenceContentWithImage(
  notes?: string | null,
  evidenceImage?: string | null,
) {
  const normalizedNotes = normalizeEvidenceHtml(notes);
  const normalizedImage = String(evidenceImage || '').trim();

  if (!normalizedImage) {
    return normalizedNotes;
  }

  if (extractFirstImageSrc(normalizedNotes)) {
    return normalizedNotes;
  }

  const imageBlock = `<p><img src="${normalizedImage}" alt="Evidencia adjunta" /></p>`;
  return `${normalizedNotes}${imageBlock}`.trim();
}
