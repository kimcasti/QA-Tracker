import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function resolver() {
  const file = path.resolve('src/modules/canvas/caseEditContext.ts');
  assert.ok(fs.existsSync(file), 'Canvas must resolve exact persisted case/functionality context before opening the editor');
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'resolveCanvasCaseEdit');
  assert.ok(declaration);
  const js = ts.transpileModule(declaration.getText(ast).replace(/^export\s+/, ''), { compilerOptions:{ target:ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(`${js}\nresolveCanvasCaseEdit`);
}
function catalog() {
  return { modules:[{documentId:'module1',name:'Módulo'}],
    functionalities:[{documentId:'fun1',code:'F-1',name:'Funcionalidad',moduleDocumentId:'module1'},
      {documentId:'fun2',code:'F-1',name:'Otro registro con mismo código'}],
    cases:[{documentId:'case1',title:'Caso',functionalityDocumentId:'fun1',functionalityCode:'F-1',
      testCase:{documentId:'case1',projectId:'PROJECT-A',functionalityId:'F-1'}}], sprints:[] };
}
test('Canvas resolves case by exact persistence parent, even with duplicate business codes', () => {
  const result = resolver()(catalog(), 'PROJECT-A', 'F-1', 'case1');
  assert.equal(result?.functionality.documentId, 'fun1');
  assert.equal(result?.caseItem.documentId, 'case1');
  assert.equal(result?.moduleName, 'Módulo');
});
test('Canvas case editor refuses missing or cross-project or mismatched parent links', () => {
  const resolve = resolver();
  assert.equal(resolve(catalog(),'PROJECT-B','F-1','case1'),null);
  assert.equal(resolve(catalog(),'PROJECT-A','F-2','case1'),null);
  assert.equal(resolve(catalog(),'PROJECT-A','F-1','missing'),null);
  const missingParent=catalog(); missingParent.cases[0].functionalityDocumentId='foreign';
  assert.equal(resolve(missingParent,'PROJECT-A','F-1','case1'),null);
});
