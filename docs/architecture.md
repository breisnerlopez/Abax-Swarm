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
- **YAML canonicals**: 20 roles, 70 skills, 7 tools, 13 stacks, 7 rule sets
- **Zod schemas** (`src/loader/schemas.ts`): Validation at load time, full TypeScript typing
- **Loaders**: `loadRolesAsMap()`, `loadSkillsAsMap()`, `loadToolsAsMap()`, `loadStacksAsMap()`, `loadAllRules()`

Data is fully decoupled from generators — you can add roles, skills, or stacks without touching code.

### 2. Engine (`src/engine/`)
Pure functions, no I/O. All business logic for assembling the team.

| Module | Responsibility |
|--------|---------------|
| `role-selector.ts` | Size matrix + criteria → initial role selection |
| `dependency-resolver.ts` | Transitive hard deps, soft dep warnings, cycle detection |
| `skill-resolver.ts` | Roles → skills deduction (union of all role skills) |
| `tool-resolver.ts` | Roles → tools deduction (union of all role tools) |
| `stack-adapter.ts` | Immutable merge of stack `role_context` into agent `system_prompt` |
| `governance-resolver.ts` | Project size → governance model (lightweight/controlled/corporate) |
| `types.ts` | Core interfaces: `ProjectConfig`, `SelectionResult`, `DataContext`, etc. |

### 3. Generator (`src/generator/`)
Handlebars templates → generated files. Two targets:

**OpenCode** (`src/generator/opencode/`):
- `agent-generator.ts` → `.opencode/agents/*.md` (frontmatter + system prompt)
- `skill-generator.ts` → `.opencode/skills/*/` (instructions + guides)
- `tool-generator.ts` → `.opencode/tools/*.ts` (TypeScript implementations)
- `orchestrator-generator.ts` → `.opencode/agents/orchestrator.md` (dynamic: team, RACI, phases, deps)
- `config-generator.ts` → `opencode.json` (programmatic, not template) + `project-manifest.yaml`

**Claude Code** (`src/generator/claude/`):
- Same structure, adapted for `.claude/` directory and `claude_desktop_config.json`

### 4. CLI (`src/cli/`)

| Module | Responsibility |
|--------|---------------|
| `app.ts` | Commander entry: `init`, `roles`, `stacks`, `validate`, `regenerate` |
| `wizard.ts` | 7-step interactive wizard (dir → platform → info → size → stack → roles → confirm) |
| `pipeline.ts` | Orchestrates: selection → generation → validation → write |
| `prompts.ts` | readline-based: `askText`, `askSelect`, `askMultiSelect`, `askConfirm`, `askRoleToggle` |
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

## Governance models

| Size | Model | Gate approvers | Ceremony level |
|------|-------|---------------|----------------|
| Small (3-6 people) | Lightweight | PM or user | Minimal |
| Medium (7-15 people) | Controlled | PO + PM | Formal deliverables |
| Large (15+ people) | Corporate | Steering committee | Full RACI, change control |

## Template system

Handlebars templates in `templates/opencode/` and `templates/claude/`:

| Template | Generates | Key variables |
|----------|-----------|---------------|
| `agent.md.hbs` | Agent files | `agent.*`, `skills[]`, `phases[]`, `dependencies.*` |
| `orchestrator.md.hbs` | Orchestrator | `agents[]`, `phaseGates[]`, `phases[]`, `dependencyChain[]`, `governance.*` |
| `skill.md.hbs` | Skill files | `skill.*`, `content.*`, `guides[]` |
| `tool.ts.hbs` | Tool files | `tool.*`, `implementation.*` |

The orchestrator template is the most complex — it includes Phase 0 discovery flow, documentation protocol, HTML presentation protocol, RACI matrix, and dependency chain.

## Stacks

13 pre-configured stacks. Each defines:
- Frontend framework, language, version
- Backend framework, language, version
- Database defaults and alternatives
- DevOps tooling (containers, CI/CD)
- `role_context`: per-role prompt additions specific to the stack

The `stack-adapter` merges `role_context` into each agent's `system_prompt` at generation time.
