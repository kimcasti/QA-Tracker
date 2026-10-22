import type { Functionality, TestCase } from '../types';
import { reportAutomationPortfolio, reportIdentityMap } from './reportAutomationMetrics';

/** One canonical portfolio and the exact cases used by each module's denominator. */
export function buildModuleAutomationCoverage(functionalities: Functionality[], testCases: TestCase[]) {
  const identities = reportIdentityMap(functionalities);
  const projectCases = testCases.filter(item => {
    const functionality = identities.get(item.functionalityId);
    return functionality && functionality.projectId === item.projectId;
  });
  const portfolio = reportAutomationPortfolio(functionalities, projectCases);
  const coverageByModule = new Map(portfolio.moduleCoverage.map(item => [item.name, item]));
  const casesByModule = new Map<string, TestCase[]>();
  portfolio.scopedTestCases.forEach(item => {
    const name = identities.get(item.functionalityId)!.module || 'Sin módulo';
    const cases = casesByModule.get(name) || [];
    cases.push(item);
    casesByModule.set(name, cases);
  });
  const modules = [...new Set(functionalities.map(item => item.module || 'Sin módulo'))].map(name => {
    const coverage = coverageByModule.get(name);
    return {
      name,
      totalCases: coverage?.totalCases ?? 0,
      automatedCases: coverage?.automatedCases ?? 0,
      coverage: coverage?.coverage ?? null,
      cases: casesByModule.get(name) || [],
    };
  });
  return { portfolio, modules };
}
