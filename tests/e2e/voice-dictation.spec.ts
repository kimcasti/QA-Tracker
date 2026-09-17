import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error('Voice harness:', error.message));
  await page.addInitScript(() => {
    const browser = window as any;
    browser.SpeechRecognition = undefined;
    browser.webkitSpeechRecognition = undefined;
    if (location.search.includes('unsupported')) return;
    browser.recognitions = [];
    class MockRecognition {
      onresult: any;
      onerror: any;
      onend: any;
      onstart: any;
      resultCallback: any;
      aborted = false;
      stopped = false;
      start() {
        this.resultCallback = this.onresult;
        browser.recognitions.push(this);
        this.onstart?.();
      }
      stop() { this.stopped = true; }
      abort() { this.aborted = true; }
      emit(results: { text: string; final: boolean }[]) {
        this.resultCallback({ resultIndex: 0, results: results.map(result => ({
          isFinal: result.final, 0: { transcript: result.text },
        })) });
      }
    }
    browser.webkitSpeechRecognition = MockRecognition;
  });
  await page.route('**/__voice-dictation*', route => route.fulfill({
    contentType: 'text/html',
    body: `<html><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = domModule.default || domModule;
      const antdModule = await import('/node_modules/.vite/deps/antd.js');
      const { Form } = antdModule.default || antdModule;
      const { default: Evidence } = await import('/src/components/EvidenceRichEditor.tsx');
      const { default: Basic } = await import('/src/components/BasicRichTextEditor.tsx');
      const { default: TextArea } = await import('/src/components/VoiceTextArea.tsx');
      await import('/src/index.css');
      const h = React.createElement;
      function Harness() {
        const [disabled, setDisabled] = React.useState(false);
        const [hidden, setHidden] = React.useState(false);
        const [mounted, setMounted] = React.useState(true);
        const [record, setRecord] = React.useState('one');
        const [value, setValue] = React.useState('<p>Inicio final</p><ul><li><p>Lista</p></li></ul><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=">');
        const [basic, setBasic] = React.useState('<p>Nota</p>');
        const [plain, setPlain] = React.useState('ABC DEF');
        window.controls = { setDisabled, setHidden, setMounted, setRecord, setPlain, setValue };
        return h('div', { style: { maxWidth: 640 } },
          mounted && h('div', { style: { display: hidden ? 'none' : undefined } },
            h('section', { 'data-testid': 'evidence' }, h(Evidence, { value, onChange: setValue, disabled, voiceSessionKey: record })),
            h('section', { 'data-testid': 'basic' }, h(Basic, { value: basic, onChange: setBasic, disabled, voiceSessionKey: record })),
            h('section', { 'data-testid': 'plain' }, h(TextArea, { value: plain, onChange: e => setPlain(e.target.value), disabled, voiceSessionKey: record })),
            h('section', { 'data-testid': 'uncontrolled' }, h(TextArea, { defaultValue: 'Libre' })),
            h(Form, { initialValues: { note: 'Base' }, disabled, onValuesChange: (_, values) => { window.formValues = values; } },
              h('section', { 'data-testid': 'form' }, h(Form.Item, { name: 'note' }, h(TextArea, { maxLength: 12, showCount: true })))),
            h('section', { 'data-testid': 'readonly' }, h(TextArea, { value: 'Solo lectura', readOnly: true }))),
          h('output', { 'data-testid': 'html' }, value),
          h('output', { 'data-testid': 'plain-value' }, plain));
      }
      createRoot(document.getElementById('root')).render(h(Harness));
    </script></body></html>`,
  }));
});

async function emit(page: import('@playwright/test').Page, results: { text: string; final: boolean }[], index = 0) {
  await page.evaluate(({ results, index }) => (window as any).recognitions[index].emit(results), { results, index });
}

test('dictates at selection end, preserves HTML and deduplicates final results', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('evidence');
  const editor = field.locator('.ProseMirror');
  await editor.click();
  await page.evaluate(() => {
    const text = document.querySelector('[data-testid=evidence] .ProseMirror p')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0); range.setEnd(text, 6);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'provisional', final: false }]);
  await expect(field.getByRole('status')).toContainText('provisional');
  await expect(editor).not.toContainText('provisional');
  await emit(page, [{ text: 'dictado <b>literal</b>', final: true }]);
  await emit(page, [{ text: 'dictado <b>literal</b>', final: true }]);
  await expect(editor.locator('p').first()).toHaveText('Inicio dictado <b>literal</b> final');
  await expect(editor.locator('img')).toHaveCount(1);
  await expect(editor.locator('ul li')).toHaveCount(1);
  await expect(page.getByTestId('html')).toContainText('&lt;b&gt;literal&lt;/b&gt;');
  await field.getByRole('button', { name: 'Detener dictado' }).click();
  await emit(page, [{ text: 'dictado <b>literal</b>', final: true }, { text: 'último', final: true }]);
  await page.evaluate(() => (window as any).recognitions[0].onend());
  await expect(editor).toContainText('último');
  await editor.press('Control+z');
  await expect(editor).not.toContainText('último');
});

