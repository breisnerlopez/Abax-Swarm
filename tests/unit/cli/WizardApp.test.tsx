import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { WizardApp } from "../../../src/cli/WizardApp.tsx";
import { loadDataContext } from "../../../src/cli/data-context.ts";

const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));

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

  it("advances to step 2 (platform) after typing path + Enter", async () => {
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
      // We are now on step 2 (platform). Press Ctrl+B ().
      stdin.write("");
      await wait();
      const out = lastFrame() ?? "";
      expect(out).toContain("Directorio del proyecto");
      unmount();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("shows the sidebar starting at step 2", async () => {
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
