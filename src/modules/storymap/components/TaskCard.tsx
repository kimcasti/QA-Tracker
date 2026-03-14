import { Button, Tag, Typography } from 'antd';
import { CloseCircleFilled, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTestCases, useTestRuns } from '../../../hooks';
import { ExecutionStatus, TestResult, type Functionality, TestStatus } from '../../../types';
import { labelPriority, labelRisk, labelTestStatus } from '../../../i18n/labels';

const { Text } = Typography;

export function TaskCard({
  projectId,
  functionality,
  isPlaceholder,
  onUnassign,
}: {
  projectId?: string;
  functionality?: Functionality;
  isPlaceholder?: boolean;
  onUnassign?: () => void;
}) {
  const { t } = useTranslation();
  if (isPlaceholder) {
    return (
      <div
        data-swapy-no-drag
        className="rounded-xl bg-slate-50 border border-dashed border-slate-200 px-3 py-2 shadow-sm"
      >
        <Text type="secondary" className="text-xs">{t('storymap.drop_here')}</Text>
      </div>
    );
  }

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
        return { bg: 'bg-slate-200', text: 'text-slate-700' };
      case TestStatus.MVP:
        return { bg: 'bg-indigo-200', text: 'text-indigo-900' };
      case TestStatus.POST_MVP:
        return { bg: 'bg-purple-200', text: 'text-purple-800' };
      case TestStatus.IN_PROGRESS:
        return { bg: 'bg-yellow-200', text: 'text-yellow-900' };
      case TestStatus.COMPLETED:
        return { bg: 'bg-emerald-200', text: 'text-emerald-900' };
      case TestStatus.FAILED:
        return { bg: 'bg-rose-200', text: 'text-rose-900' };
      default:
        return { bg: 'bg-slate-200', text: 'text-slate-700' };
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
    <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 shadow-sm hover:shadow transition-shadow">
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
                  {functionality?.module && <Tag className="m-0 text-[10px]">{functionality.module}</Tag>}
                </div>
                <div className="text-sm font-semibold text-slate-800 truncate" title={functionality?.name}>
                  {functionality?.name}
                </div>
              </div>
              {status && (
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${statusStyle.bg} ${statusStyle.text}`}>
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
                <span>{t('functionality.tests')}: {totalTests} | </span>
                <span className="text-rose-600 inline-flex items-center gap-1">
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
            onClick={(e) => {
              e.stopPropagation();
              onUnassign();
            }}
          />
        )}
      </div>
    </div>
  );
}
