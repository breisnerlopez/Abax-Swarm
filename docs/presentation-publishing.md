# Publicacion de presentaciones en GitHub Pages

Desde 0.1.18, los proyectos generados que incluyen agentes con el skill `presentation-design` reciben automaticamente un **workflow de GitHub Pages** que publica las presentaciones HTML al hacer push a `main`. La URL final es `https://<user>.github.io/<repo>/`.

## El workflow

`.github/workflows/pages.yml` se emite cuando `teamUsesPresentations(skills) === true`. El workflow:

- Se dispara en cada push a `main` y por `workflow_dispatch` manual.
- **Detecta MkDocs**: si existe `mkdocs.yml` (modo `document`), corre `mkdocs build` y publica `_site/`. Si no, publica `docs/` directamente como sitio estatico.
- Usa la action oficial `actions/deploy-pages@v4` con permisos minimos (`contents: read`, `pages: write`, `id-token: write`).
- Usa concurrency group `pages` con `cancel-in-progress: false` — los pushes consecutivos se encolan, ninguno se cancela mid-deploy.
- Tiene dos jobs (`build` y `deploy`) con `deploy.needs: build` para garantizar orden.

## Setup unico que hace el usuario

Despues de mergear a main por primera vez, el usuario debe:

1. Repository → Settings → Pages → Source: **GitHub Actions**.
2. Esperar a que el primer workflow run complete.
3. Anotar la URL que aparece en el output del job `deploy`.

A partir de ese momento, **cada push a main publica las presentaciones automaticamente**. Los agentes no necesitan hacer nada distinto: ya commitean su HTML con `git-collaboration` y devops pushea al cierre de fase con el flujo distribuido. GitHub Pages se ocupa del resto.

## Solapamiento de roles: el audit

Hoy 9 roles declaran el skill `presentation-design`:

- project-manager
- product-owner *(añadido en 0.1.18)*
- business-analyst
- tech-lead *(añadido en 0.1.18)*
- qa-lead *(añadido en 0.1.18)*
- change-manager
- solution-architect
- tech-writer
- ux-designer

Para evitar que dos roles produzcan la misma presentacion (o que la rubrica liste un rol que no declare el skill), `tests/integration/deployment-pages.test.ts` ejecuta dos audits automaticos:

### Audit 1 — Cada responsibilidad esta correctamente wireada

El test parsea la **tabla de Gobernanza de Presentaciones por Fase** dentro del skill `presentation-design.yaml` (la primera tabla en `instructions:`). Para cada row verifica:

- El rol de "Responsable" existe en `data/roles/`.
- Ese rol declara `presentation-design` en su `skills:`.
- El skill lista ese rol en su `used_by:`.

Si alguno falla, el test rompe con el mensaje: *"role X responsible for 'Y' but not in used_by"*. Esto detecta drift entre la documentacion (la tabla) y los datos (yaml).

### Audit 2 — Sin duplicacion

El test verifica que no haya dos rows con la misma combinacion `(fase, presentacion)`. Si dos roles tienen asignada la misma presentacion en la misma fase, el test rompe con el mensaje: *"duplicate: <fase>::<presentacion>"*.

## Como cambiar la asignacion

Para cambiar quien es responsable de una presentacion:

1. Edita la tabla en `data/skills/presentation-design.yaml > content.instructions:` (seccion "Gobernanza de Presentaciones por Fase").
2. Si el nuevo responsable es un rol que aun no tiene el skill, anadelo a:
   - `data/skills/presentation-design.yaml > used_by:`
   - `data/roles/<role>.yaml > skills:`
3. Si quitas un rol como responsable, NO necesitas quitarlo del `used_by` salvo que nunca mas vaya a producir presentaciones.
4. Corre `npm test` y verifica que el audit pase. Si rompe, te dira exactamente que arreglar.

## Cuando NO se emite el workflow

- Equipos sin `presentation-design` skill (proyectos muy pequenios sin necesidad de presentaciones formales). El audit no aplica porque el archivo no existe.
- Proyectos cuyo target no es OpenCode ni Claude (ahora solo emitimos a estos dos targets).

## Limitaciones conocidas

- **Requiere repo en GitHub**: el workflow solo funciona en GitHub. Si el remote es GitLab/Bitbucket/Gitea, el archivo se ignora (no falla, pero no publica nada).
- **Repos privados publican a Pages privado**: GitHub Pages soporta repos privados pero el sitio puede ser privado o publico segun el plan del usuario. El workflow funciona igual.
- **Requiere que el usuario haga merge a main**: las presentaciones solo se publican cuando el codigo llega a main. El flujo distribuido (`git-collaboration`) commitea en `abax/<project>` — el merge a main es decision del usuario.

## Tests

`tests/integration/deployment-pages.test.ts` cubre:
- `pages.yml` se emite cuando team usa `presentation-design`, no cuando no.
- YAML valido con triggers, permissions y concurrency correctos.
- Branching mkdocs vs docs/ presente.
- Trigger en push a `main` (no `abax/<project>`).
- Audit 1 + 2 (cross-references).

`tests/e2e/wizard-flow.test.ts` (E2E) cubre que el wizard completo navega los 12 steps incluido cuando team termina con `presentation-design` activo.
