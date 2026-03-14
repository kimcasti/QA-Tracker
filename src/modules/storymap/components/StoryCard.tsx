import { Button, Card, List, Select, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { Functionality } from '../../../types';
import type { StoryMapStoryNode } from '../types';

const { Text } = Typography;

export function StoryCard({
  story,
  unassignedFunctionalities,
  onCreateFunctionality,
  onAssignFunctionality,
  onUnassignFunctionality,
}: {
  story: StoryMapStoryNode;
  unassignedFunctionalities: Functionality[];
  onCreateFunctionality: (storyId: string) => void;
  onAssignFunctionality: (storyId: string, functionalityId: string) => void;
  onUnassignFunctionality: (functionalityId: string) => void;
}) {
  const [showAssociate, setShowAssociate] = useState(false);

  const options = unassignedFunctionalities.map(f => ({
    label: `${f.id} - ${f.name}`,
    value: f.id,
  }));

  return (
    <Card
      size="small"
      className="rounded-xl border-slate-100 shadow-sm"
      title={<span className="font-bold text-slate-800">{story.name}</span>}
      extra={<Tag className="m-0 text-[10px] uppercase font-bold">{story.functionalities.length}</Tag>}
    >
      <div className="space-y-3">
        <div>
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tasks / Funcionalidades</Text>
          <List
            size="small"
            dataSource={story.functionalities}
            locale={{ emptyText: <span className="text-slate-400 text-xs">Sin funcionalidades asociadas</span> }}
            renderItem={(f) => (
              <List.Item
                className="px-0"
                actions={[
                  <Button
                    key="remove"
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onUnassignFunctionality(f.id)}
                  />,
                ]}
              >
                <Space size={6}>
                  <span className="text-xs font-bold text-slate-700">{f.id}</span>
                  <span className="text-xs text-slate-500">{f.name}</span>
                </Space>
              </List.Item>
            )}
          />
        </div>

        <div className="pt-2 border-t border-slate-100">
          <Space wrap className="w-full">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="rounded-lg"
              onClick={() => onCreateFunctionality(story.id)}
            >
              Crear funcionalidad
            </Button>
            <Button
              className="rounded-lg"
              onClick={() => setShowAssociate(v => !v)}
              disabled={options.length === 0}
            >
              Asociar existente
            </Button>
          </Space>

          {showAssociate && (
            <div className="mt-3">
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asociar existente</Text>
              <Select
                showSearch
                allowClear
                placeholder="Selecciona una funcionalidad sin Story..."
                className="w-full mt-2"
                options={options}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onSelect={(funcId) => onAssignFunctionality(story.id, funcId)}
                suffixIcon={<PlusOutlined />}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
