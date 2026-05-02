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

## Documentar cambios

Toda contribución que cambie el surface público (lo que un usuario o un dev contribuyente ve) **debe actualizar la documentación en el mismo PR**. La regla simple: si tu cambio se ve desde fuera, alguien debe poder enterarse leyendo los docs sin tener que leer el código.

### Qué docs tocar según el tipo de cambio

| Si tu cambio… | Actualiza |
|---|---|
| Modifica el wizard (steps, sidebar, default values) | `README.md` (tabla de pasos), `scripts/capture-screenshots.sh` (orden de teclas), regenera capturas |
| Añade un campo nuevo a un YAML de `data/` | `docs/data-model.md` con el ejemplo del nuevo campo |
| Añade/cambia un módulo en `src/engine/` o `src/generator/` | `docs/architecture.md` en la tabla del layer correspondiente |
| Cambia cómo el orchestrator delega o emite secciones nuevas | `docs/guides/orchestrator-flow.md` |
| Añade una feature lo bastante grande para tener su propio guide | Crea `docs/<feature>.md` (modelo: `model-mix.md`, `agent-colors.md`) y referénciala desde `docs/README.md` |
| Cambia la lista de dependencias o el comando de build | `README.md` sección "Comandos de desarrollo" |
| Añade una rule YAML nueva en `data/rules/` | `docs/data-model.md` y `docs/architecture.md` (Data Layer count) |
| Toca exclusivamente código interno sin efecto visible | Solo `CHANGELOG.md` con `### Internal` |

### CHANGELOG.md

Sigue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Cada release se añade arriba de las anteriores, con fecha en formato ISO. Las secciones permitidas son `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, `Documentation`.

```markdown
## [0.1.X] — YYYY-MM-DD

### Added
- Descripción concreta de la feature, con su valor para el usuario y links a docs/PRs relevantes.

### Changed
- Cambio de comportamiento existente. Indica si rompe compatibilidad.

### Fixed
- Bug fix con una frase de contexto (qué pasaba antes vs ahora).

### Documentation
- Cambios sólo de docs. Lista los archivos tocados.
```

Pautas:
- **Una bullet por cambio coherente**, no por archivo. Si moviste 5 archivos para una sola feature, una sola entrada.
- **Habla del usuario o del dev**, no del código. ❌ "Refactor de WizardApp" → ✅ "Wizard ahora muestra el modo de proyecto desde el primer paso".
- **Cita issues/PRs externos cuando aplique** (sst/opencode#17118 etc.).
- **No edites releases ya publicados** salvo para arreglar typos. Si te equivocaste, añade un fix en la próxima versión.

### Versionado

Mientras estemos en `0.x.y`, la API se considera inestable y todo cambio se publica como **patch bump** (`0.1.11 → 0.1.12`). El primer release `1.0.0` requiere acordar la API estable. A partir de ahí seguimos SemVer estricto.

### Antes de tagear un release

```bash
npm run lint        # ESLint sobre src/ y tests/
npm run typecheck   # tsc --noEmit
npm test            # Vitest, 320+ tests (excluye E2E para mantenerlo rápido)
npm run validate    # Validación Zod de todos los YAML
```

Los cuatro deben pasar. CI los corre como `validate` en el workflow `ci.yml`, y el tag dispara `release.yml` que los corre **otra vez** antes de publicar a npm — así que un fallo local también va a fallar el release.

**Si modificaste el wizard**, corre también:

```bash
npm run test:e2e    # Spawnea el binario real en un PTY y navega los 12 steps con teclado sintético (~5s)
```

Este test cubre regresiones que `ink-testing-library` no detecta (transiciones de step, sidebar dinámico, `process.cwd()` pre-fill del TextInput, comportamiento real del teclado en Ink).

### Si tu cambio incluye una feature visible en el wizard

Regenera las capturas (siguiente sección) **antes** de tagear, así el README publicado coincide con lo que el usuario ejecuta. Si no las regeneras, las capturas quedan con un banner de versión vieja y un flujo desactualizado — un olor que ya pasó dos veces (`v0.1.1` se mostró como banner hasta `v0.1.12`).

---

## Regenerar las capturas de pantalla

Las 6 PNGs en `docs/screenshots/` se regeneran de forma **headless y reproducible** con un script. No requiere display gráfico ni interacción manual — todo corre dentro de tmux y se renderiza a PNG con `freeze`.

### Cuándo regenerar

- Cualquier cambio en el wizard: steps nuevos, reordenamientos, cambios de copy, sidebar.
- Cambios en `Header.tsx` (banner) o el progress bar.
- Bumps de versión (el banner las muestra).
- Cambios visuales en componentes (`SelectInput`, `MultiSelectInput`, `RoleEditor`, etc.).

### Requisitos

```bash
sudo apt install tmux           # Linux
# o brew install tmux           # macOS
```

`freeze` (charmbracelet) no está en repos de apt, descárgalo del binario release:

```bash
# Linux x86_64
curl -sLO https://github.com/charmbracelet/freeze/releases/latest/download/freeze_<version>_Linux_x86_64.tar.gz
tar xzf freeze_<version>_Linux_x86_64.tar.gz
sudo mv freeze_<version>_Linux_x86_64/freeze /usr/local/bin/

