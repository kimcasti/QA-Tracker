import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  MailOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useSuperadminBillingRequests } from '../modules/superadmin/hooks/useSuperadminBillingRequests';
import { useSuperadminBillingRequestActions } from '../modules/superadmin/hooks/useSuperadminBillingRequestActions';
import { useSuperadminOrganizations } from '../modules/superadmin/hooks/useSuperadminOrganizations';
import { useSuperadminOrganizationMemberships } from '../modules/superadmin/hooks/useSuperadminOrganizationMemberships';
import { useSuperadminOrganizationInvitations } from '../modules/superadmin/hooks/useSuperadminOrganizationInvitations';
import { useSuperadminOrganizationAuditLogs } from '../modules/superadmin/hooks/useSuperadminOrganizationAuditLogs';
import { useSuperadminOrganizationActions } from '../modules/superadmin/hooks/useSuperadminOrganizationActions';
import { useSuperadminMembershipActions } from '../modules/superadmin/hooks/useSuperadminMembershipActions';
import { useSuperadminInvitationActions } from '../modules/superadmin/hooks/useSuperadminInvitationActions';
import type {
  SuperadminAuditLog,
  SuperadminBillingRequest,
  SuperadminInvitation,
  SuperadminMembership,
  SuperadminOrganizationSummary,
} from '../modules/superadmin/types/model';

const { Title, Paragraph, Text } = Typography;

function formatPlanLabel(plan?: string) {
  if (plan === 'growth') return 'Growth';
  if (plan === 'enterprise') return 'Enterprise';
  return 'Starter';
}

function formatOperationalStatusLabel(status?: string) {
  return status === 'inactive' ? 'Inactiva' : 'Activa';
}

function formatPlanStatusLabel(planStatus?: string) {
  if (planStatus === 'past_due') return 'Past due';
  if (planStatus === 'canceled') return 'Cancelado';
  return 'Activo';
}

function getPlanStatusTagColor(planStatus?: string) {
  if (planStatus === 'past_due') return 'gold';
  if (planStatus === 'canceled') return 'red';
  return 'green';
}

function formatBillingRequestStatusLabel(status?: string) {
  if (status === 'contacted') return 'Contactado';
  if (status === 'approved') return 'Aprobado';
  if (status === 'rejected') return 'Rechazado';
  if (status === 'fulfilled') return 'Completado';
  return 'Pendiente';
}

function getBillingRequestStatusTagColor(status?: string) {
  if (status === 'contacted') return 'blue';
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'fulfilled') return 'purple';
  return 'gold';
}

function formatPaymentMethodLabel(value?: string | null) {
  if (value === 'manual_transfer') return 'Transferencia';
  if (value === 'nequi') return 'Nequi';
  if (value === 'whatsapp') return 'WhatsApp';
  if (value === 'wompi') return 'Wompi';
  if (value === 'mercadopago') return 'Mercado Pago';
  if (value === 'other') return 'Otro';
  return '-';
}

function formatAuditActionLabel(action?: string) {
  switch (action) {
    case 'organization.updated':
      return 'Organizacion actualizada';
    case 'invitation.created':
      return 'Invitacion creada';
    case 'invitation.resent':
      return 'Invitacion reenviada';
    case 'invitation.cancelled':
      return 'Invitacion cancelada';
    case 'membership.role-updated':
      return 'Rol de membresía actualizado';
    case 'membership.deactivated':
      return 'Membresia desactivada';
    case 'membership.reactivated':
      return 'Membresia reactivada';
    case 'membership.deleted':
      return 'Membresia eliminada';
    case 'billing-request.updated':
      return 'Solicitud comercial actualizada';
    default:
      return action || 'Accion registrada';
  }
}

function formatAuditSummary(record: SuperadminAuditLog) {
  const details = (record.details || {}) as Record<string, unknown>;

  if (record.action === 'organization.updated') {
    const changes: string[] = [];

    if (details.previousPlan !== details.nextPlan && details.nextPlan) {
      changes.push(`Plan: ${formatPlanLabel(String(details.nextPlan))}`);
    }

    if (details.previousStatus !== details.nextStatus && details.nextStatus) {
      changes.push(`Estado operativo: ${formatOperationalStatusLabel(String(details.nextStatus))}`);
    }

    if (details.previousPlanStatus !== details.nextPlanStatus && details.nextPlanStatus) {
      changes.push(`Estado del plan: ${formatPlanStatusLabel(String(details.nextPlanStatus))}`);
    }

    return changes.length > 0
      ? changes.join(' · ')
      : 'Se actualizaron datos generales de la organización.';
  }

  if (record.action === 'membership.role-updated') {
    if (details.previousRoleName && details.nextRoleName) {
      return `${String(details.previousRoleName)} -> ${String(details.nextRoleName)}`;
    }
    if (details.nextRoleName) {
      return `Nuevo rol: ${String(details.nextRoleName)}`;
    }
  }

  if (
    record.action === 'membership.deactivated' ||
    record.action === 'membership.reactivated' ||
    record.action === 'membership.deleted'
  ) {
    if (details.roleName) {
      return `Rol asociado: ${String(details.roleName)}`;
    }
  }

  if (
    record.action === 'invitation.created' ||
    record.action === 'invitation.resent' ||
    record.action === 'invitation.cancelled'
  ) {
    if (details.roleName) {
      return `Rol sugerido: ${String(details.roleName)}`;
    }
  }

  if (record.action === 'billing-request.updated') {
    if (details.previousStatus && details.nextStatus) {
      return `${formatBillingRequestStatusLabel(String(details.previousStatus))} -> ${formatBillingRequestStatusLabel(String(details.nextStatus))}`;
    }
  }

  return null;
}

function formatDate(value?: string) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-';
}

