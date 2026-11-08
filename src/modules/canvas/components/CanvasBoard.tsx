import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CanvasCatalog, CanvasState, CanvasNodeVisual } from '../types';
import { canvasKey } from '../utils/canvasState';
import { arrangeCanvas, canvasColors } from '../hooks/canvasUiModel';
import { sanitizeCanvasNoteHtml } from '../utils/noteHtml';

export type BoardProps = {
  projectId: string; catalog: CanvasCatalog; state: CanvasState;
  canEdit: boolean; busy: boolean; expanded: Record<string, boolean>; zoom?: number;
  onToggle?: (functionalityDocumentId: string) => void;
  onEditCase?: (functionalityCode: string, caseDocumentId: string) => void;
  onNotes?: (anchorId: string) => void;
  onEditModule?: (moduleDocumentId: string) => void;
  onEditFunctionality?: (functionalityDocumentId: string) => void;
  onCreateFunctionality?: (moduleDocumentId: string) => void;
  onAddCases?: (functionalityDocumentId: string) => void;
  onEditNote?: (noteId: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onColor?: (nodeKey: string) => void;
  onMove?: (nodeKey: string, x: number, y: number) => void;
  onDropTool?: (kind: 'module' | 'functionality' | 'note' | 'cases', anchorId: string | undefined, x: number, y: number, sourceProjectId: string) => void;
};

type IconName = 'pencil' | 'note' | 'trash';
function Icon({ name }: { name: IconName }) {
  const paths = {
    pencil: 'm12.8 3.3 3.9 3.9M3 17l4.4-1.1L17 6.3a1.5 1.5 0 0 0 0-2.1l-1.2-1.2a1.5 1.5 0 0 0-2.1 0l-9.6 9.6L3 17Z',
    note: 'M5 2.5h7l3 3v12H5zM12 2.5v4h3M7.5 10h5M7.5 13h5',
    trash: 'M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6',
  };
  return <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Presentation only: persistence and domain writes belong to the parent. */
export function CanvasBoard(props: BoardProps) {
  const { projectId, catalog, state, expanded, canEdit, busy } = props;
  const zoom = props.zoom && Number.isFinite(props.zoom) && props.zoom > 0 ? props.zoom : 1;
  const writable = canEdit && !busy;
  const worldRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const id = useId();
  const latest = useRef(props);
  latest.current = props;
  type Drag = { project: string; key: string; pointerId: number; startX: number; startY: number; x: number; y: number; zoom: number };
  const drag = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ project: string; key: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  useEffect(() => { drag.current = null; setPreview(null); setDropTarget(null); }, [projectId, canEdit, busy, zoom]);
  const defaults = useMemo(() => arrangeCanvas(catalog, state, heights), [catalog, state, heights]);
  const position = (key: string): CanvasNodeVisual => {
    const stored = state.nodes[key] || defaults[key] || { x: 40, y: 50 };
    return preview?.project === projectId && preview.key === key && writable ? { ...stored, x: preview.x, y: preview.y } : stored;
  };
  const keys = [...catalog.modules.map(row => canvasKey('module', row.documentId)), ...catalog.functionalities.map(row => canvasKey('functionality', row.documentId)), ...state.notes.filter(note => !note.anchorId).map(note => canvasKey('note', note.id))];
  const width = Math.max(1200, ...keys.map(key => position(key).x + 400));
  const height = Math.max(800, ...keys.map(key => position(key).y + (heights[key] || 200) + 100));

  useEffect(() => {
    const world = worldRef.current;
    if (!world || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      setHeights(previous => {
        const next = { ...previous };
        let changed = false;
        for (const entry of entries) {
          const nodeKey = (entry.target as HTMLElement).dataset.node;
          const measured = Math.ceil((entry.target as HTMLElement).offsetHeight);
          if (nodeKey && next[nodeKey] !== measured) { next[nodeKey] = measured; changed = true; }
        }
        return changed ? next : previous;
      });
    });
    world.querySelectorAll<HTMLElement>('.canvas-node').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [catalog, state.notes, expanded, projectId]);

  const style = (key: string): React.CSSProperties => {
    const visual = position(key);
    const color = visual.color && Object.hasOwn(canvasColors, visual.color) ? visual.color : 'default';
    return { left: visual.x, top: visual.y, '--canvas-node-color': canvasColors[color].value } as React.CSSProperties;
  };
  const color = (key: string) => position(key).color || 'default';
  const action = (label: string, name: IconName, callback: (() => void) | undefined) => <button type="button" className={`canvas-icon-button${name === 'trash' ? ' canvas-note-trash' : ''}`} aria-label={label} title={label} disabled={!writable} onClick={callback}><Icon name={name} /></button>;
  const notesButton = (anchor: string, name: string) => {
    const count = state.notes.filter(note => note.anchorId === anchor).length;
    const label = count ? `Notas de ${name} (${count})` : `Añadir nota a ${name}`;
    if (!count && !canEdit) return null;
    return <button type="button" className="canvas-icon-button canvas-element-note" aria-label={label} title={label} disabled={busy || !props.onNotes} onClick={() => props.onNotes?.(anchor)}><Icon name="note" />{count > 0 && <span className="canvas-has-notes" aria-hidden="true" />}</button>;
  };
  const colorButton = (key: string, name: string) => canEdit && <button type="button" className="canvas-icon-button canvas-card-menu" aria-label={`Color de ${name}`} title="Color y posición de la tarjeta" aria-haspopup="dialog" disabled={busy} onClick={() => props.onColor?.(key)}><span aria-hidden="true">⋯</span></button>;
  const caseHref = (caseId: string, code: string) => `/projects/${encodeURIComponent(projectId)}/canvas?case=${encodeURIComponent(caseId)}&functionality=${encodeURIComponent(code)}`;
  const editCase = (event: React.MouseEvent, code: string, caseId: string) => {
    if (canEdit && props.onEditCase) { event.preventDefault(); if (!busy) props.onEditCase(code, caseId); }
  };

  const containsKey = (key: string) => keys.includes(key);
  const clearDrag = () => { drag.current = null; setPreview(null); };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!writable || !props.onMove || event.button !== 0 || !event.isPrimary) return;
    const target = event.target as Element;
    if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
    const head = target.closest<HTMLElement>('.canvas-node-head');
    const key = head?.closest<HTMLElement>('[data-node]')?.dataset.node;
    if (!head || !key || !containsKey(key)) return;
    const origin = position(key);
    drag.current = { project: projectId, key, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: origin.x, y: origin.y, zoom };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const dragPoint = (event: React.PointerEvent<HTMLDivElement>, current: Drag) => ({
    project: current.project, key: current.key,
    x: Math.max(20, Math.round(current.x + (event.clientX - current.startX) / current.zoom)),
    y: Math.max(20, Math.round(current.y + (event.clientY - current.startY) / current.zoom)),
  });
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!writable || current.project !== latest.current.projectId || !containsKey(current.key)) return clearDrag();
    setPreview(dragPoint(event, current));
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = dragPoint(event, current);
    clearDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const active = latest.current;
    if (active.projectId !== current.project || !active.canEdit || active.busy || !containsKey(current.key)) return;
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= 3 && (point.x !== current.x || point.y !== current.y)) active.onMove?.(current.key, point.x, point.y);
  };
  type ToolKind = 'module' | 'functionality' | 'note' | 'cases';
  const parseTool = (transfer: DataTransfer): { kind: ToolKind; projectId: string } | null => {
    if (!Array.from(transfer.types).includes('application/x-qa-canvas')) return null;
    try {
      const value: unknown = JSON.parse(transfer.getData('application/x-qa-canvas'));
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const tool = value as { kind?: unknown; projectId?: unknown };
      if (typeof tool.kind !== 'string' || !['module', 'functionality', 'note', 'cases'].includes(tool.kind) || tool.projectId !== latest.current.projectId) return null;
      return { kind: tool.kind as ToolKind, projectId: tool.projectId as string };
    } catch { return null; }
  };
  const targetAt = (target: EventTarget) => {
    const element = target as Element;
    const caseKey = element.closest<HTMLElement>('[data-case]')?.dataset.case;
    if (caseKey) return catalog.cases.some(row => canvasKey('case', row.documentId) === caseKey) ? { key: caseKey, kind: 'case' } : { key: '', kind: 'invalid' };
    const key = element.closest<HTMLElement>('[data-node]')?.dataset.node;
    if (key && containsKey(key)) return { key, kind: key.split(':')[0] };
    return key || caseKey ? { key: '', kind: 'invalid' } : { key: '', kind: 'empty' };
  };
  const destination = (kind: ToolKind, target: ReturnType<typeof targetAt>): string | undefined | false => {
    if (kind === 'module') return target.kind === 'empty' ? undefined : false;
    if (kind === 'functionality') return target.kind === 'module' ? target.key : false;
    if (kind === 'cases') return target.kind === 'functionality' ? target.key : false;
    if (target.kind === 'invalid') return false;
    return ['module', 'functionality', 'case'].includes(target.kind) ? target.key : undefined;
  };
  const dragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!writable || !props.onDropTool || !Array.from(event.dataTransfer.types).includes('application/x-qa-canvas')) return;
    const tool = parseTool(event.dataTransfer);
    // Native dragover protects payload bytes until drop. Highlight potential
    // explicit targets then; drop always validates the full project payload.
    const protectedPayload = !event.dataTransfer.getData('application/x-qa-canvas');
    const target = targetAt(event.target);
    if ((!tool && !protectedPayload) || (tool && destination(tool.kind, target) === false) || target.kind === 'invalid') {
      event.dataTransfer.dropEffect = 'none'; setDropTarget(null); return;
    }
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    setDropTarget(target.key || 'surface');
  };
  const dropTool = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDropTarget(null);
    const active = latest.current;
    if (!active.canEdit || active.busy || drag.current) return;
    const tool = parseTool(event.dataTransfer);
    if (!tool || !worldRef.current) return;
    const anchor = destination(tool.kind, targetAt(event.target));
    if (anchor === false) return;
    const rect = worldRef.current.getBoundingClientRect();
    const x = Math.max(20, Math.round((event.clientX - rect.left) / zoom));
    const y = Math.max(20, Math.round((event.clientY - rect.top) / zoom));
    active.onDropTool?.(tool.kind, anchor, x, y, tool.projectId);
  };

  return <div className="canvas-viewport" data-drop-active={dropTarget === 'surface' || undefined} onDragOver={dragOver} onDrop={dropTool} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null); }} role="region" aria-label="Mapa Canvas del proyecto" aria-busy={busy} tabIndex={0}>
    <div className="canvas-world-bounds" style={{ width: width * zoom, height: height * zoom }}>
    <div className="canvas-world" ref={worldRef} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={clearDrag} onLostPointerCapture={clearDrag} onKeyDown={event => { if (event.key === 'Escape') clearDrag(); }} style={{ width, height, transform: `scale(${zoom})` }}>
      <svg className="canvas-connectors" width={width} height={height} aria-hidden="true">
        {catalog.functionalities.map(item => {
          if (!catalog.modules.some(module => module.documentId === item.moduleDocumentId)) return null;
          const source = position(canvasKey('module', item.moduleDocumentId!));
          const target = position(canvasKey('functionality', item.documentId));
          return <path data-connection={`${item.moduleDocumentId}:${item.documentId}`} key={item.documentId} d={`M${source.x + 300} ${source.y + 64} C${source.x + 340} ${source.y + 64},${target.x - 50} ${target.y + 64},${target.x} ${target.y + 64}`} />;
        })}
      </svg>
      {!catalog.modules.length && !catalog.functionalities.length && !state.notes.some(note => !note.anchorId) && <p className="canvas-empty">Este Canvas está vacío. {canEdit ? 'Añade un módulo o una nota desde Elementos.' : 'Todavía no hay elementos en este proyecto.'}</p>}
      {catalog.modules.map(module => {
        const key = canvasKey('module', module.documentId);
        const count = catalog.functionalities.filter(item => item.moduleDocumentId === module.documentId).length;
        return <article className="canvas-node canvas-module" key={key} data-node={key} data-moving={preview?.project === projectId && preview.key === key || undefined} data-drop-active={dropTarget === key || undefined} data-color={color(key)} style={style(key)} aria-label={`Módulo ${module.name}`}>
          <header className="canvas-node-head" data-draggable={writable && !!props.onMove} title={writable ? 'Arrastra para mover; usa el menú de color y posición como alternativa.' : undefined}><div className="canvas-head-copy"><small>Módulo</small><h3>{module.name}</h3></div><div className="canvas-head-actions">{notesButton(key, module.name)}{colorButton(key, module.name)}</div></header>
          <div className="canvas-node-meta">{count} {count === 1 ? 'funcionalidad' : 'funcionalidades'}</div>
          {canEdit && <footer className="canvas-node-footer"><button type="button" className="canvas-add-button" disabled={busy} onClick={() => props.onCreateFunctionality?.(module.documentId)}>+ <span>Agregar funcionalidad</span></button>{action(`Editar módulo ${module.name}`, 'pencil', () => props.onEditModule?.(module.documentId))}</footer>}
        </article>;
      })}
      {catalog.functionalities.map(item => {
        const key = canvasKey('functionality', item.documentId);
        const cases = catalog.cases.filter(row => row.functionalityDocumentId === item.documentId);
        const isExpanded = !!expanded[item.documentId];
        const listId = `${id}-cases-${item.documentId}`;
        return <article className="canvas-node canvas-functionality" key={key} data-node={key} data-moving={preview?.project === projectId && preview.key === key || undefined} data-drop-active={dropTarget === key || undefined} data-color={color(key)} style={style(key)} aria-label={`Funcionalidad ${item.name}`}>
          <header className="canvas-node-head" data-draggable={writable && !!props.onMove} title={writable ? 'Arrastra para mover; usa el menú de color y posición como alternativa.' : undefined}><div className="canvas-head-copy"><small>Funcionalidad · {item.code}</small><h3>{item.name}</h3></div><div className="canvas-head-actions">{notesButton(key, item.name)}{colorButton(key, item.name)}</div></header>
          <button type="button" className="canvas-case-toggle" aria-expanded={isExpanded} aria-controls={listId} onClick={() => props.onToggle?.(item.documentId)}><span>{cases.length} {cases.length === 1 ? 'caso de prueba' : 'casos de prueba'}</span><span aria-hidden="true">{isExpanded ? '⌃' : '⌄'}</span></button>
          {isExpanded && <ul id={listId} className="canvas-case-list">{cases.length ? cases.map(row => <li key={row.documentId} data-case={canvasKey('case', row.documentId)} data-drop-active={dropTarget === canvasKey('case', row.documentId) || undefined}><span className="canvas-case-marker" aria-hidden="true">◇</span><div className="canvas-case-title"><a href={caseHref(row.documentId, item.code)} aria-disabled={canEdit && busy || undefined} onClick={event => editCase(event, item.code, row.documentId)}>{row.title}</a>{row.testCase?.testType && <small>{row.testCase.testType}</small>}</div>{notesButton(canvasKey('case', row.documentId), row.title)}{canEdit && <a className="canvas-icon-button canvas-case-edit" aria-label={`Editar caso ${row.title}`} title={`Editar caso ${row.title}`} aria-disabled={busy || undefined} href={caseHref(row.documentId, item.code)} onClick={event => editCase(event, item.code, row.documentId)}><Icon name="pencil" /></a>}</li>) : <li className="canvas-no-cases">Todavía no hay casos de prueba.</li>}</ul>}
          {canEdit && <footer className="canvas-node-footer"><button type="button" className="canvas-add-button" disabled={busy} onClick={() => props.onAddCases?.(item.documentId)}>+ <span>Agregar casos de prueba</span></button>{action(`Editar funcionalidad ${item.name}`, 'pencil', () => props.onEditFunctionality?.(item.documentId))}</footer>}
        </article>;
      })}
      {state.notes.filter(note => !note.anchorId).map(note => {
        const key = canvasKey('note', note.id);
        return <article className="canvas-node canvas-note canvas-node-note" key={key} data-node={key} data-moving={preview?.project === projectId && preview.key === key || undefined} data-drop-active={dropTarget === key || undefined} data-color={color(key)} style={style(key)} tabIndex={-1} aria-label="Nota">
          <header className="canvas-node-head" data-draggable={writable && !!props.onMove} title={writable ? 'Arrastra para mover; usa el menú de color y posición como alternativa.' : undefined}><div className="canvas-head-copy"><small>Nota</small></div><div className="canvas-head-actions">{colorButton(key, 'nota')}</div></header>
          <div className="canvas-note-content" dangerouslySetInnerHTML={{ __html: sanitizeCanvasNoteHtml(note.html) }} />
          {canEdit && <footer className="canvas-node-footer">{action('Editar nota', 'pencil', () => props.onEditNote?.(note.id))}{action('Eliminar nota', 'trash', () => props.onDeleteNote?.(note.id))}</footer>}
        </article>;
      })}
    </div>
    </div>
  </div>;
}