test('controlled textarea inserts after selection and updates its value', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('plain');
  await field.locator('textarea').focus();
  await field.locator('textarea').evaluate(element => {
    (element as HTMLTextAreaElement).setSelectionRange(0, 3);
    element.dispatchEvent(new Event('select', { bubbles: true }));
  });
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'voz', final: true }]);
  await expect(field.locator('textarea')).toHaveValue('ABC voz DEF');
  await expect(page.getByTestId('plain-value')).toHaveText('ABC voz DEF');
});

test('Ant Design Form receives dictation and respects maxLength', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('form');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'texto demasiado largo', final: true }]);
  await expect(field.locator('textarea')).toHaveValue('Base texto d');
  await expect.poll(() => page.evaluate(() => (window as any).formValues?.note)).toBe('Base texto d');
  await expect(page.getByTestId('readonly').getByRole('button')).toHaveCount(0);
});

test('switching fields cancels previous speech and discards late results', async ({ page }) => {
  await page.goto('/__voice-dictation');
  await page.getByTestId('basic').getByRole('button', { name: 'Iniciar dictado' }).click();
  await page.getByTestId('plain').getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'resultado viejo', final: true }]);
  await emit(page, [{ text: 'nuevo', final: true }], 1);
  await expect(page.getByTestId('basic').locator('.ProseMirror')).toHaveText('Nota');
  await expect(page.getByTestId('plain').locator('textarea')).toHaveValue('ABC DEF nuevo');
  await expect.poll(() => page.evaluate(() => (window as any).recognitions[0].aborted)).toBe(true);
});

for (const action of ['setHidden', 'setDisabled', 'setMounted', 'setRecord', 'setValue']) {
  test(`cancels when ${action} changes and ignores late results`, async ({ page }) => {
    await page.goto('/__voice-dictation');
    await page.getByTestId('evidence').getByRole('button', { name: 'Iniciar dictado' }).click();
    await page.evaluate(action => {
      (window as any).controls[action](action === 'setMounted' ? false : action === 'setRecord'
        ? 'two' : action === 'setValue' ? '<p>Otro registro</p>' : true);
    }, action);
    await expect.poll(() => page.evaluate(() => (window as any).recognitions[0].aborted)).toBe(true);
    await emit(page, [{ text: 'tardío', final: true }]);
    await expect(page.getByTestId('html')).not.toContainText('tardío');
  });
}

test('permission error is actionable and can be retried', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('plain');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await page.evaluate(() => (window as any).recognitions[0].onerror({ error: 'not-allowed' }));
  await expect(field.getByRole('alert')).toContainText('Permiso denegado');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await expect(field.getByRole('alert')).toHaveCount(0);
  await emit(page, [{ text: 'sesión anterior', final: true }]);
  await emit(page, [{ text: 'reintento', final: true }], 1);
  await expect(field.locator('textarea')).toHaveValue('ABC DEF reintento');
});

test('appends speech after a final image when the editor has no saved cursor', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('evidence');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'Después de la imagen', final: true }]);
  await expect(field.locator('.ProseMirror > :last-child')).toHaveText('Después de la imagen');
  await emit(page, [{ text: 'Después de la imagen', final: true }, { text: 'continúa', final: true }]);
  await expect(field.locator('.ProseMirror > :last-child')).toHaveText('Después de la imagen continúa');
  await expect(field.locator('.ProseMirror img')).toHaveCount(1);
});

test('uncontrolled textarea keeps speech across chunks and inherited disabled Form prevents dictation', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('uncontrolled');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'uno', final: true }]);
  await emit(page, [{ text: 'uno', final: true }, { text: 'dos', final: true }]);
  await expect(field.locator('textarea')).toHaveValue('Libre uno dos');
  await page.getByTestId('form').getByRole('button', { name: 'Iniciar dictado' }).click();
  await page.evaluate(() => (window as any).controls.setDisabled(true));
  await expect(page.getByTestId('form').getByRole('button')).toHaveCount(0);
  await emit(page, [{ text: 'tardío', final: true }], 1);
  await expect(page.getByTestId('form').locator('textarea')).toHaveValue('Base');
});

test('external textarea changes cancel speech and reset insertion position', async ({ page }) => {
  await page.goto('/__voice-dictation');
  const field = page.getByTestId('plain');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await page.evaluate(() => (window as any).controls.setPlain('Otro texto'));
  await expect.poll(() => page.evaluate(() => (window as any).recognitions[0].aborted)).toBe(true);
  await emit(page, [{ text: 'tardío', final: true }]);
  await expect(field.locator('textarea')).toHaveValue('Otro texto');
  await field.getByRole('button', { name: 'Iniciar dictado' }).click();
  await emit(page, [{ text: 'nuevo', final: true }], 1);
  await expect(field.locator('textarea')).toHaveValue('Otro texto nuevo');
});

test('unsupported browsers keep manual editing available', async ({ page }) => {
  await page.goto('/__voice-dictation?unsupported');
  const field = page.getByTestId('plain');
  await expect(field.getByRole('button', { name: 'Iniciar dictado' })).toBeDisabled();
  await field.locator('textarea').fill('Escritura manual');
  await expect(page.getByTestId('plain-value')).toHaveText('Escritura manual');
});
