import React, { useState, useRef } from 'react';
import { Card, Typography, Row, Col, Select, DatePicker, Checkbox, Button, Space, Tag, Table, Progress, Breadcrumb, message, Alert, List, Input } from 'antd';
import { 
  FileTextOutlined, 
  FilterOutlined, 
  RocketOutlined, 
  CheckCircleOutlined, 
  DownloadOutlined, 
  FileWordOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  BarChartOutlined,
  PieChartOutlined,
  HistoryOutlined,
  BulbOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useFunctionalities, useExecutions, useRegressionCycles } from '../hooks';
import { TestResult, TestStatus, TestType, ExecutionStatus } from '../types';
import dayjs from 'dayjs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table as DocxTable, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

const { Title, Text, Paragraph: AntParagraph } = Typography;

enum ReportType {
  STATUS_SUMMARY = 'QA STATUS SUMMARY',
  PROGRESS_REPORT = 'QA PROGRESS REPORT',
}

export default function Reports({ projectId }: { projectId?: string }) {
  const [step, setStep] = useState<'config' | 'view'>('config');
  const [reportType, setReportType] = useState<ReportType>(ReportType.STATUS_SUMMARY);
  const [projectSummary, setProjectSummary] = useState('The current QA cycle focuses on the integration of the payment gateway and user authentication modules. Testing is 85% complete with no major blockers identified in the core services.');
  const [bugs, setBugs] = useState([
    { id: 'BUG-4021', description: 'Auth bypass on session timeout via redirect URL', module: 'Security', severity: 'CRITICAL', status: 'Fix in progress' },
    { id: 'BUG-3988', description: 'Payment gateway returning 500 on recurring billing', module: 'Billing', severity: 'BLOCKER', status: 'Reported' },
    { id: 'BUG-4052', description: 'Data loss during background autosave on slow connections', module: 'Editor', severity: 'HIGH', status: 'Reopened' },
  ]);
  const [filters, setFilters] = useState({
    sprint: undefined as string | undefined,
    module: undefined as string | undefined,
    cycle: undefined as string | undefined,
    dateRange: null as any
  });
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: functionalitiesData } = useFunctionalities(projectId);
  const { data: executionsData } = useExecutions(projectId);
  const { data: regressionCyclesData } = useRegressionCycles(projectId);

  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  const executions = Array.isArray(executionsData) ? executionsData : [];
  const regressionCycles = Array.isArray(regressionCyclesData) ? regressionCyclesData : [];

  const modules = Array.from(new Set(functionalities.map(f => f.module)));
  const sprints = Array.from(new Set(regressionCycles.map(c => c.sprint).filter(Boolean)));

  // Filtered data based on selection
  const filteredFunctionalities = functionalities.filter(f => {
    const moduleMatch = filters.module === 'all' || f.module === filters.module;
    // For sprint filtering, we need to check if the functionality is part of a cycle in that sprint
    // or if we just want to show all functionalities of a module.
    // Usually functionalities are linked to cycles which are linked to sprints.
    return moduleMatch;
  });

  const filteredExecutions = executions.filter(e => {
    const func = functionalities.find(f => f.id === e.functionalityId);
    const moduleMatch = filters.module === 'all' || (func && func.module === filters.module);
    const sprintMatch = !filters.sprint || e.sprint === filters.sprint;
    return moduleMatch && sprintMatch;
  });

  const handleGenerate = () => {
    if (!filters.sprint || !filters.module) {
      message.error('Sprint y Módulo son campos requeridos');
      return;
    }
    message.loading({ content: 'Generando reporte...', key: 'gen_report' });
    setTimeout(() => {
      message.success({ content: 'Reporte generado con éxito', key: 'gen_report', duration: 2 });
      setStep('view');
    }, 1500);
  };

  const handleDownloadDOCX = async () => {
    const hide = message.loading('Generando documento Word...', 0);
    try {
      const isDetailed = reportType === ReportType.PROGRESS_REPORT;
      
      const children = [
        new Paragraph({
          text: reportType,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on: ${dayjs().format('MMM DD, YYYY')}`,
              bold: true,
            }),
          ],
          alignment: AlignmentType.RIGHT,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Project Summary",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: projectSummary,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Testing Metrics",
          heading: HeadingLevel.HEADING_1,
        }),
        new DocxTable({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Metric", bold: true })] })], shading: { fill: "F2F2F2" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Value", bold: true })] })], shading: { fill: "F2F2F2" } }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Total Functionalities")] }),
                new TableCell({ children: [new Paragraph(filteredFunctionalities.length.toString())] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Tested")] }),
                new TableCell({ children: [new Paragraph(filteredExecutions.filter(e => e.executed).length.toString())] }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph("Pass Rate")] }),
                new TableCell({ children: [new Paragraph(filteredExecutions.length > 0 ? `${((filteredExecutions.filter(e => e.result === TestResult.PASSED).length / filteredExecutions.length) * 100).toFixed(1)}%` : "0%")] }),
              ],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "Functionalities List",
          heading: HeadingLevel.HEADING_1,
        }),
        new DocxTable({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Module", bold: true })] })], shading: { fill: "F2F2F2" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Functionality", bold: true })] })], shading: { fill: "F2F2F2" } }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })] })], shading: { fill: "F2F2F2" } }),
              ],
            }),
            ...filteredFunctionalities.map(f => {
              const exec = filteredExecutions.find(e => e.functionalityId === f.id);
              return new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(f.module)] }),
                  new TableCell({ children: [new Paragraph(f.name)] }),
                  new TableCell({ children: [new Paragraph(exec ? exec.result : "NOT EXECUTED")] }),
                ],
              });
            })
          ],
        }),
      ];

      if (isDetailed || bugs.length > 0) {
        children.push(
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "Critical Issues",
            heading: HeadingLevel.HEADING_1,
          }),
          new DocxTable({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ID", bold: true })] })], shading: { fill: "F2F2F2" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })], shading: { fill: "F2F2F2" } }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Severity", bold: true })] })], shading: { fill: "F2F2F2" } }),
                ],
              }),
              ...bugs.map(b => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(b.id)] }),
                  new TableCell({ children: [new Paragraph(b.description)] }),
                  new TableCell({ children: [new Paragraph(b.severity)] }),
                ],
              }))
            ],
          })
        );
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${reportType.toLowerCase().replace(/ /g, '_')}_${dayjs().format('YYYYMMDD')}.docx`);
      message.success('DOCX descargado correctamente');
    } catch (error) {
      console.error('DOCX generation failed:', error);
      message.error('Error al generar el documento Word');
    } finally {
      hide();
    }
  };

  if (step === 'view') {
    return (
      <div className="space-y-6 pb-10">
        <div className="flex justify-between items-center">
          <Breadcrumb 
            items={[
              { title: <span className="cursor-pointer" onClick={() => setStep('config')}>Reportes</span> },
              { title: reportType === ReportType.STATUS_SUMMARY ? 'QA Status Summary' : 'QA Progress Report' }
            ]} 
          />
          <Space>
            <Button type="primary" icon={<FileWordOutlined />} className="bg-blue-600 h-10 rounded-xl font-bold" onClick={handleDownloadDOCX}>Download DOCX</Button>
          </Space>
        </div>

        <div ref={reportRef} className="bg-white p-4 rounded-2xl shadow-sm">
          {reportType === ReportType.STATUS_SUMMARY ? (
            <Card className="rounded-2xl shadow-lg border-none p-8">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <Title level={1} className="m-0 text-slate-800 uppercase tracking-tight">{reportType}</Title>
                  <Text italic className="text-slate-400 text-lg">Short Report</Text>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Report Date</div>
                  <div className="text-lg font-bold text-slate-800">{dayjs().format('MMM DD, YYYY')}</div>
                </div>
              </div>

              <Row gutter={32} className="mb-12 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <Col span={8}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Project Name</div>
                  <div className="text-blue-600 font-bold text-lg">Nexus Core Platform</div>
                </Col>
                <Col span={8}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">System Version</div>
                  <div className="text-slate-800 font-bold text-lg">v2.4.0-stable</div>
                </Col>
                <Col span={8}>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Sprint</div>
                  <div className="text-slate-800 font-bold text-lg">{filters.sprint || 'N/A'}</div>
                </Col>
              </Row>

              <Alert
                className="rounded-xl bg-blue-50 border-blue-100 mb-10 p-6"
                message={<Title level={5} className="m-0 text-slate-800"><InfoCircleOutlined className="text-blue-500 mr-2" /> Project Summary</Title>}
                description={
                  <AntParagraph className="text-slate-600 mt-2 mb-0">
                    {projectSummary}
                  </AntParagraph>
                }
                type="info"
              />

              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircleOutlined className="text-blue-600 text-xl" />
                  <Title level={4} className="m-0">Overall System Status</Title>
                </div>
                <Row gutter={16}>
                  <Col span={8}>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex justify-between items-center">
                      <Text strong className="text-emerald-700 uppercase text-xs">Development</Text>
                      <Tag color="success" className="m-0 font-bold">COMPLETED</Tag>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex justify-between items-center">
                      <Text strong className="text-amber-700 uppercase text-xs">QA Progress</Text>
                      <Tag color="warning" className="m-0 font-bold">IN PROGRESS (82%)</Tag>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex justify-between items-center">
                      <Text strong className="text-slate-700 uppercase text-xs">Regression Status</Text>
                      <Tag color="default" className="m-0 font-bold">PENDING</Tag>
                    </div>
                  </Col>
                </Row>
              </div>

              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <BarChartOutlined className="text-blue-600 text-xl" />
                  <Title level={4} className="m-0">Testing Metrics</Title>
                </div>
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <Card className="bg-slate-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Functionalities</div>
                      <div className="text-3xl font-bold text-slate-800">{functionalities.length}</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-slate-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tested</div>
                      <div className="text-3xl font-bold text-slate-800">{executions.filter(e => e.executed).length}</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-slate-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Test Cases</div>
                      <div className="text-3xl font-bold text-slate-800">850</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-blue-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Coverage %</div>
                      <div className="text-3xl font-bold text-blue-600">94.2%</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-emerald-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Passed</div>
                      <div className="text-3xl font-bold text-emerald-600">{executions.filter(e => e.result === TestResult.PASSED).length}</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-rose-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Failed</div>
                      <div className="text-3xl font-bold text-rose-600">{executions.filter(e => e.result === TestResult.FAILED).length}</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-amber-50 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Blocked</div>
                      <div className="text-3xl font-bold text-amber-600">{executions.filter(e => e.result === TestResult.BLOCKED).length}</div>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card className="bg-slate-100 border-none rounded-xl">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Executed</div>
                      <div className="text-3xl font-bold text-slate-800">{executions.length}</div>
                    </Card>
                  </Col>
                </Row>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-6">
                  <WarningOutlined className="text-rose-600 text-xl" />
                  <Title level={4} className="m-0">Critical Issues</Title>
                </div>
                <Table 
                  pagination={false}
                  className="executive-table mb-10"
                  columns={[
                    { title: 'ID', dataIndex: 'id', key: 'id', render: (text) => <Text strong>{text}</Text> },
                    { title: 'DESCRIPTION', dataIndex: 'description', key: 'description' },
                    { title: 'MODULE', dataIndex: 'module', key: 'module' },
                    { 
                      title: 'SEVERITY', 
                      dataIndex: 'severity', 
                      key: 'severity',
                      render: (sev) => (
                        <Tag color={sev === 'CRITICAL' ? 'error' : sev === 'BLOCKER' ? 'volcano' : 'orange'} className="font-bold">
                          {sev}
                        </Tag>
                      )
                    },
                    { title: 'STATUS', dataIndex: 'status', key: 'status', render: (s) => <Text italic className="text-slate-400">{s}</Text> },
                  ]}
                  dataSource={bugs}
                />

                <div className="flex items-center gap-2 mb-6">
                  <FileTextOutlined className="text-blue-600 text-xl" />
                  <Title level={4} className="m-0">Functionalities List</Title>
                </div>
                <Table 
                  pagination={false}
                  className="executive-table"
                  columns={[
                    { title: 'MODULE', dataIndex: 'module', key: 'module' },
                    { title: 'FUNCTIONALITY', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
                    { 
                      title: 'STATUS', 
                      dataIndex: 'status', 
                      key: 'status',
                      render: (_, record) => {
                        const exec = filteredExecutions.find(e => e.functionalityId === record.id);
                        const result = exec ? exec.result : 'NOT EXECUTED';
                        return (
                          <Tag color={result === TestResult.PASSED ? 'success' : result === TestResult.FAILED ? 'error' : result === TestResult.BLOCKED ? 'warning' : 'default'}>
                            {result}
                          </Tag>
                        );
                      }
                    },
                  ]}
                  dataSource={filteredFunctionalities}
                />
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl shadow-lg border-none p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <Title level={1} className="m-0 text-slate-800 uppercase tracking-tight">Detailed Report</Title>
                  <Text className="text-blue-600 font-bold text-lg">Project ID: QA-2023-08-15</Text>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated on: Oct 24, 2023</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reporting Period: Oct 01 - Oct 23</div>
                </div>
              </div>

              <Alert
                className="rounded-xl bg-blue-50 border-blue-100 mb-10 p-6"
                message={<Title level={5} className="m-0 text-slate-800"><InfoCircleOutlined className="text-blue-500 mr-2" /> Project Summary</Title>}
                description={
                  <AntParagraph className="text-slate-600 mt-2 mb-0">
                    {projectSummary}
                  </AntParagraph>
                }
                type="info"
              />

              <Row gutter={16} className="mb-12">
                <Col span={4.8} style={{ width: '20%' }}>
                  <Card className="bg-slate-50 border-none rounded-xl text-center py-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-xs">TOTAL FUNC.</div>
                    <div className="text-3xl font-bold text-slate-800">142</div>
                  </Card>
                </Col>
                <Col span={4.8} style={{ width: '20%' }}>
                  <Card className="bg-blue-50 border-none rounded-xl text-center py-4">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 text-xs">TESTED FUNC.</div>
                    <div className="text-3xl font-bold text-blue-600">121</div>
                  </Card>
                </Col>
                <Col span={4.8} style={{ width: '20%' }}>
                  <Card className="bg-slate-50 border-none rounded-xl text-center py-4">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1 text-xs">COVERAGE</div>
                    <div className="text-3xl font-bold text-blue-600">85.2%</div>
                  </Card>
                </Col>
                <Col span={4.8} style={{ width: '20%' }}>
                  <Card className="bg-slate-50 border-none rounded-xl text-center py-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-xs">TOTAL TCS</div>
                    <div className="text-3xl font-bold text-slate-800">856</div>
                  </Card>
                </Col>
                <Col span={4.8} style={{ width: '20%' }}>
                  <Card className="bg-emerald-50 border-none rounded-xl text-center py-4">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 text-xs">PASS RATE</div>
                    <div className="text-3xl font-bold text-emerald-600">94.8%</div>
                  </Card>
                </Col>
              </Row>

              <div className="mb-12">
                <Title level={4} className="mb-6">Module Testing Status</Title>
                <Table 
                  pagination={false}
                  className="executive-table mb-10"
                  columns={[
                    { title: 'Module Name', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
                    { 
                      title: 'Status', 
                      dataIndex: 'status', 
                      key: 'status',
                      render: (s) => (
                        <Tag color={s === 'COMPLETED' ? 'success' : s === 'IN PROGRESS' ? 'processing' : s === 'ON HOLD' ? 'warning' : 'default'} className="font-bold rounded-full px-3">
                          {s}
                        </Tag>
                      )
                    },
                    { title: 'Coverage %', dataIndex: 'coverage', key: 'coverage', render: (c) => <Text strong>{c}%</Text> },
                    { title: 'Notes', dataIndex: 'notes', key: 'notes' },
                  ]}
                  dataSource={[
                    { name: 'User Authentication', status: 'COMPLETED', coverage: 100, notes: 'Full OAuth2 coverage verified.' },
                    { name: 'Payment Gateway', status: 'IN PROGRESS', coverage: 78, notes: 'Testing Stripe integration webhooks.' },
                    { name: 'User Profile Management', status: 'ON HOLD', coverage: 45, notes: 'Waiting for UI asset finalization.' },
                    { name: 'Reporting Dashboard', status: 'PENDING', coverage: 0, notes: 'Scheduled for Week 4.' },
                  ]}
                />

                <div className="flex items-center gap-2 mb-6">
                  <FileTextOutlined className="text-blue-600 text-xl" />
                  <Title level={4} className="m-0">Functionalities List</Title>
                </div>
                <Table 
                  pagination={false}
                  className="executive-table"
                  columns={[
                    { title: 'MODULE', dataIndex: 'module', key: 'module' },
                    { title: 'FUNCTIONALITY', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
                    { 
                      title: 'STATUS', 
                      dataIndex: 'status', 
                      key: 'status',
                      render: (_, record) => {
                        const exec = filteredExecutions.find(e => e.functionalityId === record.id);
                        const result = exec ? exec.result : 'NOT EXECUTED';
                        return (
                          <Tag color={result === TestResult.PASSED ? 'success' : result === TestResult.FAILED ? 'error' : result === TestResult.BLOCKED ? 'warning' : 'default'}>
                            {result}
                          </Tag>
                        );
                      }
                    },
                  ]}
                  dataSource={filteredFunctionalities}
                />
              </div>

              <Row gutter={32} className="mb-12">
                <Col span={12}>
                  <Title level={4} className="mb-6">Bug Summary</Title>
                  <Table 
                    pagination={false}
                    className="executive-table"
                    columns={[
                      { title: 'SEVERITY', dataIndex: 'severity', key: 'severity', render: (s) => <Text strong className={s === 'Critical' ? 'text-rose-600' : s === 'Major' ? 'text-orange-600' : s === 'Minor' ? 'text-amber-600' : ''}>{s}</Text> },
                      { title: 'TOTAL', dataIndex: 'total', key: 'total', align: 'center' },
                      { title: 'OPEN', dataIndex: 'open', key: 'open', align: 'center' },
                      { title: 'FIXED', dataIndex: 'fixed', key: 'fixed', align: 'center' },
                    ]}
                    dataSource={[
                      { severity: 'Critical', total: 4, open: 1, fixed: 3 },
                      { severity: 'Major', total: 12, open: 4, fixed: 8 },
                      { severity: 'Minor', total: 28, open: 12, fixed: 16 },
                      { severity: 'Total', total: 44, open: 17, fixed: 27 },
                    ]}
                  />
                </Col>
                <Col span={12}>
                  <Title level={4} className="mb-6">Regression History</Title>
                  <div className="space-y-4">
                    {[
                      { id: 'Cycle R-14.2', date: 'Oct 15, 2023', rate: '98%', failures: 2 },
                      { id: 'Cycle R-14.1', date: 'Oct 08, 2023', rate: '95%', failures: 6 },
                      { id: 'Cycle R-13.9', date: 'Oct 01, 2023', rate: '92%', failures: 11 },
                    ].map(item => (
                      <div key={item.id} className="p-4 border border-slate-100 rounded-xl flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div>
                          <Text strong className="block text-lg">{item.id}</Text>
                          <Text type="secondary" className="text-xs">{item.date}</Text>
                        </div>
                        <div className="text-right">
                          <Text strong className="text-emerald-600 block text-lg">{item.rate} Pass Rate</Text>
                          <Text type="secondary" className="text-xs uppercase font-bold">{item.failures} FAILURES</Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </Col>
              </Row>

              <Row gutter={32}>
                <Col span={12}>
                  <div className="flex items-center gap-2 mb-6">
                    <WarningOutlined className="text-rose-600 text-xl" />
                    <Title level={4} className="m-0">Risks or Blockers</Title>
                  </div>
                  <List
                    className="bg-rose-50/30 border-none rounded-xl"
                    dataSource={[
                      "Third-party Sandbox API for 'International Transfers' is currently unstable, delaying integration tests.",
                      "Limited availability of iOS 17 physical devices for mobile responsive testing."
                    ]}
                    renderItem={item => (
                      <List.Item className="border-none px-6 py-4">
                        <div className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-rose-400 mt-2 shrink-0" />
                          <Text className="text-slate-600">{item}</Text>
                        </div>
                      </List.Item>
                    )}
                  />
                </Col>
                <Col span={12}>
                  <div className="flex items-center gap-2 mb-6">
                    <RocketOutlined className="text-blue-600 text-xl" />
                    <Title level={4} className="m-0">Next Testing Activities</Title>
                  </div>
                  <List
                    className="bg-blue-50/30 border-none rounded-xl"
                    dataSource={[
                      "Final sanity check on the production-ready build (v2.4.0).",
                      "Load testing on the Payment microservice with 10k concurrent users.",
                      "Cross-browser testing on Safari and Firefox latest versions."
                    ]}
                    renderItem={item => (
                      <List.Item className="border-none px-6 py-4">
                        <div className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
                          <Text className="text-slate-600">{item}</Text>
                        </div>
                      </List.Item>
                    )}
                  />
                </Col>
              </Row>
            </Card>
          )}
        </div>
        
        <div className="text-center mt-10 text-slate-400 text-xs">
          © 2023 Quality Assurance Department. Confidential Document.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <Title level={2} className="m-0 font-bold text-slate-800">Generar Reportes de Proyecto</Title>
        <Text type="secondary" className="text-slate-500">Configure los parámetros para la generación de informes detallados de calidad.</Text>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600 font-bold">
          <PieChartOutlined />
          <span className="uppercase tracking-wider text-xs">Seleccionar Tipo de Reporte</span>
        </div>
        <Row gutter={24}>
          <Col span={12}>
            <Card 
              className={`rounded-2xl cursor-pointer transition-all border-2 ${reportType === ReportType.STATUS_SUMMARY ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-200'}`}
              onClick={() => setReportType(ReportType.STATUS_SUMMARY)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <Title level={5} className="m-0 uppercase text-slate-800">QA Status Summary</Title>
                  <AntParagraph className="text-slate-500 text-xs mt-2 mb-4">
                    Resumen ejecutivo con KPIs principales y estado de ejecución.
                  </AntParagraph>
                  <Tag className="bg-blue-100 text-blue-600 border-none rounded-md px-3">Formato Corto</Tag>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${reportType === ReportType.STATUS_SUMMARY ? 'border-blue-500 bg-blue-500' : 'border-slate-200'}`}>
                  {reportType === ReportType.STATUS_SUMMARY && <CheckCircleOutlined className="text-white text-xs" />}
                </div>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card 
              className={`rounded-2xl cursor-pointer transition-all border-2 ${reportType === ReportType.PROGRESS_REPORT ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-200'}`}
              onClick={() => setReportType(ReportType.PROGRESS_REPORT)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <Title level={5} className="m-0 uppercase text-slate-800">QA Progress Report</Title>
                  <AntParagraph className="text-slate-500 text-xs mt-2 mb-4">
                    Desglose detallado por módulos, bugs encontrados y trazabilidad.
                  </AntParagraph>
                  <Tag className="bg-slate-100 text-slate-500 border-none rounded-md px-3">Formato Detallado</Tag>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${reportType === ReportType.PROGRESS_REPORT ? 'border-blue-500 bg-blue-500' : 'border-slate-200'}`}>
                  {reportType === ReportType.PROGRESS_REPORT && <CheckCircleOutlined className="text-white text-xs" />}
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 p-8">
        <div className="flex items-center gap-2 text-blue-600 font-bold mb-8">
          <FilterOutlined />
          <span className="uppercase tracking-wider text-xs">Filtros de Reporte</span>
        </div>
        
        <Row gutter={[32, 32]}>
          <Col span={12}>
            <div className="flex flex-col gap-2">
              <Text strong className="text-slate-600">Sprint <span className="text-red-500">*</span></Text>
              <Select 
                placeholder="Seleccionar Sprint" 
                className="h-12 w-full"
                value={filters.sprint}
                onChange={(val) => setFilters({ ...filters, sprint: val })}
                options={[
                  { label: 'Sprint 42 - Q3 Release', value: 's42' },
                  { label: 'Sprint 41 - Hotfix Cycle', value: 's41' },
                  ...sprints.map(s => ({ label: s, value: s }))
                ]}
              />
            </div>
          </Col>
          <Col span={12}>
            <div className="flex flex-col gap-2">
              <Text strong className="text-slate-600">Módulo <span className="text-red-500">*</span></Text>
              <Select 
                placeholder="Seleccionar módulo" 
                className="h-12 w-full"
                value={filters.module}
                onChange={(val) => setFilters({ ...filters, module: val })}
                options={[
                  { label: 'Todos los módulos', value: 'all' },
                  ...modules.map(m => ({ label: m, value: m }))
                ]}
              />
            </div>
          </Col>
          <Col span={24}>
            <div className="flex flex-col gap-2">
              <Text strong className="text-slate-600">Resumen del Proyecto (Summary)</Text>
              <Input.TextArea 
                rows={4} 
                className="rounded-xl"
                value={projectSummary}
                onChange={(e) => setProjectSummary(e.target.value)}
                placeholder="Ingrese un resumen del estado actual del proyecto..."
              />
            </div>
          </Col>
          <Col span={12}>
            <div className="flex flex-col gap-2">
              <Text strong className="text-slate-600">Ciclo de Regresión</Text>
              <Select 
                placeholder="Seleccionar Ciclo" 
                className="h-12 w-full"
                value={filters.cycle}
                onChange={(val) => setFilters({ ...filters, cycle: val })}
                options={[
                  { label: 'Regresión Full - v2.4.0', value: 'v240' },
                  ...regressionCycles.map(c => ({ label: `Ciclo ${c.cycleId} - ${c.date}`, value: c.id }))
                ]}
              />
            </div>
          </Col>
          <Col span={12}>
            <div className="flex flex-col gap-2">
              <Text strong className="text-slate-600">Rango de Fechas</Text>
              <DatePicker.RangePicker 
                className="h-12 w-full rounded-lg" 
                value={filters.dateRange}
                onChange={(val) => setFilters({ ...filters, dateRange: val })}
              />
            </div>
          </Col>
        </Row>

        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <Text strong className="text-slate-600 uppercase tracking-wider text-xs">Gestión de Defectos (Bugs en Reporte)</Text>
            <Button size="small" type="dashed" onClick={() => setBugs([...bugs, { id: `BUG-${Math.floor(Math.random() * 10000)}`, description: 'Nuevo defecto...', module: 'General', severity: 'MEDIUM', status: 'Reported' }])}>
              + Agregar Bug
            </Button>
          </div>
          <Table 
            size="small"
            pagination={false}
            dataSource={bugs}
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id', width: 120, render: (t, _, i) => <Input value={t} onChange={e => {
                const newBugs = [...bugs];
                newBugs[i].id = e.target.value;
                setBugs(newBugs);
              }} /> },
              { title: 'DESCRIPCIÓN', dataIndex: 'description', key: 'description', render: (t, _, i) => <Input value={t} onChange={e => {
                const newBugs = [...bugs];
                newBugs[i].description = e.target.value;
                setBugs(newBugs);
              }} /> },
              { title: 'SEVERIDAD', dataIndex: 'severity', key: 'severity', width: 150, render: (t, _, i) => (
                <Select value={t} className="w-full" onChange={val => {
                  const newBugs = [...bugs];
                  newBugs[i].severity = val;
                  setBugs(newBugs);
                }} options={[
                  { label: 'CRITICAL', value: 'CRITICAL' },
                  { label: 'BLOCKER', value: 'BLOCKER' },
                  { label: 'HIGH', value: 'HIGH' },
                  { label: 'MEDIUM', value: 'MEDIUM' },
                  { label: 'LOW', value: 'LOW' },
                ]} />
              )},
              { title: '', key: 'action', width: 50, render: (_, __, i) => <Button type="text" danger onClick={() => setBugs(bugs.filter((_, index) => index !== i))}>x</Button> }
            ]}
          />
        </div>
      </Card>

      <div className="flex justify-end items-center gap-4">
        <Button size="large" className="px-8 rounded-xl border-none text-slate-500 hover:text-slate-700">Cancelar</Button>
        <Button 
          type="primary" 
          size="large" 
          icon={<RocketOutlined />} 
          className="px-10 rounded-xl bg-blue-600 h-12 flex items-center font-bold"
          onClick={handleGenerate}
        >
          Generar Reporte
        </Button>
      </div>

      <Alert
        className="rounded-xl bg-blue-50 border-blue-100"
        message={
          <div className="text-blue-600 text-xs">
            La generación del reporte detallado puede tomar hasta 2 minutos dependiendo del volumen de datos del Sprint seleccionado.
            Recibirás una notificación en el panel superior cuando esté listo.
          </div>
        }
        type="info"
        showIcon
        icon={<InfoCircleOutlined className="text-blue-400" />}
      />
    </div>
  );
}
