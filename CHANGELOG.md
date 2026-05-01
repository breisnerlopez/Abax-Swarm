# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/breisnerlopez/Abax-Swarm/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.3
[0.1.2]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.2
[0.1.1]: https://github.com/breisnerlopez/Abax-Swarm/releases/tag/v0.1.1
