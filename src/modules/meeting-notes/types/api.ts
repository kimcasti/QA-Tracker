export interface MeetingNoteDto {
  documentId: string;
  title: string;
  date: string;
  time: string;
  participants: string;
  notes: string;
  aiSummary?: string | null;
  aiDecisions?: string | null;
  aiActions?: string | null;
  aiNextSteps?: string | null;
  project?: {
    documentId: string;
    key: string;
  };
}
