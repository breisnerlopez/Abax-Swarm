# Architecture — Abax Swarm

## Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  CLI (TUI)   │────▶│   Engine     │────▶│  Generator   │
│  Commander   │     │  Selection   │     │  OpenCode    │
│  Readline    │     │  Resolution  │     │  Claude Code │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Data Layer  │     │  Validators  │     │  Output      │
│  YAML + Zod  │     │  RACI, Orch  │     │  .opencode/  │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Layers

### 1. Data Layer (`src/loader/`, `data/`)
- **YAML canonicals**: 20 roles, 71 skills, 7 tools, 13 stacks, 8 rule sets (size, criteria, dependencies, RACI, iron-laws, anti-rationalization, phase-deliverables, **document-mode**)
- **Zod schemas** (`src/loader/schemas.ts`): Validation at load time, full TypeScript typing
- **Loaders**: `loadRolesAsMap()`, `loadSkillsAsMap()`, `loadToolsAsMap()`, `loadStacksAsMap()`, `loadAllRules()` (which now includes `loadDocumentMode()`)

Data is fully decoupled from generators — you can add roles, skills, or stacks without touching code.

### 2. Engine (`src/engine/`)
Pure functions, no I/O (the three detectors only read well-known config files via `fs.readFileSync`). All business logic for assembling the team.

| Module | Responsibility |
|--------|---------------|
| `role-selector.ts` | Size matrix + criteria → initial role selection. Branches to `selectRolesForDocumentMode()` when `mode === "document"` |
| `dependency-resolver.ts` | Transitive hard deps, soft dep warnings, cycle detection |
| `skill-resolver.ts` | Roles → skills deduction (union of all role skills) |
| `tool-resolver.ts` | Roles → tools deduction (union of all role tools) |
| `stack-adapter.ts` | Immutable merge of stack `role_context` into agent `system_prompt` |
| `governance-resolver.ts` | Project size → governance model. New `documentation` model for `mode === "document"` |
| `model-mapping.ts` | `(provider, cognitive_tier, reasoning) → ModelSpec`. Supports `inherit` strategy (omit model so user default applies) |
| `color-resolver.ts` | `role.id → hex color` from a curated 24-color palette. Orchestrator always crimson. Override via `agent.color` in YAML |
| `stack-detector.ts` | 13 heuristics on `package.json`/`pom.xml`/`requirements.txt`/etc. → stack id + evidence |
| `docs-detector.ts` | Walks `targetDir/docs/` for `*.md` (recursive, capped at 3 levels) |
| `git-detector.ts` | Returns true when `targetDir/.git` exists (file or dir) |
| `project-context.ts` | Aggregate: combines the 3 detectors into a single `ProjectContextDetection` |
| `types.ts` | Core interfaces: `ProjectConfig`, `SelectionResult`, `DataContext`, `ProjectMode`, `ModelStrategy`, `ProjectContextDetection`, `DocumentMode` |

### 3. Generator (`src/generator/`)
Handlebars templates → generated files. Two targets share many generators; modes-driven extras live in shared modules.

**OpenCode** (`src/generator/opencode/`):
- `agent-generator.ts` → `.opencode/agents/*.md` (frontmatter with model, color, thinking)
- `skill-generator.ts` → `.opencode/skills/*/` (instructions + guides)
- `tool-generator.ts` → `.opencode/tools/*.ts` (TypeScript implementations)
- `orchestrator-generator.ts` → `.opencode/agents/orchestrator.md` (dynamic: team, RACI, phases, deps; conditional sections for document mode, existing-docs update protocol, per-phase commit suggestions)
- `config-generator.ts` → `opencode.json` (programmatic, not template) + `project-manifest.yaml`

**Claude Code** (`src/generator/claude/`):
- Same structure, adapted for `.claude/` directory and `claude_desktop_config.json`

**Shared** (`src/generator/`):
- `design-system-generator.ts` → `docs/design-system/presentacion-template.html` when at least one agent uses the `presentation-design` skill. Single-file HTML with 3 visual presets (Corporate Minimal / Tech Editorial / Dark Premium).
- `docs-site-generator.ts` → MkDocs Material scaffold (`mkdocs.yml`, `requirements.txt`, `docs/index.md`, `docs/<phase>/index.md` seeds) when `mode === "document"`.

### 4. CLI (`src/cli/`)

