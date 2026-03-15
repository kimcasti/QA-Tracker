import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  MailOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { toApiError } from '../../../config/http';
import { qaPalette, softSurface } from '../../../theme/palette';
import { useOrganizationTeam } from '../hooks/useOrganizationTeam';
import type {
  InvitationStatus,
  MemberStatus,
  OrganizationTeamInvitation,
  OrganizationTeamMember,
  OrganizationTeamRole,
  OrganizationTeamRoleCode,
} from '../types/model';

const { Paragraph, Text, Title } = Typography;

interface OrganizationTeamModalProps {
  open: boolean;
  onCancel: () => void;
}

const ROLE_META: Record<OrganizationTeamRoleCode, { label: string; color: string }> = {
  owner: { label: 'Owner', color: qaPalette.primary },
  'qa-lead': { label: 'QA Lead', color: qaPalette.accent },
  'qa-engineer': { label: 'QA Engineer', color: qaPalette.functionalityStatus.completed },
  viewer: { label: 'Viewer', color: qaPalette.secondary },
  manager: { label: 'Manager', color: qaPalette.textMuted },
};

const MEMBER_STATUS_META: Record<MemberStatus, { label: string; color: string }> = {
  active: { label: 'Activo', color: qaPalette.functionalityStatus.completed },
  inactive: { label: 'Desactivado', color: qaPalette.functionalityStatus.failed },
};

const INVITATION_STATUS_META: Record<InvitationStatus, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: qaPalette.functionalityStatus.inProgress },
  accepted: { label: 'Aceptada', color: qaPalette.functionalityStatus.completed },
  expired: { label: 'Expirada', color: qaPalette.functionalityStatus.failed },
  cancelled: { label: 'Cancelada', color: qaPalette.secondary },
};

function RoleTag({ role }: { role: OrganizationTeamRole | null }) {
  if (!role) {
    return <Text type="secondary">Sin rol</Text>;
  }

  const roleMeta = ROLE_META[role.code] || {
    label: role.name,
    color: qaPalette.secondary,
  };

  return (
    <Tag
      variant="filled"
      className="m-0 rounded-full px-3 py-1 font-semibold"
      style={{
        color: roleMeta.color,
        backgroundColor: softSurface(roleMeta.color),
      }}
    >
      {roleMeta.label}
    </Tag>
  );
}

function StatusTag({
  status,
  meta,
}: {
  status: InvitationStatus | MemberStatus;
  meta: { label: string; color: string };
}) {
  return (
    <Tag
      variant="filled"
      className="m-0 rounded-full px-3 py-1 font-semibold"
      style={{
        color: meta.color,
        backgroundColor: softSurface(meta.color),
      }}
    >
      {meta.label}
    </Tag>
  );
}

