# Disciplina de delegacion (roles del proyecto vs nativos OpenCode)

## El sintoma reportado

En la sesion `ses_210f79b8effe...` (2026-05-03 18:09 UTC), el usuario pidio "ayudame a implementar esta propuesta `/root/.../PROPUESTA-ABAX-MEMORY-GENERICO.md`". El orquestador, en lugar de leer el `project-manifest.yaml` y activar `iteration-strategy`, delego:

1. **`@explore`** una tarea exhaustiva de listar archivos, leer `bitacora.md`, leer `registro-entregables.md` (3+ minutos)
2. **`@general`** la lectura de la propuesta entera

Ambos son **subagents nativos de OpenCode**, NO los roles del proyecto. No tienen cargadas las skills criticas (`role-boundaries`, `anti-mock-review`, `existing-docs-update-protocol`, `code-naming-convention`, `git-collaboration`, `documentation-quality-bar`, `iteration-strategy`).

Resultado: contexto fragmentado, exploracion redundante, ninguna activacion de `iteration-strategy` (a pesar de que el proyecto Abax-Memory v1.0.0 estaba cerrado y la propuesta menciona "v2.0.0").

## Causa raiz

El orchestrator template definia QUE roles existen pero **no especificaba CUANDO usar roles del proyecto vs subagents nativos de OpenCode**. Asumia que el orquestador siempre usaria roles del proyecto, sin guard rail explicito.

Adicionalmente, `iteration-strategy` no tenia activacion temprana — esperaba que el orquestador llegara hasta cierto punto del flujo cascada antes de detectar la condicion.

## La respuesta: priorizar, no prohibir

Decision arquitectural importante: **NO prohibimos los nativos**. Tienen usos legitimos donde su eficiencia justifica:

- **`@explore`**: busqueda masiva en codebase con herramientas optimizadas (mejor que un developer cargando todo su contexto para hacer un grep)
- **`@docs`**: lookup de doc oficial de libreria externa (web fetch optimizado)
- **`@plan`**: bosquejo exploratorio de opciones (NO compromete decision formal — para eso esta el solution-architect)
- **`@general`**: resumen multi-area sin entregable (sintesis liviana)

Lo correcto es **priorizar roles del proyecto** para todo lo que produce valor entregable, y **reservar nativos** para tareas de soporte donde no hay ningun veto activo.

## Skill `delegation-discipline` (nueva, asignada a 6 roles coordinadores)

Wired a: `project-manager`, `product-owner`, `business-analyst`, `tech-writer`, `solution-architect`, `tech-lead`.

### Matriz de decision

| Tipo de trabajo | Quien lo hace | Razon |
|---|---|---|
| Entregables formales (vision, source-code, runbook, ADR) | **Solo roles del proyecto** | Necesitan role-boundaries + approver RACI + skills calidad |
| Decisiones formales (spec, arquitectura, plan despliegue) | **Solo roles del proyecto** | Necesitan approver formal y trazabilidad |
| Modificacion de archivos en `docs/` | **Solo roles del proyecto** | Necesitan `existing-docs-update-protocol` + `documentation-quality-bar` |
| Modificacion de `src/` o codigo de produccion | **Solo roles del proyecto** | Necesitan `code-naming-convention` + `anti-mock-review` |
| `git commit` / `git push` | **Solo roles del proyecto** con bash + `git-collaboration` | Distributed flow + branch convention |
| Validacion contra spec / criterios de aceptacion | **Solo roles del proyecto** | Necesitan sesgo del rol (BA, qa-functional) |
| Aprobacion de fase / gate | **Solo roles del proyecto** segun RACI | Approver formal definido |
| Exploracion read-only (grep, find, list) | `@explore` permitido | Mas eficiente |
| Research libreria externa | `@docs` permitido | Lookup, no decision |
| Bosquejo exploratorio (no ADR) | `@plan` permitido | Brainstorm previo |
| Resumen multi-area sin entregable | `@general` permitido si NO escribe ni commitea | Coordinacion liviana |
| Lectura individual de archivo conocido | El orquestador lo hace directamente con `read` | Innecesario delegar |

### Los 4 vetos criticos para nativos

Cualquier nativo (`@explore`, `@general`, `@plan`, `@docs`) NO puede:

1. **Veto 1**: `write` o `edit` en `docs/`, `src/`, raiz del proyecto
2. **Veto 2**: `git commit` o `git push` (cualquier operacion git)
3. **Veto 3**: Decision formal con approver RACI (ADR, spec, plan)
4. **Veto 4**: Producir entregable formal de `phase-deliverables.yaml`

Si la Task entra en cualquiera de los 4, va a un rol del proyecto sin importar lo "simple" que parezca.

## Refuerzo de `iteration-strategy`

### Atajo de deteccion (lee 3 archivos sin delegar)

Antes de delegar nada, el orquestador lee directamente:

