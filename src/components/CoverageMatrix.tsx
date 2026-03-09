import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Progress, Row, Col, Input, Select, Space, Button, Tooltip } from 'antd';
import { 
  SearchOutlined, 
  FilterOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  InfoCircleOutlined,
  ExportOutlined,
  TableOutlined
} from '@ant-design/icons';
import { useFunctionalities, useExecutions } from '../hooks';
import { TestResult, TestType } from '../types';

const { Title, Text, Paragraph } = Typography;

export default function CoverageMatrix({ projectId }: { projectId?: string }) {
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: executionsData } = useExecutions(projectId);
  
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const executions = Array.isArray(executionsData) ? executionsData : [];

  const [searchText, setSearchText] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string | undefined>(undefined);

  const modules = Array.from(new Set(functionalities.map(f => f.module)));

  const filteredData = functionalities.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchText.toLowerCase()) || 
                         f.id.toLowerCase().includes(searchText.toLowerCase());
    const matchesModule = !moduleFilter || f.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const columns = [
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">ID</span>,
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <span className="font-bold text-blue-600">{id}</span>
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Módulo</span>,
      dataIndex: 'module',
      key: 'module',
      width: 150,
      render: (m: string) => <Tag className="rounded-md border-slate-200 bg-slate-50 text-slate-600 font-medium">{m}</Tag>
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Funcionalidad</span>,
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => <Text strong className="text-slate-800">{n}</Text>
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Tipo de Prueba</span>,
      dataIndex: 'testTypes',
      key: 'testTypes',
      render: (types: TestType[]) => (
        <Space size={[0, 4]} wrap>
          {types?.map(t => (
            <Tag key={t} color={t === TestType.SMOKE ? 'orange' : t === TestType.REGRESSION ? 'blue' : 'purple'} className="rounded-full px-3 text-[10px] font-bold uppercase">
              {t}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Estado QA</span>,
      key: 'status',
      width: 150,
      render: (_: any, record: any) => {
        const exec = executions.find(e => e.functionalityId === record.id);
        const result = exec ? exec.result : TestResult.NOT_EXECUTED;
        
        return (
          <div className="flex items-center gap-2">
            {result === TestResult.PASSED ? <CheckCircleOutlined className="text-emerald-500" /> :
             result === TestResult.FAILED ? <CloseCircleOutlined className="text-rose-500" /> :
             <ClockCircleOutlined className="text-slate-300" />}
            <span className={`font-bold text-xs ${
              result === TestResult.PASSED ? 'text-emerald-600' :
              result === TestResult.FAILED ? 'text-rose-600' : 'text-slate-400'
            }`}>
              {result}
            </span>
          </div>
        );
      }
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Cobertura</span>,
      key: 'coverage',
      width: 150,
      render: (_: any, record: any) => {
        const exec = executions.find(e => e.functionalityId === record.id);
        const percent = exec?.executed ? 100 : 0;
        return (
          <div className="flex items-center gap-3">
            <Progress 
              percent={percent} 
              size="small" 
              showInfo={false} 
              strokeColor={percent === 100 ? '#10b981' : '#cbd5e1'}
              className="m-0"
            />
            <span className="text-xs font-bold text-slate-500">{percent}%</span>
          </div>
        );
      }
    }
  ];

  const totalFuncs = functionalities.length;
  const coveredFuncs = executions.filter(e => e.executed).length;
  const coveragePercent = totalFuncs > 0 ? Math.round((coveredFuncs / totalFuncs) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Title level={2} className="!mb-1">Matriz de Cobertura</Title>
          <Paragraph type="secondary">Visualización detallada de la trazabilidad y estado de pruebas por funcionalidad.</Paragraph>
        </div>
        <Button icon={<ExportOutlined />} className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 font-semibold">
          Exportar Matriz
        </Button>
      </div>

      <Row gutter={20}>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <TableOutlined className="text-blue-500 text-xl" />
              </div>
              <div>
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Total Funcionalidades</Text>
                <div className="text-2xl font-bold text-slate-800 leading-none mt-1">{totalFuncs}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <CheckCircleOutlined className="text-emerald-500 text-xl" />
              </div>
              <div>
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Cobertura Actual</Text>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-emerald-600 leading-none">{coveredFuncs}</span>
                  <span className="text-xs text-emerald-500 font-bold">({coveragePercent}%)</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                <InfoCircleOutlined className="text-slate-400 text-xl" />
              </div>
              <div>
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">Pendientes de Test</Text>
                <div className="text-2xl font-bold text-slate-400 leading-none mt-1">{totalFuncs - coveredFuncs}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <Input 
              prefix={<SearchOutlined className="text-slate-400" />} 
              placeholder="Buscar por ID o Funcionalidad..." 
              className="h-11 rounded-xl bg-slate-50 border-none"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            <Select 
              placeholder="Filtrar por Módulo" 
              className="w-64 h-11"
              allowClear
              value={moduleFilter}
              onChange={setModuleFilter}
              options={modules.map(m => ({ label: m, value: m }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <Tooltip title="Configurar Columnas">
              <Button icon={<FilterOutlined />} className="rounded-xl h-11 w-11 flex items-center justify-center border-slate-200" />
            </Tooltip>
          </div>
        </div>

        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id"
          pagination={{ 
            pageSize: 10,
            showTotal: (total, range) => `Mostrando ${range[0]}-${range[1]} de ${total} registros`
          }}
          className="coverage-table"
        />
      </Card>
    </div>
  );
}
