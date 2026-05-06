import { Button, Typography } from 'antd';
import { AIUsageCard } from './AIUsageCard';
import { ExportUsageCard } from './ExportUsageCard';
import { PlanBillingBanner } from './PlanBillingBanner';
import { PlanUsageCard, type PlanUsageMetric } from './PlanUsageCard';

const { Text, Title } = Typography;

type OrganizationPlan = 'starter' | 'growth' | 'enterprise';

type PlanCenterSectionProps = {
  title?: string;
  description?: string;
  planLabel?: string;
  metrics?: PlanUsageMetric[];
  metricsLoading?: boolean;
  organizationName?: string;
  contractedPlan: OrganizationPlan;
  effectivePlan: OrganizationPlan;
  billing?: {
    planStatus: 'active' | 'past_due' | 'canceled';
    planExpiresAt: string | null;
    gracePeriodEndsAt: string | null;
    inGracePeriod?: boolean;
    downgradedToStarter?: boolean;
  };
  aiUsage?: {
    usedThisMonth: number;
    limit?: number | null;
    remaining?: number | null;
    unlimited?: boolean;
    canUse?: boolean;
    nearLimit?: boolean;
    reachedLimit?: boolean;
  };
  exportUsage?: {
    usedThisMonth: number;
    limit?: number | null;
    remaining?: number | null;
    unlimited?: boolean;
    canUse?: boolean;
    nearLimit?: boolean;
    reachedLimit?: boolean;
  };
  upgradePriceMonthlyUsd?: number;
  onViewPlans?: () => void;
  onUpgradeAi?: () => void | Promise<void>;
  onUpgradeExport?: () => void | Promise<void>;
  onRenewPlan?: () => void | Promise<void>;
};

export function PlanCenterSection({
  title = 'Plan Center',
  description = 'Sigue de cerca el uso, el estado del plan y los siguientes pasos para crecer sin interrumpir la operación.',
  planLabel,
  metrics,
  metricsLoading = false,
  organizationName,
  contractedPlan,
  effectivePlan,
  billing,
  aiUsage,
  exportUsage,
  upgradePriceMonthlyUsd = 5,
  onViewPlans,
  onUpgradeAi,
  onUpgradeExport,
  onRenewPlan,
}: PlanCenterSectionProps) {
  const hideViewPlansButton = billing?.planStatus === 'past_due' && Boolean(billing?.inGracePeriod);

  return (
    <section className="space-y-4 rounded-[32px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.86)_0%,rgba(255,255,255,0.96)_100%)] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Crecimiento SaaS
          </Text>
          <Title level={3} className="!mb-1 !mt-2 !text-slate-900">
            {title}
          </Title>
          <Text className="text-sm leading-6 text-slate-500">{description}</Text>
        </div>

        {onViewPlans && !hideViewPlansButton ? (
          <Button className="rounded-2xl px-5 font-semibold" onClick={onViewPlans}>
            Ver comparativa de planes
          </Button>
        ) : null}
      </div>

      <PlanBillingBanner
        organizationName={organizationName}
        contractedPlan={contractedPlan}
        effectivePlan={effectivePlan}
        billing={billing}
        upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
        onRenewClick={onRenewPlan}
      />

      {metrics && planLabel ? (
        <PlanUsageCard planLabel={planLabel} metrics={metrics} loading={metricsLoading} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <AIUsageCard
          organizationName={organizationName}
          contractedPlan={contractedPlan}
          effectivePlan={effectivePlan}
          aiUsage={aiUsage}
          upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
          onUpgradeClick={onUpgradeAi}
          onViewPlansClick={onViewPlans}
        />

        <ExportUsageCard
          organizationName={organizationName}
          contractedPlan={contractedPlan}
          effectivePlan={effectivePlan}
          exportUsage={exportUsage}
          upgradePriceMonthlyUsd={upgradePriceMonthlyUsd}
          onUpgradeClick={onUpgradeExport}
          onViewPlansClick={onViewPlans}
        />
      </div>
    </section>
  );
}
