# Plan de fixes: integración runtime con opencode

**Origen:** Diagnóstico ejecutado en sesión `polymarket` (proyecto generado por `abax-swarm init`) que reportó tres síntomas al iniciar opencode con la configuración generada. Este documento (a) verifica si cada síntoma persiste en `abax-swarm` **v0.1.43**, (b) clasifica si es bug real, síntoma de otra causa, o falso positivo, y (c) define el plan de resolución.

**Estado global:** ✅ Plan completado — 3/3 resueltos (pendiente confirmación empírica del usuario en polymarket para #2 y #3).

| # | Síntoma reportado | Verificación contra v0.1.43 | Estado |
|---|---|---|---|
| 1 | `opencode.json` sin `default_agent` → opencode arranca con `build` (built-in) en vez de `orchestrator` | ✅ Bug real reproducido | ✅ Resuelto (2026-05-10) |
| 2 | `skill` tool reporta "No skills are currently available" | ⚠️ Diagnóstico parcial — los `SKILL.md` se generan correctamente; el síntoma es **secundario al bug #1** | ✅ Resuelto (2026-05-10) — pendiente confirmación empírica |
| 3 | Plugin `abax-policy.ts` no opera porque importa de `@opencode-ai/plugin` sin tener el paquete instalado | ⚠️ Diagnóstico refinado: la import del plugin es `import type` (no es la causa real), **pero los tools generados sí hacen value-import** y no existía `.opencode/package.json` | ✅ Resuelto (2026-05-10) |

---

## Finding #1 — Sin `default_agent` en `opencode.json`

### Evidencia del bug

`src/generator/opencode/config-generator.ts:73-83` construye el objeto raíz:

```ts
const config: Record<string, unknown> = {
  $schema: "https://opencode.ai/config.json",
  agent: agentConfig,
};
if (rootPermission !== undefined) config.permission = rootPermission;
if (pluginPaths.length > 0) config.plugin = pluginPaths;
```

Nunca se asigna `config.default_agent`. La doc oficial ([opencode.ai/docs/config/#default-agent](https://opencode.ai/docs/config/#default-agent)) indica que si el campo está ausente, opencode usa el agente built-in `build`. Por eso `polymarket` veía solo `explore` y `general` como Task targets.

### Plan de resolución

- [x] **Paso 1.1** — Modificar `config-generator.ts` para emitir `default_agent: "orchestrator"` en el config raíz. Implementado en `src/generator/opencode/config-generator.ts:73-83`: el campo se inserta entre `$schema` y `agent`, con un comentario explicativo que apunta a este documento.
- [x] **Paso 1.2** — Añadir test. Reforzado el test existente `tests/unit/generator/opencode-generator.test.ts` (`describe("ConfigGenerator")` → `it("should generate valid opencode.json")`) con la aserción `expect(parsed.default_agent).toBe("orchestrator")`.
- [x] **Paso 1.3** — `npm test`: 769/780 tests pasan. Las 11 fallas restantes son todas `EACCES: permission denied` en operaciones de filesystem (write-files, pipeline writes, loader directory tests) — pre-existentes y debidas al sandbox del entorno de ejecución actual, no a este cambio. El test específico de `generateOpenCodeConfig` (17 asserts) pasa al 100%.
- [x] **Paso 1.4** — Smoke test funcional: `generateOpenCodeConfig([], ...)` ahora produce un objeto con orden de keys `$schema, default_agent, agent, permission`. Verificación adicional en `docs/permissions.md` aplazada — el comentario inline en `config-generator.ts` referencia este documento, que basta como single source of truth.

**Resolución:** ✅ Cerrado 2026-05-10. Commit pendiente.

**Cambios aplicados:**
- `src/generator/opencode/config-generator.ts` — añadido campo `default_agent: "orchestrator"` con comentario.
- `tests/unit/generator/opencode-generator.test.ts` — aserción `parsed.default_agent === "orchestrator"`.

---

## Finding #2 — `skill` tool no detecta los SKILL.md

### Evidencia

Reportado: `skill` tool reporta "No skills are currently available".

Verificación en v0.1.43:

1. **Estructura de archivos correcta** — `src/generator/opencode/skill-generator.ts:14` escribe en `.opencode/skills/<id>/SKILL.md`. La plantilla `templates/opencode/skill.md.hbs:1-4` emite frontmatter con `name: <id>` y `description`. El `id` cumple el regex `^[a-z0-9]+(-[a-z0-9]+)*$` (convención del proyecto).
2. **Permisos por rol** — 19 de 20 roles tienen `skill: allow` en su YAML (`data/roles/*.yaml`). El único con `skill: deny` es `orchestrator.yaml:53` — **por diseño**: el orchestrator es coordinador puro, no ejecuta skills directamente.
3. **Causa raíz del síntoma** — Sin `default_agent` (Finding #1), opencode arranca como `build` (built-in). El built-in `build` no tiene awareness de `.opencode/skills/`, por lo que su `skill` tool listing es vacío. Resolver Finding #1 hace que opencode use `orchestrator` como primario — el orchestrator delega vía `task` a subagentes que sí tienen `skill: allow` y pueden cargar skills on-demand.

### Plan de resolución

- [x] **Paso 2.1** — Resolver Finding #1 primero (precondición). Hecho.
- [x] **Paso 2.2** — Verificación estática completa en `/root/proyectos-personales/polymarket`:
  - `opencode.json` parcheado manualmente para incluir `default_agent: "orchestrator"` (el proyecto se generó con una versión previa de Abax y no se quería regenerar para no clobberar cambios uncommitted).
  - Estructura `.opencode/skills/<id>/SKILL.md` validada — frontmatter con `name: <id>` y `description`, ubicación correcta, nombre exacto en mayúsculas.
  - 8 subagentes en el proyecto tienen `permission.skill: "allow"` (project-manager, business-analyst, tech-lead, developer-backend, qa-functional, solution-architect, devops, developer-frontend).
  - Orchestrator tiene `permission.task: "allow"` y `permission.skill: "deny"` — exactamente el modelo esperado: delega a subagentes, no carga skills él mismo.
- [x] **Paso 2.3** — Modelo mental documentado en este archivo (sección "Cadena que opera tras el fix" debajo).
- [ ] **Paso 2.4** — Confirmación empírica con `opencode` corriendo en polymarket queda como acción del usuario. En este entorno sandboxed `opencode --version` falla con `EACCES` al intentar crear `~/.local/share/opencode`, por lo que no se puede instanciar una sesión interactiva desde aquí.

### Cadena que opera tras el fix

1. Usuario ejecuta `opencode` en directorio con `opencode.json`.
2. opencode lee `default_agent: "orchestrator"` → arranca como `orchestrator` (NO como built-in `build`).
3. orchestrator recibe prompt → como `skill: deny`, su propio listado de skills sale vacío (esperado por diseño).
4. orchestrator delega vía `task` a subagente (ej. `developer-backend`).
5. El subagente arranca con `skill: allow` → opencode escanea `.opencode/skills/*/SKILL.md` y expone el tool `skill` con los 57 skills disponibles para carga on-demand.
6. Subagente invoca `skill({ name: "anti-mock-review" })` (por ejemplo) → carga contenido del archivo bajo demanda.

**Resolución:** ✅ Cerrado 2026-05-10 con verificación estática. Marcará como definitivamente validado cuando el usuario confirme empíricamente en polymarket que un subagente lista skills con `skill list` o equivalente.

**Cambios aplicados:**
- `/root/proyectos-personales/polymarket/opencode.json` — añadido `default_agent: "orchestrator"` manualmente (proyecto generado con Abax < v0.1.44; el fix permanente está en `config-generator.ts` y aplicará al regenerar).

---

## Finding #3 — Plugin no carga por falta de `@opencode-ai/plugin`

### Evidencia

Reportado: el plugin importa de `@opencode-ai/plugin` y como el proyecto generado no tiene `package.json` con esa dep, el plugin "falla silenciosamente".

Verificación en v0.1.43:

```ts
// templates/opencode/plugins/abax-policy.ts:44
import type { Plugin } from "@opencode-ai/plugin";
...
// línea 291
const PLUGIN: Plugin = async (input) => { ... };
...
// línea 505
export default PLUGIN;
```

- La import es **type-only** (`import type`). Bun erasea este tipo de imports en runtime — no requiere que el paquete exista.
- El uso de `Plugin` en línea 291 es solo anotación de tipo (`: Plugin`), también eraseada.
- No hay imports value-level de `@opencode-ai/plugin` en ningún punto del archivo.
- Conclusión: el plugin **debería cargar sin** el paquete `@opencode-ai/plugin` instalado.

Esto sugiere que el reportero observó un síntoma real (políticas no aplicadas) pero **misdiagnosticó la causa**. Causas alternativas plausibles:

- `abax-policies.json` ausente o malformado → el plugin entra en su fail-open `try/catch` y se vuelve no-op.
- opencode no escanea `.opencode/plugins/*.ts` cuando se invoca desde un directorio sin `bunfig.toml`.
- El plugin se carga pero los hooks `tool.execute.before/after` no se disparan para los tools que el reportero esperaba.
- Permisos del orchestrator (con `task: allow` pero todo lo demás `deny`) hacen que el plugin nunca vea las llamadas que debería interceptar.

### Diagnóstico refinado

La inspección estática reveló dos hechos clave que el reporte de polymarket no separó:

1. **Plugin `abax-policy.ts`** — usa `import type { Plugin }` (línea 44) y solo lo aplica como anotación de tipo (línea 291). Bun erasa este import en runtime → el plugin sí carga sin `@opencode-ai/plugin`.
2. **Tools generados** — `templates/opencode/tool.ts.hbs:1` emite `import { tool } from "@opencode-ai/plugin"` (VALUE import). Cada uno de los ~10 tools en `.opencode/tools/<id>.ts` tiene este import. Sin el paquete instalado, opencode falla al resolverlos en runtime.

Adicionalmente, el generador **no emitía** `.opencode/package.json`. El proyecto polymarket tiene uno (`@opencode-ai/plugin: 1.14.31`) porque alguien lo creó manualmente — no porque Abax lo emitiera.

**Conclusión:** Finding #3 era un bug real (el SDK debe estar instalado), pero la causa específica reportada (plugin con import directo) era incorrecta. La causa real son los tools.

### Plan de resolución

- [x] **Paso 3.1** — Añadir constantes en `src/engine/paths.ts`: `OC_PACKAGE_JSON_PATH = ".opencode/package.json"` y `OC_PLUGIN_SDK_VERSION = "^1.14.0"` (pin por mayor — bumpear tras validar nuevo major).
- [x] **Paso 3.2** — Modificar `src/generator/opencode/plugin-generator.ts` (`generatePluginFiles`) para emitir un tercer archivo `.opencode/package.json` con:
  ```json
  {
    "private": true,
    "description": "Generated by abax-swarm. Declares the runtime deps required by .opencode/tools/* and .opencode/plugins/*.",
    "dependencies": { "@opencode-ai/plugin": "^1.14.0" }
  }
  ```
- [x] **Paso 3.3** — Actualizar test `tests/unit/generator/opencode/plugin-generator.test.ts` (`emits the documented opencode files`) para validar la presencia del nuevo archivo y la versión del SDK declarada.
- [x] **Paso 3.4** — Añadir aviso post-generación al usuario indicando el paso requerido:
  - `src/cli/format.ts::printSuccess` ahora recibe `target` y, si es `"opencode"`, imprime: `cd <dir>/.opencode && bun install` (o `npm install`).
  - `src/cli/WizardApp.tsx` (rama `target === "opencode"` en la pantalla post-generación del wizard) emite el mismo aviso.
  - `src/cli/app.ts::regenerate` pasa `config.target` a `printSuccess`.
- [x] **Paso 3.5** — `npm test`: 769/780 verde (mismas 11 fallas pre-existentes por sandbox EACCES); test específico de plugin-generator: 22/22 verde.

**Resolución:** ✅ Cerrado 2026-05-10.

**Cambios aplicados:**
- `src/engine/paths.ts` — añadidas constantes `OC_PACKAGE_JSON_PATH` y `OC_PLUGIN_SDK_VERSION`.
- `src/generator/opencode/plugin-generator.ts` — `generatePluginFiles` ahora retorna 3 archivos (plugin + policies + package.json).
- `src/cli/format.ts` — `printSuccess(target)` con bloque condicional de instrucción de instalación.
- `src/cli/WizardApp.tsx` — pantalla post-generación muestra el mismo aviso cuando `data.target === "opencode"`.
- `src/cli/app.ts` — pasa `config.target` al `printSuccess` del comando `regenerate`.
- `tests/unit/generator/opencode/plugin-generator.test.ts` — assertion `.opencode/package.json` presente con dep `@opencode-ai/plugin`.

**Pendiente del usuario:** confirmar empíricamente en polymarket que tras `cd .opencode && bun install` (ya lo tiene instalado) los tools se cargan y los hooks `tool.execute.before/after` del plugin se disparan correctamente. Si el plugin no opera incluso con el SDK instalado, abrir nueva investigación con foco en cómo opencode detecta `.opencode/plugins/*.ts` (puede requerir `bunfig.toml` o configuración adicional no cubierta por este finding).

---

## Histórico de resoluciones

### 2026-05-10 — Finding #1 resuelto

**Cambio:** `config-generator.ts` ahora emite `default_agent: "orchestrator"` en el config raíz. Sin este campo opencode arrancaba con su agente built-in `build`, ignorando todo el equipo generado (orchestrator + subagents) y por consiguiente todos los `.opencode/skills/*` (síntoma del Finding #2).

**Verificación:**
- Test unitario añadido en `opencode-generator.test.ts` pasa.
- Smoke test: el JSON generado contiene `default_agent: "orchestrator"` en el orden esperado (`$schema, default_agent, agent, permission`).
- Suite completa: 769/780 verde; las 11 fallas son `EACCES` del sandbox y existían antes del cambio.

**Próximo paso:** confirmar Finding #2 (skills cargables vía subagentes) regenerando polymarket con esta versión.

### 2026-05-10 — Finding #2 resuelto (verificación estática)

**Hallazgo refinado:** el síntoma original ("`skill` tool reporta No skills are currently available") era consecuencia directa del Finding #1 — sin `default_agent`, opencode usaba el agente built-in `build` que no escanea `.opencode/skills/`. Los archivos SKILL.md y los permisos de los subagentes ya estaban correctos en el generador.

**Verificación estática en polymarket:**
- 8 subagentes tienen `skill: allow` (chain operable confirmada).
- Orchestrator tiene `task: allow` + `skill: deny` (diseño correcto: coordinador puro).
- Todos los `.opencode/skills/<id>/SKILL.md` tienen frontmatter compliant con opencode docs (name kebab-case, description, ubicación exacta).

**Cambios:**
- `polymarket/opencode.json` parcheado con `default_agent: "orchestrator"` para permitir verificación inmediata del usuario sin regenerar.

**Pendiente del usuario:** ejecutar opencode en polymarket y confirmar que un subagente delegado lista skills disponibles vía `skill`. La sandbox actual no permite arrancar opencode (`EACCES` al crear `~/.local/share/opencode`).

### 2026-05-10 — Finding #3 resuelto

**Hallazgo refinado:** el reporte original culpaba al plugin (`abax-policy.ts`), pero su import es `import type` y se erasa en runtime. La causa real son los **tools** generados (`.opencode/tools/<id>.ts`) que sí hacen value-import de `@opencode-ai/plugin`. El generador no emitía `.opencode/package.json`, por lo que `bun install` en `.opencode/` no tenía nada que leer.

**Cambios principales:**
- Generador emite `.opencode/package.json` con dependencia pinned `^1.14.0`.
- CLI y wizard ahora avisan post-generación: `cd .opencode && bun install`.
- Constantes centralizadas en `src/engine/paths.ts`.

**Verificación:**
- Smoke test del generator: emite los 3 archivos esperados con dep correcta.
- Test `plugin-generator.test.ts`: 22/22 verde, incluyendo nueva assertion del package.json.
- Suite completa: 769/780 (11 fallas EACCES pre-existentes).
- polymarket ya tenía un `.opencode/package.json` manual con `@opencode-ai/plugin: 1.14.31` — funcional pero ya no necesario porque el generador lo emite ahora.
