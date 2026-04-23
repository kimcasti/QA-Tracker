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

export interface ListDocumentsOptions {
  paginateAll?: boolean;
}

const STRAPI_MAX_PAGE_SIZE = 100;

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
  options?: ListDocumentsOptions,
) {
  const paginateAll = options?.paginateAll ?? true;
  // Keep requests aligned with the backend maxLimit to avoid losing records when Strapi clamps page sizes.
  const requestedPageSize = Number(params?.['pagination[pageSize]'] ?? STRAPI_MAX_PAGE_SIZE);
  const pageSize =
    Number.isFinite(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, STRAPI_MAX_PAGE_SIZE)
      : STRAPI_MAX_PAGE_SIZE;
  const baseParams = {
    ...params,
    'pagination[pageSize]': pageSize,
    'pagination[withCount]': true,
  };
  const documents: T[] = [];
  let currentPage = 1;
  let declaredPageCount: number | null = null;
  let totalDocuments: number | null = null;
  let effectivePageSize = pageSize;

  while (true) {
    const response = await Http.get<StrapiListResponse<T>>(endpoint, {
      params: {
        ...baseParams,
        'pagination[page]': currentPage,
      },
    });

    const pageData = response.data.data || [];
    const pagination = response.data.meta?.pagination;
    const responsePageCount = Number(pagination?.pageCount);
    const responsePageSize = Number(pagination?.pageSize);
    const responseTotal = Number(pagination?.total);

    if (Number.isFinite(responsePageCount) && responsePageCount > 0) {
      declaredPageCount = responsePageCount;
    }

    if (Number.isFinite(responsePageSize) && responsePageSize > 0) {
      effectivePageSize = responsePageSize;
    }

    if (Number.isFinite(responseTotal) && responseTotal >= 0) {
      totalDocuments = responseTotal;
    }

    documents.push(...pageData);

    if (!paginateAll) {
      break;
    }

    const reachedTotal = totalDocuments !== null && documents.length >= totalDocuments;
    const reachedDeclaredLastPage =
      declaredPageCount !== null && currentPage >= declaredPageCount;
    const receivedEmptyPage = pageData.length === 0;
    const receivedPartialPage = pageData.length < effectivePageSize;

    if (
      reachedTotal ||
      receivedEmptyPage ||
      (receivedPartialPage && reachedDeclaredLastPage) ||
      (receivedPartialPage && totalDocuments === null)
    ) {
      break;
    }

    if (reachedDeclaredLastPage && totalDocuments === null) {
      break;
    }

    currentPage += 1;
  }

  return documents;
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
