import { describe, it, expect, afterEach } from "vitest";
import { join } from "path";
import { readFileSync, rmSync, existsSync } from "fs";
import { writeGeneratedFiles } from "../../../src/generator/opencode/agent-generator.js";
import type { GeneratedFile } from "../../../src/generator/opencode/agent-generator.js";

const TMP_DIR = join(__dirname, "../../../.tmp-test-write");

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("writeGeneratedFiles", () => {
  it("should write files to disk with correct content", () => {
    const files: GeneratedFile[] = [
      { path: ".opencode/agents/test.md", content: "# Test Agent\n" },
      { path: "opencode.json", content: '{"test": true}\n' },
    ];

    writeGeneratedFiles(files, TMP_DIR);

    const agent = readFileSync(join(TMP_DIR, ".opencode/agents/test.md"), "utf-8");
    expect(agent).toBe("# Test Agent\n");

    const config = readFileSync(join(TMP_DIR, "opencode.json"), "utf-8");
    expect(config).toBe('{"test": true}\n');
  });

  it("should create nested directories", () => {
    const files: GeneratedFile[] = [
      { path: ".opencode/skills/test/SKILL.md", content: "skill" },
      { path: ".opencode/skills/test/guides/guide1.md", content: "guide" },
    ];

    writeGeneratedFiles(files, TMP_DIR);

    expect(existsSync(join(TMP_DIR, ".opencode/skills/test/SKILL.md"))).toBe(true);
    expect(existsSync(join(TMP_DIR, ".opencode/skills/test/guides/guide1.md"))).toBe(true);
  });
});
