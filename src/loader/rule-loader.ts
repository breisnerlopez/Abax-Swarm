import { join } from "path";
import { fileURLToPath } from "url";
import {
  SizeMatrixSchema,
  CriteriaRulesSchema,
  DependencyGraphSchema,
  RaciMatrixSchema,
  IronLawsSchema,
  AntiRationalizationSchema,
  PhaseDeliverablesSchema,
  DocumentModeSchema,
  TaskContractsSchema,
  SecretPatternsSchema,
  RunawayLimitsSchema,
  IterationScopesSchema,
  type SizeMatrix,
  type CriteriaRules,
  type DependencyGraph,
  type RaciMatrix,
  type IronLaws,
  type AntiRationalization,
  type PhaseDeliverables,
  type DocumentModeData,
  type TaskContracts,
  type SecretPatterns,
  type RunawayLimits,
  type IterationScopes,
} from "./schemas.js";
import { loadYamlFile } from "./yaml-loader.js";

const __loaderDir = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_RULES_DIR = join(__loaderDir, "../../data/rules");

export function loadSizeMatrix(dirPath: string = DEFAULT_RULES_DIR): SizeMatrix {
  return loadYamlFile(join(dirPath, "size-matrix.yaml"), SizeMatrixSchema).data;
}

export function loadCriteriaRules(dirPath: string = DEFAULT_RULES_DIR): CriteriaRules {
  return loadYamlFile(join(dirPath, "criteria-rules.yaml"), CriteriaRulesSchema).data;
}

export function loadDependencyGraph(dirPath: string = DEFAULT_RULES_DIR): DependencyGraph {
  return loadYamlFile(join(dirPath, "dependency-graph.yaml"), DependencyGraphSchema).data;
}

export function loadRaciMatrix(dirPath: string = DEFAULT_RULES_DIR): RaciMatrix {
  return loadYamlFile(join(dirPath, "raci-matrix.yaml"), RaciMatrixSchema).data;
}

export function loadIronLaws(dirPath: string = DEFAULT_RULES_DIR): IronLaws {
  return loadYamlFile(join(dirPath, "iron-laws.yaml"), IronLawsSchema).data;
}

export function loadAntiRationalization(dirPath: string = DEFAULT_RULES_DIR): AntiRationalization {
  return loadYamlFile(join(dirPath, "anti-rationalization.yaml"), AntiRationalizationSchema).data;
}

export function loadPhaseDeliverables(dirPath: string = DEFAULT_RULES_DIR): PhaseDeliverables {
  return loadYamlFile(join(dirPath, "phase-deliverables.yaml"), PhaseDeliverablesSchema).data;
}

export function loadDocumentMode(dirPath: string = DEFAULT_RULES_DIR): DocumentModeData {
  return loadYamlFile(join(dirPath, "document-mode.yaml"), DocumentModeSchema).data;
}

export function loadTaskContracts(dirPath: string = DEFAULT_RULES_DIR): TaskContracts {
  return loadYamlFile(join(dirPath, "task-contracts.yaml"), TaskContractsSchema).data;
}

export function loadSecretPatterns(dirPath: string = DEFAULT_RULES_DIR): SecretPatterns {
  return loadYamlFile(join(dirPath, "secret-patterns.yaml"), SecretPatternsSchema).data;
}

export function loadRunawayLimits(dirPath: string = DEFAULT_RULES_DIR): RunawayLimits {
  return loadYamlFile(join(dirPath, "runaway-limits.yaml"), RunawayLimitsSchema).data;
}

export function loadIterationScopes(dirPath: string = DEFAULT_RULES_DIR): IterationScopes {
  return loadYamlFile(join(dirPath, "iteration-scopes.yaml"), IterationScopesSchema).data;
}

export interface AllRules {
  sizeMatrix: SizeMatrix;
  criteria: CriteriaRules;
  dependencies: DependencyGraph;
  raci: RaciMatrix;
  ironLaws: IronLaws;
  antiRationalization: AntiRationalization;
  phaseDeliverables: PhaseDeliverables;
  documentMode: DocumentModeData;
  taskContracts: TaskContracts;
  secretPatterns: SecretPatterns;
  runawayLimits: RunawayLimits;
  iterationScopes: IterationScopes;
}

export function loadAllRules(dirPath: string = DEFAULT_RULES_DIR): AllRules {
  return {
    sizeMatrix: loadSizeMatrix(dirPath),
    criteria: loadCriteriaRules(dirPath),
    dependencies: loadDependencyGraph(dirPath),
    raci: loadRaciMatrix(dirPath),
    ironLaws: loadIronLaws(dirPath),
    antiRationalization: loadAntiRationalization(dirPath),
    phaseDeliverables: loadPhaseDeliverables(dirPath),
    documentMode: loadDocumentMode(dirPath),
    taskContracts: loadTaskContracts(dirPath),
    secretPatterns: loadSecretPatterns(dirPath),
    runawayLimits: loadRunawayLimits(dirPath),
    iterationScopes: loadIterationScopes(dirPath),
  };
}
