import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Typography } from 'antd';
import { softSurface } from '../src/theme/palette';

test('meeting PARTICIPANTES label wraps visibly inside narrow metric instead of forcing nowrap or clipping', () => {
  const source = readFileSync(new URL('../src/components/AboutView.tsx', import.meta.url), 'utf8');
  const metric = source.slice(source.indexOf('function MetricPill('), source.indexOf('function HeaderActionButton('));
  assert.ok(metric.length > 0);
  const compiled = transformSync(`${metric}\nmodule.exports = MetricPill;`, { loader: 'tsx', format: 'cjs' }).code;
  const module = { exports: null as any };
  runInNewContext(compiled, { module, React, Text: Typography.Text, softSurface });
  const html = renderToStaticMarkup(React.createElement(module.exports, { label: 'Participantes', value: 3, accent: '#123456' }));
  assert.match(html, />Participantes</);
  assert.doesNotMatch(html, /whitespace-nowrap|text-overflow:ellipsis|overflow:hidden|display:none/);
  assert.match(html, /white-space:normal/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /min-width:0/);
});
