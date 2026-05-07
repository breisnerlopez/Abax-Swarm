// Tests for the CLI collapse logic introduced in 0.1.41.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printValidatorFindings } from "../../src/cli/format.js";
import type { PipelineResult } from "../../src/cli/pipeline.js";

function makeResult(warnings: string[], notices: string[]): PipelineResult {
  return {
    project: {} as PipelineResult["project"],
    files: [],
    orchestratorWarnings: warnings,
    orchestratorNotices: notices,
  };
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("printValidatorFindings collapse logic", () => {
  let logs: string[] = [];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      logs.push(stripAnsi(String(msg)));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("prints nothing when both warnings and notices are empty", () => {
    printValidatorFindings(makeResult([], []));
    expect(logs).toEqual([]);
  });

  it("prints all warnings inline when count <= 10", () => {
    const ws = Array.from({ length: 7 }, (_, i) => `warning #${i + 1}`);
    printValidatorFindings(makeResult(ws, []));
    const joined = logs.join("\n");
    expect(joined).toContain("Advertencias del orquestador (7)");
    for (const w of ws) {
      expect(joined).toContain(w);
    }
  });

  it("collapses warnings when count > 10: shows first 5 + hint", () => {
    const ws = Array.from({ length: 15 }, (_, i) => `warning #${i + 1}`);
    printValidatorFindings(makeResult(ws, []));
    const joined = logs.join("\n");
    expect(joined).toContain("Advertencias del orquestador (15)");
    for (let i = 1; i <= 5; i++) {
      expect(joined).toContain(`warning #${i}`);
    }
    for (let i = 6; i <= 15; i++) {
      expect(joined).not.toContain(`warning #${i}`);
    }
    expect(joined).toContain("y 10 más");
    expect(joined).toContain("abax-swarm validate");
  });

  it("prints notice count summary when notices > 0", () => {
    const ns = Array.from({ length: 83 }, (_, i) => `notice #${i + 1}`);
    printValidatorFindings(makeResult([], ns));
    const joined = logs.join("\n");
    expect(joined).toContain("83");
    expect(joined).toContain("notas informativas");
    expect(joined).not.toContain("notice #1");
    expect(joined).toContain("--verbose");
  });

  it("uses singular form for exactly 1 notice", () => {
    printValidatorFindings(makeResult([], ["single notice"]));
    const joined = logs.join("\n");
    expect(joined).toContain("1 nota informativa");
    expect(joined).not.toContain("notas informativas");
  });

  it("verbose mode prints all warnings + all notices inline", () => {
    const ws = Array.from({ length: 15 }, (_, i) => `w${i}`);
    const ns = Array.from({ length: 8 }, (_, i) => `n${i}`);
    printValidatorFindings(makeResult(ws, ns), true);
    const joined = logs.join("\n");
    for (const w of ws) expect(joined).toContain(w);
    for (const n of ns) expect(joined).toContain(n);
    expect(joined).not.toContain("y 10 más");
  });

  it("user-scenario shape: 0 warnings + 83 notices → only the notice count line", () => {
    const ns = Array.from({ length: 83 }, (_, i) => `n${i}`);
    printValidatorFindings(makeResult([], ns));
    const joined = logs.join("\n");
    expect(joined).not.toContain("Advertencias del orquestador");
    expect(joined).toContain("83 notas informativas");
  });
});
