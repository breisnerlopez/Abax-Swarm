# Data Model — Abax Swarm

All canonical data lives in `data/` as YAML files, validated by Zod schemas at load time.

## Roles (`data/roles/*.yaml`) — 20 files

```yaml
id: developer-backend          # kebab-case, unique
name: Desarrollador Backend    # Human-readable name
category: construction         # Functional category
tier: "1"                      # 1=full, 2=specialized, 3=meta

size_classification:           # When to include by project size
  small: indispensable
  medium: indispensable
  large: indispensable

agent:
  mode: subagent               # primary (orchestrator only) / subagent
  temperature: 0.3             # LLM temperature
  description: "..."           # Short description (1-2 sentences)
  system_prompt: |             # Full agent prompt
    Eres un Desarrollador Backend senior...
    ## Principios
    - ...
    ## Restricciones
    - ...
  permissions:                 # Tool permissions for the target platform
    read: allow
    edit: allow
    bash: allow
    glob: deny
    grep: deny
    skill: allow
  tools_enabled:               # Explicit tool toggles
    write: true
    edit: true
    read: true
    bash: true

skills: [code-review, api-design]    # Skill IDs (must exist in data/skills/)
tools: [run-tests, lint-code]        # Tool IDs (must exist in data/tools/)

stack_overrides:                     # Optional per-stack prompt additions
  angular-springboot:
    prompt_append: "Usa Spring Data JPA..."

dependencies:
  receives_from: [business-analyst, tech-lead]
  delivers_to: [qa-functional, devops]

phases:                              # Authorized project phases
  - construction
  - deployment
  - stabilization

raci:                                # RACI assignments
  build_solution: R
  deploy: C
```

## Skills (`data/skills/*.yaml`) — 70 files

```yaml
id: functional-analysis
name: Analisis Funcional
description: >
  Metodologia para levantar, documentar y validar
  requisitos funcionales del proyecto.
used_by:
  - business-analyst
  - product-owner

content:
  when_to_use: |
    - Usar cuando se inicia una fase de analisis...
  instructions: |
    ## Principio Central
    Todo requisito debe ser verificable...

    ## Formato
    ...
  guides:
    - name: plantilla-requisitos
      content: |
        Plantilla base para documentar requisitos...
    - name: checklist-revision
      content: |
        Checklist de revision antes de entregar...
```

## Tools (`data/tools/*.yaml`) — 7 files

```yaml
id: generate-diagram
name: Generador de Diagramas
description: >
  Genera diagramas Mermaid para flujos, secuencias,
  entidad-relacion y componentes.
used_by:
  - solution-architect
  - tech-lead
  - business-analyst

implementation:
  language: typescript
  args:
    type:
      type: string
      description: "Tipo de diagrama: flowchart, sequence, erd, component"
    content:
      type: string
      description: "Especificacion del diagrama en texto"
  returns: string
  body: |
    // TypeScript implementation
    const diagramTypes = { ... };
    return `\`\`\`mermaid\n${output}\n\`\`\``;
```

## Stacks (`data/stacks/*.yaml`) — 13 files

```yaml
id: react-nextjs
name: React + Next.js
description: "Full-stack con React y Next.js App Router"

frontend:
  framework: Next.js
  language: TypeScript
  version: "15+"
  package_manager: npm
  conventions:
    - App Router (app/ directory)
    - Server Components by default

backend:
  framework: Next.js API Routes
  language: TypeScript
  version: "15+"
  conventions:
    - Route handlers in app/api/

database:
  default: PostgreSQL
  alternatives: [MySQL, SQLite]
  orm: Prisma

devops:
  containerization: Docker
  ci_cd: GitHub Actions
  hosting: Vercel

role_context:                        # Per-role prompt additions
  developer-backend: |
    Usa Next.js API Routes con App Router.
    ORM: Prisma con PostgreSQL.
    Patron: Server Actions para mutaciones...
  developer-frontend: |
    Usa React Server Components por defecto.
    Client Components solo con "use client"...
```

## Rules (`data/rules/`) — 7 files

### `size-matrix.yaml`
Maps project sizes to role classifications:
```yaml
roles_by_size:
  small:
    indispensable: [project-manager, product-owner, business-analyst, ...]
    recommended: [tech-writer]
    optional: [dba, security-architect]
  medium:
    indispensable: [project-manager, product-owner, ...]
    recommended: [dba, ux-designer, ...]
  large:
    indispensable: [...all core + most specialized]
```

### `criteria-rules.yaml`
10 project criteria that trigger additional roles:
```yaml
criteria:
  - id: has_complex_integrations
    question: "Tiene integraciones complejas con sistemas externos?"
    adds_roles: [integration-architect]
  - id: has_regulatory_compliance
    question: "Requiere cumplimiento regulatorio?"
    adds_roles: [security-architect, compliance-check]
```

### `dependency-graph.yaml`
Inter-role dependencies (hard = auto-included, soft = warning):
```yaml
dependencies:
  developer-frontend:
    hard: [ux-designer]      # If frontend selected, UX is mandatory
    soft: [tech-lead]        # Recommended but not enforced
  qa-automation:
    hard: [qa-lead]
    soft: [devops]
```

### `raci-matrix.yaml`
11 activities × roles with R/A/C/I assignments:
```yaml
activities:
  define_scope:
    product-owner: A
    business-analyst: R
    project-manager: C
  build_solution:
    developer-backend: R
    developer-frontend: R
    tech-lead: A
```

### `phase-deliverables.yaml`
Mandatory deliverables per waterfall phase with responsible agent and gate approver.

### `iron-laws.yaml`
Unbreakable rules injected into agent prompts (phase boundaries, delegation rules).

### `anti-rationalization.yaml`
Rules preventing agents from rationalizing out-of-scope work.

## Entity relationships

```
Role ──uses──▶ Skill[]
Role ──uses──▶ Tool[]
Role ──adapted_by──▶ Stack (role_context merge)
Role ──depends_on──▶ Role[] (dependency-graph)
Role ──participates──▶ Phase[] (phase authorization)
Role ──assigned──▶ Activity[] (RACI matrix)
Criteria ──adds──▶ Role[]
Size ──classifies──▶ Role[] (indispensable/recommended/optional)
```

## Validation

All cross-references are validated at load time and by integration tests:
- Skills referenced by roles must exist in `data/skills/`
- Tools referenced by roles must exist in `data/tools/`
- Dependencies reference valid role IDs
- RACI references valid role IDs and activities
- Size matrix references valid role IDs
- Criteria `adds_roles` references valid role IDs
