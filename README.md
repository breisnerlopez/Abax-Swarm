# Abax Swarm

**AI agent orchestration for software projects.**

Abax Swarm generates a coordinated team of AI agents — each with a specialized role, skills, and tools — that work together following a waterfall methodology to deliver software projects. One CLI command sets up an orchestrator that delegates work across agents, tracks deliverables, and enforces governance.

## How it works

```
You describe your project
        │
        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TUI Wizard    │────▶│     Engine       │────▶│    Generator     │
│  7-step config  │     │  Role selection  │     │  Agents, skills  │
│                 │     │  Dependencies    │     │  tools, config   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                 .opencode/ or .claude/
                                                 Ready to orchestrate
```

1. **Configure** — The TUI wizard asks about your project (size, stack, team needs)
2. **Select** — The engine picks the right agents, resolves dependencies, adapts to your tech stack
3. **Generate** — Agents, skills, tools, and an orchestrator are written as Markdown/config files
4. **Run** — Open the project in OpenCode or Claude Code. The orchestrator coordinates the team

## Quick start

```bash
# Install
npm install -g abax-swarm

# Initialize a project (interactive wizard)
abax-swarm init

# Or run directly
npx abax-swarm init
```

The wizard guides you through 7 steps:

| Step | What it does |
|------|-------------|
| 1. Directory | Target project folder (creates if needed) |
| 2. Platform | OpenCode or Claude Code |
| 3. Project info | Name and description |
| 4. Classification | Size (small/medium/large) + project criteria |
| 5. Tech stack | 13 stacks available (React+Next.js, Angular+Spring, Python+FastAPI, etc.) |
| 6. Team review | Add/remove agents from the auto-selected team |
| 7. Confirmation | Preview files and generate |

## What gets generated

```
your-project/
├── .opencode/
│   ├── agents/
│   │   ├── orchestrator.md        ← Coordinates all agents
│   │   ├── project-manager.md     ← Planning, tracking, risks
│   │   ├── business-analyst.md    ← Requirements, user stories
│   │   ├── solution-architect.md  ← Architecture, design decisions
│   │   ├── developer-backend.md   ← Backend implementation
│   │   ├── developer-frontend.md  ← Frontend implementation
│   │   ├── qa-lead.md             ← Test strategy, quality gates
│   │   └── ...                    ← More agents based on project size
│   ├── skills/                    ← Reusable skill instructions
│   └── tools/                     ← Tool implementations (TypeScript)
├── opencode.json                  ← Platform configuration
└── project-manifest.yaml          ← Project metadata
```

## Agents

20 specialized roles organized in 3 tiers:

### Tier 1 — Core agents (always available)

| Agent | Role |
|-------|------|
| `project-manager` | Planning, tracking, risks, governance |
| `product-owner` | Vision, backlog, prioritization |
| `business-analyst` | Requirements, process mapping, user stories |
| `solution-architect` | Architecture, ADRs, technical decisions |
| `tech-lead` | Technical guidance, code standards, reviews |
| `developer-backend` | Backend implementation, APIs, services |
| `developer-frontend` | Frontend implementation, components, state |
| `qa-lead` | Test strategy, quality metrics |
| `qa-functional` | Test cases, manual testing, defect reporting |
| `devops` | CI/CD, containers, deployments, environments |

### Tier 2 — Specialized agents (added by project size/criteria)

| Agent | When added |
|-------|-----------|
| `dba` | Projects with complex data models |
| `security-architect` | Regulatory compliance, sensitive data |
| `integration-architect` | Multiple system integrations |
| `qa-automation` | Large test suites requiring automation |
| `qa-performance` | Performance-critical systems |
| `ux-designer` | User-facing applications |
| `tech-writer` | Documentation-heavy projects |
| `change-manager` | Organizational change management |

### Special roles

| Role | Purpose |
|------|---------|
| `orchestrator` | Coordinates all agents, enforces phase flow, delegates via Task tool |
| `system-designer` | Meta-role for modifying Abax Swarm itself (not part of projects) |

## Project phases

The orchestrator follows a waterfall methodology with mandatory gates:

```
Phase 0: Discovery          ← Iterative: epics, features, user stories, backlog
Phase 1: Inception          ← Charter, kickoff, stakeholder registry
Phase 2: Functional Analysis ← Specs, process maps, business rules
Phase 3: Technical Design    ← Architecture, data model, task decomposition
Phase 4: Construction        ← Sprint-based implementation
Phase 5: QA / Testing        ← Test execution, defect resolution
Phase 6: UAT                 ← User acceptance, sign-off
Phase 7: Deployment          ← Go-live readiness, rollback plan
Phase 8: Stabilization       ← Post-production support
Phase 9: Closure             ← Lessons learned, project close
```

Each phase has mandatory deliverables, a RACI matrix, and a gate approver. The orchestrator will not advance to the next phase until all deliverables are complete and approved.

## Tech stacks

13 pre-configured stacks that adapt agent prompts with stack-specific context:

| Stack | Frontend | Backend |
|-------|----------|---------|
| `react-nextjs` | React + Next.js | Next.js API Routes |
| `react-nestjs` | React | NestJS |
| `vue-nuxt` | Vue + Nuxt | Nuxt Server |
| `angular-springboot` | Angular | Spring Boot |
| `angular-quarkus` | Angular | Quarkus |
| `astro-hono` | Astro | Hono |
| `python-fastapi` | — | FastAPI |
| `python-django` | — | Django |
| `dotnet-blazor` | Blazor | .NET |
| `go-fiber` | — | Go Fiber |
| `rust-axum` | — | Rust Axum |
| `flutter-dart` | Flutter | Dart |
| `react-native-expo` | React Native | Expo |

## Skills & tools

**70 skills** — Reusable instruction sets that agents reference (functional analysis, test strategy, risk matrix, presentation design, etc.)

**7 tools** — TypeScript implementations agents can execute (create-document, generate-diagram, create-presentation, run-tests, lint-code, db-migrate, create-dashboard)

## Governance models

Automatically selected based on project size:

| Size | Team | Model | Characteristics |
|------|------|-------|----------------|
| Small | 5-7 agents | Lightweight | Minimal ceremony, PM approves gates |
| Medium | 10-12 agents | Controlled | Formal deliverables, PO + PM gates |
| Large | 14-18 agents | Corporate | Full RACI, steering committee, change control |

## Key features

- **Iterative discovery** — Phase 0 loops until the user approves the backlog (epics → features → user stories → prioritized backlog)
- **HTML presentations** — All presentations are autonomous HTML files with a consistent Design System created by the UX designer in Phase 0
- **Documentation trail** — Every deliverable is written to `docs/entregables/`, with a project log (`docs/bitacora.md`) and deliverable registry (`docs/registro-entregables.md`)
- **Anti-AI-slop design** — Presentation guidelines include rules against common LLM visual defaults (purple gradients, pure grays, nested cards)
- **Stack-aware prompts** — Agent instructions are enriched with stack-specific context (frameworks, conventions, tooling)
- **Dependency resolution** — Hard dependencies are auto-included; soft dependencies generate warnings

## Other commands

```bash
# List all available roles
abax-swarm roles

# List all available stacks
abax-swarm stacks

# Validate all YAML data files
abax-swarm validate

# Regenerate files from existing project-manifest.yaml
abax-swarm regenerate --dir /path/to/project
```

## Project structure