# macOS arm64
brew install charmbracelet/tap/freeze
```

Verifica:
```bash
tmux -V       # >= 3.2
freeze --version
```

### Cómo regenerar

```bash
npm run build                       # Asegura que dist/ está actualizado
bash scripts/capture-screenshots.sh # Genera 6 PNGs en docs/screenshots/
```

El script:
1. Lanza el wizard dentro de una sesión tmux headless con `TERM=xterm-256color` para que los colores rendericen.
2. Envía teclas (`tmux send-keys`) para navegar el wizard automáticamente.
3. Captura el frame Ink renderizado en cada paso clave (`tmux capture-pane`).
4. Convierte cada captura ANSI a PNG con `freeze` (chrome estilo macOS, theme `charm`).

### Cuidados al modificar el script

Estos detalles ya causaron capturas erróneas en el pasado, déjenlos en el script:

- **El TextInput de paso 1 se pre-llena con `process.cwd()`** desde 0.1.7. Hay que limpiar antes de escribir el path nuevo. `Ctrl-U` no funciona en `ink-text-input`, usa Backspaces. **En chunks** con sleeps cortos entre ellos — si mandas 150 backspaces seguidos, ink se atraganta y el siguiente Enter se pierde.
- **Sleeps generosos** entre `send-keys` y `capture-pane`. Un Enter necesita ~1.5s para que ink procese y re-renderice. Después de operaciones costosas (cargar selección de roles), `sleep 2.5`.
- **Default values cambian con la versión**. Si añades un step nuevo o cambias defaults, ajusta el comentario al inicio del script con el orden actual de pasos.

### Verificar las capturas

Ábrelas con un visor (no solo te fíes del tamaño en bytes — si dos PNGs son del mismo tamaño exacto, probablemente representan el mismo frame, indica que el wizard no avanzó):

```bash
ls -la docs/screenshots/
# Cada uno debe tener tamaño claramente distinto. Si dos son idénticos en bytes, debug.
```

Mira al menos una captura para confirmar que muestra el step esperado y la versión correcta del banner. La captura `02-project-mode.png` debe mostrar las 3 opciones de modo; `05-confirmation.png` el preview con mix de modelos.

### Actualizar referencias en README

Si renombras o añades capturas, actualiza los enlaces en `README.md` (búscalos con `grep "screenshots/" README.md`).

## Releases

Versionado **SemVer**, tags con prefijo `v` (`v0.1.13`).

El flujo en orden:

```bash
# 1. Trabajar en una rama corta (feature/, bugfix/, docs/, chore/, hotfix/)
# 2. Abrir PR contra main, esperar CI verde, mergear con squash
# 3. Cuando estés listo para release:

git checkout main && git pull --ff-only

# Bumpear package.json y CHANGELOG.md (mover [Unreleased] a [X.Y.Z] con la fecha)
# Esto se hace en el mismo PR de la última feature que entra en el release,
# no en un PR separado de "chore: bump version" — así CHANGELOG y código van juntos.

git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin vX.Y.Z
```

El tag dispara `release.yml`:
1. Lint + typecheck + tests + validate (otra vez, sobre el ref del tag).
2. `npm run build` y `npm pack` para producir el tarball.
3. `npm publish --access public` con el `NPM_TOKEN` configurado en GitHub Secrets.
4. `gh release create` con notas auto-generadas y el `.tgz` adjunto.

### Token de npm (NPM_TOKEN)

El token debe ser un **Granular Access Token con "bypass 2FA when publishing"** marcado — la cuenta tiene 2FA activo y un token sin esa flag falla con `403 Forbidden`. Generar uno: <https://www.npmjs.com/settings/~/tokens>. Configurar en el repo:

```bash
gh secret set NPM_TOKEN -R breisnerlopez/Abax-Swarm
# Pega el token cuando lo pida (no aparece en el historial)
```

### Si el release falla

- **`Publish to npm` skipped**: `NPM_TOKEN` no está configurado o vacío. Ese paso tiene `continue-on-error: true` para no bloquear el GitHub Release; arregla el secret y re-corre el workflow con `gh run rerun <id>`.
- **`Publish to npm` 403**: token sin bypass 2FA. Regenera y actualiza el secret.
- **`Create GitHub Release` falla con "tag already exists"**: ya creaste el release en una corrida previa. Es benigno; el publish a npm es lo que importa.

## Estilo de código

- **Código en inglés**, contenido y UI en **español** (variables/funciones en inglés; YAML, prompts, textos del wizard en español).
- IDs en `kebab-case`: `developer-backend`, `react-nextjs`.
- TypeScript estricto: los esquemas Zod en `src/loader/schemas.ts` son la única fuente de verdad para los tipos.
- Sin comentarios redundantes — el código bien nombrado se explica solo. Comenta solo el _por qué_ no obvio.

## ¿Dudas?

Abre un [discussion](https://github.com/breisnerlopez/Abax-Swarm/discussions) o un [issue](https://github.com/breisnerlopez/Abax-Swarm/issues) etiquetado como `question`.
