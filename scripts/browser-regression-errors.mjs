// Keep uncaught exceptions separate from browser resource diagnostics.
export function classifyBrowserErrors({ pageErrors = [], consoleErrors = [], baselineWarnings = [], expectedResourceResponses = [] }) {
  const baseline = new Set(baselineWarnings);
  const knownWarnings = [];
  const expectedResourceErrors = [];
  const unexpectedConsole = [];
  for (const entry of consoleErrors) {
    if (entry.text.startsWith('Warning:') && baseline.has(entry.text)) {
      knownWarnings.push(entry.text);
      continue;
    }
    const resource = /^Failed to load resource: the server responded with a status of (\d{3})\b/.exec(entry.text);
    if (resource && entry.url && expectedResourceResponses.some(response =>
      response.url === entry.url && response.status === Number(resource[1]))) {
      expectedResourceErrors.push(entry);
      continue;
    }
    unexpectedConsole.push(entry);
  }
  return { pageErrors: [...pageErrors], unexpectedConsole,
    knownWarnings: [...new Set(knownWarnings)], expectedResourceErrors };
}
