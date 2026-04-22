import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Row,
  Col,
  Divider,
  Typography,
  Upload,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Users, AlertTriangle, ShieldAlert } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFunctionalities } from '../modules/functionalities/hooks/useFunctionalities';
import {
  buildNextFunctionalityCode,
  getNextFunctionalityCode,
} from '../modules/functionalities/services/functionalitiesService';
import { useModules } from '../modules/settings/hooks/useModules';
import { useRoles } from '../modules/settings/hooks/useRoles';
import { useSprints } from '../modules/settings/hooks/useSprints';
import { useWorkspaceAccess } from '../modules/workspace/hooks/useWorkspaceAccess';
import { toApiError } from '../config/http';
import { Functionality, TestStatus, Priority, RiskLevel, TestType } from '../types';
import { labelPriority, labelRisk, labelTestStatus } from '../i18n/labels';
import TestCaseManagement from './TestCaseManagement';
import type { InputRef } from 'antd';
import type { FilterValue } from 'antd/es/table/interface';
import * as XLSX from 'xlsx';

export default function FunctionalityList({
  filter,
  projectId,
}: {
  filter?: 'regression' | 'smoke';
  projectId?: string;
}) {
  const valuesLooksLikeFunctionalityDuplicate = (value?: string) =>
    String(value || '').toLowerCase().includes('already exists in this project');

  type NativeTableFilterState = {
    module: React.Key[] | null;
    priority: React.Key[] | null;
    riskLevel: React.Key[] | null;
    roles: React.Key[] | null;
    qaCoverage: React.Key[] | null;
    status: React.Key[] | null;
  };

  const { t } = useTranslation();
  const {
    data: functionalitiesData,
    save,
    delete: deleteFunc,
    bulkUpdate,
    bulkAdd,
  } = useFunctionalities(projectId);
  const { data: modulesData = [] } = useModules(projectId);
  const { data: rolesData = [] } = useRoles(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const { isViewer } = useWorkspaceAccess();

  const allFunctionalities = Array.isArray(functionalitiesData) ? functionalitiesData : [];

  const [tableFilters, setTableFilters] = useState<NativeTableFilterState>({
    module: null,
    priority: null,
    riskLevel: null,
    roles: null,
    qaCoverage: null,
    status: null,
  });
  const [functionalitySearch, setFunctionalitySearch] = useState('');

  const functionalities = allFunctionalities.filter(f => {
    if (!f) return false;

    return !filter || (filter === 'regression' ? f.isRegression : f.isSmoke);
  });

  const nativeModuleFilters = React.useMemo(
    () =>
      Array.from(new Set(allFunctionalities.map(item => item?.module).filter(Boolean)))
        .sort((left, right) => String(left).localeCompare(String(right)))
        .map(module => ({
          text: String(module),
          value: String(module),
        })),
    [allFunctionalities],
  );

  const nativeRoleFilters = React.useMemo(
    () =>
      Array.from(
        new Set(
          allFunctionalities.flatMap(item =>
            Array.isArray(item?.roles) ? item.roles.filter(Boolean) : [],
          ),
        ),
      )
        .sort((left, right) => left.localeCompare(right))
        .map(role => ({
          text: role,
          value: role,
        })),
    [allFunctionalities],
  );

  const nativePriorityFilters = React.useMemo(
    () =>
      Object.values(Priority).map(priority => ({
        text: labelPriority(priority, t),
        value: priority,
      })),
    [t],
  );

  const nativeRiskFilters = React.useMemo(
    () =>
      Object.values(RiskLevel).map(risk => ({
        text: labelRisk(risk, t),
        value: risk,
      })),
    [t],
  );

  const nativeStatusFilters = React.useMemo(
    () =>
      Object.values(TestStatus).map(status => ({
        text: labelTestStatus(status, t),
        value: status,
      })),
    [t],
  );

  const nativeQaCoverageFilters = React.useMemo(
    () => [
      { text: 'Core', value: 'core' },
      { text: 'Regresión', value: 'regression' },
      { text: 'Smoke', value: 'smoke' },
      { text: 'Cambio reciente', value: 'recent-change' },
    ],
    [],
  );

  const hasActiveNativeTableFilters = React.useMemo(
    () =>
      Object.values(tableFilters).some(
        value => Array.isArray(value) && value.length > 0,
      ),
    [tableFilters],
  );

  const filteredFunctionalities = React.useMemo(() => {
    const normalizedSearch = functionalitySearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return functionalities;
    }

    return functionalities.filter(item =>
      String(item?.name || '').toLowerCase().includes(normalizedSearch),
    );
  }, [functionalities, functionalitySearch]);

  const clearNativeTableFilters = () => {
    setTableFilters({
      module: null,
      priority: null,
      riskLevel: null,
      roles: null,
      qaCoverage: null,
      status: null,
    });
    setFunctionalitySearch('');
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [selectedFunctionality, setSelectedFunctionality] = useState<Functionality | null>(null);
  const [editingFunc, setEditingFunc] = useState<Functionality | null>(null);
  const [nextFunctionalityIdPreview, setNextFunctionalityIdPreview] = useState('');
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const selectedModule = Form.useWatch('module', form);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Dynamic Roles State
  const [items, setItems] = useState([
    'Administrador',
    'Usuario',
    'Todos',
    'Manejador de Seguimiento',
    'Coordinador de Citas',
  ]);
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
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ID</span>
      ),
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          Módulo
        </span>
      ),
      dataIndex: 'module',
      key: 'module',
      filters: nativeModuleFilters,
      filterSearch: true,
      filteredValue: tableFilters.module,
      onFilter: (value: boolean | React.Key, record: Functionality) =>
        record.module === String(value),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          Funcionalidad
        </span>
      ),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          PRIORIDAD
        </span>
      ),
      dataIndex: 'priority',
      key: 'priority',
      filters: nativePriorityFilters,
      filteredValue: tableFilters.priority,
      onFilter: (value: boolean | React.Key, record: Functionality) => record.priority === value,
      render: (priority: Priority) => {
        const colors = {
          [Priority.CRITICAL]: 'text-magenta-600 bg-magenta-50',
          [Priority.HIGH]: 'text-red-600 bg-red-50',
          [Priority.MEDIUM]: 'text-orange-600 bg-orange-50',
          [Priority.LOW]: 'text-green-600 bg-green-50',
        };
        return (
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${colors[priority] || 'text-slate-600 bg-slate-50'}`}
          >
            {priority}
          </span>
        );
      },
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          RIESGO
        </span>
      ),
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      filters: nativeRiskFilters,
      filteredValue: tableFilters.riskLevel,
      onFilter: (value: boolean | React.Key, record: Functionality) => record.riskLevel === value,
      render: (risk: RiskLevel) => {
        const colors = {
          [RiskLevel.HIGH]: 'text-red-700',
          [RiskLevel.MEDIUM]: 'text-amber-700',
          [RiskLevel.LOW]: 'text-emerald-700',
        };
        return (
          <div className="flex items-center gap-1">
            <ShieldAlert size={14} className={colors[risk] || 'text-slate-400'} />
            <span className={`text-[12px] font-medium ${colors[risk] || 'text-slate-600'}`}>
              {risk}
            </span>
          </div>
        );
      },
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">ROLES</span>
      ),
      dataIndex: 'roles',
      key: 'roles',
      filters: nativeRoleFilters,
      filterSearch: true,
      filteredValue: tableFilters.roles,
      onFilter: (value: boolean | React.Key, record: Functionality) =>
        Array.isArray(record.roles) && record.roles.includes(String(value)),
      render: (roles: string[]) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Users size={16} className="text-slate-400" />
          <span className="text-sm font-medium">{roles?.join(', ') || 'N/A'}</span>
        </div>
      ),
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          COBERTURA QA
        </span>
      ),
      key: 'qaCoverage',
      filters: nativeQaCoverageFilters,
      filteredValue: tableFilters.qaCoverage,
      onFilter: (value: boolean | React.Key, record: Functionality) =>
        (value === 'core' && Boolean(record.isCore)) ||
        (value === 'regression' && Boolean(record.isRegression)) ||
        (value === 'smoke' && Boolean(record.isSmoke)) ||
        (value === 'recent-change' && Boolean(record.lastFunctionalChangeAt)),
      render: (_: unknown, record: Functionality) => {
        const tags = [
          record.isCore
            ? { key: 'core', className: 'bg-slate-900 text-white', label: 'Core' }
            : null,
          record.isRegression
            ? {
                key: 'regression',
                className: 'bg-purple-50 text-purple-700',
                label: 'Regresión',
              }
            : null,
          record.isSmoke
            ? { key: 'smoke', className: 'bg-orange-50 text-orange-700', label: 'Smoke' }
            : null,
          record.lastFunctionalChangeAt
            ? {
                key: 'recent-change',
                className: 'bg-sky-50 text-sky-700',
                label: 'Cambio reciente',
              }
            : null,
        ].filter(Boolean) as Array<{ key: string; className: string; label: string }>;

        if (tags.length === 0) {
          return <span className="text-xs text-slate-400">Sin marcar</span>;
        }

        return (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag.key}
                className={`px-2 py-0.5 rounded-md text-[12px] font-medium border border-transparent ${tag.className}`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          ESTADO DESARR.
        </span>
      ),
      dataIndex: 'status',
      key: 'status',
      filters: nativeStatusFilters,
      filteredValue: tableFilters.status,
      onFilter: (value: boolean | React.Key, record: Functionality) => record.status === value,
      render: (status: TestStatus) => {
        const config = {
          [TestStatus.BACKLOG]: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
          [TestStatus.IN_PROGRESS]: {
            bg: 'bg-blue-100',
            text: 'text-blue-700',
            dot: 'bg-blue-500',
          },
          [TestStatus.COMPLETED]: {
            bg: 'bg-emerald-100',
            text: 'text-emerald-700',
            dot: 'bg-emerald-500',
          },
          [TestStatus.MVP]: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
          [TestStatus.FAILED]: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
        }[status] || { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };

        return (
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.text} text-xs font-bold`}
          >
            <span className={`w-2 h-2 rounded-full ${config.dot}`} />
            {status}
          </div>
        );
      },
    },
    {
      title: (
        <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">
          ACCIONES
        </span>
      ),
      key: 'actions',
      render: (_: any, record: Functionality) => (
        <Space>
          <Tooltip title="Gestionar Casos de Prueba">
            <Button
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedFunctionality(record);
                setIsTestCaseModalOpen(true);
              }}
              className="rounded-lg text-blue-600 border-blue-100 hover:bg-blue-50"
            />
          </Tooltip>
          {!isViewer ? (
            <>
              <Tooltip
                title={
                  record.lastFunctionalChangeAt
                    ? `Actualizar cambio reciente (${record.lastFunctionalChangeAt})`
                    : 'Marcar cambio reciente'
                }
              >
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => handleMarkRecentChange(record)}
                  className="rounded-lg text-sky-700 border-sky-100 hover:bg-sky-50"
                />
              </Tooltip>
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                className="rounded-lg"
              />
              <Button
                icon={<DeleteOutlined />}
                danger
                onClick={() => handleDelete(record.id)}
                className="rounded-lg"
              />
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  React.useEffect(() => {
    if (!isModalOpen || editingFunc || !projectId || !selectedModule) {
      if (!editingFunc) {
        setNextFunctionalityIdPreview('');
      }
      return;
    }

    void syncNextFunctionalityId(selectedModule);
  }, [allFunctionalities, editingFunc, form, isModalOpen, projectId, selectedModule]);

  const syncNextFunctionalityId = async (moduleName: string) => {
    if (!moduleName) {
      setNextFunctionalityIdPreview('');
      form.setFieldsValue({ id: '' });
      return '';
    }

    const fallbackId = buildNextFunctionalityCode(moduleName, allFunctionalities);

    if (!projectId) {
      setNextFunctionalityIdPreview(fallbackId);
      form.setFieldsValue({ id: fallbackId });
      return fallbackId;
    }

    try {
      const nextId = await getNextFunctionalityCode(projectId, moduleName);
      setNextFunctionalityIdPreview(nextId || fallbackId);
      form.setFieldsValue({ id: nextId || fallbackId });
      return nextId || fallbackId;
    } catch (error) {
      console.error('Next functionality code sync failed:', error);
      setNextFunctionalityIdPreview(fallbackId);
      form.setFieldsValue({ id: fallbackId });
      return fallbackId;
    }
  };

  const handleEdit = (func: Functionality) => {
    setEditingFunc(func);
    setNextFunctionalityIdPreview(func.id);
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

  const handleMarkRecentChange = async (func: Functionality) => {
    try {
      await save({
        ...func,
        lastFunctionalChangeAt: new Date().toISOString().split('T')[0],
      });
      message.success('Cambio reciente marcado correctamente.');
    } catch (error) {
      console.error('Recent change mark failed:', error);
      message.error('No se pudo marcar el cambio reciente.');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const finalId = editingFunc?.id
        ? editingFunc.id
        : values.module
          ? await syncNextFunctionalityId(values.module)
          : values.id || nextFunctionalityIdPreview;

      const payload = {
        ...editingFunc,
        ...values,
        id: finalId,
        testTypes:
          values.testTypes || editingFunc?.testTypes || [TestType.FUNCTIONAL],
        isCore: Boolean(values.isCore),
        isRegression: Boolean(values.isRegression),
        isSmoke: Boolean(values.isSmoke),
        projectId: projectId || '',
      };
      console.log('Payload - Save Functionality:', payload);
      await save(payload);
      message.success(
        editingFunc ? 'Funcionalidad actualizada correctamente.' : 'Funcionalidad creada correctamente.',
      );
      setIsModalOpen(false);
      form.resetFields();
      setEditingFunc(null);
    } catch (error) {
      console.error('Validation failed:', error);
      const apiError = toApiError(error);
      const duplicateCodeError =
        !editingFunc &&
        valuesLooksLikeFunctionalityDuplicate(apiError.message) &&
        Boolean(form.getFieldValue('module'));

      if (duplicateCodeError) {
        const moduleName = form.getFieldValue('module');
        const nextId = await syncNextFunctionalityId(moduleName);
        message.warning(
          `Ese ID ya estaba ocupado. Actualicé el consecutivo al siguiente disponible: ${nextId}.`,
        );
        return;
      }

      message.error(apiError.message || 'No se pudo guardar la funcionalidad.');
    }
  };

  const handleBulkSave = async () => {
    try {
      const values = await bulkForm.validateFields();
      const updates: Partial<Functionality> = {};

      if (values.roles) updates.roles = values.roles;
      if (typeof values.isCore === 'boolean') updates.isCore = values.isCore;
      if (typeof values.isRegression === 'boolean') updates.isRegression = values.isRegression;
      if (typeof values.isSmoke === 'boolean') updates.isSmoke = values.isSmoke;
      if (values.status) updates.status = values.status;

      if (Object.keys(updates).length > 0) {
        console.log('Payload - Bulk Update Functionalities:', { ids: selectedRowKeys, updates });
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

  const handleNativeTableChange = (
    filters: Record<string, FilterValue | null>,
  ) => {
    setTableFilters({
      module: (filters.module as React.Key[] | null) || null,
      priority: (filters.priority as React.Key[] | null) || null,
      riskLevel: (filters.riskLevel as React.Key[] | null) || null,
      roles: (filters.roles as React.Key[] | null) || null,
      qaCoverage: (filters.qaCoverage as React.Key[] | null) || null,
      status: (filters.status as React.Key[] | null) || null,
    });
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isTxt = file.name.endsWith('.txt');

    reader.onload = async e => {
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
            importedData = lines
              .slice(1)
              .filter(l => l.trim())
              .map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj: any = {};
                headers.forEach((h, i) => (obj[h] = values[i]));
                return obj;
              });
          }
        }

        if (importedData.length === 0) {
          message.warning('No se encontraron datos válidos en el archivo.');
          return;
        }

        const formattedFuncs: Functionality[] = importedData.map((item, index) => {
          const roles = Array.isArray(item.roles)
            ? item.roles
            : (item.roles?.split(',') || []).map((r: string) => r.trim());

          const parseBooleanLike = (value: unknown) => {
            const normalized = String(value ?? '')
              .trim()
              .toLowerCase();

            return (
              normalized === 'true' ||
              normalized === 'sí' ||
              normalized === 'si' ||
              normalized === 'yes'
            );
          };

          return {
            id: item.id || `IMP-${Date.now()}-${index}`,
            projectId: projectId || '',
            module: item.module || 'Importado',
            name: item.name || 'Sin nombre',
            roles: roles.length > 0 ? roles : ['Todos'],
            testTypes: [TestType.FUNCTIONAL],
            isCore: parseBooleanLike(item.isCore ?? item['Core'] ?? item['Es Core']),
            isRegression: parseBooleanLike(
              item.isRegression ?? item['Regresión'] ?? item['Regresion'],
            ),
            isSmoke: parseBooleanLike(item.isSmoke ?? item['Smoke']),
            lastFunctionalChangeAt:
              item.lastFunctionalChangeAt || item['Último Cambio Funcional'] || '',
            deliveryDate: item.deliveryDate || new Date().toISOString().split('T')[0],
            status: (item.status as TestStatus) || TestStatus.BACKLOG,
            priority: (item.priority as Priority) || Priority.MEDIUM,
            riskLevel: (item.riskLevel as RiskLevel) || RiskLevel.LOW,
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
        Core: f.isCore ? 'Sí' : 'No',
        Regresión: f.isRegression ? 'Sí' : 'No',
        Smoke: f.isSmoke ? 'Sí' : 'No',
        'Último Cambio Funcional': f.lastFunctionalChangeAt || '',
        'Fecha Entrega': f.deliveryDate || '',
        Estado: f.status || '',
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

  const handleValuesChange = (changedValues: any) => {
    if (!editingFunc && changedValues.module) {
      void syncNextFunctionalityId(changedValues.module);
    }
  };

  const { Title, Text } = Typography;

  // Metrics Calculation
  const totalFuncs = allFunctionalities.length;
  const completedFuncs = allFunctionalities.filter(f => f.status === TestStatus.COMPLETED).length;
  const inProgressFuncs = allFunctionalities.filter(
    f => f.status === TestStatus.IN_PROGRESS,
  ).length;
  const backlogFuncs = allFunctionalities.filter(f => f.status === TestStatus.BACKLOG).length;
  const mvpFuncs = allFunctionalities.filter(f => f.status === TestStatus.MVP).length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header Pattern */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Title level={2} className="m-0 font-bold text-slate-800">
            Gestión de Funcionalidades
          </Title>
          <Text type="secondary" className="text-slate-500">
            Administra el inventario de funcionalidades y su estado de desarrollo.
          </Text>
        </div>
        <Space>
          <Button icon={<UploadOutlined />} onClick={handleExport} className="rounded-lg h-10">
            Exportar
          </Button>
          {!isViewer ? (
            <>
              <Upload beforeUpload={handleImport} showUploadList={false} accept=".xlsx,.xls,.txt">
                <Button icon={<DownloadOutlined />} className="rounded-lg h-10">
                  Importar
                </Button>
              </Upload>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingFunc(null);
                  setNextFunctionalityIdPreview('');
                  form.resetFields();
                  form.setFieldsValue({
                    status: TestStatus.BACKLOG,
                    priority: Priority.MEDIUM,
                    riskLevel: RiskLevel.MEDIUM,
                  });
                  setIsModalOpen(true);
                }}
                className="rounded-lg h-10 px-6"
              >
                Nueva Funcionalidad
              </Button>
            </>
          ) : null}
        </Space>
      </div>

      {/* Metrics Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={4}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text
              type="secondary"
              className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
            >
              Total
            </Text>
            <div className="text-3xl font-bold mt-1 text-slate-800">{totalFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text
              type="secondary"
              className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
            >
              Completadas
            </Text>
            <div className="text-3xl font-bold mt-1 text-emerald-600">{completedFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text
              type="secondary"
              className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
            >
              En Desarrollo
            </Text>
            <div className="text-3xl font-bold mt-1 text-blue-600">{inProgressFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text
              type="secondary"
              className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
            >
              Backlog
            </Text>
            <div className="text-3xl font-bold mt-1 text-slate-500">{backlogFuncs}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <Card className="rounded-2xl shadow-sm border-slate-100">
            <Text
              type="secondary"
              className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
            >
              MVP
            </Text>
            <div className="text-3xl font-bold mt-1 text-amber-600">{mvpFuncs}</div>
          </Card>
        </Col>
      </Row>

      {/* Table Card */}
      <Card
        className="rounded-2xl shadow-sm border-slate-100"
        title={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="text-slate-800 font-bold">Listado de Funcionalidades</span>
                {selectedRowKeys.length > 0 && (
                  <Tag
                    color="blue"
                    className="rounded-full px-3 m-0 border-none bg-blue-50 text-blue-600 font-bold"
                  >
                    {selectedRowKeys.length} seleccionadas
                  </Tag>
                )}
              </div>
              <span className="text-xs text-slate-400">
                Usa los filtros nativos en los encabezados de la tabla.
              </span>
            </div>
          </div>
        }
        extra={
          <div className="flex items-center justify-end gap-2">
            <Input.Search
              allowClear
              placeholder="Buscar por funcionalidad"
              value={functionalitySearch}
              onChange={event => setFunctionalitySearch(event.target.value)}
              className="w-[260px]"
            />
            <Button
              onClick={clearNativeTableFilters}
              disabled={!hasActiveNativeTableFilters && !functionalitySearch.trim()}
              className="rounded-lg h-9 px-4 text-slate-500"
            >
              Limpiar filtros
            </Button>
            {!isViewer && selectedRowKeys.length > 0 && (
              <Button
                onClick={() => setIsBulkModalOpen(true)}
                className="rounded-lg h-9 px-4 border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-2"
              >
                <EditOutlined /> Edición Masiva
              </Button>
            )}
          </div>
        }
      >
        <Table
          rowSelection={isViewer ? undefined : rowSelection}
          columns={columns}
          dataSource={filteredFunctionalities}
          rowKey="id"
          className="executive-table"
          pagination={{ pageSize: 10 }}
          onChange={(_, filters) => handleNativeTableChange(filters)}
        />
      </Card>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            {editingFunc ? 'Editar Funcionalidad' : 'Nueva Funcionalidad'}
          </span>
        }
        open={isModalOpen}
        onOk={isViewer ? undefined : handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={650}
        centered
        okText="Guardar"
        cancelText="Cancelar"
        className="executive-modal"
        okButtonProps={{ disabled: isViewer }}
      >
        <Form
          form={form}
          layout="vertical"
          className="mt-4"
          onValuesChange={handleValuesChange}
          initialValues={{
            status: TestStatus.BACKLOG,
            priority: Priority.MEDIUM,
            riskLevel: RiskLevel.MEDIUM,
            isCore: false,
            isRegression: false,
            isSmoke: false,
          }}
        >
          <Row gutter={20}>
            <Col span={10}>
              <Form.Item
                name="id"
                label={<span className="font-semibold text-slate-600">ID de Funcionalidad</span>}
                rules={[{ required: true }]}
              >
                <Input placeholder="Ej: AUTH-01" disabled className="h-10 rounded-lg" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item
                name="module"
                label={<span className="font-semibold text-slate-600">Módulo</span>}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Selecciona un módulo"
                  className="h-10 rounded-lg"
                  options={modulesData.map(m => ({ label: m.name, value: m.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="name"
            label={<span className="font-semibold text-slate-600">Nombre de la Funcionalidad</span>}
            rules={[{ required: true }]}
          >
            <Input placeholder="Ej: Inicio de sesión con Google" className="h-10 rounded-lg" />
          </Form.Item>

          <Form.Item
            name="roles"
            label={<span className="font-semibold text-slate-600">Roles Autorizados</span>}
            rules={[{ required: true }]}
          >
            <Select
              mode="multiple"
              placeholder="Selecciona roles"
              className="executive-select"
              options={rolesData.map(item => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>

          <Form.Item label={<span className="font-semibold text-slate-600">Cobertura QA</span>}>
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <Form.Item name="isCore" valuePropName="checked" noStyle>
                <Checkbox>Es Core</Checkbox>
              </Form.Item>
              <Form.Item name="isRegression" valuePropName="checked" noStyle>
                <Checkbox>Aplica a Regresión</Checkbox>
              </Form.Item>
              <Form.Item name="isSmoke" valuePropName="checked" noStyle>
                <Checkbox>Aplica a Smoke</Checkbox>
              </Form.Item>
            </div>
          </Form.Item>

          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label={<span className="font-semibold text-slate-600">Prioridad</span>}
                rules={[{ required: true }]}
              >
                <Select className="h-10 rounded-lg">
                  {Object.values(Priority).map(p => (
                    <Select.Option key={p} value={p}>
                      {labelPriority(p, t)}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="riskLevel"
                label={<span className="font-semibold text-slate-600">Nivel de Riesgo</span>}
                rules={[{ required: true }]}
              >
                <Select className="h-10 rounded-lg">
                  {Object.values(RiskLevel).map(r => (
                    <Select.Option key={r} value={r}>
                      {labelRisk(r, t)}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                name="sprint"
                label={<span className="font-semibold text-slate-600">Sprint</span>}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Selecciona un sprint"
                  className="h-10 rounded-lg"
                  options={sprintsData.map(s => ({ label: s.name, value: s.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label={<span className="font-semibold text-slate-600">Estado Actual</span>}
                rules={[{ required: true }]}
              >
                <Select
                  className="h-10 rounded-lg"
                  options={Object.values(TestStatus).map(v => ({
                    label: labelTestStatus(v, t),
                    value: v,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="deliveryDate"
            label={<span className="font-semibold text-slate-600">Fecha de Entrega</span>}
            rules={[{ required: true }]}
          >
            <Input type="date" className="h-10 rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={null}
        open={isTestCaseModalOpen}
        onCancel={() => setIsTestCaseModalOpen(false)}
        footer={null}
        width={1000}
        centered
        destroyOnHidden
      >
        {selectedFunctionality && (
          <TestCaseManagement
            projectId={projectId || ''}
            functionalityId={selectedFunctionality.id}
            functionalityName={selectedFunctionality.name}
            moduleName={selectedFunctionality.module}
          />
        )}
      </Modal>

      <Modal
        title={
          <span className="text-lg font-bold text-slate-800">
            Edición Masiva ({selectedRowKeys.length} items)
          </span>
        }
        open={isBulkModalOpen}
        onOk={isViewer ? undefined : handleBulkSave}
        onCancel={() => setIsBulkModalOpen(false)}
        width={500}
        centered
        okText="Actualizar Todo"
        cancelText="Cancelar"
        className="executive-modal"
        okButtonProps={{ disabled: isViewer }}
      >
        <Typography.Paragraph type="secondary" className="mb-4">
          Selecciona solo los campos que deseas actualizar para todas las funcionalidades
          seleccionadas.
        </Typography.Paragraph>
        <Form form={bulkForm} layout="vertical">
          <Form.Item
            name="roles"
            label={<span className="font-semibold text-slate-600">Roles Autorizados</span>}
          >
            <Select
              mode="multiple"
              placeholder="Cambiar roles para todos..."
              className="executive-select"
              options={rolesData.map(item => ({ label: item.name, value: item.name }))}
            />
          </Form.Item>

          <Form.Item label={<span className="font-semibold text-slate-600">Cobertura QA</span>}>
            <Space direction="vertical" size={10}>
              <Form.Item name="isCore" valuePropName="checked" noStyle>
                <Checkbox>Marcar como Core</Checkbox>
              </Form.Item>
              <Form.Item name="isRegression" valuePropName="checked" noStyle>
                <Checkbox>Marcar para Regresión</Checkbox>
              </Form.Item>
              <Form.Item name="isSmoke" valuePropName="checked" noStyle>
                <Checkbox>Marcar para Smoke</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            name="status"
            label={<span className="font-semibold text-slate-600">Estado Actual</span>}
          >
            <Select
              placeholder="Cambiar estado para todos..."
              className="h-10 rounded-lg"
              options={Object.values(TestStatus).map(v => ({
                label: labelTestStatus(v, t),
                value: v,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
