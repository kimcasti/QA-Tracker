import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Bundle the real Vite-dependent service with an empty environment. No dotenv,
// server, browser or network: only the unavoidable HTTP boundary uses an adapter.
const scratch = process.env.QA_SECURITY_SCRATCH || tmpdir();
const directory = mkdtempSync(join(scratch, 'client-invitation-tests-'));
const filename = join(directory, 'auth.cjs');
const bundle = buildSync({
  stdin: { contents: `export * from './src/modules/auth/services/authService'; export { PublicHttp } from './src/config/http';`,
    resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'import.meta.env': '{}' }, logLevel: 'silent',
});
writeFileSync(filename, bundle.outputFiles[0].text);
const service = createRequire(import.meta.url)(filename);
test.after(() => rmSync(directory, { recursive: true, force: true }));
const token = 'ab'.repeat(32);
test('an invitation link remains actionable when the browser already has an authenticated session', () => {
  const source = readFileSync('src/App.tsx', 'utf8');
  assert.match(source, /if \(!isAuthenticated \|\| !user \|\| \(publicView === 'auth' && \(hasInvitationFlow \|\| hasPasswordRecoveryFlow\)\)\)/);
  assert.match(source, /location.pathname === '\/reset-password'/);
  assert.match(source, /get\('mode'\) === 'forgot-password'/);
});

test('team UI cannot reconstruct a bearer invitation link from an API listing', () => {
  const source = readFileSync('src/modules/organization-team/components/OrganizationTeamModal.tsx', 'utf8');
  assert.equal(source.includes('buildInvitationUrl'), false);
  assert.equal(source.includes('handleCopyInvitationLink'), false);
  assert.equal(source.includes('copia el enlace publico'), false);
});
test('same-tab recovery navigation preserves invitation ID and fragment proof without storage', () => {
  const forgot = service.authNavigationTarget('forgot-password', 'inv-1', token);
  const login = service.authNavigationTarget('login', 'inv-1', token);
  for (const [target, mode] of [[forgot, 'forgot-password'], [login, 'login']]) {
    const url = new URL(target, 'https://test.invalid');
    assert.equal(url.pathname, '/auth');
    assert.equal(url.searchParams.get('mode'), mode);
    assert.equal(url.searchParams.get('invitation'), 'inv-1');
    assert.equal(url.search.includes(token), false);
    assert.equal(service.readInvitationToken(url.hash), token);
    assert.deepEqual(service.invitationProofForSubmit(url.searchParams.get('invitation'), service.readInvitationToken(url.hash), true), {
      invitationDocumentId: 'inv-1', invitationToken: token,
    });
  }
  assert.equal(service.authNavigationTarget('login', '', ''), '/auth?mode=login');
  const page = readFileSync('src/modules/auth/components/AuthPage.tsx', 'utf8');
  assert.equal(page.includes("navigate('/auth?mode=forgot-password'"), false);
  assert.equal(page.includes("navigate('/auth?mode=login'"), false);
  assert.match(page, /setMode\(isResetPasswordRoute \? 'reset-password' : searchMode \|\| 'signup'\)/);
});

test('recovery UX says to reopen the invitation rather than promising cross-tab continuity', () => {
  const source = readFileSync('src/modules/auth/components/AuthPage.tsx', 'utf8');
  assert.match(source, /vuelve a abrir el enlace original de invitación/i);
});

const user = { id: 55, username: 'qa', email: 'qa@example.com' };
function adapter() {
  const requests: any[] = [];
  service.PublicHttp.defaults.adapter = async (config: any) => {
    requests.push({ url: config.url, data: config.data ? JSON.parse(config.data) : undefined, headers: config.headers });
    return { data: config.url === '/api/me/workspace' ? { user } : { jwt: 'test-jwt', user },
      status: 200, statusText: 'OK', config, headers: {} };
  };
  return requests;
}

test('public metadata sends proof only in a header and incomplete invitation forms fail closed', async () => {
  const requests = adapter();
  await service.fetchPublicInvitation('inv-1', token);
  assert.equal(requests[0].url, '/api/organization-team/invitations/inv-1/public');
  assert.equal(requests[0].headers.get('X-Invitation-Token'), token);
  assert.equal(service.readInvitationToken(`#invitationToken=${token}`), token);
  assert.deepEqual(service.invitationProofForSubmit('', '', false), {});
  assert.deepEqual(service.invitationProofForSubmit('inv-1', token, true), {
    invitationDocumentId: 'inv-1', invitationToken: token,
  });
  for (const args of [['inv-1', '', false], ['inv-1', token, false], ['inv-1', 'bad', true]]) {
    assert.throws(() => service.invitationProofForSubmit(...args), /invitación/i);
  }
  await assert.rejects(() => service.fetchPublicInvitation('inv-1', ''), /invitación/i);
  assert.equal(requests.length, 1);
});

test('invited existing-account login exchanges credentials and proof before loading the workspace', async () => {
  const requests = adapter();
  await service.login({ identifier: ' QA@example.com ', password: 'secret123',
    invitationDocumentId: 'inv-1', invitationToken: token });
  assert.equal(requests[0].url, '/api/auth/invitations/accept');
  assert.equal(requests[0].data.email, 'qa@example.com');
  assert.equal(requests[0].data.invitationToken, token);
  assert.equal(requests[1].url, '/api/me/workspace');
});

test('normal login and signup do not invent invitation proof', async () => {
  const requests = adapter();
  await service.login({ identifier: 'qa', password: 'secret123' });
  assert.equal(requests[0].url, '/api/auth/local');
  await service.signup({ username: 'qa', email: 'qa@example.com', password: 'secret123',
    passwordConfirmation: 'secret123', contactNumber: '123', organizationName: 'My Org' });
  assert.equal(requests[2].data.invitationToken, undefined);
  assert.equal(requests[2].data.organizationName, 'My Org');
});

test('signup forwards invitation proof unchanged rather than claiming by email', async () => {
  const requests = adapter();
  await service.signup({ username: 'qa', email: 'qa@example.com', password: 'secret123',
    passwordConfirmation: 'secret123', contactNumber: '123', organizationName: '',
    invitationDocumentId: 'inv-1', invitationToken: token });
  assert.equal(requests[0].data.invitationDocumentId, 'inv-1');
  assert.equal(requests[0].data.invitationToken, token);
});
