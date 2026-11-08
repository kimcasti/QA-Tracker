import type { TestCase } from '../../types';

export type CanvasColor = 'default' | 'blue' | 'green' | 'yellow' | 'orange' | 'violet' | 'pink';
export interface CanvasNodeVisual { x: number; y: number; color?: CanvasColor; expanded?: boolean }
export interface CanvasNote { id: string; html: string; anchorId?: string }
export interface CanvasState {
  version: 1;
  nodes: Record<string, CanvasNodeVisual>;
  notes: CanvasNote[];
  newElementColor: CanvasColor;
}
export interface CanvasSnapshot { projectDocumentId: string; revision: number; state: CanvasState }
export interface CanvasModule { documentId: string; name: string; description?: string }
export interface CanvasSprint { documentId: string; name: string }
export interface CanvasFunctionality {
  documentId: string;
  code: string;
  name: string;
  moduleDocumentId?: string | null;
  sprintDocumentId?: string | null;
  deliveryDate?: string | null;
  status?: 'completed' | 'failed' | 'in_progress' | 'backlog' | 'mvp' | 'post_mvp' | null;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  impactLevel?: 'high' | 'medium' | 'low' | null;
  probabilityLevel?: 'high' | 'medium' | 'low' | null;
}
export type CanvasFunctionalityInput = Pick<CanvasFunctionality, 'name'> & Partial<
  Pick<CanvasFunctionality, 'documentId' | 'moduleDocumentId' | 'sprintDocumentId' | 'deliveryDate' |
    'status' | 'priority' | 'impactLevel' | 'probabilityLevel'>>;
export interface CanvasTestCase {
  documentId: string;
  title: string;
  functionalityDocumentId: string;
  functionalityCode: string;
  testCase: TestCase;
}
export interface CanvasCatalog {
  modules: CanvasModule[];
  functionalities: CanvasFunctionality[];
  cases: CanvasTestCase[];
  sprints: CanvasSprint[];
}
export interface CanvasData {
  context: { documentId: string; organizationDocumentId: string };
  snapshot: CanvasSnapshot;
  catalog: CanvasCatalog;
}
