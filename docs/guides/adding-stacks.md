# Adding Stacks — Abax Swarm

## 1. Create the YAML file

Create `data/stacks/<stack-id>.yaml`:

```yaml
id: my-stack
name: Framework X + Framework Y
description: >
  Brief description of the stack and its use case.

frontend:
  framework: FrameworkX
  language: TypeScript
  version: "5+"
  package_manager: npm
  conventions:
    - Convention 1
    - Convention 2

backend:
  framework: FrameworkY
  language: Python
  version: "3.12+"
  conventions:
    - Convention 1
    - Convention 2

database:
  default: PostgreSQL
  alternatives: [MySQL, MongoDB]
  orm: Prisma

devops:
  containerization: Docker
  orchestration: Kubernetes
  ci_cd: GitHub Actions
  hosting: AWS

role_context:
  developer-backend: |
    Stack-specific context for the backend developer.
    Frameworks, conventions, patterns to follow.
    Example: "Usa FastAPI con Pydantic models..."
  developer-frontend: |
    Stack-specific context for the frontend developer.
    Component patterns, state management, routing.
    Example: "Usa React Server Components..."
  devops: |
    Stack-specific context for DevOps.
    Containerization, deployment strategy.
    Example: "Dockerfile multi-stage con Poetry..."
  dba: |
    Stack-specific context for the DBA.
    ORM, migrations, query patterns.
    Example: "Usa Alembic para migraciones..."
```

## 2. How `role_context` works

At generation time, the `stack-adapter` merges each role's `role_context` entry into the agent's `system_prompt`:

```
Original system_prompt + "\n\n## Contexto de Stack\n" + role_context[roleId]
```

This is an immutable merge — the original prompt is preserved, stack context is appended.

**Which roles get context?** Only roles with an entry in `role_context`. You don't need to provide context for every role — only those whose work is affected by the tech stack (typically `developer-backend`, `developer-frontend`, `devops`, `dba`, `solution-architect`).

## 3. Validate

```bash
npx abax-swarm validate
```

## 4. Run tests

```bash
npm test
```

Integration tests verify:
- The stack loads correctly against the Zod schema
- Role IDs in `role_context` reference valid roles

## Tips

- **`id`**: Use `frontend-backend` format (e.g., `react-nextjs`, `angular-springboot`)
- **`role_context`**: Be specific — include framework versions, naming conventions, file structure, preferred libraries. The more specific, the better the generated agents will perform.
- **Keep `role_context` concise**: 10-20 lines per role. It's appended to the system prompt, so bloat hurts context window.
- **Not all roles need context**: Management roles (PM, PO, BA) rarely need stack-specific context. Focus on technical roles.
