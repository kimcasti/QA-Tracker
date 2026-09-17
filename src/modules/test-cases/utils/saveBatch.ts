import { isAxiosError } from 'axios';
import type { TestCase } from '../../../types';

export type BatchResult = {
  confirmed: Array<{ localId: string; testCase: TestCase }>;
  failed?: { localId: string; message: string; ambiguous: boolean };
  pending: TestCase[];
};

export async function saveBatch(
  cases: TestCase[],
  save: (testCase: TestCase) => Promise<TestCase>,
  onProgress?: (count: number) => void,
): Promise<BatchResult> {
  const confirmed: BatchResult['confirmed'] = [];
  for (const [index, testCase] of cases.entries()) {
    let saved: TestCase;
    try {
      saved = await save(testCase);
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      return {
        confirmed,
        pending: cases.slice(index),
        failed: {
          localId: testCase.id,
          message: isAxiosError(error)
            ? error.response?.data?.error?.message || error.message
            : error instanceof Error
              ? error.message
              : 'No se pudo guardar el caso.',
          ambiguous: !status || status >= 500 || status === 408,
        },
      };
    }
    confirmed.push({ localId: testCase.id, testCase: saved });
    onProgress?.(confirmed.length);
  }
  return { confirmed, pending: [] };
}
