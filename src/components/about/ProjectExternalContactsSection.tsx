import React from 'react';
import { Button, Empty, Tag, Typography } from 'antd';
import type { ExternalContact } from './projectExternalParticipants';

export function ProjectExternalContactsSection({ contacts, projectDocumentId, canManage, onAdd, onEdit }: {
  contacts: ExternalContact[];
  projectDocumentId: string;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (contact: ExternalContact) => void;
}) {
  return (
    <section className="mt-6 min-w-0 border-t border-slate-200 pt-5" aria-label="Participantes externos (sin cuenta)">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Typography.Text strong>Participantes externos (sin cuenta)</Typography.Text>
        {canManage ? <Button onClick={onAdd}>Agregar externo</Button> : null}
      </div>
      <Typography.Paragraph className="!mb-4 text-slate-500">
        Contactos para minutas y UAT. No conceden acceso, no crean usuarios ni envían invitaciones o correos.
      </Typography.Paragraph>
      {contacts.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay contactos externos para este proyecto." /> : null}
      {[
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
                  <Button size="small" aria-label={`Editar contacto ${contact.name}`} onClick={() => onEdit(contact)}>Editar</Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null)}
      {contacts.some(contact => !contact.sourceProject) ? (
        <Typography.Text className="block text-xs text-slate-500">
          Los contactos del directorio son compartidos; no se trasladan ni modifican desde este proyecto.
        </Typography.Text>
      ) : null}
    </section>
  );
}
