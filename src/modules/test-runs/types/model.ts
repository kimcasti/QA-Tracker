import type { TestRun, TestRunResult } from '../../../types';

export interface ActivatePublicUatSessionInput {
  participantNameSnapshot?: string;
  participantEmailSnapshot?: string;
  deliveryNotes?: string;
  expiresAt?: string;
}

export interface PublicUatSessionDetail {
  session: {
    documentId: string;
    status: 'draft' | 'active' | 'completed' | 'expired' | 'revoked';
    expiresAt?: string | null;
    activatedAt?: string | null;
    completedAt?: string | null;
    readOnly: boolean;
    allowResultEditing: boolean;
    allowEvidenceUpload: boolean;
    allowCommentEditing: boolean;
    participantName: string;
    participantEmail?: string | null;
    deliveryNotes?: string;
  };
  testRun: TestRun | null;
}

export interface PublicUatResultUpdateInput {
  result?: TestRunResult['result'];
  notes?: string | null;
  evidenceImage?: string | null;
}

export interface PublicUatSessionStatusResponse {
  documentId: string;
  status: 'draft' | 'active' | 'completed' | 'expired' | 'revoked';
  expiresAt?: string | null;
  activatedAt?: string | null;
  completedAt?: string | null;
  revokedAt?: string | null;
  lastAccessedAt?: string | null;
  allowResultEditing?: boolean;
  allowEvidenceUpload?: boolean;
  allowCommentEditing?: boolean;
  completionLocked?: boolean;
  publicUrl?: string | null;
  participant?: {
    documentId?: string | null;
    name: string;
    email?: string | null;
    role?: string;
  } | null;
  testRun?: {
    documentId: string;
    title: string;
    executionDate?: string | null;
    status?: string;
    testType?: string;
  } | null;
}
