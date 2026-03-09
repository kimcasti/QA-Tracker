import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Row, Col, Divider, Typography, Upload, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { Users } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { useFunctionalities } from '../hooks';
import { Functionality, TestStatus, TestType } from '../types';
import type { InputRef } from 'antd';
import * as XLSX from 'xlsx';

export default function FunctionalityList({ filter, projectId }: { filter?: 'regression' | 'smoke', projectId?: string }) {
  const { data: functionalitiesData, save, delete: deleteFunc, bulkUpdate, bulkAdd } = useFunctionalities(projectId);
  const allFunctionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];
  
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);
  const [testTypeFilter, setTestTypeFilter] = useState<TestType | null>(null);
  const [statusFilter, setStatusFilter] = useState<TestStatus | null>(null);

  const functionalities = allFunctionalities.filter(f => {
    if (!f) return false;
    
    const matchesBaseFilter = !filter || (filter === 'regression' ? f.isRegression : f.isSmoke);
    const matchesModule = !moduleFilter || f.module === moduleFilter;
    const matchesTestType = !testTypeFilter || (Array.isArray(f.testTypes) && f.testTypes.includes(testTypeFilter));
    const matchesStatus = !statusFilter || f.status === statusFilter;
    
    return matchesBaseFilter && matchesModule && matchesTestType && matchesStatus;
  });

  const modules = Array.from(new Set(allFunctionalities.map(f => f?.module).filter(Boolean))).sort();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingFunc, setEditingFunc] = useState<Functionality | null>(null);
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Dynamic Roles State
  const [items, setItems] = useState(['Administrador', 'Usuario', 'Todos', 'Manejador de Seguimiento', 'Coordinador de Citas']);
  const [name, setName] = useState('');
  const inputRef = useRef<InputRef>(null);

  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const addItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    if (name && !items.includes(name)) {
      setItems([...items, name]);
      // Auto-select the new item
      const currentRoles = form.getFieldValue('roles') || [];
      form.setFieldsValue({ roles: [...currentRoles, name] });
      setName('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const columns = [
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ID</span>, 
      dataIndex: 'id', 
      key: 'id' 
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Módulo</span>, 
      dataIndex: 'module', 
      key: 'module' 
    },
    { 
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Funcionalidad</span>, 
      dataIndex: 'name', 
      key: 'name' 
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ROLES</span>,
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Users size={16} className="text-slate-400" />
          <span className="text-sm font-medium">
            {roles?.join(', ') || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">PRUEBAS APLICADAS</span>,
      dataIndex: 'testTypes',
      key: 'testTypes',
      render: (types: TestType[]) => {
        const typeColors: Record<string, { bg: string, text: string }> = {
          [TestType.INTEGRATION]: { bg: 'bg-slate-100', text: 'text-blue-600' },
          [TestType.FUNCTIONAL]: { bg: 'bg-cyan-50', text: 'text-cyan-700' },
          [TestType.SANITY]: { bg: 'bg-slate-50', text: 'text-slate-700' },
          [TestType.REGRESSION]: { bg: 'bg-purple-50', text: 'text-purple-700' },
          [TestType.SMOKE]: { bg: 'bg-orange-50', text: 'text-orange-700' },
          [TestType.EXPLORATORY]: { bg: 'bg-slate-100', text: 'text-slate-800' },
          [TestType.UAT]: { bg: 'bg-gray-100', text: 'text-gray-800' },
        };

        return (
          <div className="flex flex-wrap gap-1">
            {types?.map(type => {
              const config = typeColors[type] || { bg: 'bg-gray-100', text: 'text-gray-600' };
              return (
                <span 
                  key={type} 
                  className={`px-2 py-0.5 rounded-md text-[12px] font-medium ${config.bg} ${config.text} border border-transparent`}
                >
                  {type}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ESTADO DESARR.</span>,
      dataIndex: 'status',
      key: 'status',
      render: (status: TestStatus) => {
        const config = {
          [TestStatus.BACKLOG]: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
          [TestStatus.IN_PROGRESS]: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
          [TestStatus.COMPLETED]: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
          [TestStatus.FAILED]: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
        }[status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };

        return (
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.text} text-xs font-bold`}>
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {status}
          </div>
        );
      },
    },
    {
      title: <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ACCIONES</span>,
      key: 'actions',
      render: (_: any, record: Functionality) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} className="rounded-lg" />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} className="rounded-lg" />
        </Space>
      ),
    },
  ];

  const handleEdit = (func: Functionality) => {
    setEditingFunc(func);
    form.setFieldsValue(func);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '¿Estás seguro de eliminar esta funcionalidad?',
      onOk: () => deleteFunc(id),
      okButtonProps: { danger: true },
      centered: true,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Ensure ID is generated if empty (though it's required and auto-filled)
      const finalId = values.id || generateId(values.module);

      const isRegression = values.testTypes?.includes(TestType.REGRESSION) || false;
      const isSmoke = values.testTypes?.includes(TestType.SMOKE) || false;

      save({ 
        ...editingFunc, 
        ...values,
        id: finalId,
        isRegression,
        isSmoke
      });
      setIsModalOpen(false);
      form.resetFields();
      setEditingFunc(null);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleBulkSave = async () => {
    try {
      const values = await bulkForm.validateFields();
      const updates: Partial<Functionality> = {};
      
      if (values.roles) updates.roles = values.roles;
      if (values.testTypes) {
        updates.testTypes = values.testTypes;
        updates.isRegression = values.testTypes.includes(TestType.REGRESSION);
        updates.isSmoke = values.testTypes.includes(TestType.SMOKE);
      }
      if (values.status) updates.status = values.status;

      if (Object.keys(updates).length > 0) {
        await bulkUpdate({ ids: selectedRowKeys as string[], updates });
        setIsBulkModalOpen(false);
        setSelectedRowKeys([]);
        bulkForm.resetFields();
      }
    } catch (error) {
      console.error('Bulk update failed:', error);
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isTxt = file.name.endsWith('.txt');

    reader.onload = async (e) => {
      try {
        let importedData: any[] = [];

        if (isExcel) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          importedData = XLSX.utils.sheet_to_json(worksheet);
        } else if (isTxt) {
          const text = e.target?.result as string;
          // Assume CSV-like format for TXT or one JSON per line
          try {
            importedData = JSON.parse(text);
          } catch {
            // Try CSV parsing
            const lines = text.split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            importedData = lines.slice(1).filter(l => l.trim()).map(line => {
              const values = line.split(',').map(v => v.trim());
              const obj: any = {};
              headers.forEach((h, i) => obj[h] = values[i]);
              return obj;
            });
          }
        }

        if (importedData.length === 0) {
          message.warning('No se encontraron datos válidos en el archivo.');
          return;
        }

        const formattedFuncs: Functionality[] = importedData.map((item, index) => {
          const testTypes = Array.isArray(item.testTypes) 
            ? item.testTypes 
            : (item.testTypes?.split(',') || []).map((t: string) => t.trim() as TestType);
          
          const roles = Array.isArray(item.roles)
            ? item.roles
            : (item.roles?.split(',') || []).map((r: string) => r.trim());

          return {
            id: item.id || `IMP-${Date.now()}-${index}`,
            projectId: projectId || '',
            module: item.module || 'Importado',
            name: item.name || 'Sin nombre',
            roles: roles.length > 0 ? roles : ['Todos'],
            testTypes: testTypes.length > 0 ? testTypes : [TestType.FUNCTIONAL],
            isRegression: testTypes.includes(TestType.REGRESSION),
            isSmoke: testTypes.includes(TestType.SMOKE),
            deliveryDate: item.deliveryDate || new Date().toISOString().split('T')[0],
            status: (item.status as TestStatus) || TestStatus.BACKLOG
          };
        });

        const count = await bulkAdd(formattedFuncs);
        message.success(`Se importaron ${count} funcionalidades correctamente.`);
      } catch (err) {
        console.error('Import error:', err);
        message.error('Error al procesar el archivo. Verifica el formato.');
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    return false; // Prevent auto-upload
  };

  const handleExport = () => {
    try {
      if (!functionalities || functionalities.length === 0) {
        message.warning('No hay datos para exportar.');
        return;
      }

      console.log('Exporting functionalities:', functionalities);

      const exportData = functionalities.map(f => ({
        ID: f.id || '',
        Módulo: f.module || '',
        Funcionalidad: f.name || '',
        Roles: Array.isArray(f.roles) ? f.roles.join(', ') : '',
        'Tipos de Prueba': Array.isArray(f.testTypes) ? f.testTypes.join(', ') : '',
        Regresión: f.isRegression ? 'Sí' : 'No',
        Smoke: f.isSmoke ? 'Sí' : 'No',
        'Fecha Entrega': f.deliveryDate || '',
        Estado: f.status || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Funcionalidades');
      
      const fileName = `Funcionalidades_${filter || 'Todas'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Use writeFile but wrap in try-catch specifically
      try {
        XLSX.writeFile(workbook, fileName);
        message.success('Archivo Excel generado correctamente.');
      } catch (writeErr) {
        console.error('XLSX.writeFile error:', writeErr);
        // Fallback: try to generate buffer and trigger download manually if possible
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Archivo Excel generado (vía fallback).');
      }
    } catch (err) {
      console.error('Export error details:', err);
      message.error('Error al exportar a Excel. Revisa la consola para más detalles.');
    }
  };

  const generateId = (moduleName: string) => {
    if (!moduleName) return '';
    // Clean module name to create a prefix (first 4 chars, uppercase, no spaces)
    const prefix = moduleName.trim().substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const count = allFunctionalities.filter(f => f.module.trim().toLowerCase() === moduleName.trim().toLowerCase()).length;
    return `${prefix}-${(count + 1).toString().padStart(2, '0')}`;
  };

  const handleValuesChange = (changedValues: any, allValues: any) => {
    // Only auto-generate ID if we are creating a new one and module changed
    if (!editingFunc && changedValues.module) {
      const newId = generateId(changedValues.module);
      form.setFieldsValue({ id: newId });
    }
  };

  const { Title, Text } = Typography;

  // Metrics Calculation
  const totalFuncs = allFunctionalities.length;
  const completedFuncs = allFunctionalities.filter(f => f.status === TestStatus.COMPLETED).length;
  const inProgressFuncs = allFunctionalities.filter(f => f.status === TestStatus.IN_PROGRESS).length;
  const backlogFuncs = allFunctionalities.filter(f => f.status === TestStatus.BACKLOG).length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header Pattern */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">Gestión de Funcionalidades</Title>
          <Text type="secondary" className="text-slate-500">Administra el inventario de funcionalidades y su estado de desarrollo.</Text>
        </div>
        <Space>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
            className="rounded-lg h-10"
          >
            Exportar
          </Button>
          <Upload 
            beforeUpload={handleImport} 
            showUploadList={false}
            accept=".xlsx,.xls,.txt"
          >
            <Button icon={<UploadOutlined />} className="rounded-lg h-10">
              Importar
            </Button>
          </Upload>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingFunc(null);
              form.resetFields();
              form.setFieldsValue({ status: TestStatus.BACKLOG });
              setIsModalOpen(true);
            }}
            className="rounded-lg h-10 px-6"
          >
            Nueva Funcionalidad
          </Button>
        </Space>
      </div>

      {/* Metrics Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</Text>
            <div className="text-3xl font-bold mt-1 text-slate-800">{totalFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completadas</Text>
            <div className="text-3xl font-bold mt-1 text-emerald-600">{completedFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">En Desarrollo</Text>
            <div className="text-3xl font-bold mt-1 text-blue-600">{inProgressFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text type="secondary" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Backlog</Text>
            <div className="text-3xl font-bold mt-1 text-amber-600">{backlogFuncs}</div>
          </Card>
        </Col>
      </Row>

      {/* Filters Card */}
      <Card className="rounded-2xl shadow-sm border-slate-100">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Filtrar por Módulo</span>
            <Select
              placeholder="Todos los módulos"
              className="w-48 h-10"
              allowClear
              onChange={setModuleFilter}
              value={moduleFilter}
              options={modules.map(m => ({ label: m, value: m }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipo de Prueba</span>
            <Select
              placeholder="Todos los tipos"
              className="w-48 h-10"
              allowClear
              onChange={setTestTypeFilter}
              value={testTypeFilter}
              options={Object.values(TestType).map(t => ({ label: t, value: t }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estado</span>
            <Select
              placeholder="Todos los estados"
              className="w-48 h-10"
              allowClear
              onChange={setStatusFilter}
              value={statusFilter}
              options={Object.values(TestStatus).map(s => ({ label: s, value: s }))}
            />
          </div>
          <Button 
            onClick={() => {
              setModuleFilter(null);
              setTestTypeFilter(null);
              setStatusFilter(null);
            }}
            className="h-10 rounded-lg text-slate-500"
          >
            Limpiar Filtros
          </Button>
        </div>
      </Card>

      {/* Table Card */}
      <Card
        className="rounded-2xl shadow-sm border-slate-100"
        title={
          <div className="flex items-center gap-3">
            <span className="text-slate-800 font-bold">Listado de Funcionalidades</span>
            {selectedRowKeys.length > 0 && (
              <Tag color="blue" className="rounded-full px-3 m-0 border-none bg-blue-50 text-blue-600 font-bold">
                {selectedRowKeys.length} seleccionadas
              </Tag>
            )}
          </div>
        }
        extra={
          selectedRowKeys.length > 0 && (
            <Button
              onClick={() => setIsBulkModalOpen(true)}
              className="rounded-lg h-9 px-4 border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-2"
            >
              <EditOutlined /> Edición Masiva
            </Button>
          )
        }
      >
        <Table 
          rowSelection={rowSelection}
          columns={columns} 
          dataSource={functionalities} 
          rowKey="id" 
          className="executive-table"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={<span className="text-lg font-bold text-slate-800">{editingFunc ? 'Editar Funcionalidad' : 'Nueva Funcionalidad'}</span>}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={650}
        centered
        okText="Guardar"
        cancelText="Cancelar"
        className="executive-modal"
      >
        <Form 
          form={form} 
          layout="vertical" 
          className="mt-4"
          onValuesChange={handleValuesChange}
        >
          <Row gutter={20}>
            <Col span={10}>
              <Form.Item name="id" label={<span className="font-semibold text-slate-600">ID de Funcionalidad</span>} rules={[{ required: true }]}>
                <Input placeholder="Ej: AUTH-01" disabled={!!editingFunc} className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item name="module" label={<span className="font-semibold text-slate-600">Módulo</span>} rules={[{ required: true }]}>
                <Input placeholder="Ej: Login / Pacientes" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="name" label={<span className="font-semibold text-slate-600">Nombre de la Funcionalidad</span>} rules={[{ required: true }]}>
            <Input placeholder="Ej: Inicio de sesión con Google" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item name="roles" label={<span className="font-semibold text-slate-600">Roles Autorizados</span>} rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="Selecciona o agrega roles"
              className="executive-select"
              dropdownRender={(menu) => (
                <div className="p-1">
                  {menu}
                  <Divider className="my-2" />
                  <div className="flex gap-2 p-1">
                    <Input
                      placeholder="Nuevo rol..."
                      ref={inputRef}
                      value={name}
                      onChange={onNameChange}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="rounded-lg h-9"
                    />
                    <Button 
                      type="primary" 
                      size="small"
                      icon={<PlusOutlined />} 
                      onClick={addItem}
                      className="rounded-lg h-9 px-4 flex items-center"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              )}
              options={items.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>

          <Form.Item name="testTypes" label={<span className="font-semibold text-slate-600">Pruebas Aplicadas</span>} rules={[{ required: true }]}>
            <Select
              mode="multiple"
              placeholder="Selecciona las pruebas a aplicar"
              className="executive-select"
              options={Object.values(TestType).map(type => ({ label: type, value: type }))}
            />
          </Form.Item>

          <Row gutter={20}>
            <Col span={12}>
              <Form.Item name="status" label={<span className="font-semibold text-slate-600">Estado Actual</span>} rules={[{ required: true }]}>
                <Select 
                  className="h-10 rounded-lg"
                  options={Object.values(TestStatus).map(v => ({ label: v, value: v }))} 
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deliveryDate" label={<span className="font-semibold text-slate-600">Fecha de Entrega</span>} rules={[{ required: true }]}>
                <Input type="date" className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
      <Modal
        title={<span className="text-lg font-bold text-slate-800">Edición Masiva ({selectedRowKeys.length} items)</span>}
        open={isBulkModalOpen}
        onOk={handleBulkSave}
        onCancel={() => setIsBulkModalOpen(false)}
        width={500}
        centered
        okText="Actualizar Todo"
        cancelText="Cancelar"
        className="executive-modal"
      >
        <Typography.Paragraph type="secondary" className="mb-4">
          Selecciona solo los campos que deseas actualizar para todas las funcionalidades seleccionadas.
        </Typography.Paragraph>
        <Form form={bulkForm} layout="vertical">
          <Form.Item name="roles" label={<span className="font-semibold text-slate-600">Roles Autorizados</span>}>
            <Select
              mode="multiple"
              placeholder="Cambiar roles para todos..."
              className="executive-select"
              options={items.map((item) => ({ label: item, value: item }))}
            />
          </Form.Item>

          <Form.Item name="testTypes" label={<span className="font-semibold text-slate-600">Pruebas Aplicadas</span>}>
            <Select
              mode="multiple"
              placeholder="Cambiar pruebas para todos..."
              className="executive-select"
              options={Object.values(TestType).map(type => ({ label: type, value: type }))}
            />
          </Form.Item>

          <Form.Item name="status" label={<span className="font-semibold text-slate-600">Estado Actual</span>}>
            <Select 
              placeholder="Cambiar estado para todos..."
              className="h-10 rounded-lg"
              options={Object.values(TestStatus).map(v => ({ label: v, value: v }))} 
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
