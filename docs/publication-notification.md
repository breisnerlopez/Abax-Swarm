# Notificacion de URLs publicas + ajuste post-rename + auditoria de tools (0.1.33)

Release que ataca seis hallazgos pendientes detectados durante el incidente Abax-Memory v2 (2026-05-03):

## 1. Skill `publication-notification` (nueva)

Asignada a 6 roles (tech-writer, business-analyst, devops, project-manager, product-owner, solution-architect).

Cuando un entregable HTML se completa, el rol responsable construye la URL publica esperada (`https://<owner>.github.io/<repo>/<path>`) y la reporta al orquestador. El orquestador la incluye en su mensaje al usuario al cerrar la Task.

Resuelve el sintoma del incidente original: el BA produjo `presentacion-descubrimiento.html` v2, GitHub Pages la sirvio correctamente (HTTP 200), pero ningun rol notifico la URL al sponsor.

## 2. Extension de `iteration-strategy` — actualizar `docs/index.html` post-rename

Cuando aplica la estrategia A (folder por release) y el devops mueve `docs/entregables/fase-X/` -> `docs/entregables/v1/fase-X/`, **TODAS las referencias en `docs/index.html` quedan rotas** (apuntan a las rutas viejas).

La skill ahora obliga al orquestador a delegar al `@devops` (o `@tech-writer`) una tarea inmediata posterior al rename:

1. Reescribir prefijos: `entregables/fase-X/` -> `entregables/v1/fase-X/`
2. Agregar seccion nueva "v2.0.0 — En curso" con enlaces a entregables de v2
3. Preservar el design system existente del index (CSS, layout, branding)
4. Reportar URL del index actualizado via `publication-notification`

Previene que el sitio publico quede con 16 links rotos como en el incidente.

## 3. Entregable obligatorio "Reporte URLs publicas" al cierre de fase

Anadido al orchestrator template (opencode + claude). Cuando se cierra fase con HTMLs producidos, el ULTIMO entregable obligatorio es:

```
Path: docs/entregables/<fase>/urls-publicas.md
Responsable: project-manager (o tech-writer)
Skill: publication-notification
Approver: gate approver de la fase
```

Tabla con TODOS los HTMLs publicados en esa fase + URLs + status. El orquestador la incluye en el mensaje al usuario al cerrar fase. Si la fase no produjo HTMLs, se omite.

## 4. Auditoria de los 7 tools — runtime defaults para args opcionales

El plugin `@opencode-ai/plugin` define `tool.schema.string().default("X")` pero **no aplica el default en runtime** cuando el LLM omite el arg. Esto causo el incidente create-presentation 0.1.32. Aplicado el mismo patron defensivo a los 7 tools del catalogo:

| Tool | Args con default schema sin runtime fallback (antes) | Status |
|---|---|---|
| `create-presentation` | presentation_type, audience | Fixed en 0.1.32 |
| `create-document` | doc_type | Fixed |
| `create-dashboard` | dashboard_type | Fixed (+ project_name + data) |
| `generate-diagram` | (description sin default — el escape ya defensivo) | Fixed (description default) |
| `db-migrate` | action, name | Fixed |
| `lint-code` | path, fix | Fixed (path) |
| `run-tests` | test_type, path | Fixed |

Patron uniforme:

```ts
const x = args.x || "<default>";
```

antes de cualquier uso del arg en el body.

**Test guard nuevo** `tests/integration/tool-runtime-defaults.test.ts`: escanea cada tool con `default:` en su schema y exige que tenga runtime fallback (acepta `||`, `??`, `includes(args.x) ?`, `has(args.x) ?`, ternario boolean defensivo). Falla CI si un nuevo tool olvida el patron.

## 5. Pages: documentar modo Actions vs legacy

`pages-generator.ts` ahora incluye comentarios extensos en el `pages.yml` generado explicando:
- Modo "GitHub Actions" (workflow corre, soporta MkDocs si existe `mkdocs.yml`)
- Modo "legacy" (source: branch — bypassea el workflow)
- Como verificar el modo actual con `gh api`
- Como activar Actions con UI o `gh api -X PUT ... -f build_type=workflow`
- Plantilla `mkdocs.yml` minima para que `.md` se rendericen como HTML aun en modo `new` (sin requerir modo `document`)

Tambien `docs/presentation-publishing.md` extendido con seccion "Activacion de GitHub Pages — modo Actions vs legacy".

## 6. Tests integrales

- `publication-notification` skill content + wiring a 6 roles + 3 guides
- `iteration-strategy` reforzado con tarea de actualizar index.html
- Orchestrator template con seccion "Reporte URLs publicas"
- Tool runtime defaults guard (escanea los 7 tools)

Suite total: **558 tests pasando** (era 549), typecheck + validate OK, **84 skills** (era 83).

## Aplicacion al proyecto cliente

Para activar todo en un proyecto existente:

```bash
cd <proyecto>
abax-swarm regenerate
```

Trae:
- Skills nuevas/refresacadas en `.opencode/skills/`
- Agentes con las skills wired
- Orchestrator template con sección nueva de URLs publicas
- 7 tools regenerados con defensive defaults

**Nota sobre presentaciones existentes**: `regenerate` NO regenera artefactos del orquestador del proyecto cliente (ej. `docs/entregables/v2/.../presentacion-descubrimiento.html`). Para actualizar presentaciones HTML existentes, abrir sesion OpenCode y pedir al BA o tech-writer "regenerar la presentacion X usando el tool create-presentation actualizado".

## Ver tambien

- `data/skills/publication-notification.yaml` — definicion completa
- `data/skills/iteration-strategy.yaml` — extension post-rename
- `data/tools/*.yaml` — los 7 tools con runtime defaults
- `tests/integration/publication-notification.test.ts` — tests de la skill
- `tests/integration/tool-runtime-defaults.test.ts` — guard rail
- `docs/presentation-publishing.md` — modo Actions vs legacy
