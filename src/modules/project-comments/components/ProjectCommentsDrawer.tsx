import {
  DeleteOutlined,
  EditOutlined,
  PushpinFilled,
  PushpinOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { App as AntdApp, Button, Drawer, Empty, Popconfirm, Skeleton, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import BasicRichTextEditor from '../../../components/BasicRichTextEditor';
import { toApiError } from '../../../config/http';
import { hasMeaningfulEvidenceContent, normalizeEvidenceHtml } from '../../../utils/evidenceRichText';
import { useAuthSession } from '../../auth/context/AuthSessionProvider';
import { useWorkspaceAccess } from '../../workspace/hooks/useWorkspaceAccess';
import { useProjectComments } from '../hooks/useProjectComments';
import type { ProjectComment } from '../types/model';

type ProjectCommentsDrawerProps = {
  projectId?: string;
  open: boolean;
  onClose: () => void;
};

function formatDate(value: string) {
  const date = dayjs(value);
  return date.isValid() ? date.format('DD/MM/YYYY, h:mm A') : '';
}

export default function ProjectCommentsDrawer({ projectId, open, onClose }: ProjectCommentsDrawerProps) {
  const { message } = AntdApp.useApp();
  const { user } = useAuthSession();
  const { isViewer, isOwner, isQaLead } = useWorkspaceAccess();
  const { data: comments = [], isLoading, error, create, update, remove, isSaving } = useProjectComments(projectId);
  const [draft, setDraft] = useState('');
  const [editingComment, setEditingComment] = useState<ProjectComment | null>(null);
  const canModerate = isOwner || isQaLead;

  useEffect(() => {
    if (open) return;
    setDraft('');
    setEditingComment(null);
  }, [open]);

  const sortedComments = useMemo(
    () => [...comments].sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf()),
    [comments],
  );

  const saveComment = async () => {
    if (!hasMeaningfulEvidenceContent(draft)) {
      message.warning('Escribe un comentario antes de guardarlo.');
      return;
    }
    try {
      if (editingComment) {
        await update({ documentId: editingComment.documentId, update: { content: draft } });
        message.success('Comentario actualizado.');
      } else {
        await create(draft);
        message.success('Comentario publicado.');
      }
      setDraft('');
      setEditingComment(null);
    } catch (saveError) {
      message.error(toApiError(saveError).message || 'No se pudo guardar el comentario.');
    }
  };

  const startEdit = (comment: ProjectComment) => {
    setEditingComment(comment);
    setDraft(normalizeEvidenceHtml(comment.content));
  };

  const handleDelete = async (comment: ProjectComment) => {
    try {
      await remove(comment.documentId);
      if (editingComment?.documentId === comment.documentId) {
        setEditingComment(null);
        setDraft('');
      }
      message.success('Comentario eliminado.');
    } catch (deleteError) {
      message.error(toApiError(deleteError).message || 'No se pudo eliminar el comentario.');
    }
  };

  return (
    <Drawer
      title={<div><div className="text-base font-semibold text-slate-800">Comentarios del proyecto</div><div className="mt-0.5 text-xs font-normal text-slate-500">Contexto compartido para el equipo QA</div></div>}
      open={open}
      onClose={onClose}
      width={520}
      destroyOnHidden
      className="qa-project-comments-drawer"
      styles={{ body: { padding: 20, background: '#f8fafc' } }}
    >
      {!isViewer ? (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">{editingComment ? 'Editar comentario' : 'Nuevo comentario'}</span>
            {editingComment ? <Button type="link" size="small" onClick={() => { setEditingComment(null); setDraft(''); }}>Cancelar edición</Button> : null}
          </div>
          <BasicRichTextEditor
            value={draft}
            onChange={setDraft}
            voiceSessionKey={`project-comment:${projectId || ''}:${editingComment?.documentId || 'new'}`}
            placeholder="Comparte un avance, hallazgo o bloqueo con el equipo..."
            minHeightClassName="min-h-[96px]"
          />
          <div className="mt-3 flex justify-end">
            <Button type="primary" icon={<SendOutlined />} loading={isSaving} onClick={() => void saveComment()}>
              {editingComment ? 'Guardar cambios' : 'Publicar comentario'}
            </Button>
          </div>
        </section>
      ) : (
        <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">Tienes acceso de solo lectura a los comentarios del proyecto.</div>
      )}

      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
      {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">No fue posible cargar los comentarios.</div> : null}
      {!isLoading && !error && sortedComments.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no hay comentarios en este proyecto." /> : null}

      <div className="space-y-3" aria-label="Comentarios del proyecto">
        {sortedComments.map(comment => {
          const isAuthor = comment.author?.id === user?.id;
          const canDelete = isAuthor || canModerate;
          return (
            <article key={comment.documentId} className={`rounded-2xl border bg-white p-4 shadow-sm ${comment.isPinned ? 'border-sky-200 ring-1 ring-sky-100' : 'border-slate-200'}`}>
              <div className="mb-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-800">{comment.author?.username || 'Usuario'}</span>{comment.isPinned ? <Tag color="blue" className="m-0 rounded-full text-[11px]"><PushpinFilled /> Fijado</Tag> : null}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{formatDate(comment.createdAt)}{comment.updatedAt !== comment.createdAt ? ' · editado' : ''}</div>
                </div>
                <div className="flex items-center gap-1">
                  {canModerate ? <Tooltip title={comment.isPinned ? 'Quitar de fijados' : 'Fijar comentario'}><Button type="text" size="small" icon={comment.isPinned ? <PushpinFilled /> : <PushpinOutlined />} onClick={() => void update({ documentId: comment.documentId, update: { isPinned: !comment.isPinned } })} aria-label={comment.isPinned ? 'Quitar comentario de fijados' : 'Fijar comentario'} /></Tooltip> : null}
                  {isAuthor ? <Tooltip title="Editar"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => startEdit(comment)} aria-label="Editar comentario" /></Tooltip> : null}
                  {canDelete ? <Popconfirm title="¿Eliminar este comentario?" description="Esta acción no se puede deshacer." okText="Eliminar" okButtonProps={{ danger: true }} cancelText="Cancelar" onConfirm={() => void handleDelete(comment)}><Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Eliminar comentario" /></Popconfirm> : null}
                </div>
              </div>
              <div className="qa-rich-text-content text-sm leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: normalizeEvidenceHtml(comment.content) }} />
            </article>
          );
        })}
      </div>
    </Drawer>
  );
}
