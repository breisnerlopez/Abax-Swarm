# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
