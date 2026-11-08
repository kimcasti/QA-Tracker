import { Http } from '../../../config/http';
import { listDocuments, upsertDocument, relation } from '../../shared/services/strapi';
import { AutomationStatus, AutomationType, AutomationTool, AutomationResultStatus, TestType, Priority,
  deriveAutomationStatus, isAutomatedCoverageStatus, type TestCase } from '../../../types';
import { priorityFromApi, priorityToApi, testTypeFromApi, testTypeToApi } from '../../shared/services/enumMappers';
import { validatedCaseTool } from '../../test-cases/utils/caseAuthoring';
import { saveBatch, type BatchResult } from '../../test-cases/utils/saveBatch';
import { buildNextFunctionalityCode } from '../../functionalities/services/functionalitiesService';
import type { CanvasCatalog, CanvasData, CanvasFunctionality, CanvasFunctionalityInput, CanvasModule, CanvasSnapshot } from '../types';
import { parseCanvasState } from '../utils/canvasState';

type Raw = Record<string, any>;
type Context = CanvasData['context'] & { key: string };

const documentIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const validDocumentId = (id: unknown): id is string => typeof id === 'string' && documentIdPattern.test(id);

async function freshContext(projectId: string, documentOnly = false): Promise<Context> {
  if (typeof projectId !== 'string' || !projectId || (documentOnly && !validDocumentId(projectId))) {
    throw new Error('Canvas project identifier is invalid.');
  }
  const response = await Http.get<{ projects: Raw[] }>('/api/me/project-contexts');
  const matches = Array.isArray(response.data?.projects) ? response.data.projects.filter(item => item &&
    (documentOnly ? item.documentId === projectId : item.documentId === projectId || item.key === projectId)) : [];
  const project = matches.length === 1 ? matches[0] : undefined;
  if (!validDocumentId(project?.documentId) || !validDocumentId(project?.organization?.documentId) ||
      typeof project?.key !== 'string' || !project.key) {
    throw new Error('Canvas project context is unavailable or ambiguous.');
  }
  return { documentId: project.documentId, organizationDocumentId: project.organization.documentId, key: project.key };
}

function snapshotDto(value: unknown, documentId: string): CanvasSnapshot {
  const raw = value as CanvasSnapshot;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      Object.keys(raw).some(key => !['projectDocumentId', 'revision', 'state'].includes(key)) ||
      raw.projectDocumentId !== documentId || !Number.isSafeInteger(raw.revision) || raw.revision < 0) {
    throw new Error('Canvas snapshot has invalid provenance or revision.');
  }
  return { projectDocumentId: documentId, revision: raw.revision, state: parseCanvasState(raw.state) };
}

async function readSnapshot(documentId: string): Promise<CanvasSnapshot> {
  const response = await Http.get<{ data: unknown }>(`/api/projects/${encodeURIComponent(documentId)}/canvas`);
  return snapshotDto(response.data.data, documentId);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
      Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left), b = Object.keys(right);
  return a.length === b.length && a.every(key => Object.hasOwn(right, key) &&
    sameValue((left as Raw)[key], (right as Raw)[key]));
}

export async function saveCanvas(projectDocumentId: string, revision: number,
  state: CanvasSnapshot['state'], beforeWrite?: () => void): Promise<CanvasSnapshot> {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) {
    throw new Error('Canvas revision is invalid.');
  }
  const normalized = parseCanvasState(state);
  const context = await freshContext(projectDocumentId, true);
  beforeWrite?.();
  const response = await Http.put<{ data: unknown }>(`/api/projects/${encodeURIComponent(context.documentId)}/canvas`,
    { data: { revision, state: normalized } });
  try {
    const written = snapshotDto(response.data.data, context.documentId);
    if (written.revision !== revision + 1 || !sameValue(written.state, normalized)) {
      throw new Error('Canvas write acknowledgement does not match the requested state.');
    }
    const verified = await readSnapshot(context.documentId);
    if (verified.revision !== written.revision || !sameValue(verified.state, written.state)) {
      throw new Error('Canvas readback does not match the saved state.');
    }
    return verified;
  } catch (error) {
    // Verification failures cannot establish that the preceding write was rejected.
    throw new Error(`Canvas may have been saved, but verification failed: ${error instanceof Error ? error.message : 'verification unavailable'}`);
  }
}

