import { Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { BugOutlined, SearchOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useBugs } from '../modules/bugs/hooks/useBugs';
import { BugOrigin, BugStatus, type QABug } from '../types';
import { qaPalette } from '../theme/palette';
import { bugStatusColors, softTagStyle } from '../theme/statusStyles';

const { Text } = Typography;

function formatOriginLabel(record: QABug) {
  const showCycleId =
    record.cycleId &&
    (record.origin === BugOrigin.REGRESSION_CYCLE || record.origin === BugOrigin.SMOKE_CYCLE);

  return showCycleId ? `${record.origin} - ${record.cycleId}` : record.origin;
}

export default function BugHistoryView({ projectId }: { projectId?: string }) {
  const { data: bugsData = [], save: saveBug } = useBugs(projectId);
  const bugs = Array.isArray(bugsData) ? bugsData : [];

  const [searchText, setSearchText] = useState('');
  const [originFilter, setOriginFilter] = useState<BugOrigin | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<BugStatus | undefined>(undefined);

  const filteredBugs = useMemo(() => {
    return bugs.filter(bug => {
      const search = searchText.trim().toLowerCase();
      const matchesSearch =
        !search ||
        bug.internalBugId.toLowerCase().includes(search) ||
        (bug.externalBugId || '').toLowerCase().includes(search) ||
        bug.title.toLowerCase().includes(search) ||
        bug.functionalityName.toLowerCase().includes(search) ||
        bug.module.toLowerCase().includes(search);

      const matchesOrigin = !originFilter || bug.origin === originFilter;
      const matchesStatus = !statusFilter || bug.status === statusFilter;

      return matchesSearch && matchesOrigin && matchesStatus;
    });
  }, [bugs, originFilter, searchText, statusFilter]);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl qa-surface-card">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Buscar
            </span>
            <Input
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="ID, titulo, funcionalidad o modulo"
              className="w-72 h-10 rounded-lg"
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Origen
            </span>
            <Select
              allowClear
              placeholder="Todos"
              className="w-52 h-10"
              value={originFilter}
              onChange={setOriginFilter}
              options={Object.values(BugOrigin).map(origin => ({ label: origin, value: origin }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Estado
            </span>
            <Select
              allowClear
              placeholder="Todos"
              className="w-40 h-10"
              value={statusFilter}
              onChange={setStatusFilter}
              options={Object.values(BugStatus).map(status => ({ label: status, value: status }))}
            />
          </div>
        </div>
      </Card>

      <Card
        className="rounded-2xl qa-surface-card"
        title={
          <div className="flex items-center gap-2">
            <BugOutlined style={{ color: qaPalette.functionalityStatus.failed }} />
            <span className="font-bold text-slate-800">Historial de Bugs</span>
            <Tag className="m-0 rounded-full bg-slate-100 border-slate-200 text-slate-600">
              {filteredBugs.length}
            </Tag>
          </div>
        }
      >
        <Table
          rowKey="internalBugId"
          dataSource={filteredBugs}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Bug
                </span>
              ),
              key: 'bug',
              width: 280,
              render: (_, record: QABug) => (
                <div className="min-w-[240px]">
                  <div className="flex items-center gap-2">
                    <Text strong className="text-slate-800">
                      {record.title}
                    </Text>
                    {record.severity && (
                      <Tag
                        className="m-0 text-[9px] font-black uppercase border-none px-1.5 rounded-sm"
                        style={{ backgroundColor: qaPalette.text, color: qaPalette.card }}
                      >
                        {record.severity}
                      </Tag>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {record.bugLink ? (
                      <a
                        href={record.bugLink}
                        target="_blank"
                        rel="noreferrer"
                        onClick={event => event.stopPropagation()}
                      >
                        <Tag className="m-0 cursor-pointer rounded-md border-slate-200 bg-slate-100 text-slate-600">
                          {record.internalBugId}
                        </Tag>
                      </a>
                    ) : (
                      <Tag className="m-0 rounded-md bg-slate-100 border-slate-200 text-slate-600">
                        {record.internalBugId}
                      </Tag>
                    )}
                    {record.externalBugId && (
                      record.bugLink ? (
                        <a
                          key={`${record.internalBugId}-external`}
                          href={record.bugLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={event => event.stopPropagation()}
                        >
                          <Tag
                            className="m-0 cursor-pointer rounded-md"
                            style={softTagStyle(qaPalette.functionalityStatus.failed)}
                          >
                            {record.externalBugId}
                          </Tag>
                        </a>
                      ) : (
                        <Tag
                          className="m-0 rounded-md"
                          style={softTagStyle(qaPalette.functionalityStatus.failed)}
                        >
                          {record.externalBugId}
                        </Tag>
                      )
                    )}
                  </div>
                </div>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Trazabilidad
                </span>
              ),
              key: 'traceability',
              width: 250,
              render: (_, record: QABug) => (
                <div className="min-w-[220px]">
                  <div className="font-semibold text-slate-700">{record.functionalityName}</div>
                  <div className="text-xs text-slate-500">
                    {record.functionalityId} • {record.module}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {record.sprint || 'Sin sprint'}
                    {record.cycleId ? ` • ${record.cycleId}` : ''}
                  </div>
                </div>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Origen
                </span>
              ),
              dataIndex: 'origin',
              key: 'origin',
              width: 220,
              render: (_: BugOrigin, record: QABug) => (
                <Tag className="m-0 rounded-full bg-slate-100 border-slate-200 text-slate-600">
                  {formatOriginLabel(record)}
                </Tag>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Detectado
                </span>
              ),
              key: 'detectedAt',
              width: 170,
              render: (_, record: QABug) => (
                <div>
                  <div className="text-sm font-medium text-slate-700">
                    {dayjs(record.detectedAt).format('DD/MM/YYYY')}
                  </div>
                  <div className="text-xs text-slate-400">
                    {record.reportedBy || 'Sin responsable'}
                  </div>
                </div>
              ),
            },
            {
              title: (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Estado
                </span>
              ),
              key: 'status',
              width: 180,
              render: (_, record: QABug) => (
                <Space direction="vertical" size={6}>
                  <Tag
                    className="m-0 rounded-full px-3 font-bold uppercase text-[10px]"
                    style={softTagStyle(bugStatusColors[record.status])}
                  >
                    {record.status}
                  </Tag>
                  <Select
                    size="small"
                    className="w-36"
                    value={record.status}
                    disabled={record.status === BugStatus.RESOLVED}
                    onChange={status => {
                      saveBug({ ...record, status, updatedAt: dayjs().toISOString() });
                      message.success(`Estado actualizado a ${status}`);
                    }}
                    options={Object.values(BugStatus).map(status => ({
                      label: status,
                      value: status,
                    }))}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
