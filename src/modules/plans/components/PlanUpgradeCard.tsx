import {
  CheckCircleFilled,
  CrownOutlined,
  MessageOutlined,
  ThunderboltFilled,
} from '@ant-design/icons';
import { Button, Tag, Typography } from 'antd';
import { softSurface } from '../../../theme/palette';

const { Text, Title } = Typography;

type PlanUpgradeCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  benefits?: string[];
  ctaHref: string;
  onCtaClick?: () => void | Promise<void>;
  ctaText?: string;
  onSecondaryAction?: () => void | Promise<void>;
  secondaryActionText?: string;
  className?: string;
  variant?: 'default' | 'inline-banner';
};

export function PlanUpgradeCard({
  eyebrow = 'Disponible en Growth',
  title,
  description,
  benefits = [],
  ctaHref,
  onCtaClick,
  ctaText = 'Actualizar a Growth',
  onSecondaryAction,
  secondaryActionText = 'Ver planes',
  className = '',
  variant = 'default',
}: PlanUpgradeCardProps) {
  if (variant === 'inline-banner') {
    return (
      <div
        className={`rounded-[28px] border px-5 py-4 shadow-[0_18px_40px_rgba(245,158,11,0.08)] ${className}`.trim()}
        style={{
          borderColor: 'rgba(245, 158, 11, 0.55)',
          background:
            'linear-gradient(135deg, rgba(255,248,230,0.94) 0%, rgba(255,255,255,0.98) 42%, rgba(255,250,240,0.94) 100%)',
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(245, 158, 11, 0.10)' }}
            >
              <ThunderboltFilled style={{ color: '#F59E0B', fontSize: 26 }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Tag
                  bordered={false}
                  className="m-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)' }}
                >
                  {eyebrow}
                </Tag>
              </div>

              <Title level={4} className="!mb-0 !mt-2 !text-slate-900 lg:!text-[18px] lg:!leading-[1.25]">
                {title}
              </Title>
              <Text className="mt-1 block max-w-3xl text-sm leading-6 text-slate-600 lg:text-[15px]">
                {description}
              </Text>
            </div>
          </div>

          <div className="flex w-full justify-start lg:w-auto lg:shrink-0 lg:justify-end">
            <Button
              href={onCtaClick ? undefined : ctaHref}
              target={onCtaClick ? undefined : '_blank'}
              rel={onCtaClick ? undefined : 'noreferrer'}
              onClick={onCtaClick}
              className="h-12 rounded-[20px] border-0 px-6 text-base font-semibold shadow-[0_10px_26px_rgba(37,99,235,0.18)]"
              style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FBFF 100%)',
                color: '#2563EB',
                border: '1px solid rgba(191, 219, 254, 0.95)',
              }}
            >
              {ctaText}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[0_18px_40px_rgba(16,42,67,0.08)] ${className}`.trim()}
      style={{
        borderColor: '#F2C46D',
        background:
          'linear-gradient(135deg, rgba(255,249,235,0.98) 0%, rgba(255,255,255,0.96) 100%)',
      }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: softSurface('#D97706') }}
            >
              <CrownOutlined style={{ color: '#D97706', fontSize: 20 }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Tag
                  bordered={false}
                  className="m-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)' }}
                >
                  {eyebrow}
                </Tag>
                <Text className="text-xs font-medium text-slate-500">Bloqueado en tu plan actual</Text>
              </div>

              <Title level={4} className="!mb-1 !mt-3 !text-slate-900">
                {title}
              </Title>
              <Text className="text-sm leading-6 text-slate-600">{description}</Text>
            </div>
          </div>

          {benefits.length ? (
            <div className="rounded-2xl border border-amber-100 bg-white/80 px-4 py-4">
              <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Lo que desbloqueas con Growth
              </Text>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {benefits.map(benefit => (
                  <div key={benefit} className="flex items-start gap-2.5">
                    <CheckCircleFilled className="mt-0.5 text-[14px] text-emerald-500" />
                    <Text className="text-sm leading-6 text-slate-700">{benefit}</Text>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-3 lg:max-w-[260px] lg:items-stretch">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <Text className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Siguiente paso
            </Text>
            <Text className="mt-2 block text-sm leading-6 text-slate-600">
              Activa Growth para usar IA en este flujo sin salir del proyecto.
            </Text>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="primary"
              icon={<MessageOutlined />}
              href={onCtaClick ? undefined : ctaHref}
              target={onCtaClick ? undefined : '_blank'}
              rel={onCtaClick ? undefined : 'noreferrer'}
              onClick={onCtaClick}
              className="h-11 rounded-2xl px-5 font-semibold"
              style={{
                background: 'linear-gradient(135deg, #123F68 0%, #1DA9CF 100%)',
                border: 'none',
              }}
            >
              {ctaText}
            </Button>

            {onSecondaryAction ? (
              <Button onClick={onSecondaryAction} className="h-11 rounded-2xl px-5 font-semibold">
                {secondaryActionText}
              </Button>
            ) : null}
          </div>

          <Text className="text-xs leading-5 text-slate-500">
            Puedes seguir documentando manualmente mientras tanto.
          </Text>
        </div>
      </div>
    </div>
  );
}