async function rawCatalog(context: Context) {
  const params = { 'filters[project][documentId][$eq]': context.documentId,
    'populate[project][fields][0]': 'documentId', 'populate[project][fields][1]': 'key',
    'populate[organization][fields][0]': 'documentId' };
  const [modules, functionalities, cases, sprints] = await Promise.all([
    listDocuments<Raw>('/api/project-modules', params),
    listDocuments<Raw>('/api/functionalities', { ...params,
      'populate[module][fields][0]': 'documentId', 'populate[sprint][fields][0]': 'documentId' }),
    listDocuments<Raw>('/api/test-cases', { ...params,
      'populate[functionality][fields][0]': 'documentId', 'populate[functionality][fields][1]': 'code' }),
    listDocuments<Raw>('/api/sprints', params),
  ]);
  for (const collection of [modules, functionalities, cases, sprints]) {
    const ids = new Set<string>();
    for (const row of collection) {
      if (!row || !validDocumentId(row.documentId) || ids.has(row.documentId) ||
          row.project?.documentId !== context.documentId ||
          (row.project.key !== undefined && row.project.key !== context.key) ||
          (row.organization != null && row.organization.documentId !== context.organizationDocumentId)) {
        throw new Error('Canvas record has missing or foreign project provenance.');
      }
      ids.add(row.documentId);
    }
  }
  const moduleIds = new Set(modules.map(row => row.documentId));
  const sprintIds = new Set(sprints.map(row => row.documentId));
  for (const row of [...modules, ...sprints]) {
    if (typeof row.name !== 'string' || (row.description != null && typeof row.description !== 'string')) {
      throw new Error('Canvas catalog has invalid module/sprint fields.');
    }
  }
  const functionalityIds = new Map(functionalities.map(row => [row.documentId, row]));
  for (const row of functionalities) {
    if ((row.module != null && !moduleIds.has(row.module.documentId)) ||
        (row.sprint != null && !sprintIds.has(row.sprint.documentId)) ||
        typeof row.name !== 'string' || typeof row.code !== 'string' ||
        !row.code || (row.deliveryDate != null && !validDate(row.deliveryDate))) {
      throw new Error('Canvas functionality has an invalid relation.');
    }
    for (const [field, allowed] of Object.entries(functionalityEnums)) {
      if (row[field] != null && !allowed.includes(row[field])) throw new Error(`Canvas ${field} is invalid.`);
    }
  }
  for (const row of cases) {
    const parent = functionalityIds.get(row.functionality?.documentId);
    if (!parent || row.functionality.code !== parent.code) throw new Error('Canvas case has a foreign or missing functionality relation.');
    if (typeof row.title !== 'string' ||
        !['description', 'preconditions', 'testSteps', 'expectedResult', 'automationReference', 'automationOwner', 'lastAutomationRunAt']
          .every(field => row[field] == null || typeof row[field] === 'string') ||
        (row.sortOrder != null && (typeof row.sortOrder !== 'number' || !Number.isFinite(row.sortOrder))) ||
        (row.isAutomated != null && typeof row.isAutomated !== 'boolean') ||
        (row.testType != null && !Object.values(TestType).some(value => testTypeToApi(value) === row.testType)) ||
        (row.priority != null && !Object.values(Priority).some(value => priorityToApi(value) === row.priority)) ||
        ![['automationStatus', statusApi], ['automationType', typeApi], ['automationTool', toolApi], ['lastAutomationStatus', resultApi]]
          .every(([field, map]) => row[field as string] == null || Object.values(map).includes(row[field as string]))) {
      throw new Error('Canvas case has invalid domain fields.');
    }
  }
  return { modules, functionalities, cases, sprints };
}

const functionalityEnums: Record<string, readonly string[]> = {
  status: ['completed', 'failed', 'in_progress', 'backlog', 'mvp', 'post_mvp'],
  priority: ['critical', 'high', 'medium', 'low'], impactLevel: ['high', 'medium', 'low'],
  probabilityLevel: ['high', 'medium', 'low'],
};

function mapFunctionality(row: Raw): CanvasFunctionality {
  return { documentId: row.documentId, code: row.code, name: row.name,
    moduleDocumentId: row.module?.documentId ?? null, sprintDocumentId: row.sprint?.documentId ?? null,
    deliveryDate: row.deliveryDate, status: row.status, priority: row.priority,
    impactLevel: row.impactLevel, probabilityLevel: row.probabilityLevel };
}

function requiredName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 255) {
    throw new Error('Canvas name is required and must not exceed 255 characters.');
  }
  return name.trim();
}

function mapModule(row: Raw): CanvasModule {
  return { documentId: row.documentId, name: row.name,
    ...(typeof row.description === 'string' ? { description: row.description } : {}) };
}

