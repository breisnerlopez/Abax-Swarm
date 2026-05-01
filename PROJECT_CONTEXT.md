# PROJECT_CONTEXT.md

## Resumen del sistema

**Abax Swarm** es una herramienta CLI que genera equipos de agentes de IA coordinados para proyectos de software. Un wizard TUI recopila la configuración del proyecto, un motor selecciona y resuelve los agentes, y los generadores producen archivos Markdown de agentes + configuraciones para **OpenCode** o **Claude Code**.

Flujo a alto nivel:
1. El usuario ejecuta el wizard interactivo (7 pasos) que captura tamaño del proyecto, criterios y stack tecnológico.
2. El motor selecciona los roles aplicables, resuelve dependencias transitivas, deduce skills/tools, adapta prompts al stack y elige el modelo de gobernanza.
3. Los generadores emiten archivos Markdown (agentes, skills, tools, orquestador) y configuraciones (`opencode.json`, `project-manifest.yaml`).
4. Validadores post-generación verifican consistencia (referencias del orquestador, RACI completo).

---

## Arquitectura

Cuatro capas con flujo estricto de datos de izquierda a derecha:

```
Data Layer (src/loader/ + data/)
        ▼
Engine (src/engine/)
        ▼
Generator (src/generator/)
        ▼
Output (.opencode/ o .claude/)
```

### Capas

- **Loader** (`src/loader/`): Lee YAML desde `data/`, valida con esquemas Zod (`src/loader/schemas.ts`) y devuelve `Map`s tipados. Todos los esquemas de entidades viven en un solo archivo.
- **Engine** (`src/engine/`): Funciones puras, sin I/O.
  - `role-selector` — selecciona roles por tamaño y criterios.
  - `dependency-resolver` — añade dependencias duras transitivas.
  - `skill-resolver` / `tool-resolver` — deducen skills y tools desde los roles.
  - `stack-adapter` — fusiona el contexto del stack en los prompts.
  - `governance-resolver` — escoge el modelo de gobernanza.
- **Generator** (`src/generator/`): Plantillas Handlebars en `templates/opencode/` y `templates/claude/`. Cada target (OpenCode/Claude) tiene generadores paralelos: agent, skill, tool, orchestrator, config. El `config-generator` construye `opencode.json` y `project-manifest.yaml` programáticamente, no desde plantillas.
- **Validator**: Comprobaciones post-generación. `orchestrator-validator` verifica que las referencias del orquestador coincidan con el equipo real. `raci-validator` chequea completitud del RACI.

### CLI (`src/cli/`)

Une todo el flujo:
- `app.ts` — comandos Commander.
- `wizard.ts` — flujo interactivo de 7 pasos.
- `pipeline.ts` — selección → generación → validación → escritura.

### Decisiones de diseño clave

- **Datos desacoplados del código**: todos los roles, skills, tools, stacks y reglas viven como YAML en `data/`. Añadir un rol nuevo solo requiere un YAML y registrarlo en los YAML de reglas — sin cambios en TypeScript.
- **Engine puro**: sin I/O, sin lectura de archivos, sin efectos secundarios. Todo entra y sale con tipos.
- **Dos targets de generador**: OpenCode y Claude Code son implementaciones paralelas que comparten la salida del engine pero producen estructuras de archivos distintas.
- **Orquestador es el archivo más complejo**: `templates/opencode/orchestrator.md.hbs` genera el coordinador en runtime (Phase 0 discovery, protocolo de documentación, protocolo de presentación HTML, matriz RACI, cadena de dependencias, reglas inquebrantables).
- **Autorización por fases tipo whitelist**: cada rol declara `phases:`. Si una fase no está listada, el agente rechaza el trabajo en runtime. Al añadir fases hay que actualizar todos los roles participantes.

### Relaciones entre entidades

```
Role ──uses──▶ Skill[]   (role.skills referencia skill.id)
Role ──uses──▶ Tool[]    (role.tools referencia tool.id)
Role ──adapted_by──▶ Stack          (stack.role_context[roleId] se fusiona en el prompt)
Role ──depends_on──▶ Role[]         (dependency-graph.yaml)
Role ──participates──▶ Phase[]      (role.phases whitelist)
Role ──assigned──▶ Activity[]       (raci-matrix.yaml)
Criteria ──adds──▶ Role[]           (criteria-rules.yaml)
Size ──classifies──▶ Role[]         (size-matrix.yaml)
```

---

## Comandos útiles

```bash
# Tests (212 tests, umbral de cobertura >90%)
npm test

# Test individual
npx vitest run tests/unit/engine/role-selector.test.ts

# Tests por patrón
npx vitest run -t "dependency"

# Modo watch
npm run test:watch

# Type check
npm run typecheck

# Validar todos los YAML de data/ contra los esquemas Zod
npm run validate

# Wizard TUI en modo dev (sin build)
npm run dev -- init

# Otros comandos CLI vía dev
npm run dev -- roles
npm run dev -- stacks
npm run dev -- validate
npm run dev -- regenerate --dir /path/to/project
```

### Flujo recomendado tras modificar YAML en `data/`

