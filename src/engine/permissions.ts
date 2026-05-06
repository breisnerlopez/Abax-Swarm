import type { PermissionMode, IsolationMode } from "./types.js";

/**
 * Returns the JSON object to inject as the root `permission` field of
 * opencode.json given the user's choices.
 *
 * - "strict":      undefined → no root permission, only per-agent (current behaviour).
 * - "recommended": granular allowlist + denylist. Container-aware: when isolation
 *                  is "devcontainer", apt/dpkg/sudo drop to "allow" because they
 *                  only affect the container. When "host", they remain in "ask"
 *                  to force user approval.
 * - "full":        explicit object `{ "*": "allow", "bash": { "*": "allow" },
 *                  "external_directory": "allow" }` — bypass total sin patterns
 *                  en `ask`. La estructura objeto (no string "allow") es
 *                  necesaria para overridear los prompts hardcoded de OpenCode
 *                  v1.14.x sobre operaciones git. La wizard banners this.
 *
 * The per-agent permissions (agent.<id>.permission) override this root, so the
 * orchestrator's bash:deny stays intact.
 *
 * Reference: https://opencode.ai/docs/permissions
 */
export function buildOpenCodePermission(
  mode: PermissionMode,
  isolation: IsolationMode,
): unknown | undefined {
  if (mode === "strict") return undefined;
  if (mode === "full") {
    // 0.1.37: full = TOTAL bypass por decision del usuario.
    // Solicitud explicita: "esa opcion es la de permisos completos, esa es
    // la que deberia setearll" — full debe significar full sin asteriscos.
    //
    // Cero patterns en `ask`. Estructura objeto explicita para evitar el bug
    // de OpenCode v1.14.x con hardcoded git prompts (que ocurria con string
    // "allow" en 0.1.13-0.1.33).
    //
    // Si el usuario quiere alguna salvaguarda (ej. preservar rm -rf en ask),
    // usar mode `recommended` que tiene safety patterns extensos por defecto.
    // `full` es opt-in explicito a "no me pidas nada, se lo que hago".
    //
    // Historia:
    // - 0.1.13-0.1.33: full devolvia string "allow" -> bug v1.14.x con git.
    // - 0.1.34: objeto explicito sin root catch-all -> echo pedia permission.
    // - 0.1.35: agregado root "*", git destructivos en ask.
    // - 0.1.36: removidos git destructivos, solo rm -rf y sudo en ask.
    // - 0.1.37: removidos rm -rf y sudo. Full = full. Sin asteriscos.
    return {
      "*": "allow",
      bash: { "*": "allow" },
      external_directory: "allow",
    };
  }

  // recommended
  const insideContainer = isolation === "devcontainer";
  return {
    bash: {
      "*": "ask",
      // Common dev commands — safe to allow
      "git *": "allow",
      "npm *": "allow",
      "pnpm *": "allow",
      "yarn *": "allow",
      "bun *": "allow",
      "mvn *": "allow",
      "gradle *": "allow",
      "pip *": "allow",
      "pipx *": "allow",
      "uv *": "allow",
      "python *": "allow",
      "python3 *": "allow",
      "node *": "allow",
      "go *": "allow",
      "cargo *": "allow",
      "dotnet *": "allow",
      "flutter *": "allow",
      "dart *": "allow",
      "docker *": "allow",
      "docker-compose *": "allow",
      "compose *": "allow",
      "make *": "allow",
      "cat *": "allow",
      "ls *": "allow",
      "pwd": "allow",
      "echo *": "allow",
      "grep *": "allow",
      "find *": "allow",
      "head *": "allow",
      "tail *": "allow",
      "wc *": "allow",
      "which *": "allow",
      "command -v *": "allow",
      "test *": "allow",
      "[ *": "allow",
      // Version managers (host installs go here, never sudo apt)
      "sdk *": "allow",
      "nvm *": "allow",
      "pyenv *": "allow",
      "rbenv *": "allow",
      "asdf *": "allow",
      "rustup *": "allow",
      // Package managers — context-aware
      "apt *": insideContainer ? "allow" : "ask",
      "apt-get *": insideContainer ? "allow" : "ask",
      "dpkg *": insideContainer ? "allow" : "ask",
      "brew *": insideContainer ? "allow" : "ask",
      "yum *": insideContainer ? "allow" : "ask",
      "dnf *": insideContainer ? "allow" : "ask",
      "apk *": insideContainer ? "allow" : "ask",
      // sudo escalates ALWAYS via ask, except inside container where it's a no-op risk
      "sudo *": insideContainer ? "allow" : "ask",
      // Destructive — explicit ask or deny
      "rm *": "ask",
      "rm -rf *": "ask",
      "git push --force *": "deny",
      "git push -f *": "deny",
      "git reset --hard *": "ask",
      "chmod 777 *": "deny",
      "chmod -R 777 *": "deny",
      // Specific block from the real incident: never touch system lockfiles or /etc, /var, /usr
      "rm /var/* *": "deny",
      "rm /etc/* *": "deny",
      "rm /usr/* *": "deny",
      "rm /var/lib/dpkg/* *": "deny",
      // Shell injection risk
      "curl * | sh": "deny",
      "curl * | bash": "deny",
      "wget * | sh": "deny",
      "wget * | bash": "deny",
    },
    // *.env stays denied by default (OpenCode built-in), no need to override.
    // Web access: ask by default — user wants to know if an agent goes online.
    webfetch: "ask",
    websearch: "allow",
    // External directory access (outside the workspace) — always ask.
    external_directory: "ask",
  };
}

/**
 * Adjust a per-agent permission map according to the project permission mode.
 *
 * Why this exists (bug fixed in 0.1.31):
 * `buildOpenCodePermission()` returns the ROOT permission of opencode.json.
 * In `full` mode the root is `"allow"`. But OpenCode's per-agent permission
 * (`agent.<id>.permission`) **overrides** the root, so each agent kept the
 * defaults from its role YAML — typically `bash: ask`, `webfetch: ask`,
 * `glob: deny`, etc. Result: user picked `full` but still got approval
 * prompts because per-agent overrides leaked through.
 *
 * Behaviour:
 * - `full`:        elevate every `ask` to `allow`. Preserve `deny` so the
 *                  orchestrator (coordinator-only by design) keeps its
 *                  `read: deny`/`bash: deny`/etc. intact.
 * - `recommended`: pass-through. Defaults from role YAML stay as they are.
 * - `strict`:      demote every `allow` to `ask`. Preserve `deny`. Most
 *                  conservative — every agent action requires confirmation.
 */
export function applyModeToAgentPermissions(
  perms: Record<string, string | boolean | undefined> | undefined,
  mode: PermissionMode,
): Record<string, string | boolean | undefined> | undefined {
  if (!perms) return perms;
  if (mode === "recommended") return perms;
  const out: Record<string, string | boolean | undefined> = { ...perms };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (value === "deny") continue; // architectural — preserve always
    if (mode === "full" && value === "ask") out[key] = "allow";
    else if (mode === "strict" && value === "allow") out[key] = "ask";
  }
  return out;
}
