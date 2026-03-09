import React, { useState } from 'react';
import { Card, Col, Row, Button, Select, Table, Tag, Typography, Space, Divider, message, Empty } from 'antd';
import { 
  FilePdfOutlined, 
  FileExcelOutlined, 
  FileWordOutlined, 
  SearchOutlined, 
  FilterOutlined,
  BarChartOutlined,
  HistoryOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useRegressionCycles, useSmokeCycles } from '../hooks';
import { RegressionCycle, TestResult } from '../types';
import { exportCycleToExcel, exportCycleToDocx } from '../utils/reportUtils';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export default function Reports({ projectId }: { projectId?: string }) {
  const { data: regressionCycles } = useRegressionCycles(projectId);
  const { data: smokeCycles } = useSmokeCycles(projectId);
  
  const [selectedCycleId, setSelectedCycleId] = useState<string | undefined>(undefined);
  const [cycleType, setCycleType] = useState<'REGRESSION' | 'SMOKE'>('REGRESSION');

  const cycles = cycleType === 'REGRESSION' 
    ? (Array.isArray(regressionCycles) ? regressionCycles : []) 
    : (Array.isArray(smokeCycles) ? smokeCycles : []);

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  const handleExportExcel = () => {
    if (!selectedCycle) return message.warning('Selecciona un ciclo primero');
    exportCycleToExcel(selectedCycle);
    message.success('Reporte Excel generado');
  };

  const handleExportDocx = async () => {
    if (!selectedCycle) return message.warning('Selecciona un ciclo primero');
    await exportCycleToDocx(selectedCycle);
    message.success('Reporte Word generado');
  };

  const columns = [
    { title: 'ID', dataIndex: 'functionalityId', key: 'id', render: (id: string) => <span className="font-bold text-blue-600">{id}</span> },
    { title: 'Funcionalidad', dataIndex: 'functionalityName', key: 'name' },
    { title: 'Caso', dataIndex: 'testCaseTitle', key: 'testCase', render: (tc: string) => tc || 'N/A' },
    { 
      title: 'Resultado', 
      dataIndex: 'result', 
      key: 'result',
      render: (res: TestResult) => {
        const colors = {
          [TestResult.PASSED]: 'green',
          [TestResult.FAILED]: 'red',
          [TestResult.BLOCKED]: 'orange',
          [TestResult.NOT_EXECUTED]: 'default'
        };
        return <Tag color={colors[res]}>{res}</Tag>;
      }
    },
    { title: 'Bug', dataIndex: 'bugId', key: 'bug', render: (bug: string) => bug ? <Tag color="magenta">{bug}</Tag> : '-' }
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-1">
        <Title level={2} className="m-0 font-bold text-slate-800">Centro de Reportes</Title>
        <Text type="secondary" className="text-slate-500">Genera y descarga informes detallados de ejecución en múltiples formatos.</Text>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100">
        <Row gutter={24} align="bottom">
          <Col span={6}>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Ciclo</span>
              <Select 
                className="w-full h-11 rounded-xl"
                value={cycleType}
                onChange={(val) => {
                  setCycleType(val);
                  setSelectedCycleId(undefined);
                }}
                options={[
                  { label: 'Regresión', value: 'REGRESSION' },
                  { label: 'Smoke Test', value: 'SMOKE' }
                ]}
              />
            </div>
          </Col>
          <Col span={10}>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seleccionar Ciclo</span>
              <Select 
                className="w-full h-11 rounded-xl"
                placeholder="Busca un ciclo por ID o Nota..."
                value={selectedCycleId}
                onChange={setSelectedCycleId}
                showSearch
                optionFilterProp="children"
                options={cycles.map(c => ({
                  label: `${c.cycleId} - ${c.note?.substring(0, 30)}... (${dayjs(c.date).format('DD/MM/YY')})`,
                  value: c.id
                }))}
              />
            </div>
          </Col>
          <Col span={8}>
            <Space className="w-full">
              <Button 
                icon={<FileExcelOutlined />} 
                className="h-11 rounded-xl border-emerald-200 text-emerald-600 font-bold hover:bg-emerald-50"
                onClick={handleExportExcel}
                disabled={!selectedCycleId}
              >
                Excel
              </Button>
              <Button 
                icon={<FileWordOutlined />} 
                className="h-11 rounded-xl border-blue-200 text-blue-600 font-bold hover:bg-blue-50"
                onClick={handleExportDocx}
                disabled={!selectedCycleId}
              >
                Word
              </Button>
              <Button 
                type="primary"
                icon={<FilePdfOutlined />} 
                className="h-11 rounded-xl font-bold bg-rose-600 border-rose-600 hover:bg-rose-700"
                onClick={() => message.info('Usa la opción de imprimir del navegador para PDF por ahora')}
                disabled={!selectedCycleId}
              >
                PDF
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {selectedCycle ? (
        <div id="report-content" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
            <div className="bg-slate-50 p-6 border-b border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Tag color={cycleType === 'REGRESSION' ? 'blue' : 'orange'} className="rounded-full px-3 font-bold uppercase text-[10px]">
                      {cycleType === 'REGRESSION' ? 'Regresión' : 'Smoke Test'}
                    </Tag>
                    <span className="text-slate-400 text-sm">• {selectedCycle.sprint || 'Sin Sprint'}</span>
                  </div>
                  <Title level={3} className="!m-0 uppercase tracking-tight">{selectedCycle.cycleId}</Title>
                  <Paragraph type="secondary" className="!m-0 mt-2 text-slate-600">{selectedCycle.note}</Paragraph>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Fecha de Ejecución</div>
                  <div className="text-slate-800 font-bold text-lg">{dayjs(selectedCycle.date).format('DD MMMM, YYYY')}</div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <Row gutter={24} className="mb-8">
                <Col span={6}>
                  <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tests</div>
                    <div className="text-2xl font-bold text-slate-800">{selectedCycle.totalTests}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div className="text-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Aprobados</div>
                    <div className="text-2xl font-bold text-emerald-600">{selectedCycle.passed}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div className="text-center p-4 bg-rose-50 rounded-2xl border border-rose-100">
                    <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Fallidos</div>
                    <div className="text-2xl font-bold text-rose-600">{selectedCycle.failed}</div>
                  </div>
                </Col>
                <Col span={6}>
                  <div className="text-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Aprobación</div>
                    <div className="text-2xl font-bold text-blue-600">{selectedCycle.approvalRate}%</div>
                  </div>
                </Col>
              </Row>

              <Divider orientation="left">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalle de Ejecución</span>
              </Divider>

              <Table 
                dataSource={selectedCycle.executions}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                className="report-table"
              />
            </div>
          </Card>
        </div>
      ) : (
        <Card className="rounded-2xl border-slate-100 border-dashed py-20 text-center">
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description={
              <div className="space-y-2">
                <div className="text-slate-500 font-medium">No se ha seleccionado ningún ciclo</div>
                <div className="text-slate-400 text-xs">Utiliza los filtros superiores para buscar un ciclo de pruebas.</div>
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
}
