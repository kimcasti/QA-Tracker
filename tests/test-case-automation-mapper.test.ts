import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AxiosAdapter } from 'axios';

// Exercise the real service, Strapi pagination and mapper; mock only HTTP.
// Empty/synthetic Vite configuration never loads dotenv or service credentials.
const socketGuard = mock.method(Socket.prototype, 'connect', () => {
  throw new Error('AUTOMATION_MAPPER_NETWORK_BLOCKED');
});
const scratch = process.env.QA_SECURITY_SCRATCH;
assert.ok(scratch, 'QA_SECURITY_SCRATCH must point outside the repository');
const directory = mkdtempSync(join(scratch, 'automation-mapper-'));
const filename = join(directory, 'service.cjs');
const bundle = buildSync({
  stdin: {
    contents: `export { getTestCases } from './src/modules/test-cases/services/testCasesService';
      export { Http } from './src/config/http'; export { AutomationStatus } from './src/types';`,
    resolveDir: process.cwd(), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://automation-mapper.invalid' }) },
  logLevel: 'silent',
});
writeFileSync(filename, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(filename) as {
  getTestCases: typeof import('../src/modules/test-cases/services/testCasesService').getTestCases;
  Http: typeof import('../src/config/http').Http;
  AutomationStatus: typeof import('../src/types').AutomationStatus;
};
const originalAdapter = service.Http.defaults.adapter;
test.after(() => {
  service.Http.defaults.adapter = originalAdapter;
  socketGuard.mock.restore();
  rmSync(directory, { recursive: true, force: true });
});

async function mappedAutomation(fields: Record<string, unknown>) {
  let requests = 0;
  const adapter: AxiosAdapter = async config => {
    requests += 1;
    assert.equal(config.method, 'get');
    assert.equal(config.url, '/api/test-cases');
    assert.equal(config.params['pagination[page]'], 1);
    return {
      config, status: 200, statusText: 'OK', headers: {},
      data: {
        data: [{ documentId: 'synthetic-case', title: 'Synthetic legacy case', ...fields }],
        meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 1 } },
      },
    };
  };
  service.Http.defaults.adapter = adapter;
  const cases = await service.getTestCases();
  assert.equal(requests, 1);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].id, 'synthetic-case');
  return { automationStatus: cases[0].automationStatus, isAutomated: cases[0].isAutomated };
}

test('getTestCases preserves legacy automated coverage when automationStatus is absent', async () => {
  assert.deepEqual(await mappedAutomation({ isAutomated: true }), {
    automationStatus: service.AutomationStatus.AUTOMATED, isAutomated: true,
  });
});

test('getTestCases preserves legacy automated coverage when automationStatus is null', async () => {
  assert.deepEqual(await mappedAutomation({ automationStatus: null, isAutomated: true }), {
    automationStatus: service.AutomationStatus.AUTOMATED, isAutomated: true,
  });
});

for (const status of [undefined, null]) {
  for (const legacy of [false, undefined]) {
    test(`getTestCases keeps missing status ${status} manual with legacy ${legacy}`, async () => {
      assert.deepEqual(await mappedAutomation({ automationStatus: status, isAutomated: legacy }), {
        automationStatus: service.AutomationStatus.NOT_AUTOMATED, isAutomated: false,
      });
    });
  }
}

for (const [status, expected] of [
  ['candidate', service.AutomationStatus.CANDIDATE],
  ['obsolete', service.AutomationStatus.OBSOLETE],
  ['not_automated', service.AutomationStatus.NOT_AUTOMATED],
] as const) {
  test(`getTestCases explicit ${status} takes precedence over legacy true`, async () => {
    assert.deepEqual(await mappedAutomation({ automationStatus: status, isAutomated: true }), {
      automationStatus: expected, isAutomated: false,
    });
  });
}

test('getTestCases explicit automated takes precedence over legacy false', async () => {
  assert.deepEqual(await mappedAutomation({ automationStatus: 'automated', isAutomated: false }), {
    automationStatus: service.AutomationStatus.AUTOMATED, isAutomated: true,
  });
});

for (const status of ['unknown', '', 'AUTOMATED', ' automated ', false, 0, 1, {}, [], ['automated']]) {
  test(`getTestCases does not promote malformed status ${JSON.stringify(status)} via legacy true`, async () => {
    assert.deepEqual(await mappedAutomation({ automationStatus: status, isAutomated: true }), {
      automationStatus: service.AutomationStatus.NOT_AUTOMATED, isAutomated: false,
    });
  });
}

test('mapper harness blocks real socket connections', () => {
  const socket = new Socket();
  try {
    assert.throws(() => socket.connect(9, '127.0.0.1'), /AUTOMATION_MAPPER_NETWORK_BLOCKED/);
  } finally {
    socket.destroy();
  }
});
