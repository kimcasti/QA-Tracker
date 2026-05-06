import {
  ArrowRightOutlined,
  CheckCircleFilled,
  CrownOutlined,
  LineChartOutlined,
  MessageOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Button, Modal, Tag, Typography } from 'antd';
import { qaPalette, softSurface } from '../../../theme/palette';

const { Text, Title, Paragraph } = Typography;

type UpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  organizationName?: string;
  currentPlan: 'starter' | 'growth' | 'enterprise';
  title?: string;
  description?: string;
  growthPriceLabel?: string;
  onUpgradeGrowth?: () => void | Promise<void>;
  onContactEnterprise?: () => void | Promise<void>;
};

const planCards = [
  {
    key: 'starter',
    name: 'Starter',
    badge: 'Empieza gratis',
    icon: <LineChartOutlined style={{ color: qaPalette.primary, fontSize: 18 }} />,
    points: [
      '1 organización y hasta 3 proyectos',
      'Hasta 5 usuarios',
      'Reportes base y exportaciones limitadas',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    badge: 'Recomendado',
    icon: <RocketOutlined style={{ color: '#6D5EF9', fontSize: 18 }} />,
    points: [
      'Hasta 15 proyectos y 25 usuarios',
      'IA con cupo mensual y reportes avanzados',
      'Más capacidad para crecer sin interrupciones',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    badge: 'A medida',
    icon: <CrownOutlined style={{ color: '#D97706', fontSize: 18 }} />,
    points: [
      'Límites personalizados',
      'Mayor capacidad de IA y soporte premium',
      'Configuración guiada para equipos grandes',
    ],
  },
] as const;

function formatPlanLabel(plan: 'starter' | 'growth' | 'enterprise') {
  if (plan === 'growth') return 'Growth';
  if (plan === 'enterprise') return 'Enterprise';
  return 'Starter';
}

export function UpgradeModal({
  open,
  onClose,
  organizationName,
  currentPlan,
  title = 'Elige cómo quieres seguir creciendo',
  description = 'Compara planes, revisa qué desbloqueas y continúa por WhatsApp cuando quieras activar Growth o hablar sobre Enterprise.',
  growthPriceLabel = '24.900 COP / mes',
  onUpgradeGrowth,
  onContactEnterprise,
}: UpgradeModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={980}
      destroyOnHidden
      title={null}
    >
      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(109,94,249,0.08)_0%,rgba(255,255,255,1)_48%,rgba(23,182,211,0.08)_100%)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <Tag
                bordered={false}
                className="m-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#6D5EF9]"
                style={{ backgroundColor: 'rgba(109,94,249,0.12)' }}
              >
                Planes QA Tracker
              </Tag>
              <Title level={3} className="!mb-2 !mt-4 !text-slate-950">
                {title}
              </Title>
              <Paragraph className="!mb-0 max-w-2xl text-sm leading-7 text-slate-600">
                {description}
              </Paragraph>
            </div>

            <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
              <Text className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Organización
              </Text>
              <Title level={5} className="!mb-0 !mt-2 !text-slate-900">
                {organizationName || 'Tu organización'}
              </Title>
              <Text className="mt-2 block text-sm text-slate-500">
                Plan actual: {formatPlanLabel(currentPlan)}
              </Text>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {planCards.map(plan => {
            const isCurrent = currentPlan === plan.key;
            const isGrowth = plan.key === 'growth';
            const isEnterprise = plan.key === 'enterprise';

            return (
              <div
                key={plan.key}
                className={`rounded-[28px] border p-5 shadow-[0_16px_34px_rgba(16,42,67,0.05)] ${
                  isGrowth
                    ? 'border-[rgba(109,94,249,0.22)] bg-[linear-gradient(180deg,rgba(109,94,249,0.08)_0%,rgba(255,255,255,1)_36%)]'
                    : 'border-slate-200/80 bg-white'
                }`}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <Tag
                      bordered={false}
                      className="m-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
                      style={{
                        color: isGrowth ? '#6D5EF9' : isEnterprise ? '#B45309' : qaPalette.primary,
                        backgroundColor: isGrowth
                          ? 'rgba(109,94,249,0.10)'
                          : isEnterprise
                            ? 'rgba(217,119,6,0.10)'
                            : softSurface(qaPalette.primary),
                      }}
                    >
                      {plan.badge}
                    </Tag>
                    <Title level={4} className="!mb-0 !mt-4 !text-slate-900">
                      {plan.name}
                    </Title>
                    <Text
                      className="mt-1 block text-lg font-semibold"
                      style={{
                        color: isGrowth ? '#6D5EF9' : isEnterprise ? '#B45309' : qaPalette.primary,
                      }}
                    >
                      {plan.key === 'starter'
                        ? 'Gratis'
                        : isGrowth
                          ? growthPriceLabel
                          : 'A medida'}
                    </Text>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
                    {plan.icon}
                  </div>
                </div>

                <div className="grid gap-3">
                  {plan.points.map(point => (
                    <div key={point} className="flex items-start gap-2.5">
                      <CheckCircleFilled className="mt-0.5 text-[14px] text-emerald-500" />
                      <Text className="text-sm leading-6 text-slate-600">{point}</Text>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-3">
                  {isCurrent ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <Text className="text-sm font-semibold text-slate-700">
                        Este es tu plan actual
                      </Text>
                    </div>
                  ) : isGrowth ? (
                    <Button
                      type="primary"
                      icon={<MessageOutlined />}
                      onClick={onUpgradeGrowth}
                      className="h-11 w-full rounded-2xl font-semibold"
                      style={{
                        background: 'linear-gradient(135deg, #123F68 0%, #1DA9CF 100%)',
                        border: 'none',
                      }}
                    >
                      Actualizar a Growth
                    </Button>
                  ) : isEnterprise ? (
                    <Button
                      icon={<SafetyCertificateOutlined />}
                      onClick={onContactEnterprise}
                      className="h-11 w-full rounded-2xl font-semibold"
                    >
                      Hablar sobre Enterprise
                    </Button>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <Text className="text-sm text-slate-600">
                        Ideal para empezar, validar flujo y organizar tu operación inicial.
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-5">
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Cómo funciona el upgrade
            </Text>
            <div className="mt-4 grid gap-3">
              {[
                'Eliges Growth o nos escribes por Enterprise.',
                'Se abre WhatsApp con el contexto de tu organización.',
                'Confirmamos el pago.',
                'Superadmin activa el plan y se desbloquea la capacidad.',
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-slate-700 shadow-sm">
                    {index + 1}
                  </div>
                  <Text className="text-sm leading-6 text-slate-600">{item}</Text>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-[rgba(18,63,104,0.12)] bg-white p-5 shadow-sm">
            <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Siguiente paso recomendado
            </Text>
            <Title level={4} className="!mb-2 !mt-4 !text-slate-900">
              Sigue creciendo sin interrupciones
            </Title>
            <Paragraph className="!mb-4 text-sm leading-7 text-slate-600">
              Si ya llegaste a un límite o quieres activar IA y reportes avanzados, Growth suele ser
              el paso natural para esta etapa.
            </Paragraph>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={onUpgradeGrowth}
              className="h-11 w-full rounded-2xl font-semibold"
              style={{
                background: 'linear-gradient(135deg, #123F68 0%, #1DA9CF 100%)',
                border: 'none',
              }}
            >
              Continuar con Growth
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
