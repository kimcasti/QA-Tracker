import {
  Button,
  Card,
  Checkbox,
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
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Functionality } from '../../../types';
import { Priority, RiskLevel, TestStatus, TestType } from '../../../types';
import { labelPriority, labelRisk } from '../../../i18n/labels';
import { useFunctionalities } from '../../functionalities/hooks/useFunctionalities';
import {
  buildNextFunctionalityCode,
} from '../../functionalities/services/functionalitiesService';
import { useModules } from '../../settings/hooks/useModules';
import { useSprints } from '../../settings/hooks/useSprints';
import { useWorkspaceAccess } from '../../workspace/hooks/useWorkspaceAccess';
import { storyMapService } from '../services/storyMapService';
import { storyAssociationsService } from '../services/storyAssociationsService';
import { storyMapExportService } from '../services/storyMapExportService';
import { getProjectStoryMap, saveProjectStoryMap } from '../services/projectStoryMapService';
import type { StoryMapRoleNode } from '../types';
import { StoryMapErrorBoundary } from './StoryMapErrorBoundary';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const StoryMapBoard = lazy(() => import('./StoryMapBoard'));

export default function StoryMapPage({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const { message } = AntdApp.useApp();
  const { isViewer } = useWorkspaceAccess();
  const {
    data: functionalitiesData,
    save: saveFunctionality,
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
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingEpicId, setEditingEpicId] = useState<string | null>(null);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
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

  const persistStoryMapSnapshot = async () => {
    if (!projectId) return;
    await saveProjectStoryMap(projectId, storyMapService.getProjectSnapshot(projectId));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, functionalitiesData]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let cancelled = false;

    getProjectStoryMap(projectId)
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        storyMapService.hydrateProjectSnapshot(projectId, snapshot);
        reload();
      })
      .catch((error) => {
        console.error('Story Map load snapshot error:', error);
        if (!cancelled) {
          storyMapService.hydrateProjectSnapshot(projectId, null);
          reload();
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const ensurePrimaryAssociation = async (storyId: string, functionalityId: string) => {
    const func = functionalities.find(f => f.id === functionalityId);
    if (!func) return;

    if (func.storyId) {
      message.success(t('storymap.assign_success', { id: func.id }));
      return;
    }

    try {
      const updated: Functionality = { ...func, storyId };
      await saveFunctionality(updated);
      await persistStoryMapSnapshot();
      message.success(t('storymap.assign_success', { id: func.id }));
    } catch (error) {
      console.error('Story Map assign functionality error:', error);
      message.error('No se pudo asociar la funcionalidad a la historia.');
    }
  };

  const syncPrimaryStoryAfterUnassign = async (storyId: string, functionalityId: string) => {
    const func = functionalities.find(f => f.id === functionalityId);
    if (!func) return;

    if (func.storyId !== storyId) {
      return;
    }

    const remainingLinks = storyAssociationsService
      .getProjectLinks(projectId)
      .filter(link => link.functionalityId === functionalityId);

    const nextPrimaryStoryId = remainingLinks[0]?.storyId;

    try {
      const updated: Functionality = { ...func, storyId: nextPrimaryStoryId };
      await saveFunctionality(updated);
      await persistStoryMapSnapshot();
      message.success(t('storymap.unassign_success', { id: func.id }));
    } catch (error) {
      console.error('Story Map unassign functionality error:', error);
      message.error('No se pudo desasociar la funcionalidad de la historia.');
    }
  };

  const openCreateEpic = (roleId: string) => {
    setEditingEpicId(null);
    setActiveRoleId(roleId);
    epicForm.resetFields();
    setEpicModalOpen(true);
  };

  const openCreateStory = (epicId: string) => {
    setEditingStoryId(null);
    setActiveEpicId(epicId);
    storyForm.resetFields();
    setStoryModalOpen(true);
  };

  const openEditRole = (roleId: string, name: string) => {
    setEditingRoleId(roleId);
    roleForm.setFieldsValue({ name });
    setRoleModalOpen(true);
  };

  const openEditEpic = (epicId: string, name: string) => {
    setEditingEpicId(epicId);
    setActiveRoleId(null);
    epicForm.setFieldsValue({ name });
    setEpicModalOpen(true);
  };

  const openEditStory = (storyId: string, name: string) => {
    setEditingStoryId(storyId);
    setActiveEpicId(null);
    storyForm.setFieldsValue({ name });
    setStoryModalOpen(true);
  };

  const closeRoleModal = () => {
    setRoleModalOpen(false);
    setEditingRoleId(null);
    roleForm.resetFields();
  };

  const closeEpicModal = () => {
    setEpicModalOpen(false);
    setActiveRoleId(null);
    setEditingEpicId(null);
    epicForm.resetFields();
  };

  const closeStoryModal = () => {
    setStoryModalOpen(false);
    setActiveEpicId(null);
    setEditingStoryId(null);
    storyForm.resetFields();
  };

  useEffect(() => {
    if (!createFuncModalOpen || !projectId || !selectedModule) {
      setNextFunctionalityIdPreview('');
      return;
    }

    setNextFunctionalityIdPreview(buildNextFunctionalityCode(selectedModule, functionalities));
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
      isCore: false,
      isRegression: false,
      isSmoke: false,
    });
    setCreateFuncModalOpen(true);
  };

  const handleMoveFunctionality = async (functionalityId: string, storyId: string) => {
    const functionality = functionalities.find(item => item.id === functionalityId);
    if (!functionality || functionality.storyId === storyId) {
      return;
    }

    try {
      await saveFunctionality({ ...functionality, storyId });
      await persistStoryMapSnapshot();
    } catch (error) {
      console.error('Story Map move functionality error:', error);
      reload();
      message.error(t('storymap.move_error'));
    }
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
          {isViewer && (
            <Space size={[8, 8]} wrap>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                Solo lectura
              </span>
              <Text type="secondary">
                Puedes explorar el Story Map, pero no crear, editar ni reorganizar elementos.
              </Text>
            </Space>
          )}
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

          {!isViewer && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRoleId(null);
                roleForm.resetFields();
                setRoleModalOpen(true);
              }}
              className="rounded-lg h-10 px-6"
            >
              {t('storymap.new_role')}
            </Button>
          )}
        </Space>
      </div>

      <Card variant="borderless" className="rounded-2xl shadow-sm" styles={{ body: { padding: 12 } }}>
        {fullMap.length === 0 ? (
          <div className="w-full py-8">
            <Empty description={t('storymap.empty_roles')} />
          </div>
        ) : (
          <StoryMapErrorBoundary onRetry={reload}>
            <Suspense fallback={<div className="py-8 text-center text-sm text-slate-400">Cargando Story Map...</div>}>
              <StoryMapBoard
                projectId={projectId}
                roles={fullMap}
                functionalities={functionalities}
                onCreateEpic={openCreateEpic}
                onCreateStory={openCreateStory}
                onCreateFunctionality={openCreateFunctionality}
                onEditRole={openEditRole}
                onEditEpic={openEditEpic}
                onEditStory={openEditStory}
                onEnsurePrimaryAssociation={ensurePrimaryAssociation}
                onSyncPrimaryStoryAfterUnassign={syncPrimaryStoryAfterUnassign}
                onMoveFunctionality={handleMoveFunctionality}
                onStructureChange={() => {
                  void persistStoryMapSnapshot();
                }}
                readOnly={isViewer}
              />
            </Suspense>
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
        onOk={!isViewer ? async () => {
          try {
            const values = await funcForm.validateFields();
            if (!createFuncStoryId) {
              message.error(t('storymap.error_no_story'));
              return;
            }

            const newId =
              (values.module
                ? buildNextFunctionalityCode(values.module, functionalities)
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
              isCore: Boolean(values.isCore),
              isRegression: Boolean(values.isRegression),
              isSmoke: Boolean(values.isSmoke),
              deliveryDate: deliveryDateStr,
              status: TestStatus.BACKLOG,
              priority: values.priority,
              riskLevel: values.riskLevel,
              sprint: values.sprint,
              storyId: createFuncStoryId,
            };

            const saved = await saveFunctionality(payload);
            storyAssociationsService.ensureAssociation(projectId, createFuncStoryId, saved.id);
            await persistStoryMapSnapshot();
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
        } : undefined}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        centered
        okButtonProps={{ style: { display: isViewer ? 'none' : undefined } }}
      >
        <Form form={funcForm} layout="vertical" disabled={isViewer}>
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
            <Col span={24}>
              <Form.Item label={<span className="font-semibold text-slate-600">Cobertura QA</span>}>
                <Space size={16} wrap>
                  <Form.Item name="isCore" valuePropName="checked" noStyle>
                    <Checkbox>Es Core</Checkbox>
                  </Form.Item>
                  <Form.Item name="isRegression" valuePropName="checked" noStyle>
                    <Checkbox>Aplica a Regresión</Checkbox>
                  </Form.Item>
                  <Form.Item name="isSmoke" valuePropName="checked" noStyle>
                    <Checkbox>Aplica a Smoke</Checkbox>
                  </Form.Item>
                </Space>
              </Form.Item>
            </Col>
          </Row>
          <Text type="secondary" className="text-xs">
            {t('functionality.id_auto_hint')}
          </Text>
        </Form>
      </Modal>

      <Modal
        title={editingRoleId ? t('storymap.edit_role_title') : t('storymap.create_role_title')}
        open={roleModalOpen}
        onCancel={closeRoleModal}
        onOk={!isViewer ? async () => {
          const values = await roleForm.validateFields();
          if (editingRoleId) {
            storyMapService.updateRole(projectId, editingRoleId, values.name);
          } else {
            storyMapService.createRole(projectId, values.name);
          }
          await persistStoryMapSnapshot();
          closeRoleModal();
          reload();
          message.success(
            editingRoleId ? t('storymap.edit_role_success') : t('storymap.create_role_success'),
          );
        } : undefined}
        okText={editingRoleId ? t('common.save') : t('common.create')}
        cancelText={t('common.cancel')}
        centered
        okButtonProps={{ style: { display: isViewer ? 'none' : undefined } }}
      >
        <Form form={roleForm} layout="vertical" disabled={isViewer}>
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
        title={editingEpicId ? t('storymap.edit_epic_title') : t('storymap.create_epic_title')}
        open={epicModalOpen}
        onCancel={closeEpicModal}
        onOk={!isViewer ? async () => {
          const values = await epicForm.validateFields();
          if (!editingEpicId && !activeRoleId) {
            message.error(t('storymap.error_no_role'));
            return;
          }
          if (editingEpicId) {
            storyMapService.updateEpic(projectId, editingEpicId, values.name);
          } else {
            storyMapService.createEpic(projectId, activeRoleId!, values.name);
          }
          await persistStoryMapSnapshot();
          closeEpicModal();
          reload();
          message.success(
            editingEpicId ? t('storymap.edit_epic_success') : t('storymap.create_epic_success'),
          );
        } : undefined}
        okText={editingEpicId ? t('common.save') : t('common.create')}
        cancelText={t('common.cancel')}
        centered
        okButtonProps={{ style: { display: isViewer ? 'none' : undefined } }}
      >
        <Form form={epicForm} layout="vertical" disabled={isViewer}>
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
        title={editingStoryId ? t('storymap.edit_story_title') : t('storymap.create_story_title')}
        open={storyModalOpen}
        onCancel={closeStoryModal}
        onOk={!isViewer ? async () => {
          const values = await storyForm.validateFields();
          if (!editingStoryId && !activeEpicId) {
            message.error(t('storymap.error_no_epic'));
            return;
          }
          if (editingStoryId) {
            storyMapService.updateStory(projectId, editingStoryId, values.name);
          } else {
            storyMapService.createStory(projectId, activeEpicId!, values.name);
          }
          await persistStoryMapSnapshot();
          closeStoryModal();
          reload();
          message.success(
            editingStoryId
              ? t('storymap.edit_story_success')
              : t('storymap.create_story_success'),
          );
        } : undefined}
        okText={editingStoryId ? t('common.save') : t('common.create')}
        cancelText={t('common.cancel')}
        centered
        okButtonProps={{ style: { display: isViewer ? 'none' : undefined } }}
      >
        <Form form={storyForm} layout="vertical" disabled={isViewer}>
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
