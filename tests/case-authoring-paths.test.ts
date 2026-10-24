import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as types from '../src/types';
import * as mappers from '../src/modules/shared/services/enumMappers';
import * as policy from '../src/modules/test-cases/utils/caseAuthoring';

// Execute actual declarations, replacing only their surrounding state/IO boundaries.
function declaration(file: string, name: string, context: Record<string, any>) {
  const text = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let source = '';
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) source = `const ${node.getText(ast)};`;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) source = node.getText(ast).replace(/^export /, '');
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(source, `${name} exists`);
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const scope = { ...types, ...mappers, ...policy, ...context } as Record<string, any>;
  if (name.startsWith('save') && text.includes('function automationToolFromApi') && !scope.automationToolFromApi) {
    scope.automationToolFromApi = declaration(file, 'automationToolFromApi', {});
  }
  if (name !== 'automationStatusFromApi' && text.includes('function automationStatusFromApi') && !scope.automationStatusFromApi) {
    scope.automationStatusFromApi = declaration(file, 'automationStatusFromApi', {});
  }
  return new Function(...Object.keys(scope), `${js}; return ${name};`)(...Object.values(scope));
}
const component = 'src/components/TestCaseManagement.tsx';

test('applying historic templates normalizes new cases but preserves only the edited case original', () => {
  for (const original of [undefined, types.TestType.SMOKE, types.TestType.INTEGRATION]) {
    for (const incoming of Object.values(types.TestType)) {
      let values: any;
      const apply = declaration(component, 'handleTemplateSelect', {
        templates: [{ id: 'template', testType: incoming, automationTool: types.AutomationTool.CYPRESS }],
        editingTestCase: original ? { testType: original } : null,
        form: { setFieldsValue: (v: any) => { values = v; } },
      });
      apply('template');
      assert.equal(values.testType, policy.normalizeCaseType(incoming, original));
      assert.equal(values.automationTool, undefined, 'template must not introduce a historic tool');
    }
  }
});

test('new case service writes normalize all historic types, keeping UAT and historic edits', async () => {
  for (const id of ['TC-1', 'TC-AI-1', 'TC-PASTE-1', 'persisted-case']) {
    for (const testType of Object.values(types.TestType)) {
      let payload: any;
      const save = declaration('src/modules/test-cases/services/testCasesService.ts', 'saveTestCase', {
        findProjectContext: async () => ({ documentId: 'project', organizationDocumentId: 'org' }),
        getFunctionalities: async () => [], relation: (x: any) => x,
        getDocument: async () => ({ testType: mappers.testTypeToApi(testType) }),
        automationStatusToApi: (x: any) => x, automationTypeToApi: (x: any) => x,
        automationToolToApi: (x: any) => x, automationResultStatusToApi: (x: any) => x,
        upsertDocument: async (_: any, __: any, data: any) => { payload = data; return data; },
        mapTestCase: (x: any) => x,
      });
      await save({ id, projectId: 'P', testType });
      const expected = id.startsWith('TC-') ? policy.normalizeCaseType(testType) : testType;
      assert.equal(payload.testType, mappers.testTypeToApi(expected), `${id}/${testType}`);
    }
  }
});

test('case form normalizes injected historic types except the exact original edit value', () => {
  for (const original of [undefined, types.TestType.SMOKE]) {
    for (const incoming of Object.values(types.TestType)) {
      let payload: any;
      const finish = declaration(component, 'onFinish', {
        form: { getFieldsValue: () => ({}) }, visibleTestCases: [],
        editingTestCase: original ? { id: 'persisted-case', testType: original } : null,
        projectId: 'P', functionalityId: 'F', save: (v: any) => { payload = v; },
      });
      finish({ testType: incoming });
      assert.equal(payload.testType, policy.normalizeCaseType(incoming, original));
    }
  }
});

