# Manejo de iteraciones y documentos preexistentes

## El incidente que motivo este sistema

En la sesion `ses_21170157cffe...` (2026-05-03), el usuario pidio al orquestador procesar la `PROPUESTA-ABAX-MEMORY-GENERICO.md` como **v2.0.0** del proyecto Abax-Memory, indicando explicitamente "basarnos en v1, no escribir todo de cero".

El orquestador, sin estrategia de iteracion definida, delego al business-analyst tareas tipo "Elabora el Documento de Vision del Producto v2.0.0" sin instruccion explicita de preservar el archivo v1 existente. El BA ejecuto `write` sobre la misma ruta, **sobreescribiendo silenciosamente 8 entregables de v1** en cuestion de minutos:

- `vision-producto.md`, `epicas-features.md`, `historias-usuario.md`, `backlog-priorizado.md`, `presentacion-descubrimiento.html` (Fase 0)
- `acta-de-constitucion.md`, `registro-interesados.md` (Fase 1)
- `presentacion-template.html` (design system)

Solo se rescato porque los cambios no estaban commiteados todavia. Si hubiera ocurrido tras un commit, las versiones v1 se habrian perdido permanentemente.

## Causa raiz

Tres problemas estructurales coexistiendo:

1. **Protocolo pasivo**: el "Protocolo de actualizacion de documentacion existente" del orchestrator template SI mencionaba "no reescribir desde cero", pero esa instruccion **vivia solo en el prompt del orquestador**. No se reinyectaba en el prompt de cada Task delegada — el subagent BA en su sesion hija nunca lo leia.

2. **Sin skill anti-overwrite en sub-agents**: ningun rol cargaba una skill que le ordenara validar la preexistencia de un archivo antes de `write`. Era responsabilidad del orquestador "decirle bien".

3. **Sin politica explicita de iteracion**: cuando un proyecto cerrado (v1) recibe nueva iteracion mayor (v2), no habia procedimiento para decidir CON EL USUARIO como manejar los docs preexistentes.

## La respuesta: 3 capas coordinadas (0.1.26)

### Capa 1 — Rescate inmediato del v1 dañado

Aplicado al proyecto Abax-Memory el 2026-05-03 12:13:

```bash
# Drafts v2 preservados antes de restaurar (no perder trabajo del BA)
cp <archivos modificados> docs/.archive/v2-draft-2026-05-03/

# Restaurar v1 desde HEAD (los overwrites no estaban commiteados)
git checkout HEAD -- docs/entregables/fase-0-descubrimiento/ \
                     docs/entregables/fase-1-inicio/ \
                     docs/design-system/

# Documentar incidente y decision pendiente en docs/iteration-log.md
```

### Capa 2 — Skill `existing-docs-update-protocol` + orquestador ACTIVO

**Skill nueva** asignada a 15 roles (todos los que escriben docs). Le da al sub-agent el procedimiento exacto antes de cualquier `write`:

1. Verificar si el archivo existe (`test -f`).
2. Si NO existe → escribir normal con frontmatter de procedencia.
3. Si EXISTE → **escalar al orquestador** con plantilla "DOCUMENTO PREEXISTE" y esperar estrategia A/B/C/D.

Las 4 estrategias documentadas:

| Estrategia | Cuando aplica | Como se ve |
|---|---|---|
| A | Actualizar en sitio aditivo | Bloque `## Cambios v<X> <fecha>` al final |
| B | Actualizar con correcciones | Marca antiguo como `~~tachado~~` + agrega nuevo |
| C | Iteracion mayor con preservacion | Archivo paralelo (`vision-producto.v2.md`) o folder por release |
| D | Reescritura intencional | Mover v1 a `docs/.archive/v1/` y empezar limpio |

**Orchestrator template reforzado**: cuando `existingDocs === true`, el bloque ahora:
- Cita el incidente Abax-Memory v2 por nombre y fecha como motivacion.
- Da una **plantilla LITERAL** que el orquestador debe inyectar en CADA Task delegado a docs preexistentes (con bloque `ATENCION — POSIBLE ARCHIVO PREEXISTENTE`).
- Explica las 2 capas independientes (orquestador + sub-agent) como cinturones de seguridad.

### Capa 3 — Skill `iteration-strategy` (politica antes de delegar)