1. `project-manifest.yaml` (raiz del proyecto) → nombre, tamano, stack, equipo, modo, fases (5 segundos, 1 read)
2. `docs/bitacora.md` (si existe) → estado del proyecto
3. `CHANGELOG.md` (si existe) → releases publicados

80% del contexto en 3 reads. Solo despues evalua si delegar exploracion adicional.

### Activacion bloqueante temprana

`iteration-strategy` se activa cuando se cumplen DOS condiciones simultaneas:

1. Proyecto tiene historia previa (`bitacora.md`, releases en `CHANGELOG.md`, fase-9-cierre, manifest con `mode: continue`)
2. Sesion implica trabajo nuevo de alcance significativo (palabras clave: v2/v3/iteracion/evolucion/implementar propuesta)

Si AMBAS, el orquestador **DETIENE** el flujo y pregunta al usuario A/B/C/D ANTES de delegar. NO delega exploracion exhaustiva esperando "ver mas".

## Refuerzo del orchestrator template

Sección nueva "ROLES DEL PROYECTO vs SUBAGENTS NATIVOS" en el orchestrator template (opencode + claude) que incluye:

- Tabla "Cuando usar nativos (OK)" con 5 casos legitimos
- Tabla "Cuando NUNCA usar nativos (Veto)" con los 4 vetos enumerados
- Atajo "Lee el manifest antes de explorar"
- Instruccion critica reordenada: paso 1 = leer manifest+bitacora+changelog; paso 2 = activar iteration-strategy si aplica; pasos 3-5 = delegar segun matriz

## Procedimiento correcto del orquestador (ejemplo)

Usuario dice: *"Ayudame a implementar esta propuesta /root/.../PROPUESTA-ABAX-MEMORY-GENERICO.md"*

**Lo que el orquestador hace ahora (con 0.1.29)**:

1. Lee `project-manifest.yaml` (sin Task) → confirma proyecto Abax-Memory, modo `continue`, tamano small, stack legacy-other.
2. Lee `docs/bitacora.md` (sin Task) → confirma fases 0-9 completas, proyecto cerrado.
3. Lee primeras 50 lineas de la propuesta (sin Task) → confirma que es propuesta v2.0.0.
4. **Activa `iteration-strategy`** → DOS condiciones cumplidas (proyecto cerrado + nueva iteracion mayor).
5. Pregunta al usuario A/B/C/D (folder por release, bloque cambios, archivar, branch).
6. Recibe respuesta del usuario (ej: A — folder por release).
7. Documenta decision en `docs/iteration-log.md` (delegado a `@project-manager`, NO a `@general`).
8. **Ahora si** delega Discovery v2 a `@business-analyst` con instruccion explicita de:
   - Path: `docs/entregables/v2/fase-0-descubrimiento/vision-producto.md` (no sobreescribir v1)
   - Cargar `existing-docs-update-protocol`
   - Cargar `documentation-quality-bar` (frontmatter de procedencia + iteraciones)

## Tests integrales

`tests/integration/delegation-discipline.test.ts` con 18 tests que cubren:

- Skill content: matriz, 4 vetos, atajo manifest, 3 guides, wiring a 6 roles
- iteration-strategy reforzado: when_to_use con "PRIMER mensaje" + "implementar propuesta", instructions con "Atajo de deteccion" + "NO delegues exploracion exhaustiva a @explore"
- Orchestrator template: emite seccion "ROLES vs NATIVOS", lista los 4 vetos, instruye atajo, instruye activar iteration-strategy
- CLAUDE.md template: misma logica replicada
- Pipeline: skill llega a archivos de agente generados, SKILL.md en .opencode/skills/
- Bidireccional sync: `used_by` <-> `role.skills` consistente

535 tests totales en la suite (era 517).

## Coordinacion con guard rails existentes

- **`role-boundaries`** define QUE rol del proyecto es responsable de cada actividad. `delegation-discipline` define CUANDO usar rol del proyecto vs nativo.
- **`iteration-strategy`** se activa antes de delegar; `delegation-discipline` se aplica a cada delegacion individual.
- **`existing-docs-update-protocol`** lo cargan los sub-agents del proyecto. `delegation-discipline` garantiza que esos sub-agents reciben las Tasks (no `@general`).
- **`anti-mock-review`** revisa entregables de codigo. Solo aplica si el codigo lo escribio un rol del proyecto. `delegation-discipline` lo asegura.

## Ver tambien

- `data/skills/delegation-discipline.yaml` — definicion completa
- `data/skills/iteration-strategy.yaml` — refuerzo con atajo manifest
- `templates/{opencode,claude}/orchestrator.md.hbs` — seccion nueva ROLES vs NATIVOS
- `tests/integration/delegation-discipline.test.ts` — 18 tests
- `docs/iteration-strategies.md` — la skill complementaria
- `docs/role-boundaries.md` — quien hace que dentro del proyecto
