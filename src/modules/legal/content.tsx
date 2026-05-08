import {
  DatabaseOutlined,
  FileProtectOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

export type LegalSection = {
  title: string;
  body: string[];
};

export type LegalDocument = {
  path: '/terminos' | '/privacidad' | '/uso-ia';
  shortLabel: string;
  navLabel: string;
  title: string;
  description: string;
  summary: string;
  note: string;
  icon: ReactNode;
  accentColor: string;
  sections: LegalSection[];
};

export const legalDocuments: LegalDocument[] = [
  {
    path: '/terminos',
    shortLabel: 'T\u00e9rminos',
    navLabel: 'T\u00e9rminos',
    title: 'T\u00e9rminos y Condiciones',
    description:
      'Estas condiciones explican de forma simple c\u00f3mo funciona QA Tracker, qu\u00e9 puedes esperar del servicio y c\u00f3mo cuidamos una relaci\u00f3n clara con cada organizaci\u00f3n.',
    summary:
      'Buscamos que uses la plataforma con confianza, sin letra innecesariamente pesada y con reglas razonables para una herramienta SaaS moderna.',
    note:
      'Versi\u00f3n MVP inicial. Podemos actualizar estos t\u00e9rminos cuando el producto, planes o procesos evolucionen.',
    icon: <FileProtectOutlined />,
    accentColor: '#123F68',
    sections: [
      {
        title: 'Aceptaci\u00f3n del servicio',
        body: [
          'Al crear una cuenta, acceder a QA Tracker o usar cualquiera de sus funciones, aceptas estos T\u00e9rminos y Condiciones.',
          'Si usas la plataforma en nombre de una empresa u organizaci\u00f3n, entendemos que cuentas con autorizaci\u00f3n para hacerlo.',
        ],
      },
      {
        title: 'Uso permitido',
        body: [
          'QA Tracker est\u00e1 pensado para gestionar proyectos QA, funcionalidades, casos de prueba, ejecuciones, bugs, reportes t\u00e9cnicos, dashboards y an\u00e1lisis asistidos con IA.',
          'Puedes usar la plataforma para fines internos de operaci\u00f3n, seguimiento, documentaci\u00f3n y colaboraci\u00f3n de tu equipo.',
          'No est\u00e1 permitido usar el servicio para vulnerar sistemas, almacenar contenido ilegal, interferir con otros usuarios o intentar acceder sin autorizaci\u00f3n a informaci\u00f3n ajena.',
        ],
      },
      {
        title: 'Cuentas y accesos',
        body: [
          'Cada usuario es responsable de cuidar sus credenciales y del uso que se haga desde su cuenta.',
          'La organizaci\u00f3n administradora define qu\u00e9 personas pueden acceder a sus espacios, proyectos y datos.',
          'Podemos suspender accesos cuando detectemos uso indebido, riesgo de seguridad o incumplimientos relevantes.',
        ],
      },
      {
        title: 'Propiedad de datos',
        body: [
          'Los datos operativos que cargues en QA Tracker, como funcionalidades, pruebas, ejecuciones, bugs, reportes y documentos generados, siguen siendo de tu organizaci\u00f3n.',
          'Nos autorizas a procesarlos \u00fanicamente para prestar el servicio, mejorar la operaci\u00f3n de la plataforma y habilitar funciones relacionadas, incluida la asistencia con IA cuando corresponda.',
        ],
      },
      {
        title: 'Disponibilidad del servicio',
        body: [
          'Trabajamos para mantener QA Tracker disponible y estable, pero como cualquier servicio en l\u00ednea puede haber mantenimientos, actualizaciones o interrupciones no planificadas.',
          'Podemos hacer cambios t\u00e9cnicos, mejoras o ajustes operativos para seguir evolucionando el producto.',
        ],
      },
      {
        title: 'Limitaci\u00f3n de responsabilidad',
        body: [
          'QA Tracker es una herramienta de apoyo operativo. No garantizamos que el servicio sea completamente ininterrumpido ni que todo resultado generado sea perfecto para todos los contextos.',
          'En especial, los resultados asistidos con IA pueden contener errores, omisiones o interpretaciones incompletas, por lo que siempre deben validarse antes de usarse de forma operativa.',
        ],
      },
      {
        title: 'Funcionalidades premium',
        body: [
          'Algunas capacidades pueden depender del plan contratado, como l\u00edmites de uso, reportes avanzados, exportaciones ampliadas o funciones IA.',
          'Las funcionalidades incluidas en cada plan pueden ajustarse con la evoluci\u00f3n normal del producto.',
        ],
      },
      {
        title: 'Precios y cambios futuros',
        body: [
          'Los precios actuales o futuros pueden cambiar a medida que QA Tracker evolucione. Si esto ocurre, procuraremos informarlo con anticipaci\u00f3n razonable.',
          'Cualquier cambio de precio aplicar\u00e1 hacia adelante y no modificar\u00e1 retroactivamente per\u00edodos ya pagados.',
        ],
      },
      {
        title: 'Cancelaci\u00f3n o suspensi\u00f3n',
        body: [
          'Puedes dejar de usar el servicio en cualquier momento.',
          'Tambi\u00e9n podemos suspender o cancelar acceso cuando exista fraude, riesgo de seguridad, uso abusivo del servicio, incumplimientos graves o falta de pago en planes aplicables.',
        ],
      },
      {
        title: 'Contacto',
        body: [
          'Si tienes dudas sobre estas condiciones o necesitas ayuda con tu cuenta, puedes escribirnos por nuestros canales de contacto disponibles desde QA Tracker.',
        ],
      },
    ],
  },
  {
    path: '/privacidad',
    shortLabel: 'Privacidad',
    navLabel: 'Privacidad',
    title: 'Pol\u00edtica de Privacidad',
    description:
      'Esta pol\u00edtica resume qu\u00e9 datos usa QA Tracker, para qu\u00e9 los usamos y c\u00f3mo intentamos protegerlos dentro de una operaci\u00f3n SaaS razonable.',
    summary:
      'Queremos que tengas visibilidad clara sobre la informaci\u00f3n que entra a la plataforma y el uso que hacemos de ella para operar el servicio.',
    note:
      'Aplicamos medidas razonables de seguridad y seguimos ajustando controles a medida que crece el producto.',
    icon: <SafetyCertificateOutlined />,
    accentColor: '#149B8B',
    sections: [
      {
        title: 'Qu\u00e9 datos recopilamos',
        body: [
          'Recopilamos datos de cuenta y acceso, como nombre de usuario, correo, organizaci\u00f3n, roles y datos b\u00e1sicos de autenticaci\u00f3n.',
          'Tambi\u00e9n procesamos la informaci\u00f3n que tu equipo carga en la plataforma, como proyectos QA, funcionalidades, casos de prueba, ejecuciones, bugs, reportes, archivos exportados y notas operativas.',
        ],
      },
      {
        title: 'C\u00f3mo usamos la informaci\u00f3n',
        body: [
          'Usamos los datos para habilitar el acceso, organizar workspaces, guardar proyectos, generar reportes, mostrar m\u00e9tricas, administrar organizaciones y mejorar la experiencia del producto.',
          'Tambi\u00e9n podemos usar informaci\u00f3n operativa para ejecutar funciones asistidas con IA, siempre dentro del contexto del servicio.',
        ],
      },
      {
        title: 'Almacenamiento b\u00e1sico',
        body: [
          'La informaci\u00f3n se almacena en infraestructura y servicios necesarios para operar QA Tracker.',
          'Conservamos los datos mientras sean necesarios para prestar el servicio, cumplir procesos operativos razonables o atender requerimientos t\u00e9cnicos y de seguridad.',
        ],
      },
      {
        title: 'Seguridad razonable',
        body: [
          'Aplicamos medidas t\u00e9cnicas y organizativas razonables para proteger la informaci\u00f3n contra accesos no autorizados, p\u00e9rdida o uso indebido.',
          'Aun as\u00ed, ning\u00fan sistema en l\u00ednea puede garantizar seguridad absoluta.',
        ],
      },
      {
        title: 'Proveedores externos',
        body: [
          'Podemos apoyarnos en proveedores externos para hosting, autenticaci\u00f3n, almacenamiento, anal\u00edtica, generaci\u00f3n de documentos o funciones IA.',
          'Estos proveedores solo se usan en la medida necesaria para operar y mejorar QA Tracker.',
        ],
      },
      {
        title: 'Uso de IA',
        body: [
          'Algunas funciones pueden enviar informaci\u00f3n relevante del contexto operativo a servicios de IA para generar an\u00e1lisis, res\u00famenes, conclusiones o recomendaciones.',
          'El uso de estas funciones busca apoyar al usuario, no reemplazar su criterio ni su validaci\u00f3n humana.',
        ],
      },
      {
        title: 'Anal\u00edticas internas',
        body: [
          'Podemos usar anal\u00edticas internas y eventos de uso para entender qu\u00e9 funciones se usan m\u00e1s, detectar errores y mejorar rendimiento, estabilidad y experiencia.',
          'Estas anal\u00edticas se enfocan en mejorar el producto y su operaci\u00f3n.',
        ],
      },
      {
        title: 'Contacto de privacidad',
        body: [
          'Si tienes preguntas sobre privacidad, tratamiento de informaci\u00f3n o deseas reportar una inquietud relacionada con tus datos, puedes contactarnos por los canales oficiales de QA Tracker.',
        ],
      },
    ],
  },
  {
    path: '/uso-ia',
    shortLabel: 'Uso de IA',
    navLabel: 'Uso de IA',
    title: 'Pol\u00edtica de Uso de IA',
    description:
      'QA Tracker incorpora funciones de IA para acelerar an\u00e1lisis, res\u00famenes y recomendaciones dentro de los flujos de calidad, pero siempre como apoyo asistencial.',
    summary:
      'Queremos que la IA te ayude a avanzar m\u00e1s r\u00e1pido, sin venderla como reemplazo del criterio t\u00e9cnico o de la validaci\u00f3n humana.',
    note:
      'La IA en QA Tracker es una ayuda operativa. No constituye asesor\u00eda profesional, legal, t\u00e9cnica o regulatoria independiente.',
    icon: <RobotOutlined />,
    accentColor: '#6D5EF9',
    sections: [
      {
        title: 'C\u00f3mo funciona la IA en QA Tracker',
        body: [
          'La plataforma puede usar modelos de IA para generar an\u00e1lisis t\u00e9cnicos, res\u00famenes ejecutivos, conclusiones, identificaci\u00f3n de riesgos y recomendaciones basadas en la informaci\u00f3n disponible en el proyecto.',
          'Estas respuestas se producen autom\u00e1ticamente a partir del contexto suministrado por el usuario y la configuraci\u00f3n del sistema.',
        ],
      },
      {
        title: 'Limitaciones importantes',
        body: [
          'La IA no comprende tu contexto con certeza total y puede interpretar mal datos, omitir detalles relevantes o producir respuestas incompletas.',
          'Por eso, sus resultados no deben asumirse como exactos, definitivos o suficientes por s\u00ed solos.',
        ],
      },
      {
        title: 'Posibles errores',
        body: [
          'Los resultados pueden contener errores de redacci\u00f3n, priorizaci\u00f3n, clasificaci\u00f3n, tono o criterio t\u00e9cnico.',
          'Tambi\u00e9n pueden aparecer recomendaciones v\u00e1lidas en general, pero no adecuadas para tu flujo, industria o nivel de riesgo.',
        ],
      },
      {
        title: 'Responsabilidad del usuario',
        body: [
          'Cada usuario y organizaci\u00f3n sigue siendo responsable de revisar, validar y decidir c\u00f3mo usar la informaci\u00f3n generada por IA.',
          'Antes de aplicar un resultado en decisiones operativas, reportes finales, entregas a clientes o acciones cr\u00edticas, recomendamos una verificaci\u00f3n humana expresa.',
        ],
      },
      {
        title: 'Revisi\u00f3n humana recomendada',
        body: [
          'La mejor experiencia con IA en QA Tracker ocurre cuando se usa como primer borrador o apoyo para acelerar el an\u00e1lisis, y no como sustituto del juicio profesional del equipo.',
          'Tu equipo debe confirmar datos, contexto, riesgos y conclusiones antes de actuar sobre ellos.',
        ],
      },
      {
        title: 'Alcance del soporte IA',
        body: [
          'Los an\u00e1lisis generados por IA son apoyo operativo para el trabajo de QA, producto y coordinaci\u00f3n.',
          'No constituyen asesor\u00eda profesional independiente ni reemplazan revisiones t\u00e9cnicas, regulatorias, contractuales o especializadas que tu organizaci\u00f3n pueda necesitar.',
        ],
      },
    ],
  },
];

export const legalDocumentsByPath = Object.fromEntries(
  legalDocuments.map(document => [document.path, document]),
) as Record<LegalDocument['path'], LegalDocument>;

export const legalHighlights = [
  {
    title: 'Datos operativos',
    description: 'Tus proyectos, pruebas, bugs y reportes siguen siendo de tu organizaci\u00f3n.',
    icon: <DatabaseOutlined />,
  },
  {
    title: 'Seguridad razonable',
    description: 'Aplicamos medidas pr\u00e1cticas para proteger acceso, almacenamiento y operaci\u00f3n.',
    icon: <SafetyCertificateOutlined />,
  },
  {
    title: 'IA asistencial',
    description: 'La IA ayuda a analizar y redactar, pero no reemplaza validaci\u00f3n humana.',
    icon: <RobotOutlined />,
  },
] as const;
