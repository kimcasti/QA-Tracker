import type { JSONContent } from '@tiptap/react';

// Build editor nodes instead of interpreting model output as HTML.
export function aiEvidenceParagraph(text: string): JSONContent {
  return {
    type: 'paragraph',
    content: text.trim().split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { type: 'text', text: part.slice(2, -2), marks: [{ type: 'bold' }] };
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return { type: 'text', text: part.slice(1, -1), marks: [{ type: 'code' }] };
      }
      return { type: 'text', text: part };
    }),
  };
}

export function replaceEvidenceText(document: JSONContent, paragraph: string): JSONContent {
  const images: JSONContent[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === 'image') images.push(node);
    else node.content?.forEach(visit);
  };
  visit(document);
  return { type: 'doc', content: [aiEvidenceParagraph(paragraph), ...images] };
}
