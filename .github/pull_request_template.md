## Resumen

<!-- Qué cambia y por qué (1-3 líneas). -->

## Tipo de cambio

- [ ] Feature (`feature/*` → merge a `develop`)
- [ ] Bugfix no urgente (`bugfix/*` → merge a `develop`)
- [ ] Release (`release/x.y.z` → merge a `main` con tag `vx.y.z` + back-merge a `develop`)
- [ ] Hotfix urgente (`hotfix/x.y.z` → merge a `main` con tag `vx.y.z` + back-merge a `develop`)
- [ ] Docs / Refactor / Chore

## Checklist

- [ ] `npm test` pasa
- [ ] `npm run typecheck` pasa
- [ ] `npm run validate` pasa (si toqué `data/`)
- [ ] Documentación actualizada (`PROJECT_CONTEXT.md`, `docs/`, etc.) si aplica
- [ ] Versión bumpeada en `package.json` (solo en `release/*` y `hotfix/*`)
- [ ] Si añadí un rol nuevo: actualicé `size-matrix.yaml`, `dependency-graph.yaml`, `raci-matrix.yaml`

## Notas para el reviewer

<!-- Áreas de mayor riesgo, decisiones discutibles, o contexto adicional. -->
