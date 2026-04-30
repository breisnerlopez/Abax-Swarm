# Adding Skills — Abax Swarm

## 1. Create the YAML file

Create `data/skills/<skill-id>.yaml`:

```yaml
id: my-new-skill
name: Mi Nueva Skill
description: >
  Descripcion clara de que hace esta skill y cuando
  los agentes deben usarla.
used_by:
  - business-analyst
  - project-manager

content:
  when_to_use: |
    - Usar cuando [situacion 1]
    - Usar cuando [situacion 2]
    - NO usar cuando [situacion que no aplica]
  instructions: |
    ## Principio Central
    [Regla principal que gobierna esta skill]

    ## Proceso
    1. Paso 1...
    2. Paso 2...
    3. Paso 3...

    ## Formato de salida
    [Como debe verse el resultado]

    ## Anti-patrones
    - NO hacer [error comun 1]
    - NO hacer [error comun 2]
  guides:
    - name: plantilla-ejemplo
      content: |
        Plantilla o ejemplo detallado que los agentes
        pueden seguir como referencia...
    - name: checklist-calidad
      content: |
        Checklist de revision antes de entregar...
```

## 2. Reference from roles

Add the skill ID to the `skills:` array in each role YAML that should use it:

```yaml
# data/roles/business-analyst.yaml
skills:
  - functional-analysis
  - my-new-skill        # ← add here
```

## 3. Validate

```bash
npx abax-swarm validate
```

## 4. Run tests

```bash
npm test
```

Integration tests verify:
- The skill loads correctly against the Zod schema
- All roles that reference this skill exist
- The `used_by` field matches which roles list this skill

## Tips

- **`when_to_use`**: Be explicit about when to use AND when NOT to use. Agents use this to decide if the skill applies.
- **`instructions`**: This is the core content injected into the agent's context. Keep it actionable — steps, formats, rules.
- **`guides`**: Optional deep-dive references. Use for templates, checklists, or examples that would bloat `instructions`.
- **`used_by`**: Informational — indicates which roles use this skill. Keep synchronized with role YAML `skills:` arrays.
