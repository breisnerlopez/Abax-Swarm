# Documentation — Abax Swarm

## For users

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System layers, data flow, detectors, project modes |
| [Data Model](./data-model.md) | YAML schemas for roles, skills, tools, stacks, rules + runtime types |
| [Model Mix](./model-mix.md) | Per-role model assignment (Opus/Sonnet/Haiku, GPT-5/mini/nano), with the `inherit` strategy for users without premium model access |
| [Agent Colors](./agent-colors.md) | Deterministic color palette for OpenCode TUI; orchestrator reserved crimson |

## Guides

| Guide | Description |
|-------|-------------|
| [Adding Roles](./guides/adding-roles.md) | How to create a new agent role |
| [Adding Skills](./guides/adding-skills.md) | How to create a new skill |
| [Adding Stacks](./guides/adding-stacks.md) | How to add a tech stack |
| [Orchestrator Flow](./guides/orchestrator-flow.md) | How the orchestrator coordinates agents at runtime, in cascade and documentation modes |

## Screenshots

The 5 PNGs in `screenshots/` are captured headlessly via `scripts/capture-screenshots.sh` (requires `tmux` + `freeze`). They show the wizard at: 1) start, 2) project-mode selection, 3) criteria multi-select, 4) team editor, 5) confirmation with model mix and file preview.
