import { describe, it, expect, beforeAll } from "vitest";
import { loadDataContext } from "../../src/cli/data-context.js";
import type { DataContext } from "../../src/engine/types.js";

let ctx: DataContext;

beforeAll(() => {
  ctx = loadDataContext();
});

describe("create-presentation tool: defensive against undefined args", () => {
  it("body has runtime defaults for presentation_type and audience", () => {
    const tool = ctx.tools.get("create-presentation");
    expect(tool).toBeDefined();
    const body = tool!.implementation?.body ?? "";
    expect(body).toMatch(/args\.presentation_type \?\? "status"/);
    expect(body).toMatch(/args\.audience \?\? "executive"/);
  });

  it("escape function tolerates undefined input (defensive)", () => {
    const tool = ctx.tools.get("create-presentation")!;
    const body = tool.implementation?.body ?? "";
    // Must coerce to string and not call .replace on undefined
    expect(body).toMatch(/String\(s \?\? ""\)\.replace/);
    // Old buggy signature must NOT exist
    expect(body).not.toMatch(/^\s*const escape = \(s: string\): string =>\s*$/m);
  });

  it("references audience and presentationType local vars (not args.X) in HTML emission", () => {
    const tool = ctx.tools.get("create-presentation")!;
    const body = tool.implementation?.body ?? "";
    // Audiencia line uses local `audience` not args.audience (avoids the bug)
    expect(body).toMatch(/Audiencia:.*\$\{escape\(audience\)\}/);
    // Type label uses presentationType local
    expect(body).toMatch(/typeLabels\[presentationType\]/);
  });

  it("documents the incident in the body comment for future reference", () => {
    const tool = ctx.tools.get("create-presentation")!;
    expect(tool.implementation?.body).toMatch(/incident.*2026-05-03|ses_21088afdeffe/i);
  });
});
