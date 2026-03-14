import { QueryClient } from '@tanstack/react-query';
import { HttpStatusCode } from 'axios';

function shouldRetry(failureCount: number, error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;

  if (status === HttpStatusCode.Unauthorized || status === HttpStatusCode.Forbidden) {
    return false;
  }

  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