```
abax-swarm/
├── src/
│   ├── cli/                    ← TUI wizard, commands, formatting
│   │   ├── app.ts              ← Commander entry point
│   │   ├── wizard.ts           ← 7-step interactive wizard
│   │   ├── pipeline.ts         ← Orchestrates engine + generator
│   │   ├── prompts.ts          ← readline-based prompts
│   │   └── format.ts           ← Terminal output formatting
│   ├── engine/                 ← Core logic (pure functions, no I/O)
│   │   ├── role-selector.ts    ← Size + criteria → role selection
│   │   ├── dependency-resolver.ts ← Transitive dependency resolution
│   │   ├── skill-resolver.ts   ← Roles → skills deduction
│   │   ├── tool-resolver.ts    ← Roles → tools deduction
│   │   ├── stack-adapter.ts    ← Merges stack context into prompts
│   │   ├── governance-resolver.ts ← Size → governance model
│   │   └── types.ts            ← Core type definitions
│   ├── generator/              ← File generation (Handlebars templates)
│   │   ├── opencode/           ← OpenCode target (.opencode/)
│   │   └── claude/             ← Claude Code target (.claude/)
│   ├── loader/                 ← YAML loading + Zod validation
│   │   ├── schemas.ts          ← Zod schemas for all entities
│   │   ├── role-loader.ts      ← Role YAML → typed objects
│   │   ├── skill-loader.ts     ← Skill YAML → typed objects
│   │   └── ...
│   └── validator/              ← Post-generation validation
│       ├── orchestrator-validator.ts ← Agent references, sections
│       └── raci-validator.ts   ← RACI completeness
├── data/                       ← Canonical YAML data (decoupled from code)
│   ├── roles/                  ← 20 role definitions
│   ├── skills/                 ← 70 skill definitions
│   ├── tools/                  ← 7 tool definitions
│   ├── stacks/                 ← 13 stack configurations
│   └── rules/                  ← 7 rule sets (size matrix, RACI, deps, etc.)
├── templates/                  ← Handlebars templates
│   ├── opencode/               ← .md.hbs templates for OpenCode
│   └── claude/                 ← .md.hbs templates for Claude Code
├── tests/                      ← 212 tests (Vitest)
│   ├── unit/                   ← Unit tests per module
│   ├── integration/            ← Cross-module, pipeline, data consistency
│   └── fixtures/               ← Test data
├── docs/                       ← Documentation
│   ├── architecture.md         ← System layers, data flow
│   ├── data-model.md           ← YAML schemas and entity relationships
│   ├── guides/                 ← How-to guides
│   │   ├── adding-roles.md     ← Create a new agent role
│   │   ├── adding-skills.md    ← Create a new skill
│   │   ├── adding-stacks.md    ← Add a tech stack
│   │   └── orchestrator-flow.md ← Runtime orchestration behavior
│   └── internal/               ← Development history (not product docs)
└── examples/
    └── test-prompts.md         ← Validation prompts for testing agents
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System layers, data flow, component overview |
| [Data Model](docs/data-model.md) | YAML schemas for roles, skills, tools, stacks, rules |
| [Adding Roles](docs/guides/adding-roles.md) | How to create a new agent role |
| [Adding Skills](docs/guides/adding-skills.md) | How to create a new skill |
| [Adding Stacks](docs/guides/adding-stacks.md) | How to add a tech stack |
| [Orchestrator Flow](docs/guides/orchestrator-flow.md) | How the orchestrator coordinates agents at runtime |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Data Layer │     │   Engine    │     │  Generator  │
│  YAML + Zod │────▶│  Selection  │────▶│  Handlebars │
│  20 roles   │     │  Resolution │     │  OpenCode   │
│  70 skills  │     │  Adaptation │     │  Claude     │
│  7 tools    │     │             │     │             │
│  13 stacks  │     │             │     │             │
│  7 rules    │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────────────┐
                    │  Validators │
                    │  RACI       │
                    │  Orchestr.  │
                    └─────────────┘
```

**Data flow:**

```
ProjectConfig (name, size, criteria, stack, target)
  │
  ├─▶ selectRoles(size, criteria)         → RoleSelection[]
  │     └─▶ resolveDependencies()         → SelectionResult
  │
  ├─▶ resolveSkills(roleIds)              → Skill[]
  ├─▶ resolveTools(roleIds)               → Tool[]
  ├─▶ adaptAllRolesToStack(roles, stack)  → Role[] (with stack context)
  │
  └─▶ generate*Files()                    → GeneratedFile[]
        └─▶ writeGeneratedFiles(files, dir)
```

## Requirements

- Node.js >= 20
- npm

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Validate YAML data
npm run validate

# Run the wizard in dev mode
npm run dev -- init
```

## Dependencies

### Runtime
| Package | Purpose |
|---------|---------|
| `commander` | CLI framework (commands, options, help) |
| `handlebars` | Template engine for agent/skill/tool generation |
| `yaml` | YAML parsing for canonical data files |
| `zod` | Schema validation and TypeScript type inference |

### Dev
| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript 6 compiler |
| `vitest` | Test runner (212 tests, >90% coverage) |
| `tsx` | TypeScript execution for dev mode |
| `eslint` + `prettier` | Linting and formatting |

## License

MIT
