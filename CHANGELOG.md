# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.41] — 2026-05-06

Patch release driven by user feedback after running `abax-swarm init` on
a small + lightweight project (9 roles): the wizard summary buried them
under ~80 warnings, most of them informational ("approver X not in team
and no fallback role resolved" for roles that were intentionally
optional for the chosen team size).

This release reduces visible warnings to **0** for the typical
small/lightweight project and to **0 across all 36 e2e compositions** in
the sweep. The information that previously dumped as warnings now flows
through a separate notices channel and is shown as a single-line count.

### Added — `approver_fallback` chains across 54/56 deliverables

`data/rules/phase-deliverables.yaml` previously declared
`approver_fallback` for 2 deliverables. Now declares it for **all 56**.
Standard chains by approver:

| Approver | Fallback chain |
|---|---|
| product-owner | `[business-analyst, project-manager, tech-lead]` |
| qa-lead | `[qa-functional, tech-lead, project-manager]` |
| solution-architect | `[tech-lead, project-manager, developer-backend]` |
| project-manager | `[business-analyst, tech-lead, solution-architect]` |
| tech-lead | `[solution-architect, project-manager, developer-backend]` |

Combined with the `responsible_fallback` extension below, a small team
of 9 roles now resolves every mandatory deliverable's responsible AND
approver to someone real.

### Added — `responsible_fallback` chains for 20 more deliverables

Extended from 14 (in 0.1.40) to 34. Standard chains:

| Responsible | Fallback chain |
|---|---|
| business-analyst | `[project-manager, tech-lead]` |
| change-manager | `[project-manager, business-analyst]` |
| integration-architect | `[solution-architect, tech-lead]` |
| security-architect | `[solution-architect, tech-lead]` |
| qa-performance | `[qa-functional, tech-lead]` |
| qa-automation | `[qa-functional, tech-lead]` |
| ux-designer | `[developer-frontend, business-analyst]` |
| devops | `[tech-lead, developer-backend]` |

### Added — segregation of duties in `resolveWithFallback`

New `exclude` option on the resolver. When `resolveDeliverablesForTeam`
resolves a deliverable's approver, it now passes the resolved
responsible's id as `exclude` so the chain skips them. Prevents the
edge case where both responsible and approver would land on the same
person via fallback. Backward-compatible: the parameter is optional.

### Added — validator severity model: notices vs warnings

New `src/validator/types.ts` introduces a shared shape for all three
validators (gates, raci, orchestrator):

```typescript
ValidationResult { valid, errors, warnings: string[], notices: string[] }
ValidationContext { sizeMatrix?, projectSize?, mode? }
```

Severity rules:

  - **error**: hard inconsistencies (orchestrator missing required
    section, undeclared @mention)
  - **warning**: actionable issues — role missing AND fallback didn't
    resolve AND the role is `recommended`/`indispensable` for this
    project size
  - **notice**: informational — fallback resolved successfully OR the
    missing role is `optional` for this size OR the project mode is
    `document` (intentional minimal team)

When `ValidationContext` is omitted, validators preserve pre-0.1.41
behavior (everything goes to `warnings`). All call sites in the
pipeline now pass full context.

### Added — `mode === "document"` downgrades all role-related findings

In document mode the user picked a docs-only team intentionally;
RACI/phase-deliverables references to dev/qa/ops roles are not
actionable. They flow to notices regardless of tier. Drops doc-mode
sweep warnings from 5 → 0 per composition.

### Added — `orchestratorNotices` field on `PipelineResult`

Pipeline aggregates notices from all three validators into a separate
channel. CLI consumers (format.ts, WizardApp.tsx) display them as a
collapsed count by default.

### Added — CLI collapse rules in `printValidatorFindings()`

  - 0 warnings + 0 notices → silent
  - ≤10 warnings → all printed inline
  - >10 warnings → first 5 + `… y N más. Ejecuta abax-swarm validate`
  - Notices always shown as count summary; full list only via verbose

The wizard summary panel applies the same collapse: shows up to
`WIZARD_WARNING_PREVIEW = 5` warnings inline, then a hint, plus a
one-line notice count.

### Added — 41 new tests across 4 new files

  - `tests/unit/validator/severity-classification.test.ts` — 18
    cases covering classifyRoleTier + severityForMissingRole including
    document-mode downgrade
  - `tests/integration/governance-aware-validators.test.ts` — 11
    cases including the user's exact scenario (small + lightweight
    must produce 0 warnings + ≥40 notices), large+full producing
    0 of either, medium-incomplete still surfacing indispensable
    misses as warnings, and dataset-level invariants (every approver
    has a chain, every chain entry references a real role)
  - `tests/integration/notices-vs-warnings.test.ts` — 12 cases
    including pipeline aggregation, no overlap between channels, and
    the new resolveWithFallback exclude option
  - `tests/integration/format-collapse.test.ts` — 7 cases capturing
    stdout to verify the collapse behaviour at boundaries (0, 7, 15,
    1 notice, 83 notices, verbose mode)

Total: **702 tests / 56 files** (was 660/52). All 36 e2e compositions
in `tests/e2e/sweep-generation.sh` now report `warnings=0`.

### Fixed — wizard E2E test forgot the orchestrator-model step

