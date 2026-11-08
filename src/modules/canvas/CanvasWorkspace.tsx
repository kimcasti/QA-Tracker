import { Alert, Button, Drawer, Modal, Spin } from 'antd';
import { DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useWorkspaceAccess } from '../workspace/hooks/useWorkspaceAccess';
import { invalidateWorkspaceCache } from '../workspace/services/workspaceService';
import { BulkPasteCasesModal } from '../test-cases/components/BulkPasteCasesModal';
import type { TestCase } from '../../types';
import type { BatchResult } from '../test-cases/utils/saveBatch';
import { CanvasBoard } from './components/CanvasBoard';
import { arrangeCanvas, canManageCanvas, canvasColors, CanvasWriteGate } from './hooks/canvasUiModel';
import { canvasKey } from './utils/canvasState';
import { canvasNoteText, sanitizeCanvasNoteHtml } from './utils/noteHtml';
import { createCanvasCases, loadCanvas, saveCanvas, saveCanvasFunctionality, saveCanvasModule } from './services/canvasService';
import { resolveCanvasCaseEdit } from './caseEditContext';
import type { CanvasColor, CanvasData, CanvasFunctionalityInput, CanvasState } from './types';
import './components/canvas.css';
import './components/workspace.css';

const TestCaseManagement = lazy(() => import('../../components/TestCaseManagement'));
type Point = { x: number; y: number };
type Tool = 'module' | 'functionality' | 'note' | 'cases';
type RecordEditor = { kind: 'module' | 'functionality'; documentId?: string; parentId?: string; name: string; position?: Point; color: CanvasColor; fields?: CanvasFunctionalityInput };
type NoteEditor = { id?: string; html: string; anchorId?: string; position?: Point; color: CanvasColor };
const colors = Object.entries(canvasColors) as Array<[CanvasColor, { label: string; value: string }]>;
const ignore = () => {};
const enumOptions = {
  priority: [['critical', 'Crítico'], ['high', 'Alto'], ['medium', 'Medio'], ['low', 'Bajo']],
  impactLevel: [['high', 'Alto'], ['medium', 'Medio'], ['low', 'Bajo']],
  probabilityLevel: [['high', 'Alta'], ['medium', 'Media'], ['low', 'Baja']],
  status: [['backlog', 'Backlog'], ['in_progress', 'En desarrollo'], ['mvp', 'MVP'], ['post_mvp', 'Post MVP'], ['completed', 'Completado'], ['failed', 'Fallido']],
};

