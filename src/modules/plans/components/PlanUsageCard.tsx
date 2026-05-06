import { Alert, Card, Progress, Skeleton, Space, Tag, Typography } from 'antd';
import { qaPalette, softBorder, softSurface } from '../../../theme/palette';

const { Text, Title } = Typography;

export type PlanUsageMetric = {
  key: string;
  label: string;
  current: number;
  limit: number | null;
};

type PlanUsageCardProps = {
  planLabel: string;
  metrics: PlanUsageMetric[];
  loading?: boolean;
  className?: string;
};

type UsageTone = 'normal' | 'warning' | 'danger';

function getUsagePercent(metric: PlanUsageMetric) {
  if (metric.limit === null || metric.limit <= 0) {
    return 0;
  }

  return Math.min((metric.current / metric.limit) * 100, 100);
}

function getUsageTone(percent: number): UsageTone {
  if (percent >= 100) return 'danger';
  if (percent >= 70) return 'warning';
  return 'normal';
}

function getToneColor(tone: UsageTone) {
  if (tone === 'danger') return qaPalette.functionalityStatus.failed;
  if (tone === 'warning') return qaPalette.functionalityStatus.inProgress;
  return qaPalette.functionalityStatus.completed;
}

function getOverLimit(metric: PlanUsageMetric) {
  if (metric.limit === null) return 0;
  return Math.max(metric.current - metric.limit, 0);
}

function buildWarningMessage(metric: PlanUsageMetric, percent: number) {
  if (metric.limit === null) return null;

  const remaining = Math.max(metric.limit - metric.current, 0);
  const labels: Record<string, { singular: string; plural: string }> = {
    projects: { singular: 'proyecto', plural: 'proyectos' },
    users: { singular: 'usuario', plural: 'usuarios' },
    features: { singular: 'funcionalidad', plural: 'funcionalidades' },
    testCases: { singular: 'caso de prueba', plural: 'casos de prueba' },
  };

  const noun = labels[metric.key] || { singular: 'elemento', plural: 'elementos' };
  const overLimit = getOverLimit(metric);

  if (metric.key === 'projects' && overLimit > 0) {
    return `Has usado ${metric.current} de ${metric.limit} proyectos disponibles en Starter.`;
  }

  if (remaining === 0) {
    return `Ya alcanzaste el limite de ${noun.plural} de tu plan.`;
  }

  if (remaining === 1) {
    return `Te queda 1 ${noun.singular} disponible en ${metric.label}.`;
  }

  if (percent >= 80) {
    return `Estas cerca del limite de ${metric.label.toLowerCase()}.`;
  }

  return null;
}

export function PlanUsageCard({
  planLabel,
  metrics,
  loading = false,
  className = '',
}: PlanUsageCardProps) {
  const projectMetric = metrics.find(metric => metric.key === 'projects');
  const projectsOverLimit = projectMetric ? getOverLimit(projectMetric) : 0;
  const warnings = metrics
    .map(metric => {
      const percent = getUsagePercent(metric);
      return {
        key: metric.key,
        tone: getUsageTone(percent),
        message: buildWarningMessage(metric, percent),
      };
    })
    .filter(item => Boolean(item.message) && item.tone !== 'normal');

  return (
    <Card
      variant="borderless"
      className={`qa-surface-card rounded-[28px] ${className}`.trim()}
      styles={{ body: { padding: 16 } }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Plan actual
            </Text>
            <div className="mt-1 flex items-center gap-3">
              <Title level={4} className="!mb-0 !text-slate-900">
                {projectsOverLimit > 0
                  ? 'Has alcanzado el limite de tu plan'
                  : `Consumo del plan ${planLabel}`}
              </Title>
              <Tag
                variant="filled"
                className="rounded-full px-3 py-1 font-semibold"
                style={{
                  color: qaPalette.primary,
                  backgroundColor: softSurface(qaPalette.primary),
                }}
              >
                {planLabel}
              </Tag>
            </div>
            <Text className="mt-1 block text-sm text-slate-500">
              {projectMetric?.limit !== null && projectsOverLimit > 0
                ? `Has usado ${projectMetric?.current} de ${projectMetric?.limit} proyectos disponibles en Starter.`
                : 'Monitorea el uso actual antes de llegar al limite del plan.'}
            </Text>
          </div>
        </div>

        {warnings.length > 0 ? (
          <div className="flex flex-col gap-3">
            {warnings.slice(0, 2).map(item => (
              <Alert
                key={item.key}
                showIcon
                type={item.tone === 'danger' ? 'error' : 'warning'}
                message={item.message}
                className="rounded-2xl"
              />
            ))}
          </div>
        ) : null}

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(metric => {
              const percent = getUsagePercent(metric);
              const tone = getUsageTone(percent);
              const toneColor = getToneColor(tone);
              const isUnlimited = metric.limit === null;
              const overLimit = getOverLimit(metric);
              const isProjectsMetric = metric.key === 'projects';
              const remaining = Math.max((metric.limit || 0) - metric.current, 0);

              return (
                <div
                  key={metric.key}
                  className="rounded-[22px] border p-3.5"
                  style={{
                    borderColor: softBorder(toneColor),
                    background: `linear-gradient(135deg, ${qaPalette.card} 0%, ${softSurface(toneColor)} 100%)`,
                  }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Text className="text-sm font-semibold text-slate-700">{metric.label}</Text>
                        <div className="mt-2">
                          <Title level={4} className="!mb-0 !text-slate-900">
                            {isUnlimited
                              ? `${metric.current} usados`
                              : `${metric.current} / ${metric.limit} ${isProjectsMetric ? 'proyectos usados' : 'usados'}`}
                          </Title>
                        </div>
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
                          ? 'Sin limite'
                          : percent >= 100
                            ? 'Limite alcanzado'
                            : percent >= 70
                              ? 'Cerca del limite'
                              : 'Disponible'}
                      </Tag>
                    </div>

                    <Progress
                      percent={isUnlimited ? 100 : percent}
                      showInfo={false}
                      strokeColor={toneColor}
                      railColor={softSurface(qaPalette.border)}
                    />

                    <Space size={[8, 8]} wrap>
                      <Text className="text-xs text-slate-500">
                        {isUnlimited
                          ? 'Este plan no tiene limite visible para esta metrica.'
                          : isProjectsMetric && overLimit > 0
                            ? `${overLimit} proyecto${overLimit === 1 ? '' : 's'} por encima del limite`
                            : `${remaining} disponibles`}
                      </Text>
                    </Space>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
