import React from 'react';
import { Button, Empty, Tag, Typography } from 'antd';
import { ProjectExternalContactsDisclosure } from './ProjectExternalContactsDisclosure';
import type { ExternalContact } from './projectExternalParticipants';

export function ProjectExternalContactsSection({ contacts, projectDocumentId, canManage, canAdd = canManage, addLoading = false, addDisabled = false, status, onAdd, onEdit, onDelete }: {
  contacts: ExternalContact[];
  projectDocumentId: string;
  canManage: boolean;
  canAdd?: boolean;
  addLoading?: boolean;
  addDisabled?: boolean;
  status?: React.ReactNode;
  onAdd: () => void;
  onEdit: (contact: ExternalContact) => void;
  onDelete?: (contact: ExternalContact) => void;
}) {
  return (
    <section className="mt-6 min-w-0 border-t border-slate-200 pt-5" aria-label="Participantes externos (sin cuenta)">
      <ProjectExternalContactsDisclosure title="Participantes externos (sin cuenta)" count={status ? '—' : contacts.length}
        action={canAdd ? <Button aria-label="Agregar externo" disabled={addDisabled} loading={addLoading} onClick={onAdd}>Agregar externo</Button> : null}
        summary={<>
          <Typography.Paragraph className="!mb-4 text-slate-500">
            Contactos para minutas y UAT. No conceden acceso, no crean usuarios ni envían invitaciones o correos.
          </Typography.Paragraph>
          {status}
        </>}>
      {!status && contacts.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay contactos externos para este proyecto." /> : null}
      {!status && [
        { title: 'Del proyecto', items: contacts.filter(contact => contact.sourceProject?.documentId === projectDocumentId) },
        { title: 'Directorio de la organización', items: contacts.filter(contact => !contact.sourceProject) },
      ].map(group => group.items.length ? (
        <div key={group.title} className="mb-4 min-w-0">
          <Typography.Text className="mb-2 block text-xs font-semibold text-slate-500">{group.title}</Typography.Text>
          <ul className="m-0 list-none space-y-2 p-0">
            {group.items.map(contact => (
              <li key={contact.documentId} className="flex min-w-0 flex-wrap items-start gap-2 rounded-2xl border border-slate-100 p-3">
                <div className="min-w-0 flex-1" style={{ overflowWrap: 'anywhere' }}>
                  <Typography.Text strong>{contact.name}</Typography.Text>
                  <Tag color="gold" className="ml-2">Externo · sin acceso</Tag>
                  {contact.email ? <div className="text-sm text-slate-500">{contact.email}</div> : null}
                  {contact.role ? <div className="text-sm text-slate-500">{contact.role}</div> : null}
                </div>
                {canManage && contact.sourceProject?.documentId === projectDocumentId ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="small" aria-label={`Editar contacto ${contact.name}`} onClick={() => onEdit(contact)}>Editar</Button>
                    {onDelete ? <Button size="small" danger aria-label={`Eliminar contacto ${contact.name}`}
                      onClick={() => onDelete(contact)}>Eliminar</Button> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null)}
      {!status && contacts.some(contact => !contact.sourceProject) ? (
        <Typography.Text className="block text-xs text-slate-500">
          Los contactos del directorio son compartidos; no se trasladan ni modifican desde este proyecto.
        </Typography.Text>
      ) : null}
      </ProjectExternalContactsDisclosure>
    </section>
  );
}
