import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MeetingNote } from '../types/model';
import { getMeetingNotes, removeMeetingNote, saveMeetingNote } from '../services/meetingNotesService';

export function useMeetingNotes(projectId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['meeting-notes', projectId],
    queryFn: () => Promise.resolve(getMeetingNotes(projectId)),
    enabled: Boolean(projectId),
  });

  const saveMutation = useMutation({
    mutationFn: (note: MeetingNote) => Promise.resolve(saveMeetingNote(note)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting-notes', projectId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => Promise.resolve(removeMeetingNote(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting-notes', projectId] }),
  });

  return {
    ...query,
    save: saveMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
  };
}