`tests/e2e/wizard-flow.test.ts` was added for 0.1.14 and never updated
when 0.1.40 inserted the `orchestrator-model` step between provider
and permissions. Test waited for "Permisos de OpenCode" while wizard
was on "Modelo del orquestador" → timeout. Test fix only; no product
change. (The 0.1.40 release shipped because the test file-level
failure didn't fail individual test cases under the dot reporter.)

### Migración

Run `sudo npm install -g abax-swarm@latest` to update the global CLI,
then `abax-swarm regenerate --dir <project>` for any existing project.
The regen will produce 0 visible warnings on small projects (was ~80
in 0.1.40) and a single-line notice count.

No data file format changes — pure additive. Projects that hand-edited
`phase-deliverables.yaml` keep their edits.

## [0.1.40] — 2026-05-06

Largest single release since 0.1.0: introduces a **manifest contract**
for project-level policy overrides + a **runtime enforcement plugin**
that consumes that contract in every generated project. Closes the
architectural gap surfaced by the Abax-Memory v2 session post-mortem
(orchestrator running 9 phases for a 16-item improvement proposal,
ignoring the iteration-strategy skill mandate, autonomously deciding
"cascada completa" without asking the user).

### Added — five generic policy mechanisms

Each declared as YAML data + Zod schema + runtime consumer. Generic
across team composition (5 to 25 roles), stack (14 supported), mode
(new/document/continue) and provider (anthropic/openai).

1. **Task atomicity contract** (`data/rules/task-contracts.yaml`)
   Atomic actions + forbidden combinations (e.g. `fix-and-ship`).
   Project-level overlay via manifest `task_contracts_override:`.

2. **Secret patterns** (`data/rules/secret-patterns.yaml`)
   9 baseline patterns (OpenAI/Anthropic/AWS/GitHub/GCP/JWT/bearer/
   base64/SSH key). `severity: block | warn`. Projects extend via
   `secret_patterns_extra:`.

3. **Runaway limits** (`data/rules/runaway-limits.yaml`)
   parts/duration/tokens caps by category and role. Resolution:
   by_role > by_category > default. Hook emits notice, never blocks.

4. **Iteration scopes** (`data/rules/iteration-scopes.yaml`)
   Four baseline scopes: major / minor / patch / hotfix. Each declares
   `keywords`, `skip_phases`, `minimal_phases` (deliverable allowlist),
   `full_phases`, `default_layout_strategy` (A/B/C/D).
   `require_scope_for_phases:` triggers the runtime block when project
   has iteration signals (bitácora / CHANGELOG / fase-9-cierre/) and
   no active scope is set.

5. **Per-role explicit model assignment**
   `model_overrides_explicit:` in manifest. Wizard exposes the
   highest-leverage case (orchestrator) as a four-option step:
   default / claude-opus-4-7+high / gpt-5.2+high / skip-and-edit-later.

### Added — runtime enforcement plugins

- **opencode**: `templates/opencode/plugins/abax-policy.ts` (TS plugin
  via `@opencode-ai/plugin` SDK). Hooks `tool.execute.before/after`
  for `task` (atomicity, scope-enforcement, secret-redaction) and
  `bash`/`write`/`edit` (secret-redaction, runaway).

- **claude**: `templates/claude/hooks/abax-policy.py` (Python script
  invoked by `.claude/settings.json` PreToolUse/PostToolUse hooks).
  Same logic, different runtime. Both targets emit identical
  `policies.json` for the same input — locked by cross-target
  invariant test.

### Added — five custom tools

Generated into every project's `.opencode/tools/`:

- `phase-state` — evaluates phase gates (file-exists / git-check /
  url-reachable / attestation / runtime-check / command).
- `verify-deliverable` — runs the `verification[]` cmds declared on a
  deliverable, with `{stack.<layer>.test_command}` placeholder
  resolution.
- `attest-deliverable` — writes JSON attestation to
  `docs/.attestations/<phase>/<deliverable>.json` with git_sha and
  files_touched.
- `set-iteration-scope` — writes `.opencode/iteration-state.json` (or
  `.claude/...`, target-aware auto-detect). Validates scope_id against
  the catalog before writing.
- `suggest-iteration-scope` — scores user input against
  `iteration_scopes.keywords`, returns suggested scope_id with
  rationale and confidence. Closes the iteration-strategy loop: BA
  suggests before asking the user.

### Added — phase-deliverables.yaml schema extensions

- `gates[]` per phase (discriminated union: file-exists, git-check,
  url-reachable, attestation, runtime-check, command).
- `verification[]` per deliverable (cmd + expect_regex + on_failure).
- `attestation_required: bool` per deliverable.
- `responsible_fallback[]` and `approver_fallback[]` — ordered chain
  resolved by `src/engine/role-fallback.ts:resolveDeliverablesForTeam`.
  Used by both opencode and claude generators (single source of truth).
- `narrative_only: bool` + `narrative_markdown: string` per phase.
  `discovery` is the first first-class user. Migrated 132 lines of
  hardcoded prose from `orchestrator.md.hbs` into the YAML field.

### Added — `discovery` as a real phase

Phase 0 was narrative-only in the orchestrator template; it was not
in `phase-deliverables.yaml` so the runtime plugin couldn't recognise
it. Adding it as a real phase with 6 deliverables (vision-producto,
epicas-features, historias-usuario, design-system-template,
backlog-priorizado, discovery-presentation) plus `narrative_only: true`
unblocks deliverable-level scope enforcement for Discovery work.

### Added — generic stack commands

`StackLayerSchema` gains optional `test_command` and `build_command`.
Populated for the 13 supported stacks (mvn / npm / pytest / dotnet /
flutter / cargo / etc.); legacy-other intentionally omits them so
verify-deliverable can fall back gracefully.

### Added — invariant test suites

- `tests/integration/role-fallback-invariants.test.ts` — every
  `responsible` in `policies.phases` resolves to team; orchestrator
  @mentions ⊆ team; opencode and claude emit identical
  `policies.phases` for the same input.
- `tests/integration/path-consistency.test.ts` — templates' hardcoded
  paths match `src/engine/paths.ts` constants. Future rename fails CI
  until both sides updated.
- `tests/integration/data-consistency.test.ts` extended — every role
  in RACI / dependency-graph / phase-deliverables exists; every phase
  id and deliverable id in iteration-scopes resolves. Caught a real
  drift on first run (`acceptance-criteria` vs `acceptance-criteria-doc`).
- `tests/unit/generator/orchestrator.test.ts` extended — every
  `narrative_only: true` phase has matching prose in template.

Total: 660 tests across 52 files (was 584/47 in 0.1.39).

### Added — `tests/e2e/` reproducible artefacts

`sweep-generation.sh` (36 compositions × 6 invariants),
`role-fallback-consistency.sh`, `adversarial-llm.sh`, plus three
direct synthetic-stdin probes. `tests/e2e/README.md` documents the
campaign + an honest finding: synonym attacks against atomicity bypass
keyword-based detection (LLM-cooperated test A failed). Three
remediation paths documented; recommended PostToolUse on bash deferred.

### Added — manifest trailer documenting overrides

Every generated `project-manifest.yaml` now ends with five
commented-out blocks (one per override mechanism). When at least one
override is active, the trailer is replaced by an "Active policy
overrides" header with the user's actual content — round-trip
preserves user input.

### Added — wizard step for orchestrator-model

`src/cli/WizardApp.tsx` gains an `orchestrator-model` step between
`provider` and `permissions`. Four options including the high-leverage
"claude-opus-4-7 + reasoning_effort=high" preset. Other manifest
overrides keep the trailer-discovery path; the wizard exposes only
the single-field, single-role decision.

### Fixed — round-trip preservation of policy overrides

`generateProjectManifest` was emitting a fresh manifest without the
user's override blocks. A single `regenerate` would silently drop
their work. Now preserves any active override blocks under an
"Active policy overrides" YAML header.

Also wired `manifest.{task_contracts_override, secret_patterns_extra,
runaway_limits_override, model_overrides_explicit,
iteration_scopes_override, active_iteration_scope}` into the
`regenerate` CLI. Without this fix the trailer was inert.

### Fixed — silent role-fallback drift across generators

Discovered via Tier E sweep (36 compositions, 25/36 had orphan
deliverables). The orchestrator-generator silently filtered phases
whose `responsible` was missing from the team; the plugin-generator's
`policies.json` kept them. Runtime tools (phase-state,
attest-deliverable) saw deliverables no team member could produce.

`src/engine/role-fallback.ts` is the single source of truth.
`opencode/plugin-generator.ts` and `claude/policy-generator.ts` (which
previously was missing the resolution entirely) both call
`resolveDeliverablesForTeam`. After fix: 0/36 orphans.

### Fixed — drift in `set-iteration-scope` across targets

Tool body hardcoded `.opencode/iteration-state.json`. The Python hook
for Claude reads `.claude/iteration-state.json`. In a Claude project
the tool's writes never reached the hook. Now auto-detects which
subtree exists and writes to the correct location (or BOTH if both
subtrees exist).

### Schema correctness fixes

- `ModelOverrideSchema.provider` restricted to `["anthropic","openai"]`
  to match `PROVIDER_MODELS` in `src/engine/model-mapping.ts`.
- `RunawayLimitsSchema.by_category` uses `z.record(z.string(), ...)`
  because enum-keyed record requires every key present.
- `UrlReachableGateSchema.url` accepts `{placeholder}` or http(s) URL
  via refine; full URL validation at gate-evaluation time.

### Migración

Projects regenerated with 0.1.34–0.1.39: run `abax-swarm regenerate
--dir <path>` with 0.1.40 installed. New files emitted:

  .opencode/plugins/abax-policy.ts
  .opencode/policies/abax-policies.json
  .opencode/tools/{phase-state, verify-deliverable,
                   attest-deliverable, set-iteration-scope,
                   suggest-iteration-scope}.ts

Plus modifications to:
  .opencode/agents/orchestrator.md   (Discovery prose now from YAML)
  opencode.json                      (plugin field)
  project-manifest.yaml              (override trailer)

Existing project manifests without override blocks remain
backward-compatible — every new field is optional with a default.

## [0.1.39] — 2026-05-04

### Fixed — `permission_mode: full` ahora se aplica tambien al frontmatter de los `.md` de agente (regresion silenciosa)

Sintoma reportado: el usuario eligio `permission_mode: full` en la wizard, el `opencode.json` quedo correctamente con `* allow` y los per-agent sin `ask` (gracias a `applyModeToAgentPermissions`), **pero la sesion de OpenCode seguia pidiendo confirmacion** para `bash` en `developer-backend`, `developer-frontend`, `devops`, `qa-functional`, `tech-lead` y para `webfetch` en `business-analyst`, `solution-architect`, `tech-lead`.

### Causa raiz

Los archivos `.opencode/agents/<role>.md` (y `.claude/agents/<role>.md`) llevan su propio frontmatter `permission:` que **OpenCode trata como override** sobre `agent.<id>.permission` del `opencode.json`. El generador de agentes (`src/generator/{opencode,claude}/agent-generator.ts`) renderizaba `role.agent.permissions` **crudo del role YAML**, sin pasar por `applyModeToAgentPermissions`. Resultado: el `opencode.json` decia "allow" pero el frontmatter del `.md` decia "ask", y el segundo ganaba.

`config-generator.ts` ya aplicaba la funcion correctamente; era un bug solo del agent-generator.

### Fix

- `src/generator/opencode/agent-generator.ts`: `generateAgentFile` y `generateAllAgentFiles` ahora aceptan `permissionMode: PermissionMode` (default `"recommended"` para back-compat) y aplican `applyModeToAgentPermissions(role.agent.permissions, mode)` antes de pasar el contexto al template Handlebars.
- `src/generator/claude/agent-generator.ts`: mismo cambio (paridad con OpenCode).
- `src/cli/pipeline.ts`: propaga `config.permissionMode ?? "recommended"` a ambos generators.

### Tests

Cuatro tests nuevos en `tests/unit/generator/opencode-generator.test.ts`:

1. **full mode = cero `ask` en frontmatter** — recorre todos los `.md` generados y verifica `not.toMatch(/^\s+\w+: ask$/m)`.
2. **full mode preserva `deny`** — `business-analyst.bash: deny` (arquitectonico) sigue siendo `deny`.
3. **strict mode degrada `allow` a `ask`** y mantiene `deny`.
4. **recommended mode es pass-through** — output identico al default.

Suite local: 17/17 en `opencode-generator.test.ts` (incluye los 4 nuevos). Las 11 fallas restantes en CI local son `EACCES` en `mkdir` de tmp dirs (sandbox), pre-existentes y sin relacion con este fix.

### Migracion

Los proyectos ya regenerados con 0.1.34-0.1.38 en modo `full` tienen frontmatters con `ask` que siguen pidiendo confirmacion. Soluciones:

- **Recomendada**: `abax-swarm regenerate --dir <ruta>` con la 0.1.39 instalada.
- **Parche manual** (sin regenerar): `sed -i 's/: ask$/: allow/' .opencode/agents/*.md` o `.claude/agents/*.md`.

Reiniciar la sesion / cliente de OpenCode despues del cambio (los `.md` se cargan al inicio de sesion, no en caliente).

## [0.1.38] — 2026-05-03

### Added — agent prompt declares its tool catalog (anti `tool: invalid` round trip)

Cada `.opencode/agents/<role>.md` y `.claude/agents/<role>.md` ahora incluye una seccion **Herramientas disponibles** con dos listas explicitas:

- **Puedes llamar:** built-ins permitidos por el rol + custom tools del catalogo
- **NO puedes llamar:** built-ins denegados por `permissions: deny` o `tools_enabled: false`

Mas tres recetas de fallback para los bloqueos mas comunes:
- crear directorios → `write` directamente (auto-crea padres)
- shell/build/tests/migraciones → delegar al rol con permiso (devops, developer-backend, qa-automation, dba)
- read/grep si tu rol los tiene denegados → delegar via orquestador

### Por que

Incidente real: en una sesion 0.1.37 el `@business-analyst` quiso ejecutar `mkdir -p docs/entregables/v2/fase-2-analisis/` antes de escribir un archivo. Como el BA tiene `bash: deny` por diseno (es analista funcional, no tecnico), OpenCode rechazo la llamada con `tool: invalid` y el modelo perdio un round trip. Ironicamente el `mkdir` era redundante: el siguiente `write` auto-crea las carpetas padre.

El LLM no tenia forma estatica de saber que `bash` estaba bloqueado para su rol — el catalogo del prompt mostraba todas las herramientas disponibles del runtime, no las filtradas por rol. Ahora el prompt mismo le dice exactamente que puede y que no puede llamar, y la primera receta es justamente "para crear directorios usa `write`".

### Implementacion

- Nuevo helper puro `src/engine/agent-tools.ts::computeAgentTools(role)` que cruza `permissions` + `tools_enabled` y devuelve `{allowed, denied, custom}`.
- Tanto `src/generator/opencode/agent-generator.ts` como `src/generator/claude/agent-generator.ts` lo invocan y lo pasan al template como `availableTools`.
- Templates `templates/{opencode,claude}/agent.md.hbs` actualizados con la seccion.
- Tests: `tests/unit/engine/agent-tools.test.ts` (5 casos) + 2 casos nuevos en `tests/unit/generator/opencode-generator.test.ts` que verifican que el BA tiene `bash` en denied y la receta de `write` para mkdir.

El orquestador NO se ve afectado: usa su propia plantilla `orchestrator.md.hbs`, no `agent.md.hbs`.

## [0.1.37] — 2026-05-03

### Changed — `full` mode = bypass TOTAL sin asteriscos (semantica del usuario)

Solicitud explicita del usuario: *"esa opcion es la de permisos completos, esa es la que deberia setearll, consideralo tambien en el regenerate"*.

Removidos los ultimos dos patterns en `ask` (`rm -rf *` y `sudo *`). En `full` mode AHORA **cero comandos piden confirmacion**.

Estructura final:

```json
{
  "*": "allow",
  "bash": { "*": "allow" },
  "external_directory": "allow"
}
```

Aplicado tambien en `regenerate` (que usa la misma funcion `buildOpenCodePermission`), por lo tanto el proximo `abax-swarm regenerate` trae la nueva config.

### Razonamiento semantico

- `strict` mode = sin override del root (todo per-tool por default OpenCode = ask)
- `recommended` mode = pattern extenso con safety por default (apt/sudo en ask, dev tools en allow)
- `full` mode = **bypass TOTAL**. Sin asteriscos. El usuario que elige full sabe lo que hace.

Si el usuario quiere alguna salvaguarda especifica (ej. preservar `rm -rf` en ask) puede:
1. Usar `recommended` que tiene safety patterns extensos por default.
2. Editar manualmente el `opencode.json` post-regenerate.
3. Configurar el global `~/.config/opencode/opencode.json`.

Pero por default, `full` significa full.

### Tests

Tests actualizados para verificar que `bash` keys = `["*"]` exactamente (cero `ask` patterns). Suite **572 tests pasando** sin cambio.

### Historia completa de la evolucion de full mode

| Version | Comportamiento | Sintoma |
|---|---|---|
| 0.1.13-0.1.33 | `permission: "allow"` (string) | Bug v1.14.x: git ops pedian confirmacion por hardcoded prompts |
| 0.1.34 | objeto explicito sin root `"*"` catch-all | echo y otros tools no listados pedian permission |
| 0.1.35 | objeto con root `"*"` + git destructivos en ask | git push --force pedia permission aun en full |
| 0.1.36 | sin git en ask, mantiene rm -rf y sudo en ask | rm -rf y sudo seguian pidiendo |
| **0.1.37** | bypass TOTAL, cero asks | full = full sin excepciones |

## [0.1.36] — 2026-05-03

### Changed — `full` mode no pide confirmacion para git (solicitud explicita del usuario)

Sintoma: el usuario eligio `permission_mode: full` y aun asi `git push --force`, `git push -f` y `git reset --hard` pedian confirmacion. La intencion del usuario fue clara: *"no quiero que git pregunte"*.

Fix: removidos los patterns de git destructivos (`git push --force *`, `git push -f *`, `git reset --hard *`) del `ask` list en modo full. Ahora **TODOS los comandos git pasan sin confirmacion** en modo full, incluyendo force push y hard reset.

Mantenidos como `ask` solo dos patterns sistema-wide no relacionados con git:
- `rm -rf *` (proteccion contra borrado masivo de filesystem)
- `sudo *` (proteccion contra escalamiento de privilegios)

Estructura final modo full:

```json
{
  "*": "allow",
  "bash": {
    "*": "allow",
    "rm -rf *": "ask",
    "sudo *": "ask"
  },
  "external_directory": "allow"
}
```

### Bypass total disponible

Si el usuario quiere que TAMBIEN `rm -rf` y `sudo` pasen sin confirmacion (bypass absoluto), el patron correcto es editar manualmente el opencode.json o el global `~/.config/opencode/opencode.json`:

```json
{ "permission": "allow" }
```

Esto es bypass total sin objeto de patterns. Esa es decision del usuario fuera del scope de Abax Swarm.

### Tests

Tests actualizados para verificar que `git push --force *`, `git push -f *`, `git reset --hard *` ya NO aparecen en el objeto. Verifican explicitamente que solo `rm -rf *` y `sudo *` quedan en ask. Suite **572 tests pasando** sin cambio.

### Historia del bug

- 0.1.13-0.1.33: full devolvia string `"allow"` -> OpenCode v1.14.x pedia confirmacion para git ops por prompts hardcoded.
- 0.1.34: cambio a objeto explicito pero faltaba root `"*"` catch-all -> tools no listadas (task, skill, write) caian a ask.
- 0.1.35: agregado root `"*": "allow"`, mantenia git destructivos en ask.
- **0.1.36**: usuario explicitamente pidio remover git del ask. Solo rm -rf y sudo quedan.

## [0.1.35] — 2026-05-03

### Fixed — `permission_mode: full` faltaba root catch-all `"*"` (regression de 0.1.34)

Sintoma reportado: en 0.1.34 algunos comandos triviales como `echo` empezaron a pedir permiso, comportamiento que NO existia en versiones anteriores.

Causa: 0.1.34 cambio el formato de `permission` de string `"allow"` a un objeto con keys explicitas (`bash`, `edit`, `read`, `glob`, `grep`, `webfetch`, `external_directory`). Pero **olvido el catch-all `"*"` al ROOT** del objeto. Segun la doc oficial de OpenCode (https://opencode.ai/docs/permissions):

> *"Rules are evaluated by pattern match, with the **last matching rule winning**. A common pattern is to put the catch-all `"*"` rule first, and more specific rules after it."*

Sin el `"*"` root, las herramientas internas de OpenCode NO listadas (`task`, `skill`, `websearch`, `write`, `patch`, `todowrite`, `notebookedit`, etc.) caen al per-tool default que es `ask`. Esto manifesto como prompts inesperados.

Fix: estructura simplificada con root catch-all + override solo de `bash` con patterns destructivos:

```json
{
  "*": "allow",
  "bash": {
    "*": "allow",
    "git push --force *": "ask",
    "git push -f *": "ask",
    "git reset --hard *": "ask",
    "rm -rf *": "ask",
    "sudo *": "ask"
  },
  "external_directory": "allow"
}
```

Cambios respecto a 0.1.34:
- **Agregado** `"*": "allow"` al root (cubre `task`, `skill`, `websearch`, `write`, `patch`, `todowrite`, `notebookedit`, etc.).
- **Removido** `git *` y `git push *` redundantes en bash (ya cubiertos por bash `"*"`).
- **Removido** `edit/read/glob/grep/webfetch` redundantes en root (ya cubiertos por root `"*"`).
- **Mantenido** los 5 vetos destructivos en bash + `external_directory: "allow"` explicito.

Resultado practico:
- `echo "..."`, `curl ...`, `task(...)`, `skill(...)`, `write(...)` → allow sin prompt
- `git checkout -b ...`, `git commit ...`, `git push origin main` → allow sin prompt
- `git push --force`, `git push -f`, `git reset --hard`, `rm -rf`, `sudo` → siguen pidiendo confirmacion

### Tests

`tests/integration/permissions-isolation.test.ts`: 2 tests actualizados para verificar nueva estructura. Sentinel: `oc.permission["*"] === "allow"` (root catch-all presente) + `oc.permission.bash["git push --force *"] === "ask"`.

Suite: **572 tests pasando** (sin cambio en numero).

### Lecciones aprendidas

1. Cuando OpenCode acepta tanto string como objeto para `permission`, el formato **string `"allow"`** es mas seguro como bypass total — funciona en TODAS las herramientas sin necesidad de listar cada una.
2. El formato **objeto** requiere `"*"` root catch-all SIEMPRE para evitar que tools no listadas caigan a `ask`.
3. La regla de OpenCode es **last matching wins**, no most-specific-wins. Patterns mas especificos van DESPUES del catch-all.

## [0.1.34] — 2026-05-03

### Fixed — `permission_mode: full` ahora emite objeto de patterns explicito (override prompts hardcoded de OpenCode)

Sintoma reportado: el usuario configuro `permission_mode: full`, root permission del opencode.json era `"allow"` (string), per-agent `bash: allow` para devops, pero **OpenCode v1.14.x sigue pidiendo confirmacion** para operaciones git que cambian estado del repo (`git checkout -b`, `git commit`, `git push`). Bash queda en `running` esperando aprobacion del usuario en la UI.

Causa raiz: OpenCode v1.14.x tiene **prompts de confirmacion hardcoded** para state-changing git operations que no se overriden con un simple `permission: "allow"` (string). Hace falta un objeto explicito con patterns `bash` para que OpenCode los respete.

Fix: `buildOpenCodePermission("full", ...)` ahora devuelve objeto explicito en lugar de string `"allow"`:

```json
{
  "bash": {
    "*": "allow",
    "git *": "allow",
    "git push *": "allow",
    "git push --force *": "ask",
    "git push -f *": "ask",
    "git reset --hard *": "ask",
    "rm -rf *": "ask",
    "sudo *": "ask"
  },
  "edit": "allow",
  "read": "allow",
  "glob": "allow",
  "grep": "allow",
  "webfetch": "allow",
  "external_directory": "allow"
}
```

Cambios de comportamiento:
- `git checkout -b`, `git commit`, `git push` (sin force) → ahora se ejecutan SIN pedir confirmacion en modo full.
- `git push --force` / `git push -f` → siguen pidiendo confirmacion incluso en modo full (proteccion contra rewrites destructivos del historial remoto).
- `git reset --hard *` → sigue pidiendo (destructivo local).
- `rm -rf *` y `sudo *` → siguen pidiendo (destructivos sistema).

Esos 4 vetos en `ask` son intencionales: full mode bypassa convenience prompts pero no las protecciones contra danos catastroficos accidentales.

### Tests

- `tests/integration/permissions-isolation.test.ts`: dos tests actualizados para verificar el nuevo formato. Sentinel: `oc.permission.bash["git *"] === "allow"` y `oc.permission.bash["git push --force *"] === "ask"`.

Suite: **572 tests pasando** (sin cambio en numero), typecheck + validate OK.

### Que necesita el usuario hacer

```bash
abax-swarm regenerate    # en el directorio del proyecto
```

Trae el nuevo opencode.json con el objeto explicito. Reiniciar opencode web para que cargue el config.

Si modificaste manualmente el opencode.json del proyecto en versiones anteriores como workaround, regenerate lo sobreescribe con el patron oficial.

## [0.1.33] — 2026-05-03

### Added — Skill `publication-notification` (URLs publicas al usuario)

Asignada a 6 roles (tech-writer, business-analyst, devops, project-manager, product-owner, solution-architect). Cuando un entregable HTML se completa, el rol responsable construye la URL publica esperada (`https://<owner>.github.io/<repo>/<path>`) y la reporta al orquestador. El orquestador la incluye en su mensaje al usuario al cerrar la Task. Resuelve el sintoma del incidente `ses_21088afdeffe...` donde el BA produjo `presentacion-descubrimiento.html` v2 pero ningun rol notifico la URL al sponsor.

### Added — Entregable obligatorio "Reporte de URLs publicas" al cierre de fase

Anadido al orchestrator template (opencode + claude). Cuando se cierra fase con HTMLs producidos, el ULTIMO entregable obligatorio es una tabla con TODOS los HTMLs publicados en esa fase + URLs + status. Path: `docs/entregables/<fase>/urls-publicas.md`. Responsable PM o tech-writer. Si la fase no produjo HTMLs, se omite.

### Changed — `iteration-strategy` extendido con tarea post-rename

Cuando aplica estrategia A (folder por release) y el devops mueve `docs/entregables/fase-X/` → `docs/entregables/v1/fase-X/`, **TODAS las referencias en `docs/index.html` quedan rotas**. La skill ahora obliga al orquestador a delegar al `@devops` (o `@tech-writer`) inmediatamente despues del rename: reescribir prefijos, agregar seccion v2, preservar design system, reportar URL via `publication-notification`. Sin esto el sitio publico queda con N links rotos (incidente Abax-Memory v2 dejo 16).

### Fixed — Auditoria de los 7 tools: runtime defaults para args opcionales

El plugin `@opencode-ai/plugin` define `tool.schema.string().default("X")` pero NO aplica el default en runtime cuando el LLM omite el arg (incidente create-presentation 0.1.32). Aplicado el mismo patron defensivo a los 6 tools restantes:

| Tool | Args con runtime default agregado |
|---|---|
| `create-document` | title, doc_type, content |
| `create-dashboard` | dashboard_type, project_name, data |
| `generate-diagram` | description (diagram_type ya defensivo via `validTypes.includes`) |
| `db-migrate` | action, name |
| `lint-code` | path (fix ya defensivo via boolean ternary) |
| `run-tests` | test_type, path |

Patron uniforme: `const x = args.x || "<default>";` antes de cualquier uso.

**Test guard nuevo** `tests/integration/tool-runtime-defaults.test.ts`: escanea cada tool con `default:` en su schema y exige runtime fallback (acepta `||`, `??`, `includes() ?`, `has() ?`, ternario boolean defensivo). Falla CI si un nuevo tool olvida el patron.

### Changed — Pages workflow: documentacion explicita modo Actions vs legacy

`pages-generator.ts` ahora emite `pages.yml` con comentarios extensos sobre:
- Modo "GitHub Actions" (workflow corre, soporta MkDocs si existe `mkdocs.yml`)
- Modo "legacy" (source: branch — bypassea el workflow)
- Como verificar el modo actual con `gh api repos/<owner>/<repo>/pages | jq -r '.build_type'`
- Como activar Actions con UI o `gh api -X PUT ... -f build_type=workflow`
- Plantilla `mkdocs.yml` minima para que `.md` se rendericen en HTML aun en modo `new`

`docs/presentation-publishing.md` extendido con seccion "Activacion de GitHub Pages — modo Actions vs legacy".

### Tests

- `tests/integration/publication-notification.test.ts`: 14 tests (skill content, guides, wiring, orchestrator emission opencode + claude, pipeline)
- `tests/integration/tool-runtime-defaults.test.ts`: 9 tests (guard rail para los 7 tools + verificacion del defensive escape de create-presentation + comment markers)

Suite total: **572 tests pasando** (era 549), typecheck + validate OK, **84 skills** (era 83).

### Documentation

- `docs/publication-notification.md` (nuevo): descripcion completa del release con las 6 piezas + ejemplo de aplicacion al proyecto cliente.
- `docs/presentation-publishing.md` extendido.
- `docs/README.md` actualizado.

### Nota sobre regenerate y presentaciones existentes

`abax-swarm regenerate` toca `.opencode/`, `.claude/`, configs, design-system, `.devcontainer/`, `.github/workflows/pages.yml`. **NO toca** `docs/entregables/*` porque esos son outputs del orquestador del proyecto cliente. Para regenerar una presentacion HTML existente con el tool `create-presentation` actualizado, abrir sesion OpenCode y pedir al BA o tech-writer "regenerar la presentacion X usando el tool actualizado".

## [0.1.32] — 2026-05-03

### Fixed — `create-presentation` tool: `escape(undefined)` cuando el LLM omitia args opcionales

En la sesion `ses_21088afdeffe...` (2026-05-03 20:11 UTC) el `@business-analyst` intento crear la "Presentación de Descubrimiento v2" via `create-presentation` y la herramienta fallo dos veces con: `undefined is not an object (evaluating 's.replace')`.

Causa raiz: el LLM omitio `presentation_type` (no lo paso en los args). El plugin `@opencode-ai/plugin` no aplica los `tool.schema.string().default("status")` cuando el args llega faltante desde el LLM (default es solo a nivel de validacion, no de runtime). Resultado: `args.presentation_type === undefined` → `typeLabels[undefined] === undefined` → `escape(undefined)` → `s.replace is not a function`.

El BA fallo, hizo fallback a `write` directo construyendo el HTML manualmente — lo cual funciono pero saltea toda la logica de templates corporate-minimal/tech-editorial/dark-premium del tool.

Fix: en `data/tools/create-presentation.yaml`:
- **Defaults a runtime**: `const presentationType = args.presentation_type ?? "status"` y `const audience = args.audience ?? "executive"` antes de usarlos.
- **Defensive `escape`**: `(s: unknown) => String(s ?? "").replace(...)` en vez de `(s: string) => s.replace(...)`. Tolera undefined/null sin lanzar.
- **Comentario citando el incidente** para que futuros mantenedores entiendan por que existe el fallback.

4 tests nuevos en `tests/integration/create-presentation-defaults.test.ts` que verifican la presencia del runtime default, defensive escape, uso de variables locales en vez de args.X en HTML emission, y la cita al incidente.

Suite total: **549 tests pasando** (era 545), typecheck + validate OK.

### Por que esto pasa con plugin defaults

El SDK `@opencode-ai/plugin` define `tool.schema.string().default("...")` para describir el contrato del tool al LLM. Pero el LLM puede ignorar el default y simplemente omitir el arg. Cuando el args llega al `execute()`, el SDK no rellena los valores ausentes con sus defaults — eso es responsabilidad del codigo del tool. Esta es una trampa comun (similar al patron `Object.assign` para defaults en JS) y aplicable a cualquier otro tool del catalogo que tenga args opcionales con default.

**Auditoria pendiente**: revisar los demas tools (`create-document`, `create-dashboard`, `generate-diagram`, `db-migrate`, `lint-code`, `run-tests`) por el mismo patron. Si encontramos casos similares, fix incremental con los mismos defensive defaults + escape.

## [0.1.31] — 2026-05-03

### Fixed — `permission_mode: full` no elevaba per-agent permissions

Bug latente desde 0.1.13 (cuando se introdujo `permissionMode`): `buildOpenCodePermission()` escribia el `permission` raiz de `opencode.json` correctamente (`"allow"` en modo full), pero **cada agente mantenia los permisos definidos en su rol YAML**. Como OpenCode trata el per-agent permission como override del root, los `bash: ask`, `webfetch: ask`, etc. seguian pidiendo confirmacion al usuario aunque hubiera elegido `full`.

Sintoma reportado por el usuario: *"me está pidiendo aprobaciones cuando no debería ya que en una versión anterior lo configuré para que tenga todos los accesos"*.

Fix: nueva funcion `applyModeToAgentPermissions(perms, mode)` en `src/engine/permissions.ts`:

| Modo | Comportamiento |
|---|---|
| `full` | Eleva todos los `ask` → `allow`. **Preserva `deny`** (especialmente para el orchestrator que es coordinador puro por diseno). |
| `recommended` | Pass-through (sin cambios — comportamiento previo). |
| `strict` | Demote todos los `allow` → `ask`. Preserva `deny`. Mas conservador. |

Aplicada en `config-generator.ts` para los permisos del orquestador y de cada sub-agente. El orquestador mantiene `read: deny`/`bash: deny`/etc. en TODOS los modos porque son arquitecturales.

### Tests

9 nuevos tests en `tests/integration/permission-mode-elevation.test.ts`:
- `applyModeToAgentPermissions`: pass-through en recommended, elevation en full, demote en strict, preserva deny en todos los modos.
- `generateOpenCodeConfig`: en full, developer-backend `bash` pasa de `ask` a `allow`; orchestrator `bash: deny` se preserva. En recommended, sin cambios. En strict, `read`/`edit` demote a `ask`.

Suite total: **545 tests pasando** (era 536), typecheck + validate OK, **83 skills** (sin cambios).

### Nota arquitectural

El orquestador tiene `read: deny`, `edit: deny`, `bash: deny`, `task: allow` por DISEÑO — es coordinador puro. Estos `deny` se mantienen INCLUSO en modo full, porque elevarlos romperia la arquitectura del sistema (orquestador puro coordinator + roles especializados). Si necesitas que el orquestador haga read/write/bash directamente, eso seria un cambio mayor de modelo (no un ajuste de permisos).

## [0.1.30] — 2026-05-03

### Fixed — `read directly` instruction was impossible (orchestrator OpenCode no tiene `read`)

Bug introducido en 0.1.29: el orchestrator template instruia "lee `project-manifest.yaml` directamente sin Task". Pero el orquestador en OpenCode tiene `permission.read: deny` por diseno (es coordinador puro). Resultado: 4 intentos de `tool|invalid()` consecutivos, despues caia al patron viejo de delegar a `@general` (lo que 0.1.29 trataba de evitar).

Fix: reemplazar el "atajo de lectura directa" por **"primera Task obligatoria al `@business-analyst`"** que lee manifest+bitacora+CHANGELOG+propuesta en una sola delegacion, aplica `iteration-strategy` (skill cargada en BA) y reporta resumen + estrategia recomendada.

Skills `iteration-strategy` y `delegation-discipline` actualizadas con la misma correcion + clarificacion explicita: "El orquestador en OpenCode NO tiene `read` (permission.read: deny). Por lo tanto la lectura inicial DEBE delegarse a `@business-analyst`, NO a `@general`/`@explore`."

Asimetria reconocida: en Claude Code el orquestador es la sesion del usuario y SI tiene `read`. La recomendacion de delegar a BA sigue siendo buena practica para mantener reporte estructurado y activacion consistente de skills.

### Changed

- `templates/opencode/orchestrator.md.hbs`: bloque "Atajo" reemplazado con plantilla literal de Task al `@business-analyst`. Instruccion critica reordenada (paso 1: Primera Task al BA con `iteration-strategy`; paso 2: A/B/C/D si aplica; pasos 3-7: delegacion segun matriz).
- `templates/claude/orchestrator.md.hbs`: misma logica, orden ajustado.
- `data/skills/iteration-strategy.yaml`: seccion "Atajo de deteccion" reescrita.
- `data/skills/delegation-discipline.yaml`: procedimiento correcto reescrito + heuristica 6 actualizada.

### Tests

Tests existentes de delegation-discipline actualizados para verificar nuevo wording. **2 nuevos tests** agregados: clarifica que orquestador OpenCode no tiene `read` permission, reconoce la asimetria con Claude Code. Suite total: **536 tests pasando** (era 535).

### Por que esto importa

Sin este fix, el orquestador entraba en loop:
1. Lee instruccion "lee directamente"
2. Trata de usar `read` → `tool|invalid()` (sin permission)
3. Falla, intenta de nuevo → `tool|invalid()` x4
4. Cae al fallback que conoce: `@general`
5. Bypassa todas las skills criticas

Ahora el flujo es:
1. Lee instruccion "delega primera Task a @business-analyst"
2. Hace `task(business-analyst)` con plantilla literal
3. BA lee + aplica iteration-strategy + reporta
4. Orquestador procede con info estructurada y skill activada

## [0.1.29] — 2026-05-03

### Added — Skill `delegation-discipline` (cuando nativos OpenCode vs roles del proyecto)

En la sesion `ses_210f79b8effe...` (2026-05-03 18:09 UTC) el orquestador procesando una propuesta v2.0.0 sobre Abax-Memory delego exploracion exhaustiva a `@explore` (3+ minutos) y lectura de la propuesta a `@general` — ambos subagents nativos de OpenCode que NO tienen cargadas las skills criticas (role-boundaries, anti-mock-review, existing-docs-update-protocol, code-naming-convention, git-collaboration, documentation-quality-bar, iteration-strategy). Bypassed todo el sistema de salvaguardas que llevamos 0.1.19-0.1.28 construyendo.

Decision arquitectural: **NO prohibir los nativos** (tienen usos legitimos donde su eficiencia justifica), sino **priorizar roles del proyecto** y vetar nativos en 4 casos criticos.

Skill nueva `delegation-discipline` asignada a 6 roles coordinadores (project-manager, product-owner, business-analyst, tech-writer, solution-architect, tech-lead) con:

- **Matriz de decision** de 12 filas: cuando rol del proyecto vs cuando nativo OK.
- **4 vetos criticos** para nativos: (1) `write`/`edit` en docs/src/raiz, (2) `git commit`/`push`, (3) decisiones formales con approver RACI (ADRs, specs), (4) entregables formales de `phase-deliverables.yaml`.
- **Atajo de deteccion**: leer `project-manifest.yaml` + `docs/bitacora.md` + `CHANGELOG.md` directamente (sin Task) antes de delegar exploracion. 80% del contexto en 3 reads.
- 3 guides: ejemplos de nativos permitidos, ejemplos prohibidos, heuristicas rapidas (decision en 5 segundos).

### Changed — `iteration-strategy` reforzado con activacion temprana

`when_to_use` ahora incluye "PRIMER mensaje del usuario" + palabras clave `implementar propuesta`. `instructions` ampliadas con seccion "Atajo de deteccion" (leer manifest + bitacora + changelog antes de delegar) e instruccion explicita "NO delegues exploracion exhaustiva a `@explore` esperando ver mas — ya tienes suficiente para decidir estrategia".

### Changed — Orchestrator template (opencode + claude)

Sección nueva "ROLES DEL PROYECTO vs SUBAGENTS NATIVOS" que incluye:
- Tabla de 5 casos donde nativos son OK (busqueda, lookup, bosquejo, sintesis, lectura individual)
- Tabla de 4 vetos donde nativos NO se permiten (write, commit, decision RACI, entregable formal)
- Atajo "Lee el manifest antes de explorar"
- Instruccion critica reordenada: paso 1 lee manifest; paso 2 activa iteration-strategy si aplica; pasos 3-7 delega segun matriz

CLAUDE.md template recibe la misma logica condensada.

### Added — Tests integrales

18 nuevos tests en `tests/integration/delegation-discipline.test.ts` cubriendo: skill content (matriz, 4 vetos, atajo, 3 guides), iteration-strategy reforzado, orchestrator template (sección ROLES vs NATIVOS, 4 vetos en template, atajo manifest, activacion iteration-strategy), CLAUDE.md template, pipeline (skill llega a agentes, SKILL.md generado), bidireccional sync.

Suite total: **535 tests pasando** (era 517), typecheck + validate OK, **83 skills** (era 82).

### Documentation

- `docs/delegation-discipline.md` (nuevo): sintoma, causa raiz, decision "priorizar no prohibir", matriz, 4 vetos, refuerzo iteration-strategy, refuerzo orchestrator template, ejemplo paso a paso del flujo correcto.
- `README.md` y `docs/README.md` actualizados (7 guard rails ahora visibles, era 6).

## [0.1.28] — 2026-05-03

### Fixed — `regenerate` no ejecutaba detection (anti-overwrite block nunca llegaba al orchestrator)

Bug latente desde 0.1.16 (cuando se introdujo `existingDocs`): el comando `regenerate` construia el `ProjectConfig` desde `project-manifest.yaml` pero **omitia `detectProjectContext()`**. Resultado: `config.detection` quedaba `undefined`, y por lo tanto `flags.existingDocs`/`flags.hasGit` eran `undefined` en el orchestrator generator. Los bloques condicionales `{{#if existingDocs}}` y `{{#if hasGit}}` del template **nunca se renderizaban en proyectos regenerados**.

Impacto especifico tras 0.1.26: la seccion reforzada **anti-overwrite con plantilla literal `ATENCION — POSIBLE ARCHIVO PREEXISTENTE`** no llegaba al orchestrator.md aunque el proyecto tuviera docs preexistentes — exactamente el escenario para el que se diseno. Solo la Capa B (skill cargada en sub-agents) funcionaba.

Fix: `regenerate` ahora corre `detectProjectContext(dir)` y pasa el resultado en `config.detection`. Tambien lee `manifest.project.mode` (que tampoco se respetaba antes).

2 tests nuevos en `tests/integration/regenerate-detection.test.ts` que ejecutan el binario real contra fixtures temporales:
- Con docs/*.md preexistentes → orchestrator.md DEBE contener `Protocolo de actualizacion`, `anti-overwrite`, `ATENCION — POSIBLE`, `iteration-strategy`.
- Sin docs/*.md → orchestrator.md NO debe contener ninguno de los anteriores.

Suite total: **517 tests pasando** (era 515).

## [0.1.27] — 2026-05-03

### Changed — Help y docs de `regenerate` aclaran que `--dir` es opcional (default carpeta actual)

`abax-swarm regenerate` ya soportaba ejecutarse sin `--dir` (default `.`), pero el README, CLAUDE.md, docs/iteration-strategies.md y la descripcion de `--help` del comando lo presentaban siempre con `--dir <path>` como si fuera obligatorio. Ajustado para mostrar las dos formas: `abax-swarm regenerate` (carpeta actual) y `abax-swarm regenerate --dir /ruta/proyecto` (otra carpeta).

Sin cambios funcionales — solo claridad de documentacion y `--help`.

## [0.1.26] — 2026-05-03

### Fixed — Sobrescritura silenciosa de docs preexistentes en iteracion v2 (incidente Abax-Memory v2)

En la sesion `ses_21170157cffe...` (2026-05-03), el orquestador procesando una propuesta de v2.0.0 sobre el proyecto v1 cerrado Abax-Memory delego al business-analyst tareas tipo "Elabora el Documento de Vision del Producto v2.0.0" sin instruccion explicita de preservar el archivo v1 existente. El BA ejecuto `write` sobre las mismas rutas, **sobreescribiendo silenciosamente 8 entregables de v1** (Vision, Epicas, Historias, Backlog, Presentacion Discovery, Acta de Constitucion, Registro Interesados, Template de presentacion) en cuestion de minutos. Solo se rescato porque no estaban commiteados.

Causa raiz: el "Protocolo de actualizacion de documentacion existente" del orchestrator template SI mencionaba "no reescribir desde cero" pero esa instruccion vivia solo en el prompt del orquestador y NO se reinyectaba en el prompt de cada Task delegada — el subagent en su sesion hija nunca lo leia. Ademas, no habia politica explicita para nueva iteracion mayor sobre proyecto cerrado.

### Added — Skill `existing-docs-update-protocol` (anti-overwrite)

Asignada a 15 roles que escriben docs (BA, PO, tech-writer, todos los developers, DBA, arquitectos, tech-lead, devops, QA, PM, change-manager). Da al sub-agent el procedimiento exacto antes de cualquier `write`:

1. Verificar si el archivo existe (`test -f`).
2. Si NO existe → escribir normal.
3. Si EXISTE → **escalar al orquestador** con plantilla "DOCUMENTO PREEXISTE — solicito instruccion antes de escribir" y esperar estrategia A/B/C/D.

Las 4 estrategias documentadas con plantillas listas: A (bloque "## Cambios <fecha>" al final), B (secciones tachadas + nuevo abajo), C (archivo paralelo o folder por release), D (archivar v1 a `docs/.archive/v1/` y reescribir). Anti-patrones explicitos. Coordinacion con role-boundaries y documentation-quality-bar.

### Added — Skill `iteration-strategy` (politica antes de delegar)

Asignada a 6 roles coordinadores (PM, PO, BA, tech-writer, sol-arch, tech-lead). Cuando el orquestador detecta proyecto cerrado + nueva iteracion mayor, esta skill se activa **bloqueante**: el orquestador DEBE preguntar al usuario antes de delegar el primer entregable de la nueva iteracion cual de las 4 estrategias aplicar. Decision documentada en `docs/iteration-log.md` y aplicada consistentemente a TODOS los entregables de la iteracion (no mezclar A para uno y C para otro).

### Changed — Orchestrator template (`existingDocs` block reforzado)

Cuando `existingDocs === true`, el bloque ahora:
- Cita el incidente Abax-Memory v2 por nombre y fecha como motivacion.
- Provee plantilla LITERAL "ATENCION — POSIBLE ARCHIVO PREEXISTENTE" que el orquestador debe inyectar en CADA Task delegado a docs preexistentes.
- Explica las 2 capas independientes de defensa (Capa A = orquestador inyecta, Capa B = sub-agent valida con la skill).
- Instruye uso de `iteration-strategy` cuando hay v2/v3.

Replicado en CLAUDE.md template.

### Added — Tests integrales

23 nuevos tests en `tests/integration/anti-overwrite.test.ts`:
- Skill `existing-docs-update-protocol`: existencia, prohibicion de write silencioso, 4 estrategias, anti-patrones, wiring a 15 roles, 3 guides.
- Skill `iteration-strategy`: detection condiciones, 4 estrategias, requerimiento de PREGUNTAR (BLOQUEANTE), `iteration-log.md` obligatorio, prohibicion de mezclar estrategias, wiring a 6 roles, 3 ejemplos guides.
- Orchestrator template: con `existingDocs=true` emite plantilla literal + cita incidente + capas A/B + iteration-strategy. Con `existingDocs=false` NO emite la seccion.
- CLAUDE.md template: misma logica replicada.
- Pipeline: ambas skills propagan a archivos de agente generados.
- Bidireccional sync: `used_by` <-> `role.skills` consistente.

Suite total: **515 tests** pasando (era 492), typecheck + validate OK, **82 skills** (era 80).

### Documentation

- `docs/iteration-strategies.md` (nuevo): incidente que lo motivo, las 3 capas, las 4 estrategias con cuando aplicarlas, estructura `docs/` segun cada estrategia, como aplicar a un proyecto existente, como añadir mejoras a futuro.
- `README.md` y `docs/README.md` actualizados con la referencia (6 guard rails ahora visibles).

### Recovery aplicada al proyecto Abax-Memory v1 (no parte del package)

Capa 1 ejecutada el 2026-05-03 12:13:
- Drafts v2 preservados en `docs/.archive/v2-draft-2026-05-03/` (no perder trabajo del BA).
- v1 restaurado al working tree desde `HEAD` (los overwrites no estaban commiteados).
- `docs/iteration-log.md` creado con narrativa del incidente y decision pendiente sobre estrategia (A/B/C/D) para v2.

## [0.1.25] — 2026-05-03

### Fixed — Mix de espanol/ingles en identificadores de codigo (sintoma reportado por usuario)

Sintoma del usuario: *"variables endpoints parametros deben estar siempre en ingles, me ha dado un mix en algunos escenarios que no debe volver a suceder"*. Causa raiz: tres skills que los agentes leen tenian ejemplos en espanol que contradecian la regla declarada en CLAUDE.md, y el agente internalizaba que era aceptable mezclar.

Las fuentes corregidas:
- `coding-standards`: clases como `OrdenCompra`/`UsuarioServicio`, variables `cantidadItems`/`fechaCreacion`, constantes `MAX_INTENTOS`/`TIMEOUT_SEGUNDOS` → ahora `Order`/`UserRepository`/`PaymentService`, `itemCount`/`createdAt`/`totalAmount`, `MAX_RETRIES`/`TIMEOUT_SECONDS`/`DEFAULT_PAGE_SIZE`. Cita la nueva skill `code-naming-convention`.
- `backend-implementation`: endpoints `/api/v1/usuarios`, `/api/v1/ordenes` → `/api/v1/users`, `/api/v1/orders` con path params en ingles.
- `unit-testing`: `calcularDescuento_montoMayorA1000_retorna10Porciento` → `calculateDiscount_amountOver1000_returns10Percent`.

### Added — Skill `code-naming-convention` (5to guard rail)

Nueva skill no-negociable con tabla exhaustiva de identificadores que deben estar en ingles (clases, funciones, variables, constantes, endpoints REST, query/path params, headers HTTP custom, tablas y columnas SQL, env vars, claves JSON/YAML, branches git, archivos de codigo, tests, imagenes Docker, topicos Kafka, metric/log keys). Documenta 4 categorias de excepciones legitimas (terminos de dominio sin traduccion como RUC/CURP, BD legacy con tablas en espanol, APIs publicas con consumidores existentes, error codes vs messages). Incluye guidance por stack (TypeScript/Java/Python/Go/Rust/SQL/YAML), patrones de busqueda regex para auditar codebases existentes, y formato estandar para documentar excepciones en `docs/decisions/`. Wired a 8 roles que escriben/revisan codigo: developer-backend, developer-frontend, dba, tech-lead, solution-architect, integration-architect, security-architect, qa-automation.

### Added — Test guard automatizado

`tests/integration/code-naming-convention.test.ts`: escanea TODOS los YAMLs de `data/` buscando dos patrones de mezcla: identificadores backtick-quoted que combinan verbos/nombres espanoles con camelCase/PascalCase, y URLs reales (con prefijo `/api/v\d/` o despues de un verbo HTTP) cuyo segmento es nombre espanol plural tipico. Falla CI con reporte exacto archivo:linea + sugerencia. EXEMPT_FILES con 2 entradas legitimas (`code-naming-convention.yaml` con ejemplos negativos pedagogicos, `role-boundaries.yaml` con placeholders espanoles). Sentinel test sintetico verifica que el regex no produce falsos positivos sobre ejemplos canonicos en ingles. Sanity test confirmado: inyectando `GET /api/v1/usuarios/{userId}` en `api-design.yaml`, el guard fallaba; al restaurar, volvia a verde.

### Changed — README del repo Abax-Swarm

Reescrito siguiendo mejores practicas: badges al inicio (npm version, downloads, CI, tests, license, Node), TL;DR de 3 frases + 3 comandos quickstart, tabla de contenidos navegable, seccion **"Por que Abax Swarm"** con 5 patrones problematicos y como cada guard rail los evita, **Casos de uso comunes** que enlazan a docs/use-cases.md, **Estado del proyecto**, **Soporte y comunidad** con FAQ, recursos completos. Numeros actualizados: 492 tests (era 446), 80 skills (era 76), 14 stacks (era 13).

### Changed — CLAUDE.md sección Conventions

Regla de naming explicita y exhaustiva en una sola linea con referencia a la skill, el guard rail y el doc nuevo.

### Documentation

- `docs/code-naming.md` (nuevo): sintoma reportado, causa raiz, las 5 piezas de la respuesta (skill nueva + 3 skills corregidos + guard rail), 4 excepciones documentadas con ejemplos de codigo, como detectar mezclas en codebases existentes, coordinacion con guard rails existentes.
- `README.md` y `docs/README.md` actualizados con la referencia.

### Tests

Suite total: 492 tests pasando (era 476), typecheck + validate OK, 80 skills (era 79), 14 stacks (sin cambios).

## [0.1.24] — 2026-05-02

### Added — 3 skills coordinadas para que los agentes generen documentacion consistente en proyectos cliente

Hueco detectado: ningun skill ni guia sistematica existia para el `README.md` ni para la estructura general de la carpeta `docs/` que los agentes producen dentro de los proyectos cliente. Cada agente improvisaba — terminaba en READMEs de 30 lineas sin quickstart, o `docs/` planos con 30 archivos sueltos, o `TODO: completar esto` sin owner que envejecia para siempre.

3 skills nuevas coordinadas:

- **`project-readme`** — Como generar el `README.md` del proyecto cliente: 4 preguntas fundamentales (que es, por que importa, como pruebo en 2 min, donde aprendo mas), 18 secciones estandar, 10 reglas no-negociables (cada comando ejecutable, sin TODO sin owner, versiones explicitas, sin lenguaje promocional vacio), adaptacion por modo (`new`/`document`/`continue`) y por stack tecnologico (incluido `legacy-other`). 4 plantillas listas (modo new, modo document, stack legacy, checklist pre-commit). Wired a tech-writer + developer-backend + developer-frontend + tech-lead.
- **`documentation-quality-bar`** — Los 8 minimos no-negociables que cualquier doc generado debe cumplir antes de marcarse completado: frontmatter de procedencia, comandos validados (no inventados), sin TODO sin owner, links relativos validados, bloques de codigo etiquetados con lenguaje, glosario si tiene >=3 acronimos, indice si > 200 lineas, idioma consistente. Checklist obligatorio + 3 guides (validacion de comandos, ejemplos de frontmatter por tipo de doc, auditoria rapida de gaps). Wired a 9 roles que producen documentacion.
- **`project-documentation-structure`** — Estructura estandar de `docs/` en proyectos cliente: subcarpetas (`architecture`, `api`, `runbooks`, `user-guides`, `functional`, `deliverables`, `decisions`, `presentations`), indices intermedios obligatorios, convenciones de naming (kebab-case sin tildes, ADRs numerados NNNN), alineacion con MkDocs nav. Adaptacion por modo. 2 guides (skeleton script para generar arbol inicial, formato ADR estandar). Wired a tech-writer + tech-lead + solution-architect + business-analyst + devops.

### Added — Entregables nuevos en fase 4 (Construccion)

- **`project-readme`** (mandatory) — el README.md del proyecto cliente. Responsable: tech-writer. Approver: tech-lead.
- **`docs-structure-skeleton`** (mandatory) — el esqueleto inicial de `docs/` con README placeholders. Responsable: tech-writer. Approver: tech-lead.

Ambos bloquean la salida de fase 4 si no estan generados — los demas entregables de docs (api-documentation, runbook, etc.) los llenan con contenido a lo largo del proyecto.

### Added — Tests integrales

30 nuevos tests en `tests/integration/project-documentation.test.ts`:
- Skill `project-readme`: 4 preguntas fundamentales, 18 secciones, 10 reglas, adaptacion por modo, guidance legacy-other, 4 plantillas, wiring.
- Skill `documentation-quality-bar`: 8 minimos enumerados, checklist, conexion con role-boundaries, wiring a 9 roles, 3 guides.
- Skill `project-documentation-structure`: arbol estandar, naming + indexing, adaptacion por modo, MkDocs nav, 2 guides, wiring a 5 roles.
- Phase deliverables: project-readme + docs-structure-skeleton mandatorios en fase 4.
- Pipeline: las 3 skills propagan a archivos de agente generados, archivos `SKILL.md` se crean en `.opencode/skills/<id>/`.
- Modo document + legacy-other: las skills llegan al tech-writer del equipo curado.
- Guard rail: bidireccional sync entre `used_by` y `role.skills`.

Suite total: 476 tests pasando (era 446), typecheck + validate OK, 79 skills (era 76).

### Documentation

- `docs/project-documentation.md` (nuevo): describe el subsistema completo — por que existe, las 3 skills, las 4 preguntas del README, estructura `docs/` estandar, los 8 minimos, entregables nuevos, coordinacion con guard rails existentes, como añadir mejoras a futuro.
- `README.md` y `docs/README.md` actualizados con la referencia.

## [0.1.23] — 2026-05-02

### Added — Stack `legacy-other` + deteccion de PHP / Java desktop / VB6 + fix de fallback silencioso

El wizard tenia un bug latente: cuando el detector no reconocia el stack y el usuario presionaba "Continuar sin stack adapter", se asignaba **`angular-springboot`** silenciosamente. En modo `document` sobre un sistema legacy (Java Swing, VB6, PHP clasico, Cobol, Delphi), los agentes recibian prompts adaptados a Spring Boot y documentaban "controllers REST" sobre `JFrame` listeners o forms .frm — equivalente al incidente Abax-Memory pero en la capa de documentacion.

Tres piezas coordinadas:

- **Stack `legacy-other`** (`data/stacks/legacy-other.yaml`): placeholder con `role_context` cauteloso para los 12 roles tecnicos. Cada uno recibe instrucciones adaptadas a su disciplina diciendo: *NO asumas patrones modernos, INFIERE convenciones del codigo existente, REPORTA al orquestador antes de aplicar comandos modernos*. Sumado a `stack_overrides` consistentes en los 12 roles (ahora todos con 14 stacks completos).
- **3 detectores nuevos** (`src/engine/stack-detector.ts`):
  - **PHP**: `composer.json` con framework conocido (Laravel/Symfony/CakePHP/CodeIgniter/Yii/Slim) o sin framework, o archivos `.php` sueltos sin composer.
  - **Java desktop**: `pom.xml`/`build.gradle` con JavaFX/Swing/MigLayout/FlatLaf y SIN spring-boot/quarkus/micronaut, o archivos `.java` importando `javax.swing`/`java.awt`/`javafx.*` (escaneo bounded a 50 archivos top-level + Maven `src/main/java` layout).
  - **VB6**: archivos `.vbp` (proyecto), `.frm` (forms), o combinacion `.bas`+`.cls` en raiz.
  - Los 3 mapean a `stackId: "legacy-other"` con evidencia descriptiva. Estan al **final** de `RULES` para que stacks modernos ganen cuando coexistan.
- **Fix del fallback silencioso** (`src/cli/WizardApp.tsx`): la opcion "Continuar sin stack adapter" se reemplaza por "Usar Stack legacy o no soportado" (apuntando a `legacy-other`). Si el detector no encuentra match, el wizard recomienda explicitamente la opcion legacy con texto "Si tu sistema es Java desktop, VB6, PHP clasico, Cobol, Delphi, etc.".

### Added — Tests integrales

- 26 nuevos tests en `tests/integration/legacy-stack.test.ts`:
  - Stack catalog: existencia, `role_context` para 12 roles, descripcion explicita.
  - Detector: PHP (4 variantes), Java desktop (4 variantes incluyendo regresion para Spring Boot/Quarkus), VB6 (3 variantes), prioridad de modernos, ausencia de signals.
  - Pipeline: `runSelection`/`runPipeline` con `legacy-other` no crashean, agentes generados contienen el contexto cauteloso, funciona en modo `document`.
  - Stack adapter: merge aditivo de `stack_overrides` + `role_context`, no muta el rol original.
  - Regresion: el codigo fuente de `WizardApp.tsx` ya NO mapea `__none__` a `angular-springboot` (test sentinel que lee el archivo).

Suite total: 446 tests pasando (era 420), typecheck + validate OK, 14 stacks (era 13).

### Documentation

- `docs/legacy-stacks.md` (nuevo): bug que lo motivo, descripcion de las 3 piezas, ejemplos de prompts cautelosos por rol, criterios de deteccion, justificacion de mapear a `legacy-other` en lugar de crear stacks por cada legacy, como añadir mas detectores en el futuro.
- `README.md` y `docs/README.md` actualizados con la referencia.

## [0.1.22] — 2026-05-02

### Added — 3 guard rails adicionales para reglas con riesgo de dilucion

Mismo patron que la guard rail de `role-boundaries` (0.1.21): tests que recorren todos los roles en `data/roles/` y exigen que cada uno cumpla una regla sistemica O este en una lista de exencion documentada. Aplicado a tres reglas mas:

- **Anti-mock rule en developers** (incidente Abax-Memory, 0.1.19) — todo rol cuyo `id` empieza con `developer-` o cuya `category` es `construction`/`data` con `bash != "deny"` debe embeber `REPLACE_BEFORE_PROD`, "incidente Abax-Memory" y "Regla anti-mock" en su `system_prompt`. Previene que un futuro `developer-mobile`/`-ml`/`-api` regrese el patron `InMemorySearchIndexer`.
- **`git-collaboration` skill en roles con bash** (flujo distribuido, 0.1.16) — todo rol con `bash: allow|ask` debe declarar la skill o estar exento. 4 exenciones documentadas: `qa-functional`, `qa-automation`, `qa-performance` (ejecutan tests, reportan via write/edit), `system-designer` (meta-rol del proyecto Abax Swarm). Previene que un rol nuevo con bash haga commits a `main` sin la convencion `abax/<project>` + `--author`.
- **`stack_overrides` completos** — cada rol con bloque `stack_overrides` debe tener entrada para cada uno de los 13 stacks en `data/stacks/`. Previene que añadir un stack `#14` deje silenciosamente sin contexto a los 12 roles tecnicos. Tambien atrapa referencias a stacks que no existen.

5 nuevos tests en `tests/integration/role-guards.test.ts` (419 totales, era 414).

### Changed

- `docs/guides/adding-roles.md` §2b nuevo con las 3 reglas + criterios de exencion.
- `CLAUDE.md` paso 6 en "When modifying YAML data" recuerda los 3 guards al asistente.

## [0.1.21] — 2026-05-02

### Added — Guard rails para que role-boundaries no se diluya con futuros roles

El test `every role is classified` recorre TODOS los roles en `data/roles/` y exige que cada uno este en `used_by` de la skill role-boundaries **o** en la constante `EXEMPT_FROM_ROLE_BOUNDARIES` del test, con razon documentada. Anadir un rol nuevo sin clasificarlo falla CI antes de release.

- 3 roles añadidos a `used_by` y a sus `skills:` (`qa-lead`, `integration-architect`, `change-manager`) — la matriz maestra ya los mencionaba implicitamente como masters de actividades especificas.
- 4 roles marcados explicitamente como exentos con razon: `orchestrator` (no recibe Tasks), `project-manager` (coordinador puro), `ux-designer` (design-only handoff), `system-designer` (meta-rol del proyecto Abax Swarm).
- 4 nuevos tests guard: clasificacion exhaustiva, exclusion mutua, sincronia bidireccional skill↔rol, sanity check inverso para exentos.

### Changed

- `docs/guides/adding-roles.md` §2 nuevo: rubrica con 4 criterios para clasificar un rol nuevo + procedimiento paso a paso.
- `CLAUDE.md` (paso 5 en "When modifying YAML data"): recuerda al asistente la regla antes de empezar.
- `docs/role-boundaries.md`: lista expandida (16 roles) + tabla de 4 exentos + seccion "Como evitar que esto se repita con futuros roles".
- Suite: 414 tests pasando (era 407), typecheck + validate OK, 76 skills (sin cambios).

## [0.1.20] — 2026-05-02

### Added — Limites de rol y reglas de rechazo

Motivado por el incidente de la sesión `ses_21576ae3b...`: el orquestador delegó a `@devops` una Task que decía *"redespliega y reejecuta QA"*. Devops cumplió con sesgo operacional ("responde HTTP 200 → done") y declaró el ciclo cerrado sin aplicar el rigor de qa-functional (criterios de aceptación, registro de defectos). Una sola Task colapsó dos disciplinas. Tres mecanismos coordinados de defensa:

- **Skill compartida `role-boundaries`** asignada a 13 roles con riesgo de solapamiento (`devops`, `qa-functional`, `qa-automation`, `qa-performance`, `developer-backend`, `developer-frontend`, `dba`, `tech-lead`, `business-analyst`, `product-owner`, `solution-architect`, `security-architect`, `tech-writer`). Contiene la matriz maestra por fase, los 8 pares críticos de no-solapamiento, anti-patrones, y el patrón estricto de rechazo (`RECHAZO DE TAREA — fuera de mi rol`) con plantilla exacta.
- **Sección nueva en orchestrator template** (OpenCode + Claude): "Matriz de responsabilidades técnicas por fase (anti-cross-role)" que enuncia el rol maestro de cada fase con sus anti-patrones, gateada por `mode !== "document"` (no aplica al modo documentación porque sus 4 ejes trabajan en paralelo). Cada fila se renderiza condicionalmente solo si los roles correspondientes están en el equipo.
- **Regla 2-Tasks post-fix** en el mismo bloque: cuando QA reporta defecto, el orquestador SIEMPRE delega dos Tasks separadas (`@developer-*` para fix → SHA → `@qa-functional` para re-ejecutar). Se renderiza solo si tanto qa-functional como developer-backend están presentes.

### Added — Tests

- `tests/integration/role-boundaries.test.ts`: 31 tests cubriendo contenido del skill, wiring a los 13 roles, emisión condicional en modos `new` / `continue` / `document`, gating por roles presentes, validación de @-mentions out-of-team, edge cases de equipo pequeño y orphan handlebars.
- Suite completa: 407 tests pasando (era 376), typecheck limpio, validate Zod OK.

### Changed

- `data/skills/` ahora tiene 76 archivos (era 75).
- 13 roles declaran el nuevo skill `role-boundaries` en su lista `skills:`.

### Documentation

- `docs/role-boundaries.md` (nuevo): incidente motivador, matriz maestra completa, 8 pares críticos, plantilla exacta de rechazo, regla 2-Tasks post-fix, gating por modo.
- `docs/README.md` y `README.md` actualizados con la referencia.

## [0.1.19] — 2026-05-02

### Added — 3 capas anti-mock

Motivado por el incidente Abax-Memory (sesión `ses_216175a25ffe...`): un backend con `regex` disfrazada de IA y un `InMemorySearchIndexer` en lugar de Qdrant pasó los 7 entregables de Construcción, QA, UAT, y llegó al borde del despliegue sin que ningún control lo detectara. Tres capas independientes de defensa, ahora obligatorias:

- **Capa 1 — Prevención en developers**: nueva sección "Regla anti-mock" en `system_prompt` de `developer-backend`, `developer-frontend` y `dba`. Cita el incidente por nombre y fecha. Obliga a escalar al orquestador cuando falta credencial/dependencia, y a marcar mocks temporales con `// MOCK: <razon> // REPLACE_BEFORE_PROD`.
- **Capa 2 — Skill nuevo `anti-mock-review`** asignado a `tech-lead`. Flujo de 6 pasos: inventario de integraciones declaradas, dependencias declaradas vs imports reales, escaneo de keywords sospechosos (`InMemory*`/`Mock*`/`Fake*`/`Stub*`/`Dummy*`/`regex.*match` en código no-test), instanciación real de clientes externos, reporte estructurado, comunicación al orquestador. Incluye guides por stack (Java/TS/Python/Go/Rust) y criterios de mock temporal aceptable.
- **Capa 3 — Entregable bloqueante `feature-spec-compliance`** como **ÚLTIMO** entregable de fase 4 (Construcción). Responsable: `business-analyst` (NO desarrollador, NO tech-lead — alguien externo al equipo de implementación). Approver: `product-owner` (consulta al sponsor para integraciones críticas). Bloqueante: el orchestrator no delega QA hasta que esto esté aprobado. Output: matriz `feature de spec → archivo → REAL/MOCK/NO_IMPL → evidencia`.
- **Sección nueva en orchestrator template** (OpenCode + Claude): "Protocolo de cierre de fase Construccion (3 capas anti-mock)" que enuncia explícitamente las 3 capas, las cita por nombre y bloquea el avance a QA.

### Added — Tests

- 15 nuevos integration tests en `tests/integration/quality-gates.test.ts` cubriendo cada capa individualmente + un end-to-end que valida que las 3 capas están consistentes en un proyecto medium generado.
- Lint, typecheck, validate Zod: todo verde. 376 tests en la suite unit/integration + 1 E2E.

### Changed

- `data/skills/` ahora tiene 75 archivos (era 74).
- `tech-lead` declara skill nuevo: `anti-mock-review`.
- `developer-backend`, `developer-frontend`, `dba` system_prompts ampliados con regla anti-mock.

### Documentation

- `docs/quality-gates.md` (nuevo): incidente que lo motivó, descripción detallada de las 3 capas, por qué BA en Capa 3, cómo cambiar la rúbrica, limitaciones conocidas.
- `docs/README.md` actualizado con la referencia.

## [0.1.18] — 2026-05-02

### Added

- **Bloqueante de planificación de despliegue al inicio de fase 7** con aprobación explícita del usuario sponsor. Resuelve el caso reportado: el orchestrator avanzaba a Estabilización sin haber preguntado dónde se publicaba el sistema, con qué dominio, ni cómo se monitorizaba.
  - Nuevo skill `deployment-planning` con rúbrica de **12 preguntas** (dónde, cómo, **URL pública + dominio**, DNS+TLS, exposición, secrets, monitoring, rollback, backup, comunicación, compliance, SLO/SLA) + tabla de aplicabilidad por tipo de servicio (web, API, mobile backend, batch, interno) + checklist pre-go-live.
  - Asignado a `devops`, `project-manager`, `solution-architect`, `security-architect`.
  - `deployment-plan-doc` en `phase-deliverables.yaml` cambia approver de `tech-lead` → `product-owner` (que **debe consultar al sponsor explícitamente**).
  - Sección nueva en orchestrator template (OpenCode + Claude): "Protocolo de inicio de fase Despliegue" — bloquea avance hasta aprobación textual del sponsor en chat.
- **Publicación automática de presentaciones a GitHub Pages**:
  - Nuevo `src/generator/pages-generator.ts` emite `.github/workflows/pages.yml` cuando el team usa `presentation-design`.
  - El workflow auto-detecta `mkdocs.yml` (modo `document` → `mkdocs build`) o publica `docs/` directamente como sitio estático.
  - Trigger: `push` a `main` + `workflow_dispatch`. Concurrency `pages` con `cancel-in-progress: false` (los pushes consecutivos se encolan, ninguno se cancela mid-deploy).
  - Setup único: el usuario habilita Pages en `Settings → Pages → Source: GitHub Actions`. A partir de ahí, cada presentación generada y commiteada por el flujo distribuido se publica automáticamente.
- **Audit anti-solapamiento de roles para presentaciones**:
  - El skill `presentation-design` se amplió con `product-owner`, `tech-lead` y `qa-lead` en `used_by` (estaban en la rúbrica pero faltaban en el wiring — bug detectado por el audit).
  - Esos 3 roles ahora declaran el skill en sus YAMLs.
  - Test nuevo `tests/integration/deployment-pages.test.ts` ejecuta dos audits automáticos: (1) cada responsabilidad en la tabla del skill está correctamente wireada en `used_by` + role.skills; (2) ningún par `(fase, presentación)` aparece duplicado.
- **17 tests nuevos** cubriendo skill, wiring, blocker en fase 7, orchestrator template (ambos targets), workflow YAML válido, branching mkdocs/static, audits.

### Documentation

- `docs/deployment-planning.md` (nuevo): rúbrica completa, plantilla del entregable, checklist pre-go-live, quién hace qué, cómo cambiar la rúbrica.
- `docs/presentation-publishing.md` (nuevo): workflow GitHub Pages, setup único, audit anti-solapamiento, cómo cambiar asignación de presentaciones, limitaciones conocidas.
- `docs/README.md` actualizado con las dos referencias nuevas.

### Internal validation

- Smoke test de 5 escenarios + 2 audits, todos verde (28 checks).
- E2E del wizard sigue verde (4s).
- Lint, typecheck, validate Zod: todo verde. 363 unit/integration tests pasan + 1 E2E + smoke.

## [0.1.17] — 2026-05-02

### Documentation

- 3 docs sincronizados con el flujo git distribuido de 0.1.16:
  - `docs/architecture.md`: skills count actualizado de 71 a 73 (incluye `dependency-management` y `git-collaboration`); tabla de "Project modes" describe el flujo distribuido en lugar de la versión "suggest-only"; tabla de templates incluye los nuevos vars del context (`hasDevops`, `envVerificationLead`).
  - `docs/data-model.md`: skills count actualizado a 73, mención del nuevo skill `git-collaboration`.
  - `docs/permissions.md`: nueva nota cruzada explicando que `git *: allow` + `git push --force *: deny` están diseñados específicamente para soportar el flujo distribuido.

## [0.1.16] — 2026-05-02

### Changed

- **Flujo git distribuido y ejecutado, no sugerido** (cambio de comportamiento respecto a 0.1.14):
  - Antes: cuando había `.git/`, el orquestador emitía un comando `git add ... && git commit ...` para que el usuario lo ejecutara manualmente. Push nunca se ejecutaba.
  - Ahora: cada agente técnico (5 roles) **commitea su propio entregable** después de escribirlo, con `git add <archivo-específico>` (nunca `.`/`-A`) + `git commit --author "<rol> <rol@abax-swarm>"`. Al cierre de cada fase, el orquestador delega exactamente una Task a `@devops` (o `@tech-lead` fallback): "haz `git push` de la fase". El orquestador **sigue siendo coordinador puro** (`bash: deny` intacto), no toca git directamente.

### Added

- **Nuevo skill `git-collaboration`** asignado a tech-lead, devops, developer-backend, developer-frontend y dba. Define: creación idempotente de rama `abax/<project-name>` al primer commit (si la actual es `main`/`master`/`trunk`), commits granulares con autoría del rol, push centralizado por devops al cierre de fase, manejo de errores (auth, branch protection, non-fast-forward, rate limit, conflicts).
- **Nuevo doc [`docs/git-collaboration.md`](docs/git-collaboration.md)** con la tabla quien-hace-que, política de naming de rama, anti-patrones bloqueados, manejo de errores, combinación con modos de permisos.
- **8 tests nuevos** verificando: skill existe + 5 roles lo declaran + instructions cubren branch/author/push/anti-patterns; orchestrator template emite la nueva instrucción distribuida cuando `hasGit`; fallback a tech-lead cuando no hay devops; sección omitida cuando `hasGit === false`; ambos targets (OpenCode + Claude).

### Documentation

- README actualizado: la frase sobre "sugiere un commit" ahora describe el flujo ejecutado, distribuido, con rama `abax/<project>` creada automáticamente.
- `docs/guides/orchestrator-flow.md` sección "Per-phase commit protocol" reescrita.
- `docs/README.md` actualizado con nuevas referencias (permissions, dependency-management, dev-environments, git-collaboration) y screenshot count corregido (6, no 5).

## [0.1.15] — 2026-05-02

### Added

- **Test E2E del wizard** (`tests/e2e/wizard-flow.test.ts`): spawnea el binario real `node dist/cli/app.js init --dry-run` dentro de un PTY (`node-pty`), escribe teclas sintéticas y verifica el output renderizado por Ink. Cubre los 12 steps del flujo completo modo `new` con defaults — incluye los nuevos pasos `permissions` y `isolation` añadidos en 0.1.14. Detecta regresiones que `ink-testing-library` no puede (comportamiento real de teclado, transiciones de step, sidebar dinámico).
- Nuevo script `npm run test:e2e` que builda y corre solo el E2E. Separado de `npm test` para mantener CI rápido. Tiempo total: ~5s.
- `node-pty@^1.1.0` añadido a `devDependencies`.

### Documentation

- CONTRIBUTING.md: la sección "Antes de tagear un release" ahora menciona que el E2E vive aparte y se corre con `npm run test:e2e` cuando se modifica el wizard.

## [0.1.14] — 2026-05-02

### Added

- **3 modos de permisos para OpenCode**, configurables en un nuevo step del wizard:
  - `strict`: comportamiento de hoy (sólo permission por agente).
  - `recommended` (default): allowlist de comandos comunes (git, npm, mvn, pip, etc.) y denylist de operaciones peligrosas (`git push --force`, `rm /var/*`, `rm /var/lib/dpkg/*`, `chmod 777`, `curl|sh`). **Container-aware**: `apt`/`dpkg`/`sudo` están en `ask` cuando el aislamiento es `host` y pasan a `allow` automáticamente cuando es `devcontainer`.
  - `full`: `"permission": "allow"` raíz, sin restricciones, con banner de advertencia en el wizard.
- **Aislamiento del entorno de desarrollo**, nuevo step del wizard con 2 opciones:
  - `devcontainer` (default): genera `.devcontainer/devcontainer.json` con features según el stack (Java+Maven, Node, Python, Go, Rust, .NET, Flutter). Marca el container con `ABAX_ISOLATED=1` para que el detector lo reconozca en runtime.
  - `host`: trabaja directamente en el SO principal; los agentes usan gestores de versión del usuario (sdkman, nvm, pyenv, rustup) y nunca `sudo apt`.
- **Skill nuevo `dependency-management`** asignado a tech-lead, devops, developer-backend, developer-frontend y dba. Define el flujo de 6 pasos para verificar runtime, declarar dependencias en el manifest del stack, instalar con aprobación del usuario (sin destructive remediation), verificar build vacío, documentar setup local en `docs/setup.md`. Incluye tabla de comandos por stack.
- **Entregable bloqueante `env-verification`** al inicio de la fase Construcción (`phase-deliverables.yaml`). El orchestrator no delega ningún otro entregable de Construcción hasta que esté completado y aprobado. Resuelve el incidente que motivó este release: agentes intentando builds sin runtime instalado.
- **Detector de container** (`container-detector.ts`): `/.dockerenv`, `/run/.containerenv`, `/proc/1/cgroup`, `$ABAX_ISOLATED`. Pure module, no I/O fuera de readFileSync.
- Nuevos docs: `docs/permissions.md` (3 modos + el incidente que los motivó), `docs/dependency-management.md` (skill + entregable + protocolo), `docs/guides/dev-environments.md` (devcontainer vs host, cómo arrancar, alternativas).
- **20 tests nuevos** cubriendo los 3 modos de permisos, devcontainer per-stack, container-detector, cross-references del skill, blocker en phase-deliverables, sección del orchestrator template.

### Changed

- Orchestrator template (OpenCode + Claude) incluye nueva sección "Protocolo de inicio de fase Construcción" que fuerza el entregable `env-verification` antes que cualquier otro de Construcción y referencia el skill `dependency-management`.
- 5 roles (tech-lead, devops, developer-backend, developer-frontend, dba) ahora declaran el skill `dependency-management`.
- `ProjectConfig` admite `permissionMode` e `isolationMode`. Se persisten en `project-manifest.yaml > project.permission_mode/isolation_mode` y se respetan en `regenerate`.
- Capturas regeneradas reflejando los 2 nuevos steps.

### Fixed

- Mitigación al incidente real `ses_217c43466ffe...` (mayo 2026): un agente devops intentando `mvn install` sin Java instalado terminó ejecutando `rm -f /var/lib/dpkg/lock-frontend && dpkg --configure -a` para forzar la instalación. Con modo `recommended` ese comando ahora está en `deny` explícito; con devcontainer no aplica porque apt-get es seguro adentro.

## [0.1.13] — 2026-05-02

### Documentation

- `CONTRIBUTING.md` ampliado de 73 a 236 líneas con dos guías nuevas para futuros contribuyentes:
  - **"Documentar cambios"**: tabla con qué docs tocar según el tipo de cambio (wizard, schemas YAML, módulos engine/generator, orchestrator, features grandes), formato del `CHANGELOG.md` (Keep a Changelog), pautas de redacción de bullets, criterios de versionado en 0.x.y, checks obligatorios pre-release.
  - **"Regenerar las capturas de pantalla"**: requisitos (`tmux` + `freeze`), instalación de `freeze` desde GitHub release, ejecución del script, cuidados al modificarlo (TextInput pre-llenado con `process.cwd()` requiere Backspaces en chunks; `Ctrl-U` no funciona en `ink-text-input`; sleeps generosos para que ink procese), verificación visual.
- Sección de Releases ampliada: orden recomendado (bump + CHANGELOG en el mismo PR de la última feature), requisito de `NPM_TOKEN` con bypass 2FA, troubleshooting para fallos comunes (`skipped`, `403`, `tag already exists`).

## [0.1.12] — 2026-05-02

### Fixed

- `Header.tsx` reportaba `Abax Swarm · v0.1.1` (cadena hardcodeada). Ahora la versión se lee dinámicamente del `package.json` igual que `--version` (fix paralelo al de `app.ts` en 0.1.6).

### Documentation

- README ampliado con: tabla de los 3 modos de proyecto, mención de model-strategy / inherit, agent colors, sistema de presentaciones HTML, regla de glosario al cierre, y nueva captura del paso "Modo de proyecto".
- `docs/architecture.md` actualizado: capa de detectores (`stack-detector`, `docs-detector`, `git-detector`, `project-context`), generador `docs-site-generator`, `color-resolver`, nueva sección de "Project modes", governance `documentation`, plantilla `design-system/`.
- `docs/data-model.md` actualizado: `agent.color` y `cognitive_tier`/`reasoning` en role schema, `document-mode.yaml`, runtime types (`ProjectMode`, `ModelStrategy`, `ProjectContextDetection`), bump skills a 71.
- `docs/guides/orchestrator-flow.md` extendido: flujo de modo documentación (5 fases, 4 ejes), protocolo de actualización de docs existentes, protocolo de commits por fase, regla de glosario.
- `docs/README.md` reordenado: añadidas referencias a `model-mix.md` y `agent-colors.md`.
- `scripts/capture-screenshots.sh` actualizado para reflejar el wizard de v0.1.11 (paso `project-mode` añadido, `model-strategy`, banner v0.1.12 leído dinámicamente). Genera 6 PNGs en vez de 5.
- 6 capturas regeneradas (anteriormente eran 5 y mostraban `v0.1.1`).

## [0.1.11] — 2026-05-01

### Added

- **Modos de proyecto** — el wizard ahora pregunta al inicio qué quieres hacer:
  - **Implementar algo nuevo** (`new`): flujo cascada completo (sin cambios respecto a versiones previas).
  - **Documentar algo existente** (`document`): equipo curado de 9 roles fijos (tech-writer, business-analyst, product-owner, solution-architect, tech-lead, dba, integration-architect, ux-designer, change-manager) + security-architect opcional. Cubre 4 ejes: técnico, funcional, negocio, operativo. Flujo de 5 fases (`discovery → inventory → documentation → review → publication`) en vez de la cascada de 10. Genera scaffold MkDocs Material (`mkdocs.yml`, `requirements.txt`, `docs/index.md` + seeds por fase) listo para ejecutar `mkdocs serve`.
  - **Continuar / partir de proyecto previo** (`continue`): detector ejecuta sobre el `targetDir` y muestra al usuario el stack detectado para que elija mantener o cambiar. Si no detecta ninguno conocido, muestra evidencia parcial y ofrece elegir manualmente o continuar sin stack adapter.
- Nuevo skill `reverse-engineering` (en `data/skills/`): instrucciones detalladas para inventariar componentes, extraer reglas de negocio del código, identificar gaps y verificar contra runtime. Asociado a tech-lead, solution-architect, business-analyst, dba, integration-architect y tech-writer.
- Nuevo módulo `src/engine/stack-detector.ts` con 13 heurísticas (Next.js, Nuxt, NestJS, Astro+Hono, Expo, Spring Boot, Quarkus, FastAPI, Django, Fiber, Axum, Flutter, Blazor) + detección de evidencia parcial cuando no hay match.
- Nuevos detectores `docs-detector.ts` (busca `docs/*.md` recursivo) y `git-detector.ts` (busca `.git/`).
- Sección **"Protocolo de actualización de documentación existente"** en el orchestrator: si detectamos `docs/` con `.md`, el orquestador delega "actualizar X" en vez de "crear X". Cada agente recibe la regla "leer primero, conservar estructura, modificar solo lo cambiado".
- Sección **"Protocolo de commits por fase"** en el orchestrator: si detectamos `.git/`, al cierre de cada fase emite un bloque `git add docs/<fase>/ && git commit -m "docs(<fase>): ..."` listo para que el usuario ejecute. **No ejecuta commits automáticamente** (orchestrator tiene `bash: deny` por diseño); es una sugerencia.
- Tests: 19 unit del detector de stack (13 fixtures + caso desconocido) + integration de modo document, MkDocs scaffold, secciones condicionales del orchestrator.

### Changed

- 6 roles (tech-lead, solution-architect, business-analyst, dba, integration-architect, tech-writer) ahora declaran el skill `reverse-engineering` para el modo `document`.
- `ProjectConfig` admite `mode: "new" | "document" | "continue"` y `detection: ProjectContextDetection` (flags hasGit, existingDocs, stackId detectado).
- Nuevo modelo de governance `documentation` (cuarto valor además de lightweight/controlled/corporate) con cierres editoriales en lugar de comités.

## [0.1.10] — 2026-05-01

### Added

- Cada agente generado (excepto el orquestador, que no escribe entregables) ahora incluye una **regla de Glosario al cierre** en su prompt:
  - Si un entregable usa **3 o más acrónimos / términos específicos** de la disciplina del rol (RACI, SLA, BPMN, OWASP, CI/CD, SLO, RTO/RPO, DDD, CQRS, etc.), el agente añade una sección final `## Glosario` con definiciones cortas (máx 7 términos, 1 línea por término).
  - Si todos los términos son de uso común, omite la sección.
  - Aplica también a presentaciones HTML (slide final con el glosario).
  - Objetivo: hacer los entregables comprensibles para usuarios no técnicos / no especialistas.
- Ambas plantillas de agente (OpenCode y Claude) llevan la misma regla.

## [0.1.9] — 2026-05-01

### Added

- Sistema de presentaciones funcional end-to-end:
  - Nuevo `templates/design-system/presentacion-template.html` (single-file, sin CDN) con los **3 presets visuales** del Design System: Corporate Minimal, Tech Editorial y Dark Premium. Incluye un slide deck de muestra navegable con switcher entre presets.
  - Nuevo generador `src/generator/design-system-generator.ts` que emite el template en `docs/design-system/presentacion-template.html` del proyecto destino cuando algún agente del equipo usa el skill `presentation-design`.
  - Aplica para ambos targets (OpenCode y Claude).

### Changed

- `data/tools/create-presentation.yaml` ahora **emite HTML autónomo single-file** (antes emitía Markdown, contradiciendo el skill rubric):
  - Nuevo arg `style` con valores `corporate-minimal | tech-editorial | dark-premium` (default: `corporate-minimal`).
  - Convierte el `content` Markdown del agente en `<section class="slide">` separados por `---`.
  - CSS de los 3 presets embebido (single-file, portable, imprimible).
  - Sin gradientes púrpura/rosa, sin gris puro, neutrales tintados — alineado con la rúbrica del skill.

### Fixed

- Eliminado el gap entre la rúbrica de `presentation-design` y la implementación: el archivo `docs/design-system/presentacion-template.html` que el skill y los agentes referenciaban **ya no es un dangling reference** — se entrega con cada proyecto generado.

## [0.1.8] — 2026-05-01

### Added

- Asignación determinista de color por agente para el TUI de OpenCode:
  - El **orquestador** siempre se pinta con `#dc143c` (crimson) — reservado en código y declarado explícitamente en `data/roles/orchestrator.yaml`.
  - Cada agente recibe un color de una **paleta curada de 24 hex vivos** (excluye el rango rojo) vía hash determinista del `role.id`. Mismo rol → mismo color en cada regeneración; agregar o quitar otros roles no afecta los colores de los existentes.
  - Override por rol disponible vía `agent.color` en el YAML (acepta hex con comillas o claves de tema: `primary`, `accent`, `success`, etc.).
  - Hex se emite siempre **entrecomillado** en el frontmatter para evitar [sst/opencode#17118](https://github.com/sst/opencode/issues/17118) (parser interpreta `#` como comentario sin comillas).
- Nuevo módulo `src/engine/color-resolver.ts` (puro) y nuevo doc `docs/agent-colors.md` con la paleta completa, política de asignación y patrón a seguir al crear roles nuevos.

## [0.1.7] — 2026-05-01

### Changed

- El paso 1 del wizard ("Directorio del proyecto") ahora pre-llena el input con `process.cwd()`, así basta con pulsar Enter para usar el directorio actual desde donde se ejecutó `abax-swarm init`. El usuario puede editarlo si quiere otra ruta.

## [0.1.6] — 2026-05-01

### Fixed

- `abax-swarm --version` reportaba `0.1.0` (cadena hardcodeada en `src/cli/app.ts` que nunca se sincronizó con los bumps 0.1.1 → 0.1.5). Ahora la versión se lee dinámicamente de `package.json` en runtime, así que nunca volverá a desincronizarse.

## [0.1.5] — 2026-05-01

### Added

- Nueva opción **"Heredar del default de mi configuración"** en el paso 3 del wizard ("Asignación de modelos"):
  - Cuando el usuario la elige, no se escribe `model:`, `thinking:` ni `reasoningEffort:` en el frontmatter de los agentes ni en `opencode.json`. OpenCode hereda del `model` raíz del workspace o del default global del usuario, y los subagentes heredan del primario que los invoca (vía oficial documentada).
  - Útil cuando el usuario final no tiene acceso a Opus / GPT-5; OpenCode no soporta fallback nativo de modelos ([sst/opencode#25150](https://github.com/sst/opencode/issues/25150)).
  - Si elige "inherit", el wizard salta el paso de proveedor.
  - La estrategia se persiste como `project.model_strategy` en `project-manifest.yaml` y se respeta en `abax-swarm regenerate`.
- Precarga de elecciones previas al actualizar una carpeta existente:
  - `init` sobre carpeta con `project-manifest.yaml` ahora precarga `target`, `provider` y `model_strategy` desde el manifest.
  - El bloque "Configuración existente" muestra plataforma y estrategia/proveedor previos.
  - `SelectInput` admite `initialValue` y posiciona el cursor en la opción anterior — basta Enter para conservarla.

### Documentation

- Sección nueva en `docs/model-mix.md` explicando `custom` vs `inherit` y cuándo usar cada una.

## [0.1.4] — 2026-05-01

### Added

- Expand/collapse del preview de archivos en el paso de Confirmación con tecla `E`.
- Selección fina de modelo por agente:
  - `cognitive_tier` (`strategic` / `implementation` / `mechanical`) y `reasoning` (`none` / `low` / `medium` / `high`) en cada rol YAML.
  - Nuevo paso 3 del wizard ("Proveedor de IA") para elegir Anthropic o OpenAI.
  - `src/engine/model-mapping.ts` traduce `(provider, tier, reasoning)` a un `ModelSpec` concreto.
  - `opencode.json` y el frontmatter de cada `.opencode/agents/*.md` ahora incluyen `model` y `thinking`/`reasoningEffort`.
  - El `project-manifest.yaml` registra el `provider` usado.
  - Confirm step muestra el mix sugerido agrupado por modelo.
- Tests: `ink-testing-library` para los componentes de la TUI, integration tests del mix de modelos. 257 tests en total.
- `npm publish` opcional en `release.yml` cuando `NPM_TOKEN` está configurado.

### Changed

- `tests/integration/e2e-interface.test.ts` ahora usa `mkdtempSync(tmpdir(), "abax-e2e-")` en vez de un path fijo `.tmp-e2e/`. `testTimeout` global subido a 15 s.

### Fixed

- Eliminados los 9 warnings de lint en `tests/` (renombrar `id` no usado a `_id`, etc.).
- Quitada la nota "may timeout under load, safe to retry" de CLAUDE.md ahora que el e2e es estable.

## [0.1.3] — 2026-05-01

### Changed

- README reescrito en español con tres rutas claras: usar rápido sin conocimiento técnico, personalizar (agregar roles propios), contribuir al código.

## [0.1.2] — 2026-05-01

### Added

- Captura del paso 7 (Confirmación) en el README.

### Changed

- TUI: el preview de archivos en el paso de Confirmación se compacta a 8 directorios × 4 archivos para que quepa con el sidebar en una pantalla de altura razonable.

## [0.1.1] — 2026-05-01

### Added

- Reescritura completa del wizard (`abax-swarm init`) con [Ink](https://github.com/vadimdemedes/ink):
  - Componentes: `TextInput`, `SelectInput`, `MultiSelectInput`, `ConfirmInput`, `RoleEditor`, `Spinner`, `Header`, `StepHeader`, `ProgressBar`, `Sidebar`, `InfoBox`.
  - Single-page Ink app (`WizardApp.tsx`) con state machine para los 7 pasos.
  - Layout en 2 columnas: paso activo a la izquierda, sidebar persistente a la derecha con resumen acumulado.
  - Indicador de progreso visual (●─●─○─○─○─○─○).
  - Navegación libre con `Ctrl+B` para volver al paso anterior.
  - Spinner durante la generación, summary card final con archivos generados.
- Workflows GitHub Actions: `ci.yml` (PRs y push a main) y `release.yml` (tags `v*`).
- Auto-label de PRs por prefijo de rama (`feature/*` → `feature`, etc.).
- 5 capturas de pantalla en el README cubriendo los pasos clave.

### Changed

- Migración de gitflow a GitHub Flow (rama `develop` eliminada).
- Branch protection en `main` con `validate` como check obligatorio.
- Default branch en GitHub: `main`.

[Unreleased]: https://github.com/breisnerlopez/Abax-Swarm/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.4
[0.1.3]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.3
[0.1.2]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.2
[0.1.1]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.1
