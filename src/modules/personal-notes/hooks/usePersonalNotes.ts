import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PersonalNote } from '../types/model';
import { getPersonalNotes, savePersonalNote } from '../services/personalNotesService';

const PERSONAL_NOTES_QUERY_KEY = ['personal-notes'];

export function usePersonalNotes(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PERSONAL_NOTES_QUERY_KEY,
    queryFn: getPersonalNotes,
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: (note: PersonalNote) => savePersonalNote(note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERSONAL_NOTES_QUERY_KEY }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
