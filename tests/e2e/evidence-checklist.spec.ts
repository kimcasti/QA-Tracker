import { expect, test } from '@playwright/test';

// Mount the real editor through Vite without creating execution records or requiring login.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error('Checklist harness:', error.message));
  await page.route('**/__evidence-checklist', route => route.fulfill({
    contentType: 'text/html',
    body: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body><div id="root" style="max-width:442px;margin:16px auto"></div>
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const reactModule = await import('/node_modules/.vite/deps/react.js');
        const React = reactModule.default || reactModule;
        const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { createRoot } = domModule.default || domModule;
        const { default: EvidenceRichEditor } = await import('/src/components/EvidenceRichEditor.tsx');
        const { normalizeEvidenceHtml } = await import('/src/utils/evidenceRichText.ts');
        await import('/src/index.css');
        function Harness() {
          const [value, setValue] = React.useState(normalizeEvidenceHtml(localStorage.getItem('checklist-test')));
          const [disabled, setDisabled] = React.useState(false);
          return React.createElement(React.Fragment, null,
            React.createElement('button', { onClick: () => setDisabled(!disabled) }, 'Solo lectura'),
            React.createElement(EvidenceRichEditor, { value, disabled, onChange: html => {
              localStorage.setItem('checklist-test', html);
              setValue(html);
            } }));
        }
        createRoot(document.getElementById('root')).render(React.createElement(Harness));
      </script></body></html>`,
  }));
});

for (const width of [390, 900]) {
  test(`checklist saves checked state and supports Enter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/__evidence-checklist');
    const editor = page.locator('.ProseMirror');
    await page.getByRole('button', { name: 'Checklist', exact: true }).click();
    const firstTask = editor.locator('ul[data-type="taskList"] > li').first();
    const taskText = firstTask.locator(':scope > div > p').first();
    const checkboxBox = await firstTask.getByRole('checkbox').boundingBox();
    const textBox = await taskText.boundingBox();
    expect(checkboxBox).not.toBeNull();
    expect(textBox).not.toBeNull();
    expect(textBox!.x).toBeGreaterThan(checkboxBox!.x + checkboxBox!.width);
    expect(Math.abs(textBox!.y - checkboxBox!.y)).toBeLessThan(10);
    await taskText.click({ position: { x: 35, y: 10 } });
    await page.keyboard.type('Validar login');
    await expect(taskText).toHaveText('Validar login');
    await editor.press('Enter');
    await editor.pressSequentially('Validar cierre de sesion');
    const checks = editor.getByRole('checkbox');
    await expect(checks).toHaveCount(2);
    await checks.first().check();
    await expect(checks.first()).toBeChecked();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('checklist-test'))).toContain('data-checked="true"');
    await page.reload();
    await expect(checks).toHaveCount(2);
    await expect(checks.first()).toBeChecked();
    await expect(checks.nth(1)).not.toBeChecked();
    await expect(editor).toContainText('Validar cierre de sesion');
    await checks.first().uncheck();
    await page.reload();
    await expect(checks.first()).not.toBeChecked();
    await page.getByRole('button', { name: 'Solo lectura' }).click();
    await expect(page.getByRole('button', { name: 'Checklist', exact: true })).toBeDisabled();
    const saved = await page.evaluate(() => localStorage.getItem('checklist-test'));
    await expect(checks.first()).toBeDisabled();
    // Attempt a programmatic click too: read-only editors must reject changes.
    await checks.first().evaluate(element => (element as HTMLInputElement).click());
    await expect(checks.first()).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('checklist-test'))).toBe(saved);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
