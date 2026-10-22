import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Form, Input, Modal, Spin, message } from 'antd';
import { createExternalParticipant } from '../../modules/participant-directory/services/participantDirectoryService';
import { getDocument, listDocuments, updateDocument } from '../../modules/shared/services/strapi';
import { ProjectExternalContactsSection } from './ProjectExternalContactsSection';
import {
  canManageProjectExternalContacts,
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
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [form] = Form.useForm<ExternalContactFields>();
  const load = () => loadProjectExternalContacts(scope.organizationDocumentId, scope.projectDocumentId, {
    getProject: documentId => getDocument('/api/projects', documentId, { 'populate[0]': 'organization' }),
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
  const canManage = canManageProjectExternalContacts(scope) && verifiedScope && !contactsQuery.isError;
  const openEditor = (contact: ExternalContact | 'new') => {
    if (!canManage) return;
    form.resetFields();
    form.setFieldsValue(contact === 'new' ? { name: '', email: '', role: '' } : contact);
    setEditing(contact);
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

  if (!scope.organizationDocumentId || !scope.projectDocumentId) {
    return <Alert className="mt-5" type="info" title="Guarda el proyecto y selecciona una organización para consultar sus contactos externos." />;
  }
  if (contactsQuery.isPending) return <Spin aria-label="Cargando contactos externos" />;
  if (contactsQuery.isError || !verifiedScope) {
    return <Alert className="mt-5" type="warning" title="No pudimos verificar los contactos externos de este proyecto." />;
  }
  return <>
    <ProjectExternalContactsSection contacts={contacts} projectDocumentId={scope.projectDocumentId}
      canManage={canManage} onAdd={() => openEditor('new')} onEdit={openEditor} />
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
