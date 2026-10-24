import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import dayjs from 'dayjs';
import ts from 'typescript';

// Execute declarations from the real components, without hooks, services or a DOM.
function sourceFor(component: string) {
  return ts.createSourceFile(`${component}.tsx`, readFileSync(
    new URL(`../src/components/${component}.tsx`, import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function declaration(component: string, name: string) {
  const source = sourceFor(component);
  let result: ts.VariableDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) result = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result?.initializer, `actual ${component}.${name} must exist`);
  return result.initializer.getText(source);
}
function evaluate(expression: string, context: Record<string, unknown> = {}) {
  const code = ts.transpileModule(`const extracted = ${expression}; extracted;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  return runInNewContext(code, {
    React, dayjs, Text: 'span', Space: 'span', Button: 'button',
    CalendarOutlined: () => null, EditOutlined: () => null,
    getStatusTag: () => null, isViewer: false, ...context,
  });
}
const undated = { id: 'sprint-imported', name: 'Sprint imported', projectId: 'project', startDate: '', endDate: '', status: 'Planeado' };
const dated = { ...undated, startDate: '2026-10-01', endDate: '2026-10-15' };
const components = ['SprintManagement', 'Settings'];
function columns(component: string, context: Record<string, unknown> = {}) {
  return evaluate(declaration(component, component === 'Settings' ? 'sprintColumns' : 'columns'), context);
}

for (const rejectSave of [false, true]) {
  test(`SprintManagement ${rejectSave ? 'keeps the editor open on rejected save' : 'awaits persistence before announcing success and closing'}`, async () => {
    const events: string[] = [];
    const writes: any[] = [];
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    // Also handle the pre-fix floating promise so RED reports an assertion, not an unhandled rejection.
    void pending.catch(() => {});
    const handleSave = evaluate(declaration('SprintManagement', 'handleSave'), {
      projectId: 'project', editingSprint: undated,
      form: {
        validateFields: async () => ({ name: 'Configured sprint', dates: [dayjs(dated.startDate), dayjs(dated.endDate)] }),
        resetFields: () => events.push('reset'),
      },
      saveSprint: (sprint: unknown) => { writes.push(sprint); events.push('save'); return pending; },
      message: { success: () => events.push('success') },
      setIsModalOpen: () => events.push('close'), setEditingSprint: () => events.push('clear'),
      console: { error: () => events.push('error') },
    });
    const saving = handleSave();
    await new Promise<void>(ready => setImmediate(ready));
    const beforePersistence = [...events];
    if (rejectSave) reject(new Error('Synthetic save failure'));
    else resolve();
    await saving;
    assert.deepEqual(beforePersistence, ['save'], 'no optimistic success or modal close before persistence');
    assert.deepEqual(events, rejectSave ? ['save', 'error'] : ['save', 'success', 'close', 'clear', 'reset']);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, undated.id);
    assert.equal(writes[0].startDate, dayjs(dated.startDate).toISOString());
    assert.equal(writes[0].endDate, dayjs(dated.endDate).toISOString());
  });
}

function openEditor(component: string, record: typeof undated) {
  let fields: any;
  let opened = false;
  const context = {
    activeTab: 'sprints', form: { setFieldsValue: (values: unknown) => { fields = values; } },
    setEditingItem: () => {}, setEditingSprint: () => {},
    setIsModalVisible: (value: boolean) => { opened = value; },
    setIsModalOpen: (value: boolean) => { opened = value; },
  };
  if (component === 'Settings') evaluate(declaration(component, 'handleOpenModal'), context)(record);
  else {
    const actions = columns(component, context).find((column: any) => column.key === 'actions');
    actions.render(undefined, record).props.children.props.onClick();
  }
  assert.equal(opened, true);
  return fields;
}

for (const component of components) {
  test(`${component} opens undated sprint with an undefined range, clearing previously configured dates`, () => {
    const configured = openEditor(component, dated);
    const field = component === 'Settings' ? 'period' : 'dates';
    assert.equal(configured[field][0].format('YYYY-MM-DD'), dated.startDate);
    assert.equal(configured[field][1].format('YYYY-MM-DD'), dated.endDate);
    for (const record of [undated, { ...undated, startDate: dated.startDate }, { ...undated, endDate: dated.endDate }]) {
      const fields = openEditor(component, record);
      assert.ok(Object.hasOwn(fields, field), 'explicit undefined must clear the prior form range');
      assert.ok(fields[field] === undefined, 'undated edit must not populate invalid dayjs values');
      assert.equal(fields.id, undated.id);
    }
  });

  test(`${component} still requires dates for manual sprint saves`, () => {
    const source = sourceFor(component);
    const field = component === 'Settings' ? 'period' : 'dates';
    let rules: string | undefined;
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === 'Form.Item') {
        const name = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(source) === 'name');
        if (name && ts.isJsxAttribute(name) && name.initializer && ts.isStringLiteral(name.initializer) && name.initializer.text === field) {
          const attribute = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(source) === 'rules');
          if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)) rules = attribute.initializer.expression?.getText(source);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(rules, 'actual date Form.Item rules must exist');
    assert.ok(evaluate(rules).some((rule: any) => rule.required === true));
  });
  test(`${component} renders pending dates for undated and partial imported sprints`, () => {
    const period = columns(component).find((column: any) => column.key === 'period');
    for (const record of [undated, { ...undated, startDate: dated.startDate }, { ...undated, endDate: dated.endDate }]) {
      const html = renderToStaticMarkup(period.render(undefined, record));
      assert.match(html, /Fechas pendientes/);
      assert.doesNotMatch(html, /Invalid Date/);
    }
    const html = renderToStaticMarkup(period.render(undefined, dated));
    assert.match(html, /01\/10\/2026/);
    assert.match(html, /15\/10\/2026/);
    assert.doesNotMatch(html, /Fechas pendientes/);
  });
}
