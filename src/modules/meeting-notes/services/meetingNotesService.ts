import {
  deleteDocument,
  listDocuments,
  relation,
  upsertDocument,
} from '../../shared/services/strapi';
import { findProjectContext } from '../../workspace/services/workspaceService';
import type { MeetingNote } from '../types/model';
import type { MeetingNoteDto } from '../types/api';

function normalizeMeetingNoteTime(value?: string | null) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  const secondsMatch = trimmed.match(/^(\d{2}:\d{2}:\d{2})/);
  if (secondsMatch) {
    return secondsMatch[1];
  }

  return trimmed;
}

function mapMeetingNote(document: MeetingNoteDto): MeetingNote {
  return {
    id: document.documentId,
    projectId: document.project?.key || '',
    title: document.title || '',
    date: document.date,
    time: normalizeMeetingNoteTime(document.time).slice(0, 5),
    participants: document.participants || '',
    notes: document.notes || '',
    aiSummary: document.aiSummary || undefined,
    aiDecisions: document.aiDecisions || undefined,
    aiActions: document.aiActions || undefined,
    aiNextSteps: document.aiNextSteps || undefined,
  };
}

export async function getMeetingNotes(projectId?: string) {
  const context = projectId ? await findProjectContext(projectId) : null;
  const documents = await listDocuments<MeetingNoteDto>('/api/meeting-notes', {
    populate: 'project',
    sort: 'date:desc',
    ...(context ? { 'filters[project][documentId][$eq]': context.documentId } : {}),
  });

  return documents.map(mapMeetingNote);
}

export async function saveMeetingNote(note: MeetingNote) {
  const context = await findProjectContext(note.projectId);
  if (!context) {
    throw new Error(`Project ${note.projectId} is not available in the workspace.`);
  }

  const documentId = note.id.startsWith('note-') ? null : note.id;
  const saved = await upsertDocument<MeetingNoteDto>('/api/meeting-notes', documentId, {
    title: note.title,
    date: note.date,
    time: normalizeMeetingNoteTime(note.time),
    participants: note.participants,
    notes: note.notes,
    aiSummary: note.aiSummary || null,
    aiDecisions: note.aiDecisions || null,
    aiActions: note.aiActions || null,
    aiNextSteps: note.aiNextSteps || null,
    organization: relation(context.organizationDocumentId),
    project: relation(context.documentId),
  });

  return mapMeetingNote(saved);
}

export async function removeMeetingNote(id: string) {
  await deleteDocument('/api/meeting-notes', id);
}
