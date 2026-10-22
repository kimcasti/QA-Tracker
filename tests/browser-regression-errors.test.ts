import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyBrowserErrors } from '../scripts/browser-regression-errors.mjs';
const url = 'http://127.0.0.1:12345/__qa_missing_image.png';
const network404 = 'Failed to load resource: the server responded with a status of 404 (Not Found)';

test('uncaught 404 exceptions are always fatal', () => {
  const error = 'Uncaught Error: New runtime failure: 404 (Not Found)';
  const result = classifyBrowserErrors({ pageErrors: [error], baselineWarnings: [error] });
  assert.deepEqual(result.pageErrors, [error]);
});
test('a runtime console error is not an expected network response', () => {
  const result = classifyBrowserErrors({ consoleErrors: [{ text: 'Uncaught Error: 404 (Not Found)', url }],
    expectedResourceResponses: [{ url, status: 404 }] });
  assert.equal(result.unexpectedConsole.length, 1);
});
for (const [label, source, responses] of [
  ['unregistered response', url, []],
  ['different URL', 'http://127.0.0.1:12345/unexpected.png', [{ url, status: 404 }]],
  ['missing URL', '', [{ url, status: 404 }]],
  ['different status', url, [{ url, status: 500 }]],
] as const) {
  test(`a resource error fails with ${label}`, () => {
    const result = classifyBrowserErrors({ consoleErrors: [{ text: network404, url: source }], expectedResourceResponses: [...responses] });
    assert.equal(result.unexpectedConsole.length, 1);
  });
}
test('only a corroborated fixture URL/status resource diagnostic is expected', () => {
  const result = classifyBrowserErrors({ consoleErrors: [{ text: network404, url }], expectedResourceResponses: [{ url, status: 404 }] });
  assert.deepEqual(result.unexpectedConsole, []);
  assert.equal(result.expectedResourceErrors.length, 1);
});
test('known baseline warnings do not hide new warnings or page exceptions', () => {
  const warning = 'Warning: Existing AntD diagnostic';
  const result = classifyBrowserErrors({ baselineWarnings: [warning], pageErrors: [warning],
    consoleErrors: [{ text: warning, url: '' }, { text: 'Warning: New diagnostic', url: '' }] });
  assert.deepEqual(result.knownWarnings, [warning]);
  assert.equal(result.unexpectedConsole.length, 1);
  assert.deepEqual(result.pageErrors, [warning]);
});
