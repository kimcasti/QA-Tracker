import { Button, Space, Typography } from 'antd';
import { LockOutlined, RocketOutlined, WarningOutlined } from '@ant-design/icons';
import { qaPalette, softSurface } from '../../../theme/palette';

const { Text } = Typography;

type LimitGuardNoticeProps = {
  blocked?: boolean;
  title: string;
  description: string;
  ctaHref?: string;
  onCtaClick?: () => void | Promise<void>;
  ctaText?: string;
  onSecondaryAction?: () => void | Promise<void>;
  secondaryActionText?: string;
  className?: string;
};

export function LimitGuardNotice({
  blocked = false,
  title,
  description,
  ctaHref,
  onCtaClick,
  ctaText = 'Seguir creando proyectos \uD83D\uDE80',
  onSecondaryAction,
  secondaryActionText = 'Ver planes',
  className = '',
}: LimitGuardNoticeProps) {
  const toneColor = blocked
    ? qaPalette.functionalityStatus.failed
    : qaPalette.functionalityStatus.inProgress;
  const Icon = blocked ? LockOutlined : WarningOutlined;

  return (
    <div
      className={`rounded-[20px] border px-4 py-3 ${className}`.trim()}
      style={{
        borderColor: `${toneColor}33`,
        backgroundColor: softSurface(toneColor),
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Space size={10} align="start">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: `${toneColor}24`, color: toneColor }}
            >
              <Icon />
            </span>
            <div className="min-w-0">
              <Text strong className="block !text-slate-900">
                {title}
              </Text>
              <Text className="block text-sm leading-6 text-slate-600">{description}</Text>
            </div>
          </Space>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          {ctaHref ? (
            <Button
              type={blocked ? 'primary' : 'default'}
              icon={<RocketOutlined />}
              href={onCtaClick ? undefined : ctaHref}
              target={onCtaClick ? undefined : '_blank'}
              rel={onCtaClick ? undefined : 'noreferrer'}
              onClick={onCtaClick}
              className="h-10 rounded-2xl px-4 font-semibold"
            >
              {ctaText}
            </Button>
          ) : null}
          {onSecondaryAction ? (
            <Button onClick={onSecondaryAction} className="h-10 rounded-2xl px-4 font-semibold">
              {secondaryActionText}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
