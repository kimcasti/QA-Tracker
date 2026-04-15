import { CrownOutlined, MessageOutlined } from '@ant-design/icons';
import { Button, Progress, Typography } from 'antd';
import { qaPalette, softSurface } from '../../../theme/palette';
import {
  buildProjectUpgradeWhatsAppUrl,
  getProjectLimitReachedMessage,
} from '../utils/projectUpgrade';

const { Text, Title } = Typography;

type ProjectUpgradeBoxProps = {
  organizationName?: string;
  currentCount: number;
  limit: number;
  upgradePriceMonthlyUsd: number;
  className?: string;
};

export function ProjectUpgradeBox({
  organizationName,
  currentCount,
  limit,
  upgradePriceMonthlyUsd,
  className = '',
}: ProjectUpgradeBoxProps) {
  const whatsappUrl = buildProjectUpgradeWhatsAppUrl({
    organizationName,
    currentCount,
    limit,
    upgradePriceMonthlyUsd,
  });

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[0_18px_40px_rgba(16,42,67,0.08)] ${className}`.trim()}
      style={{
        borderColor: '#F2C46D',
        background: 'linear-gradient(135deg, rgba(255,249,235,0.98) 0%, rgba(255,255,255,0.96) 100%)',
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: softSurface('#D97706') }}
          >
            <CrownOutlined style={{ color: '#D97706', fontSize: 20 }} />
          </div>

          <div className="min-w-0 flex-1">
            <Text className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600">
              Plan Starter
            </Text>
            <Title level={4} className="!mb-1 !mt-2 !text-slate-900">
              Actualiza a Pro para seguir creando proyectos
            </Title>
            <Text className="text-sm leading-6 text-slate-600">
              {getProjectLimitReachedMessage({
                currentCount,
                limit,
                upgradePriceMonthlyUsd,
              })}
            </Text>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white/80 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Text className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Progreso del plan
            </Text>
            <Text strong className="text-slate-700">
              {currentCount}/{limit} proyectos
            </Text>
          </div>
          <Progress
            percent={Math.min((currentCount / Math.max(limit, 1)) * 100, 100)}
            showInfo={false}
            strokeColor={qaPalette.primary}
            trailColor={softSurface(qaPalette.border)}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Text className="text-sm text-slate-500">
            Plan Pro disponible por <strong>${upgradePriceMonthlyUsd}/mes</strong>
          </Text>

          <Button
            type="primary"
            icon={<MessageOutlined />}
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="h-11 rounded-2xl px-5 font-semibold"
          >
            Actualizar a Pro por WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