test('template service normalizes creations and permits only its persisted original historic type on edits', async () => {
  for (const original of [undefined, types.TestType.SMOKE]) {
    for (const incoming of Object.values(types.TestType)) {
      let payload: any;
      const save = declaration('src/modules/test-case-templates/services/testCaseTemplatesService.ts', 'saveTestCaseTemplate', {
        findProjectContext: async () => ({ documentId: 'P', organizationDocumentId: 'O' }),
        listDocuments: async () => original ? [{ documentId: 'template', testType: mappers.testTypeToApi(original) }] : [],
        relation: (x: any) => x, automationStatusToApi: (x: any) => x,
        automationTypeToApi: (x: any) => x, automationToolToApi: (x: any) => x,
        upsertDocument: async (_: any, __: any, v: any) => { payload = v; return v; }, mapTemplate: (x: any) => x,
      });
      await save({ id: 'T1', projectId: 'P', moduleId: 'M', testType: incoming });
      assert.equal(payload.testType, mappers.testTypeToApi(policy.normalizeCaseType(incoming, original)));
    }
  }
});

test('new case/template services reject unsupported automated tools before writing, clear manual tools, and retain historic edits', async () => {
  for (const template of [false, true]) {
    for (const existing of [false, true]) {
      for (const status of [types.AutomationStatus.NOT_AUTOMATED, types.AutomationStatus.AUTOMATED]) {
        let writes = 0;
        let payload: any;
        const save = declaration(template ? 'src/modules/test-case-templates/services/testCaseTemplatesService.ts' : 'src/modules/test-cases/services/testCasesService.ts', template ? 'saveTestCaseTemplate' : 'saveTestCase', {
          findProjectContext: async () => ({ documentId: 'P', organizationDocumentId: 'O' }),
          getFunctionalities: async () => [],
          getDocument: async () => ({ testType: 'smoke', automationTool: 'cypress' }),
          listDocuments: async () => existing ? [{ documentId: 'persisted', testType: 'smoke', automationTool: 'cypress' }] : [],
          relation: (x: any) => x, automationStatusToApi: (x: any) => x,
          automationTypeToApi: (x: any) => x, automationToolToApi: (x: any) => x,
          automationToolFromApi: (x: any) => x === 'cypress' ? types.AutomationTool.CYPRESS : undefined,
          automationResultStatusToApi: (x: any) => x,
          upsertDocument: async (_: any, __: any, v: any) => { writes++; payload = v; return v; },
          mapTemplate: (x: any) => x, mapTestCase: (x: any) => x,
        });
        const input = { id: existing ? 'persisted' : 'TC-NEW', projectId: 'P', moduleId: 'M', testType: types.TestType.SMOKE, automationTool: types.AutomationTool.CYPRESS, automationStatus: status };
        if (!existing && status === types.AutomationStatus.AUTOMATED) {
          await assert.rejects(() => save(input), /Selecciona Playwright/);
          assert.equal(writes, 0);
        } else {
          await save(input);
          assert.equal(writes, 1);
          assert.equal(payload.automationTool, existing ? types.AutomationTool.CYPRESS : undefined);
        }
      }
    }
  }
});

test('case submit clears unsupported manual tools and blocks automated tools unless they match original', () => {
  for (const original of [undefined, types.AutomationTool.CYPRESS]) {
    for (const status of [types.AutomationStatus.NOT_AUTOMATED, types.AutomationStatus.AUTOMATED]) {
      let payload: any;
      let errors: any;
      const finish = declaration(component, 'onFinish', {
        form: { getFieldsValue: () => ({}), setFields: (v: any) => { errors = v; } },
        visibleTestCases: [], editingTestCase: original ? { id: 'persisted', automationTool: original } : null,
        projectId: 'P', functionalityId: 'F', save: (v: any) => { payload = v; },
      });
      finish({ testType: types.TestType.FUNCTIONAL, automationTool: types.AutomationTool.CYPRESS, automationStatus: status });
      if (!original && status === types.AutomationStatus.AUTOMATED) {
        assert.equal(payload, undefined);
        assert.match(errors?.[0]?.errors?.[0] || '', /Selecciona Playwright/);
      } else assert.equal(payload.automationTool, original);
    }
  }
});