function verifiedRecord(rows: Raw[], saved: Raw, expectedId?: string): Raw {
  if (!saved || !validDocumentId(saved.documentId) ||
      (expectedId !== undefined && saved.documentId !== expectedId)) {
    throw new Error('Canvas mutation returned an invalid document ID.');
  }
  const row = rows.find(item => item.documentId === saved.documentId);
  if (!row) throw new Error('Canvas saved record is missing from the refreshed catalog.');
  return row;
}

export async function saveCanvasModule(projectDocumentId: string,
  input: { documentId?: string; name: string }, beforeWrite?: () => void): Promise<CanvasModule> {
  const name = requiredName(input.name);
  const context = await freshContext(projectDocumentId, true);
  const before = await rawCatalog(context);
  if (input.documentId !== undefined && !before.modules.some(row => row.documentId === input.documentId)) {
    throw new Error('Canvas module does not belong to this project.');
  }
  // Partial updates deliberately exclude description and every other domain field.
  beforeWrite?.();
  const saved = await upsertDocument<Raw>('/api/project-modules', input.documentId, {
    name, ...(!input.documentId ? { project: relation(context.documentId),
      organization: relation(context.organizationDocumentId) } : {}),
  });
  try {
    const row = verifiedRecord((await rawCatalog(context)).modules, saved, input.documentId);
    if (row.name !== name) throw new Error('Canvas module readback does not match.');
    return mapModule(row);
  } catch (error) {
    // Verification failures cannot establish that the preceding write was rejected.
    throw new Error(`Canvas module may have been saved, but verification failed: ${error instanceof Error ? error.message : 'verification unavailable'}`);
  }
}

function validDate(value: unknown): boolean {
  return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}

export async function saveCanvasFunctionality(projectDocumentId: string,
  input: CanvasFunctionalityInput, beforeWrite?: () => void): Promise<CanvasFunctionality> {
  const name = requiredName(input.name);
  const context = await freshContext(projectDocumentId, true);
  const before = await rawCatalog(context);
  if (input.documentId !== undefined && !before.functionalities.some(row => row.documentId === input.documentId)) {
    throw new Error('Canvas functionality does not belong to this project.');
  }
  const payload: Raw = { name };
  const creating = input.documentId === undefined;
  for (const [field, collection, target] of [
    ['moduleDocumentId', before.modules, 'module'], ['sprintDocumentId', before.sprints, 'sprint'],
  ] as const) {
    if (!creating && !Object.hasOwn(input, field)) continue;
    const id = input[field] ?? null;
    if (id !== null && (typeof id !== 'string' || !collection.some(row => row.documentId === id))) {
      throw new Error(`Canvas ${target} does not belong to this project.`);
    }
    payload[target] = id === null ? null : relation(id);
  }
  for (const [field, allowed] of Object.entries(functionalityEnums)) {
    if (!creating && !Object.hasOwn(input, field)) continue;
    const value = (input as Raw)[field] ?? null;
    if (value !== null && !allowed.includes(value)) throw new Error(`Canvas ${field} is invalid.`);
    payload[field] = value;
  }
  if (creating || Object.hasOwn(input, 'deliveryDate')) {
    payload.deliveryDate = input.deliveryDate ?? null;
    if (!validDate(payload.deliveryDate)) throw new Error('Canvas delivery date is invalid.');
  }
  if (creating) {
    const module = before.modules.find(row => row.documentId === input.moduleDocumentId);
    const nameForCode = module?.name?.trim().slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') ? module.name : 'CANV';
    payload.code = buildNextFunctionalityCode(nameForCode, before.functionalities.map(row => ({ id: row.code, module: '' })));
    if (before.functionalities.some(row => row.code === payload.code)) throw new Error('Canvas functionality code collision.');
    payload.project = relation(context.documentId);
    payload.organization = relation(context.organizationDocumentId);
  }
  // Do not send Jira, QA flags, test types, roles, sort order or other domain fields.
  beforeWrite?.();
  const saved = await upsertDocument<Raw>('/api/functionalities', input.documentId, payload);
  try {
    const row = verifiedRecord((await rawCatalog(context)).functionalities, saved, input.documentId);
    for (const [field, value] of Object.entries(payload)) {
      if (['project', 'organization'].includes(field)) continue;
      if (!sameValue(field === 'module' || field === 'sprint' ? row[field]?.documentId ?? null : row[field],
        field === 'module' || field === 'sprint' ? value?.documentId ?? null : value)) {
        throw new Error('Canvas functionality readback does not match.');
      }
    }
    return mapFunctionality(row);
  } catch (error) {
    // Verification failures cannot establish that the preceding write was rejected.
    throw new Error(`Canvas functionality may have been saved, but verification failed: ${error instanceof Error ? error.message : 'verification unavailable'}`);
  }
}

