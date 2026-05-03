# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

Abax Swarm is a CLI tool that generates coordinated AI agent teams for software projects. A TUI wizard collects project config, an engine selects/resolves agents, and generators produce Markdown agent files + configs for OpenCode or Claude Code.

## Commands

```bash
# Run all tests (212 tests, >90% coverage threshold)
npm test

# Run a single test file
npx vitest run tests/unit/engine/role-selector.test.ts

# Run tests matching a pattern
npx vitest run -t "dependency"

# Watch mode
npm run test:watch

# Type check
npm run typecheck

# Validate all YAML data files against Zod schemas
npm run validate

# Run the TUI wizard in dev mode (no build needed)
npm run dev -- init

# Other CLI commands via dev
npm run dev -- roles
npm run dev -- stacks
npm run dev -- validate
npm run dev -- regenerate                   # carpeta actual
npm run dev -- regenerate --dir /path/to/project   # otra carpeta
```

## Architecture

Four layers, strict data flow from left to right:

**Data Layer** (`src/loader/` + `data/`) → **Engine** (`src/engine/`) → **Generator** (`src/generator/`) → **Output** (`.opencode/` or `.claude/`)

- **Loader**: Reads YAML from `data/`, validates with Zod schemas (`src/loader/schemas.ts`), returns typed Maps. All entity schemas are in one file.
- **Engine**: Pure functions, zero I/O. `role-selector` picks roles by size+criteria, `dependency-resolver` adds transitive hard deps, `skill-resolver`/`tool-resolver` deduce from roles, `stack-adapter` merges stack context into prompts, `governance-resolver` picks governance model.
- **Generator**: Handlebars templates in `templates/opencode/` and `templates/claude/`. Each target has parallel generators: agent, skill, tool, orchestrator, config. The `config-generator` builds `opencode.json` and `project-manifest.yaml` programmatically (not from templates).
- **Validator**: Post-generation checks. `orchestrator-validator` verifies agent references match actual team. `raci-validator` checks RACI completeness.

**CLI** (`src/cli/`) ties it together: `app.ts` (Commander commands) → `wizard.ts` (7-step interactive flow) → `pipeline.ts` (selection → generation → validation → write).

## Key design decisions

- **Data is decoupled from code**: All roles, skills, tools, stacks, and rules live as YAML in `data/`. Adding a new role means creating a YAML file and registering it in the rule YAMLs — no TypeScript changes needed.
- **Engine is pure**: `src/engine/` has no I/O, no file reads, no side effects. Everything takes typed inputs and returns typed outputs. This makes it fully testable.
- **Two generator targets**: OpenCode (`.opencode/` directory) and Claude Code (`.claude/` directory) are parallel implementations in `src/generator/opencode/` and `src/generator/claude/`. They share the same engine output but produce different file structures.
- **Orchestrator template is the most complex file**: `templates/opencode/orchestrator.md.hbs` generates the runtime coordinator. It includes Phase 0 discovery flow, documentation protocol, HTML presentation protocol, RACI matrix, dependency chain, and unbreakable rules. Changes here affect all generated projects.
- **Phase authorization is a whitelist**: Each role YAML has a `phases:` array. If a phase ID isn't listed, the agent will reject work for that phase at runtime. When adding new phases, update all participating role YAMLs.

## Conventions

- **Code in English, UI/content in Spanish**: ALL identifiers — variables, functions, classes, endpoints, query/path params, env vars, SQL tables/columns, JSON/YAML keys, branches, code filenames — go in English. YAML *content* (agent prompts, skill instructions, TUI text) goes in Spanish, but when the prompts CITE identifiers they cite them in English. Enforced by skill `code-naming-convention` and guard rail `tests/integration/code-naming-convention.test.ts` which scans `data/*.yaml` and fails CI on Spanish-mixed identifiers (with documented exemptions for legacy DB tables, public APIs and dominio terms like RUC/CURP). See `docs/code-naming.md`.
- **IDs are kebab-case**: `developer-backend`, `functional-analysis`, `react-nextjs`.
- **Zod schemas are the single source of truth** for types: `Role`, `Skill`, `Tool`, `Stack` all inferred from Zod schemas in `schemas.ts`.
- **Tests mirror source structure**: `tests/unit/engine/` tests `src/engine/`, `tests/unit/generator/` tests `src/generator/`, etc.
- **Integration tests validate cross-entity consistency**: `data-consistency.test.ts` checks that skills referenced by roles exist, dependencies reference valid roles, size matrix entries are valid, etc.

## Data entity relationships

```
Role ──uses──▶ Skill[] (role.skills references skill.id)
Role ──uses──▶ Tool[] (role.tools references tool.id)
Role ──adapted_by──▶ Stack (stack.role_context[roleId] merged into prompt)
Role ──depends_on──▶ Role[] (dependency-graph.yaml)
Role ──participates──▶ Phase[] (role.phases whitelist)
Role ──assigned──▶ Activity[] (raci-matrix.yaml)
Criteria ──adds──▶ Role[] (criteria-rules.yaml)
Size ──classifies──▶ Role[] (size-matrix.yaml)
```

## When modifying YAML data

After changing any YAML in `data/`:
1. Run `npm run validate` to check schema compliance
2. Run `npm test` — integration tests cross-validate all entity references
3. If you added a role, also update: `size-matrix.yaml`, `dependency-graph.yaml`, `raci-matrix.yaml`
4. If you added a phase ID, update `phases:` in all participating role YAMLs
5. **If you added a role, classify it for `role-boundaries`** — either add it to `used_by:` in `data/skills/role-boundaries.yaml` AND list `- role-boundaries` first in its `skills:`, OR add it to `EXEMPT_FROM_ROLE_BOUNDARIES` in `tests/integration/role-boundaries.test.ts` with a one-line reason. The test "every role is classified" fails CI if you skip this step. See `docs/guides/adding-roles.md` §2 for the rubric and `docs/role-boundaries.md` for the motivating incident.
6. **If you added a role, satisfy the three guard rails in `tests/integration/role-guards.test.ts`** — (a) anti-mock rule embedded in `system_prompt` if the role implements production code; (b) `git-collaboration` skill if `bash != "deny"`; (c) complete `stack_overrides` for every stack in `data/stacks/` if the role declares any overrides. Each has an `EXEMPT_FROM_*` constant for documented exceptions. See `docs/guides/adding-roles.md` §2b.

## Test structure

- `tests/unit/loader/` — YAML loading, schema validation, error cases
- `tests/unit/engine/` — Role selection, dependency resolution, skill/tool resolution
- `tests/unit/generator/` — File generation, orchestrator content, write operations
- `tests/unit/cli/` — Pipeline orchestration, data context loading
- `tests/integration/data-consistency.test.ts` — Cross-entity validation (skills↔roles, deps↔roles, RACI↔roles)
- `tests/integration/full-pipeline.test.ts` — End-to-end: config → selection → generation → validation
- `tests/integration/e2e-interface.test.ts` — Write → read → regenerate cycle
