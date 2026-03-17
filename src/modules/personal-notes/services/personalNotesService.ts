import { listDocuments, upsertDocument } from '../../shared/services/strapi';
import type { PersonalNote } from '../types/model';
import type { PersonalNoteDto } from '../types/api';

function mapPersonalNote(document: PersonalNoteDto): PersonalNote {
  return {
    documentId: document.documentId,
    activityDate: document.activityDate,
    title: document.title || '',
    description: document.description || '',
    createdAt: document.createdAt || undefined,
    updatedAt: document.updatedAt || undefined,
  };
}

export async function getPersonalNotes() {
  const documents = await listDocuments<PersonalNoteDto>('/api/personal-notes', {
    sort: 'activityDate:desc',
  });

  return documents.map(mapPersonalNote);
}

export async function savePersonalNote(note: PersonalNote) {
  const saved = await upsertDocument<PersonalNoteDto>('/api/personal-notes', note.documentId || null, {
    activityDate: note.activityDate,
    title: note.title.trim(),
    description: note.description.trim(),
  });

  return mapPersonalNote(saved);
}
