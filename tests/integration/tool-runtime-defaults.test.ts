import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import type { DataContext } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

// ===========================================================================
// GUARD RAIL — every tool with `default:` in schema must have runtime fallback
// ===========================================================================
//
// Why this exists (incident create-presentation 2026-05-03 0.1.32):
// `tool.schema.string().default("X")` describes the contract to the LLM but the
// `@opencode-ai/plugin` SDK does NOT apply that default at runtime when the
// LLM omits the arg. So `args.X` arrives as `undefined`. If the body uses it
// directly (template string, .replace, .includes), it fails or emits "undefined"
// in the output.
//
// Fix pattern applied uniformly to all 7 tools in 0.1.32 + 0.1.33:
//
//     const x = args.x || "<default>";
//
// before any usage of `x` in the body. This guard verifies the pattern.
// ---------------------------------------------------------------------------

describe("tool-runtime-defaults guard: all tools with schema defaults have runtime fallback", () => {
  it.each([
    "create-presentation",
    "create-document",
    "create-dashboard",
    "generate-diagram",
    "db-migrate",
    "lint-code",
    "run-tests",
  ])("tool %s has runtime defaults for args with schema default", (toolId) => {
    const tool = ctx.tools.get(toolId)!;
    expect(tool, `tool ${toolId} not found`).toBeDefined();
    const args = tool.implementation?.args ?? {};
    const body = tool.implementation?.body ?? "";

    // For each arg with a `default:` in schema, the body must declare a
    // runtime fallback OR use the arg defensively (e.g., includes/?? check).
    const argsWithDefault = Object.entries(args).filter(([, def]) => def.default !== undefined);
    for (const [argName] of argsWithDefault) {
      const camelOrSnake = argName;
      const camelCase = argName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

      // Defensive patterns accepted (any of):
      //   1. const X = args.argName || "default"   |   const X = args.argName ?? "default"
      //   2. validX.includes(args.argName) ? args.argName : "default"   (Set/array check)
      //   3. validX.has(args.argName) ? args.argName : "default"
      //   4. args.argName ? <truthy-branch> : <falsy-branch>            (boolean defensive ternary)
      const hasRuntimeFallback =
        new RegExp(`const\\s+(${camelOrSnake}|${camelCase})\\s*=\\s*args\\.${argName}\\s*(\\|\\||\\?\\?)`).test(body) ||
        new RegExp(`(includes|has)\\(args\\.${argName}\\)\\s*\\?`).test(body) ||
        new RegExp(`args\\.${argName}\\s*\\?[^?]`).test(body); // boolean defensive ternary

      expect(
        hasRuntimeFallback,
        `tool ${toolId}: arg \`${argName}\` has schema default but no runtime fallback in body. Add \`const ${camelCase} = args.${argName} || "<default>"\` before using it.`,
      ).toBe(true);
    }
  });

  it("create-presentation specifically: defensive escape function tolerates undefined", () => {
    const tool = ctx.tools.get("create-presentation")!;
    expect(tool.implementation?.body).toMatch(/String\(s \?\? ""\)\.replace/);
  });

  it("documents the pattern in the body comment for future tools", () => {
    // Each tool's body should mention "Runtime defaults" as a marker so
    // future maintainers see the pattern when adding new tools.
    for (const id of [
      "create-presentation",
      "create-document",
      "create-dashboard",
      "generate-diagram",
      "db-migrate",
      "lint-code",
      "run-tests",
    ]) {
      const tool = ctx.tools.get(id)!;
      expect(
        tool.implementation?.body,
        `tool ${id} body lacks "Runtime defaults" marker comment`,
      ).toMatch(/Runtime defaults|defensive|incidente create-presentation/i);
    }
  });
});
