export const PROJECT_CREATION_ROLE_MESSAGE =
  'Solo Owner y QA Lead pueden crear proyectos nuevos.';
export const DEFAULT_STARTER_PROJECT_LIMIT = 4;
export const DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD = 5;

export type OrganizationPlan = 'starter' | 'growth' | 'enterprise';

type ProjectUpgradeMessageInput = {
  organizationName?: string;
  currentCount: number;
  limit: number;
  upgradePriceMonthlyUsd: number;
};

function normalizeWhatsAppPhone(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeOrganizationPlan(plan?: string | null): OrganizationPlan {
  if (plan === 'growth' || plan === 'enterprise') {
    return plan;
  }

  return 'starter';
}

export function getProjectLimitForPlan(plan?: string | null) {
  return normalizeOrganizationPlan(plan) === 'starter' ? DEFAULT_STARTER_PROJECT_LIMIT : null;
}

export function getEffectiveProjectCount({
  currentCount,
  visibleProjectsCount,
}: {
  currentCount?: number | null;
  visibleProjectsCount?: number;
}) {
  return Math.max(currentCount ?? 0, visibleProjectsCount ?? 0);
}

export function hasReachedProjectLimit({
  limit,
  currentCount,
  visibleProjectsCount,
}: {
  limit?: number | null;
  currentCount?: number | null;
  visibleProjectsCount?: number;
}) {
  if (typeof limit !== 'number') {
    return false;
  }

  return getEffectiveProjectCount({ currentCount, visibleProjectsCount }) >= limit;
}

export function getProjectLimitReachedMessage({
  currentCount,
  limit,
  upgradePriceMonthlyUsd,
}: ProjectUpgradeMessageInput) {
  return `Tu organización alcanzó el límite de ${limit} proyectos del plan Starter (${currentCount}/${limit}). Actualiza a Pro por $${upgradePriceMonthlyUsd}/mes para seguir creando proyectos.`;
}

export function buildProjectUpgradeWhatsAppMessage({
  organizationName,
  limit,
  upgradePriceMonthlyUsd,
}: ProjectUpgradeMessageInput) {
  const organizationSegment = organizationName ? ` para ${organizationName}` : '';

  return `Hola, quiero actualizar${organizationSegment} en QA Tracker al plan Pro de $${upgradePriceMonthlyUsd}/mes. Ya alcancé el límite de ${limit} proyectos del plan Starter y necesito habilitar más proyectos.`;
}

export function buildProjectUpgradeWhatsAppUrl(input: ProjectUpgradeMessageInput) {
  const phone = normalizeWhatsAppPhone(import.meta.env.VITE_UPGRADE_WHATSAPP_PHONE);
  const message = encodeURIComponent(buildProjectUpgradeWhatsAppMessage(input));

  if (phone) {
    return `https://wa.me/${phone}?text=${message}`;
  }

  return `https://api.whatsapp.com/send?text=${message}`;
}
