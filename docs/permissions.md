# Permisos de OpenCode

OpenCode tiene un sistema de permisos granular: cada herramienta (`bash`, `read`, `edit`, `webfetch`, etc.) puede estar en `allow`, `ask` o `deny`, a nivel global o por agente. Abax Swarm te ofrece **3 modos preconfigurados** en el wizard, mas la flexibilidad de seguir editando `opencode.json` despues.

La fuente de verdad del codigo vive en [`src/engine/permissions.ts`](../src/engine/permissions.ts). El bloque `permission` raiz que genera se inyecta en `opencode.json`; los `agent.<id>.permission` que ya existian por agente **siguen overrideando** el global por clave (regla de OpenCode: agent rules take precedence).

## Los 3 modos

### `strict`
- **No emite** bloque `permission` raiz.
- Solo los permisos por agente se aplican (lo que Abax Swarm ya hacia antes de 0.1.14).
- Cada accion bash/edit/read pide confirmacion al usuario individualmente.
- **Cuando usar**: proyectos con clientes, codigo en produccion, situaciones donde quieres revisar cada accion del agente. Es el mas seguro pero el mas pesado de operar.

### `recommended` (default)
- Emite `permission` raiz con un objeto granular.
- **Allowlist** para comandos comunes de desarrollo (`git *`, `npm *`, `mvn *`, `pip *`, `python *`, `node *`, `go *`, `cargo *`, `dotnet *`, `flutter *`, `docker *`, `make *`, `cat *`, `ls *`, `pwd`, `grep *`, `find *`, etc.).
- **Allowlist** para gestores de version del usuario (`sdk *`, `nvm *`, `pyenv *`, `rbenv *`, `asdf *`, `rustup *`).
- **Denylist** para operaciones claramente peligrosas:
  - `git push --force *`, `chmod 777 *`
  - `rm /var/* *`, `rm /etc/* *`, `rm /usr/* *`, `rm /var/lib/dpkg/* *` (raiz del incidente que motivo este feature)
  - `curl * | sh`, `wget * | bash` (shell injection)
- **Compatible con el flujo git distribuido** (ver [git-collaboration.md](git-collaboration.md)): `git *` en `allow` permite a cada agente hacer `git add` + `git commit --author "<rol>"` despues de su entregable, y a devops hacer `git push -u origin abax/<project-name>` al cierre de fase. La denylist de `git push --force *` impide cualquier override destructivo.
- **Container-aware**: `apt *`, `apt-get *`, `dpkg *`, `sudo *`, `brew *` estan en `ask` cuando `isolationMode === "host"` (afectan al SO del usuario), pero pasan automaticamente a `allow` cuando `isolationMode === "devcontainer"` (solo afectan al container, son seguros).
- **Cuando usar**: tu maquina personal en proyectos donde sabes lo que haces. Default recomendado para la mayoria de los casos.

### `full`
- Emite `"permission": "allow"` literal en la raiz.
- **Sin restricciones**. El agente puede ejecutar cualquier comando sin pedir confirmacion.
- El wizard te muestra una advertencia en amarillo antes de elegirlo.
- **Cuando usar**: proyectos sandbox/throwaway en tu maquina personal. **Nunca** en proyectos compartidos, en CI/CD, ni en codigo que vaya a produccion.

## Por que esto importa: el incidente que lo motivo

En la sesion `ses_217c43466ffe...` (mayo 2026), un agente devops llego a fase Construccion sin que el runtime estuviera instalado. Cuando intento `mvn install`, fallo. La remediacion automatica termino ejecutando:

```
rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock && dpkg --configure -a && apt-get install ...
```

**Borrar los lockfiles de dpkg del sistema** sin pedir confirmacion al usuario. Funciono por suerte (no habia otro `apt` activo), pero pudo corromper la base de paquetes.

El modo `recommended` previene esto en dos niveles:
1. La denylist explicita `rm /var/* *: deny` y `rm /var/lib/dpkg/* *: deny` bloquean el comando antes de ejecutarlo. El agente recibe un error y debe replantear.
2. Si el agente intenta `apt-get install` en modo host, `ask` lo bloquea hasta que el usuario apruebe. La intencion sale a la luz antes de la accion.

Combinado con el skill [`dependency-management`](../data/skills/dependency-management.yaml) y el devcontainer (ver [dependency-management.md](dependency-management.md)), el flujo natural es:
1. El agente devops verifica el runtime al inicio de Construccion.
2. Si falta, propone instalarlo con aprobacion del usuario.
3. Dentro de container: `apt` en `allow` automatico → instala.
4. En host: usa `sdkman`/`nvm`/`pyenv` (en `allow`), nunca `sudo apt`.

## Override por agente

El bloque `permission` raiz es el default global; los `agent.<id>.permission` lo overridean por clave. Por ejemplo, el orquestador siempre se genera con `bash: deny` para forzarlo a delegar — sin importar el modo elegido a nivel global.

## Cambiarlo despues del init

Edita `opencode.json` directamente. La estructura sigue [opencode.ai/docs/permissions](https://opencode.ai/docs/permissions). Los cambios aplican inmediatamente al reiniciar OpenCode.

## Persistencia

El modo elegido se guarda en `project-manifest.yaml > project.permission_mode`, y se respeta en `abax-swarm regenerate`.
