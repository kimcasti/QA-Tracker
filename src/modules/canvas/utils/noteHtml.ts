const allowed = new Set(['p', 'div', 'br', 'strong', 'b', 'i', 'em', 'ul', 'ol', 'li', 'a']);
const discard = new Set(['script', 'style', 'svg', 'math', 'iframe', 'object', 'embed', 'template', 'noscript']);

// Fail closed during SSR: escaped text, not a regex-based HTML sanitizer.
// Preserve only these inert entities so repeated validation remains idempotent.
function escapedText(html: string): string {
  return html.replace(/&(?!(?:amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function sanitizeCanvasNoteHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return escapedText(html);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const output = doc.createElement('div');
  function copy(node: Node, parent: Node): void {
    if (node.nodeType === 3) { parent.appendChild(doc.createTextNode(node.textContent ?? '')); return; }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.localName.toLowerCase();
    if (discard.has(tag)) return;
    let target = parent;
    if (allowed.has(tag)) {
      const clean = doc.createElement(tag);
      if (tag === 'a') {
        try {
          const url = new URL(element.getAttribute('href') ?? '');
          if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) {
            clean.setAttribute('href', url.href);
            if (element.getAttribute('target') === '_blank') {
              clean.setAttribute('target', '_blank');
              clean.setAttribute('rel', 'noopener noreferrer');
            }
          }
        } catch { /* Invalid and relative URLs remain non-navigable text links. */ }
      }
      parent.appendChild(clean);
      target = clean;
    }
    for (const child of Array.from(node.childNodes)) copy(child, target);
  }
  for (const node of Array.from(doc.body.childNodes)) copy(node, output);
  return output.innerHTML;
}

export function canvasNoteText(html: string): string {
  const safe = sanitizeCanvasNoteHtml(html);
  if (typeof DOMParser === 'undefined') return safe;
  const doc = new DOMParser().parseFromString(safe, 'text/html');
  for (const br of Array.from(doc.querySelectorAll('br'))) br.replaceWith(doc.createTextNode('\n'));
  for (const block of Array.from(doc.querySelectorAll('p,div,li'))) block.append(doc.createTextNode('\n'));
  return (doc.body.textContent ?? '').trim();
}
