# Canvas del proyecto

## Uso

Abre un proyecto y entra en **Más → Canvas**, después de Configuración y Acerca de. La ruta es `/projects/:projectKey/canvas`.

- Las tarjetas muestran los módulos y funcionalidades ya registrados. Los casos empiezan colapsados; el contador permite desplegar sus títulos.
- Los casos del proyecto sin funcionalidad disponible no impiden cargar el catálogo existente. Se incluyen en el total y se muestran aparte en **Casos sin funcionalidad**, como un listado de títulos de solo lectura. No se crean copias, no se inventan relaciones y no se reasignan ni eliminan automáticamente. Un padre presente pero ajeno, mal formado o incoherente sigue siendo un error de validación; no se convierte en un caso sin asignar.
- El título o lápiz de un caso abre el **editor existente** con su identificador persistido y funcionalidad exacta. «Volver al Canvas» recarga sus datos.
- **Elementos** permite pulsar o arrastrar Módulo, Funcionalidad, Nota y Casos de prueba. Por teclado/clic, los padres se eligen explícitamente. Arrastrar desde otro proyecto o sobre un destino incompatible no crea registros.
- El resumen superior muestra solo contadores. El icono **Información del Canvas**, junto a Elementos, contiene la ayuda de colores y conexiones, oculta por defecto. Se abre con clic o teclado y se cierra con Cerrar, Escape o un clic fuera; consultar la ayuda no guarda cambios.
- El panel plegable **Módulos**, en la esquina superior derecha del lienzo, permite buscar los módulos del proyecto y saltar a su tarjeta. La selección desplaza únicamente la vista y resalta el destino: no mueve tarjetas, no cambia el zoom ni guarda datos. También está disponible en solo lectura.
- Crear o editar módulos y funcionalidades guarda registros reales. Solo el nombre se exige en el formulario de funcionalidad; Sprint, Fecha de entrega, Prioridad, Impacto, Probabilidad y Estado actual pueden quedar sin definir. Limpiar un opcional envía `null`; no se inventan valores.
- «Agregar casos de prueba» reutiliza **Pegar casos en bloque**, con revisión y seguimiento de confirmados/pendientes. No expande automáticamente la lista. Ante una respuesta incierta, verifica y recarga antes de reintentar.

## Notas

Las notas no tienen título editable: solo cuerpo enriquecido y una referencia opcional.

- **Libres:** se ven como tarjetas en el Canvas.
- **Relacionadas:** no aparecen como tarjetas. Se consultan desde el icono del módulo, funcionalidad o caso, con indicador cuando hay contenido.
- Guardar una nota relacionada no abre su contenido automáticamente.
- Lápiz para editar; papelera con confirmación para eliminar. Cancelar/Escape no guarda cambios. Eliminar una nota no elimina registros QA.
- Se conservan negrita, listas y enlaces HTTP/HTTPS sin credenciales. El cliente y el servidor eliminan contenido activo y atributos no permitidos; las notas no admiten imágenes remotas.

## Distribución y colores

Arrastra el encabezado, usa «Ordenar Canvas» o ajusta X/Y desde el menú de color y posición. Los controles de zoom no cambian datos QA.

En escritorio, el lienzo aprovecha la altura disponible de la ventana, también al reducir el zoom del navegador; no se agrandan las tarjetas ni se cambian sus posiciones. En ventanas bajas, el panel Elementos dispone de desplazamiento propio. La disposición móvil se mantiene independiente.

La paleta fija usa encabezados suaves y cuerpos blancos. El color no representa estado, prioridad ni riesgo. Cada tarjeta conserva su color independiente; «Aplicar a sus funcionalidades» es la única propagación explícita de un módulo. «Color para nuevos elementos» no recolorea lo existente.

## Persistencia y permisos

La interfaz no almacena el Canvas en `localStorage` ni copia entidades para mostrarlas. El catálogo se consulta paginado y con document IDs del proyecto. La disposición, colores y notas se guardan aparte mediante:

- `GET /api/projects/:documentId/canvas`
- `PUT /api/projects/:documentId/canvas` con `{data:{revision,state}}`

El backend valida pertenencia a proyecto/organización y permisos. Lectura para miembros autorizados; edición para Owner, QA Lead, QA Engineer y Manager de la organización del proyecto, respetando restricciones de proyectos. Un Viewer no recibe acciones de escritura. El editor de casos debe usar esa misma organización, sin depender del orden de las membresías.

Cada guardado visual lleva revisión. Un `409`, una respuesta incierta o una recarga fallida bloquean la edición hasta una recarga explícita exitosa; esto también se aplica al volver a la pantalla si falla la consulta y quedan datos en caché. La recuperación automática de la consulta no levanta ese bloqueo. No hay reintento automático ni reemplazo por un Canvas vacío. Las creaciones QA y su distribución son operaciones distintas: si el registro se confirmó y falla la distribución o su lectura de verificación, recarga y no vuelvas a crear el registro.

En el editor de casos abierto desde Canvas, un guardado pendiente impide otro envío. Ante resultado incierto, **Recargar casos** debe completar una lectura nueva antes de habilitar escrituras y descarta el formulario obsoleto; un refresco fallido mantiene el bloqueo. Eliminar/reordenar casos se hace desde la vista habitual de casos, no desde este editor exacto. Cambiar de proyecto o cerrar el editor impide que una operación todavía en preflight inicie una escritura; una solicitud ya enviada puede haber sido recibida por el servidor y no se promete deshacerla.

## Verificación local segura

Con Node compatible e instalado, desde `client/`, usa un `QA_SECURITY_SCRATCH` fuera de Git:

```sh
npm run test:unit -- --test-concurrency=1
node scripts/test-canvas-workspace.test.mjs
node scripts/test-canvas-case-save.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

El harness de Workspace monta los componentes, editor, pegado y servicios reales contra HTTP interceptado con datos sintéticos. No inicia API ni modifica bases reales. Las pruebas de Board se incluyen en el runner unitario.

El esquema nuevo de API debe estar disponible para usar persistencia. No arranques Strapi contra una base compartida solo para probarlo: primero confirma entorno, destino de DB, respaldo y autorización. La compilación y las pruebas aisladas no prueban sincronización de esquema, atomicidad SQL ni funcionamiento desplegado. Integrar una rama local no publica cambios.
