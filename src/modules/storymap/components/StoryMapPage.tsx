import {
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  App as AntdApp,
} from 'antd';
import { CopyOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Functionality } from '../../../types';
import { Priority, RiskLevel, TestStatus, TestType } from '../../../types';
import { labelPriority, labelRisk } from '../../../i18n/labels';
import { useFunctionalities } from '../../functionalities/hooks/useFunctionalities';
import {
  buildNextFunctionalityCode,
  getNextFunctionalityCode,
} from '../../functionalities/services/functionalitiesService';
import { useModules } from '../../settings/hooks/useModules';
import { useSprints } from '../../settings/hooks/useSprints';
import { storyMapService } from '../services/storyMapService';
import { storyMapExportService } from '../services/storyMapExportService';
import type { StoryMapRoleNode } from '../types';
import StoryMapBoard from './StoryMapBoard';
import { StoryMapErrorBoundary } from './StoryMapErrorBoundary';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function StoryMapPage({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { message } = AntdApp.useApp();
  const {
    data: functionalitiesData,
    save: saveFunctionality,
    refetch: refetchFunctionalities,
  } = useFunctionalities(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const functionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];

  const [fullMap, setFullMap] = useState<StoryMapRoleNode[]>([]);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [createFuncModalOpen, setCreateFuncModalOpen] = useState(false);
  const [createFuncStoryId, setCreateFuncStoryId] = useState<string | null>(null);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [activeEpicId, setActiveEpicId] = useState<string | null>(null);
  const [nextFunctionalityIdPreview, setNextFunctionalityIdPreview] = useState('');

  const [roleForm] = Form.useForm();
  const [epicForm] = Form.useForm();
  const [storyForm] = Form.useForm();
  const [funcForm] = Form.useForm();
  const selectedModule = Form.useWatch('module', funcForm);

  const reload = () => {
    if (!projectId) return;
    setFullMap(storyMapService.getFullStoryMap(projectId, functionalities));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, functionalitiesData]);

  const unassignedFunctionalities = useMemo(() => {
    return functionalities.filter(f => !f.storyId);
  }, [functionalities]);

  const assignFunctionality = async (storyId: string, functionalityId: string) => {
    const func = functionalities.find(f => f.id === functionalityId);
    if (!func) return;
    try {
      const updated: Functionality = { ...func, storyId };
      await saveFunctionality(updated);
      await refetchFunctionalities();
      message.success(t('storymap.assign_success', { id: func.id }));
    } catch (error) {
      console.error('Story Map assign functionality error:', error);
      message.error('No se pudo asociar la funcionalidad a la historia.');
    }
  };

  const unassignFunctionality = async (functionalityId: string) => {
    const func = functionalities.find(f => f.id === functionalityId);
    if (!func) return;
    try {
      const updated: Functionality = { ...func, storyId: undefined };
      await saveFunctionality(updated);
      await refetchFunctionalities();
      message.success(t('storymap.unassign_success', { id: func.id }));
    } catch (error) {
      console.error('Story Map unassign functionality error:', error);
      message.error('No se pudo desasociar la funcionalidad de la historia.');
    }
  };

  const openCreateEpic = (roleId: string) => {
    setActiveRoleId(roleId);
    epicForm.resetFields();
    setEpicModalOpen(true);
  };

  const openCreateStory = (epicId: string) => {
    setActiveEpicId(epicId);
    storyForm.resetFields();
    setStoryModalOpen(true);
  };

  useEffect(() => {
    if (!createFuncModalOpen || !projectId || !selectedModule) {
      setNextFunctionalityIdPreview('');
      return;
    }

    let cancelled = false;

    setNextFunctionalityIdPreview(buildNextFunctionalityCode(selectedModule, functionalities));

    getNextFunctionalityCode(projectId, selectedModule)
      .then(nextId => {
        if (!cancelled) {
          setNextFunctionalityIdPreview(nextId);
        }
      })
      .catch(error => {
        console.error('Story Map next functionality id error:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [createFuncModalOpen, functionalities, projectId, selectedModule]);

  const openCreateFunctionality = (storyId: string) => {
    setCreateFuncStoryId(storyId);
    setNextFunctionalityIdPreview('');
    funcForm.resetFields();
    funcForm.setFieldsValue({
      priority: Priority.MEDIUM,
      riskLevel: RiskLevel.MEDIUM,
      sprint: undefined,
      deliveryDate: undefined,
    });
    setCreateFuncModalOpen(true);
  };

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPayload = () => storyMapExportService.build(projectId, functionalities);

  if (!projectId) return null;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">
            {t('storymap.title')}
          </Title>
          <Text type="secondary" className="text-slate-500">
            {t('storymap.subtitle')}
          </Text>
        </div>
        <Space>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'json',
                  label: t('storymap.export.json'),
                  icon: <DownloadOutlined />,
                  onClick: () => {
                    const payload = exportPayload();
                    const ymd = new Date().toISOString().slice(0, 10);
                    downloadTextFile(
                      `storymap_${projectId}_${ymd}.json`,
                      storyMapExportService.toJson(payload),
                      'application/json;charset=utf-8',
                    );
                    message.success(t('storymap.export.success_json'));
                  },
                },
                {
                  key: 'csv',
                  label: t('storymap.export.csv'),
                  icon: <DownloadOutlined />,
                  onClick: () => {
                    const payload = exportPayload();
                    const ymd = new Date().toISOString().slice(0, 10);
                    downloadTextFile(
                      `storymap_${projectId}_${ymd}.csv`,
                      storyMapExportService.toCsv(payload),
                      'text/csv;charset=utf-8',
                    );
                    message.success(t('storymap.export.success_csv'));
                  },
                },
                {
                  key: 'copy',
                  label: t('storymap.export.copy_json'),
                  icon: <CopyOutlined />,
                  onClick: async () => {
                    try {
                      const payload = exportPayload();
                      await navigator.clipboard.writeText(storyMapExportService.toJson(payload));
                      message.success(t('storymap.export.copy_success'));
                    } catch {
                      message.error(t('storymap.export.copy_error'));
                    }
                  },
                },
              ],
            }}
          >
            <Button className="rounded-lg h-10 px-6">{t('common.export')}</Button>
          </Dropdown>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              roleForm.resetFields();
              setRoleModalOpen(true);
            }}
            className="rounded-lg h-10 px-6"
          >
            {t('storymap.new_role')}
          </Button>
        </Space>
      </div>

      <Card variant="borderless" className="rounded-2xl shadow-sm" styles={{ body: { padding: 12 } }}>
        {fullMap.length === 0 ? (
          <div className="w-full py-8">
            <Empty description={t('storymap.empty_roles')} />
          </div>
        ) : (
          <StoryMapErrorBoundary onRetry={reload}>
            <StoryMapBoard
              projectId={projectId}
              roles={fullMap}
              functionalities={functionalities}
              unassignedFunctionalities={unassignedFunctionalities}
              onCreateEpic={openCreateEpic}
              onCreateStory={openCreateStory}
              onCreateFunctionality={openCreateFunctionality}
              onAssignExisting={assignFunctionality}
              onUnassignFunctionality={unassignFunctionality}
              onSaveFunctionality={saveFunctionality}
            />
          </StoryMapErrorBoundary>
        )}
      </Card>

      <Modal
        title={t('storymap.create_func_title')}
        open={createFuncModalOpen}
        onCancel={() => {
          setCreateFuncModalOpen(false);
          setCreateFuncStoryId(null);
        }}
        onOk={async () => {
          try {
            const values = await funcForm.validateFields();
            if (!createFuncStoryId) {
              message.error(t('storymap.error_no_story'));
              return;
            }

            const newId =
              (projectId && values.module
                ? await getNextFunctionalityCode(projectId, values.module)
                : '') || nextFunctionalityIdPreview;
            const deliveryDateStr = values.deliveryDate
              ? values.deliveryDate.format('YYYY-MM-DD')
              : dayjs().format('YYYY-MM-DD');
            const payload: Functionality = {
              id: newId,
              projectId,
              module: values.module,
              name: values.name,
              roles: ['Todos'],
              testTypes: [TestType.FUNCTIONAL],
              isRegression: false,
              isSmoke: false,
              deliveryDate: deliveryDateStr,
              status: TestStatus.BACKLOG,
              priority: values.priority,
              riskLevel: values.riskLevel,
              sprint: values.sprint,
              storyId: createFuncStoryId,
            };

            await saveFunctionality(payload);
            await refetchFunctionalities();
            setCreateFuncModalOpen(false);
            setCreateFuncStoryId(null);
            funcForm.resetFields();
            message.success(t('storymap.create_func_success', { id: payload.id }));
          } catch (error) {
            console.error('Story Map create functionality error:', error);
            const errorMessage =
              error instanceof Error && error.message.includes('already exists')
                ? 'Ya existe una funcionalidad con ese ID en este proyecto. Intenta de nuevo para generar el siguiente consecutivo.'
                : 'No se pudo crear la funcionalidad. Revisa que el ID generado no esté repetido y que el módulo y sprint sean válidos.';
            message.error(errorMessage);
          }
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form form={funcForm} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="name" label={t('functionality.name')} rules={[{ required: true }]}>
                <Input placeholder={t('functionality.name_placeholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="module"
                label={t('functionality.module')}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  placeholder={t('functionality.module_placeholder')}
                  options={modulesData.map(m => ({ label: m.name, value: m.name }))}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('functionality.id_auto')}>
                <Form.Item shouldUpdate noStyle>
                  {() => {
                    return <Input value={nextFunctionalityIdPreview || '—'} disabled />;
                  }}
                </Form.Item>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="priority"
                label={t('functionality.priority')}
                rules={[{ required: true }]}
              >
                <Select
                  options={Object.values(Priority).map(p => ({
                    label: labelPriority(p, t),
                    value: p,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="riskLevel"
                label={t('functionality.risk')}
                rules={[{ required: true }]}
              >
                <Select
                  options={Object.values(RiskLevel).map(r => ({
                    label: labelRisk(r, t),
                    value: r,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sprint"
                label={t('functionality.sprint')}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={t('functionality.sprint_placeholder')}
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="deliveryDate" label={t('functionality.delivery_date_optional')}>
                <DatePicker className="w-full" format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
          <Text type="secondary" className="text-xs">
            {t('functionality.id_auto_hint')}
          </Text>
        </Form>
      </Modal>

      <Modal
        title={t('storymap.create_role_title')}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={async () => {
          const values = await roleForm.validateFields();
          storyMapService.createRole(projectId, values.name);
          setRoleModalOpen(false);
          reload();
          message.success(t('storymap.create_role_success'));
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('common.name')}
            rules={[{ required: true, message: t('common.enter_name') }]}
          >
            <Input placeholder={t('storymap.role_placeholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('storymap.create_epic_title')}
        open={epicModalOpen}
        onCancel={() => setEpicModalOpen(false)}
        onOk={async () => {
          const values = await epicForm.validateFields();
          if (!activeRoleId) {
            message.error(t('storymap.error_no_role'));
            return;
          }
          storyMapService.createEpic(projectId, activeRoleId, values.name);
          setEpicModalOpen(false);
          setActiveRoleId(null);
          reload();
          message.success(t('storymap.create_epic_success'));
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form form={epicForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('common.name')}
            rules={[{ required: true, message: t('common.enter_name') }]}
          >
            <Input placeholder={t('storymap.epic_placeholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('storymap.create_story_title')}
        open={storyModalOpen}
        onCancel={() => setStoryModalOpen(false)}
        onOk={async () => {
          const values = await storyForm.validateFields();
          if (!activeEpicId) {
            message.error(t('storymap.error_no_epic'));
            return;
          }
          storyMapService.createStory(projectId, activeEpicId, values.name);
          setStoryModalOpen(false);
          setActiveEpicId(null);
          reload();
          message.success(t('storymap.create_story_success'));
        }}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form form={storyForm} layout="vertical">
          <Form.Item
            name="name"
            label={t('common.name')}
            rules={[{ required: true, message: t('common.enter_name') }]}
          >
            <Input placeholder={t('storymap.story_placeholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
