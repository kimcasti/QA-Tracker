import { Http } from '../config/http';

export type WireframeVersion = {
  id: string;
  status: 'generating' | 'completed' | 'partial' | 'error' | 'uncertain';
  createdAt: string;
  stitchUrl?: string;
  message?: string;
  flowSummary?: string;
  screens: Array<{ id: string; title: string; imageDataUrl?: string }>;
};
export type WireframeGallery = { configured: boolean; versions: WireframeVersion[] };

export function safeStitchUrl(value?: string) {
  return typeof value === 'string' && /^https:\/\/stitch\.(?:withgoogle|google)\.com\/projects\/[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined;
}
export function safeWireframeImage(value?: string) {
  return typeof value === 'string' && value.length <= 4_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;
}
function parseVersion(value: unknown): WireframeVersion {
  const invalid = () => new Error('Respuesta de wireframes inválida.');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !row.id ||
      !['generating', 'completed', 'partial', 'error', 'uncertain'].includes(row.status as string) ||
      typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt)) ||
      !Array.isArray(row.screens) || row.screens.length > 12 ||
      (row.flowSummary !== undefined && typeof row.flowSummary !== 'string')) throw invalid();
  const seen = new Set<string>();
  const screens = row.screens.map((screen: unknown) => {
    if (!screen || typeof screen !== 'object' || Array.isArray(screen)) throw invalid();
    const item = screen as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || seen.has(item.id) || typeof item.title !== 'string') throw invalid();
    seen.add(item.id);
    const imageDataUrl = safeWireframeImage(typeof item.imageDataUrl === 'string' ? item.imageDataUrl : undefined);
    return { id: item.id, title: item.title.slice(0, 300), ...(imageDataUrl ? { imageDataUrl } : {}) };
  });
  const stitchUrl = safeStitchUrl(typeof row.stitchUrl === 'string' ? row.stitchUrl : undefined);
  return { id: row.id, status: row.status as WireframeVersion['status'], createdAt: row.createdAt, screens,
    ...(typeof row.flowSummary === 'string' ? { flowSummary: row.flowSummary.slice(0, 4000) } : {}),
    ...(stitchUrl ? { stitchUrl } : {}), ...(typeof row.message === 'string' ? { message: row.message.slice(0, 1000) } : {}) };
}
export async function loadWireframes(projectId: string): Promise<WireframeGallery> {
  const response = await Http.get('/api/ai/project/wireframes', { params: { projectId } });
  const data = response.data?.data;
  if (typeof data?.configured !== 'boolean' || !Array.isArray(data.versions)) throw new Error('Respuesta de wireframes inválida.');
  return { configured: data.configured, versions: data.versions.map(parseVersion) };
}
export async function generateWireframe(projectId: string, requestId: string): Promise<WireframeVersion> {
  const response = await Http.post('/api/ai/project/wireframes', { data: { projectId, requestId, confirmedExternalSend: true } });
  return parseVersion(response.data?.data);
}