test('duplicating historic automated cases opens a new normalized draft requiring active tool choice', () => {
  let payload: any;
  let fields: any;
  let opened = false;
  const duplicate = declaration(component, 'handleDuplicate', {
    visibleTestCases: [], save: (v: any) => { payload = v; },
    buildDuplicatedTestCaseTitle: (title: string) => `${title} copy`,
    openCaseForm: () => { opened = true; }, form: { setFieldsValue: (v: any) => { fields = v; } },
  });
  duplicate({ id: 'persisted', title: 'Synthetic', testType: types.TestType.SMOKE, automationTool: types.AutomationTool.CYPRESS, automationStatus: types.AutomationStatus.AUTOMATED });
  assert.equal(payload, undefined);
  assert.equal(opened, true);
  assert.equal(fields.testType, types.TestType.FUNCTIONAL);
  assert.equal(fields.automationTool, undefined);
});

test('case service rereads the exact original and cannot switch one historic type/tool to another', async () => {
  let payload: any;
  let reads = 0;
  const save = declaration('src/modules/test-cases/services/testCasesService.ts', 'saveTestCase', {
    findProjectContext: async () => ({ documentId: 'P' }), getFunctionalities: async () => [],
    getDocument: async (endpoint: string, id: string) => { assert.equal(endpoint, '/api/test-cases'); assert.equal(id, 'persisted'); reads++; return { testType: 'smoke', automationTool: 'cypress' }; },
    relation: (x: any) => x, automationStatusToApi: (x: any) => x, automationTypeToApi: (x: any) => x,
    automationToolToApi: (x: any) => x, automationResultStatusToApi: (x: any) => x,
    upsertDocument: async (_: any, __: any, v: any) => { payload = v; return v; }, mapTestCase: (x: any) => x,
  });
  await save({ id: 'persisted', projectId: 'P', testType: types.TestType.INTEGRATION, automationTool: types.AutomationTool.POSTMAN });
  assert.equal(payload.testType, 'functional');
  assert.equal(payload.automationTool, undefined);
  assert.equal(reads, 1);
});

test('case list filtering depends only on search/status, never a hidden removed result/tool filter', () => {
  const source = readFileSync(component, 'utf8');
  assert.doesNotMatch(source, /automationResultFilter|automationToolFilter|setAutomationResultFilter|setAutomationToolFilter/);
  const cases = [
    { id: 'one', title: 'First', automationTool: types.AutomationTool.CYPRESS, lastAutomationStatus: types.AutomationResultStatus.FAILED },
    { id: 'two', title: 'Second', automationTool: types.AutomationTool.K6, lastAutomationStatus: types.AutomationResultStatus.PASSED },
  ];
  const result = declaration(component, 'filteredTestCases', {
    useMemo: (calculate: () => unknown) => calculate(), visibleTestCases: cases,
    testCaseSearch: '', automationFilter: 'all',
    automationResultFilter: types.AutomationResultStatus.FAILED, automationToolFilter: types.AutomationTool.CYPRESS,
  });
  assert.deepEqual(result.map((item: any) => item.id), ['one', 'two']);
});

