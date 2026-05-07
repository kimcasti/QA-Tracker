import type {
  Project,
  ProjectServiceBillingItem,
  ProjectServiceBillingMode,
  ProjectServiceBillingPhase,
  ProjectServiceBillingSupportReport,
} from '../../../types';

export const BILLING_MODE_OPTIONS: Array<{ label: string; value: ProjectServiceBillingMode }> = [
  { label: 'Mensual', value: 'monthly' },
  { label: 'Total fase', value: 'phase_total' },
  { label: 'Pago unico', value: 'one_time' },
];

export function createPhaseId() {
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createServiceId() {
  return `service-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCurrencyValue(value: unknown) {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : undefined;
}

export function normalizeServiceBillingItem(
  value?: Partial<ProjectServiceBillingItem> | null,
): ProjectServiceBillingItem {
  const supportReportValue = value?.supportReport as ProjectServiceBillingSupportReport | undefined;
  const supportReport = {
    title: String(supportReportValue?.title || '').trim() || undefined,
    summary: String(supportReportValue?.summary || '').trim() || undefined,
    referenceUrl: String(supportReportValue?.referenceUrl || '').trim() || undefined,
  };

  return {
    id: String(value?.id || createServiceId()),
    serviceName: String(value?.serviceName || '').trim(),
    relatedProcesses: Array.isArray(value?.relatedProcesses)
      ? value.relatedProcesses.map(item => String(item || '').trim()).filter(Boolean)
      : [],
    billingMode:
      value?.billingMode === 'phase_total' || value?.billingMode === 'one_time'
        ? value.billingMode
        : 'monthly',
    monthlyCost: normalizeCurrencyValue(value?.monthlyCost),
    totalCost: normalizeCurrencyValue(value?.totalCost),
    supportReport:
      supportReport.title || supportReport.summary || supportReport.referenceUrl
        ? supportReport
        : undefined,
  };
}

export function normalizeServiceBillingPhase(
  value?: Partial<ProjectServiceBillingPhase> | null,
): ProjectServiceBillingPhase {
  return {
    id: String(value?.id || createPhaseId()),
    phaseName: String(value?.phaseName || '').trim(),
    description: String(value?.description || '').trim() || undefined,
    services: Array.isArray(value?.services)
      ? value.services
          .map(item => normalizeServiceBillingItem(item))
          .filter(
            item =>
              item.serviceName ||
              item.relatedProcesses.length ||
              item.monthlyCost ||
              item.totalCost,
          )
      : [],
  };
}

export function normalizeProjectServiceBillingPhases(value?: Project['serviceBillingPhases']) {
  return Array.isArray(value)
    ? value
        .map(item => normalizeServiceBillingPhase(item))
        .filter(phase => phase.phaseName || phase.description || phase.services.length > 0)
    : [];
}

export function summarizeServiceBillingPhases(phases?: ProjectServiceBillingPhase[]) {
  const normalizedPhases = normalizeProjectServiceBillingPhases(phases);

  return normalizedPhases.reduce(
    (summary, phase) => {
      summary.phaseCount += 1;
      summary.serviceCount += phase.services.length;
      summary.monthlyCost += phase.services.reduce(
        (total, service) => total + (service.monthlyCost || 0),
        0,
      );
      summary.totalCost += phase.services.reduce(
        (total, service) => total + (service.totalCost || 0),
        0,
      );
      return summary;
    },
    {
      phaseCount: 0,
      serviceCount: 0,
      monthlyCost: 0,
      totalCost: 0,
    },
  );
}

export function formatCurrency(value?: number, currency = 'USD') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '$0';

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
