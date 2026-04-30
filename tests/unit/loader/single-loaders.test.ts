import { describe, it, expect } from "vitest";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { loadRole, loadRolesAsMap } from "../../../src/loader/role-loader.js";
import { loadSkill, loadSkillsAsMap } from "../../../src/loader/skill-loader.js";
import { loadTool, loadToolsAsMap } from "../../../src/loader/tool-loader.js";
import { loadStack, loadStacksAsMap } from "../../../src/loader/stack-loader.js";

const DATA_DIR = join(__dirname, "../../../data");
const TMP = join(__dirname, "../../../.tmp-loader-test");

describe("Single file loaders", () => {
  it("loadRole should load a single role file", () => {
    const result = loadRole(join(DATA_DIR, "roles/business-analyst.yaml"));
    expect(result.data.id).toBe("business-analyst");
    expect(result.data.tier).toBe("1");
  });

  it("loadSkill should load a single skill file", () => {
    const result = loadSkill(join(DATA_DIR, "skills/functional-analysis.yaml"));
    expect(result.data.id).toBe("functional-analysis");
  });

  it("loadTool should load a single tool file", () => {
    const result = loadTool(join(DATA_DIR, "tools/generate-diagram.yaml"));
    expect(result.data.id).toBe("generate-diagram");
  });

  it("loadStack should load a single stack file", () => {
    const result = loadStack(join(DATA_DIR, "stacks/angular-springboot.yaml"));
    expect(result.data.id).toBe("angular-springboot");
  });
});

describe("Loader error branches (loadAsMap with errors)", () => {
  it("loadRolesAsMap should throw on invalid directory", () => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "bad.yaml"), "id: x\ntier: invalid\n");
    try {
      expect(() => loadRolesAsMap(TMP)).toThrow("Failed to load roles");
    } finally {
      rmSync(TMP, { recursive: true, force: true });
    }
  });

  it("loadSkillsAsMap should throw on invalid directory", () => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "bad.yaml"), "id: x\n");
    try {
      expect(() => loadSkillsAsMap(TMP)).toThrow("Failed to load skills");
    } finally {
      rmSync(TMP, { recursive: true, force: true });
    }
  });

  it("loadToolsAsMap should throw on invalid directory", () => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "bad.yaml"), "id: x\n");
    try {
      expect(() => loadToolsAsMap(TMP)).toThrow("Failed to load tools");
    } finally {
      rmSync(TMP, { recursive: true, force: true });
    }
  });

  it("loadStacksAsMap should throw on invalid directory", () => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "bad.yaml"), "id: x\n");
    try {
      expect(() => loadStacksAsMap(TMP)).toThrow("Failed to load stacks");
    } finally {
      rmSync(TMP, { recursive: true, force: true });
    }
  });
});
