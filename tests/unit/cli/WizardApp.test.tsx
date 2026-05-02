import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { WizardApp } from "../../../src/cli/WizardApp.tsx";
import { loadDataContext } from "../../../src/cli/data-context.ts";

const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const CTRL_B = "";

describe("WizardApp", () => {
  const ctx = loadDataContext();

  it("renders the header and step 1 (target directory)", async () => {
    const { lastFrame, unmount } = render(
      <WizardApp ctx={ctx} options={{ dryRun: true }} />,
    );
    await wait();
    const out = lastFrame() ?? "";
    expect(out).toContain("Abax Swarm");
    expect(out).toContain("Paso 1");
    expect(out).toContain("Directorio del proyecto");
    expect(out).toContain("Ruta del proyecto destino");
    unmount();
  });

  it("after typing path + Enter shows the project-mode step", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "abax-wiz-"));
    try {
      const { stdin, lastFrame, unmount } = render(
        <WizardApp ctx={ctx} options={{ dryRun: true }} />,
      );
      await wait();
      stdin.write(tmp);
      await wait();
      stdin.write("\r");
      await wait(150);
      const out = lastFrame() ?? "";
      expect(out).toContain("Modo de proyecto");
      expect(out).toContain("Implementar algo nuevo");
      expect(out).toContain("Documentar algo existente");
      unmount();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("selecting 'Implementar algo nuevo' advances to platform step", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "abax-wiz-"));
    try {
      const { stdin, lastFrame, unmount } = render(
        <WizardApp ctx={ctx} options={{ dryRun: true }} />,
      );
      await wait();
      stdin.write(tmp);
      await wait();
      stdin.write("\r"); // submit path
      await wait(150);
      stdin.write("\r"); // accept default project mode (Implementar nuevo)
      await wait(150);
      const out = lastFrame() ?? "";
      expect(out).toContain("Plataforma");
      expect(out).toContain("OpenCode");
      expect(out).toContain("Claude Code");
      unmount();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("Ctrl+B returns to the previous step", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "abax-wiz-"));
    try {
      const { stdin, lastFrame, unmount } = render(
        <WizardApp ctx={ctx} options={{ dryRun: true }} />,
      );
      await wait();
      stdin.write(tmp);
      await wait();
      stdin.write("\r");
      await wait(150);
      // We are now on the project-mode step. Ctrl+B returns to target-dir.
      stdin.write(CTRL_B);
      await wait();
      const out = lastFrame() ?? "";
      expect(out).toContain("Directorio del proyecto");
      unmount();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("shows the sidebar after the target-dir step", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "abax-wiz-"));
    try {
      const { stdin, lastFrame, unmount } = render(
        <WizardApp ctx={ctx} options={{ dryRun: true }} />,
      );
      await wait();
      stdin.write(tmp);
      await wait();
      stdin.write("\r");
      await wait(150);
      const out = lastFrame() ?? "";
      expect(out).toContain("Resumen");
      expect(out).toContain("Directorio");
      unmount();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
