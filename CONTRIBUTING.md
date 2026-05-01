# Contribuir a Abax Swarm

¡Gracias por interesarte en contribuir! Este repositorio sigue dos modos de colaboración según el tipo de cambio.

## ¿Qué quieres hacer?

| Quiero… | Mira |
|---|---|
| Agregar un rol, habilidad, herramienta o stack | [README — Personalizar tu equipo](README.md#personalizar-tu-equipo) |
| Reportar un bug o pedir una feature | [Issues en GitHub](https://github.com/breisnerlopez/Abax-Swarm/issues) |
| Mandar un Pull Request con código | Sección [Flujo de PR](#flujo-de-pr) abajo |
| Entender la arquitectura | [docs/architecture.md](docs/architecture.md) |
| Ver el modelo de datos | [docs/data-model.md](docs/data-model.md) |

## Antes de abrir un PR

1. Bifurca el repo y trabaja en una rama corta con prefijo:
   - `feature/<nombre>` — funcionalidad nueva
   - `bugfix/<nombre>` — corrección de bug
   - `hotfix/<x.y.z>` — fix urgente para producción
   - `docs/<nombre>` — solo documentación
   - `chore/<nombre>` — mantenimiento (deps, refactor, CI)

   El prefijo determina la label que se aplica al PR automáticamente, y eso categoriza las release notes.

2. Antes de abrir el PR asegúrate de que pasen:

   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run validate    # solo si tocaste data/
   ```

3. Si añadiste un rol nuevo, también actualiza:
   - `data/rules/size-matrix.yaml` (cuándo aplica el rol según tamaño)
   - `data/rules/dependency-graph.yaml` (si depende de otros)
   - `data/rules/raci-matrix.yaml` (su responsabilidad por actividad)
   - `data/rules/criteria-rules.yaml` (si aplica solo bajo ciertos criterios)
   - Asigna `cognitive_tier` y `reasoning` siguiendo la heurística de [docs/model-mix.md](docs/model-mix.md).

## Flujo de PR

1. Mergeo a `main` con **squash** para mantener historia lineal.
2. CI corre `validate` (lint + typecheck + tests + YAML validation) y `label` (auto-asigna label por prefijo).
3. `validate` es **required**: el botón de merge se deshabilita si está rojo.
4. Las conversaciones del PR deben estar resueltas antes de mergear.

## Releases

Versionado **SemVer**, tags con prefijo `v` (`v0.1.4`).

```bash
git checkout main && git pull
# bumpear version en package.json
git commit -am "chore: bump version to 0.1.4"
git tag -a v0.1.4 -m "Release 0.1.4"
git push origin main --tags
```

El tag dispara `release.yml`: builda, empaqueta con `npm pack`, publica un GitHub Release con notas auto-generadas y el `.tgz` adjunto. Si `NPM_TOKEN` está configurado en los secrets del repo, también publica a npm.

## Estilo de código

- **Código en inglés**, contenido y UI en **español** (variables/funciones en inglés; YAML, prompts, textos del wizard en español).
- IDs en `kebab-case`: `developer-backend`, `react-nextjs`.
- TypeScript estricto: los esquemas Zod en `src/loader/schemas.ts` son la única fuente de verdad para los tipos.
- Sin comentarios redundantes — el código bien nombrado se explica solo. Comenta solo el _por qué_ no obvio.

## ¿Dudas?

Abre un [discussion](https://github.com/breisnerlopez/Abax-Swarm/discussions) o un [issue](https://github.com/breisnerlopez/Abax-Swarm/issues) etiquetado como `question`.
