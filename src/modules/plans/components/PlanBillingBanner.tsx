import { CalendarOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Typography } from 'antd';
import dayjs from 'dayjs';
import { buildProjectUpgradeWhatsAppUrl } from '../../projects/utils/projectUpgrade';
import { qaPalette, softSurface } from '../../../theme/palette';

const { Paragraph, Text, Title } = Typography;

type PlanBillingBannerProps = {
  organizationName?: string;
  contractedPlan: 'starter' | 'growth' | 'enterprise';
  effectivePlan: 'starter' | 'growth' | 'enterprise';
  billing?: {
    planStatus: 'active' | 'past_due' | 'canceled';
    planExpiresAt: string | null;
    gracePeriodEndsAt: string | null;
    inGracePeriod?: boolean;
    downgradedToStarter?: boolean;
  };
  upgradePriceMonthlyUsd?: number;
  onRenewClick?: () => void | Promise<void>;
};

function formatDate(value?: string | null) {
  if (!value) return null;
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return parsed.format('DD/MM/YYYY');
}

function formatPlanLabel(plan: 'starter' | 'growth' | 'enterprise') {
  if (plan === 'growth') return 'Growth';
  if (plan === 'enterprise') return 'Enterprise';
  return 'Starter';
}

export function PlanBillingBanner({
  organizationName,
  contractedPlan,
  effectivePlan,
  billing,
  upgradePriceMonthlyUsd = 5,
  onRenewClick,
}: PlanBillingBannerProps) {
  if (!billing) return null;

  const graceEndsAtLabel = formatDate(billing.gracePeriodEndsAt);
  const planExpiresAtLabel = formatDate(billing.planExpiresAt);
  const hasGracePeriod = Boolean(billing.inGracePeriod);
  const wasDowngradedToStarter = Boolean(billing.downgradedToStarter);
  const contactUrl = buildProjectUpgradeWhatsAppUrl({
    organizationName,
    currentCount: 0,
    limit: 0,
    upgradePriceMonthlyUsd,
  });

  if (billing.planStatus === 'past_due' && hasGracePeriod) {
    return (
      <div
        className="overflow-hidden rounded-[28px] border p-5 sm:p-6"
        style={{
          borderColor: '#F7C66A',
          background: `
            radial-gradient(circle at 12% 30%, rgba(250, 204, 21, 0.18) 0%, transparent 18%),
            radial-gradient(circle at 48% 50%, rgba(250, 204, 21, 0.10) 0%, transparent 28%),
            linear-gradient(135deg, rgba(255,249,235,0.96) 0%, rgba(255,255,255,1) 42%, rgba(255,250,240,0.98) 100%)
          `,
          boxShadow: '0 18px 42px rgba(217, 119, 6, 0.10)',
        }}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:gap-6">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full sm:h-20 sm:w-20"
              style={{ backgroundColor: softSurface('#F59E0B') }}
            >
              <ExclamationCircleOutlined style={{ fontSize: 36, color: '#F59E0B' }} />
            </div>

            <div className="space-y-2">
              <Title level={3} className="!mb-0 !text-slate-900">
                Pago pendiente ({formatPlanLabel(contractedPlan)})
              </Title>
              <Paragraph className="!mb-0 text-[15px] leading-7 text-slate-600">
                Tu plan sigue activo
                {graceEndsAtLabel ? ` hasta el ${graceEndsAtLabel}` : ' durante el periodo de gracia'}.
              </Paragraph>

              <div className="flex items-start gap-3 pt-1">
                <CalendarOutlined
                  className="mt-1 text-base"
                  style={{ color: qaPalette.functionalityStatus.inProgress }}
                />
                <Text className="text-sm leading-7 text-slate-500">
                  Si renuevas antes de esa fecha, tu equipo puede seguir creciendo sin
                  interrupciones.
                </Text>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center lg:justify-end">
            <Button
              type="primary"
              href={onRenewClick ? undefined : contactUrl}
              target={onRenewClick ? undefined : '_blank'}
              rel={onRenewClick ? undefined : 'noreferrer'}
              onClick={onRenewClick}
              className="h-12 rounded-2xl px-8 text-base font-semibold shadow-[0_12px_24px_rgba(18,63,104,0.18)]"
              style={{
                background: 'linear-gradient(135deg, #123F68 0%, #1DA9CF 100%)',
                border: 'none',
              }}
            >
              Renovar plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (wasDowngradedToStarter) {
    return (
      <Alert
        showIcon
        type="error"
        className="rounded-[24px]"
        message="Tu plan volvio a Starter."
        description={
          <div className="flex flex-col gap-3">
            <Text className="text-sm text-slate-600">
              Tus datos siguen seguros, pero algunas funciones avanzadas quedaron pausadas
              {planExpiresAtLabel ? ` desde ${planExpiresAtLabel}` : ''}.
            </Text>
            <Text className="text-sm text-slate-600">
              Plan contratado: {formatPlanLabel(contractedPlan)}. Plan aplicado:{" "}
              {formatPlanLabel(effectivePlan)}.
            </Text>
            <Text className="text-sm text-slate-600">
              Puedes seguir consultando tu informacion actual, pero algunas creaciones, la IA y los
              reportes avanzados dependen de reactivar el plan.
            </Text>
            <div>
              <Button
                type="primary"
                href={onRenewClick ? undefined : contactUrl}
                target={onRenewClick ? undefined : '_blank'}
                rel={onRenewClick ? undefined : 'noreferrer'}
                onClick={onRenewClick}
                className="rounded-full"
              >
                Reactivar Growth
              </Button>
            </div>
          </div>
        }
      />
    );
  }

  if (billing.planStatus === 'canceled' && effectivePlan === 'starter') {
    return (
      <Alert
        showIcon
        type="info"
        className="rounded-[24px]"
        message="Esta organizacion usa actualmente el plan Starter."
        description="Si deseas recuperar funciones avanzadas, puedes reactivar un plan de pago cuando lo necesites. Tus datos actuales se mantienen seguros."
      />
    );
  }

  return null;
}