function formatAuditDetailLabel(key: string) {
  const labels: Record<string, string> = {
    previousPlan: 'Plan anterior',
    nextPlan: 'Plan nuevo',
    previousStatus: 'Estado operativo anterior',
    nextStatus: 'Estado operativo nuevo',
    previousPlanStatus: 'Estado del plan anterior',
    nextPlanStatus: 'Estado del plan nuevo',
    previousRoleName: 'Rol anterior',
    nextRoleName: 'Rol nuevo',
    roleName: 'Rol',
    previousStatusNotes: 'Notas anteriores',
    nextStatusNotes: 'Notas nuevas',
    previousPaymentMethod: 'Metodo de pago anterior',
    nextPaymentMethod: 'Metodo de pago nuevo',
    previousExternalReference: 'Referencia anterior',
    nextExternalReference: 'Referencia nueva',
    previousBillingNotes: 'Notas de billing anteriores',
    nextBillingNotes: 'Notas de billing nuevas',
    previousStatusLabel: 'Estado anterior',
    nextStatusLabel: 'Estado nuevo',
    nextPlanExpiresAt: 'Vencimiento del plan',
    nextGracePeriodEndsAt: 'Fin del periodo de gracia',
    nextAiLimit: 'Limite mensual de IA',
    nextExportLimitMonthly: 'Limite mensual de exportaciones',
    paymentMethod: 'Metodo de pago',
    externalReference: 'Referencia externa',
    billingNotes: 'Notas de billing',
  };

  return labels[key] || key;
}

