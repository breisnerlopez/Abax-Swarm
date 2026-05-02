# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