**Skill nueva** asignada a 6 roles coordinadores (PM, PO, BA, tech-writer, sol-arch, tech-lead). Cuando el orquestador detecta:

- Proyecto con historia previa (`docs/bitacora.md`, `CHANGELOG.md` con releases, fase de cierre completa)
- + Solicitud actual implica trabajo NUEVO de alcance significativo

esta skill se activa **bloqueante**: el orquestador DEBE preguntar al usuario antes de delegar el primer entregable de la nueva iteracion:

> **Iteracion mayor detectada sobre proyecto con historia**
>
> El proyecto `<X>` tiene `<N>` entregables completos de `<version-anterior>`. La solicitud implica nueva iteracion (`<version-nueva>`). Antes de delegar el primer entregable, confirma estrategia:
>
> - **A** Folder por release (`docs/entregables/v2/...` paralelo a `v1/`)
> - **B** Bloque `## Cambios v2` al final de archivos afectados
> - **C** Archivar v1 a `docs/.archive/v1/` y reescribir limpio
> - **D** Branch git `release/v2`, no tocar `main` hasta merge
>
> ¿Cual aplico para esta iteracion?

Decision documentada en `docs/iteration-log.md`. **Aplicada consistentemente** a TODOS los entregables de la iteracion (no mezclar A para uno y C para otro).

## Estructura estandar segun estrategia

### Folder por release (recomendado para v2 con cambio de alcance)

```
docs/
  entregables/
    v1/
      fase-0-descubrimiento/
        vision-producto.md
        ...
    v2/
      fase-0-descubrimiento/
        vision-producto.md
        ...
  release-mapping.md      <- relacion v1 <-> v2
  iteration-log.md        <- bitacora de decisiones
```

### Bloque de cambios (recomendado para refinamiento incremental)

```yaml
---
fase: 0-descubrimiento
entregable: vision-producto
iteraciones:
  - version: 1.0.0
    fecha: 2026-05-01
  - version: 2.0.0
    fecha: 2026-05-03
    cambios: ver bloque "## Cambios v2.0.0"
---

<contenido v1 INTACTO>

---

## Cambios v2.0.0 — 2026-05-03

### Que cambia
- ...

### Que se mantiene de v1
- ...
```

## Cobertura de tests integrales

`tests/integration/anti-overwrite.test.ts`:

- Skill `existing-docs-update-protocol`: existencia, prohibicion de write silencioso, 4 estrategias enumeradas, anti-patrones, wiring a 15 roles, 3 guides.
- Skill `iteration-strategy`: detection de iteracion mayor, las 4 estrategias, requerimiento de PREGUNTAR al usuario, `iteration-log.md` obligatorio, prohibicion de mezclar estrategias, wiring a 6 roles.
- Orchestrator template: cuando `existingDocs=true` emite plantilla literal del bloque `ATENCION`, cita el incidente, explica capas A y B, instruye uso de iteration-strategy. Cuando `existingDocs=false` NO emite la seccion.
- Claude template: misma logica replicada.
- Pipeline: ambas skills propagan a archivos de agente generados, archivos `SKILL.md` se crean en `.opencode/skills/<id>/`.
- Bidireccional sync: `used_by` <-> `role.skills` consistente.

515 tests totales en la suite (era 492).

## Como aplicar a un proyecto existente

Para activar las dos skills nuevas en un proyecto generado en versiones previas, regenerar:

```bash
abax-swarm regenerate --dir /ruta/proyecto
```

Las skills se generan automaticamente en `.opencode/skills/existing-docs-update-protocol/` e `iteration-strategy/`, y los agentes las cargan al iniciar Tasks.

## Ver tambien

- `data/skills/existing-docs-update-protocol.yaml` — Procedimiento del sub-agent
- `data/skills/iteration-strategy.yaml` — Politica del orquestador
- `templates/{opencode,claude}/orchestrator.md.hbs` — Bloque `existingDocs` reforzado
- `tests/integration/anti-overwrite.test.ts` — 23 tests cubriendo las 3 capas
- `docs/role-boundaries.md` — el approver del entregable de la nueva iteracion debe ser el mismo que aprobo v1 (continuidad)
- `docs/quality-gates.md` — anti-mock-review tambien aplica a docs (no inventar contenido)
