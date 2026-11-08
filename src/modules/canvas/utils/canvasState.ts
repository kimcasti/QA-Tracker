import type { CanvasColor, CanvasState } from '../types';
import { sanitizeCanvasNoteHtml } from './noteHtml';

// Keep in sync with the independently validated server DTO.
const limits = { bytes: 262144, nodes: 1000, notes: 200, html: 20000, coordinate: 100000 } as const;
const colors = new Set(['default', 'blue', 'green', 'yellow', 'orange', 'violet', 'pink']);
const identifier = /^[A-Za-z0-9_-]{1,128}$/;
const nodeKey = /^(module|functionality):[A-Za-z0-9_-]{1,128}$/;
const anchorKey = /^(module|functionality|case):[A-Za-z0-9_-]{1,128}$/;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const invalid = (): never => { throw new Error('Canvas metadata is invalid.'); };
function requireShape(value: unknown, allowed: string[]): asserts value is Record<string, unknown> {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) invalid();
}
const byteLength = (value: string): number => new TextEncoder().encode(value).length;

/** Validate and copy visual metadata only. Domain/QA fields are not accepted. */
export function parseCanvasState(value: unknown): CanvasState {
  requireShape(value, ['version', 'nodes', 'notes', 'newElementColor']);
  if (value.version !== 1 || !record(value.nodes) || !Array.isArray(value.notes) ||
      !colors.has(value.newElementColor as string)) invalid();
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return invalid(); }
  if (byteLength(serialized) > limits.bytes || Object.keys(value.nodes as object).length > limits.nodes ||
      (value.notes as unknown[]).length > limits.notes) invalid();
  const output = emptyCanvasState();
  output.newElementColor = value.newElementColor as CanvasColor;
  const ids = new Set<string>();
  for (const note of value.notes as unknown[]) {
    requireShape(note, ['id', 'html', 'anchorId']);
    if (typeof note.id !== 'string' || !identifier.test(note.id) || ids.has(note.id) ||
        typeof note.html !== 'string' || byteLength(note.html) > limits.html ||
        ('anchorId' in note && (typeof note.anchorId !== 'string' || !anchorKey.test(note.anchorId)))) invalid();
    ids.add(note.id as string);
    output.notes.push({ id: note.id as string, html: sanitizeCanvasNoteHtml(note.html as string),
      ...('anchorId' in note ? { anchorId: note.anchorId as string } : {}) });
  }
  for (const [key, visual] of Object.entries(value.nodes as Record<string, unknown>)) {
    requireShape(visual, ['x', 'y', 'color', 'expanded']);
    if ((!nodeKey.test(key) && !(key.startsWith('note:') && ids.has(key.slice(5)))) ||
        typeof visual.x !== 'number' || !Number.isFinite(visual.x) || Math.abs(visual.x) > limits.coordinate ||
        typeof visual.y !== 'number' || !Number.isFinite(visual.y) || Math.abs(visual.y) > limits.coordinate ||
        ('color' in visual && !colors.has(visual.color as string)) ||
        ('expanded' in visual && typeof visual.expanded !== 'boolean')) invalid();
    output.nodes[key] = { x: visual.x as number, y: visual.y as number,
      ...('color' in visual ? { color: visual.color as CanvasColor } : {}),
      ...('expanded' in visual ? { expanded: visual.expanded as boolean } : {}) };
  }
  return output;
}

export function emptyCanvasState(): CanvasState {
  return { version: 1, nodes: {}, notes: [], newElementColor: 'default' };
}

export function canvasKey(kind: 'module' | 'functionality' | 'case' | 'note', id: string): string {
  return `${kind}:${id}`;
}
