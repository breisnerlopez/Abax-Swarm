import { join } from "path";
import { fileURLToPath } from "url";
import { ToolSchema, type Tool } from "./schemas.js";
import { loadYamlFile, loadYamlDirectory, type LoadResult, type LoadAllResult } from "./yaml-loader.js";

const __loaderDir = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_TOOLS_DIR = join(__loaderDir, "../../data/tools");

export function loadTool(filePath: string): LoadResult<Tool> {
  return loadYamlFile(filePath, ToolSchema);
}

export function loadAllTools(dirPath: string = DEFAULT_TOOLS_DIR): LoadAllResult<Tool> {
  return loadYamlDirectory(dirPath, ToolSchema);
}

export function loadToolsAsMap(dirPath: string = DEFAULT_TOOLS_DIR): Map<string, Tool> {
  const result = loadAllTools(dirPath);
  if (result.errors.length > 0) {
    const msgs = result.errors.map((e) => `${e.filePath}: ${e.errors.join(", ")}`);
    throw new Error(`Failed to load tools:\n${msgs.join("\n")}`);
  }
  const map = new Map<string, Tool>();
  for (const item of result.items) {
    map.set(item.data.id, item.data);
  }
  return map;
}
