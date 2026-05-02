# Colaboracion con Git por fase

Cuando el `targetDir` del proyecto generado es un repo git (`.git/` detectado), Abax Swarm activa un **flujo distribuido de version control** entre los agentes. Esta guia describe quien hace que, cuando, y como cambiarlo.

La fuente de verdad del codigo vive en [`data/skills/git-collaboration.yaml`](../data/skills/git-collaboration.yaml). El orquestador la coordina mediante el bloque "Protocolo de commits por fase" inyectado en su template cuando `hasGit === true`.

## Quien hace que

| Rol | Responsabilidad git |
|---|---|
| **Orquestador** | NO toca git. Coordina vias delegacion. Al cerrar cada fase, delega a `@devops` (o `@tech-lead` si no hay devops) una sola Task: "haz push de la fase X". |
| **Cada agente tecnico** (`tech-lead`, `devops`, `developer-backend`, `developer-frontend`, `dba`) | Despues de escribir su entregable: `git add <archivo-especifico>` + `git commit -m "..." --author "<rol> <rol@abax-swarm>"`. **Nunca push.** |
| **devops** (o tech-lead fallback) | Al recibir delegacion del cierre de fase: `git push -u origin abax/<project-name>`. |

## Por que distribuido

- **Autoria granular**: cada commit lleva `--author` con el nombre del rol. La historia git refleja quien hizo que entregable. Util para auditoria, retros y PR reviews.
- **Push atomico por fase**: un solo `git push` por fase agrupa todos los commits de los entregables de esa fase. El remoto ve la fase como una unidad coherente, no como 6-12 commits dispersos en el tiempo.
- **El orquestador se mantiene puro**: sigue teniendo `bash: deny`, no rompe el principio "solo coordina vias Task". Esto es lo que el incidente de la sesion `ses_217c43466ffe` pidio: orquestador no debe ejecutar comandos.

## El branching

**Nombre de la rama**: `abax/<project-name-kebab-case>`. Ejemplos:
- "Sistema de Gestion de Pagos" → `abax/sistema-de-gestion-de-pagos`
- "API_v2.0" → `abax/api-v2-0`

**Cuando se crea**: el primer agente que vaya a hacer commit verifica si la rama actual es `main`/`master`/`trunk`. Si lo es, ejecuta:

```bash
git checkout -b "abax/<project-name>" 2>/dev/null || git checkout "abax/<project-name>"
```

La operacion es **idempotente**: si la rama ya existe (de una sesion previa, o de otro agente que llego antes), simplemente hace checkout. Nunca se borra ni se recrea.

**Cuando NO se crea**: si la rama actual no es main/master/trunk, los commits van directamente ahi. Util si el usuario abrio `abax-swarm init` desde una rama feature ya existente.

## Anti-patrones bloqueados

El skill `git-collaboration` lo prohibe explicitamente, y en modo `recommended` de permisos OpenCode los bloquea a nivel CLI:

- `git add .` o `git add -A` → siempre archivos especificos
- `git push --force` o `--force-with-lease` → en deny absoluto
- Commits en `main`/`master`/`trunk` → el primer paso del skill verifica branch
- Resolucion autonoma de conflicts → escalar al orquestador
- `git reset --hard` o `git rebase -i` → solo el usuario los ejecuta manualmente

## Manejo de errores

| Situacion | Comportamiento |
|---|---|
| Sin `git remote origin` | Solo commits locales. devops loguea aviso, no bloquea fase. |
| Push falla por **auth** | Escala al usuario con el comando exacto. |
| Push falla por **branch protection** | Escala al usuario y sugiere otro nombre de rama. |
| Push falla por **non-fast-forward** (alguien mas pusheo) | NO force-push. devops hace `git fetch` y reporta para rebase manual. |
| Push falla por **rate limit** | Espera 60s, reintenta una vez, luego escala. |
| Conflict entre dos agentes en el mismo archivo | Cada agente escala al orquestador, que delega merge a tech-lead. |

## Cambiar el nombre de la rama

El nombre `abax/<project-name>` esta hardcodeado en el skill. Para cambiarlo:

1. Edita `data/skills/git-collaboration.yaml` y cambia el patron de checkout en el "Paso 1" de las instrucciones.
2. Considera que cada nuevo proyecto generado usara el nuevo patron. Los proyectos existentes mantienen su rama actual.

## Combinacion con permisos

- En modo `strict`: el agente puede pedir confirmacion para cada `git` — verboso pero seguro para proyectos compartidos.
- En modo `recommended` (default): `git *` esta en allow, `git push --force` en deny. Optimo para uso normal.
- En modo `full`: sin restricciones. Solo para sandbox personal.

Detalle en [permissions.md](permissions.md).

## Tests

`tests/integration/git-collaboration.test.ts` verifica:
- El skill existe y referencia los 5 roles esperados.
- Cada uno de los 5 roles declara el skill.
- El template del orquestador, cuando `hasGit === true`, emite la nueva instruccion distribuida (no la version vieja "sugiere un comando").
- Cuando no hay devops en el equipo, el push se delega a `@tech-lead` como fallback.
- Cuando `hasGit === false`, el bloque entero se omite.
