import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const componentUrl = new URL('../src/components/about/ProjectExternalContactsSection.tsx', import.meta.url);
test('external section labels non-login contacts, separates project/directory, and gates edit controls', async () => {
  assert.equal(existsSync(componentUrl), true, 'external project section must exist');
  const { ProjectExternalContactsSection } = await import(componentUrl.href);
  const props = { projectDocumentId: 'project-a', canManage: true,
    contacts: [{ documentId: 'owned', name: 'Cliente UAT', sourceProject: { documentId: 'project-a' } },
      { documentId: 'shared', name: 'Contacto compartido', sourceProject: null }],
    onAdd() {}, onEdit() {}, onDelete() {} };
  const editable = renderToStaticMarkup(React.createElement(ProjectExternalContactsSection, props));
  assert.match(editable, /Participantes externos \(sin cuenta\)/);
  assert.match(editable, /No conceden acceso|No concede acceso/);
  assert.match(editable, /Del proyecto/);
  assert.match(editable, /Directorio de la organización/);
  assert.match(editable, /Agregar externo/);
  assert.match(editable, /Editar contacto Cliente UAT/);
  assert.doesNotMatch(editable, /Editar contacto Contacto compartido/);
  const readonly = renderToStaticMarkup(React.createElement(ProjectExternalContactsSection, { ...props, canManage: false }));
  assert.match(readonly, /Cliente UAT/);
  assert.match(editable, /Eliminar contacto Cliente UAT/);
  assert.doesNotMatch(editable, /Eliminar contacto Contacto compartido/);
  assert.match(editable, /aria-expanded="false"/);
  assert.match(editable, /aria-controls="([^"]+)"/);
  assert.match(editable, /<div id="[^"]+" hidden=""/);
  assert.match(editable, /Participantes externos \(sin cuenta\) \(2\)/);
  assert.doesNotMatch(readonly, /aria-label="(?:Agregar externo|Editar contacto|Eliminar contacto)/);
  assert.equal((readonly.match(/<button/g) || []).length, 1, 'Viewer retains the accessible disclosure button only');
});

test('About keeps authenticated members separate and mounts scoped external management', () => {
  const about = readFileSync(new URL('../src/components/AboutView.tsx', import.meta.url), 'utf8');
  assert.match(about, /Miembros con cuenta/);
  assert.match(about, /<ProjectExternalContacts/);
});
