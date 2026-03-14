import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, Typography, Card, message, Popconfirm, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, ThunderboltOutlined, KeyOutlined } from '@ant-design/icons';
import { TestCase, Priority, TestType } from '../types';
import { useTranslation } from 'react-i18next';
import { labelPriority } from '../i18n/labels';
import { useTestCases } from '../hooks';
import { generateTestCasesWithAI, getGeminiApiKey } from '../services/geminiService';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface TestCaseManagementProps {
  projectId: string;
  functionalityId: string;
  functionalityName: string;
  moduleName: string;
}

const TestCaseManagement: React.FC<TestCaseManagementProps> = ({ projectId, functionalityId, functionalityName, moduleName }) => {
  const { t } = useTranslation();
  const { data: testCases, isLoading, save, delete: deleteTestCase } = useTestCases(projectId, functionalityId);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [form] = Form.useForm();
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const runGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const generated = await generateTestCasesWithAI(functionalityName, moduleName);
      
      // Save each generated test case
      for (const tc of generated) {
        const newTestCase: TestCase = {
          ...tc,
          id: `TC-AI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          projectId,
          functionalityId,
        };
        save(newTestCase);
      }
      message.success(`Se generaron ${generated.length} casos de prueba con IA`);
    } catch (error) {
      console.error('AI Generation error:', error);
      const msg = (error instanceof Error ? error.message : (error as any)?.message) || '';
      const anyErr: any = error as any;
      const nestedMessage = (anyErr?.error?.message || anyErr?.message || '').toString();
      const reason = anyErr?.error?.details?.[0]?.reason || anyErr?.details?.[0]?.reason;
      const isLeakedKey =
        msg === 'GEMINI_API_KEY_LEAKED' ||
        /reported as leaked/i.test(nestedMessage);
      const isInvalidKey =
        msg === 'GEMINI_API_KEY_INVALID' ||
        isLeakedKey ||
        reason === 'API_KEY_INVALID' ||
        /api key not valid/i.test(nestedMessage);
      if (msg === 'GEMINI_API_KEY_MISSING') {
        message.warning('Configura tu API Key de Gemini para usar la generación con IA.');
        setIsApiKeyModalVisible(true);
      } else if (isInvalidKey) {
        localStorage.removeItem('GEMINI_API_KEY');
        message.error(
          isLeakedKey
            ? 'API Key comprometida (reportada como filtrada). Genera una nueva API Key.'
            : 'API Key inválida. Ingresa una API Key válida de Gemini.'
        );
        setIsApiKeyModalVisible(true);
      } else {
        message.error('Error al generar casos con IA. Revisa tu API Key.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!getGeminiApiKey()) {
      setIsApiKeyModalVisible(true);
      return;
    }
    await runGenerateAI();
  };

  const showModal = (testCase?: TestCase) => {
    if (testCase) {
      setEditingTestCase(testCase);
      form.setFieldsValue(testCase);
    } else {
      setEditingTestCase(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const onFinish = (values: any) => {
    const newTestCase: TestCase = {
      ...values,
      id: editingTestCase?.id || `TC-${Date.now()}`,
      projectId,
      functionalityId,
    };

    console.log('Payload - Save Test Case:', newTestCase);
    save(newTestCase, {
      onSuccess: () => {
        message.success(editingTestCase ? 'Caso de prueba actualizado' : 'Caso de prueba creado');
        setIsModalVisible(false);
        form.resetFields();
      },
      onError: () => {
        message.error('Error al guardar el caso de prueba');
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteTestCase(id, {
      onSuccess: () => {
        message.success('Caso de prueba eliminado');
      },
      onError: () => {
        message.error('Error al eliminar el caso de prueba');
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Text copyable>{id}</Text>,
    },
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'testType',
      key: 'testType',
      width: 120,
      render: (type: TestType) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: 'Prioridad',
      dataIndex: 'priority',
      key: 'priority',
      width: 120,
      render: (priority: Priority) => {
        const colors = {
          [Priority.CRITICAL]: 'magenta',
          [Priority.HIGH]: 'red',
          [Priority.MEDIUM]: 'orange',
          [Priority.LOW]: 'green',
        };
        return <Tag color={colors[priority]}>{priority}</Tag>;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 150,
      render: (_: any, record: TestCase) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => showModal(record)}
          />
          <Popconfirm
            title="¿Estás seguro de eliminar este caso de prueba?"
            onConfirm={() => handleDelete(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card 
      title={
        <Space>
          <FileTextOutlined />
          <span>Casos de Prueba - {functionalityName}</span>
        </Space>
      }
      extra={
        <Space>
          <Button
            icon={<KeyOutlined />}
            onClick={() => setIsApiKeyModalVisible(true)}
            className="rounded-lg"
          >
            API Key
          </Button>
          <Button 
            icon={<ThunderboltOutlined />} 
            onClick={handleGenerateAI}
            loading={isGenerating}
            className="rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"
          >
            Generar con IA
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => showModal()}
          >
            Nuevo Caso de Prueba
          </Button>
        </Space>
      }
      className="shadow-sm"
    >
      <Table
        columns={columns}
        dataSource={testCases}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 5 }}
        expandable={{
          expandedRowRender: (record) => (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="mb-4">
                <Text strong>Descripción:</Text>
                <p className="mt-1">{record.description}</p>
              </div>
              <div className="mb-4">
                <Text strong>Precondiciones:</Text>
                <p className="mt-1">{record.preconditions}</p>
              </div>
              <div className="mb-4">
                <Text strong>Pasos de Prueba:</Text>
                <p className="mt-1 whitespace-pre-wrap">{record.testSteps}</p>
              </div>
              <div>
                <Text strong>Resultado Esperado:</Text>
                <p className="mt-1">{record.expectedResult}</p>
              </div>
            </div>
          ),
        }}
      />

      <Modal
        title={editingTestCase ? 'Editar Caso de Prueba' : 'Nuevo Caso de Prueba'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            priority: Priority.MEDIUM,
            testType: TestType.FUNCTIONAL,
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="title"
              label="Título"
              rules={[{ required: true, message: 'Por favor ingresa el título' }]}
              className="col-span-2"
            >
              <Input placeholder="Ej: Validar login con credenciales correctas" />
            </Form.Item>

            <Form.Item
              name="testType"
              label="Tipo de Prueba"
              rules={[{ required: true }]}
            >
              <Select>
                {Object.values(TestType).map(type => (
                  <Select.Option key={type} value={type}>{type}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="priority"
              label="Prioridad"
              rules={[{ required: true }]}
            >
              <Select>
                {Object.values(Priority).map(p => (
                  <Select.Option key={p} value={p}>{labelPriority(p, t)}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="description"
              label="Descripción"
              className="col-span-2"
            >
              <TextArea rows={2} placeholder="Descripción breve del objetivo de la prueba" />
            </Form.Item>

            <Form.Item
              name="preconditions"
              label="Precondiciones"
              className="col-span-2"
            >
              <TextArea rows={2} placeholder="Estado inicial requerido" />
            </Form.Item>

            <Form.Item
              name="testSteps"
              label="Pasos de Prueba"
              rules={[{ required: true, message: 'Por favor ingresa los pasos' }]}
              className="col-span-2"
            >
              <TextArea rows={4} placeholder="1. Ingresar a la URL...&#10;2. Escribir usuario...&#10;3. Click en botón..." />
            </Form.Item>

            <Form.Item
              name="expectedResult"
              label="Resultado Esperado"
              rules={[{ required: true, message: 'Por favor ingresa el resultado esperado' }]}
              className="col-span-2"
            >
              <TextArea rows={2} placeholder="El sistema debe mostrar el dashboard..." />
            </Form.Item>
          </div>

          <Form.Item className="flex justify-end mb-0 mt-4">
            <Space>
              <Button onClick={handleCancel}>Cancelar</Button>
              <Button type="primary" htmlType="submit">
                {editingTestCase ? 'Actualizar' : 'Crear'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Configurar Gemini API Key"
        open={isApiKeyModalVisible}
        onCancel={() => setIsApiKeyModalVisible(false)}
        zIndex={2000}
        maskClosable={false}
        okText="Guardar"
        cancelText="Cancelar"
        onOk={async () => {
          const trimmed = apiKeyInput.trim();
            if (!trimmed) {
              message.warning('Ingresa una API Key válida');
              return;
            }
          localStorage.setItem('GEMINI_API_KEY', trimmed);
          setIsApiKeyModalVisible(false);
          setApiKeyInput('');
          await runGenerateAI();
        }}
      >
        <div className="space-y-2">
          <Text type="secondary">
            Esta llave se guardará en tu navegador (localStorage) para habilitar la generación de casos con IA.
          </Text>
          <Input.Password
            placeholder="AIza..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
          />
        </div>
      </Modal>
    </Card>
  );
};

export default TestCaseManagement;