const statusApi: Record<AutomationStatus, string> = {
  [AutomationStatus.NOT_AUTOMATED]: 'not_automated', [AutomationStatus.CANDIDATE]: 'candidate',
  [AutomationStatus.AUTOMATED]: 'automated', [AutomationStatus.OBSOLETE]: 'obsolete',
};
const typeApi: Record<AutomationType, string> = {
  [AutomationType.UI]: 'ui', [AutomationType.API]: 'api', [AutomationType.INTEGRATION]: 'integration',
  [AutomationType.PERFORMANCE]: 'performance',
};
const toolApi: Record<AutomationTool, string> = {
  [AutomationTool.PLAYWRIGHT]: 'playwright', [AutomationTool.CYPRESS]: 'cypress', [AutomationTool.POSTMAN]: 'postman',
  [AutomationTool.K6]: 'k6', [AutomationTool.WEBDRIVER_IO]: 'webdriverio', [AutomationTool.OTHER]: 'other',
};
const resultApi: Record<AutomationResultStatus, string> = {
  [AutomationResultStatus.PASSED]: 'passed', [AutomationResultStatus.FAILED]: 'failed',
  [AutomationResultStatus.SKIPPED]: 'skipped', [AutomationResultStatus.UNKNOWN]: 'unknown',
};
function fromApi<T extends string>(map: Record<T, string>, value: unknown): T | undefined {
  return (Object.keys(map) as T[]).find(key => map[key] === value);
}
function mapCase(row: Raw, context: Context, index = 0): TestCase {
  const automationStatus = deriveAutomationStatus({
    automationStatus: fromApi(statusApi, row.automationStatus), isAutomated: row.isAutomated,
  });
  return { documentId: row.documentId, id: row.documentId, projectId: context.key,
    functionalityId: row.functionality.code, title: row.title, description: row.description ?? '',
    preconditions: row.preconditions ?? '', testSteps: row.testSteps ?? '', expectedResult: row.expectedResult ?? '',
    testType: testTypeFromApi(row.testType), priority: priorityFromApi(row.priority),
    automationStatus, isAutomated: isAutomatedCoverageStatus(automationStatus),
    automationType: fromApi(typeApi, row.automationType), automationTool: fromApi(toolApi, row.automationTool),
    automationReference: row.automationReference ?? '', automationOwner: row.automationOwner ?? '',
    lastAutomationStatus: fromApi(resultApi, row.lastAutomationStatus), lastAutomationRunAt: row.lastAutomationRunAt,
    sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : index };
}

function casePayload(item: TestCase, context: Context, parent: Raw): Raw {
  if (!item || typeof item.id !== 'string' || !item.id || item.documentId !== undefined ||
      item.projectId !== context.key || item.functionalityId !== parent.code ||
      typeof item.title !== 'string' || !item.title.trim() ||
      !['description', 'preconditions', 'testSteps', 'expectedResult'].every(field => typeof (item as unknown as Raw)[field] === 'string') ||
      ![TestType.FUNCTIONAL, TestType.UAT].includes(item.testType) || !Object.values(Priority).includes(item.priority) ||
      (item.sortOrder !== undefined && (typeof item.sortOrder !== 'number' || !Number.isFinite(item.sortOrder))) ||
      (item.automationStatus !== undefined && !Object.values(AutomationStatus).includes(item.automationStatus)) ||
      (item.automationType !== undefined && !Object.values(AutomationType).includes(item.automationType)) ||
      (item.automationTool !== undefined && item.automationTool !== AutomationTool.PLAYWRIGHT) ||
      (item.lastAutomationStatus !== undefined && !Object.values(AutomationResultStatus).includes(item.lastAutomationStatus)) ||
      (item.isAutomated !== undefined && typeof item.isAutomated !== 'boolean') ||
      !['automationReference', 'automationOwner', 'lastAutomationRunAt'].every(field =>
        (item as unknown as Raw)[field] === undefined || typeof (item as unknown as Raw)[field] === 'string')) {
    throw new Error('Canvas case has invalid authoring fields or project/functionality provenance.');
  }
  const status = deriveAutomationStatus(item);
  let tool: AutomationTool | undefined;
  try { tool = validatedCaseTool(item.automationTool, status); }
  catch { throw new Error('Canvas case requires a valid automation tool.'); }
  return { title: item.title.trim(), description: item.description, preconditions: item.preconditions,
    testSteps: item.testSteps, expectedResult: item.expectedResult, testType: testTypeToApi(item.testType),
    priority: priorityToApi(item.priority), sortOrder: item.sortOrder ?? 0,
    isAutomated: isAutomatedCoverageStatus(status), automationStatus: statusApi[status],
    automationType: item.automationType ? typeApi[item.automationType] : null, automationTool: tool ? toolApi[tool] : null,
    automationReference: item.automationReference?.trim() || null, automationOwner: item.automationOwner?.trim() || null,
    lastAutomationStatus: item.lastAutomationStatus ? resultApi[item.lastAutomationStatus] : 'unknown',
    lastAutomationRunAt: item.lastAutomationRunAt || null,
    organization: relation(context.organizationDocumentId), project: relation(context.documentId),
    functionality: relation(parent.documentId) };
}

