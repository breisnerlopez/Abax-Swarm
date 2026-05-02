# Documentation — Abax Swarm

## For users

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System layers, data flow, detectors, project modes |
| [Data Model](./data-model.md) | YAML schemas for roles, skills, tools, stacks, rules + runtime types |
| [Model Mix](./model-mix.md) | Per-role model assignment (Opus/Sonnet/Haiku, GPT-5/mini/nano), with the `inherit` strategy for users without premium model access |
| [Agent Colors](./agent-colors.md) | Deterministic color palette for OpenCode TUI; orchestrator reserved crimson |
| [Permissions](./permissions.md) | 3 modos de permisos OpenCode (strict/recommended/full) y el incidente que los motivo |
| [Dependency Management](./dependency-management.md) | Skill + entregable bloqueante + protocolo de orchestrator para verificar runtime y deps antes de Construccion |
| [Git Collaboration](./git-collaboration.md) | Flujo distribuido de version control: cada agente commitea su entregable, devops pushea al cierre de fase, todo en rama `abax/<project>` |
| [Deployment Planning](./deployment-planning.md) | Bloqueante al inicio de fase 7 con 12 preguntas (donde, URL publica, DNS, monitoring, rollback, etc.) y aprobacion explicita del sponsor |
| [Presentation Publishing](./presentation-publishing.md) | Workflow de GitHub Pages para publicar las presentaciones automaticamente + audit anti-solapamiento de roles |
| [Quality Gates](./quality-gates.md) | 3 capas anti-mock (regla en developers + skill `anti-mock-review` en tech-lead + entregable `feature-spec-compliance` con BA externo) que cazan implementaciones falsas antes de QA |
| [Role Boundaries](./role-boundaries.md) | Matriz maestra de responsabilidades por fase + skill `role-boundaries` en 13 roles + protocolo 2-Tasks post-fix. Evita que un agente ejecute trabajo de otro rol "para acelerar" (motivado por incidente devops-haciendo-QA, mayo 2026) |
| [Roadmap](./roadmap.md) | Tipos de proyecto futuros (audit, migration, onboarding, infra, data, ml, etc.) con priorizacion en tiers y criterios para promover |

## Guides

| Guide | Description |
|-------|-------------|
| [Adding Roles](./guides/adding-roles.md) | How to create a new agent role |
| [Adding Skills](./guides/adding-skills.md) | How to create a new skill |
| [Adding Stacks](./guides/adding-stacks.md) | How to add a tech stack |
| [Orchestrator Flow](./guides/orchestrator-flow.md) | How the orchestrator coordinates agents at runtime, in cascade and documentation modes |
| [Dev Environments](./guides/dev-environments.md) | Devcontainer vs host, como arrancar el container, alternativas docker-compose |

## Screenshots

The 6 PNGs in `screenshots/` are captured headlessly via `scripts/capture-screenshots.sh` (requires `tmux` + `freeze`). They show the wizard at: 1) start, 2) project-mode selection, 3) criteria multi-select, 4) team editor, 5) confirmation with model mix and file preview, 6) dry-run summary.
