export const PROJECT_CREATION_ROLE_MESSAGE =
  'Solo Owner y QA Lead pueden crear proyectos nuevos.';
export const DEFAULT_PRO_PLAN_PRICE_MONTHLY_USD = 5;

export type OrganizationPlan = 'starter' | 'growth' | 'enterprise';

type ProjectUpgradeMessageInput = {
  organizationName?: string;
  currentCount: number;
  limit: number;
  upgradePriceMonthlyUsd: number;
  messageVariant?: 'project-capacity' | 'ai-access';
};

function normalizeWhatsAppPhone(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

function buildUrlWithContext(baseUrl: string, input: ProjectUpgradeMessageInput) {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('organization', input.organizationName || '');
    url.searchParams.set('currentCount', String(input.currentCount));
    url.searchParams.set('limit', String(input.limit));
    url.searchParams.set('plan', 'growth');
    url.searchParams.set('priceMonthlyUsd', String(input.upgradePriceMonthlyUsd));
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export function normalizeOrganizationPlan(plan?: string | null): OrganizationPlan {
  if (plan === 'growth' || plan === 'enterprise') {
    return plan;
  }

  return 'starter';
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
  return `Tu organización alcanzó el límite de ${limit} proyectos del plan Starter (${currentCount}/${limit}). Actualiza a Growth por $${upgradePriceMonthlyUsd}/mes para seguir creando proyectos.`;
}

export function buildProjectUpgradeWhatsAppMessage({
  organizationName,
  limit,
  upgradePriceMonthlyUsd,
  messageVariant = 'project-capacity',
}: ProjectUpgradeMessageInput) {
  const organizationSegment = organizationName ? ` para ${organizationName}` : '';

  if (messageVariant === 'ai-access') {
    return `Hola, quiero activar Growth${organizationSegment} en QA Tracker porque deseo usar las funciones de IA dentro de la app. Me interesa desbloquear sugerencias, generación de casos y otras capacidades de IA disponibles en Growth.`;
  }

  return `Hola, quiero actualizar${organizationSegment} en QA Tracker al plan Growth de $${upgradePriceMonthlyUsd}/mes. Ya alcancé el límite de ${limit} proyectos del plan Starter y necesito habilitar más proyectos.`;
}

export function buildProjectUpgradeUrl(input: ProjectUpgradeMessageInput) {
  const configuredUrl =
    import.meta.env.VITE_UPGRADE_CONTACT_URL || import.meta.env.VITE_RENEW_PLAN_URL;

  if (configuredUrl) {
    return buildUrlWithContext(configuredUrl, input);
  }

  const phone = normalizeWhatsAppPhone(import.meta.env.VITE_UPGRADE_WHATSAPP_PHONE);
  const message = encodeURIComponent(buildProjectUpgradeWhatsAppMessage(input));

  if (phone) {
    return `https://wa.me/${phone}?text=${message}`;
  }

  return `https://api.whatsapp.com/send?text=${message}`;
}

export function buildProjectUpgradeWhatsAppUrl(input: ProjectUpgradeMessageInput) {
  return buildProjectUpgradeUrl(input);
}
