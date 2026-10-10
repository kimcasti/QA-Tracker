import { CheckCircleOutlined, CopyOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';

const guides = {
  unassigned: {
    label: 'Sin asignar',
    Icon: LinkOutlined,
    title: 'Pruebas que aún necesitan un caso',
    description: 'Referencias detectadas en esta carpeta que no están vinculadas a ningún caso del proyecto.',
    action: 'Elige un caso libre y confirma en Revisar vínculos. Seleccionar no guarda el vínculo.',
  },
  registered: {
    label: 'Registradas',
    Icon: CheckCircleOutlined,
    title: 'Referencias ya vinculadas',
    description: 'Pruebas de este catálogo que ya tienen un caso asociado. Aquí puedes comprobar qué caso usa cada referencia.',
    action: 'Un vínculo registrado no indica que la prueba haya pasado; los resultados se consultan en las ejecuciones.',
  },
  missing: {
    label: 'Casos por revisar',
    Icon: SearchOutlined,
    title: 'Casos automatizados que necesitan revisión',
    description: 'Casos marcados como automatizados que no tienen referencia o cuya referencia no aparece en este catálogo.',
    action: 'Revisa la ruta, el nombre del test y el ambiente seleccionado. No significa que la ejecución haya fallado.',
  },
  duplicates: {
    label: 'Duplicadas',
    Icon: CopyOutlined,
    title: 'Referencias con más de una coincidencia',
    description: 'La misma referencia aparece varias veces en el catálogo o está vinculada a más de un caso del proyecto.',
    action: 'Revisa los tests y los casos asociados antes de vincular. Una referencia repetida en el catálogo no se puede asignar desde Sin asignar.',
  },
} as const;

export default function CatalogTabGuide({ tab }: { tab: keyof typeof guides }) {
  const guide = guides[tab];
  const Icon = guide.Icon;
  return (
    <aside role="note" aria-label={`Ayuda de ${guide.label}`} className={`catalog-tab-guide is-${tab}`}>
      <span className="catalog-tab-guide-icon"><Icon aria-hidden="true" /></span>
      <div>
        <strong>{guide.title}</strong>
        <p>{guide.description}</p>
        <div className="catalog-tab-guide-action"><span>Qué hacer</span>{guide.action}</div>
      </div>
    </aside>
  );
}
