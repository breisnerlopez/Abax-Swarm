// Tests for the CLI collapse logic introduced in 0.1.41.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printValidatorFindings } from "../../src/cli/format.js";
import type { PipelineResult } from "../../src/cli/pipeline.js";

function makeResult(
  warnings: string[],
  notices: string[],
  sponsorApprovals: PipelineResult["sponsorApprovals"] = [],
): PipelineResult {
  return {
    project: {} as PipelineResult["project"],
    files: [],
    orchestratorWarnings: warnings,
    orchestratorNotices: notices,
    sponsorApprovals,
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

  // Sponsor approvals (0.1.42): always shown, never collapsed past
  // SPONSOR_PREVIEW=8. Visible signal even when warnings/notices empty.
  it("renders sponsor approvals panel before warnings", () => {
    const sponsors = [
      { phaseId: "discovery", phaseName: "Descubrimiento", deliverableId: "vision-producto", deliverableName: "Vision del Producto" },
      { phaseId: "discovery", phaseName: "Descubrimiento", deliverableId: "backlog-priorizado", deliverableName: "Backlog Priorizado" },
    ];
    printValidatorFindings(makeResult([], [], sponsors));
    const joined = logs.join("\n");
    expect(joined).toContain("Aprobaciones que requieren tu rol como sponsor (2)");
    expect(joined).toContain("Vision del Producto");
    expect(joined).toContain("Backlog Priorizado");
    expect(joined).toContain("aprobación explícita");
  });

  it("collapses sponsor approvals beyond 8 with --verbose escape hatch", () => {
    const sponsors = Array.from({ length: 12 }, (_, i) => ({
      phaseId: `p${i}`, phaseName: `Phase ${i}`,
      deliverableId: `d${i}`, deliverableName: `Deliverable ${i}`,
    }));
    printValidatorFindings(makeResult([], [], sponsors));
    const joined = logs.join("\n");
    expect(joined).toContain("(12)");
    expect(joined).toContain("Deliverable 0");
    expect(joined).toContain("Deliverable 7"); // 8th is shown (0-indexed)
    expect(joined).not.toContain("Deliverable 8");
    expect(joined).toContain("y 4 más");
  });

  it("verbose mode prints all sponsor approvals inline", () => {
    const sponsors = Array.from({ length: 12 }, (_, i) => ({
      phaseId: `p${i}`, phaseName: `Phase ${i}`,
      deliverableId: `d${i}`, deliverableName: `Deliverable ${i}`,
    }));
    printValidatorFindings(makeResult([], [], sponsors), true);
    const joined = logs.join("\n");
    for (let i = 0; i < 12; i++) {
      expect(joined).toContain(`Deliverable ${i}`);
    }
    expect(joined).not.toContain("y 4 más");
  });

  it("triple panel: sponsor + warnings + notices all rendered", () => {
    const sponsors = [
      { phaseId: "p", phaseName: "P", deliverableId: "d", deliverableName: "D" },
    ];
    printValidatorFindings(makeResult(["a warning"], ["a notice"], sponsors));
    const joined = logs.join("\n");
    expect(joined).toContain("Aprobaciones que requieren tu rol como sponsor (1)");
    expect(joined).toContain("Advertencias del orquestador (1)");
    expect(joined).toContain("a warning");
    expect(joined).toContain("nota informativa");
  });

  it("sponsor-only output: no warnings/notices, only sponsor panel", () => {
    const sponsors = [
      { phaseId: "p", phaseName: "P", deliverableId: "d", deliverableName: "D" },
    ];
    printValidatorFindings(makeResult([], [], sponsors));
    const joined = logs.join("\n");
    expect(joined).toContain("Aprobaciones que requieren tu rol como sponsor (1)");
    expect(joined).not.toContain("Advertencias del orquestador");
    expect(joined).not.toContain("notas informativas");
  });
});
