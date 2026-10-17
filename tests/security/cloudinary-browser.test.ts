import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../../src/services/cloudinaryService.ts', import.meta.url), 'utf8');
function loadService(vite: Record<string, string> = {}, legacyProcess?: unknown) {
  const module = { exports: {} as Record<string, any> };
  const sandbox: Record<string, unknown> = { module, exports: module.exports, __VITE_ENV__: vite };
  if (legacyProcess !== undefined) sandbox.process = legacyProcess;
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs', define: { 'import.meta.env': '__VITE_ENV__' } });
  runInNewContext(code, sandbox);
  return module.exports;
}

test('browser without Cloudinary or Node process reports unconfigured instead of crashing', async () => {
  const service = loadService();
  assert.equal(service.getCloudinaryCloudName(), '');
  assert.equal(service.getCloudinaryUploadPreset(), '');
  assert.equal(service.hasCloudinaryConfigured(), false);
  await assert.rejects(service.uploadImageToCloudinary({}), /CLOUDINARY_NOT_CONFIGURED/);
});

test('configured Vite values remain available without a Node process global', () => {
  const service = loadService({ VITE_CLOUDINARY_CLOUD_NAME: 'local-test-cloud', VITE_CLOUDINARY_UPLOAD_PRESET: 'local-test-preset' });
  assert.equal(service.getCloudinaryCloudName(), 'local-test-cloud');
  assert.equal(service.getCloudinaryUploadPreset(), 'local-test-preset');
  assert.equal(service.hasCloudinaryConfigured(), true);
});

test('partial browser configuration stays unconfigured without throwing', () => {
  assert.equal(loadService({ VITE_CLOUDINARY_CLOUD_NAME: 'local-test-cloud' }).hasCloudinaryConfigured(), false);
  assert.equal(loadService({}, {}).hasCloudinaryConfigured(), false);
});

test('legacy Node environment fallback remains supported', () => {
  const service = loadService({}, { env: { CLOUDINARY_CLOUD_NAME: 'legacy-cloud', CLOUDINARY_UPLOAD_PRESET: 'legacy-preset' } });
  assert.equal(service.getCloudinaryCloudName(), 'legacy-cloud');
  assert.equal(service.getCloudinaryUploadPreset(), 'legacy-preset');
  assert.equal(service.hasCloudinaryConfigured(), true);
});
