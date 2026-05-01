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

### Pendiente: pruebas en Claude Code de selección fina de modelos y parámetros

Hoy la investigación sobre configuración por agente se hizo solo contra el target **OpenCode** (ver `src/generator/opencode/`). Falta validar el equivalente en el target **Claude Code** (`src/generator/claude/`):

- Confirmar qué soporta Claude Code en el frontmatter de cada agente generado bajo `.claude/agents/*.md` (modelo por agente, thinking/reasoning, tools, permissions).
- Mapear las equivalencias entre OpenCode y Claude Code para los parámetros que decidamos exponer en los YAML de roles.
- Decidir si la abstracción provider-agnóstica (`cognitive_tier`, `reasoning`) en `AgentConfigSchema` se traduce correctamente a ambos targets.

**Por qué importa:** Abax-Swarm genera para los dos targets desde la misma data; cualquier campo nuevo en `AgentConfigSchema` debe poder traducirse a ambos sin acoplarse a un proveedor.

**Cómo aplicar cuando se retome:** crear un `model-mapping` por target (uno en `src/generator/opencode/`, otro en `src/generator/claude/`) y tests en `tests/unit/generator/` que verifiquen que cada `cognitive_tier` y nivel de `reasoning` produce el frontmatter esperado en cada target.

Parámetros confirmados en OpenCode pendientes de evaluar en Claude Code:
- `model` (override por agente).
- `thinking: { type: "enabled", budgetTokens }` (Anthropic).
- `reasoningEffort: high|medium|low|minimal` (OpenAI, vía OpenCode).
- `top_p`, `steps` (max iteraciones agénticas), `disable`, `hidden`, `color`.

### Mejoras detectadas

#### 1. Código muerto en plantilla de agente OpenCode
- **Archivo:** `templates/opencode/agent.md.hbs:4`
- El condicional `{{#if model}}model: {{model}}{{/if}}` nunca dispara porque `src/generator/opencode/agent-generator.ts:14-25` no pasa la variable `model` al `renderTemplate`.
- **Acción:** o bien activar el flujo (cuando se implemente la selección por agente) o eliminar el condicional para no inducir a error.

#### 2. `AgentConfigSchema` carece de campos de modelo y reasoning
- **Archivo:** `src/loader/schemas.ts:58-67`
- Solo expone `mode`, `temperature`, `description`, `system_prompt`, `permissions`, `tools_enabled`.
- **Acción propuesta:** añadir `cognitive_tier` (`strategic | implementation | mechanical`) y `reasoning` (`none | low | medium | high`) como campos provider-agnósticos. La traducción a `model`/`thinking`/`reasoningEffort` vive en cada generador.

#### 3. `opencode.json` no emite `tools` por agente
- **Archivo:** `src/generator/opencode/config-generator.ts:11-50`
- El `AgentConfigSchema` declara `tools_enabled`, pero el `config-generator` no lo incluye en el JSON. Solo `description`, `mode`, `temperature`, `permission`.
- **Acción:** verificar si es intencional (tal vez se delega a la plantilla `.md` del agente) o un olvido. Documentar la decisión.

#### 4. Falta capa de mapeo provider-agnóstica
- No existe un módulo tipo `model-mapping` que traduzca un concepto abstracto del rol (tier, reasoning) a la sintaxis de cada target.
- **Acción:** introducirlo cuando se aborde la mejora #2 para evitar que cada generador hardcodee nombres de modelo.

#### 5. Defaults globales en `opencode.json`
- El `opencode.json` generado no emite `model` ni `small_model` a nivel raíz como fallback.
- **Acción:** considerar emitirlos para que agentes sin override usen un default consistente y para abaratar tareas mecánicas vía `small_model`.

#### 6. `PROJECT_CONTEXT.md` es propiedad de `root`
- El repo entero está bajo `root:root` mientras el usuario habitual es `terminaladmin`. Cada edición requiere `sudo`.
- **Acción:** si es un entorno personal, considerar `sudo chown -R terminaladmin:terminaladmin .` para evitar fricción. Verificar antes que no haya razón deliberada.

#### 7. Test de integración con timeouts conocidos
- `tests/integration/e2e-interface.test.ts` está documentado como "puede dar timeout bajo carga, safe to retry".
- **Acción:** investigar la causa raíz (¿I/O sincrónico, tamaño del fixture, retries internos?) en lugar de normalizar el reintento.
