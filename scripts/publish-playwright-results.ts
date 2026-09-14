import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

type OpenRunResponse = {
  data?: {
    testRunDocumentId?: string;
    projectDocumentId?: string;
    organizationDocumentId?: string;
    projectKey?: string;
    title?: string;
    status?: string;
  };
};

type PublishResultsResponse = {
  data?: {
    summary?: {
      matchedCases?: Array<{ testCaseTitle?: string; reference?: string; status?: string }>;
      missingReferenceCases?: Array<{ testCaseTitle?: string }>;
      unmatchedExecutionCases?: Array<{ testCaseTitle?: string; reference?: string }>;
      unmatchedReportReferences?: string[];
      duplicateReportReferences?: string[];
    };
  };
};

type PlaywrightReport = {
  suites?: Array<{
    suites?: PlaywrightReport['suites'];
    specs?: Array<{
      title?: string;
      file?: string;
      tests?: Array<{
        results?: Array<{
          status?: string;
        }>;
      }>;
    }>;
  }>;
};

function getRequiredEnv(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeStatus(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'timedout':
    case 'interrupted':
      return 'failed';
    case 'skipped':
      return 'skipped';
    default:
      return 'unknown';
  }
}

function extractLatestStatus(spec: NonNullable<NonNullable<PlaywrightReport['suites']>[number]['specs']>[number]) {
  const testStatuses = (spec.tests || [])
    .flatMap(test => test.results || [])
    .map(result => normalizeStatus(result.status));

  if (testStatuses.includes('failed')) {
    return 'failed';
  }

  if (testStatuses.includes('passed')) {
    return 'passed';
  }

  if (testStatuses.includes('skipped')) {
    return 'skipped';
  }

  return 'unknown';
}

function collectPlaywrightSpecs(suites: PlaywrightReport['suites'], acc: Array<{ file: string; title: string; status: string }>) {
  (suites || []).forEach(suite => {
    (suite.specs || []).forEach(spec => {
      const file = String(spec.file || '').trim();
      const title = String(spec.title || '').trim();

      if (!file || !title) {
        return;
      }

      acc.push({
        file,
        title,
        status: extractLatestStatus(spec),
      });
    });

    collectPlaywrightSpecs(suite.suites || [], acc);
  });
}

async function readPlaywrightResults(reportPath: string) {
  const absolutePath = path.resolve(reportPath);
  const rawContent = await fs.readFile(absolutePath, 'utf8');
  const parsedReport = JSON.parse(rawContent) as PlaywrightReport;
  const specs: Array<{ file: string; title: string; status: string }> = [];
  collectPlaywrightSpecs(parsedReport.suites || [], specs);

  return specs.map(spec => ({
    automationReference: `${spec.file}::${spec.title}`,
    status: spec.status,
  }));
}

async function postJson<T>(url: string, token: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

async function main() {
  const apiUrl = getRequiredEnv('QA_TRACKER_API_URL').replace(/\/$/, '');
  const projectKey = getRequiredEnv('QA_TRACKER_PROJECT_KEY');
  const token = getRequiredEnv('QA_TRACKER_TOKEN');
  const reportPath = getRequiredEnv('QA_TRACKER_REPORT_PATH');
  const tool = String(process.env.QA_TRACKER_TOOL || 'playwright').trim().toLowerCase();
  const runTitle =
    String(process.env.QA_TRACKER_RUN_TITLE || '').trim() || `Playwright local run ${new Date().toISOString()}`;

  const normalizedResults = await readPlaywrightResults(reportPath);
  if (normalizedResults.length === 0) {
    throw new Error('No Playwright results were found in the JSON report.');
  }

  const openRunResponse = await postJson<OpenRunResponse>(
    `${apiUrl}/api/automation-ingestion/open-run`,
    token,
    {
      data: {
        projectKey,
        tool,
        title: runTitle,
        branch: String(process.env.QA_TRACKER_BRANCH || '').trim() || null,
        buildVersion: String(process.env.QA_TRACKER_BUILD_VERSION || '').trim() || null,
        environment: String(process.env.QA_TRACKER_ENVIRONMENT || 'local').trim().toLowerCase(),
        triggeredBy: String(process.env.QA_TRACKER_TRIGGERED_BY || '').trim() || 'local-script',
        executionDate: String(process.env.QA_TRACKER_EXECUTION_DATE || '').trim() || new Date().toISOString(),
        testType: String(process.env.QA_TRACKER_TEST_TYPE || 'smoke').trim().toLowerCase(),
        priority: String(process.env.QA_TRACKER_PRIORITY || 'medium').trim().toLowerCase(),
      },
    },
  );

  const testRunDocumentId = String(openRunResponse.data?.testRunDocumentId || '').trim();
  if (!testRunDocumentId) {
    throw new Error('QA Tracker did not return a testRunDocumentId.');
  }

  const publishResponse = await postJson<PublishResultsResponse>(
    `${apiUrl}/api/automation-ingestion/publish-results`,
    token,
    {
      data: {
        testRunDocumentId,
        tool,
        importedAt: new Date().toISOString(),
        removeMissingResults: true,
        results: normalizedResults,
      },
    },
  );

  const summary = publishResponse.data?.summary;
  console.log(`Opened run: ${testRunDocumentId}`);
  console.log(`Matched cases: ${summary?.matchedCases?.length || 0}`);
  console.log(`Missing reference cases: ${summary?.missingReferenceCases?.length || 0}`);
  console.log(`Unmatched execution cases: ${summary?.unmatchedExecutionCases?.length || 0}`);
  console.log(`Unmatched report references: ${summary?.unmatchedReportReferences?.length || 0}`);
  console.log(`Duplicate report references: ${summary?.duplicateReportReferences?.length || 0}`);
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