for (const template of [false, true]) {
  const file = template ? 'src/modules/test-case-templates/services/testCaseTemplatesService.ts' : 'src/modules/test-cases/services/testCasesService.ts';
  const name = template ? 'saveTestCaseTemplate' : 'saveTestCase';
  test(`${name} preserves absent tools only for originally automated edits`, async () => {
    for (const originalStatus of [undefined, 'automated', 'not_automated', 'candidate', 'obsolete']) {
      for (const tool of [undefined, null, types.AutomationTool.PLAYWRIGHT, types.AutomationTool.CYPRESS]) {
        let payload: any;
        let writes = 0;
        const original = originalStatus ? { documentId: 'persisted', testType: 'functional', automationStatus: originalStatus, automationTool: null } : undefined;
        const context: Record<string, any> = {
          findProjectContext: async () => ({ documentId: 'P', organizationDocumentId: 'O' }),
          getFunctionalities: async () => [], getDocument: async () => original,
          listDocuments: async () => original ? [original] : [], relation: (x: any) => x,
          upsertDocument: async (_: any, __: any, data: any) => { writes++; payload = data; return data; },
          mapTemplate: (x: any) => x, mapTestCase: (x: any) => x,
        };
        // Use the service's real enum conversions, not identity mocks.
        for (const helper of ['automationStatusFromApi', 'automationStatusToApi', 'automationTypeToApi', 'automationToolToApi', ...(template ? [] : ['automationResultStatusToApi'])]) {
          context[helper] = declaration(file, helper, {});
        }
        const save = declaration(file, name, context);
        const input = { id: original ? 'persisted' : 'TC-NEW', projectId: 'P', moduleId: 'M', title: 'Edited title', name: 'Edited title', description: '<p>Edited content</p>', testType: types.TestType.FUNCTIONAL, automationStatus: types.AutomationStatus.AUTOMATED, automationTool: tool };
        if (tool === types.AutomationTool.PLAYWRIGHT || (originalStatus === 'automated' && tool == null)) {
          await save(input);
          assert.equal(writes, 1);
          assert.equal(payload.automationTool, tool === types.AutomationTool.PLAYWRIGHT ? 'playwright' : null);
          assert.equal(payload.automationStatus, 'automated');
          assert.equal(payload.description, input.description);
          assert.equal(payload[template ? 'name' : 'title'], 'Edited title');
        } else {
          await assert.rejects(() => save(input), /Selecciona Playwright/);
          assert.equal(writes, 0, 'creation/promotion/unsupported replacement must not write');
        }
      }
    }
  });
}

test('case submit permits absent-tool automated edits but not manual promotion or creation', () => {
  for (const originalStatus of [undefined, types.AutomationStatus.AUTOMATED, types.AutomationStatus.NOT_AUTOMATED]) {
    let payload: any;
    let errors: any;
    const finish = declaration(component, 'onFinish', {
      form: { getFieldsValue: () => ({}), setFields: (v: any) => { errors = v; } }, visibleTestCases: [],
      editingTestCase: originalStatus ? { id: 'persisted', automationStatus: originalStatus } : null,
      projectId: 'P', functionalityId: 'F', save: (v: any) => { payload = v; },
    });
    finish({ title: 'Edited title', description: 'Edited content', automationStatus: types.AutomationStatus.AUTOMATED });
    if (originalStatus === types.AutomationStatus.AUTOMATED) {
      assert.equal(payload.title, 'Edited title');
      assert.equal(payload.description, 'Edited content');
      assert.equal(payload.automationTool, undefined);
    } else {
      assert.equal(payload, undefined);
      assert.match(errors?.[0]?.errors?.[0] || '', /Selecciona Playwright/);
    }
  }
});

test('template submit preserves absent-tool automated edits but rejects manual promotion and creation', async () => {
  for (const originalStatus of [undefined, types.AutomationStatus.AUTOMATED, types.AutomationStatus.NOT_AUTOMATED]) {
    let payload: any;
    const save = declaration('src/components/Settings.tsx', 'handleSave', {
      activeTab: 'templates', projectId: 'P', editingItem: originalStatus ? { id: 'persisted', automationStatus: originalStatus } : null,
      saveTemplate: async (v: any) => { payload = v; }, message: { success: () => {}, error: () => {} },
      tabLabelMap: { templates: 'Plantilla' }, closeModal: () => {},
    });
    const input = { name: 'Edited title', description: 'Edited content', automationStatus: types.AutomationStatus.AUTOMATED };
    if (originalStatus === types.AutomationStatus.AUTOMATED) {
      await save(input);
      assert.ok(payload, 'historical automated template must save');
      assert.equal(payload.name, input.name);
      assert.equal(payload.description, input.description);
      assert.equal(payload.automationTool, undefined);
    } else {
      await assert.rejects(() => save(input), /Selecciona Playwright/);
      assert.equal(payload, undefined);
    }
  }
});

export { declaration };
