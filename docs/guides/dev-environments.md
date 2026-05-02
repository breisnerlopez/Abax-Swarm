# Ambientes de desarrollo aislados

Cuando los agentes de IA pueden ejecutar comandos en tu maquina (instalar paquetes, modificar archivos, correr builds), **aislarlos del SO principal evita problemas serios**. Esta guia describe las dos opciones que Abax Swarm ofrece y como usarlas.

## Por que aislar

El [incidente documentado en `permissions.md`](permissions.md#por-que-esto-importa-el-incidente-que-lo-motivo) ilustra el riesgo: un agente intentando instalar Maven termino ejecutando `rm -f /var/lib/dpkg/lock-frontend` para forzar un `apt install`. Funciono por suerte. La proxima vez podria romper la base de paquetes del SO.

Aislar el ambiente significa que el agente trabaja **dentro de un container**: cualquier instalacion (`apt-get install openjdk-21`), modificacion de paths globales, o experimento que salga mal **se queda en el container**. Para "rehacer", basta con destruir el container y crearlo de nuevo. Tu SO principal nunca se toca.

## Las dos opciones de Abax Swarm

El wizard te pregunta en el paso 3 (despues de los permisos):

### `devcontainer` (recomendado, default)

- Genera `.devcontainer/devcontainer.json` con la imagen base Ubuntu y **features** ([containers.dev/features](https://containers.dev/features)) segun tu stack:

| Stack | Features |
|---|---|
| `react-nextjs`, `react-nestjs`, `vue-nuxt`, `astro-hono`, `react-native-expo` | `node:1` |
| `angular-springboot`, `angular-quarkus` | `node:1`, `java:1` (con Maven) |
| `python-fastapi`, `python-django` | `python:1` |
| `go-fiber` | `go:1` |
| `rust-axum` | `rust:1` |
| `dotnet-blazor` | `dotnet:2` |
| `flutter-dart` | base + `postCreateCommand` que instala Flutter SDK |

- **Todos** incluyen `git:1` y `docker-in-docker:2` (para que los agentes puedan correr `docker` sin salir del container).
- Marca el container con `containerEnv: { ABAX_ISOLATED: "1" }` para que el [container-detector](../src/engine/container-detector.ts) y el skill `dependency-management` sepan que estan dentro.

**Ventaja secundaria**: el modo de permisos `recommended` automaticamente flippa `apt-get`, `dpkg`, `sudo` a `allow` cuando estas en devcontainer. La seguridad relajada solo aplica adentro.

### `host` (sin aislamiento)

- No genera devcontainer.
- Los agentes corren directamente en tu SO principal.
- El modo de permisos `recommended` mantiene `apt`/`dpkg`/`sudo` en `ask` para forzar tu aprobacion.
- El skill `dependency-management` instruye a los agentes a usar **gestores de version del usuario** (sdkman, nvm, pyenv, asdf, rustup) en vez de `sudo apt`.

**Cuando usar host**: cuando no tienes Docker instalado, cuando ya tienes el runtime configurado y prefieres reutilizarlo, o cuando trabajas en un proyecto pequeño donde el aislamiento agrega friccion sin valor.

## Como arrancar con devcontainer

Abax Swarm genera el archivo, tu necesitas **Docker Desktop** (o Docker Engine en Linux) corriendo. Tres formas de levantar el container:

### VS Code (la mas comun)

1. Instala la extension oficial: **Dev Containers** (`ms-vscode-remote.remote-containers`).
2. Abre el proyecto en VS Code.
3. Cuando aparezca el banner "**Reopen in Container?**", acepta.
4. Espera (~5 min la primera vez mientras Docker construye y ejecuta los features).
5. Ya estas dentro. La terminal integrada de VS Code te da shell del container.

### JetBrains (IntelliJ, PyCharm, etc.)

1. Settings → Build, Execution, Deployment → Dev Containers.
2. "Create Dev Container and Mount Sources".
3. Apunta al `.devcontainer/devcontainer.json` del proyecto.

### `devcontainer-cli` (sin IDE)

```bash
npm install -g @devcontainers/cli
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

### GitHub Codespaces

Abax Swarm es compatible automaticamente. Click en "Code" → "Codespaces" → "Create codespace on main". GitHub usa el mismo `.devcontainer/devcontainer.json`.

## Alternativa minima: docker-compose.dev.yml

Si prefieres algo mas ligero que devcontainer (sin features automaticos), podes escribir tu propio `docker-compose.dev.yml`. Ejemplo para `angular-springboot`:

```yaml
services:
  dev:
    image: eclipse-temurin:21-jdk
    working_dir: /workspace
    volumes:
      - .:/workspace
    command: tail -f /dev/null
    environment:
      ABAX_ISOLATED: "1"   # asi el container-detector lo reconoce
```

Levantarlo:

```bash
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec dev bash
# instala maven, node, etc. dentro del container
```

Esta variante **no la genera Abax Swarm** — esta aqui solo como referencia para casos puntuales. Si lo usas, asegurate de setear `ABAX_ISOLATED=1` para que el flujo de `dependency-management` te trate como container.

## Combinaciones recomendadas

| Caso | Permisos | Aislamiento |
|---|---|---|
| Tu maquina personal, proyectos personales | `recommended` | `devcontainer` (o `host` si no usas Docker) |
| Proyecto compartido / cliente | `strict` | `devcontainer` (obligatorio) |
| CI/CD | `strict` | `devcontainer` |
| Sandbox throwaway / experimento de 5 min | `full` | `host` |
| Usuario corporativo en Windows con WSL | `recommended` | `devcontainer` (WSL2 maneja Docker bien) |

## Persistencia

El modo de aislamiento se guarda en `project-manifest.yaml > project.isolation_mode`, y se respeta en `abax-swarm regenerate`. Cambiarlo despues del init: edita el manifest y vuelve a correr regenerate, o edita `.devcontainer/devcontainer.json` directamente.
