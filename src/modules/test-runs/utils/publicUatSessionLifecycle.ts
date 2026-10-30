import { ExecutionStatus, type PublicUatSessionSummary } from '../../../types';

/** Presentation only: execution, public access and editing are independent axes. */
export function describePublicUatSession(session: PublicUatSessionSummary | null | undefined, status: ExecutionStatus) {
  const execution = status === ExecutionStatus.FINAL ? 'Finalizada' : 'En curso';
  if (!session || session.status === 'draft') return { execution, access: 'Sin activar', editing: 'No disponible' };
  if (session.status === 'revoked' || session.revokedAt) {
    return { execution, access: 'Revocado', editing: 'No disponible por revocación' };
  }
  // Be conservative for malformed persisted dates; Date.parse alone rolls impossible days forward.
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(session.expiresAt || '');
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = parts?.slice(1).map(value => Number(value || 0)) || [];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const timestamp = Date.parse(session.expiresAt || '');
  const validExpiry = Boolean(parts && parts[0] === session.expiresAt && month >= 1 && month <= 12 && day >= 1 && day <= maxDay &&
    hour <= 23 && minute <= 59 && second <= 59 && offsetHour <= 23 && offsetMinute <= 59 && Number.isFinite(timestamp));
  const access = !validExpiry ? 'No disponible: caducidad desconocida'
    : session.status === 'expired' || timestamp <= Date.now() ? 'Vencido'
    : `Vigente hasta ${new Date(timestamp).toLocaleString('es-ES')}`;
  const permissions = [session?.allowResultEditing, session?.allowEvidenceUpload, session?.allowCommentEditing];
  const allowed = permissions.filter(value => value !== false).length;
  const editing = session?.status === 'completed' || session?.completionLocked
    ? 'Bloqueada por finalización'
    : access === 'Vencido' ? 'No disponible por caducidad'
    : !validExpiry ? 'No disponible'
    : allowed === 0 ? 'No permitida por configuración'
    : allowed < 3 ? 'Permitida con permisos limitados' : 'Permitida';
  return { execution, access, editing };
}

type SessionTiming = { status: PublicUatSessionSummary['status']; expiresAt?: string | null };
export function isPublicUatSessionExpired(session?: SessionTiming | null) {
  return Boolean(session?.expiresAt && Date.parse(session.expiresAt) <= Date.now());
}

/** Completion and revocation are lifecycle states, not erased by elapsed time. */
export function canReopenPublicUatSession(session?: PublicUatSessionSummary | null) {
  return Boolean(session && session.status !== 'revoked' && !session.revokedAt && session.status !== 'draft' &&
    (session.status === 'completed' || session.status === 'expired' || session.completionLocked || isPublicUatSessionExpired(session)));
}

export function effectivePublicUatSessionStatus(session: SessionTiming) {
  return session.status === 'active' && isPublicUatSessionExpired(session) ? 'expired' : session.status;
}