export default function CanvasWorkspace({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const access = useWorkspaceAccess();
  const queryKey = useMemo(() => ['canvas', projectId], [projectId]);
  const query = useQuery({ queryKey, queryFn: () => loadCanvas(projectId), retry: false, staleTime: 0, refetchOnWindowFocus: false });
  const data = query.data;
  const latest = useRef<CanvasData | undefined>(data); latest.current = data;
  const gate = useMemo(() => new CanvasWriteGate(), [projectId]);
  const assertWriteActive = useMemo(() => () => gate.assertActive(), [gate]);
  useEffect(() => { gate.active = true; return () => gate.dispose(); }, [gate]);
  useEffect(() => { if (query.isError) gate.blocked = true; }, [query.isError, gate]);
  const canEdit = !access.isError && canManageCanvas(data?.context.organizationDocumentId, access.data?.memberships);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const [editor, setEditor] = useState<RecordEditor>();
  const [noteEditor, setNoteEditor] = useState<NoteEditor>();
  const [reader, setReader] = useState<string>();
  const [deleteNoteId, setDeleteNoteId] = useState<string>();
  const [targetKind, setTargetKind] = useState<'functionality' | 'cases'>();
  const [targetId, setTargetId] = useState('');
  const [bulkId, setBulkId] = useState<string>();
  const [colorKey, setColorKey] = useState<string>();
  const [search, setSearch] = useSearchParams();
  const rootRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [linkBox, setLinkBox] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const busy = pending || query.isFetching || query.isError || gate.blocked;
  const catalog = data?.catalog;
  const state = data?.snapshot.state;
  const targets = useMemo(() => catalog ? [
    ...catalog.modules.map(item => ({ key: canvasKey('module', item.documentId), name: `Módulo: ${item.name}` })),
    ...catalog.functionalities.map(item => ({ key: canvasKey('functionality', item.documentId), name: `Funcionalidad: ${item.name}` })),
    ...catalog.cases.map(item => ({ key: canvasKey('case', item.documentId), name: `Caso: ${item.title}` })),
  ] : [], [catalog]);
  const targetExists = (key: string) => targets.some(item => item.key === key);

  function publish(next: CanvasData) {
    gate.assertActive(); latest.current = next; queryClient.setQueryData(queryKey, next);
  }
  async function fresh() { const next = await loadCanvas(projectId); publish(next); return next; }
  async function commitVisual(nextState: CanvasState) {
    gate.assertActive(); const current = latest.current;
    if (!current) throw new Error('No se ha cargado el Canvas.');
    const snapshot = await saveCanvas(current.context.documentId, current.snapshot.revision, nextState, assertWriteActive);
    gate.assertActive(); publish({ ...latest.current!, snapshot });
  }
  async function runWrite<T,>(operation: () => Promise<T>): Promise<T> {
    if (!canEdit) throw new Error('No tienes permisos para modificar este proyecto.');
    setPending(true); setError(''); setNotice('');
    try { return await gate.run(operation); }
    catch (cause) {
      if (gate.active) {
        const status = (cause as { response?: { status?: number } })?.response?.status;
        const reason = status === 409 ? 'El Canvas cambió en otra sesión.' : (cause instanceof Error ? cause.message : 'No se pudo guardar.');
        setError(`${reason}${gate.blocked ? ' Por seguridad, recarga antes de guardar de nuevo; el servidor puede haber recibido parte de la operación.' : ''}`);
      }
      throw cause;
    } finally { if (gate.active) setPending(false); }
  }
  const writeVisual = (transform: (current: CanvasState) => CanvasState) => runWrite(() => commitVisual(transform(latest.current!.snapshot.state)));
  function clearEditors() { setEditor(undefined); setNoteEditor(undefined); setReader(undefined); setDeleteNoteId(undefined); setTargetKind(undefined); setBulkId(undefined); setColorKey(undefined); setLinkBox(false); }
  async function refresh() {
    if (gate.pending) return;
    clearEditors(); setError(''); setPending(true);
    try { await fresh(); gate.reset(); setNotice('Canvas actualizado desde el servidor.'); }
    catch (cause) { gate.blocked = true; setError(cause instanceof Error ? cause.message : 'No se pudo recargar.'); }
    finally { if (gate.active) setPending(false); }
  }
  function heights() {
    const result: Record<string, number> = {};
    rootRef.current?.querySelectorAll<HTMLElement>('.canvas-node[data-node]').forEach(el => { result[el.dataset.node!] = el.offsetHeight; });
    return result;
  }
  function focusCard(key: string) {
    requestAnimationFrame(() => {
      if (!gate.active) return;
      const el = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-node]') || []).find(item => item.dataset.node === key);
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); el?.focus({ preventScroll: true });
    });
  }
  async function recordVisual(kind: 'module' | 'functionality', id: string, creation: RecordEditor) {
    const current = await fresh(); gate.assertActive();
    const key = canvasKey(kind, id);
    const fallback = arrangeCanvas(current.catalog, current.snapshot.state, heights())[key] || { x: 40, y: 50 };
    try { await commitVisual({ ...current.snapshot.state, nodes: { ...current.snapshot.state.nodes, [key]: { ...fallback, ...creation.position, color: creation.color } } }); }
    catch (cause) { setNotice('El registro QA ya se guardó. No lo vuelvas a crear: recarga para actualizar su distribución.'); throw cause; }
    focusCard(key);
  }
  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor || busy || !canEdit) return;
    const input = new FormData(event.currentTarget); const name = String(input.get('name') || '').trim();
    if (!name) { setError('Escribe un nombre.'); return; }
    const draft = editor;
    await runWrite(async () => {
      const current = latest.current!;
      if (draft.kind === 'module') {
        const saved = await saveCanvasModule(current.context.documentId, { documentId: draft.documentId, name }, assertWriteActive);
        gate.assertActive(); setEditor(undefined);
        if (!draft.documentId) await recordVisual('module', saved.documentId, draft); else await fresh();
      } else {
        const fields: CanvasFunctionalityInput = { name, ...(draft.documentId ? { documentId: draft.documentId } : {}), moduleDocumentId: draft.parentId ?? null };
        for (const field of ['sprintDocumentId', 'deliveryDate', 'priority', 'impactLevel', 'probabilityLevel', 'status'] as const) {
          (fields as Record<string, unknown>)[field] = String(input.get(field) || '') || null;
        }
        const saved = await saveCanvasFunctionality(current.context.documentId, fields, assertWriteActive);
        gate.assertActive(); setEditor(undefined);
        if (!draft.documentId) await recordVisual('functionality', saved.documentId, draft); else await fresh();
      }
      invalidateWorkspaceCache();
      await Promise.allSettled(['functionalities', 'modules', 'workspace'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      if (gate.active) setNotice('Registro guardado en QA Tracker.');
    }).catch(ignore);
  }
  function openRecord(kind: 'module' | 'functionality', documentId?: string, parentId?: string, position?: Point) {
    if (!canEdit || busy || !catalog || !state) return;
    setError('');
    const item = kind === 'module' ? catalog.modules.find(m => m.documentId === documentId) : catalog.functionalities.find(f => f.documentId === documentId);
    if (documentId && !item) return;
    const func = kind === 'functionality' ? catalog.functionalities.find(f => f.documentId === documentId) : undefined;
    const parent = func?.moduleDocumentId ?? parentId;
    if (kind === 'functionality' && !documentId && !catalog.modules.some(m => m.documentId === parent)) return;
    setEditor({ kind, documentId, parentId: parent || undefined, name: item?.name || '', fields: func, position, color: state.newElementColor });
  }
  function openNote(id?: string, anchorId?: string, position?: Point) {
    if (!canEdit || busy || !state || (anchorId && !targetExists(anchorId))) return;
    const note = id ? state.notes.find(item => item.id === id) : undefined;
    if (id && !note) return;
    setReader(undefined); setError(''); setLinkBox(false); selection.current = null;
    setNoteEditor({ id, html: note?.html || '', anchorId: note?.anchorId || anchorId, position, color: state.newElementColor });
  }
  function openNotes(anchorId: string) {
    if (!state || !targetExists(anchorId)) return;
    if (state.notes.some(note => note.anchorId === anchorId)) setReader(anchorId);
    else if (canEdit) openNote(undefined, anchorId);
  }
  async function saveNote() {
    if (!noteEditor || !bodyRef.current || busy || !canEdit) return;
    const html = sanitizeCanvasNoteHtml(bodyRef.current.innerHTML);
    if (!canvasNoteText(html).trim()) { setError('Escribe el contenido de la nota.'); return; }
    if (html.length > 20000) { setError('La nota admite hasta 20.000 caracteres de contenido enriquecido.'); return; }
    if (noteEditor.anchorId && !targetExists(noteEditor.anchorId)) { setError('La referencia ya no pertenece a este proyecto.'); return; }
    const draft = noteEditor, id = draft.id || crypto.randomUUID(); const key = canvasKey('note', id);
    await writeVisual(current => {
      if (draft.id && !current.notes.some(note => note.id === draft.id)) throw new Error('La nota ya no existe; recarga el Canvas.');
      const note = { id, html, ...(draft.anchorId ? { anchorId: draft.anchorId } : {}) };
      const nodes = { ...current.nodes };
      if (!nodes[key]) {
        const bottom = Math.max(50, ...current.notes.filter(n => !n.anchorId).map(n => {
          const pos = current.nodes[canvasKey('note', n.id)]; return (pos?.y ?? 50) + Math.max(220, heights()[canvasKey('note', n.id)] || 220) + 28;
        }));
        nodes[key] = { x: draft.position?.x ?? 780, y: draft.position?.y ?? bottom, color: draft.color };
      }
      return { ...current, nodes, notes: draft.id ? current.notes.map(n => n.id === id ? note : n) : [...current.notes, note] };
    }).then(() => { if (!gate.active) return; setNoteEditor(undefined); setNotice('Nota guardada en el Canvas de este proyecto.'); if (!draft.anchorId) focusCard(key); }).catch(ignore);
  }
  function rememberSelection() {
    const value = window.getSelection();
    if (value?.rangeCount && bodyRef.current?.contains(value.anchorNode) && bodyRef.current.contains(value.focusNode)) selection.current = value.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    bodyRef.current?.focus();
    if (selection.current && bodyRef.current?.contains(selection.current.commonAncestorContainer)) { const value = window.getSelection(); value?.removeAllRanges(); value?.addRange(selection.current); }
  }
  function format(command: string) { restoreSelection(); document.execCommand(command); rememberSelection(); }
  function insertLink() {
    let url: URL; try { url = new URL(linkUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { setError('Usa una URL http:// o https:// completa, sin credenciales.'); return; }
    restoreSelection();
    if (window.getSelection()?.isCollapsed) document.execCommand('insertText', false, url.href);
    else document.execCommand('createLink', false, url.href);
    setLinkBox(false); setLinkUrl(''); rememberSelection();
  }
  async function confirmDeleteNote() {
    if (!deleteNoteId || busy) return;
    const id = deleteNoteId;
    await writeVisual(current => {
      if (!current.notes.some(note => note.id === id)) throw new Error('La nota cambió; recarga el Canvas.');
      const nodes = { ...current.nodes }; delete nodes[canvasKey('note', id)];
      return { ...current, nodes, notes: current.notes.filter(note => note.id !== id) };
    }).then(() => { if (!gate.active) return; setDeleteNoteId(undefined); if (reader && !latest.current!.snapshot.state.notes.some(n => n.anchorId === reader)) setReader(undefined); setNotice('Nota eliminada. Los registros QA no cambiaron.'); }).catch(ignore);
  }
  function startTool(kind: Tool) {
    if (!canEdit || busy) return;
    if (kind === 'module') openRecord('module');
    else if (kind === 'note') openNote();
    else { setTargetKind(kind); setTargetId(''); }
  }
  function dropTool(kind: Tool, anchorId: string | undefined, x: number, y: number, sourceProjectId: string) {
    if (sourceProjectId !== projectId || !canEdit || busy || !catalog) return;
    const point = { x: Math.max(0, Math.min(100000, x)), y: Math.max(0, Math.min(100000, y)) };
    if (kind === 'module' && !anchorId) openRecord('module', undefined, undefined, point);
    if (kind === 'functionality' && catalog.modules.some(m => canvasKey('module', m.documentId) === anchorId)) openRecord('functionality', undefined, anchorId!.slice(7), point);
    if (kind === 'cases') { const parent = catalog.functionalities.find(f => canvasKey('functionality', f.documentId) === anchorId); if (parent) setBulkId(parent.documentId); }
    if (kind === 'note' && (!anchorId || targetExists(anchorId))) openNote(undefined, anchorId, anchorId ? undefined : point);
  }
  async function saveBulk(cases: TestCase[], onProgress: (count: number) => void): Promise<BatchResult> {
    if (!bulkId) throw new Error('Selecciona una funcionalidad.');
    return runWrite(async () => {
      const result = await createCanvasCases(latest.current!.context.documentId, bulkId, cases, onProgress, assertWriteActive);
      gate.assertActive();
      if (result.failed?.ambiguous) gate.blocked = true;
      try { await fresh(); } catch { gate.blocked = true; setError('No se pudo recargar el resultado. Conserva la confirmación del bloque y recarga antes de volver a crear casos.'); }
      invalidateWorkspaceCache();
      await Promise.allSettled(['test-cases', 'functionalities', 'workspace'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      return result;
    });
  }
  const ErrorNotice = () => {
    const message = error || (query.isError || gate.blocked ? 'No se pudo actualizar el Canvas. Recarga antes de editar.' : '');
    return message ? <Alert type="error" showIcon title={message} /> : null;
  };
  if (query.isPending) return <section className="canvas-screen"><h1>Canvas</h1><Spin tip="Cargando Canvas del proyecto…"><div style={{ height: 120 }} /></Spin></section>;
  if (!data || !catalog || !state) return <section className="canvas-screen"><h1>Canvas</h1><Alert type="error" showIcon title="No se pudo cargar el Canvas del proyecto." description="No se ha creado ni reemplazado ningún dato local." /><Button onClick={() => void refresh()}>Recargar</Button><ErrorNotice /></section>;
  const selectedColor = colorKey ? state.nodes[colorKey]?.color || 'default' : 'default';
  const colorName = targets.find(t => t.key === colorKey)?.name || 'Nota';
  const currentPosition = colorKey ? state.nodes[colorKey] || arrangeCanvas(catalog, state, heights())[colorKey] || { x: 0, y: 0 } : { x: 0, y: 0 };
  const bulkParent = catalog.functionalities.find(item => item.documentId === bulkId);
  const caseId = search.get('case'), caseCode = search.get('functionality');
  const caseContext = caseId && caseCode ? resolveCanvasCaseEdit(catalog, projectId, caseCode, caseId) : null;
  const returnToCanvas = () => { setSearch({}); void refresh(); };
  if (caseId) return <section className="canvas-screen canvas-case-page"><Button onClick={returnToCanvas}>← Volver al Canvas</Button>{caseContext ? <Suspense fallback={<Spin />}><TestCaseManagement key={`${projectId}:${caseContext.functionality.documentId}:${caseId}`} projectId={projectId} functionalityId={caseContext.functionality.code} functionalityDocumentId={caseContext.functionality.documentId} organizationDocumentId={data.context.organizationDocumentId} functionalityName={caseContext.functionality.name} moduleName={caseContext.moduleName} initialCaseId={caseId} readOnly={!canEdit || busy} assertWriteActive={assertWriteActive} onClose={returnToCanvas} /></Suspense> : <Alert type="error" title="Este caso no pertenece al Canvas del proyecto o ya no está disponible." />}</section>;
  return <section className="canvas-screen" ref={rootRef} aria-label="Canvas del proyecto">
    <header className="canvas-screen-heading"><div><h1>Canvas</h1><p>Explora lo que tienes. Construye lo que falta.</p></div><div className="canvas-toolbar"><Button icon={<ReloadOutlined aria-hidden />} disabled={pending} onClick={() => void refresh()}>Recargar</Button><Button disabled={!canEdit || busy} onClick={() => void writeVisual(current => ({ ...current, nodes: arrangeCanvas(catalog, current, heights()) })).catch(ignore)}>Ordenar Canvas</Button>{canEdit && <Button type="primary" disabled={busy} onClick={() => openRecord('module')}>+ Módulo</Button>}</div></header>
    <div className="canvas-summary">{catalog.modules.length} módulos · {catalog.functionalities.length} funcionalidades · {catalog.cases.length} casos de prueba <span>· Distribución y notas independientes por proyecto</span></div>
    <div aria-live="polite"><ErrorNotice />{notice && <p className="canvas-feedback" role="status">{notice}</p>}{!canEdit && <p className="canvas-feedback">Solo lectura. Puedes explorar los casos y consultar las notas.</p>}</div>
    <div className="canvas-workspace">
      {canEdit && <aside className="canvas-toolbox" aria-label="Elementos del Canvas"><h2>Elementos</h2><p>Pulsa o arrastra al Canvas.</p><div className="canvas-tool-buttons">{(['module', 'functionality', 'note', 'cases'] as Tool[]).map((kind, index) => <button key={kind} type="button" disabled={busy} draggable={!busy} onClick={() => startTool(kind)} onDragStart={event => { if (busy) { event.preventDefault(); return; } event.dataTransfer.setData('application/x-qa-canvas', JSON.stringify({ projectId, kind })); event.dataTransfer.effectAllowed = 'copy'; }}>{['Módulo', 'Funcionalidad', 'Nota', 'Casos de prueba'][index]}</button>)}</div><h3>Color para nuevos elementos</h3><div role="radiogroup" aria-label="Color para nuevos elementos" className="canvas-new-colors">{colors.map(([key, value]) => <button role="radio" aria-checked={state.newElementColor === key} aria-label={value.label} title={value.label} disabled={busy} key={key} style={{ background: value.value }} onClick={() => void writeVisual(current => ({ ...current, newElementColor: key })).catch(ignore)}><span aria-hidden="true">{state.newElementColor === key ? '✓' : ''}</span></button>)}</div><p>{canvasColors[state.newElementColor].label}</p><p>Solo se aplica a módulos, funcionalidades y notas nuevas.</p><p>Módulo → Funcionalidad → Casos.<br />Las conexiones indican pertenencia, no orden de ejecución.</p></aside>}
      <div className="canvas-board-stage"><CanvasBoard projectId={projectId} catalog={catalog} state={state} canEdit={canEdit} busy={busy} zoom={zoom} expanded={expanded} onToggle={id => setExpanded(current => ({ ...current, [id]: !current[id] }))} onEditCase={(code, id) => setSearch({ case: id, functionality: code })} onNotes={openNotes} onEditModule={id => openRecord('module', id)} onEditFunctionality={id => openRecord('functionality', id)} onCreateFunctionality={id => openRecord('functionality', undefined, id)} onAddCases={id => { if (canEdit && !busy) setBulkId(id); }} onEditNote={id => openNote(id)} onDeleteNote={id => { if (canEdit && !busy) setDeleteNoteId(id); }} onColor={key => { if (canEdit && !busy) setColorKey(key); }} onMove={(key, x, y) => { if (canEdit && !busy) void writeVisual(current => ({ ...current, nodes: { ...current.nodes, [key]: { ...current.nodes[key], x, y } } })).catch(ignore); }} onDropTool={dropTool} /><div className="canvas-zoom" role="group" aria-label="Zoom del Canvas"><button aria-label="Alejar" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, Number((value - .1).toFixed(1))))}>−</button><output>{Math.round(zoom * 100)}%</output><button aria-label="Acercar" disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, Number((value + .1).toFixed(1))))}>+</button><button onClick={() => setZoom(1)}>100%</button></div></div>
    </div>
    <Drawer open={!!editor} title={editor?.documentId ? `Editar ${editor.kind === 'module' ? 'módulo' : 'funcionalidad'}` : editor?.kind === 'module' ? 'Nuevo módulo' : 'Nueva funcionalidad'} onClose={() => { if (!pending) setEditor(undefined); }} maskClosable={!pending} keyboard={!pending} size={460} destroyOnHidden>
      {editor && <form className="canvas-form" onSubmit={event => void saveRecord(event)} key={`${editor.kind}:${editor.documentId || 'new'}`}><p>Proyecto: <strong>{projectId}</strong></p><p>Se guardará el registro real de QA Tracker, no una copia del Canvas.</p><ErrorNotice /><label>Nombre<input name="name" required maxLength={160} defaultValue={editor.name} autoFocus disabled={busy} /></label>{editor.kind === 'functionality' && <><p>Módulo: {catalog.modules.find(item => item.documentId === editor.parentId)?.name || 'Sin módulo'}</p><section className="canvas-optional"><p>Solo el nombre es obligatorio. Los demás datos pueden quedar sin definir.</p><label>Sprint (opcional)<select name="sprintDocumentId" defaultValue={editor.fields?.sprintDocumentId || ''} disabled={busy}><option value="">Sin asignar</option>{catalog.sprints.map(item => <option value={item.documentId} key={item.documentId}>{item.name}</option>)}</select></label><label>Fecha de entrega (opcional)<input name="deliveryDate" type="date" defaultValue={editor.fields?.deliveryDate || ''} disabled={busy} /></label>{(['priority', 'impactLevel', 'probabilityLevel', 'status'] as const).map((field, i) => <label key={field}>{['Prioridad', 'Impacto', 'Probabilidad', 'Estado actual'][i]} (opcional)<select name={field} aria-label={`${['Prioridad', 'Impacto', 'Probabilidad', 'Estado actual'][i]} (opcional)`} defaultValue={editor.fields?.[field] || ''} disabled={busy}><option value="">Sin definir</option>{enumOptions[field].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}</section></>}<div className="canvas-form-actions"><Button disabled={pending} onClick={() => setEditor(undefined)}>Cancelar</Button><Button type="primary" htmlType="submit" loading={pending} disabled={busy}>{editor.documentId ? 'Guardar cambios' : 'Crear registro'}</Button></div></form>}
    </Drawer>
    <Modal open={!!noteEditor} title={noteEditor?.id ? 'Editar nota' : 'Nueva nota'} onCancel={() => { if (!pending) setNoteEditor(undefined); }} footer={null} destroyOnHidden maskClosable={!pending} keyboard={!pending} width={540}>
      {noteEditor && <div className="canvas-form"><p>Proyecto: <strong>{projectId}</strong></p><ErrorNotice /><label>Relacionado con (opcional)<select value={noteEditor.anchorId || ''} disabled={busy} onChange={event => setNoteEditor({ ...noteEditor, anchorId: event.target.value || undefined })}><option value="">Nota libre del Canvas</option>{targets.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label><label id="canvas-note-body-label">Contenido de la nota</label><div className="canvas-note-tools" role="toolbar" aria-label="Formato de la nota"><button disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => format('bold')} aria-label="Negrita"><strong>B</strong></button><button disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => format('insertUnorderedList')}>Lista</button><button disabled={busy} onMouseDown={event => event.preventDefault()} onClick={() => { rememberSelection(); setLinkBox(true); }}>Enlace</button></div><div key={noteEditor.id || 'new-note'} ref={bodyRef} role="textbox" aria-labelledby="canvas-note-body-label" aria-multiline="true" contentEditable={!busy} suppressContentEditableWarning className="canvas-note-editor" dangerouslySetInnerHTML={{ __html: sanitizeCanvasNoteHtml(noteEditor.html) }} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onInput={rememberSelection} onPaste={event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); rememberSelection(); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); }} />{linkBox && <div><label>URL del enlace<input type="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} /></label><Button onClick={insertLink}>Insertar enlace</Button></div>}<p>Negrita, listas y enlaces HTTP/HTTPS. Sin imágenes ni contenido activo.</p><div className="canvas-form-actions"><Button disabled={pending} onClick={() => setNoteEditor(undefined)}>Cancelar</Button><Button type="primary" disabled={busy} loading={pending} onClick={() => void saveNote()}>Guardar nota</Button></div></div>}
    </Modal>
    <Modal open={!!reader} title="Notas del elemento" onCancel={() => setReader(undefined)} footer={<Button onClick={() => setReader(undefined)}>Cerrar</Button>} destroyOnHidden width={540}>
      <p>{targets.find(item => item.key === reader)?.name}<br />Proyecto: <strong>{projectId}</strong></p><ErrorNotice />{state.notes.filter(note => note.anchorId === reader).map(note => <section className="canvas-attached-note" key={note.id}><header style={{ background: canvasColors[state.nodes[canvasKey('note', note.id)]?.color || 'default'].value }}>Nota</header><div className="canvas-attached-note-body" dangerouslySetInnerHTML={{ __html: sanitizeCanvasNoteHtml(note.html) }} />{canEdit && <div className="canvas-attached-note-actions"><Button type="text" icon={<EditOutlined aria-hidden />} aria-label="Editar nota" title="Editar nota" disabled={busy} onClick={() => openNote(note.id)} /><Button type="text" danger icon={<DeleteOutlined aria-hidden />} aria-label="Eliminar nota" title="Eliminar nota" disabled={busy} onClick={() => setDeleteNoteId(note.id)} /></div>}</section>)}{canEdit && <Button type="primary" disabled={busy} onClick={() => openNote(undefined, reader)}>Añadir otra nota</Button>}
    </Modal>
    <Modal open={!!deleteNoteId} title="¿Eliminar esta nota?" onCancel={() => { if (!pending) setDeleteNoteId(undefined); }} maskClosable={!pending} keyboard={!pending} destroyOnHidden footer={null} width={450}>
      <p>Proyecto: <strong>{projectId}</strong></p><blockquote className="canvas-note-preview">{canvasNoteText(state.notes.find(note => note.id === deleteNoteId)?.html || '').slice(0, 180)}</blockquote><p>Se eliminará únicamente esta nota y su color/posición. No se borrarán módulos, funcionalidades ni casos de prueba. Esta acción no se puede deshacer.</p><ErrorNotice /><div className="canvas-form-actions"><Button autoFocus disabled={pending} onClick={() => setDeleteNoteId(undefined)}>Cancelar</Button><Button type="primary" danger disabled={busy} loading={pending} onClick={() => void confirmDeleteNote()}>Eliminar nota</Button></div>
    </Modal>
    <Modal open={!!targetKind} title={`Seleccionar ${targetKind === 'cases' ? 'funcionalidad' : 'módulo'}`} onCancel={() => setTargetKind(undefined)} footer={null} destroyOnHidden>
      <form className="canvas-form" onSubmit={event => { event.preventDefault(); if (!targetId || busy || !canEdit) return; if (targetKind === 'functionality' && catalog.modules.some(m => m.documentId === targetId)) openRecord('functionality', undefined, targetId); if (targetKind === 'cases' && catalog.functionalities.some(f => f.documentId === targetId)) setBulkId(targetId); setTargetKind(undefined); }}><p>Elige explícitamente un destino de este proyecto.</p><label>{targetKind === 'cases' ? 'Funcionalidad' : 'Módulo'}<select value={targetId} required onChange={event => setTargetId(event.target.value)}><option value="">Selecciona un destino</option>{(targetKind === 'cases' ? catalog.functionalities : catalog.modules).map(item => <option key={item.documentId} value={item.documentId}>{item.name}</option>)}</select></label><div className="canvas-form-actions"><Button onClick={() => setTargetKind(undefined)}>Cancelar</Button><Button type="primary" htmlType="submit" disabled={!targetId || busy}>Continuar</Button></div></form>
    </Modal>
    <Modal open={!!colorKey} title="Color de la tarjeta" onCancel={() => setColorKey(undefined)} footer={<Button onClick={() => setColorKey(undefined)}>Cerrar</Button>} destroyOnHidden width={440}>
      <p>{colorName}</p><ErrorNotice /><div role="radiogroup" aria-label="Paleta de colores" className="canvas-color-options">{colors.map(([key, value]) => <button role="radio" key={key} aria-checked={selectedColor === key} disabled={busy} onClick={() => void writeVisual(current => ({ ...current, nodes: { ...current.nodes, [colorKey!]: { ...currentPosition, ...current.nodes[colorKey!], color: key } } })).catch(ignore)}><span style={{ background: value.value }} aria-hidden="true">{selectedColor === key ? '✓' : ''}</span>{value.label}</button>)}</div><p>Seleccionado: {canvasColors[selectedColor].label}. Solo cambia el encabezado; no prioridad, riesgo ni estado.</p>{colorKey?.startsWith('module:') && <Button disabled={busy} onClick={() => void writeVisual(current => { const nodes = { ...current.nodes }; const fallback = arrangeCanvas(catalog, current, heights()); catalog.functionalities.filter(item => item.moduleDocumentId === colorKey.slice(7)).forEach(item => { const key = canvasKey('functionality', item.documentId); nodes[key] = { ...fallback[key], ...nodes[key], color: selectedColor }; }); return { ...current, nodes }; }).catch(ignore)}>Aplicar a sus funcionalidades</Button>}<form className="canvas-form" key={colorKey} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const x = Number(form.get('x')), y = Number(form.get('y')); if (!Number.isFinite(x) || !Number.isFinite(y) || busy) return; void writeVisual(current => ({ ...current, nodes: { ...current.nodes, [colorKey!]: { ...currentPosition, ...current.nodes[colorKey!], x, y } } })).catch(ignore); }}><h3>Posición de la tarjeta</h3><p>También puedes moverla sin arrastrar.</p><div className="canvas-position"><label>X<input name="x" type="number" min="0" max="100000" required defaultValue={currentPosition.x} disabled={busy} /></label><label>Y<input name="y" type="number" min="0" max="100000" required defaultValue={currentPosition.y} disabled={busy} /></label></div><Button htmlType="submit" disabled={busy}>Mover tarjeta</Button></form>
    </Modal>
    {bulkParent && <BulkPasteCasesModal projectId={projectId} functionalityId={bulkParent.code} functionalityName={bulkParent.name} existingCases={catalog.cases.filter(item => item.functionalityDocumentId === bulkId).map(item => item.testCase)} onSave={saveBulk} onClose={() => setBulkId(undefined)} />}
  </section>;
}
