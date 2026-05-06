import {
  CheckCircleOutlined,
  CrownOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { qaPalette } from '../../../theme/palette';
import { buildProjectUpgradeUrl } from '../utils/projectUpgrade';

const { Text, Title } = Typography;

type ProjectUpgradeBoxProps = {
  organizationName?: string;
  currentCount: number;
  limit: number;
  upgradePriceMonthlyUsd: number;
  onUpgradeClick?: () => void | Promise<void>;
  onViewPlans?: () => void | Promise<void>;
  className?: string;
};

type FooterPoint = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

function FooterValuePoint({ title, description, icon }: FooterPoint) {
  return (
    <div className="flex items-start gap-3 px-2 py-1.5">
      <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-[0_10px_24px_rgba(16,42,67,0.06)]">
        {icon}
      </div>
      <div className="min-w-0">
        <Text className="block text-base font-semibold text-slate-900">{title}</Text>
        <Text className="text-sm leading-6 text-slate-500">{description}</Text>
      </div>
    </div>
  );
}

export function ProjectUpgradeBox({
  organizationName,
  currentCount,
  limit,
  upgradePriceMonthlyUsd,
  onUpgradeClick,
  onViewPlans,
  className = '',
}: ProjectUpgradeBoxProps) {
  const upgradeUrl = buildProjectUpgradeUrl({
    organizationName,
    currentCount,
    limit,
    upgradePriceMonthlyUsd,
  });
  const overLimit = Math.max(currentCount - limit, 0);

  const primaryBenefits = [
    {
      title: 'Mas proyectos sin bloqueo',
      description: 'Sigue creando sin frenar tu operacion QA.',
    },
    {
      title: 'Mas usuarios',
      description: 'Suma mas personas para operar con mejor ritmo.',
    },
    {
      title: 'IA y reportes',
      description: 'Activa automatizacion y reportes avanzados.',
    },
  ];

  const footerPoints: FooterPoint[] = [
    {
      title: 'Ahorra tiempo',
      description: 'Reduce bloqueos manuales al crecer tu portafolio QA.',
      icon: <RocketOutlined style={{ color: '#7C3AED', fontSize: 18 }} />,
    },
    {
      title: 'Mejora la cobertura',
      description: 'Escala mas escenarios y seguimiento sin perder orden.',
      icon: <CheckCircleOutlined style={{ color: '#7C3AED', fontSize: 18 }} />,
    },
    {
      title: 'Toma mejores decisiones',
      description: 'Combina IA y reportes para operar con mas contexto.',
      icon: <LineChartOutlined style={{ color: '#7C3AED', fontSize: 18 }} />,
    },
    {
      title: 'Escalable y seguro',
      description: 'Crece con tu equipo sin cambiar de workspace.',
      icon: <SafetyCertificateOutlined style={{ color: '#7C3AED', fontSize: 18 }} />,
    },
  ];

  return (
    <div className={`w-full ${className}`.trim()}>
      <div
        className="overflow-hidden rounded-[30px] border px-6 py-5 shadow-[0_20px_48px_rgba(16,42,67,0.08)] md:px-7 md:py-5"
        style={{
          borderColor: '#F2C46D',
          background:
            'linear-gradient(135deg, rgba(255,251,241,0.98) 0%, rgba(255,255,255,0.98) 48%, rgba(255,250,238,0.98) 100%)',
        }}
      >
        <div className="mb-4 flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[20px]"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,243,214,0.98) 0%, rgba(255,248,233,0.98) 100%)',
            }}
          >
            <CrownOutlined style={{ color: '#F59E0B', fontSize: 24 }} />
          </div>

          <div
            className="inline-flex items-center rounded-full px-5 py-2"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,243,214,0.92) 0%, rgba(255,248,233,0.92) 100%)',
            }}
          >
            <Text className="text-[13px] font-black uppercase tracking-[0.18em] text-amber-600">
              Disponible en Growth
            </Text>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,390px)] xl:items-start">
          <div className="min-w-0">
            <Title
              level={1}
              className="!mb-2 !max-w-3xl !text-[clamp(2rem,3vw,2.75rem)] !leading-[1.05] !text-slate-900"
            >
              {'\uD83D\uDE80 Sigue creando sin limites'}
            </Title>

            <div className="mt-3.5 space-y-0">
              {primaryBenefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="flex items-start gap-4 border-b border-slate-200/70 py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
                    <CheckCircleOutlined
                      style={{
                        color: qaPalette.functionalityStatus.completed,
                        fontSize: 22,
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <Text className="block text-lg font-semibold text-slate-900">
                      {benefit.title}
                    </Text>
                    <Text className="mt-1 block text-sm leading-6 text-slate-500">
                      {benefit.description}
                    </Text>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <Button
                type="primary"
                size="large"
                href={onUpgradeClick ? undefined : upgradeUrl}
                target={onUpgradeClick ? undefined : '_blank'}
                rel={onUpgradeClick ? undefined : 'noreferrer'}
                onClick={onUpgradeClick}
                className="h-12 rounded-2xl border-0 px-6 text-base font-semibold shadow-[0_16px_30px_rgba(18,63,104,0.14)] md:min-w-[262px]"
                style={{
                  background: 'linear-gradient(135deg, #123F68 0%, #1DA9CF 100%)',
                }}
              >
                {'Seguir creando proyectos \uD83D\uDE80'}
              </Button>

              <Button
                size="large"
                onClick={onViewPlans}
                className="h-12 rounded-2xl border-slate-200 px-6 text-base font-semibold text-slate-700 shadow-[0_10px_24px_rgba(16,42,67,0.06)]"
              >
                Ver planes
              </Button>
            </div>
          </div>

          <div
            className="rounded-[24px] border p-3.5"
            style={{
              borderColor: '#F6DCA7',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,250,240,0.96) 100%)',
              boxShadow: '0 18px 40px rgba(16,42,67,0.06)',
            }}
          >
            <div
              className="h-full rounded-[20px] border p-3.5"
              style={{
                borderColor: '#EDE9FE',
                background: 'rgba(255,255,255,0.94)',
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50">
                    <CheckCircleOutlined style={{ color: '#8B5CF6', fontSize: 16 }} />
                  </div>
                  <div>
                    <Text className="block text-sm font-semibold text-slate-900">
                      Vista previa QA
                    </Text>
                    <Text className="text-xs uppercase tracking-[0.14em] text-slate-400">
                      Growth
                    </Text>
                  </div>
                </div>
              </div>

              <div
                className="rounded-[18px] border px-4 py-3"
                style={{
                  borderColor: '#EEF2FF',
                  background: '#ffffff',
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Text className="text-sm font-semibold text-slate-900">
                    Caso generado con IA
                  </Text>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50">
                    <CheckCircleOutlined style={{ color: '#F59E0B', fontSize: 14 }} />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <Text className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Titulo
                    </Text>
                    <div className="mt-2 h-2 rounded-full bg-violet-100" style={{ width: '74%' }} />
                  </div>
                  <div>
                    <Text className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Precondiciones
                    </Text>
                    <div className="mt-2 h-2 rounded-full bg-sky-100" style={{ width: '54%' }} />
                  </div>
                  <div>
                    <Text className="block text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Pasos
                    </Text>
                    <div className="mt-2 space-y-1.5">
                      <div className="h-2 rounded-full bg-slate-100" style={{ width: '72%' }} />
                      <div className="h-2 rounded-full bg-slate-100" style={{ width: '60%' }} />
                      <div className="h-2 rounded-full bg-slate-100" style={{ width: '67%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-[#F3E3BC] pt-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {footerPoints.map((item) => (
              <FooterValuePoint
                key={item.title}
                title={item.title}
                description={item.description}
                icon={item.icon}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
