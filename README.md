# Abax Swarm

**Genera un equipo de agentes de IA listo para llevar tu proyecto de software de la idea al despliegue.**

Abax Swarm te crea un equipo coordinado de agentes especializados — un Project Manager, un Business Analyst, un Solution Architect, desarrolladores, QA y más — que trabajan juntos siguiendo una metodología en cascada. Tú describes tu proyecto en un asistente interactivo (siete preguntas), y la herramienta produce los archivos que tu cliente de IA (OpenCode o Claude Code) necesita para poner a ese equipo a trabajar.

---

## ¿Esta guía es para mí?

Hay tres caminos en este README según qué quieras hacer. **No tienes que leerlo todo.**

| Si lo que quieres es… | Ve a |
|---|---|
| Usarlo rápido sin saber programación | [Empezar en 2 minutos](#empezar-en-2-minutos) |
| Personalizar el equipo: agregar tu propio rol, otro stack, etc. | [Personalizar tu equipo](#personalizar-tu-equipo) |
| Contribuir al código del propio Abax Swarm | [Para desarrolladores](#para-desarrolladores) |

---

## Empezar en 2 minutos

### 1. Instalar

Necesitas Node.js 20 o superior. Si no lo tienes, instálalo desde [nodejs.org](https://nodejs.org).

```bash
npm install -g abax-swarm
```

### 2. Ejecutar el asistente

```bash
abax-swarm init
```

Aparece un wizard en tu terminal con barra de progreso, resumen lateral y la posibilidad de volver atrás con `Ctrl+B`.

![Pantalla inicial del wizard](docs/screenshots/01-wizard-start.png)

### 3. Responder las 7 preguntas

No hace falta conocimiento técnico para responder. Cada paso te explica las opciones.

| Paso | Qué te pregunta | Cómo responder |
|---|---|---|
| 1. Directorio | ¿Dónde quieres tu proyecto? | Una ruta de carpeta. Si no existe, se crea. |
| 2. Plataforma | ¿OpenCode o Claude Code? | Lo que uses tú habitualmente. |
| 3. Proveedor de IA | ¿Anthropic (Claude) u OpenAI (GPT)? | El asistente eligirá automáticamente un mix de modelos del mismo proveedor según la complejidad de cada rol (estratégico → opus / gpt-5, implementación → sonnet / mini, mecánico → haiku / nano). |
| 4. Información | Nombre y descripción breve. | Para que los agentes sepan de qué va el proyecto. |
| 5. Tamaño | ¿Pequeño, mediano o grande? | Pequeño = 3-6 personas, < 6 meses. Mediano = 7-15 / 6-12 meses. Grande = 15+ personas. |
| 5b. Características | ¿El proyecto tiene datos sensibles? ¿integraciones? ¿móvil? | Marca con `Espacio` lo que aplique. Esto añade roles especialistas (security, integrations, mobile, etc). |
| 6. Stack | ¿Qué tecnología usarán? | React, Angular, Python, .NET y 9 más. Si no estás seguro, pregunta a tu equipo técnico. |
| 7. Equipo | Revisa el equipo propuesto. | Puedes quitar o agregar roles. El asistente te avisa si quitas uno indispensable. |
| 8. Confirmación | Última vista previa con mix de modelos sugerido. | Pulsa Enter para generar los archivos. |

![Asistente preguntando por criterios del proyecto](docs/screenshots/02-criteria-multiselect.png)

![Editor del equipo](docs/screenshots/03-team-editor.png)

![Confirmación con vista previa de archivos](docs/screenshots/05-confirmation.png)

### 4. Abrir tu proyecto en OpenCode o Claude Code

Una vez generados los archivos, ve a la carpeta del proyecto y abre tu cliente de IA. El **orquestador** ya está listo para coordinar al equipo.

```bash
cd ruta/a/tu-proyecto
opencode --agent orchestrator    # si elegiste OpenCode
# o:
claude                            # si elegiste Claude Code
```

### 5. Hablar con el orquestador

El orquestador te recibirá con una **fase de descubrimiento** — preguntas sobre épicas, funcionalidades y prioridades. A partir de tus respuestas:

- Delega trabajo a los agentes adecuados (PM, BA, arquitecto, devs, QA…).
- Lleva un registro de cada entregable en `docs/entregables/`.
- No deja avanzar a la siguiente fase sin tener cerrada la actual.

Tú actúas como **Product Owner / dueño del proyecto**: revisas entregables, apruebas pasos, das contexto. El orquestador y los agentes se encargan del flujo.

### Modo dry-run (sin escribir archivos)

Si quieres ver lo que se generaría **sin tocar disco**, agrega `--dry-run`:

```bash
abax-swarm init --dry-run
```

![Resumen modo dry-run](docs/screenshots/04-dryrun-summary.png)

---

## ¿Qué se genera?

Cuando confirmas, Abax Swarm escribe esta estructura en tu carpeta:

```
tu-proyecto/
├── .opencode/                    (o .claude/, según la plataforma elegida)
│   ├── agents/
│   │   ├── orchestrator.md       ← Coordina a todos los agentes
│   │   ├── project-manager.md
│   │   ├── business-analyst.md
│   │   ├── solution-architect.md
│   │   ├── developer-backend.md
│   │   └── …                     (entre 5 y 18 agentes según tamaño)
│   ├── skills/                   ← Conocimientos reutilizables
│   └── tools/                    ← Herramientas que los agentes pueden ejecutar
├── opencode.json                 ← Configuración de la plataforma
└── project-manifest.yaml         ← Metadata del proyecto
```

Los agentes son archivos Markdown con instrucciones claras de qué hacer, qué entregar, cuándo intervenir y a quién consultar.

---

## El equipo y las fases

### Roles base (siempre presentes)

Project Manager, Product Owner, Business Analyst, Solution Architect, Tech Lead, Backend Developer, Frontend Developer, QA Lead, QA Funcional, DevOps.

### Roles especializados (se añaden según las características marcadas)

DBA · Security Architect · Integration Architect · QA Automation · QA Performance · UX Designer · Tech Writer · Change Manager.

### Fases del proyecto (cascada)

```
0. Descubrimiento     → épicas, features, historias, backlog
1. Inception          → charter, kickoff, stakeholders
2. Análisis funcional → especificaciones, reglas de negocio
3. Diseño técnico     → arquitectura, modelo de datos, tareas
4. Construcción       → implementación por sprints
5. QA / Testing       → ejecución, defectos
6. UAT                → aceptación del usuario
7. Despliegue         → puesta en producción, rollback
8. Estabilización     → soporte post-producción
9. Cierre             → lecciones aprendidas
```

Cada fase tiene entregables obligatorios y una persona/rol que la aprueba. El orquestador no avanza si la fase actual no está completa.

### Stacks tecnológicos (13 disponibles)

`react-nextjs` · `react-nestjs` · `vue-nuxt` · `angular-springboot` · `angular-quarkus` · `astro-hono` · `python-fastapi` · `python-django` · `dotnet-blazor` · `go-fiber` · `rust-axum` · `flutter-dart` · `react-native-expo`

Lista completa: `abax-swarm stacks`.

---

## Personalizar tu equipo

Esta sección es para usuarios con algo de manejo de archivos YAML. Si nunca has tocado un YAML, mira [este tutorial corto](https://learnxinyminutes.com/docs/yaml/) (10 minutos) y vuelve.

**Lo importante:** Abax Swarm guarda **toda** su definición de roles, habilidades, herramientas, stacks y reglas en archivos YAML dentro de `data/`. Para personalizar **no necesitas tocar TypeScript** — basta editar YAML.

### Agregar un rol propio

1. **Clona el repo** (si vas a contribuir tu rol al proyecto) o trabaja sobre tu copia local.

   ```bash
   git clone https://github.com/breisnerlopez/Abax-Swarm.git
   cd Abax-Swarm
   npm install
   ```

2. **Crea el archivo del rol** en `data/roles/mi-rol.yaml`:

   ```yaml
   id: mi-rol
   name: Mi Rol Personalizado
   tier: 2                        # 1 = core, 2 = especializado
   category: technical            # functional, technical, support, governance
   description: Una línea explicando qué hace.
   responsibilities:
     - Una lista de responsabilidades.
     - Lo que entrega y cuándo.
   skills:
     - skill-id-existente         # IDs de data/skills/*.yaml
   tools:
     - tool-id-existente          # IDs de data/tools/*.yaml
   phases:
     - construction               # En qué fases participa
     - qa-testing
   prompt_extra: |
     Instrucciones adicionales que se añaden al system prompt del agente.
   ```

3. **Regístralo en las reglas:**
   - `data/rules/size-matrix.yaml` — para qué tamaños aplica el rol.
   - `data/rules/dependency-graph.yaml` — si depende de otros roles.
   - `data/rules/raci-matrix.yaml` — su responsabilidad en cada actividad.
   - `data/rules/criteria-rules.yaml` (opcional) — si solo aplica cuando se marcan ciertos criterios.

4. **Validar y probar:**

   ```bash
   npm run validate    # verifica que los YAML son válidos
   npm test            # corre los tests de consistencia entre entidades
   ```

   Si validate o test fallan, te dirán exactamente qué referencia rota hay (skill inexistente, fase desconocida, etc.).

5. **Probarlo en un proyecto:**

   ```bash
   npm run dev -- init
   ```

Guía detallada: [docs/guides/adding-roles.md](docs/guides/adding-roles.md).

### Agregar una habilidad o herramienta

Mismo patrón:
- `data/skills/mi-skill.yaml` — guía para [agregar skill](docs/guides/adding-skills.md).
- `data/tools/mi-tool.yaml` — guía similar.

### Agregar un stack tecnológico

Si tu equipo usa una combinación distinta (p.ej. Svelte + Rails), crea `data/stacks/svelte-rails.yaml` con la información del framework, convenciones y contexto que se inyecta en los prompts. Detalle: [docs/guides/adding-stacks.md](docs/guides/adding-stacks.md).

### Modificar el comportamiento de un rol existente

Edita el YAML del rol en `data/roles/<rol>.yaml`. Cambia `responsibilities`, `skills`, `tools`, `phases` o `prompt_extra`. Corre `npm run validate` y `npm test` para asegurar consistencia.

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
- **Generator**: dos targets paralelos (OpenCode, Claude Code) que comparten la misma salida del engine pero producen estructuras de archivo distintas.
- **Validator**: chequeos post-generación (referencias del orquestador, completitud RACI).

Documentación detallada: [docs/architecture.md](docs/architecture.md) y [docs/data-model.md](docs/data-model.md).

### Comandos de desarrollo

```bash
npm install                       # instalar dependencias
npm test                          # 216 tests (Vitest)
npm run test:watch                # modo watch
npm run typecheck                 # tsc --noEmit
npm run lint                      # ESLint sobre src/ y tests/
npm run validate                  # validar todos los YAML de data/
npm run dev -- init               # ejecutar el wizard en modo dev
npm run build                     # compilar TypeScript a dist/
```

### Workflow de Git

GitHub Flow simple:

- Trunk: `main`. Es la rama que se publica.
- Trabajo en ramas cortas con prefijo: `feature/`, `bugfix/`, `hotfix/`, `docs/`, `chore/`.
- Squash merge a `main` vía PR. CI corre `validate` + auto-label como required checks.
- Releases: tag `vX.Y.Z` sobre `main`. Esto dispara `release.yml`, que builda, empaqueta con `npm pack` y publica un GitHub Release con `.tgz` adjunto y notas auto-generadas.

Más detalle en [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

### Convenciones

- **Código en inglés**, **contenido y UI en español** (variables y funciones en inglés; YAML, prompts y textos del wizard en español).
- IDs en `kebab-case`: `developer-backend`, `react-nextjs`.
- Esquemas Zod en `src/loader/schemas.ts` son la única fuente de verdad para los tipos.

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
├── skills/      ← 70 habilidades
├── tools/       ← 7 herramientas
├── stacks/      ← 13 stacks
└── rules/       ← Matrices (size, RACI, dependencies, criteria)

templates/       ← Plantillas Handlebars (.md.hbs) para cada target
tests/           ← Vitest, unit + integración (216 tests)
docs/            ← Documentación detallada
```

---

## Comandos disponibles

```bash
abax-swarm init                              # asistente interactivo
abax-swarm init --dry-run                    # vista previa sin escribir
abax-swarm roles                             # listar roles disponibles
abax-swarm stacks                            # listar stacks
abax-swarm validate                          # validar los YAML de data/
abax-swarm regenerate --dir /ruta/proyecto   # regenerar desde un manifest existente
```

---

## Recursos

| Documento | Para qué |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Capas del sistema, flujo de datos |
| [docs/data-model.md](docs/data-model.md) | Esquemas YAML de cada entidad |
| [docs/guides/adding-roles.md](docs/guides/adding-roles.md) | Cómo agregar un rol |
| [docs/guides/adding-skills.md](docs/guides/adding-skills.md) | Cómo agregar una habilidad |
| [docs/guides/adding-stacks.md](docs/guides/adding-stacks.md) | Cómo agregar un stack |
| [docs/guides/orchestrator-flow.md](docs/guides/orchestrator-flow.md) | Cómo opera el orquestador en runtime |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | Resumen del sistema, convenciones, workflow Git |

---

## Requisitos

- Node.js >= 20
- npm

## Licencia

MIT.
