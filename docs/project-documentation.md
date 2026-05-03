# Documentación que generan los agentes en proyectos cliente

## Por qué este sistema existe

Hasta 0.1.23, los agentes Abax sabían producir documentación técnica (skill `technical-documentation`), guías de usuario (`user-guides`) y runbooks operativos (`runbook-creation`), pero **no había guía sistemática sobre el README.md ni sobre la estructura general de la carpeta `docs/`** del proyecto cliente. Cada agente improvisaba.

Resultado típico: README de 30 líneas sin quickstart imposible de evaluar sin clonar; o README de 2000 líneas que nadie lee; o `docs/` plana con 30 archivos sin agrupar; o "TODO: completar esto" sin owner ni fecha que envejece para siempre.

A partir de 0.1.24, los agentes que producen documentación cargan tres skills coordinadas + un guard rail compartido.

## Las 3 skills nuevas

| Skill | Qué define | Roles que la cargan |
|---|---|---|
| **`project-readme`** | Cómo generar el `README.md` del proyecto cliente: 4 preguntas fundamentales, 18 secciones estándar, 10 reglas no-negociables, adaptación por modo (`new`/`document`/`continue`) y por stack tecnológico (incluyendo `legacy-other`). 4 plantillas listas. | tech-writer, developer-backend, developer-frontend, tech-lead |
| **`documentation-quality-bar`** | Los 8 mínimos no-negociables que TODO documento debe cumplir antes de marcarse como completado: frontmatter de procedencia, comandos validados, sin TODO sin asignar, links que funcionan, bloques etiquetados, glosario si hay jerga, índice si supera 200 líneas, idioma consistente. Checklist obligatorio. | 9 roles que producen documentación |
| **`project-documentation-structure`** | Estructura estándar de `docs/`: subcarpetas (`architecture`, `api`, `runbooks`, `user-guides`, `functional`, `deliverables`, `decisions`, `presentations`), índices intermedios, convenciones de naming, alineación con MkDocs nav. Adaptación por modo. | tech-writer, tech-lead, solution-architect, business-analyst, devops |

## El README.md que producen los agentes

### Las 4 preguntas que debe responder en los primeros 30 segundos

1. **¿Qué es esto?** (1-2 frases)
2. **¿Por qué importa / qué problema resuelve?** (1 párrafo)
3. **¿Cómo pruebo que funciona en menos de 2 minutos?** (3-5 comandos)
4. **¿Dónde aprendo más si me interesa?** (links a `docs/`)

Si el lector no obtiene esas 4 respuestas en los primeros 30 segundos, el README ha fallado independientemente de su longitud o belleza.

### Estructura estándar (18 secciones)

Orden importa. No saltarse las obligatorias:

| Sección | Obligatoria | Notas |
|---|---|---|
| Título + tagline 1-línea | sí | Como blockquote o subtítulo |
| Badges (versión, licencia, CI, tests) | si el repo es público | shields.io |
| TL;DR + 3 comandos quickstart | sí | Enable copy-paste |
| Screenshot/GIF demo | recomendada | Una imagen vale más |
| Tabla de contenidos | si > 200 líneas | Markdown anchors |
| Por qué / casos de uso | recomendada | Discoverability |
| Instalación | sí | Versiones explícitas |
| Uso (ejemplos ejecutables) | sí | Lo más importante |
| Configuración (.env, secrets) | si aplica | Nunca commitear secrets |
| Estructura del proyecto | recomendada | Tree con explicación breve |
| Desarrollo local | si es código | Comandos exactos |
| Despliegue / CI/CD | recomendada | Link a runbook |
| Tests + coverage | recomendada | Cómo correrlos + cobertura actual |
| Contribuir | si es público | Link a CONTRIBUTING.md |
| Roadmap / estado | recomendada | Beta, estable, mantenido |
| FAQ / Troubleshooting | recomendada | Preguntas reales |
| Licencia | sí | Una línea + link |
| Agradecimientos | opcional | Honesto, no inflar |

### Adaptación por modo

