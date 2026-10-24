import type { Sprint } from '../../../types';

type SprintImportIO = {
  list: () => Promise<Sprint[]>;
  save: (sprint: Sprint) => Promise<Sprint>;
};

export async function syncImportedSprints(
  rows: Record<string, unknown>[],
  projectId: string | undefined,
  io: SprintImportIO,
): Promise<{ sprintNames: string[]; createdSprintNames: string[] }> {
  if (!projectId?.trim()) throw new Error('No se encontró el proyecto activo para importar sprints.');
  const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
  const requested = new Map<string, string>();
  for (const row of rows) {
    const value = row.sprint || row.Sprint;
    if (typeof value !== 'string' || !value.trim()) continue;
    const name = value.trim();
    if (!requested.has(normalize(name))) requested.set(normalize(name), name);
  }
  const current = await io.list();
  const names = new Map(current.filter(item => item.projectId === projectId)
    .map(item => [normalize(item.name), item.name]));
  const createdSprintNames: string[] = [];
  for (const [key, name] of requested) {
    if (names.has(key)) continue;
    await io.save({
      id: '', projectId, name, startDate: '', endDate: '', status: 'Planeado',
      objective: 'Creado automáticamente durante la importación. Fechas pendientes de configurar.',
    });
    names.set(key, name);
    createdSprintNames.push(name);
  }
  const verified = await io.list();
  const verifiedNames = new Map(verified.filter(item => item.projectId === projectId)
    .map(item => [normalize(item.name), item.name]));
  for (const key of requested.keys()) {
    if (!verifiedNames.has(key)) {
      throw new Error('No se pudo verificar el registro de los sprints. No se importaron las funcionalidades; vuelve a intentarlo.');
    }
  }
  return { sprintNames: [...verifiedNames.values()], createdSprintNames };
}
