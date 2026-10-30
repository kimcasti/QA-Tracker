import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Spin, message } from 'antd';
import { toApiError } from '../../../config/http';
import { canReopenPublicUatSession, isPublicUatSessionExpired } from '../utils/publicUatSessionLifecycle';
import { usePublicUatManagementAccess, usePublicUatSessionActions } from '../hooks/usePublicUatSession';
import dayjs from 'dayjs';
import type { PublicUatSessionSummary } from '../../../types';
import { getPublicUatSessionStatus } from '../services/publicUatSessionsService';

export type PublicUatLifecycleTarget = { id: string; title: string; mode: 'reopen' | 'expiration' };
export function PublicUatLifecycleDialog({ target, onClose, projectId }: {
  target: PublicUatLifecycleTarget;
  onClose: () => void;
  projectId?: string;
}) {
  const { reopen: reopenSession, isReopening, changeExpiration, isChangingExpiration } = usePublicUatSessionActions(projectId);
  const mayManage = usePublicUatManagementAccess(projectId);
  const pending = isReopening || isChangingExpiration;
  const submitting = useRef(false);
  const [session, setSession] = useState<PublicUatSessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSession(null);
    setError('');
    getPublicUatSessionStatus(target.id).then(current => {
      if (!cancelled) {
        setSession(current);
        setNeedsRefresh(false);
        setExpiresAt(current?.expiresAt && dayjs(current.expiresAt).isAfter(dayjs())
          ? dayjs(current.expiresAt).format('YYYY-MM-DDTHH:mm') : '');
      }
    }).catch(failure => {
      if (!cancelled) {
        setError(`${toApiError(failure).message} Actualiza el estado antes de reintentar.`);
        setNeedsRefresh(true);
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target.id, refreshVersion]);
  const reopen = target.mode === 'reopen';
  const eligible = Boolean(session && (reopen ? canReopenPublicUatSession(session) : session.status !== 'draft'));
  const submit = async () => {
    if (loading || !session || !mayManage || !eligible || needsRefresh || submitting.current) return;
    const required = !reopen || session.status === 'expired' || isPublicUatSessionExpired(session);
    if ((required && !expiresAt) || (expiresAt && (!dayjs(expiresAt).isValid() || !dayjs(expiresAt).isAfter(dayjs())))) {
      setError('Selecciona una fecha y hora futuras.');
      return;
    }
    submitting.current = true;
    setError('');
    try {
      const instant = expiresAt ? dayjs(expiresAt).toISOString() : undefined;
      if (reopen) await reopenSession({ testRunDocumentId: target.id, expiresAt: instant });
      else await changeExpiration({ testRunDocumentId: target.id, expiresAt: instant! });
      message.success(reopen ? 'Sesión UAT reabierta y verificada.' : 'Caducidad actualizada y verificada.');
      onClose();
    } catch (failure) {
      // A transport failure can follow a committed write; require reconciliation.
      setNeedsRefresh(true);
      setError(`${toApiError(failure).message} Actualiza el estado antes de reintentar.`);
    } finally {
      submitting.current = false;
    }
  };
  return <Modal open title={reopen ? 'Reabrir sesión UAT' : 'Cambiar fecha de caducidad'}
    onCancel={() => { if (!submitting.current) onClose(); }} onOk={() => void submit()} confirmLoading={pending}
    cancelButtonProps={{ disabled: pending }} closable={!pending} maskClosable={false}
    okText={reopen ? 'Reabrir sesión UAT' : 'Guardar caducidad'}
    cancelText="Cancelar" okButtonProps={{ disabled: loading || !eligible || !mayManage || needsRefresh }}>
    <p className="mb-3 break-words font-semibold">{target.title}</p>
    <Alert type="info" showIcon title={reopen
      ? 'Se usará el mismo enlace público. No se eliminarán los resultados ni las evidencias existentes.'
      : 'Cambiar la caducidad no reabre una sesión completada ni revocada.'} />
    {loading ? <Spin className="my-4" /> : <Form layout="vertical" className="mt-4">
      <Form.Item label="Fecha y hora de caducidad" htmlFor="uat-lifecycle-expiry" extra="Hora local. La nueva fecha debe estar en el futuro.">
        <Input id="uat-lifecycle-expiry" type="datetime-local" value={expiresAt} disabled={pending || needsRefresh}
          onChange={event => setExpiresAt(event.target.value)} />
      </Form.Item>
    </Form>}
    {!loading && !eligible && <Alert type="warning" showIcon title={reopen
      ? 'Esta sesión no se puede reabrir en su estado actual.' : 'No hay una sesión activada cuya caducidad se pueda cambiar.'} />}
    {error && <Alert className="mt-3" type="error" showIcon title={error} />}
    {needsRefresh && <Button className="mt-3" loading={loading} disabled={pending} onClick={() => setRefreshVersion(value => value + 1)}>Actualizar estado</Button>}
  </Modal>;
}
