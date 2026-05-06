import { Card, Progress, Tag, Typography } from 'antd';
import { buildProjectUpgradeWhatsAppUrl } from '../../projects/utils/projectUpgrade';
import { qaPalette, softBorder, softSurface } from '../../../theme/palette';

const { Text, Title } = Typography;

type ExportUsageCardProps = {
  organizationName?: string;
  contractedPlan: 'starter' | 'growth' | 'enterprise';
  effectivePlan: 'starter' | 'growth' | 'enterprise';
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
  onUpgradeClick?: () => void | Promise<void>;
  onViewPlansClick?: () => void | Promise<void>;
};

function getUsagePercent(used: number, limit?: number | null) {
  if (typeof limit !== 'number' || limit <= 0) {
    return 0;
  }

  return Math.min((used / limit) * 100, 100);
}

export function ExportUsageCard({
  organizationName,
  contractedPlan,
  effectivePlan,
  exportUsage,
  upgradePriceMonthlyUsd = 5,
  onUpgradeClick,
  onViewPlansClick,
}: ExportUsageCardProps) {
  const used = Math.max(0, exportUsage?.usedThisMonth ?? 0);
  const limit = exportUsage?.limit ?? null;
  const remaining = exportUsage?.remaining ?? null;
  const isUnlimited = Boolean(exportUsage?.unlimited) || effectivePlan === 'enterprise';
  const percent = getUsagePercent(used, limit);
  const isNearLimit = Boolean(exportUsage?.nearLimit) && !exportUsage?.reachedLimit;
  const hasReachedLimit = Boolean(exportUsage?.reachedLimit);
  const toneColor = hasReachedLimit
    ? qaPalette.functionalityStatus.failed
    : isNearLimit
      ? qaPalette.functionalityStatus.inProgress
      : qaPalette.functionalityStatus.completed;
  const upgradeUrl = buildProjectUpgradeWhatsAppUrl({
    organizationName,
    currentCount: typeof limit === 'number' ? Math.max(used, limit) : used,
    limit: typeof limit === 'number' ? limit : 0,
    upgradePriceMonthlyUsd,
  });

  return (
    <Card
      variant="borderless"
      className="qa-surface-card rounded-[28px]"
      styles={{ body: { padding: 20 } }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Exportaciones
            </Text>
            <Title level={4} className="!mb-0 !mt-1 !text-slate-900">
              {isUnlimited
                ? 'Exportaciones amplias disponibles'
                : `Has usado ${used} / ${limit ?? 0} exportaciones este mes`}
            </Title>
          </div>
          <Tag
            variant="filled"
            className="rounded-full px-3 py-1 font-semibold"
            style={{
              color: toneColor,
              backgroundColor: softSurface(toneColor),
            }}
          >
            {isUnlimited
              ? 'Enterprise'
              : hasReachedLimit
                ? 'Limite alcanzado'
                : isNearLimit
                  ? 'Cerca del limite'
                  : 'Disponible'}
          </Tag>
        </div>

        {!isUnlimited ? (
          <div
            className="rounded-[22px] border p-4"
            style={{
              borderColor: softBorder(toneColor),
              background: `linear-gradient(135deg, ${qaPalette.card} 0%, ${softSurface(toneColor)} 100%)`,
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Title level={3} className="!mb-0 !text-slate-900">
                    {used}
                    <Text className="ml-1 text-lg font-medium text-slate-400">/ {limit ?? 0}</Text>
                  </Title>
                  <Text className="text-sm text-slate-500">
                    {remaining === 1
                      ? 'Te queda 1 exportacion disponible.'
                      : typeof remaining === 'number'
                        ? `Te quedan ${remaining} exportaciones disponibles.`
                        : 'Cupo mensual de exportaciones del plan actual.'}
                  </Text>
                </div>
                <Text className="text-sm font-semibold" style={{ color: toneColor }}>
                  {Math.round(percent)}%
                </Text>
              </div>

              <Progress
                percent={percent}
                showInfo={false}
                strokeColor={toneColor}
                railColor={softSurface(qaPalette.border)}
              />
            </div>
          </div>
        ) : (
          <div
            className="rounded-[22px] border p-4"
            style={{
              borderColor: softBorder(qaPalette.functionalityStatus.completed),
              background: `linear-gradient(135deg, ${qaPalette.card} 0%, ${softSurface(qaPalette.functionalityStatus.completed)} 100%)`,
            }}
          >
            <Text className="text-sm leading-6 text-slate-600">
              Tu organizacion cuenta con una capacidad amplia de exportaciones para operar sin
              interrupciones visibles durante el mes.
            </Text>
          </div>
        )}

        {hasReachedLimit ? (
          <div className="flex flex-col gap-2">
            <a
              href={onUpgradeClick ? undefined : upgradeUrl}
              target={onUpgradeClick ? undefined : '_blank'}
              rel={onUpgradeClick ? undefined : 'noreferrer'}
              onClick={onUpgradeClick}
              className="rounded-full bg-[#123F68] px-4 py-2 text-center text-sm font-semibold text-white no-underline transition hover:bg-[#0F3558]"
            >
              Actualizar a Growth
            </a>
            {onViewPlansClick ? (
              <button
                type="button"
                onClick={onViewPlansClick}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver planes
              </button>
            ) : null}
          </div>
        ) : null}

        {contractedPlan !== effectivePlan ? (
          <Text className="text-xs font-medium text-slate-500">
            Tu plan contratado es {contractedPlan}, pero actualmente se aplica {effectivePlan}.
          </Text>
        ) : null}
      </div>
    </Card>
  );
}
