import { join } from "path";
import { fileURLToPath } from "url";
import { StackSchema, type Stack } from "./schemas.js";
import { loadYamlFile, loadYamlDirectory, type LoadResult, type LoadAllResult } from "./yaml-loader.js";

const __loaderDir = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_STACKS_DIR = join(__loaderDir, "../../data/stacks");

export function loadStack(filePath: string): LoadResult<Stack> {
  return loadYamlFile(filePath, StackSchema);
}

export function loadAllStacks(dirPath: string = DEFAULT_STACKS_DIR): LoadAllResult<Stack> {
  return loadYamlDirectory(dirPath, StackSchema);
}

export function loadStacksAsMap(dirPath: string = DEFAULT_STACKS_DIR): Map<string, Stack> {
  const result = loadAllStacks(dirPath);
  if (result.errors.length > 0) {
    const msgs = result.errors.map((e) => `${e.filePath}: ${e.errors.join(", ")}`);
    throw new Error(`Failed to load stacks:\n${msgs.join("\n")}`);
  }
  const map = new Map<string, Stack>();
  for (const item of result.items) {
    map.set(item.data.id, item.data);
  }
  return map;
}
