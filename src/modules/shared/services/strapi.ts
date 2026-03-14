import { Http } from '../../../config/http';

export type ApiDocument = Record<string, any>;

export interface StrapiListResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiEntityResponse<T> {
  data: T;
}

export function relation(documentId?: string | null) {
  return documentId || undefined;
}

export async function listDocuments<T extends ApiDocument>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const response = await Http.get<StrapiListResponse<T>>(endpoint, {
    params: {
      ...params,
      'pagination[pageSize]': params?.['pagination[pageSize]'] ?? 200,
    },
  });

  return response.data.data || [];
}

export async function getDocument<T extends ApiDocument>(
  endpoint: string,
  documentId: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const response = await Http.get<StrapiEntityResponse<T>>(`${endpoint}/${documentId}`, {
    params,
  });

  return response.data.data;
}

export async function createDocument<T extends ApiDocument>(
  endpoint: string,
  data: Record<string, unknown>,
) {
  const response = await Http.post<StrapiEntityResponse<T>>(endpoint, { data });
  return response.data.data;
}

export async function updateDocument<T extends ApiDocument>(
  endpoint: string,
  documentId: string,
  data: Record<string, unknown>,
) {
  const response = await Http.put<StrapiEntityResponse<T>>(`${endpoint}/${documentId}`, { data });
  return response.data.data;
}

export async function upsertDocument<T extends ApiDocument>(
  endpoint: string,
  documentId: string | null | undefined,
  data: Record<string, unknown>,
) {
  return documentId ? updateDocument<T>(endpoint, documentId, data) : createDocument<T>(endpoint, data);
}

export async function deleteDocument(endpoint: string, documentId: string) {
  await Http.delete(`${endpoint}/${documentId}`);
}
