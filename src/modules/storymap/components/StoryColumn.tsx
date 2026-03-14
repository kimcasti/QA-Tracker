import { Button, Card, Select, Space, Tag, Typography } from 'antd';
import { BookOutlined, PlusOutlined } from '@ant-design/icons';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Functionality } from '../../../types';
import { qaPalette } from '../../../theme/palette';

const { Text } = Typography;

export function StoryColumn({
  storyId,
  storyName,
  slots,
  unassignedFunctionalities,
  onCreateFunctionality,
  onAssignExisting,
  renderItem,
}: {
  storyId: string;
  storyName: string;
  slots: { slotId: string; itemId: string }[];
  unassignedFunctionalities: Functionality[];
  onCreateFunctionality: (storyId: string) => void;
  onAssignExisting: (storyId: string, functionalityId: string) => void;
  renderItem: (itemId: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const [showAssociate, setShowAssociate] = useState(false);

  const options = useMemo(() => {
    return unassignedFunctionalities.map(f => ({
      label: `${f.id} - ${f.name}`,
      value: f.id,
    }));
  }, [unassignedFunctionalities]);

  return (
    <Card
      size="small"
      bordered={false}
      className="rounded-xl qa-story-surface qa-story-accent"
      styles={{
        header: { padding: '8px 12px' },
        body: { padding: 12 },
      }}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <Tag color="green" className="m-0 text-[10px] font-black uppercase">
            {t('storymap.story')}
          </Tag>
          <BookOutlined style={{ color: qaPalette.storyMapBorder }} />
          <span className="font-bold text-slate-800 truncate" title={storyName}>
            {storyName}
          </span>
        </div>
      }
      extra={<Tag className="m-0 text-[10px] uppercase font-bold">{Math.max(0, slots.length - 1)}</Tag>}
    >
      <div className="space-y-2">
        <div>
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('storymap.tasks_title')}</Text>
          <div className="mt-2 space-y-2">
            {slots.map(({ slotId, itemId }) => (
              <div
                key={slotId}
                data-swapy-slot={slotId}
                className="min-h-[48px]"
              >
                <div data-swapy-item={itemId}>
                  {renderItem(itemId)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <Space wrap className="w-full">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="rounded-lg"
              onClick={() => onCreateFunctionality(storyId)}
            >
              {t('storymap.create_functionality')}
            </Button>
            <Button
              className="rounded-lg"
              onClick={() => setShowAssociate(v => !v)}
              disabled={options.length === 0}
            >
              {t('storymap.associate_existing')}
            </Button>
          </Space>

          {showAssociate && (
            <div className="mt-3">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('storymap.associate_existing_title')}</Text>
              <Select
                showSearch
                allowClear
                placeholder={t('storymap.associate_existing_placeholder')}
                className="w-full mt-2"
                options={options}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onSelect={(funcId) => onAssignExisting(storyId, funcId)}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
