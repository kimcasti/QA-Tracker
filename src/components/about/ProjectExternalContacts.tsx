import { isAxiosError } from 'axios';
import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Modal, Spin, message } from 'antd';
import { createExternalParticipant, removeExternalParticipant } from '../../modules/participant-directory/services/participantDirectoryService';
import { listDocuments, updateDocument } from '../../modules/shared/services/strapi';
import { Http } from '../../config/http';
import { ProjectExternalContactsSection } from './ProjectExternalContactsSection';
import {
  canManageProjectExternalContacts,
  deleteProjectExternalContact,
  ExternalContactDeletionUnverifiedError,
  loadProjectExternalContacts,
  saveProjectExternalContact,
  selectProjectExternalContacts,
  type ExternalContact,
  type ExternalContactFields,
  type ExternalContactScope,
} from './projectExternalParticipants';

export function ProjectExternalContacts({ scope }: { scope: ExternalContactScope }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ExternalContact | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ExternalContact | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deletionUnverified, setDeletionUnverified] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [form] = Form.useForm<ExternalContactFields>();
  const load = () => loadProjectExternalContacts(scope.organizationDocumentId, scope.projectDocumentId, {
    // Core project responses sanitize organization without organization.find permission.
    // This authenticated endpoint already scopes projects to the caller's memberships.
    // Fetch fresh on every load/save; do not use the workspace's cached context.
    getProject: async documentId => {
      const response = await Http.get<{ projects: Array<{ documentId: string; organization?: { documentId?: string } }> }>('/api/me/project-contexts');
      const project = response.data.projects.find(item => item.documentId === documentId);
      if (!project) throw new Error('El proyecto ya no está disponible en tu espacio de trabajo.');
      return project;
    },
    listContacts: params => listDocuments<ExternalContact>('/api/external-participants', params, { paginateAll: false }),
  });
  const contactsQuery = useQuery({
    queryKey: ['about-project-external-contacts', scope.organizationDocumentId, scope.projectDocumentId],
    queryFn: load,
    enabled: Boolean(scope.organizationDocumentId && scope.projectDocumentId),
    staleTime: 60_000,
  });
  const verifiedScope = contactsQuery.data?.organizationDocumentId === scope.organizationDocumentId;
  const contacts = verifiedScope ? selectProjectExternalContacts(contactsQuery.data?.contacts || [],
    scope.organizationDocumentId, scope.projectDocumentId) : [];
  const mayManage = canManageProjectExternalContacts(scope);
  const canManage = mayManage && verifiedScope && !contactsQuery.isError && !deletionUnverified;
  const openEditor = (contact: ExternalContact | 'new') => {
    if (!canManage) return;
    form.resetFields();
    form.setFieldsValue(contact === 'new' ? { name: '', email: '', role: '' } : contact);
    setEditing(contact);
  };
  const addContact = async () => {
    if (!mayManage || contactsQuery.isFetching) return;
    if (canManage) { openEditor('new'); return; }
    // Recover by repeating the full project/tenant verification and directory read.
    const result = await contactsQuery.refetch();
    if (result.isError || result.data?.organizationDocumentId !== scope.organizationDocumentId) return;
    form.resetFields();
    form.setFieldsValue({ name: '', email: '', role: '' });
    setEditing('new');
  };
  const save = async () => {
    if (!canManage || !editing || savingRef.current) return;
    try {
      const values = await form.validateFields();
      if (savingRef.current) return;
      savingRef.current = true;
      setIsSaving(true);
      await saveProjectExternalContact(scope, { ...values,
        documentId: editing === 'new' ? undefined : editing.documentId }, {
        load,
        create: createExternalParticipant,
        update: (documentId, fields) => updateDocument('/api/external-participants', documentId, fields),
      });
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['about-project-external-contacts', scope.organizationDocumentId, scope.projectDocumentId] }),
        queryClient.invalidateQueries({ queryKey: ['external-participants'] }),
        queryClient.invalidateQueries({ queryKey: ['participant-directory-members'] }),
      ]);
      message.success('Contacto externo guardado. No se ha concedido acceso ni enviado correo.');
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) return;
      message.error(error instanceof Error ? error.message : 'No pudimos guardar el contacto externo.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!canManage || !deleting || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setDeleteError('');
    try {
      const verified = await deleteProjectExternalContact(scope, deleting.documentId, { load, remove: removeExternalParticipant });
      queryClient.setQueryData(['about-project-external-contacts', scope.organizationDocumentId, scope.projectDocumentId], verified);
      setDeleting(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['external-participants'] }),
        queryClient.invalidateQueries({ queryKey: ['participant-directory-members'] }),
      ]);
      message.success('Contacto externo eliminado del directorio.');
    } catch (error) {
      if (error instanceof ExternalContactDeletionUnverifiedError) {
        setDeleting(null);
        setDeletionUnverified(error.message);
        void queryClient.invalidateQueries({ queryKey: ['external-participants'] });
        void queryClient.invalidateQueries({ queryKey: ['participant-directory-members'] });
      } else {
        setDeleteError(error instanceof Error && !isAxiosError(error) ? error.message : 'No pudimos eliminar el contacto externo.');
      }
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };
  const refreshAfterDelete = async () => {
    const result = await contactsQuery.refetch();
    if (!result.isError && result.data?.organizationDocumentId === scope.organizationDocumentId) setDeletionUnverified('');
  };

  if (!scope.organizationDocumentId || !scope.projectDocumentId) {
    return <Alert className="mt-5" type="info" title="Guarda el proyecto y selecciona una organización para consultar sus contactos externos." />;
  }
  const needsVerification = contactsQuery.isError || !verifiedScope;
  const status = deletionUnverified ? <Alert type="warning" showIcon title={deletionUnverified}
    description={<div className="mt-3"><Button loading={contactsQuery.isFetching}
      onClick={() => void refreshAfterDelete()}>Actualizar lista de contactos</Button></div>} /> :
    contactsQuery.isPending ? <Spin aria-label="Cargando contactos externos" /> :
    needsVerification ? <Alert type="warning" showIcon title="No pudimos verificar los contactos externos de este proyecto."
      description={<>
        Reintenta la verificación antes de agregar un contacto. No se guardará nada hasta confirmar la organización y consultar el directorio.
        <div className="mt-3"><Button aria-label="Reintentar verificación" loading={contactsQuery.isFetching}
          onClick={() => void contactsQuery.refetch()}>Reintentar verificación</Button></div>
      </>} /> : undefined;
  return <>
    <ProjectExternalContactsSection contacts={contacts} projectDocumentId={scope.projectDocumentId}
      canManage={canManage && !isSaving} canAdd={mayManage} addDisabled={Boolean(deletionUnverified) || isSaving} addLoading={contactsQuery.isFetching}
      status={status} onAdd={() => void addContact()} onEdit={openEditor}
      onDelete={contact => { if (canManage && !savingRef.current) { setDeleteError(''); setDeleting(contact); } }} />
    <Modal title="Eliminar participante externo" open={Boolean(deleting) && canManage}
      onCancel={() => { if (!savingRef.current) setDeleting(null); }}
      onOk={() => void remove()} okText="Eliminar contacto externo" cancelText="Cancelar"
      okButtonProps={{ danger: true }} confirmLoading={isSaving} cancelButtonProps={{ disabled: isSaving }}
      closable={!isSaving} mask={{ closable: !isSaving }} keyboard={!isSaving} destroyOnHidden>
      <p>¿Eliminar a <strong style={{ overflowWrap: 'anywhere' }}>{deleting?.name}</strong>?</p>
      <p>Se eliminará este contacto externo del directorio. Esta acción no se puede deshacer.
        No elimina ninguna cuenta de usuario ni modifica el acceso de los miembros con cuenta.</p>
      {deleteError ? <Alert type="error" showIcon title={deleteError} /> : null}
    </Modal>
    <Modal title={editing === 'new' ? 'Agregar participante externo' : 'Editar participante externo'}
      open={Boolean(editing) && canManage} onCancel={() => { if (!isSaving) setEditing(null); }}
      onOk={() => void save()} okText="Guardar contacto externo" cancelText="Cancelar"
      confirmLoading={isSaving} cancelButtonProps={{ disabled: isSaving }} closable={!isSaving}
      mask={{ closable: !isSaving }} keyboard={!isSaving} destroyOnHidden>
      <Alert type="info" showIcon className="mb-4" title="Contacto sin cuenta"
        description="Solo se guarda en el directorio externo del proyecto. No crea usuarios, no concede acceso y no envía invitaciones ni correos." />
      <Form form={form} layout="vertical" disabled={isSaving}>
        <Form.Item name="name" label="Nombre del contacto" rules={[{ required: true, whitespace: true, message: 'Ingresa el nombre del contacto.' }]}>
          <Input maxLength={200} autoComplete="off" />
        </Form.Item>
        <Form.Item name="email" label="Correo de contacto (opcional)" rules={[{ type: 'email', message: 'Ingresa un correo válido.' }]}>
          <Input maxLength={254} autoComplete="off" />
        </Form.Item>
        <Form.Item name="role" label="Descripción del contacto (opcional)" extra="Ej. Cliente UAT. Es texto descriptivo, no un rol de acceso.">
          <Input maxLength={200} placeholder="Cliente UAT" />
        </Form.Item>
      </Form>
    </Modal>
  </>;
}