export function OrganizationTeamModal({ open, onCancel }: OrganizationTeamModalProps) {
  const [form] = Form.useForm<{ email: string; roleDocumentId: string }>();
  const {
    data,
    error,
    isLoading,
    isFetching,
    inviteMember,
    updateMemberRole,
    deactivateMember,
    reactivateMember,
    resendInvitation,
    cancelInvitation,
    isInviting,
    isUpdatingRole,
    isDeactivatingMember,
    isReactivatingMember,
    isResendingInvitation,
    isCancellingInvitation,
  } = useOrganizationTeam(open);

  const canManage = data?.canManage ?? false;
  const availableRoles = data?.availableRoles ?? [];
  const primaryInviteRole =
    availableRoles.find(role => role.code === 'qa-engineer')?.documentId ||
    availableRoles[0]?.documentId;

  useEffect(() => {
    if (!open || !primaryInviteRole) return;
    if (form.getFieldValue('roleDocumentId')) return;
    form.setFieldValue('roleDocumentId', primaryInviteRole);
  }, [form, open, primaryInviteRole]);

  const handleInvite = async (values: { email: string; roleDocumentId: string }) => {
    try {
      await inviteMember({
        email: values.email.trim().toLowerCase(),
        roleDocumentId: values.roleDocumentId,
      });
      message.success('Invitacion creada');
      form.setFieldValue('email', '');
    } catch (inviteError) {
      message.error(toApiError(inviteError).message);
    }
  };

  const handleRoleChange = async (member: OrganizationTeamMember, roleDocumentId: string) => {
    try {
      await updateMemberRole({
        membershipDocumentId: member.documentId,
        roleDocumentId,
      });
      message.success(`Rol actualizado para ${member.name}`);
    } catch (updateError) {
      message.error(toApiError(updateError).message);
    }
  };

  const handleDeactivate = async (member: OrganizationTeamMember) => {
    try {
      await deactivateMember(member.documentId);
      message.success(`Acceso desactivado para ${member.name}`);
    } catch (deactivateError) {
      message.error(toApiError(deactivateError).message);
    }
  };

  const handleReactivate = async (member: OrganizationTeamMember) => {
    try {
      await reactivateMember(member.documentId);
      message.success(`Acceso reactivado para ${member.name}`);
    } catch (reactivateError) {
      message.error(toApiError(reactivateError).message);
    }
  };

  const handleResend = async (invitation: OrganizationTeamInvitation) => {
    try {
      await resendInvitation(invitation.documentId);
      message.success(`Invitacion reenviada a ${invitation.email}`);
    } catch (resendError) {
      message.error(toApiError(resendError).message);
    }
  };

  const handleCancelInvitation = async (invitation: OrganizationTeamInvitation) => {
    try {
      await cancelInvitation(invitation.documentId);
      message.success(`Invitacion cancelada para ${invitation.email}`);
    } catch (cancelError) {
      message.error(toApiError(cancelError).message);
    }
  };

  const memberColumns: ColumnsType<OrganizationTeamMember> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (_, member) => (
        <div className="flex flex-col">
          <Text strong>{member.name}</Text>
          {member.isCurrentUser ? (
            <Text type="secondary" className="text-xs">
              Tu usuario actual
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Correo',
      dataIndex: 'email',
      key: 'email',
      render: value => value || <Text type="secondary">Sin correo</Text>,
    },
    {
      title: 'Rol',
      key: 'role',
      render: (_, member) =>
        canManage && member.status === 'active' ? (
          <Select
            value={member.role?.documentId}
            options={availableRoles.map(role => ({
              label: role.name,
              value: role.documentId,
            }))}
            onChange={value => handleRoleChange(member, value)}
            disabled={isUpdatingRole}
            className="min-w-[180px]"
          />
        ) : (
          <RoleTag role={member.role} />
        ),
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_, member) => (
        <StatusTag status={member.status} meta={MEMBER_STATUS_META[member.status]} />
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right',
      render: (_, member) => {
        if (!canManage || member.isCurrentUser) {
          return <Text type="secondary">Sin acciones</Text>;
        }

        if (member.status === 'inactive') {
          return (
            <Popconfirm
              title="Reactivar acceso"
              description={`Se restaurara el acceso de ${member.name}.`}
              okText="Reactivar"
              cancelText="Cancelar"
              onConfirm={() => handleReactivate(member)}
            >
              <Button type="text" icon={<ReloadOutlined />} loading={isReactivatingMember}>
                Reactivar acceso
              </Button>
            </Popconfirm>
          );
        }

        return (
          <Popconfirm
            title="Desactivar acceso"
            description={`Se revocara el acceso actual de ${member.name}.`}
            okText="Desactivar"
            cancelText="Cancelar"
            onConfirm={() => handleDeactivate(member)}
          >
            <Button danger type="text" icon={<StopOutlined />} loading={isDeactivatingMember}>
              Desactivar acceso
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const invitationColumns: ColumnsType<OrganizationTeamInvitation> = [
    {
      title: 'Correo',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      key: 'role',
      render: (_, invitation) => <RoleTag role={invitation.role} />,
    },
    {
      title: 'Fecha',
      dataIndex: 'invitedAt',
      key: 'invitedAt',
      render: value => dayjs(value).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Estado',
      key: 'status',
      render: (_, invitation) => (
        <StatusTag status={invitation.status} meta={INVITATION_STATUS_META[invitation.status]} />
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right',
      render: (_, invitation) => {
        if (!canManage) {
          return <Text type="secondary">Sin acciones</Text>;
        }

        return (
          <Space size="small">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => handleResend(invitation)}
              loading={isResendingInvitation}
            >
              Reenviar
            </Button>
            <Popconfirm
              title="Cancelar invitacion"
              description={`Se cancelara la invitacion para ${invitation.email}.`}
              okText="Cancelar invitacion"
              cancelText="Volver"
              onConfirm={() => handleCancelInvitation(invitation)}
            >
              <Button danger type="text" icon={<StopOutlined />} loading={isCancellingInvitation}>
                Cancelar
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1120}
      destroyOnHidden
      title={
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: softSurface(qaPalette.primary) }}
          >
            <TeamOutlined style={{ color: qaPalette.primary }} />
          </div>
          <div>
            <Title level={4} className="!mb-0">
              Crear equipo de trabajo
            </Title>
            <Text type="secondary">{data?.organization.name || 'Organización actual'}</Text>
          </div>
        </div>
      }
    >
      <div className="mt-6 flex flex-col gap-5">
        {error ? (
          <Alert
            type="error"
            showIcon
            message="No se pudo cargar el equipo"
            description={toApiError(error).message}
          />
        ) : null}

        <Card
          variant="borderless"
          className="rounded-[24px]"
          loading={isLoading}
          styles={{ body: { padding: 24 } }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <Title level={5} className="!mb-1">
                Equipo de la organización
              </Title>
              <Paragraph className="!mb-0 text-slate-500">
                Gestiona miembros activos e invitaciones pendientes sin salir de la escena principal
                del workspace.
              </Paragraph>
            </div>

            <Tag
              variant="filled"
              className="w-fit rounded-full px-3 py-1 font-semibold"
              style={{
                color: canManage ? qaPalette.functionalityStatus.completed : qaPalette.secondary,
                backgroundColor: softSurface(
                  canManage ? qaPalette.functionalityStatus.completed : qaPalette.secondary,
                ),
              }}
            >
              {canManage ? 'Owner / Admin' : 'Solo lectura'}
            </Tag>
          </div>

          {!canManage ? (
            <Alert
              className="mt-5"
              type="info"
              showIcon
              message="Solo Owner y QA Lead pueden gestionar miembros e invitaciones."
            />
          ) : (
            <Card size="small" className="mt-5 rounded-[20px]" styles={{ body: { padding: 20 } }}>
              <div className="mb-4 flex items-center gap-3">
                <MailOutlined style={{ color: qaPalette.primary }} />
                <div>
                  <Text strong>Invitar miembro</Text>
                  <div></div>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                onFinish={handleInvite}
                initialValues={{ roleDocumentId: primaryInviteRole }}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_132px] lg:items-start">
                  <Form.Item
                    name="email"
                    label="Correo"
                    rules={[
                      { required: true, message: 'Ingresa un correo.' },
                      { type: 'email', message: 'Ingresa un correo valido.' },
                    ]}
                    className="mb-0"
                  >
                    <Input size="large" placeholder="equipo@empresa.com" />
                  </Form.Item>

                  <Form.Item
                    name="roleDocumentId"
                    label="Rol"
                    rules={[{ required: true, message: 'Selecciona un rol.' }]}
                    className="mb-0"
                  >
                    <Select
                      size="large"
                      options={availableRoles.map(role => ({
                        label: role.name,
                        value: role.documentId,
                      }))}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<span className="opacity-0 select-none">Accion</span>}
                    className="mb-0"
                  >
                    <Button
                      type="primary"
                      size="large"
                      htmlType="submit"
                      icon={<UserSwitchOutlined />}
                      loading={isInviting}
                      className="h-10 w-full rounded-2xl"
                    >
                      Invitar
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </Card>
          )}
        </Card>

        <Card variant="borderless" className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <Title level={5} className="!mb-1">
                Miembros actuales
              </Title>
              <Text type="secondary">
                {data?.members.length || 0} miembros registrados en la organización.
              </Text>
            </div>
            {isFetching ? <Text type="secondary">Actualizando...</Text> : null}
          </div>

          <Table
            rowKey="documentId"
            columns={memberColumns}
            dataSource={data?.members || []}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No hay miembros disponibles."
                />
              ),
            }}
            scroll={{ x: 920 }}
          />
        </Card>

        <Card variant="borderless" className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
          <div className="mb-4">
            <Title level={5} className="!mb-1">
              Invitaciones pendientes
            </Title>
            <Text type="secondary">
              Historial operativo de invitaciones abiertas, expiradas o canceladas.
            </Text>
          </div>

          <Table
            rowKey="documentId"
            columns={invitationColumns}
            dataSource={data?.invitations || []}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No hay invitaciones pendientes."
                />
              ),
            }}
            scroll={{ x: 840 }}
          />
        </Card>
      </div>
    </Modal>
  );
}