| Modo | Diferencias en el README |
|---|---|
| **`new`** | README como artefacto vivo. Marca features incompletos con `[WIP]`. Quickstart funciona contra BD limpia. |
| **`document`** | Documenta lo que el sistema ES, no lo que el equipo PLANEA. Quickstart describe cómo CORRER el sistema existente. Recomendaciones de modernización van en `docs/recommendations.md` separado. |
| **`continue`** | PRESERVA estructura existente. Actualiza comandos rotos validándolos primero. Agrega sección "Notas de retoma `<fecha>`" con el estado en que se encontró. |

### Adaptación por stack

Cada stack tiene convenciones propias del ecosistema. La skill `project-readme` lista los comandos quickstart típicos para cada uno de los 14 stacks soportados:

- React/Next.js, Vue/Nuxt, Astro/Hono → `pnpm install && pnpm dev`
- React/NestJS → `pnpm install && pnpm start:dev`
- Python/FastAPI, Python/Django → `python -m venv && pip install && uvicorn`/`manage.py runserver`
- Angular/Spring Boot, Angular/Quarkus → `mvn spring-boot:run` o `mvn quarkus:dev`
- .NET Blazor → `dotnet restore && dotnet run`
- Go/Fiber → `go mod download && go run .`
- Rust/Axum → `cargo run`
- Flutter/Dart → `flutter pub get && flutter run`
- React Native/Expo → `pnpm install && pnpm start`
- **`legacy-other`** (PHP/Swing/VB6/Cobol/Delphi) → comando real del sistema (puede ser ejecutar `.exe`, abrir IDE). NO inventar `npm install` en VB6.

## La estructura `docs/` estándar

```
proyecto-cliente/
├── README.md                   ← Índice navegable + quickstart
├── CHANGELOG.md
├── CONTRIBUTING.md             ← Si es público o multi-team
├── LICENSE
└── docs/
    ├── README.md               ← Índice de docs/ con tabla
    ├── architecture/
    │   ├── overview.md         ← C4 nivel 1
    │   ├── components.md       ← C4 nivel 2-3
    │   ├── data-model.md
    │   ├── integrations.md
    │   └── adrs/               ← ADRs numerados (NNNN-verbo-sustantivo.md)
    ├── api/
    ├── runbooks/
    ├── user-guides/
    ├── functional/             ← Spec funcional (BA)
    ├── deliverables/           ← Por fase (modo new)
    ├── decisions/              ← Non-architectural
    ├── glossary.md             ← Términos del dominio
    ├── presentations/          ← HTML autónomos
    └── design-system/
        └── presentacion-template.html
```

### Reglas de organización

- **Naming**: kebab-case. Sin tildes (compatibilidad cross-OS). ADRs numerados con padding 4-dígitos.
- **Índices**: cada subcarpeta con ≥3 archivos tiene `README.md` listando con descripción de 1 línea.
- **Frontmatter**: todos los `.md` (excepto README de carpeta) llevan procedencia.
- **Links**: relativos dentro de docs, absolutos a sistemas externos con marca.

### Por modo

| Modo | Cambios en `docs/` |
|---|---|
| **`new`** | Estructura completa generada al inicio de fase 4 con README placeholder. Se llena conforme avanzan los entregables. |
| **`document`** | Solo carpetas relevantes al inventario. NO `deliverables/` ni `decisions/`. Recomendaciones en archivo separado. Sitio MkDocs Material listo. |
| **`continue`** | Preservar lo existente. Si está fragmentado: `docs/migration-plan.md` propone mapping. Migrar incrementalmente con `git mv`. |

## Los 8 mínimos no-negociables (`documentation-quality-bar`)

Si alguno falla, el documento NO se marca completado. Reportar al orquestador con la lista de gaps.

