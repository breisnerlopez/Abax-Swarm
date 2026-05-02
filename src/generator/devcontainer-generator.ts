import type { ProjectConfig } from "../engine/types.js";
import type { GeneratedFile } from "./opencode/agent-generator.js";

/**
 * Per-stack devcontainer features. Maps stack id to a list of
 * Dev Container Features (https://containers.dev/features) that the
 * container will install at build time.
 *
 * The base image is always `mcr.microsoft.com/devcontainers/base:ubuntu`
 * — Ubuntu 24.04 with sudo, git, common utilities. Features add the runtime.
 */
const STACK_FEATURES: Record<string, Record<string, Record<string, string>>> = {
  "react-nextjs": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
  },
  "react-nestjs": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
  },
  "vue-nuxt": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
  },
  "astro-hono": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
  },
  "react-native-expo": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
  },
  "angular-springboot": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
    "ghcr.io/devcontainers/features/java:1": { version: "21", installMaven: "true", mavenVersion: "3.9" },
  },
  "angular-quarkus": {
    "ghcr.io/devcontainers/features/node:1": { version: "20" },
    "ghcr.io/devcontainers/features/java:1": { version: "21", installMaven: "true", mavenVersion: "3.9" },
  },
  "python-fastapi": {
    "ghcr.io/devcontainers/features/python:1": { version: "3.12" },
  },
  "python-django": {
    "ghcr.io/devcontainers/features/python:1": { version: "3.12" },
  },
  "go-fiber": {
    "ghcr.io/devcontainers/features/go:1": { version: "1.22" },
  },
  "rust-axum": {
    "ghcr.io/devcontainers/features/rust:1": { version: "1.80" },
  },
  "dotnet-blazor": {
    "ghcr.io/devcontainers/features/dotnet:2": { version: "8.0" },
  },
  "flutter-dart": {
    // No oficial flutter feature — instala Dart base + postCreateCommand añade Flutter
    "ghcr.io/devcontainers/features/common-utils:2": {},
  },
};

/**
 * Per-stack postCreateCommand. Runs once after the container is built and
 * before the user attaches. Used to install language-specific tooling that
 * isn't covered by features (e.g. Flutter SDK).
 */
const STACK_POST_CREATE: Record<string, string> = {
  "flutter-dart":
    "git clone https://github.com/flutter/flutter.git -b stable /home/vscode/flutter && echo 'export PATH=\"$PATH:/home/vscode/flutter/bin\"' >> /home/vscode/.bashrc",
};

/**
 * VS Code extensions recommended per stack. They install automatically when
 * the user opens the project in VS Code with the Dev Containers extension.
 */
const STACK_EXTENSIONS: Record<string, string[]> = {
  "react-nextjs": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "bradlc.vscode-tailwindcss"],
  "react-nestjs": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"],
  "vue-nuxt": ["Vue.volar", "dbaeumer.vscode-eslint"],
  "astro-hono": ["astro-build.astro-vscode", "dbaeumer.vscode-eslint"],
  "react-native-expo": ["expo.vscode-expo-tools", "dbaeumer.vscode-eslint"],
  "angular-springboot": ["Angular.ng-template", "vscjava.vscode-java-pack", "vmware.vscode-spring-boot"],
  "angular-quarkus": ["Angular.ng-template", "vscjava.vscode-java-pack", "redhat.vscode-quarkus"],
  "python-fastapi": ["ms-python.python", "ms-python.vscode-pylance", "charliermarsh.ruff"],
  "python-django": ["ms-python.python", "batisteo.vscode-django"],
  "go-fiber": ["golang.go"],
  "rust-axum": ["rust-lang.rust-analyzer"],
  "dotnet-blazor": ["ms-dotnettools.csharp", "ms-dotnettools.csdevkit"],
  "flutter-dart": ["Dart-Code.dart-code", "Dart-Code.flutter"],
};

/**
 * Generates .devcontainer/devcontainer.json with stack-aware features when
 * the user picks isolationMode === "devcontainer".
 *
 * Reference: https://containers.dev/implementors/json_reference/
 */
export function generateDevcontainerFile(config: ProjectConfig): GeneratedFile {
  const features = STACK_FEATURES[config.stackId] ?? {};
  const postCreate = STACK_POST_CREATE[config.stackId];
  const extensions = STACK_EXTENSIONS[config.stackId] ?? [];

  const devcontainer: Record<string, unknown> = {
    name: config.name,
    image: "mcr.microsoft.com/devcontainers/base:ubuntu",
    features: {
      "ghcr.io/devcontainers/features/git:1": {},
      "ghcr.io/devcontainers/features/docker-in-docker:2": {},
      ...features,
    },
    customizations: {
      vscode: {
        extensions,
      },
    },
    remoteUser: "vscode",
    workspaceFolder: "/workspaces/${localWorkspaceFolderBasename}",
    // Mark the container so container-detector picks it up at runtime.
    containerEnv: {
      ABAX_ISOLATED: "1",
    },
  };

  if (postCreate) devcontainer.postCreateCommand = postCreate;

  return {
    path: ".devcontainer/devcontainer.json",
    content: JSON.stringify(devcontainer, null, 2) + "\n",
  };
}

/**
 * True when the chosen mode actually emits a devcontainer.
 */
export function shouldEmitDevcontainer(config: ProjectConfig): boolean {
  return (config.isolationMode ?? "devcontainer") === "devcontainer";
}
