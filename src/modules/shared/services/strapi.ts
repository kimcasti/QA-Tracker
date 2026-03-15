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
  if (!documentId) {
    return undefined;
  }

  return { documentId };
}

export function populateParams(paths: string[]) {
  return paths.reduce<Record<string, string>>((params, path, index) => {
    params[`populate[${index}]`] = path;
    return params;
  }, {});
}

export async function listDocuments<T extends ApiDocument>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const pageSize = Number(params?.['pagination[pageSize]'] ?? 200);
  const baseParams = {
    ...params,
    'pagination[pageSize]': pageSize,
  };

  const firstResponse = await Http.get<StrapiListResponse<T>>(endpoint, {
    params: {
      ...baseParams,
      'pagination[page]': 1,
    },
  });

  const firstPageData = firstResponse.data.data || [];
  const pageCount = firstResponse.data.meta?.pagination?.pageCount ?? 1;

  if (pageCount <= 1) {
    return firstPageData;
  }

  const remainingResponses = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      Http.get<StrapiListResponse<T>>(endpoint, {
        params: {
          ...baseParams,
          'pagination[page]': index + 2,
        },
      }),
    ),
  );

  return [
    ...firstPageData,
    ...remainingResponses.flatMap(response => response.data.data || []),
  ];
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
