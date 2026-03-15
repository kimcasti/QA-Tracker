import { Button, Tag, Typography } from 'antd';
import { CloseCircleFilled, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTestCases } from '../../test-cases/hooks/useTestCases';
import { useTestRuns } from '../../test-runs/hooks/useTestRuns';
import { ExecutionStatus, TestResult, type Functionality, TestStatus } from '../../../types';
import { labelPriority, labelRisk, labelTestStatus } from '../../../i18n/labels';
import { qaPalette } from '../../../theme/palette';
import { functionalityStatusColors, softTagStyle } from '../../../theme/statusStyles';

const { Text } = Typography;

export function TaskPlaceholderCard() {
  const { t } = useTranslation();

  return (
    <div
      data-swapy-no-drag
      className="rounded-xl bg-slate-50 border border-dashed border-slate-200 px-3 py-2 shadow-sm"
    >
      <Text type="secondary" className="text-xs">
        {t('storymap.drop_here')}
      </Text>
    </div>
  );
}

export function TaskCard({
  projectId,
  functionality,
  onUnassign,
}: {
  projectId?: string;
  functionality?: Functionality;
  onUnassign?: () => void;
}) {
  const { t } = useTranslation();

  const functionalityId = functionality?.id || '';
  const { data: testCasesData } = useTestCases(projectId);
  const { data: testRunsData } = useTestRuns(projectId);
  const testCases = Array.isArray(testCasesData) ? testCasesData : [];
  const testRuns = Array.isArray(testRunsData) ? testRunsData : [];

  const status = functionality?.status;

  const statusStyle = useMemo(() => {
    const s = status as unknown as string;
    switch (s) {
      case TestStatus.BACKLOG:
        return softTagStyle(functionalityStatusColors[TestStatus.BACKLOG]);
      case TestStatus.MVP:
        return softTagStyle(functionalityStatusColors[TestStatus.MVP]);
      case TestStatus.POST_MVP:
        return softTagStyle(functionalityStatusColors[TestStatus.POST_MVP]);
      case TestStatus.IN_PROGRESS:
        return softTagStyle(functionalityStatusColors[TestStatus.IN_PROGRESS]);
      case TestStatus.COMPLETED:
        return softTagStyle(functionalityStatusColors[TestStatus.COMPLETED]);
      case TestStatus.FAILED:
        return softTagStyle(functionalityStatusColors[TestStatus.FAILED]);
      default:
        return softTagStyle(functionalityStatusColors[TestStatus.BACKLOG]);
    }
  }, [status]);

  const { totalTests, failedTests } = useMemo(() => {
    if (!functionalityId) return { totalTests: 0, failedTests: 0 };

    const myCases = testCases.filter(tc => tc.functionalityId === functionalityId);
    const total = myCases.length;
    if (total === 0) return { totalTests: 0, failedTests: 0 };

    const caseIds = new Set(myCases.map(tc => tc.id));
    const finalized = testRuns
      .filter(r => r.status === ExecutionStatus.FINAL)
      .sort((a, b) => (a.executionDate || '').localeCompare(b.executionDate || ''));

    const lastResultByCase = new Map<string, TestResult>();
    for (const run of finalized) {
      for (const res of run.results || []) {
        if (!caseIds.has(res.testCaseId)) continue;
        lastResultByCase.set(res.testCaseId, res.result);
      }
    }

    let failed = 0;
    for (const tc of myCases) {
      if (lastResultByCase.get(tc.id) === TestResult.FAILED) failed++;
    }

    return { totalTests: total, failedTests: failed };
  }, [functionalityId, testCases, testRuns]);

  return (
    <div className="rounded-xl qa-story-surface px-3 py-2 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div data-swapy-handle className="cursor-grab text-slate-400 hover:text-slate-600">
            <DragOutlined />
          </div>
          <div className="min-w-0 w-full">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700">{functionality?.id}</span>
                  {functionality?.module && (
                    <Tag className="m-0 text-[10px]">{functionality.module}</Tag>
                  )}
                </div>
                <div
                  className="text-sm font-semibold text-slate-800 truncate"
                  title={functionality?.name}
                >
                  {functionality?.name}
                </div>
              </div>
              {status && (
                <span
                  className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black"
                  style={statusStyle}
                >
                  {labelTestStatus(status, t)}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {functionality?.priority && (
                <Tag className="m-0 text-[10px]">
                  {t('functionality.priority')}: {labelPriority(functionality.priority, t)}
                </Tag>
              )}
              {functionality?.riskLevel && (
                <Tag className="m-0 text-[10px]">
                  {t('functionality.risk')}: {labelRisk(functionality.riskLevel, t)}
                </Tag>
              )}
            </div>

            {totalTests > 0 && (
              <div className="mt-2 text-[11px] text-slate-600 font-semibold">
                <span>
                  {t('functionality.tests')}: {totalTests} |{' '}
                </span>
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: qaPalette.functionalityStatus.failed }}
                >
                  <CloseCircleFilled />
                  <span>{failedTests}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        {onUnassign && (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={e => {
              e.stopPropagation();
              onUnassign();
            }}
          />
        )}
      </div>
    </div>
  );
}