function formatAuditDetailValue(key: string, value: unknown) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '-';
  }

  if (key.toLowerCase().includes('date') || key.toLowerCase().includes('at')) {
    if (typeof value === 'string' && dayjs(value).isValid()) {
      return formatDate(value);
    }
  }

  if (key.toLowerCase().includes('paymentmethod')) {
    return formatPaymentMethodLabel(String(value));
  }

  if (key === 'previousPlan' || key === 'nextPlan') {
    return formatPlanLabel(String(value));
  }

  if (key === 'previousStatus' || key === 'nextStatus') {
    return formatOperationalStatusLabel(String(value));
  }

  if (key === 'previousPlanStatus' || key === 'nextPlanStatus') {
    return formatPlanStatusLabel(String(value));
  }

  if (key === 'previousStatusLabel' || key === 'nextStatusLabel') {
    return formatBillingRequestStatusLabel(String(value));
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function getAuditChangeGroups(details: Record<string, unknown> | null) {
  if (!details) return [];

  const entries = Object.entries(details);
  const handledKeys = new Set<string>();
  const groups: Array<{
    label: string;
    previousKey?: string;
    previousValue?: unknown;
    nextKey?: string;
    nextValue?: unknown;
    singleKey?: string;
    singleValue?: unknown;
  }> = [];

  for (const [key, value] of entries) {
    if (handledKeys.has(key)) continue;

    if (key.startsWith('previous')) {
      const suffix = key.slice('previous'.length);
      const nextKey = `next${suffix}`;
      handledKeys.add(key);
      handledKeys.add(nextKey);
      groups.push({
        label: formatAuditDetailLabel(nextKey),
        previousKey: key,
        previousValue: value,
        nextKey,
        nextValue: details[nextKey],
      });
      continue;
    }

    if (key.startsWith('next')) {
      const suffix = key.slice('next'.length);
      const previousKey = `previous${suffix}`;
      if (details[previousKey] !== undefined) {
        handledKeys.add(key);
        handledKeys.add(previousKey);
        groups.push({
          label: formatAuditDetailLabel(key),
          previousKey,
          previousValue: details[previousKey],
          nextKey: key,
          nextValue: value,
        });
        continue;
      }
    }

    handledKeys.add(key);
    groups.push({
      label: formatAuditDetailLabel(key),
      singleKey: key,
      singleValue: value,
    });
  }

  return groups;
}

function getOrganizationAccessNotice(status?: string) {
  if (status === 'inactive') {
    return {
      type: 'warning' as const,
      message: 'Organización inactiva',
      description:
        'La organización completa queda suspendida. Aunque una membresía siga marcada como activa, sus usuarios no podrán entrar ni operar hasta reactivar la organización.',
    };
  }

  return {
    type: 'info' as const,
    message: 'Organización activa',
    description:
      'Las membresías activas pueden acceder normalmente. Si una persona no puede entrar, revisa si su membresía individual está inactiva.',
  };
}

export default function SuperadminView({ onBack }: { onBack: () => void }) {
  const { data: organizations = [], isLoading, isFetching } = useSuperadminOrganizations(true);
  const [inviteForm] = Form.useForm<{ email: string; roleDocumentId: string }>();
  const [organizationForm] = Form.useForm<{
    plan: 'starter' | 'growth' | 'enterprise';
    status: 'active' | 'inactive';
    planStatus: 'active' | 'past_due' | 'canceled';
    planExpiresAt: Dayjs | null;
    gracePeriodEndsAt: Dayjs | null;
    aiLimit: number | null;
    exportLimitMonthly: number | null;
    contactNumber: string;
    billingNotes: string;
    paymentMethod: 'manual_transfer' | 'nequi' | 'whatsapp' | 'wompi' | 'mercadopago' | 'other' | null;
    externalReference: string;
  }>();
  const [billingRequestForm] = Form.useForm<{
    status: 'pending' | 'contacted' | 'approved' | 'rejected' | 'fulfilled';
    paymentMethod:
      | 'manual_transfer'
      | 'nequi'
      | 'whatsapp'
      | 'wompi'
      | 'mercadopago'
      | 'other'
      | null;
    externalReference: string;
    statusNotes: string;
  }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<SuperadminOrganizationSummary | null>(
    null,
  );
  const [selectedBillingRequest, setSelectedBillingRequest] = useState<SuperadminBillingRequest | null>(
    null,
  );
  const [selectedAuditLog, setSelectedAuditLog] = useState<SuperadminAuditLog | null>(null);
  const [billingRequestActivationContext, setBillingRequestActivationContext] =
    useState<SuperadminBillingRequest | null>(null);
  const [organizationModalOpen, setOrganizationModalOpen] = useState(false);
  const [billingRequestModalOpen, setBillingRequestModalOpen] = useState(false);

  const billingRequestsQuery = useSuperadminBillingRequests(true);
  const billingRequestActions = useSuperadminBillingRequestActions();
  const membershipsQuery = useSuperadminOrganizationMemberships(selectedOrganization?.documentId);
  const invitationsQuery = useSuperadminOrganizationInvitations(selectedOrganization?.documentId);
  const auditLogsQuery = useSuperadminOrganizationAuditLogs(selectedOrganization?.documentId);
  const organizationActions = useSuperadminOrganizationActions(selectedOrganization?.documentId);
  const membershipActions = useSuperadminMembershipActions(selectedOrganization?.documentId);
  const invitationActions = useSuperadminInvitationActions(selectedOrganization?.documentId);

  useEffect(() => {
    const firstRole = membershipsQuery.data?.availableRoles?.[0]?.documentId;
    if (selectedOrganization && firstRole && !inviteForm.getFieldValue('roleDocumentId')) {
      inviteForm.setFieldValue('roleDocumentId', firstRole);
    }
  }, [inviteForm, membershipsQuery.data?.availableRoles, selectedOrganization]);

  useEffect(() => {
    if (!selectedOrganization || !organizationModalOpen) return;
    organizationForm.setFieldsValue({
      plan: selectedOrganization.plan || 'starter',
      status: selectedOrganization.status || 'active',
      planStatus: selectedOrganization.planStatus || 'active',
      planExpiresAt: selectedOrganization.planExpiresAt ? dayjs(selectedOrganization.planExpiresAt) : null,
      gracePeriodEndsAt: selectedOrganization.gracePeriodEndsAt
        ? dayjs(selectedOrganization.gracePeriodEndsAt)
        : null,
      aiLimit: typeof selectedOrganization.aiLimit === 'number' ? selectedOrganization.aiLimit : null,
      exportLimitMonthly:
        typeof selectedOrganization.exportLimitMonthly === 'number'
          ? selectedOrganization.exportLimitMonthly
          : null,
      contactNumber: selectedOrganization.contactNumber || '',
      billingNotes: selectedOrganization.billingNotes || '',
      paymentMethod: null,
      externalReference: '',
    });
  }, [organizationForm, organizationModalOpen, selectedOrganization]);

  useEffect(() => {
    if (!selectedBillingRequest || !billingRequestModalOpen) return;

    billingRequestForm.setFieldsValue({
      status: selectedBillingRequest.status || 'pending',
      paymentMethod: selectedBillingRequest.paymentMethod || null,
      externalReference: selectedBillingRequest.externalReference || '',
      statusNotes: selectedBillingRequest.statusNotes || '',
    });
  }, [billingRequestForm, billingRequestModalOpen, selectedBillingRequest]);

  const filteredOrganizations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return organizations;

    return organizations.filter((organization) =>
      [organization.name, organization.slug].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [organizations, searchTerm]);

  const openOrganizationEditor = (
    organization: SuperadminOrganizationSummary,
    overrides?: Partial<{
      plan: 'starter' | 'growth' | 'enterprise';
      status: 'active' | 'inactive';
      planStatus: 'active' | 'past_due' | 'canceled';
      planExpiresAt: Dayjs | null;
      gracePeriodEndsAt: Dayjs | null;
      paymentMethod:
        | 'manual_transfer'
        | 'nequi'
        | 'whatsapp'
        | 'wompi'
        | 'mercadopago'
        | 'other'
        | null;
      externalReference: string;
    }>,
  ) => {
    setSelectedOrganization(organization);
    organizationForm.setFieldsValue({
      plan: overrides?.plan || organization.plan || 'starter',
      status: overrides?.status || organization.status || 'active',
      planStatus: overrides?.planStatus || organization.planStatus || 'active',
      planExpiresAt:
        typeof overrides?.planExpiresAt !== 'undefined'
          ? overrides.planExpiresAt
          : organization.planExpiresAt
            ? dayjs(organization.planExpiresAt)
            : null,
      gracePeriodEndsAt:
        typeof overrides?.gracePeriodEndsAt !== 'undefined'
          ? overrides.gracePeriodEndsAt
          : organization.gracePeriodEndsAt
            ? dayjs(organization.gracePeriodEndsAt)
            : null,
      aiLimit: typeof organization.aiLimit === 'number' ? organization.aiLimit : null,
      exportLimitMonthly:
        typeof organization.exportLimitMonthly === 'number' ? organization.exportLimitMonthly : null,
      contactNumber: organization.contactNumber || '',
      billingNotes: organization.billingNotes || '',
      paymentMethod:
        typeof overrides?.paymentMethod !== 'undefined' ? overrides.paymentMethod : null,
      externalReference: overrides?.externalReference || '',
    });
    setOrganizationModalOpen(true);
  };

  const openOrganizationEditorFromBillingRequest = (request: SuperadminBillingRequest) => {
    const organization = organizations.find(
      item => item.documentId === request.organization?.documentId,
    );

    if (!organization) {
      message.warning('No encontramos la organización asociada a esta solicitud.');
      return;
    }

    const planExpiresAt = dayjs().add(1, 'month');
    const gracePeriodEndsAt = planExpiresAt.add(7, 'day');

    setBillingRequestActivationContext(request);
    setBillingRequestModalOpen(false);
    openOrganizationEditor(organization, {
      plan: request.requestedPlan,
      status: 'active',
      planStatus: 'active',
      planExpiresAt,
      gracePeriodEndsAt,
      paymentMethod: request.paymentMethod || null,
      externalReference: request.externalReference || '',
    });
  };

  const organizationColumns = [
    {
      title: 'Organización',
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, record: SuperadminOrganizationSummary) => (
        <div className="flex flex-col">
          <Text strong>{record.name}</Text>
          <Text type="secondary" className="text-xs">
            {record.slug}
          </Text>
        </div>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      render: (value: string | undefined) => <Tag color="blue">{formatPlanLabel(value)}</Tag>,
    },
    {
      title: 'Estado operativo',
      dataIndex: 'status',
      key: 'status',
      render: (value: string | undefined) => (
        <Tag color={value === 'inactive' ? 'default' : 'green'}>
          {formatOperationalStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: 'Estado del plan',
      dataIndex: 'planStatus',
      key: 'planStatus',
      render: (value: string | undefined) => (
        <Tag color={getPlanStatusTagColor(value)}>
          {formatPlanStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: 'Miembros',
      key: 'memberCount',
      render: (_: unknown, record: SuperadminOrganizationSummary) =>
        `${record.activeMemberCount}/${record.memberCount}`,
    },
    {
      title: 'Invitaciones',
      dataIndex: 'pendingInvitationCount',
      key: 'pendingInvitationCount',
    },
    {
      title: 'Proyectos',
      dataIndex: 'projectCount',
      key: 'projectCount',
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: SuperadminOrganizationSummary) => (
        <Button icon={<EyeOutlined />} onClick={() => setSelectedOrganization(record)}>
          Ver detalle
        </Button>
      ),
    },
  ];

  const billingRequestColumns = [
    {
      title: 'Organizacion',
      key: 'organization',
      render: (_: unknown, record: SuperadminBillingRequest) => (
        <div className="flex flex-col">
          <Text strong>{record.organization?.name || 'Sin organización'}</Text>
          <Text type="secondary" className="text-xs">
            {record.organization?.slug || record.source || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Plan solicitado',
      dataIndex: 'requestedPlan',
      key: 'requestedPlan',
      render: (value: string | undefined) => <Tag color="blue">{formatPlanLabel(value)}</Tag>,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (value: string | undefined) => (
        <Tag color={getBillingRequestStatusTagColor(value)}>
          {formatBillingRequestStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: 'Contexto',
      key: 'context',
      render: (_: unknown, record: SuperadminBillingRequest) => {
        if (
          typeof record.currentCount === 'number' &&
          typeof record.limitValue === 'number' &&
          record.limitValue > 0
        ) {
          return `${record.currentCount}/${record.limitValue}`;
        }

        return '-';
      },
    },
    {
      title: 'Solicitado por',
      key: 'requestedBy',
      render: (_: unknown, record: SuperadminBillingRequest) =>
        record.requestedBy?.email || record.requestedBy?.username || '-',
    },
    {
      title: 'Telefono',
      key: 'requestedByPhone',
      render: (_: unknown, record: SuperadminBillingRequest) =>
        record.requestedBy?.contactNumber || '-',
    },
    {
      title: 'Fecha',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      render: (value: string | undefined) => formatDate(value),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: SuperadminBillingRequest) => (
        <Space wrap>
          <Button
            size="small"
            onClick={() => {
              setSelectedBillingRequest(record);
              setBillingRequestModalOpen(true);
            }}
          >
            Gestionar
          </Button>
          {record.organization?.documentId ? (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                const organization = organizations.find(
                  item => item.documentId === record.organization?.documentId,
                );
                if (organization) {
                  setSelectedOrganization(organization);
                }
              }}
            >
              Abrir org
            </Button>
          ) : null}
          {record.organization?.documentId ? (
            <Button
              size="small"
              type="primary"
              onClick={() => openOrganizationEditorFromBillingRequest(record)}
            >
              Activar plan
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const membershipColumns = [
    {
      title: 'Usuario',
      key: 'user',
      render: (_: unknown, record: SuperadminMembership) => (
        <div className="flex flex-col">
          <Text strong>{record.user?.username || 'Usuario sin nombre'}</Text>
          <Text type="secondary" className="text-xs">
            {record.user?.email || 'Sin email'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Rol',
      key: 'role',
      render: (_: unknown, record: SuperadminMembership) => (
        <Space size={6}>
          {record.user?.isSuperAdmin ? <Tag color="magenta">Superadmin</Tag> : null}
          <Tag color="blue">{record.role?.name || 'Sin rol'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_: unknown, record: SuperadminMembership) => (
        <Space size={6}>
          <Tag color={record.isActive ? 'green' : 'default'}>
            {record.isActive ? 'Activa' : 'Inactiva'}
          </Tag>
          {record.user?.blocked ? <Tag color="red">Usuario bloqueado</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Creada',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string | undefined) => formatDate(value),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: SuperadminMembership) => (
        <Space wrap>
          <Select
            size="small"
            value={record.role?.documentId}
            className="min-w-[150px]"
            options={(membershipsQuery.data?.availableRoles || []).map((role) => ({
              label: role.name,
              value: role.documentId,
            }))}
            onChange={async (roleDocumentId) => {
              try {
                await membershipActions.updateRole.mutateAsync({
                  membershipDocumentId: record.documentId,
                  roleDocumentId,
                });
                message.success('Rol actualizado');
              } catch (error: any) {
                message.error(error?.response?.data?.error?.message || 'No se pudo actualizar el rol');
              }
            }}
          />
          {record.isActive ? (
            <Button
              size="small"
              onClick={async () => {
                try {
                  await membershipActions.deactivate.mutateAsync(record.documentId);
                  message.success('Membresía desactivada');
                } catch (error: any) {
                  message.error(
                    error?.response?.data?.error?.message || 'No se pudo desactivar la membresía',
                  );
                }
              }}
            >
              Desactivar
            </Button>
          ) : (
            <Button
              size="small"
              onClick={async () => {
                try {
                  await membershipActions.reactivate.mutateAsync(record.documentId);
                  message.success('Membresía reactivada');
                } catch (error: any) {
                  message.error(
                    error?.response?.data?.error?.message || 'No se pudo reactivar la membresía',
                  );
                }
              }}
            >
              Reactivar
            </Button>
          )}
          <Popconfirm
            title="¿Eliminar membresía?"
            description="Esta acción removerá el acceso del usuario a la organización."
            onConfirm={async () => {
              try {
                await membershipActions.remove.mutateAsync(record.documentId);
                message.success('Membresía eliminada');
              } catch (error: any) {
                message.error(error?.response?.data?.error?.message || 'No se pudo eliminar la membresía');
              }
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const invitationColumns = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol sugerido',
      key: 'role',
      render: (_: unknown, record: SuperadminInvitation) => record.role?.name || 'Sin rol',
    },
    {
      title: 'Invitada por',
      key: 'invitedBy',
      render: (_: unknown, record: SuperadminInvitation) =>
        record.invitedBy?.email || record.invitedBy?.username || '-',
    },
    {
      title: 'Fecha',
      dataIndex: 'invitedAt',
      key: 'invitedAt',
      render: (value: string | undefined) => formatDate(value),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: unknown, record: SuperadminInvitation) => (
        <Space>
          <Button
            size="small"
            icon={<MailOutlined />}
            onClick={async () => {
              try {
                await invitationActions.resend.mutateAsync(record.documentId);
                message.success(`Invitación reenviada a ${record.email}`);
              } catch (error: any) {
                message.error(error?.response?.data?.error?.message || 'No se pudo reenviar la invitación');
              }
            }}
          >
            Reenviar
          </Button>
          <Popconfirm
            title="Cancelar invitación"
            description={`Se cancelará la invitación para ${record.email}.`}
            onConfirm={async () => {
              try {
                await invitationActions.cancel.mutateAsync(record.documentId);
                message.success(`Invitación cancelada para ${record.email}`);
              } catch (error: any) {
                message.error(error?.response?.data?.error?.message || 'No se pudo cancelar la invitación');
              }
            }}
          >
            <Button size="small" icon={<StopOutlined />}>
              Cancelar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const auditLogColumns = [
    {
      title: 'Fecha',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string | undefined) => formatDate(value),
    },
    {
      title: 'Acción',
      dataIndex: 'action',
      key: 'action',
      render: (_value: string, record: SuperadminAuditLog) => {
        const summary = formatAuditSummary(record);

        return (
          <div className="flex flex-col">
            <Text strong>{formatAuditActionLabel(record.action)}</Text>
            {summary ? (
              <Text type="secondary" className="text-xs">
                {summary}
              </Text>
            ) : null}
          </div>
        );
      },
    },
    {
      title: 'Objetivo',
      key: 'target',
      render: (_: unknown, record: SuperadminAuditLog) => record.targetLabel || record.targetType || '-',
    },
    {
      title: 'Actor',
      key: 'actor',
      render: (_: unknown, record: SuperadminAuditLog) =>
        record.actor?.email || record.actor?.username || '-',
    },
    {
      title: 'Detalle',
      key: 'details',
      render: (_: unknown, record: SuperadminAuditLog) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedAuditLog(record)}>
          Ver detalle
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            Volver
          </Button>
          <div>
            <Title level={2} className="!mb-1">
              Panel Superadmin
            </Title>
            <Paragraph type="secondary" className="!mb-0">
              Consulta organizaciones, membresías e invitaciones globales del servicio.
            </Paragraph>
          </div>
        </div>
        <Card className="rounded-2xl border-slate-100 shadow-sm" styles={{ body: { padding: 16 } }}>
          <Space>
            <SafetyCertificateOutlined className="text-fuchsia-600" />
            <Text strong>{organizations.length}</Text>
            <Text type="secondary">organizaciones visibles</Text>
          </Space>
        </Card>
      </div>

      <Card className="rounded-[28px] border border-slate-100 shadow-[0_18px_48px_rgba(15,35,95,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Title level={4} className="!mb-1">
              Solicitudes de upgrade
            </Title>
            <Paragraph type="secondary" className="!mb-0">
              Gestiona solicitudes manuales de Growth y Enterprise antes de aplicar el cambio de plan.
            </Paragraph>
          </div>
          <Space>
            <Tag color="gold">
              Pendientes: {(billingRequestsQuery.data || []).filter(item => item.status === 'pending').length}
            </Tag>
            {billingRequestsQuery.isFetching ? <Spin size="small" /> : null}
          </Space>
        </div>

        <Table
          rowKey="documentId"
          columns={billingRequestColumns}
          dataSource={billingRequestsQuery.data || []}
          loading={billingRequestsQuery.isLoading}
          pagination={{ pageSize: 6 }}
          locale={{
            emptyText: <Empty description="No hay solicitudes comerciales registradas." />,
          }}
        />
      </Card>

      <Card className="rounded-[28px] border border-slate-100 shadow-[0_18px_48px_rgba(15,35,95,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Buscar por organización o slug"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="max-w-md"
          />
          {isFetching ? <Spin size="small" /> : null}
        </div>

        <Table
          rowKey="documentId"
          columns={organizationColumns}
          dataSource={filteredOrganizations}
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          locale={{
            emptyText: <Empty description="No hay organizaciones para mostrar." />,
          }}
        />
      </Card>

      <Drawer
        title={selectedOrganization ? `Detalle: ${selectedOrganization.name}` : 'Detalle de organización'}
        open={Boolean(selectedOrganization)}
        onClose={() => setSelectedOrganization(null)}
        width={920}
      >
        {selectedOrganization ? (
          <div className="space-y-6">
            <Card>
              <Alert
                type={getOrganizationAccessNotice(selectedOrganization.status).type}
                showIcon
                message={getOrganizationAccessNotice(selectedOrganization.status).message}
                description={getOrganizationAccessNotice(selectedOrganization.status).description}
                className="mb-4 rounded-2xl"
              />
              <div className="mb-4 flex justify-end">
                <Button
                  onClick={() => {
                    if (!selectedOrganization) return;
                    openOrganizationEditor(selectedOrganization);
                  }}
                >
                  Editar organización
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <Text type="secondary">Slug</Text>
                  <div className="font-semibold">{selectedOrganization.slug}</div>
                </div>
                <div>
                  <Text type="secondary">Plan</Text>
                  <div className="font-semibold">{formatPlanLabel(selectedOrganization.plan)}</div>
                </div>
                <div>
                  <Text type="secondary">Estado operativo</Text>
                  <div className="font-semibold">
                    {formatOperationalStatusLabel(selectedOrganization.status)}
                  </div>
                </div>
                <div>
                  <Text type="secondary">Estado del plan</Text>
                  <div className="font-semibold">
                    {formatPlanStatusLabel(selectedOrganization.planStatus)}
                  </div>
                </div>
                <div>
                  <Text type="secondary">Actualizada</Text>
                  <div className="font-semibold">{formatDate(selectedOrganization.updatedAt)}</div>
                </div>
                <div>
                  <Text type="secondary">Vence el plan</Text>
                  <div className="font-semibold">{formatDate(selectedOrganization.planExpiresAt || undefined)}</div>
                </div>
                <div>
                  <Text type="secondary">Fin de gracia</Text>
                  <div className="font-semibold">
                    {formatDate(selectedOrganization.gracePeriodEndsAt || undefined)}
                  </div>
                </div>
                <div>
                  <Text type="secondary">Limite IA</Text>
                  <div className="font-semibold">
                    {typeof selectedOrganization.aiLimit === 'number'
                      ? selectedOrganization.aiLimit
                      : 'Por plan'}
                  </div>
                </div>
                <div>
                  <Text type="secondary">Uso IA mensual</Text>
                  <div className="font-semibold">{selectedOrganization.aiUsageThisMonth || 0}</div>
                </div>
                <div>
                  <Text type="secondary">Limite exportaciones</Text>
                  <div className="font-semibold">
                    {typeof selectedOrganization.exportLimitMonthly === 'number'
                      ? selectedOrganization.exportLimitMonthly
                      : 'Por plan'}
                  </div>
                </div>
                <div>
                  <Text type="secondary">Uso exportaciones</Text>
                  <div className="font-semibold">{selectedOrganization.exportUsageThisMonth || 0}</div>
                </div>
                <div>
                  <Text type="secondary">Telefono</Text>
                  <div className="font-semibold">{selectedOrganization.contactNumber || '-'}</div>
                </div>
                <div className="md:col-span-3">
                  <Text type="secondary">Notas de billing</Text>
                  <div className="font-semibold">{selectedOrganization.billingNotes || '-'}</div>
                </div>
              </div>
            </Card>

            <Card title="Nueva invitación">
              <Form
                form={inviteForm}
                layout="vertical"
                onFinish={async (values) => {
                  try {
                    await invitationActions.invite.mutateAsync({
                      email: String(values.email || '').trim().toLowerCase(),
                      roleDocumentId: String(values.roleDocumentId || ''),
                    });
                    message.success('Invitación creada');
                    inviteForm.setFieldValue('email', '');
                  } catch (error: any) {
                    message.error(error?.response?.data?.error?.message || 'No se pudo crear la invitación');
                  }
                }}
              >
                <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
                  <Form.Item
                    label="Correo"
                    name="email"
                    className="mb-0"
                    rules={[{ required: true, message: 'Ingresa un correo' }]}
                  >
                    <Input placeholder="usuario@correo.com" />
                  </Form.Item>
                  <Form.Item
                    label="Rol"
                    name="roleDocumentId"
                    className="mb-0"
                    rules={[{ required: true, message: 'Selecciona un rol' }]}
                  >
                    <Select
                      options={(membershipsQuery.data?.availableRoles || []).map((role) => ({
                        label: role.name,
                        value: role.documentId,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item label=" " className="mb-0">
                    <Button type="primary" htmlType="submit" loading={invitationActions.invite.isPending}>
                      Invitar
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </Card>

            <Card title="Membresías">
              <Alert
                type="info"
                showIcon
                message="Como leer los estados"
                description="Membresía inactiva: bloquea solo a ese usuario. Organización inactiva: suspende a todos los miembros de la organización hasta reactivarla."
                className="mb-4 rounded-2xl"
              />
              <Table
                rowKey="documentId"
                columns={membershipColumns}
                dataSource={membershipsQuery.data?.memberships || []}
                loading={membershipsQuery.isLoading}
                pagination={false}
                locale={{
                  emptyText: <Empty description="No hay membresías en esta organización." />,
                }}
              />
            </Card>

            <Card title="Invitaciones pendientes">
              <Table
                rowKey="documentId"
                columns={invitationColumns}
                dataSource={invitationsQuery.data?.invitations || []}
                loading={invitationsQuery.isLoading}
                pagination={false}
                locale={{
                  emptyText: <Empty description="No hay invitaciones pendientes." />,
                }}
              />
            </Card>

            <Card title="Auditoría reciente">
              <Table
                rowKey="documentId"
                columns={auditLogColumns}
                dataSource={auditLogsQuery.data?.logs || []}
                loading={auditLogsQuery.isLoading}
                pagination={false}
                locale={{
                  emptyText: <Empty description="No hay eventos de auditoría todavía." />,
                }}
              />
            </Card>
          </div>
        ) : null}
      </Drawer>

      <Modal
        title="Detalle de auditoria"
        open={Boolean(selectedAuditLog)}
        onCancel={() => setSelectedAuditLog(null)}
        footer={null}
        width={760}
      >
        {selectedAuditLog ? (
          <div className="space-y-4">
            <Alert
              type="info"
              showIcon
              className="rounded-2xl"
              message={formatAuditActionLabel(selectedAuditLog.action)}
              description={formatAuditSummary(selectedAuditLog) || 'Sin resumen adicional.'}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Text type="secondary">Fecha</Text>
                <div className="font-semibold">{formatDate(selectedAuditLog.createdAt)}</div>
              </div>
              <div>
                <Text type="secondary">Actor</Text>
                <div className="font-semibold">
                  {selectedAuditLog.actor?.email || selectedAuditLog.actor?.username || '-'}
                </div>
              </div>
              <div>
                <Text type="secondary">Objetivo</Text>
                <div className="font-semibold">
                  {selectedAuditLog.targetLabel || selectedAuditLog.targetType || '-'}
                </div>
              </div>
              <div>
                <Text type="secondary">Tipo interno</Text>
                <div className="font-semibold">{selectedAuditLog.action || '-'}</div>
              </div>
            </div>

            <Card title="Campos registrados" size="small">
              {selectedAuditLog.details && Object.keys(selectedAuditLog.details).length > 0 ? (
                <div className="space-y-4">
                  {getAuditChangeGroups(selectedAuditLog.details).map((group, index) => {
                    const previousFormatted =
                      group.previousKey
                        ? formatAuditDetailValue(group.previousKey, group.previousValue)
                        : null;
                    const nextFormatted =
                      group.nextKey ? formatAuditDetailValue(group.nextKey, group.nextValue) : null;
                    const singleFormatted =
                      group.singleKey
                        ? formatAuditDetailValue(group.singleKey, group.singleValue)
                        : null;
                    const hasPair = group.previousKey || group.nextKey;
                    const previousMultiline =
                      typeof previousFormatted === 'string' && previousFormatted.includes('\n');
                    const nextMultiline =
                      typeof nextFormatted === 'string' && nextFormatted.includes('\n');
                    const singleMultiline =
                      typeof singleFormatted === 'string' && singleFormatted.includes('\n');

                    return (
                      <div
                        key={`${group.label}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <Text strong>{group.label}</Text>

                        {hasPair ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
                              <Tag color="red" className="mb-2">
                                Anterior
                              </Tag>
                              {previousMultiline ? (
                                <pre className="overflow-auto rounded-lg bg-white/80 p-3 text-xs text-slate-700">
                                  {String(previousFormatted || '-')}
                                </pre>
                              ) : (
                                <div className="font-semibold text-slate-700">
                                  {String(previousFormatted || '-')}
                                </div>
                              )}
                            </div>
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                              <Tag color="green" className="mb-2">
                                Nuevo
                              </Tag>
                              {nextMultiline ? (
                                <pre className="overflow-auto rounded-lg bg-white/80 p-3 text-xs text-slate-700">
                                  {String(nextFormatted || '-')}
                                </pre>
                              ) : (
                                <div className="font-semibold text-slate-700">
                                  {String(nextFormatted || '-')}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : singleMultiline ? (
                          <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                            {String(singleFormatted || '-')}
                          </pre>
                        ) : (
                          <div className="mt-2 font-semibold">{String(singleFormatted || '-')}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty description="Este evento no tiene detalles adicionales." />
              )}
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Gestionar solicitud comercial"
        open={billingRequestModalOpen}
        onCancel={() => {
          setBillingRequestModalOpen(false);
          setSelectedBillingRequest(null);
          billingRequestForm.resetFields();
        }}
        onOk={async () => {
          if (!selectedBillingRequest) return;

          try {
            const values = await billingRequestForm.validateFields();
            await billingRequestActions.updateBillingRequest.mutateAsync({
              billingRequestDocumentId: selectedBillingRequest.documentId,
              status: values.status,
              paymentMethod: values.paymentMethod || null,
              externalReference: String(values.externalReference || '').trim() || null,
              statusNotes: String(values.statusNotes || '').trim() || null,
            });

            message.success('Solicitud comercial actualizada');
            setBillingRequestModalOpen(false);
            setSelectedBillingRequest(null);
            billingRequestForm.resetFields();
          } catch (error: any) {
            message.error(
              error?.response?.data?.error?.message || error?.message || 'No se pudo actualizar la solicitud',
            );
          }
        }}
        confirmLoading={billingRequestActions.updateBillingRequest.isPending}
        width={720}
      >
        {selectedBillingRequest ? (
          <div className="space-y-4">
            <Alert
              type="info"
              showIcon
              className="rounded-2xl"
              message={`Solicitud para ${selectedBillingRequest.organization?.name || 'organización sin nombre'}`}
              description={`Plan solicitado: ${formatPlanLabel(selectedBillingRequest.requestedPlan)}. Solicitado por ${selectedBillingRequest.requestedBy?.email || selectedBillingRequest.requestedBy?.username || 'usuario desconocido'}.`}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Text type="secondary">Contexto de límite</Text>
                <div className="font-semibold">
                  {typeof selectedBillingRequest.currentCount === 'number' &&
                  typeof selectedBillingRequest.limitValue === 'number'
                    ? `${selectedBillingRequest.currentCount}/${selectedBillingRequest.limitValue}`
                    : '-'}
                </div>
              </div>
              <div>
                <Text type="secondary">Precio estimado</Text>
                <div className="font-semibold">
                  {typeof selectedBillingRequest.priceMonthlyUsd === 'number'
                    ? `$${selectedBillingRequest.priceMonthlyUsd}/mes`
                    : '-'}
                </div>
              </div>
              <div className="md:col-span-2">
                <Text type="secondary">Notas del usuario</Text>
                <div className="font-semibold">{selectedBillingRequest.notes || '-'}</div>
              </div>
            </div>

            <Alert
              type="warning"
              showIcon
              className="rounded-2xl"
              message="Siguiente paso sugerido"
              description="Cuando confirmes el pago, abre la organización para aplicar el plan solicitado, definir vencimiento y dejar el estado del plan en activo."
            />

            <Form form={billingRequestForm} layout="vertical">
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item
                  label="Estado comercial"
                  name="status"
                  rules={[{ required: true, message: 'Selecciona un estado' }]}
                >
                  <Select
                    options={[
                      { label: 'Pendiente', value: 'pending' },
                      { label: 'Contactado', value: 'contacted' },
                      { label: 'Aprobado', value: 'approved' },
                      { label: 'Rechazado', value: 'rejected' },
                      { label: 'Completado', value: 'fulfilled' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="Metodo de pago" name="paymentMethod">
                  <Select
                    allowClear
                    options={[
                      { label: 'Transferencia', value: 'manual_transfer' },
                      { label: 'Nequi', value: 'nequi' },
                      { label: 'WhatsApp', value: 'whatsapp' },
                      { label: 'Wompi', value: 'wompi' },
                      { label: 'Mercado Pago', value: 'mercadopago' },
                      { label: 'Otro', value: 'other' },
                    ]}
                  />
                </Form.Item>
              </div>

              <Form.Item label="Referencia externa" name="externalReference">
                <Input placeholder="Numero de comprobante, id de pago o nota corta" />
              </Form.Item>

              <Form.Item label="Notas internas" name="statusNotes">
                <Input.TextArea
                  rows={4}
                  placeholder="Ej. Pago confirmado por Nequi, pendiente activar Growth y responder por WhatsApp."
                />
              </Form.Item>
            </Form>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Text type="secondary">Ultimo estado</Text>
                <div className="font-semibold">
                  {formatBillingRequestStatusLabel(selectedBillingRequest.status)}
                </div>
              </div>
              <div>
                <Text type="secondary">Gestionado por</Text>
                <div className="font-semibold">
                  {selectedBillingRequest.handledBy?.email ||
                    selectedBillingRequest.handledBy?.username ||
                    '-'}
                </div>
              </div>
              <div>
                <Text type="secondary">Gestionado el</Text>
                <div className="font-semibold">
                  {formatDate(selectedBillingRequest.handledAt || undefined)}
                </div>
              </div>
              <div>
                <Text type="secondary">Metodo actual</Text>
                <div className="font-semibold">
                  {formatPaymentMethodLabel(selectedBillingRequest.paymentMethod)}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="primary"
                onClick={() => openOrganizationEditorFromBillingRequest(selectedBillingRequest)}
              >
                Abrir organización y aplicar plan
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Editar organización"
        open={organizationModalOpen}
        onCancel={() => {
          setOrganizationModalOpen(false);
          setBillingRequestActivationContext(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={organizationForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const updatedOrganizations = await organizationActions.updateOrganization.mutateAsync({
                plan: values.plan,
                status: values.status,
                planStatus: values.planStatus,
                planExpiresAt: values.planExpiresAt ? values.planExpiresAt.toISOString() : null,
                gracePeriodEndsAt: values.gracePeriodEndsAt
                  ? values.gracePeriodEndsAt.toISOString()
                  : null,
                aiLimit: typeof values.aiLimit === 'number' ? values.aiLimit : null,
                exportLimitMonthly:
                  typeof values.exportLimitMonthly === 'number' ? values.exportLimitMonthly : null,
                contactNumber: String(values.contactNumber || '').trim() || null,
                billingNotes: String(values.billingNotes || '').trim() || null,
                paymentMethod: values.paymentMethod || null,
                externalReference: String(values.externalReference || '').trim() || null,
              });
              message.success('Organización actualizada');
              if (billingRequestActivationContext) {
                try {
                  await billingRequestActions.updateBillingRequest.mutateAsync({
                    billingRequestDocumentId: billingRequestActivationContext.documentId,
                    status: 'fulfilled',
                    paymentMethod: values.paymentMethod || null,
                    externalReference: String(values.externalReference || '').trim() || null,
                    statusNotes:
                      `Plan ${values.plan} activado desde superadmin.` +
                      (values.planExpiresAt
                        ? ` Vence el ${values.planExpiresAt.format('DD/MM/YYYY HH:mm')}.`
                        : ''),
                  });
                } catch (billingRequestError: any) {
                  message.warning(
                    billingRequestError?.response?.data?.error?.message ||
                      'El plan se aplico, pero no pudimos marcar la solicitud como completada.',
                  );
                }
              }
              setSelectedOrganization(
                updatedOrganizations.find(
                  (organization) => organization.documentId === selectedOrganization?.documentId,
                ) || null,
              );
              setOrganizationModalOpen(false);
              setBillingRequestActivationContext(null);
            } catch (error: any) {
              message.error(error?.response?.data?.error?.message || 'No se pudo actualizar la organización');
            }
          }}
        >
          {billingRequestActivationContext ? (
            <Alert
              type="success"
              showIcon
              message="Activacion guiada desde una solicitud comercial"
              description={`Al guardar esta organización también marcaremos la solicitud de ${billingRequestActivationContext.organization?.name || 'la organización'} como completada.`}
              className="mb-4 rounded-2xl"
            />
          ) : null}
          <Alert
            type="info"
            showIcon
            message="Impacto del estado operativo"
            description="Si marcas la organización como inactiva, se suspende el acceso de todos sus miembros. Al volverla a activa, recuperan sus funcionalidades sin restauraciones manuales."
            className="mb-4 rounded-2xl"
          />
          <Form.Item
            label="Plan"
            name="plan"
            rules={[{ required: true, message: 'Selecciona un plan' }]}
          >
            <Select
              options={[
                { label: 'Starter', value: 'starter' },
                { label: 'Growth', value: 'growth' },
                { label: 'Enterprise', value: 'enterprise' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Estado operativo"
            name="status"
            rules={[{ required: true, message: 'Selecciona un estado' }]}
          >
            <Select
              options={[
                { label: 'Activa', value: 'active' },
                { label: 'Inactiva', value: 'inactive' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Estado del plan"
            name="planStatus"
            rules={[{ required: true, message: 'Selecciona el estado del plan' }]}
          >
            <Select
              options={[
                { label: 'Activo', value: 'active' },
                { label: 'Past due', value: 'past_due' },
                { label: 'Cancelado', value: 'canceled' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Vencimiento del plan" name="planExpiresAt">
            <DatePicker showTime className="w-full" format="DD/MM/YYYY HH:mm" />
          </Form.Item>
          <Form.Item label="Fin de período de gracia" name="gracePeriodEndsAt">
            <DatePicker showTime className="w-full" format="DD/MM/YYYY HH:mm" />
          </Form.Item>
          <Form.Item label="Limite mensual IA" name="aiLimit" extra="Dejalo vacio para usar el cupo del plan.">
            <InputNumber min={0} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item
            label="Limite mensual de exportaciones"
            name="exportLimitMonthly"
            extra="Dejalo vacio para usar el cupo del plan."
          >
            <InputNumber min={0} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item
            label="Telefono de contacto"
            name="contactNumber"
            extra="Se actualiza sobre la cuenta owner de la organización."
          >
            <Input placeholder="+57 300 123 4567" />
          </Form.Item>
          <Form.Item label="Metodo de pago" name="paymentMethod">
            <Select
              allowClear
              options={[
                { label: 'Transferencia manual', value: 'manual_transfer' },
                { label: 'Nequi', value: 'nequi' },
                { label: 'WhatsApp', value: 'whatsapp' },
                { label: 'Wompi', value: 'wompi' },
                { label: 'MercadoPago', value: 'mercadopago' },
                { label: 'Otro', value: 'other' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Referencia externa" name="externalReference">
            <Input placeholder="Ej: pago mayo, recibo 001, conversacion WA" />
          </Form.Item>
          <Form.Item label="Notas internas de billing" name="billingNotes">
            <Input.TextArea rows={4} placeholder="Notas manuales sobre cobro, acuerdo, renovacion o seguimiento." />
          </Form.Item>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setOrganizationModalOpen(false)}>Cancelar</Button>
            <Button type="primary" htmlType="submit" loading={organizationActions.updateOrganization.isPending}>
              Guardar
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
