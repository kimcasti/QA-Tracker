import React, { useState } from 'react';
import {
  Card,
  Table,
  Typography,
  Tag,
  Progress,
  Row,
  Col,
  Input,
  Select,
  Space,
  Button,
  Tooltip,
  Badge,
  Dropdown,
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ExportOutlined,
  TableOutlined,
  BugOutlined,
  FileSearchOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import { useTestCases } from '../modules/test-cases/hooks/useTestCases';
import { useRegressionCycles } from '../modules/test-cycles/hooks/useRegressionCycles';
import { useSmokeCycles } from '../modules/test-cycles/hooks/useSmokeCycles';
import { useExecutions } from '../modules/test-runs/hooks/useExecutions';
import { TestResult, TestType, Priority, RiskLevel } from '../types';
import * as XLSX from 'xlsx';

const { Title, Text, Paragraph } = Typography;

export default function CoverageMatrix({ projectId }: { projectId?: string }) {
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: executionsData } = useExecutions(projectId);
  const { data: testCasesData } = useTestCases(projectId);
  const { data: regressionCyclesData } = useRegressionCycles(projectId);
  const { data: smokeCyclesData } = useSmokeCycles(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const executions = Array.isArray(executionsData) ? executionsData : [];
  const testCases = Array.isArray(testCasesData) ? testCasesData : [];
  const regressionCycles = Array.isArray(regressionCyclesData) ? regressionCyclesData : [];
  const smokeCycles = Array.isArray(smokeCyclesData) ? smokeCyclesData : [];

  const [searchText, setSearchText] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string | undefined>(undefined);

  const modules = Array.from(new Set(functionalities.map(f => f.module)));

  const filteredData = functionalities.filter(f => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchText.toLowerCase()) ||
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
      render: (id: string) => <span className="font-bold text-blue-600">{id}</span>,
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Módulo</span>,
      dataIndex: 'module',
      key: 'module',
      width: 150,
      render: (m: string) => (
        <Tag className="rounded-md border-slate-200 bg-slate-50 text-slate-600 font-medium">
          {m}
        </Tag>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Funcionalidad</span>,
      dataIndex: 'name',
      key: 'name',
      render: (n: string) => (
        <Text strong className="text-slate-800">
          {n}
        </Text>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Tipo de Prueba</span>,
      dataIndex: 'testTypes',
      key: 'testTypes',
      render: (types: TestType[]) => (
        <Space size={[0, 4]} wrap>
          {types?.map(t => (
            <Tag
              key={t}
              color={
                t === TestType.SMOKE ? 'orange' : t === TestType.REGRESSION ? 'blue' : 'purple'
              }
              className="rounded-full px-3 text-[10px] font-bold uppercase"
            >
              {t}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-400 uppercase">Prioridad / Riesgo</span>
      ),
      key: 'priority_risk',
      width: 160,
      render: (_: any, record: any) => (
        <div className="flex flex-col gap-1">
          <Tag
            color={
              record.priority === Priority.CRITICAL
                ? 'red'
                : record.priority === Priority.HIGH
                  ? 'orange'
                  : record.priority === Priority.MEDIUM
                    ? 'blue'
                    : 'default'
            }
            className="m-0 text-[10px] font-bold uppercase w-fit"
          >
            P: {record.priority}
          </Tag>
          <Tag
            color={
              record.riskLevel === RiskLevel.HIGH
                ? 'volcano'
                : record.riskLevel === RiskLevel.MEDIUM
                  ? 'gold'
                  : 'lime'
            }
            className="m-0 text-[10px] font-bold uppercase w-fit"
          >
            R: {record.riskLevel}
          </Tag>
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-400 uppercase">Casos</span>,
      key: 'test_cases',
      width: 100,
      render: (_: any, record: any) => {
        const count = testCases.filter(tc => tc.functionalityId === record.id).length;
        return (
          <div className="flex items-center gap-2">
            <Badge count={count} color={count > 0 ? '#10b981' : '#cbd5e1'} size="small">
              <FileSearchOutlined className={count > 0 ? 'text-emerald-500' : 'text-slate-300'} />
            </Badge>
            <span
              className={`text-xs font-bold ${count > 0 ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              {count}
            </span>
          </div>
        );
      },
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-400 uppercase">Trazabilidad Bugs</span>
      ),
      key: 'bugs',
      width: 120,
      render: (_: any, record: any) => {
        const allExecs = [
          ...regressionCycles.flatMap(c => c.executions || []),
          ...smokeCycles.flatMap(c => c.executions || []),
        ];
        const bugs = allExecs.filter(ex => ex.functionalityId === record.id && ex.bugId);

        if (bugs.length === 0) return <span className="text-slate-300 text-xs">-</span>;

        return (
          <Space size={[0, 4]} wrap>
            {bugs.map((b, idx) => (
              <Tooltip key={idx} title={`${b.severity}: ${b.bugLink || 'Sin link'}`}>
                <Tag color="magenta" icon={<BugOutlined />} className="m-0 text-[10px] cursor-help">
                  {b.bugId}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        );
      },
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
            {result === TestResult.PASSED ? (
              <CheckCircleOutlined className="text-emerald-500" />
            ) : result === TestResult.FAILED ? (
              <CloseCircleOutlined className="text-rose-500" />
            ) : (
              <ClockCircleOutlined className="text-slate-300" />
            )}
            <span
              className={`font-bold text-xs ${
                result === TestResult.PASSED
                  ? 'text-emerald-600'
                  : result === TestResult.FAILED
                    ? 'text-rose-600'
                    : 'text-slate-400'
              }`}
            >
              {result}
            </span>
          </div>
        );
      },
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
      },
    },
  ];

  const totalFuncs = functionalities.length;
  const coveredWithCases = functionalities.filter(f =>
    testCases.some(tc => tc.functionalityId === f.id),
  ).length;
  const coveragePercent = totalFuncs > 0 ? Math.round((coveredWithCases / totalFuncs) * 100) : 0;

  const exportMatrix = (format: 'xlsx' | 'csv') => {
    const data = filteredData.map(f => {
      const tcCount = testCases.filter(tc => tc.functionalityId === f.id).length;
      const exec = executions.find(e => e.functionalityId === f.id);
      const coverage = exec?.executed ? '100%' : '0%';

      const allExecs = [
        ...regressionCycles.flatMap(c => c.executions || []),
        ...smokeCycles.flatMap(c => c.executions || []),
      ];
      const bugs = allExecs
        .filter(ex => ex.functionalityId === f.id && ex.bugId)
        .map(b => b.bugId)
        .join(', ');

      return {
        Módulo: f.module,
        Funcionalidad: f.name,
        'Casos de Prueba': tcCount,
        'Porcentaje de Cobertura': coverage,
        'Bugs Vinculados': bugs || 'Ninguno',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matriz de Cobertura');

    if (format === 'xlsx') {
      XLSX.writeFile(wb, `Matriz_Cobertura_${projectId || 'QA'}.xlsx`);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Matriz_Cobertura_${projectId || 'QA'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportMenu = {
    items: [
      { key: 'xlsx', label: 'Exportar Excel (.xlsx)', onClick: () => exportMatrix('xlsx') },
      { key: 'csv', label: 'Exportar CSV (.csv)', onClick: () => exportMatrix('csv') },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Title level={2} className="!mb-1">
            Matriz de Cobertura
          </Title>
          <Paragraph type="secondary">
            Visualización detallada de la trazabilidad y estado de pruebas por funcionalidad.
          </Paragraph>
        </div>
        <Dropdown menu={exportMenu} trigger={['click']}>
          <Button
            icon={<ExportOutlined />}
            className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 font-semibold"
          >
            Exportar Matriz
          </Button>
        </Dropdown>
      </div>

      <Row gutter={20}>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                <TableOutlined className="text-blue-500 text-xl" />
              </div>
              <div>
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  Total Funcionalidades
                </Text>
                <div className="text-2xl font-bold text-slate-800 leading-none mt-1">
                  {totalFuncs}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <FileSearchOutlined className="text-emerald-500 text-xl" />
              </div>
              <div>
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  Cobertura de Casos
                </Text>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-emerald-600 leading-none">
                    {coveredWithCases}
                  </span>
                  <span className="text-xs text-emerald-500 font-bold">({coveragePercent}%)</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
                <BugOutlined className="text-rose-500 text-xl" />
              </div>
              <div>
                <Text type="secondary" className="text-[11px] font-bold uppercase tracking-wider">
                  Bugs Activos
                </Text>
                <div className="text-2xl font-bold text-rose-600 leading-none mt-1">
                  {[...regressionCycles, ...smokeCycles].reduce(
                    (acc, c) => acc + c.executions.filter(ex => ex.bugId).length,
                    0,
                  )}
                </div>
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
              <Button
                icon={<FilterOutlined />}
                className="rounded-xl h-11 w-11 flex items-center justify-center border-slate-200"
              />
            </Tooltip>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showTotal: (total, range) => `Mostrando ${range[0]}-${range[1]} de ${total} registros`,
          }}
          className="coverage-table"
        />
      </Card>
    </div>
  );
}