1. `npm run validate` — comprueba esquemas.
2. `npm test` — los tests de integración cruzan referencias entre entidades.
3. Si añadiste un rol: actualizar también `size-matrix.yaml`, `dependency-graph.yaml`, `raci-matrix.yaml`.
4. Si añadiste un ID de fase: actualizar `phases:` en todos los roles participantes.

---

## Convenciones

### Idioma

- **Código en inglés**: nombres de variables, funciones y tipos.
- **UI y contenido en español**: prompts de agentes, instrucciones de skills, textos del TUI, contenido YAML.

### Identificadores

- **kebab-case** para todos los IDs: `developer-backend`, `functional-analysis`, `react-nextjs`.

### Tipos y esquemas

- **Zod es la única fuente de verdad para los tipos**: `Role`, `Skill`, `Tool`, `Stack` se infieren desde los esquemas Zod en `schemas.ts`. No definir tipos paralelos a mano.

### Estructura de tests

- Los tests reflejan la estructura del código fuente.
  - `tests/unit/loader/` — carga YAML, validación de esquemas, casos de error.
  - `tests/unit/engine/` — selección de roles, resolución de dependencias, resolución de skills/tools.
  - `tests/unit/generator/` — generación de archivos, contenido del orquestador, operaciones de escritura.
  - `tests/unit/cli/` — orquestación del pipeline, carga de contexto.
- Tests de integración:
  - `tests/integration/data-consistency.test.ts` — valida referencias cruzadas entre entidades (skills↔roles, deps↔roles, RACI↔roles).
  - `tests/integration/full-pipeline.test.ts` — end-to-end: config → selección → generación → validación.
  - `tests/integration/e2e-interface.test.ts` — ciclo escritura → lectura → regeneración (puede dar timeout bajo carga; se puede reintentar).

### Datos

- Todo dato de configuración (roles, skills, tools, stacks, reglas) vive como YAML en `data/`, no embebido en código.
- Los tests de integración verifican consistencia cruzada: cada skill/tool/role/fase referenciada debe existir.

---

## Pendientes y mejoras

Sección viva. Al cerrar un punto, muévelo a un changelog o elimínalo.

### Pendiente: validar el target Claude Code con el mix de modelos

La selección fina de modelo por agente está implementada para OpenCode (model + thinking/reasoningEffort en `opencode.json` y en el frontmatter de cada `.opencode/agents/*.md`). Para Claude Code, la línea `> Modelo: ...` aparece en el header del archivo `.claude/agents/*.md` como documentación, pero falta validar:

- Si Claude Code consume frontmatter YAML por agente o requiere otra forma de declarar el modelo.
- Si soporta `thinking` / `reasoningEffort` por agente.
- Si conviene mover el modelo a una config global (`claude.config` o equivalente) en lugar de por agente.

### Mejoras detectadas

#### 1. `opencode.json` no emite `tools_enabled` por agente
- **Archivo:** `src/generator/opencode/config-generator.ts`
- El `AgentConfigSchema` declara `tools_enabled`, pero el `config-generator` no lo incluye en el JSON. Solo emite `description`, `mode`, `temperature`, `permission`, `model` y `thinking`/`reasoningEffort`.
- **Acción:** verificar si es intencional (tal vez se delega a la plantilla `.md` del agente) o un olvido. Documentar la decisión.

#### 2. Defaults globales en `opencode.json`
- El `opencode.json` generado no emite `model` ni `small_model` a nivel raíz como fallback.
- **Acción:** considerar emitirlos para que agentes sin override usen un default consistente y para abaratar tareas mecánicas vía `small_model`.

---

## Workflow Git

El repo sigue **GitHub Flow**: una sola rama larga, PRs cortos, releases por tag.

### Ramas

- **`main`** — única rama larga. Es la verdad y la que se publica como release.
- **Ramas cortas** que mergean a `main` vía PR (squash merge):
  - `feature/<nombre>` — funcionalidad nueva.
  - `bugfix/<nombre>` — corrección de bug no urgente.
  - `hotfix/<nombre>` — fix urgente para producción.
  - `docs/<nombre>` — solo documentación.
  - `chore/<nombre>` — mantenimiento (deps, refactor, CI, build).

El prefijo de la rama determina la label que se aplica automáticamente al PR (vía `.github/workflows/auto-label.yml`), y esa label categoriza las release notes.

### Crear un release

Versionado SemVer (`MAJOR.MINOR.PATCH`), tags con prefijo `v`.

```bash
git checkout main && git pull
# bump version en package.json (p.ej. 0.1.1 → 0.1.2)
git commit -am "chore: bump version to 0.1.2"
git tag -a v0.1.2 -m "Release 0.1.2"
git push origin main --tags
```

El push del tag dispara `release.yml`, que builda, empaqueta con `npm pack` y publica una GitHub Release con el `.tgz` adjunto y notas auto-generadas.

### Pull requests

- **Squash merge** para todo PR a `main`.
- `main` está protegida: PR obligatorio, no force-push, no deletion, conversaciones resueltas, status check `validate` requerido.
- El checklist mínimo del PR vive en `.github/pull_request_template.md`.

Antes de abrir el PR, asegúrate de que pasen:

```bash
npm test
npm run typecheck
npm run validate    # solo si tocaste data/
```
