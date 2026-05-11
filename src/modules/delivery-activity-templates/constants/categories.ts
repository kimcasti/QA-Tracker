export const deliveryActivityCategoryOptions = [
  'Gestión y Gobernanza del Proyecto',
  'Discovery y Evaluación Inicial',
  'Administración de Infraestructura y Entornos',
  'Mantenimiento y Soporte Técnico',
  'Desarrollo y Evolución del Software',
  'Gestión de Calidad y Control de Pruebas',
  'Gestión de Seguridad y Cumplimiento',
  'Gestión de DevOps y Configuración Técnica',
  'Monitoreo, Optimización y Rendimiento',
  'Documentación e Informes',
] as const;

export type DeliveryActivityCategory =
  (typeof deliveryActivityCategoryOptions)[number];
