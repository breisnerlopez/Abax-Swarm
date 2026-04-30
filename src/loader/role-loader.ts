import { join } from "path";
import { fileURLToPath } from "url";
import { RoleSchema, type Role } from "./schemas.js";
import { loadYamlFile, loadYamlDirectory, type LoadResult, type LoadAllResult } from "./yaml-loader.js";

const __loaderDir = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_ROLES_DIR = join(__loaderDir, "../../data/roles");

export function loadRole(filePath: string): LoadResult<Role> {
  return loadYamlFile(filePath, RoleSchema);
}

export function loadAllRoles(dirPath: string = DEFAULT_ROLES_DIR): LoadAllResult<Role> {
  return loadYamlDirectory(dirPath, RoleSchema);
}

export function loadRolesAsMap(dirPath: string = DEFAULT_ROLES_DIR): Map<string, Role> {
  const result = loadAllRoles(dirPath);
  if (result.errors.length > 0) {
    const msgs = result.errors.map((e) => `${e.filePath}: ${e.errors.join(", ")}`);
    throw new Error(`Failed to load roles:\n${msgs.join("\n")}`);
  }
  const map = new Map<string, Role>();
  for (const item of result.items) {
    map.set(item.data.id, item.data);
  }
  return map;
}