1. **Frontmatter de procedencia** (`fase`, `entregable`, `responsable`, `aprobado-por`, `fecha`, `estado`).
2. **Cada comando ejecutado, no inventado**. Comandos contra ambientes inaccesibles llevan marca `# NOT VALIDATED — <razón>`.
3. **Sin `TODO`/`TBD`/placeholder sin marcar**. Lo pendiente lleva owner + fecha esperada.
4. **Links relativos validados** apuntan a archivos existentes en el commit.
5. **Bloques de código etiquetados** con el lenguaje (` ```bash `, ` ```ts `, ` ```yaml `).
6. **Glosario al cierre** si usa ≥3 acrónimos (API, REST, RACI, BPMN, OWASP, etc.).
7. **Índice si supera 200 líneas**.
8. **Idioma consistente** (no mezclar inglés/español).

Checklist obligatorio antes de marcar completado, integrado al flujo del orquestador.

## Entregables nuevos en fase 4 (Construcción)

Dos entregables mandatorios añadidos a `data/rules/phase-deliverables.yaml`:

| Entregable | Responsable | Approver | Path |
|---|---|---|---|
| `project-readme` | tech-writer | tech-lead | `README.md` (raíz del proyecto cliente) |
| `docs-structure-skeleton` | tech-writer | tech-lead | `docs/{architecture,api,runbooks,...}/README.md` |

Si no hay tech-writer en el equipo (proyectos `small`), el responsable pasa al **tech-lead** y el approver al **solution-architect**.

## Cómo se coordina con guard rails existentes

- **`role-boundaries`** decide quién es approver final (tech-writer en proyectos con él, tech-lead si no).
- **`anti-mock-review`** del tech-lead audita que los entregables `source-code` no contengan mocks; el README debe reflejar lo real, no lo aspiracional.
- **`feature-spec-compliance`** del BA valida feature por feature contra spec; el README debe describir solo features REALES.

## Tests integrales

`tests/integration/project-documentation.test.ts` cubre:

- Skill `project-readme`: existencia, 4 preguntas fundamentales, 18 secciones estándar, 10 reglas, adaptación por modo, guidance para `legacy-other`, 4 plantillas como guides, wiring a 4 roles.
- Skill `documentation-quality-bar`: 8 mínimos enumerados, checklist pre-completion, conexión con role-boundaries, wiring a 9 roles, 3 guides (validación de comandos, frontmatter, detección de gaps).
- Skill `project-documentation-structure`: árbol estándar con 6+ subcarpetas, naming + indexing, adaptación por modo, MkDocs nav alignment, 2 guides (skeleton script, ADR format), wiring a 5 roles.
- `phase-deliverables`: `project-readme` y `docs-structure-skeleton` mandatorios en fase 4, responsable tech-writer, approver tech-lead.
- Pipeline: las 3 skills propagan a archivos de agente generados, los archivos `SKILL.md` se crean en `.opencode/skills/<id>/`.
- Modo document + `legacy-other`: las skills siguen llegando al tech-writer del equipo curado.
- Guard rail: bidireccional sync entre `used_by` y `role.skills` para las 3 skills.

30 tests nuevos, 476 totales en la suite.

## Cómo añadir mejoras a futuro

- Si necesitas otra plantilla de README (ej. monorepo, microservicio individual), añade un guide a la skill `project-readme`.
- Si surge una convención nueva de docs (ej. C4-PlantUML embebido, OpenAPI 3.2), actualiza `project-documentation-structure`.
- Si el guard de calidad detecta un nuevo anti-pattern (ej. links absolutos a Confluence privado), añádelo a `documentation-quality-bar`.

NO hace falta tocar el código TypeScript: las 3 skills viven en `data/skills/*.yaml` y los entregables en `data/rules/phase-deliverables.yaml`.

## Ver también

- `docs/quality-gates.md` — 3 capas anti-mock (la calidad del README también puede verse comprometida por inventar comandos)
- `docs/role-boundaries.md` — Quién aprueba qué documento
- `docs/legacy-stacks.md` — Cuidados especiales para README de sistemas legacy
- `data/skills/project-readme.yaml`, `documentation-quality-bar.yaml`, `project-documentation-structure.yaml`
- `tests/integration/project-documentation.test.ts`
