import { describe, it, expect } from "vitest";
import { join } from "path";
import { z } from "zod";
import { loadYamlFile, loadYamlDirectory, YamlValidationError } from "../../../src/loader/yaml-loader.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";

const TMP_DIR = join(__dirname, "../../../.tmp-test");
const TestSchema = z.object({ id: z.string(), value: z.number() });

describe("YamlLoader error handling", () => {
  it("should throw YamlValidationError for invalid schema", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const file = join(TMP_DIR, "bad.yaml");
    writeFileSync(file, "id: test\nvalue: not-a-number\n");

    try {
      expect(() => loadYamlFile(file, TestSchema)).toThrow(YamlValidationError);
    } finally {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it("should throw for non-existent file", () => {
    expect(() => loadYamlFile("/nonexistent/file.yaml", TestSchema)).toThrow();
  });

  it("should collect errors in loadYamlDirectory", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(join(TMP_DIR, "good.yaml"), "id: ok\nvalue: 42\n");
    writeFileSync(join(TMP_DIR, "bad.yaml"), "id: fail\nvalue: nope\n");

    try {
      const result = loadYamlDirectory(TMP_DIR, TestSchema);
      expect(result.items.length).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].filePath).toContain("bad.yaml");
    } finally {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it("should skip files starting with underscore", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(join(TMP_DIR, "_meta.yaml"), "id: skip\nvalue: 0\n");
    writeFileSync(join(TMP_DIR, "valid.yaml"), "id: ok\nvalue: 1\n");

    try {
      const result = loadYamlDirectory(TMP_DIR, TestSchema);
      expect(result.items.length).toBe(1);
      expect(result.items[0].data.id).toBe("ok");
    } finally {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it("should handle non-YamlValidationError in directory load", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(join(TMP_DIR, "corrupt.yaml"), "{{{{invalid yaml content");

    try {
      const result = loadYamlDirectory(TMP_DIR, TestSchema);
      // corrupt YAML causes parse error (not validation), goes to else branch
      expect(result.errors.length).toBe(1);
    } finally {
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
  });

  it("YamlValidationError should contain file path and messages", () => {
    const err = new YamlValidationError("/test.yaml", ["field1: required", "field2: invalid"]);
    expect(err.name).toBe("YamlValidationError");
    expect(err.message).toContain("/test.yaml");
    expect(err.validationErrors).toHaveLength(2);
  });
});
