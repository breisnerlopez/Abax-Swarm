# Abax Swarm

[![npm version](https://img.shields.io/npm/v/abax-swarm.svg?color=crimson)](https://www.npmjs.com/package/abax-swarm)
[![npm downloads](https://img.shields.io/npm/dw/abax-swarm.svg)](https://www.npmjs.com/package/abax-swarm)
[![CI](https://github.com/breisnerlopez/Abax-Swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/breisnerlopez/Abax-Swarm/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-492%20passing-brightgreen)](https://github.com/breisnerlopez/Abax-Swarm/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

> **Genera un equipo coordinado de agentes de IA para llevar un proyecto de software de la idea al despliegue — o para documentar uno existente.**

Abax Swarm es una CLI que produce los archivos que tu cliente de IA (**OpenCode** o **Claude Code**) necesita para activar un equipo de **5 a 18 agentes especializados** trabajando en cascada: Project Manager, Business Analyst, Solution Architect, desarrolladores backend/frontend, DBA, QA, DevOps, y más. El **orquestador** delega cada entregable al rol correcto, exige aprobación de fase antes de avanzar, y bloquea atajos peligrosos con guard rails forjados de incidentes reales.

```bash
npm install -g abax-swarm
abax-swarm init
```

![Pantalla inicial del wizard](docs/screenshots/01-wizard-start.png)

---

## Tabla de contenidos

- [¿Por qué Abax Swarm?](#por-qué-abax-swarm)
- [Empezar en 2 minutos](#empezar-en-2-minutos)
- [Casos de uso comunes](#casos-de-uso-comunes)
- [¿Qué se genera?](#qué-se-genera)
- [El equipo y las fases](#el-equipo-y-las-fases)
- [Personalizar tu equipo](#personalizar-tu-equipo)
- [Guard rails (lo que NO te deja hacer)](#guard-rails-lo-que-no-te-deja-hacer)
- [Para desarrolladores](#para-desarrolladores)
- [Comandos](#comandos)
- [Estado del proyecto](#estado-del-proyecto)
- [Contribuir](#contribuir)
- [Soporte y comunidad](#soporte-y-comunidad)
- [Recursos](#recursos)

---

## ¿Por qué Abax Swarm?

Trabajar con un único agente de IA en proyectos no triviales termina en uno de estos patrones conocidos:

| Patrón problemático | Cómo lo evita Abax Swarm |
|---|---|
| **El agente "implementa" con regex disfrazada de IA** y nadie lo cacha hasta producción (incidente Abax-Memory) | 3 capas anti-mock: regla en developers + skill `anti-mock-review` en tech-lead + entregable `feature-spec-compliance` con BA externo |
| **El mismo rol hace deploy y QA en una Task** y pierde el rigor de cada disciplina | Skill `role-boundaries` en 13 roles + matriz maestra por fase + protocolo 2-Tasks post-fix |
| **El sistema legacy (PHP, VB6, Java Swing) se documenta como si fuera Spring Boot** | Stack `legacy-other` con detectores específicos + prompts cautelosos por rol |
| **Devops commitea a `main` con `--force` o sin rama de feature** | Skill `git-collaboration` obligatoria en roles con `bash`, flujo distribuido por fase |
| **Se llega a fase de despliegue sin haber preguntado dónde se publica, qué dominio, cómo se monitorea** | Bloqueante de `deployment-planning` con 12 preguntas + aprobación explícita del sponsor antes de cualquier acción real |

Cada uno de estos guard rails nació de un incidente concreto y está cubierto por tests integrales que fallan en CI si alguien intenta diluirlos.

### Tres modos de proyecto

| Modo | Cuándo usarlo |
|---|---|
| **`new`** | Implementar algo desde cero. Cascada completa de 10 fases (descubrimiento → cierre). |
| **`document`** | Inventariar un sistema en producción sin docs vivas. Equipo curado de 9 roles + flujo de 5 fases + sitio MkDocs Material listo. |
| **`continue`** | Retomar un proyecto que ya tiene código, git, docs. Detecta automáticamente stack/git/docs y no re-pregunta lo obvio. |

---

## Empezar en 2 minutos

### 1. Instalar

Necesitas **Node.js 20 o superior**. Si no lo tienes: [nodejs.org](https://nodejs.org).

```bash
npm install -g abax-swarm
```

### 2. Ejecutar el asistente

```bash
abax-swarm init
```

Se abre un wizard interactivo. Avanza con Enter, vuelve atrás con `Ctrl+B`. El paso 1 te pide la carpeta destino (por defecto, donde estés ejecutando el comando).

### 3. Responder las preguntas

Sin conocimiento técnico previo. Cada paso explica las opciones; el wizard salta los pasos irrelevantes según el modo elegido.

| Paso | Pregunta | Notas |
|---|---|---|
| 1a | Directorio destino | Por defecto `pwd`. Se crea si no existe. |
| 1b | **Modo de proyecto** | `new` / `document` / `continue` — ver tabla arriba. |
| 2 | Plataforma | OpenCode o Claude Code. |
| 3a | Asignación de modelos | "Personalizado por rol" o "Heredar el default de tu config" (útil si no tienes Opus/GPT-5). |
| 3b | Proveedor IA | (si personalizado) Anthropic o OpenAI. Mix automático: estratégico → opus/gpt-5, implementación → sonnet/mini, mecánico → haiku/nano. |
| 4 | Nombre + descripción | Para que los agentes sepan de qué va el proyecto. |
| 5 | Tamaño + características | Solo modo `new`. Modo `document` tiene equipo curado fijo. |
| 6 | Stack | 14 stacks soportados (incluido `legacy-other` para PHP/Swing/VB6). En `continue` se autodetecta. |
| 7 | Equipo | Revisa, quita o agrega roles. Te avisa si quitas indispensables. |
| 8 | Confirmación | Vista previa con archivos a generar y mix de modelos. Enter genera. |

![Selección del modo de proyecto](docs/screenshots/02-project-mode.png)
![Asistente preguntando por criterios](docs/screenshots/03-criteria-multiselect.png)
![Editor del equipo](docs/screenshots/04-team-editor.png)

### 4. Abrir tu proyecto en el cliente IA

```bash
cd ruta/a/tu-proyecto
opencode --agent orchestrator    # OpenCode
# o
claude                            # Claude Code
```

### 5. Hablar con el orquestador

Te recibirá con la fase de descubrimiento — preguntas sobre épicas, features y prioridades. Tú actúas como **Product Owner**: revisas entregables, apruebas pasos, das contexto. El orquestador delega y los agentes ejecutan.

### Modo dry-run

```bash
abax-swarm init --dry-run    # vista previa sin escribir archivos
```

![Resumen modo dry-run](docs/screenshots/06-dryrun-summary.png)

---

## Casos de uso comunes

Cada uno con flujo paso a paso, errores típicos y comandos exactos:

| Caso | Guía |
|---|---|
| Arrancar un proyecto Next.js nuevo desde cero | [docs/use-cases.md#caso-1-proyecto-nextjs-nuevo](docs/use-cases.md#caso-1-proyecto-nextjs-nuevo) |
| Documentar un monolito PHP / Java Swing / VB6 legacy | [docs/use-cases.md#caso-2-documentar-un-sistema-legacy](docs/use-cases.md#caso-2-documentar-un-sistema-legacy) |
| Retomar un Spring Boot que llevaba meses parado | [docs/use-cases.md#caso-3-retomar-un-proyecto-existente](docs/use-cases.md#caso-3-retomar-un-proyecto-existente) |
| Cambiar el modelo asignado a un rol | [docs/model-mix.md](docs/model-mix.md) |
| Añadir un rol propio (`devops-mobile`, `qa-security`, etc.) | [docs/guides/adding-roles.md](docs/guides/adding-roles.md) |

---

## ¿Qué se genera?

Cuando confirmas, Abax Swarm escribe esta estructura en tu carpeta:

```
tu-proyecto/
├── .opencode/                    (o .claude/, según la plataforma elegida)
│   ├── agents/
│   │   ├── orchestrator.md       ← Coordina a todos (color: rojo crimson)
│   │   ├── project-manager.md    ← Color asignado de paleta determinista por id
│   │   ├── business-analyst.md
│   │   ├── solution-architect.md
│   │   ├── developer-backend.md
│   │   └── …                     (5 a 18 agentes según tamaño)
│   ├── skills/                   ← Conocimientos reutilizables (80 skills disponibles)
│   └── tools/                    ← Herramientas que los agentes pueden ejecutar
├── docs/
│   ├── design-system/
│   │   └── presentacion-template.html   ← HTML autónomo, 3 presets visuales
│   └── entregables/              ← Aquí van los outputs de cada fase
├── opencode.json                 ← Config de la plataforma
└── project-manifest.yaml         ← Metadata reproducible

# Solo en modo "documentar":
├── mkdocs.yml                    ← Listo para `mkdocs serve`
├── requirements.txt              ← `mkdocs-material>=9.5`
└── docs/<fase>/index.md          ← Seeds por las 5 fases del flujo de docs

# Solo si tu carpeta tiene git:
└── .github/workflows/pages.yml   ← Workflow para publicar presentaciones en GitHub Pages
```

### Detalles que mejoran la experiencia

- **Colores en TUI**: orquestador siempre rojo crimson `#dc143c`. Los demás agentes reciben colores vivos de una paleta curada de 24 hex (sin tonos rojos para no confundir). Determinista por `role.id`. Detalle: [docs/agent-colors.md](docs/agent-colors.md).
- **Glosario automático**: si un entregable usa ≥3 acrónimos técnicos (RACI, SLA, BPMN, OWASP), el agente añade una sección `## Glosario` con definiciones cortas.
- **Presentaciones HTML autónomas**: agentes con skill `presentation-design` generan single-file HTML con 3 presets (Corporate Minimal / Tech Editorial / Dark Premium). Sin AI-slop visual.
- **Devcontainer auto-generado**: si elegiste isolación por container, recibes `.devcontainer/devcontainer.json` por stack.

---

## El equipo y las fases

### Roles base (siempre presentes)

Project Manager · Product Owner · Business Analyst · Solution Architect · Tech Lead · Backend Developer · Frontend Developer · QA Lead · QA Funcional · DevOps.

### Roles especializados (se añaden según las características marcadas)

DBA · Security Architect · Integration Architect · QA Automation · QA Performance · UX Designer · Tech Writer · Change Manager.

### Fases del proyecto (cascada)

```
0. Descubrimiento     → épicas, features, historias, backlog
1. Inception          → charter, kickoff, stakeholders
2. Análisis funcional → especificaciones, reglas de negocio
3. Diseño técnico     → arquitectura, modelo de datos, tareas
4. Construcción       → implementación + 3 capas anti-mock
5. QA / Testing       → ejecución, defectos
6. UAT                → aceptación del usuario
7. Despliegue         → 12 preguntas + aprobación sponsor + ejecución
8. Estabilización     → soporte post-producción
9. Cierre             → lecciones aprendidas
```

Cada fase tiene entregables obligatorios y un rol que la aprueba. El orquestador no avanza si la fase actual no está completa.

### Stacks tecnológicos (14 disponibles)

`react-nextjs` · `react-nestjs` · `vue-nuxt` · `angular-springboot` · `angular-quarkus` · `astro-hono` · `python-fastapi` · `python-django` · `dotnet-blazor` · `go-fiber` · `rust-axum` · `flutter-dart` · `react-native-expo` · `legacy-other` (PHP, Java Swing, VB6, Cobol, Delphi, etc.)

Lista completa: `abax-swarm stacks`.

---

## Personalizar tu equipo

Toda la definición de roles, skills, tools, stacks y reglas vive en YAML dentro de `data/`. **No hace falta tocar TypeScript** para añadir un rol propio o cambiar un comportamiento.

### Agregar un rol propio

```bash
git clone https://github.com/breisnerlopez/Abax-Swarm.git
cd Abax-Swarm && npm install
```

1. Crea `data/roles/mi-rol.yaml` (estructura mínima en [docs/guides/adding-roles.md](docs/guides/adding-roles.md)).
2. Decide su clasificación para los **4 guard rails** (sino CI falla):
   - `role-boundaries` — añadir a `used_by` o a `EXEMPT_FROM_ROLE_BOUNDARIES`.
   - `anti-mock` rule — embeber si implementa código de producción.
   - `git-collaboration` — declarar la skill si tiene `bash != "deny"`.
   - `stack_overrides` — completos para los 14 stacks si declaras alguno.
3. Regístralo en `size-matrix.yaml`, `dependency-graph.yaml`, `raci-matrix.yaml`.
4. `npm run validate && npm test` — verifica todo de un golpe.

Detalle exhaustivo en [docs/guides/adding-roles.md](docs/guides/adding-roles.md).

### Otros casos rápidos

| Quiero… | Mira |
|---|---|
| Añadir una skill | [docs/guides/adding-skills.md](docs/guides/adding-skills.md) |
| Añadir un stack | [docs/guides/adding-stacks.md](docs/guides/adding-stacks.md) |
| Cambiar el modelo de un rol | [docs/model-mix.md](docs/model-mix.md) |
| Cambiar el color de un agente | [docs/agent-colors.md](docs/agent-colors.md) |
| Modificar el flujo del orquestador | [docs/guides/orchestrator-flow.md](docs/guides/orchestrator-flow.md) |

---

## Guard rails (lo que NO te deja hacer)

Cinco reglas sistémicas activas, cada una nacida de un incidente concreto y cubierta por tests automatizados que fallan en CI si alguien intenta diluirlas:

| Guard rail | Qué impide | Documentación |
|---|---|---|
| `role-boundaries` | Que un agente ejecute trabajo de otro rol "para acelerar" (devops haciendo QA, qa haciendo deploy) | [docs/role-boundaries.md](docs/role-boundaries.md) |
| Anti-mock 3 capas | Que un developer implemente con regex/InMemory/Mock disfrazado de integración real (incidente Abax-Memory) | [docs/quality-gates.md](docs/quality-gates.md) |
| `git-collaboration` | Que un rol con `bash` haga commits a `main` o sin convención `abax/<project>` + `--author` | [docs/git-collaboration.md](docs/git-collaboration.md) |
| `deployment-planning` | Que se llegue a deploy sin contestar las 12 preguntas (URL, dominio, DNS, monitoring, rollback) y sin aprobación del sponsor | [docs/deployment-planning.md](docs/deployment-planning.md) |
| `code-naming-convention` | Que los agentes mezclen español e inglés en identificadores de código (variables, endpoints, parámetros, env vars, tablas SQL) — todo internal en inglés | [docs/code-naming.md](docs/code-naming.md) |

Más una capa preventiva contra el bug del fallback silencioso a Spring Boot cuando el stack no se reconoce: ver [docs/legacy-stacks.md](docs/legacy-stacks.md).

---

## Para desarrolladores

Esta sección es para quien quiera trabajar en el código de Abax Swarm (no solo en sus datos).

### Arquitectura

Cuatro capas con flujo unidireccional:

```
data/ (YAML)  →  loader/  →  engine/  →  generator/  →  .opencode/ ó .claude/
                  (Zod)     (puro)      (Handlebars)
```

- **Loader**: lee YAML, valida con Zod, devuelve mapas tipados.
- **Engine**: funciones puras (sin I/O). Selecciona roles, resuelve dependencias, deduce skills/tools, adapta al stack, escoge gobernanza.
- **Generator**: dos targets paralelos (OpenCode, Claude Code) que comparten salida del engine pero producen estructuras de archivo distintas.
- **Validator**: chequeos post-generación (referencias del orquestador, completitud RACI).

Documentación detallada: [docs/architecture.md](docs/architecture.md) y [docs/data-model.md](docs/data-model.md).

### Comandos de desarrollo

```bash
npm install                       # instalar dependencias
npm test                          # 492 tests (Vitest)
npm run test:watch                # modo watch
npm run typecheck                 # tsc --noEmit
npm run lint                      # ESLint sobre src/ y tests/
npm run validate                  # validar todos los YAML de data/
npm run dev -- init               # ejecutar el wizard en modo dev (sin build)
npm run build                     # compilar TypeScript a dist/
```

### Estructura del repo

```
src/
├── cli/         ← TUI Ink (WizardApp.tsx) + comandos
├── engine/      ← Selección, dependencias, adaptación al stack
├── generator/   ← Generadores OpenCode y Claude
├── loader/      ← Carga + validación Zod de YAML
└── validator/   ← Validación post-generación

data/            ← Datos canónicos (YAML, fuente de verdad)
├── roles/       ← 20 roles
├── skills/      ← 76 habilidades
├── tools/       ← 7 herramientas
├── stacks/      ← 14 stacks (incluye legacy-other)
└── rules/       ← Matrices (size, RACI, dependencies, criteria, document-mode)

templates/       ← Plantillas Handlebars (.md.hbs) + design-system/
tests/           ← Vitest, unit + integración (492 tests)
docs/            ← Documentación detallada
```

### Workflow de Git

GitHub Flow simple:

- Trunk: `main`. Es la rama que se publica.
- Trabajo en ramas cortas con prefijo: `feature/`, `bugfix/`, `hotfix/`, `docs/`, `chore/`.
- Squash merge a `main` vía PR. CI corre `validate` + auto-label como required checks.
- Releases: tag `vX.Y.Z` sobre `main` dispara `release.yml` → npm publish + GitHub Release con tarball.

Más detalle en [CONTRIBUTING.md](CONTRIBUTING.md) y [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

---

## Comandos

```bash
abax-swarm init                              # asistente interactivo
abax-swarm init --dry-run                    # vista previa sin escribir
abax-swarm roles                             # listar roles disponibles
abax-swarm stacks                            # listar stacks
abax-swarm validate                          # validar los YAML de data/
abax-swarm regenerate --dir /ruta/proyecto   # regenerar desde un manifest existente
```

---

## Estado del proyecto

- **Versión actual**: ver [package.json](package.json) o [CHANGELOG.md](CHANGELOG.md).
- **Estabilidad**: pre-1.0. La API y el formato de datos pueden cambiar entre patches sin aviso. A partir de `1.0.0` seguiremos SemVer estricto.
- **Tests**: 492 pasando, cobertura >90% en engine/generator. CI verde como prerrequisito para merge.
- **Hoja de ruta**: tipos de proyecto futuros (audit, migration, onboarding, infra, data, ml) priorizados por demanda en [docs/roadmap.md](docs/roadmap.md).

---

## Contribuir

¡Bienvenidas todas las contribuciones! La guía completa vive en [CONTRIBUTING.md](CONTRIBUTING.md) e incluye:

- Quickstart para tu primer PR (clona, instala, corre tests, abre PR).
- Tipos de cambio admitidos y prefijos de rama (`feature/`, `bugfix/`, `docs/`, `chore/`, `hotfix/`).
- Los 4 guard rails que un cambio debe satisfacer para que CI esté verde.
- Cómo actualizar la documentación según el tipo de cambio.
- Cómo regenerar las capturas del wizard de forma headless.
- Flujo de release y publicación a npm.

Antes de un PR grande, abre un [discussion](https://github.com/breisnerlopez/Abax-Swarm/discussions) para confirmar la dirección.

---

## Soporte y comunidad

- **Bugs y feature requests**: [Issues](https://github.com/breisnerlopez/Abax-Swarm/issues).
- **Preguntas y propuestas**: [Discussions](https://github.com/breisnerlopez/Abax-Swarm/discussions).
- **Seguridad**: si encuentras una vulnerabilidad, NO abras un issue público — escribe a `breisner.lopez@gmail.com`.

### FAQ rápido

**¿Necesito Opus o GPT-5 para usarlo?**
No. El paso 3 del wizard te ofrece "Heredar el default de mi configuración" — los agentes generados no llevan `model:` y tu cliente IA usa el modelo que tengas configurado globalmente.

**¿Funciona offline?**
La generación de archivos sí (no hace llamadas a LLMs). Lo que requiere LLM es lo que pase _después_, cuando abras tu cliente IA con los archivos generados.

**¿Puedo usarlo en un repo privado de empresa?**
Sí. Los archivos generados son tuyos. Lo que se publica a npm es la CLI, no nada del proyecto cliente.

**Mi stack no está en los 14 soportados (Cobol, Delphi, ASP clásico…). ¿Qué hago?**
Usa el stack `legacy-other` — los agentes reciben prompts cautelosos que les ordenan inferir convenciones del código en lugar de asumir patrones modernos. Detalle en [docs/legacy-stacks.md](docs/legacy-stacks.md).

**¿Por qué cascada y no agile/scrum?**
Por trazabilidad y RACI explícita en proyectos corporativos. Si quieres adaptar a sprints, edita `data/rules/raci-matrix.yaml` y `data/rules/document-mode.yaml`.

---

## Recursos

| Documento | Para qué |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Capas del sistema, flujo de datos, detectores y modos |
| [docs/data-model.md](docs/data-model.md) | Esquemas YAML de cada entidad |
| [docs/use-cases.md](docs/use-cases.md) | 3 casos paso a paso (Next.js, legacy PHP/VB6, Spring Boot retomado) |
| [docs/model-mix.md](docs/model-mix.md) | Mix de modelos por rol con justificación |
| [docs/agent-colors.md](docs/agent-colors.md) | Política de colores y paleta para agentes |
| [docs/quality-gates.md](docs/quality-gates.md) | 3 capas anti-mock |
| [docs/role-boundaries.md](docs/role-boundaries.md) | Matriz maestra de roles + protocolo 2-Tasks post-fix |
| [docs/code-naming.md](docs/code-naming.md) | Regla "internals en inglés" + guard rail que escanea YAMLs |
| [docs/legacy-stacks.md](docs/legacy-stacks.md) | Stack `legacy-other` para PHP/Swing/VB6/Cobol/Delphi |
| [docs/git-collaboration.md](docs/git-collaboration.md) | Flujo distribuido de version control |
| [docs/deployment-planning.md](docs/deployment-planning.md) | Bloqueante de fase 7 con 12 preguntas |
| [docs/permissions.md](docs/permissions.md) | 3 modos de permisos OpenCode (strict/recommended/full) |
| [docs/guides/adding-roles.md](docs/guides/adding-roles.md) | Cómo agregar un rol |
| [docs/guides/adding-skills.md](docs/guides/adding-skills.md) | Cómo agregar una habilidad |
| [docs/guides/adding-stacks.md](docs/guides/adding-stacks.md) | Cómo agregar un stack |
| [docs/guides/orchestrator-flow.md](docs/guides/orchestrator-flow.md) | Cómo opera el orquestador |
| [docs/guides/dev-environments.md](docs/guides/dev-environments.md) | Devcontainer vs host |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Resumen del sistema, convenciones, workflow Git |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios por release |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guía completa para contribuir |

---

## Requisitos

- Node.js >= 20
- npm

## Licencia

MIT — ver [LICENSE](LICENSE).
