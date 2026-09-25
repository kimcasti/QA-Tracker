# Validación previa a producción — 25 de septiembre de 2026

Resultado: las comprobaciones locales finales pasaron. No se realizó despliegue.

| Comprobación | Resultado |
| --- | --- |
| Frontend: `npm run lint` (TypeScript) | Sin errores |
| Frontend: `npm run build` | Compilación correcta |
| Backend: `npm test` | 89 pruebas aprobadas |
| Backend: `npm run build` | TypeScript y panel de Strapi compilados |
| Frontend: `node --test --test-concurrency=1 scripts/automation-runner-ui.test.mjs scripts/evidence-layout.test.mjs` | 2 pruebas aprobadas |
| Playwright: `tests/e2e/evidence-checklist.spec.ts --workers=1` | 2 pruebas aprobadas (390 y 900 px) |
| Playwright: `tests/e2e/public-smoke.spec.ts --workers=1` contra Vite preview de `dist` | 2 pruebas aprobadas: inicio y login |
| `git diff --check` | Sin errores |

## Cobertura

- Selección entre módulos, referencias inválidas y ejecutor desconectado.
- Envío de la selección, progreso y actualización al finalizar.
- Pestañas de casos e historial, ejecuciones interrumpidas y navegación entre resultados.
- Texto de ayuda visible únicamente en Casos automatizados y sin información fija del entorno.
- Resultados abiertos por defecto; estados Aprobado y Con fallos coherentes con los resultados.
- Diagnóstico, apertura de capturas y casos sin notas.
- Estilos reales del frontend y ausencia de desbordamiento del modal en móvil.
- Modal de evidencia en dos columnas, tooltip y botón de IA encima de los marcadores.
- Persistencia del checklist, Enter, recarga y modo de solo lectura.
- Backend: permisos, aislamiento por organización, referencias, reserva, desconexión, publicación atómica e idempotencia, entre otras pruebas existentes.

## Corrección durante la validación

La prueba antigua del checklist importaba directamente archivos internos de React desde la caché de Vite. Esto causaba un error de hooks antes de montar el editor. Se sustituyó ese montaje por `tests/e2e/support/evidence-checklist-harness.tsx`, con importaciones normales procesadas por Vite. Las dos pruebas pasaron tras el cambio.

El primer intento de smoke contra preview comenzó antes de que el servidor estuviera disponible. Se repitió tras confirmar el arranque y ambas pruebas pasaron.

## Alcance y observaciones

- Las pruebas del ejecutor usan respuestas simuladas en la interfaz y un adaptador en memoria en el backend. No validan una ejecución completa contra la base de datos de producción ni la sincronización de las nuevas tablas allí.
- No se crearon incidencias reales en Jira ni se invocó el servicio de IA. La tarjeta de Jira está incluida en la compilación; el envío externo no se verificó en esta sesión.
- Vite advierte sobre algunos chunks de más de 500 kB. Strapi advierte que los datos de Browserslist están desactualizados. Ambas compilaciones terminaron correctamente.
- Hay archivos nuevos sin seguimiento tanto en `client` como en `api`, incluidos los módulos del ejecutor. Deben incluirse en el commit de entrega; no basta con subir solo los archivos modificados.
- Para publicar el ejecutor completo deben coordinarse frontend, backend y scripts del ejecutor local según `api/docs/automation-runner.md`. La validación del despliegue con base de datos real queda pendiente.

Artefactos temporales de Playwright archivados en `.tmp/production-validation-2026-09-25` de la raíz del workspace.