export async function createCanvasCases(projectDocumentId: string, functionalityDocumentId: string,
  cases: TestCase[], onProgress?: (count: number) => void, beforeWrite?: () => void): Promise<BatchResult> {
  const context = await freshContext(projectDocumentId, true);
  const before = await rawCatalog(context);
  const parent = before.functionalities.find(row => row.documentId === functionalityDocumentId);
  if (!parent || !Array.isArray(cases)) throw new Error('Canvas case parent does not belong to this project.');
  const ids = new Set<string>();
  const normalizedTitle = (title: string): string => title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const titles = new Set(before.cases.filter(row => row.functionality.documentId === functionalityDocumentId)
    .map(row => normalizedTitle(row.title)));
  // Build and validate EVERY payload before issuing the first POST.
  const payloads = cases.map(item => {
    const payload = casePayload(item, context, parent);
    if (ids.has(item.id) || before.cases.some(row => row.documentId === item.id)) {
      throw new Error('Canvas batch contains duplicate or persisted case IDs.');
    }
    const title = normalizedTitle(item.title);
    if (titles.has(title)) throw new Error('Canvas batch contains a duplicate case title.');
    titles.add(title);
    ids.add(item.id);
    return payload;
  });
  const knownIds = new Set(before.cases.map(row => row.documentId));
  return saveBatch(cases, async item => {
    const fresh = await freshContext(projectDocumentId, true);
    if (!sameValue(fresh, context)) throw new Error('Canvas project context changed before case creation.');
    const payload = payloads[cases.indexOf(item)];
    beforeWrite?.();
    const saved = await upsertDocument<Raw>('/api/test-cases', undefined, payload);
    try {
      const row = verifiedRecord((await rawCatalog(context)).cases, saved);
      if (knownIds.has(row.documentId) || row.functionality.documentId !== functionalityDocumentId) {
        throw new Error('Canvas case readback has an unexpected document ID or parent.');
      }
      for (const [field, value] of Object.entries(payload)) {
        if (['project', 'organization', 'functionality'].includes(field)) continue;
        if (!sameValue(row[field] ?? null, value)) throw new Error('Canvas case readback does not match.');
      }
      knownIds.add(row.documentId);
      return mapCase(row, context);
    } catch (error) {
      // Even a 4xx from the verification GET says nothing about whether POST persisted.
      // A non-Axios failure keeps saveBatch's ambiguous flag true and prevents blind retries.
      throw new Error(`Canvas case may have been created, but readback failed: ${error instanceof Error ? error.message : 'verification unavailable'}`);
    }
  }, onProgress);
}

export async function loadCanvas(projectId: string): Promise<CanvasData> {
  const context = await freshContext(projectId);
  const [snapshot, raw] = await Promise.all([readSnapshot(context.documentId), rawCatalog(context)]);
  const catalog: CanvasCatalog = {
    modules: raw.modules.map(mapModule),
    functionalities: raw.functionalities.map(mapFunctionality),
    sprints: raw.sprints.map(row => ({ documentId: row.documentId, name: row.name })),
    cases: raw.cases.map((row, index) => {
      const testCase = mapCase(row, context, index);
      return { documentId: row.documentId, title: row.title,
        functionalityDocumentId: row.functionality.documentId,
        functionalityCode: row.functionality.code, testCase };
    }),
  };
  return { context: { documentId: context.documentId, organizationDocumentId: context.organizationDocumentId }, snapshot, catalog };
}