| Module | Responsibility |
|--------|---------------|
| `app.ts` | Commander entry: `init`, `roles`, `stacks`, `validate`, `regenerate`. Reads version dynamically from `package.json` |
| `WizardApp.tsx` | Interactive wizard built with Ink + React. Steps include `target-dir`, `project-mode`, `platform`, `model-strategy`, `provider`, `description`, `size`, `criteria`, `stack` (or `stack-detected` in continue mode), `document-options`, `role-scope`, `role-edit`, `confirm` |
| `pipeline.ts` | Orchestrates: selection → resolution → mix → generation → validation → write. Branches on `config.mode` |
| `format.ts` | Terminal formatting: banner, tables, file trees, success messages |
| `data-context.ts` | Loads all YAML data into a `DataContext` object |

### 5. Validators (`src/validator/`)

| Module | What it checks |
|--------|---------------|
| `orchestrator-validator.ts` | Agent @mentions match actual team, required sections present |
| `raci-validator.ts` | Every activity has R and A, all role references are valid |

## Data flow

```
ProjectConfig (name, size, criteria, stack, target)
  │
  ├─▶ selectRoles(size, criteria)
  │     └─▶ resolveDependencies()          → SelectionResult
  │
  ├─▶ resolveSkills(roleIds)               → Skill[]
  ├─▶ resolveTools(roleIds)                → Tool[]
  ├─▶ adaptAllRolesToStack(roles, stack)   → Role[] (with stack context)
  ├─▶ resolveGovernance(size)              → GovernanceDetails
  │
  └─▶ generate*Files()                    → GeneratedFile[]
        │
        ├─▶ validateOrchestrator()          → errors + warnings
        └─▶ writeGeneratedFiles(dir)
```

## Role classification

| Tier | Type | Count | Description |
|------|------|-------|-------------|
| 1 | Full agent | 10 | Complete agent with system_prompt, skills, tools, phases |
| 2 | Specialized | 8 | Agent with focused capabilities, added by size/criteria |
| 3 | Meta | 2 | Orchestrator (runtime coordinator) + System Designer (Abax Swarm itself) |

## Project modes

The wizard's first content step picks a mode that drives selection and emitted files:

| Mode | Selection source | Phases | Extra outputs |
|---|---|---|---|
| `new` | `data/rules/size-matrix.yaml` + `criteria-rules.yaml` | 10-phase cascade | (none) |
| `document` | `data/rules/document-mode.yaml` (curated 9 + optional security) | 5 phases (`discovery → inventory → documentation → review → publication`) | MkDocs scaffold |
| `continue` | Same as `new`, but stack/docs/git pre-detected from `targetDir` | Same as `new` | Orchestrator includes per-phase commit suggestions when `hasGit`, update protocol when `existingDocs` |

## Governance models

| Mode/Size | Model | Gate approvers | Ceremony level |
|------|-------|---------------|----------------|
| `new`, small (3-6 people) | Lightweight | PM or user | Minimal |
| `new`, medium (7-15 people) | Controlled | PO + PM | Formal deliverables |
| `new`, large (15+ people) | Corporate | Steering committee | Full RACI, change control |
| `document` (any size) | Documentation | Editorial review at each phase close | Verifiable docs (every claim cites `archivo:linea`) |

## Template system

Handlebars templates in `templates/opencode/`, `templates/claude/` and `templates/design-system/`:

| Template | Generates | Key variables |
|----------|-----------|---------------|
| `agent.md.hbs` | Agent files | `agent.*`, `skills[]`, `phases[]`, `dependencies.*`, `model`, `color`, `thinking`, `reasoningEffort` |
| `orchestrator.md.hbs` | Orchestrator | `agents[]`, `phaseGates[]`, `phases[]`, `dependencyChain[]`, `governance.*`, `isDocumentMode`, `existingDocs`, `hasGit`, `documentPhases[]`, `color` |
| `skill.md.hbs` | Skill files | `skill.*`, `content.*`, `guides[]` |
| `tool.ts.hbs` | Tool files | `tool.*`, `implementation.*` |
| `design-system/presentacion-template.html` | Static HTML reference (3 presets) | (no variables — copied verbatim) |

The orchestrator template is the most complex — it includes Phase 0 discovery flow, documentation protocol, HTML presentation protocol, RACI matrix, dependency chain, and three conditional sections (document mode, existing-docs update, per-phase commit suggestion).

## Stacks

13 pre-configured stacks. Each defines:
- Frontend framework, language, version
- Backend framework, language, version
- Database defaults and alternatives
- DevOps tooling (containers, CI/CD)
- `role_context`: per-role prompt additions specific to the stack

The `stack-adapter` merges `role_context` into each agent's `system_prompt` at generation time.
