import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, DatePicker, Row, Col, Upload, message, Tooltip, Divider, Checkbox, List, Image } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, UploadOutlined, DeleteOutlined, FileImageOutlined, EyeOutlined, EditOutlined, BugOutlined, UserOutlined, ArrowLeftOutlined, SaveOutlined, ExportOutlined, SearchOutlined, BarChartOutlined, ArrowDownOutlined, ThunderboltOutlined } from '@ant-design/icons';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFunctionalities, useExecutions, useTestCases, useModules, useSprints, useTestRuns } from '../hooks';
import { TestExecution, TestResult, TestType, ExecutionStatus, Priority, FunctionalityScope, Severity, TestRun, TestRunResult, Environment } from '../types';
import { labelEnvironment, labelExecutionStatus, labelPriority, labelTestResult } from '../i18n/labels';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

export default function TestExecutionView({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: testRunsData, save: saveTestRun, delete: deleteTestRun } = useTestRuns(projectId);
  const { data: allTestCases } = useTestCases(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const testRuns = Array.isArray(testRunsData) ? testRunsData : [];
  const testCases = Array.isArray(allTestCases) ? allTestCases : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTestRun, setActiveTestRun] = useState<TestRun | null>(null);
  const [form] = Form.useForm();
  
  // Step 1 State
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedFuncIds, setSelectedFuncIds] = useState<string[]>([]);

  // Step 2 State (Execution View)
  const [executionResults, setExecutionResults] = useState<TestRunResult[]>([]);
  const [executionSearchText, setExecutionSearchText] = useState('');
  const [filterOnlyFailed, setFilterOnlyFailed] = useState(false);

  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [currentEvidenceTestCaseId, setCurrentEvidenceTestCaseId] = useState<string | null>(null);

  // Always read the latest record from state, so evidence edits reflect immediately.
  const currentEvidenceRecord = useMemo(() => {
    if (!currentEvidenceTestCaseId) return null;
    return executionResults.find(r => r.testCaseId === currentEvidenceTestCaseId) || null;
  }, [currentEvidenceTestCaseId, executionResults]);

  const openEvidenceModal = (record: TestRunResult) => {
    setCurrentEvidenceTestCaseId(record.testCaseId);
    setIsEvidenceModalOpen(true);
  };

  const handleSaveEvidence = () => {
    setIsEvidenceModalOpen(false);
    setCurrentEvidenceTestCaseId(null);
  };

  const availableFunctionalities = useMemo(() => {
    return functionalities.filter(f => selectedModules.includes(f.module));
  }, [selectedModules, functionalities]);

  const groupedFunctionalities = useMemo(() => {
    const groups: Record<string, typeof functionalities> = {};
    availableFunctionalities.forEach(f => {
      if (!groups[f.module]) groups[f.module] = [];
      groups[f.module].push(f);
    });
    return groups;
  }, [availableFunctionalities]);

  useEffect(() => {
    // Auto-select all functionalities when modules change
    const newIds = availableFunctionalities.map(f => f.id);
    setSelectedFuncIds(newIds);
  }, [availableFunctionalities]);

  const handleCreateTestRun = async () => {
    try {
      const values = await form.validateFields();
      const newRun: TestRun = {
        id: `TR-${Date.now()}`,
        projectId: projectId || '',
        title: values.title,
        description: values.description || '',
        executionDate: values.executionDate.format('YYYY-MM-DD'),
        status: ExecutionStatus.DRAFT,
        testType: values.testType,
        sprint: values.sprint,
        priority: values.priority,
        tester: values.tester,
        buildVersion: values.buildVersion,
        environment: values.environment,
        selectedModules,
        selectedFunctionalities: selectedFuncIds,
        results: []
      };

      saveTestRun(newRun);
      setActiveTestRun(newRun);
      setIsModalOpen(false);
      form.resetFields();
      setSelectedModules([]);
      setSelectedFuncIds([]);
      
      // Prepare initial results based on test cases
      const initialResults: TestRunResult[] = [];
      selectedFuncIds.forEach(fId => {
        const funcCases = testCases.filter(tc => tc.functionalityId === fId);
        funcCases.forEach(tc => {
          initialResults.push({
            id: `${newRun.id}-${tc.id}`,
            functionalityId: fId,
            testCaseId: tc.id,
            result: TestResult.NOT_EXECUTED
          });
        });
      });
      setExecutionResults(initialResults);
      
      message.success('Ejecución de pruebas creada. Iniciando fase de ejecución...');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleSaveExecution = (status: ExecutionStatus) => {
    if (!activeTestRun) return;

    const updatedRun: TestRun = {
      ...activeTestRun,
      status,
      results: executionResults
    };

    saveTestRun(updatedRun);
    message.success(`Ejecución guardada como ${status}`);
    if (status === ExecutionStatus.FINAL) {
      setActiveTestRun(null);
    }
  };

  const handleExecuteAll = () => {
    setExecutionResults(prev => prev.map(r => 
      r.result === TestResult.NOT_EXECUTED ? { ...r, result: TestResult.PASSED } : r
    ));
    message.success('Todos los casos pendientes marcados como Aprobados');
  };

  const handleExportReport = () => {
    if (!activeTestRun) return;
    
    try {
      const dataToExport = executionResults.map(r => {
        const tc = testCases.find(t => t.id === r.testCaseId);
        const func = functionalities.find(f => f.id === r.functionalityId);
        return {
          'ID Caso': tc?.id,
          'Módulo': func?.module,
          'Funcionalidad': func?.name,
          'Título Caso': tc?.title,
          'Tester': activeTestRun.tester || '',
          'Build Version': activeTestRun.buildVersion || '',
          'Environment': activeTestRun.environment || '',
          'Resultado': r.result,
          'Bug ID': r.bugId || 'N/A',
          'Severidad': r.severity || 'N/A',
          'Notas': r.notes || ''
        };
      });

      import('xlsx').then(XLSX => {
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Resultados");
        XLSX.writeFile(wb, `Reporte_${activeTestRun.id}_${dayjs().format('YYYYMMDD')}.xlsx`);
        message.success('Reporte exportado correctamente');
      });
    } catch (error) {
      message.error('Error al exportar el reporte');
    }
  };

  const updateResult = (tcId: string, field: keyof TestRunResult, value: any) => {
    setExecutionResults(prev => prev.map(r => 
      r.testCaseId === tcId ? { ...r, [field]: value } : r
    ));
  };

  const removeTestCase = (tcId: string) => {
    setExecutionResults(prev => prev.filter(r => r.testCaseId !== tcId));
  };

  // Filters state
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);

  const filteredRuns = testRuns.filter(run => {
    const matchesStatus = !statusFilter || run.status === statusFilter;
    const matchesSprint = !sprintFilter || run.sprint === sprintFilter;
    return matchesStatus && matchesSprint;
  });

  const columns = [
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ID / TÍTULO</span>,
      key: 'title',
      width: 300,
      render: (_: any, record: TestRun) => (
        <div>
          <Text strong className="text-slate-700">{record.id}</Text>
          <br />
          <Text className="text-slate-500 text-xs">{record.title}</Text>
        </div>
      )
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">FECHA</span>,
      dataIndex: 'executionDate',
      key: 'executionDate',
      width: 140,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">TIPO DE TEST</span>,
      dataIndex: 'testType',
      key: 'testType',
      width: 140,
      render: (type: string) => <Tag className="m-0 text-[10px] font-semibold uppercase bg-slate-100 border-slate-200 text-slate-600">{type}</Tag>
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">SPRINT</span>,
      dataIndex: 'sprint',
      key: 'sprint',
      width: 140,
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">TESTER</span>,
      dataIndex: 'tester',
      key: 'tester',
      width: 160,
      ellipsis: true,
      render: (tester: string | undefined) => tester || '—',
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ENVIRONMENT</span>,
      dataIndex: 'environment',
      key: 'environment',
      width: 160,
      render: (env: Environment | undefined) => (
        env ? <Tag className="m-0 text-[10px] font-semibold bg-slate-100 border-slate-200 text-slate-600">{env}</Tag> : '—'
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ESTADO</span>,
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ExecutionStatus) => (
        <Tag color={status === ExecutionStatus.FINAL ? 'blue' : 'orange'} className="rounded-full px-3 font-bold uppercase text-[10px]">
          {status}
        </Tag>
      )
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">PROGRESO</span>,
      key: 'progress',
      width: 200,
      render: (_: any, record: TestRun) => {
        const total = record.results.length;
        const executed = record.results.filter(r => r.result !== TestResult.NOT_EXECUTED).length;
        const percent = total > 0 ? Math.round((executed / total) * 100) : 0;
        return (
          <div className="w-32">
            <div className="flex justify-between text-[10px] mb-1">
              <span>{executed}/{total}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      }
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ACCIONES</span>,
      key: 'actions',
      width: 160,
      render: (_: any, record: TestRun) => (
        <Space>
          <Button 
            icon={record.status === ExecutionStatus.DRAFT ? <EditOutlined /> : <EyeOutlined />} 
            size="small"
            onClick={() => {
              setActiveTestRun(record);
              setExecutionResults(record.results);
            }}
            className={record.status === ExecutionStatus.DRAFT ? "text-amber-600" : "text-blue-600"}
          >
            {record.status === ExecutionStatus.DRAFT ? 'Continuar' : 'Ver'}
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            size="small" 
            danger 
            onClick={() => deleteTestRun(record.id)}
          />
        </Space>
      )
    }
  ];

  if (activeTestRun) {
    const isReadOnly = activeTestRun.status === ExecutionStatus.FINAL;

    const filteredExecutionResults = executionResults.filter(r => {
      const tc = testCases.find(t => t.id === r.testCaseId);
      const func = functionalities.find(f => f.id === r.functionalityId);
      
      const searchLower = executionSearchText.toLowerCase();
      const matchesSearch = !executionSearchText || 
        tc?.id.toLowerCase().includes(searchLower) ||
        tc?.title.toLowerCase().includes(searchLower) ||
        func?.module.toLowerCase().includes(searchLower) ||
        func?.name.toLowerCase().includes(searchLower);
        
      const matchesFailed = !filterOnlyFailed || r.result === TestResult.FAILED;
      
      return matchesSearch && matchesFailed;
    });

    return (
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <Space size="middle">
            <Button icon={<ArrowLeftOutlined />} onClick={() => setActiveTestRun(null)} className="rounded-lg">Volver</Button>
            <div>
              <div className="flex items-center gap-2">
                {isReadOnly && <Tag color="success" className="m-0 font-bold uppercase text-[10px] px-2 py-0.5 rounded-sm">FINALIZADA</Tag>}
                <Title level={3} className="m-0 text-slate-800">{activeTestRun.title}</Title>
              </div>
              <Text type="secondary" className="text-xs text-slate-400">
                {activeTestRun.id} • {activeTestRun.sprint || 'Sin Sprint'} • {activeTestRun.tester || 'Sin Tester'}
                {activeTestRun.environment ? ` • ${activeTestRun.environment}` : ''}
                {activeTestRun.buildVersion ? ` • Build ${activeTestRun.buildVersion}` : ''}
              </Text>
            </div>
          </Space>
          <Space>
            {!isReadOnly && <Button icon={<EditOutlined />} className="rounded-lg">Editar Info</Button>}
            <Button icon={<ExportOutlined />} onClick={handleExportReport} className="rounded-lg">Export Report</Button>
            {!isReadOnly && (
              <Button 
                type="primary" 
                icon={<ThunderboltOutlined />} 
                onClick={handleExecuteAll}
                className="rounded-lg bg-blue-600"
              >
                Execute All
              </Button>
            )}
          </Space>
        </div>

        {/* Metrics Row */}
        <Row gutter={20}>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2">
              <div className="flex items-center justify-center gap-3 mb-1">
                <BarChartOutlined className="text-slate-400 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">Total Tests</Text>
              </div>
              <div className="text-2xl font-black text-slate-800">{executionResults.length}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2 bg-emerald-50/30">
              <div className="flex items-center justify-center gap-3 mb-1">
                <CheckCircleOutlined className="text-emerald-500 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">Approved</Text>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-black text-slate-800">{executionResults.filter(r => r.result === TestResult.PASSED).length}</span>
                <Text type="secondary" className="text-xs font-bold text-emerald-600">({executionResults.length > 0 ? Math.round((executionResults.filter(r => r.result === TestResult.PASSED).length / executionResults.length) * 100) : 0}%)</Text>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2 bg-rose-50/30">
              <div className="flex items-center justify-center gap-3 mb-1">
                <CloseCircleOutlined className="text-rose-500 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">Failed</Text>
              </div>
              <div className="text-2xl font-black text-rose-600">{executionResults.filter(r => r.result === TestResult.FAILED).length}</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="rounded-2xl shadow-sm border-slate-100 text-center py-2 bg-amber-50/30">
              <div className="flex items-center justify-center gap-3 mb-1">
                <ClockCircleOutlined className="text-amber-500 text-lg" />
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-wider">Pending</Text>
              </div>
              <div className="text-2xl font-black text-amber-600">{executionResults.filter(r => r.result === TestResult.NOT_EXECUTED).length}</div>
            </Card>
          </Col>
        </Row>

        <Card className="rounded-2xl shadow-sm border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
            <Input 
              placeholder="Search by ID, Module or Functionality..." 
              prefix={<SearchOutlined className="text-slate-400" />}
              className="w-80 rounded-lg h-10 border-slate-200"
              value={executionSearchText}
              onChange={(e) => setExecutionSearchText(e.target.value)}
            />
            <Space>
              <Button 
                type={!filterOnlyFailed ? "primary" : "default"} 
                className="rounded-lg px-6"
                onClick={() => setFilterOnlyFailed(false)}
              >
                All
              </Button>
              <Button 
                type={filterOnlyFailed ? "primary" : "default"} 
                className="rounded-lg px-6"
                onClick={() => setFilterOnlyFailed(true)}
              >
                Failed Only
              </Button>
            </Space>
          </div>
          <Table
            dataSource={filteredExecutionResults}
            rowKey="testCaseId"
            pagination={false}
            className="execution-detail-table"
            columns={[
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</span>,
                key: 'id',
                width: '12%',
                render: (_, record) => {
                  const tc = testCases.find(t => t.id === record.testCaseId);
                  return <Text strong className="text-blue-600 font-bold">{tc?.id}</Text>;
                }
              },
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MODULO</span>,
                key: 'module',
                width: '12%',
                render: (_, record) => {
                  const func = functionalities.find(f => f.id === record.functionalityId);
                  return <Text strong className="text-slate-800">{func?.module}</Text>;
                }
              },
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FUNCIONALIDAD / CASO</span>,
                key: 'case',
                width: '25%',
                render: (_, record) => {
                  const tc = testCases.find(t => t.id === record.testCaseId);
                  const func = functionalities.find(f => f.id === record.functionalityId);
                  return (
                    <div className="flex flex-col">
                      <Text className="text-slate-800 text-sm">{tc?.title}</Text>
                      <Text type="secondary" className="text-[11px] opacity-60">{func?.name}</Text>
                    </div>
                  );
                }
              },
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EJECUTADO</span>,
                key: 'executed',
                width: '10%',
                align: 'center',
                render: (_, record) => {
                  const executed = record.result !== TestResult.NOT_EXECUTED;

                  return (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        !isReadOnly ? 'cursor-pointer' : 'cursor-not-allowed'
                      } transition-colors ${
                        executed ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300'
                      }`}
                      onClick={!isReadOnly ? () => {
                        updateResult(
                          record.testCaseId,
                          'result',
                          executed ? TestResult.NOT_EXECUTED : TestResult.PASSED
                        );
                      } : undefined}
                    >
                      {executed ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                    </div>
                  );
                }
              },
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">FECHA</span>,
                key: 'date',
                width: '12%',
                render: () => (
                  <div className="flex flex-col text-[11px] text-slate-500 leading-tight">
                    <span>{dayjs().format('DD MMM,')}</span>
                    <span>{dayjs().format('YYYY')}</span>
                  </div>
                )
              },
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">RESULTADO</span>,
                key: 'result',
                width: '18%',
                render: (_, record) => (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      className={`w-full custom-result-select-v2 ${record.result.toLowerCase().replace(' ', '_')}`}
                      value={record.result}
                      disabled={isReadOnly}
                      variant="borderless"
                      onChange={(val) => updateResult(record.testCaseId, 'result', val)}
                      suffixIcon={<ArrowDownOutlined className="text-[10px] opacity-40" />}
                      options={Object.values(TestResult).map(r => ({ 
                        label: (
                          <Space size={6}>
                            <div className={`w-2 h-2 rounded-full ${
                              r === TestResult.PASSED ? 'bg-emerald-500' : 
                              r === TestResult.FAILED ? 'bg-rose-500' : 
                              r === TestResult.BLOCKED ? 'bg-amber-500' : 'bg-slate-300'
                            }`} />
                            <span className="text-xs">{labelTestResult(r, t)}</span>
                          </Space>
                        ), 
                        value: r 
                      }))}
                    />
                    {record.bugId && (
                      <div className="flex flex-wrap gap-1">
                        <Tag className="m-0 flex items-center gap-1.5 bg-rose-50 border-rose-100 text-rose-600 px-2 py-0.5 rounded-md w-fit">
                          <BugOutlined className="text-[10px]" />
                          <a 
                            href={record.bugLink || `https://jira.atlassian.com/browse/${record.bugId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-rose-600 hover:underline truncate max-w-[120px]"
                          >
                            {record.bugId}
                          </a>
                        </Tag>
                        {record.severity && (
                          <Tag className="m-0 text-[9px] font-black uppercase bg-slate-800 text-white border-none px-1.5 rounded-sm">
                            {record.severity}
                          </Tag>
                        )}
                      </div>
                    )}
                  </div>
                )
              },
              {
                title: <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EVIDENCIA</span>,
                key: 'evidence',
                width: '11%',
                align: 'center',
                render: (_, record) => (
                  <Button 
                    type="link" 
                    className="text-blue-600 text-xs flex items-center gap-1 p-0 h-auto"
                    onClick={() => openEvidenceModal(record)}
                  >
                    {record.evidenceImage || record.notes ? <><EyeOutlined /> View</> : <><PlusOutlined /> Note</>}
                  </Button>
                )
              }
            ]}
          />
        </Card>
        {!isReadOnly && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <Button icon={<SaveOutlined />} onClick={() => handleSaveExecution(ExecutionStatus.DRAFT)} className="rounded-lg h-10 px-6">Guardar Borrador</Button>
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleSaveExecution(ExecutionStatus.FINAL)} className="rounded-lg h-10 px-8 bg-blue-600">Finalizar Ejecución</Button>
          </div>
        )}

        {/* Evidence Modal */}
        <Modal
          title={<span className="text-lg font-bold text-slate-800">Evidencia de Ejecución</span>}
          open={isEvidenceModalOpen}
          onCancel={() => {
            setIsEvidenceModalOpen(false);
            setCurrentEvidenceTestCaseId(null);
          }}
          width={520}
          centered
          footer={[
            <Button key="close" onClick={() => {
              setIsEvidenceModalOpen(false);
              setCurrentEvidenceTestCaseId(null);
            }} className="rounded-lg">Cerrar</Button>,
            !isReadOnly && <Button key="save" type="primary" onClick={handleSaveEvidence} className="rounded-lg bg-blue-600">Guardar Evidencia</Button>
          ]}
        >
          {currentEvidenceRecord && (
            <div className="space-y-5 py-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <Text type="secondary" className="text-[10px] font-bold uppercase tracking-widest block mb-1">Funcionalidad</Text>
                <Text strong className="text-slate-800">
                  {testCases.find(tc => tc.id === currentEvidenceRecord.testCaseId)?.id} - {testCases.find(tc => tc.id === currentEvidenceRecord.testCaseId)?.title}
                </Text>
              </div>

              <div>
                <Text className="text-sm font-semibold text-slate-700 block mb-2">Notas de Ejecución</Text>
                <Input.TextArea 
                  rows={4} 
                  placeholder="Escribe aquí las notas de la ejecución..."
                  value={currentEvidenceRecord.notes}
                  disabled={isReadOnly}
                  onChange={(e) => updateResult(currentEvidenceRecord.testCaseId, 'notes', e.target.value)}
                  className="rounded-xl border-slate-200"
                />
              </div>

              <Divider className="m-0"><Text type="secondary" className="text-[10px] font-bold uppercase tracking-widest">Reporte de Bug</Text></Divider>

              <Row gutter={16}>
                <Col span={12}>
                  <Text className="text-xs font-semibold text-slate-600 block mb-1.5">Bug ID (Jira/GitHub)</Text>
                  <Input 
                    placeholder="ID del Bug"
                    value={currentEvidenceRecord.bugId}
                    disabled={isReadOnly}
                    onChange={(e) => updateResult(currentEvidenceRecord.testCaseId, 'bugId', e.target.value)}
                    className="rounded-lg border-slate-200"
                  />
                </Col>
                <Col span={12}>
                  <Text className="text-xs font-semibold text-slate-600 block mb-1.5">Severidad</Text>
                  <Select 
                    className="w-full rounded-lg"
                    placeholder="Seleccionar"
                    value={currentEvidenceRecord.severity}
                    disabled={isReadOnly}
                    onChange={(val) => updateResult(currentEvidenceRecord.testCaseId, 'severity', val)}
                    options={Object.values(Severity).map(s => ({ label: s, value: s }))}
                  />
                </Col>
              </Row>

              <div>
                <Text className="text-xs font-semibold text-slate-600 block mb-1.5">Link al Bug</Text>
                <Input 
                  placeholder="https://jira.atlassian.net/browse/..."
                  value={currentEvidenceRecord.bugLink}
                  disabled={isReadOnly}
                  onChange={(e) => updateResult(currentEvidenceRecord.testCaseId, 'bugLink', e.target.value)}
                  className="rounded-lg border-slate-200"
                />
              </div>

              <div>
                <Text className="text-sm font-semibold text-slate-700 block mb-2">Evidencia Visual (Imagen)</Text>
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[200px]">
                  {currentEvidenceRecord.evidenceImage ? (
                    <div className="relative group">
                      <Image 
                        src={currentEvidenceRecord.evidenceImage} 
                        className="max-h-[300px] object-contain rounded-xl shadow-sm"
                      />
                      {!isReadOnly && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <Upload
                            showUploadList={false}
                            beforeUpload={(file) => {
                              const reader = new FileReader();
                              reader.onload = (e) => updateResult(currentEvidenceRecord.testCaseId, 'evidenceImage', e.target?.result as string);
                              reader.readAsDataURL(file);
                              return false;
                            }}
                          >
                            <Button icon={<UploadOutlined />} ghost>Cambiar Imagen</Button>
                          </Upload>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Upload
                      showUploadList={false}
                      disabled={isReadOnly}
                      beforeUpload={(file) => {
                        const reader = new FileReader();
                        reader.onload = (e) => updateResult(currentEvidenceRecord.testCaseId, 'evidenceImage', e.target?.result as string);
                        reader.readAsDataURL(file);
                        return false;
                      }}
                    >
                      <div className="flex flex-col items-center gap-2 cursor-pointer">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <UploadOutlined className="text-blue-500 text-xl" />
                        </div>
                        <Text type="secondary" className="text-xs">Haz clic para subir evidencia</Text>
                      </div>
                    </Upload>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">Ejecución de Pruebas</Title>
          <Text type="secondary" className="text-slate-500">Registra y monitorea los resultados de las ejecuciones de pruebas manuales y automatizadas.</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg h-10 px-6"
        >
          Crear Ejecución de Pruebas
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado</span>
            <Select
              placeholder="Todos"
              className="w-40 h-10"
              allowClear
              onChange={setStatusFilter}
              options={Object.values(ExecutionStatus).map(s => ({ label: labelExecutionStatus(s, t), value: s }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sprint</span>
            <Select
              placeholder="Todos"
              className="w-40 h-10"
              allowClear
              onChange={setSprintFilter}
              options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
            />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl shadow-sm border-slate-100" title={<span className="text-slate-800 font-bold">Historial de Ejecuciones</span>}>
        <Table 
          columns={columns} 
          dataSource={filteredRuns} 
          rowKey="id" 
          className="executive-table"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title={<span className="text-xl font-bold text-slate-800">Nueva Ejecución de Pruebas</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={800}
        centered
        footer={[
          <Button key="cancel" onClick={() => setIsModalOpen(false)}>Cancelar</Button>,
          <Button key="create" type="primary" onClick={handleCreateTestRun}>Crear Ejecución de Pruebas</Button>
        ]}
      >
        <Form form={form} layout="vertical" initialValues={{ executionDate: dayjs(), testType: TestType.FUNCTIONAL, priority: Priority.MEDIUM }}>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="title" label="Título de la Ejecución" rules={[{ required: true }]}>
                <Input placeholder="Ej: Regresión Módulo de Pagos - Sprint 25" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="testType" label="Tipo de Test" rules={[{ required: true }]}>
                <Select className="h-10 rounded-lg" options={Object.values(TestType).map(v => ({ label: v, value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="executionDate" label="Fecha de Ejecución" rules={[{ required: true }]}>
                <DatePicker className="w-full h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sprint" label="Sprint" rules={[{ required: true }]}>
                <Select 
                  placeholder="Selecciona el Sprint" 
                  className="h-10 rounded-lg"
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
                <Select options={Object.values(Priority).map(v => ({ label: labelPriority(v, t), value: v }))} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tester" label="Tester" rules={[{ required: true }]}>
                <Input placeholder="Ej: QA Engineer" className="h-10 rounded-lg" prefix={<UserOutlined />} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="environment" label="Environment" rules={[{ required: true }]}>
                <Select
                  placeholder="Selecciona el Environment"
                  className="h-10 rounded-lg"
                  options={[
                    { label: Environment.TEST, value: Environment.TEST },
                    { label: Environment.LOCAL, value: Environment.LOCAL },
                    { label: Environment.PRODUCTION, value: Environment.PRODUCTION },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="buildVersion" label="Build version">
                <Input placeholder="Ej: v1.2.3 (1234)" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Seleccionar Módulos Relacionados" required>
            <Select
              mode="multiple"
              placeholder="Selecciona uno o más módulos"
              className="w-full rounded-lg"
              onChange={setSelectedModules}
              value={selectedModules}
              options={modulesData.map(m => ({ label: m.name, value: m.name }))}
            />
          </Form.Item>

          {selectedModules.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Funcionalidades por Módulo</span>
                <Space>
                  <Button 
                    size="small" 
                    type="link" 
                    onClick={() => setSelectedFuncIds(availableFunctionalities.map(f => f.id))}
                    className="text-[11px] p-0"
                  >
                    Seleccionar Todas
                  </Button>
                  <Divider type="vertical" />
                  <Button 
                    size="small" 
                    type="link" 
                    danger
                    onClick={() => setSelectedFuncIds([])}
                    className="text-[11px] p-0"
                  >
                    Limpiar Selección
                  </Button>
                </Space>
              </div>
              
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(groupedFunctionalities).map(([moduleName, funcs]) => {
                  const moduleFuncIds = funcs.map(f => f.id);
                  const selectedInModule = selectedFuncIds.filter(id => moduleFuncIds.includes(id));
                  const isAllSelected = selectedInModule.length === moduleFuncIds.length;
                  
                  return (
                    <div key={moduleName} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                      <div className="bg-white px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                        <Space>
                          <Checkbox 
                            indeterminate={selectedInModule.length > 0 && selectedInModule.length < moduleFuncIds.length}
                            checked={isAllSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedFuncIds(prev => Array.from(new Set([...prev, ...moduleFuncIds])));
                              } else {
                                setSelectedFuncIds(prev => prev.filter(id => !moduleFuncIds.includes(id)));
                              }
                            }}
                          />
                          <span className="font-bold text-slate-700 text-sm">{moduleName}</span>
                          <Tag className="m-0 text-[10px] rounded-full bg-slate-100 border-none text-slate-500">
                            {selectedInModule.length} / {moduleFuncIds.length}
                          </Tag>
                        </Space>
                      </div>
                      <div className="p-4">
                        <Checkbox.Group 
                          className="w-full" 
                          value={selectedFuncIds} 
                          onChange={(vals) => setSelectedFuncIds(vals as string[])}
                        >
                          <Row gutter={[12, 12]}>
                            {funcs.map(item => (
                              <Col span={12} key={item.id}>
                                <div className={`p-2 rounded-lg border transition-all ${selectedFuncIds.includes(item.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                  <Checkbox value={item.id} className="w-full">
                                    <div className="flex flex-col ml-1">
                                      <span className="font-bold text-slate-800 text-xs leading-tight">{item.id}</span>
                                      <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={item.name}>
                                        {item.name}
                                      </span>
                                    </div>
                                  </Checkbox>
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </Checkbox.Group>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Form.Item name="description" label="Descripción / Objetivo" className="mt-4">
            <Input.TextArea rows={2} placeholder="Objetivo de esta ejecución..." className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
