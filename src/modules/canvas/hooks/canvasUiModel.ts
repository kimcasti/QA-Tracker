import type { CanvasCatalog, CanvasState, CanvasNodeVisual } from '../types';
import { canvasKey } from '../utils/canvasState';

/** One explicit mutation at a time: never queue a stale UI intent. */
export class CanvasWriteGate {
  pending = false;
  blocked = false;
  active = true;
  reset() { if (!this.pending) this.blocked = false; }
  dispose() { this.active = false; }
  assertActive() { if (!this.active) throw new Error('El proyecto cambió; abre de nuevo el editor.'); }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.assertActive();
    if (this.blocked) throw new Error('Recarga el proyecto antes de volver a guardar.');
    if (this.pending) throw new Error('Hay un guardado en curso.');
    this.pending = true;
    try { return await operation(); }
    catch (error) {
      const status = (error as { response?: { status?: number }; status?: number })?.response?.status
        ?? (error as { status?: number })?.status;
      if (!status || status === 409 || status === 408 || status >= 500) this.blocked = true;
      throw error;
    }
    finally { this.pending = false; }
  }
}

export function canManageCanvas(organizationDocumentId: string | undefined, memberships: Array<{ organization?: { documentId: string }; role?: { code: string } }> = []) {
  return !!organizationDocumentId && memberships.some(item => item.organization?.documentId === organizationDocumentId && ['owner', 'qa-lead', 'qa-engineer', 'manager'].includes(item.role?.code || ''));
}

export const canvasColors = {
  default: { label: 'Predeterminado', value: '#ffffff' }, blue: { label: 'Azul', value: '#e9f2ff' }, green: { label: 'Verde', value: '#e9f6ed' }, yellow: { label: 'Amarillo', value: '#fff7d9' }, orange: { label: 'Naranja', value: '#fff0e3' }, violet: { label: 'Violeta', value: '#f2ecfc' }, pink: { label: 'Rosa', value: '#fcecf3' },
};

export function arrangeCanvas(catalog: CanvasCatalog, state: CanvasState, heights: Record<string, number> = {}): Record<string, CanvasNodeVisual> {
  const nodes = { ...state.nodes };
  let y = 50;
  const place = (key: string, x: number, top: number) => { nodes[key] = { ...nodes[key], x, y: top }; };
  for (const module of catalog.modules) {
    const start = y;
    place(canvasKey('module', module.documentId), 40, start);
    const children = catalog.functionalities.filter(item => item.moduleDocumentId === module.documentId);
    for (const child of children) {
      const key = canvasKey('functionality', child.documentId);
      place(key, 410, y);
      y += Math.max(190, heights[key] || 190) + 28;
    }
    y = Math.max(y, start + Math.max(170, heights[canvasKey('module', module.documentId)] || 170) + 28) + 32;
  }
  for (const item of catalog.functionalities.filter(item => !catalog.modules.some(module => module.documentId === item.moduleDocumentId))) {
    const key = canvasKey('functionality', item.documentId);
    place(key, 410, y); y += Math.max(190, heights[key] || 190) + 28;
  }
  let noteY = 50;
  for (const note of state.notes.filter(note => !note.anchorId)) {
    const key = canvasKey('note', note.id);
    place(key, 780, noteY); noteY += Math.max(200, heights[key] || 200) + 28;
  }
  return nodes;
}
