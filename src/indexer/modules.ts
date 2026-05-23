import fs from "fs";
import path from "path";
import { ScannedFile } from "./scanner.js";

export interface KeyFile {
  path: string;
  role: string;
}

export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "ruby"
  | "rust"
  | "mixed"
  | "unknown";

export interface Module {
  name: string;
  directory: string;
  purpose: string;
  keyFiles: KeyFile[];
  dependencies: string[];
  isTest: boolean;
  language: Language;
}

// Directory names that signal a functional module
const MODULE_DIR_SIGNALS: Record<string, string> = {
  auth: "Authentication and authorization",
  authentication: "Authentication and authorization",
  authorization: "Authorization and permissions",
  payments: "Payment processing",
  billing: "Billing and subscriptions",
  email: "Email sending and templates",
  notifications: "Notifications (email, push, SMS)",
  users: "User management",
  user: "User management",
  accounts: "Account management",
  database: "Database access layer",
  db: "Database access layer",
  models: "Data models",
  routes: "API route handlers",
  api: "API layer",
  controllers: "Request controllers",
  handlers: "Request handlers",
  middleware: "HTTP middleware",
  services: "Business logic services",
  utils: "Shared utilities",
  helpers: "Helper functions",
  config: "Configuration and environment",
  scripts: "Scripts and tooling",
  tests: "Test suites",
  __tests__: "Unit tests",
  e2e: "End-to-end tests",
  types: "TypeScript type definitions",
  lib: "Shared library code",
  components: "UI components",
  pages: "Page components",
  hooks: "React hooks",
  store: "State management",
  queue: "Background job queue",
  workers: "Background workers",
  jobs: "Scheduled jobs",
  webhooks: "Incoming webhook handlers",
  integrations: "Third-party integrations",
  migrations: "Database migrations",
};

// File role signals based on filename patterns
const FILE_ROLE_PATTERNS: Array<[RegExp, string]> = [
  [/middleware\.(ts|js|py)$/, "Middleware"],
  [/service\.(ts|js|py)$/, "Service layer"],
  [/controller\.(ts|js|py)$/, "Request controller"],
  [/handler\.(ts|js|py)$/, "Request handler"],
  [/router?\.(ts|js|py)$/, "Route definitions"],
  [/model\.(ts|js|py)$/, "Data model"],
  [/schema\.(ts|js|py|prisma|graphql)$/, "Data schema"],
  [/guard\.(ts|js)$/, "Access guard"],
  [/hook\.(ts|js)$/, "React hook or lifecycle hook"],
  [/context\.(ts|js)$/, "React context provider"],
  [/store\.(ts|js)$/, "State store"],
  [/config\.(ts|js|py)$/, "Configuration"],
  [/index\.(ts|js|py)$/, "Module entry point"],
  [/types?\.(ts)$/, "Type definitions"],
  [/utils?\.(ts|js|py)$/, "Utilities"],
  [/helpers?\.(ts|js|py)$/, "Helpers"],
  [/client\.(ts|js|py)$/, "Client instance"],
  [/seed\.(ts|js|py)$/, "Database seed"],
  [/migration/, "Database migration"],
  [/\.test\.(ts|js|py)$/, "Test file"],
  [/\.spec\.(ts|js|py)$/, "Test spec"],
];

function detectLanguage(files: ScannedFile[]): Language {
  const counts: Record<string, number> = {};
  for (const f of files) {
    counts[f.extension] = (counts[f.extension] ?? 0) + 1;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!dominant) return "unknown";

  const ext = dominant[0];
  if ([".ts", ".tsx"].includes(ext)) return "typescript";
  if ([".js", ".jsx", ".mjs"].includes(ext)) return "javascript";
  if (ext === ".py") return "python";
  if (ext === ".go") return "go";
  if (ext === ".rb") return "ruby";
  if (ext === ".rs") return "rust";
  return "unknown";
}

function inferFileRole(filePath: string): string {
  const filename = path.basename(filePath);
  for (const [pattern, role] of FILE_ROLE_PATTERNS) {
    if (pattern.test(filename)) return role;
  }

  return path.basename(filePath, path.extname(filePath));
}

function parseImports(content: string, language: Language): string[] {
  const imports: string[] = [];

  if (language === "typescript" || language === "javascript") {
    const matches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
    for (const m of matches) imports.push(m[1]);
    const requires = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const m of requires) imports.push(m[1]);
  } else if (language === "python") {
    const matches = content.matchAll(/^(?:from|import)\s+([\w.]+)/gm);
    for (const m of matches) imports.push(m[1]);
  } else if (language === "go") {
    const matches = content.matchAll(/"([^"]+)"/g);
    for (const m of matches) imports.push(m[1]);
  }

  return imports;
}

export function detectModules(files: ScannedFile[], repoRoot: string): Module[] {
  const sourceRoots = ["src", "app", "lib", "packages"];
  const topLevelDirs = new Set(files.map((f) => f.path.split(path.sep)[0]));
  const sourceRoot = sourceRoots.find((r) => topLevelDirs.has(r)) ?? "";

  const moduleGroups = new Map<string, ScannedFile[]>();

  for (const file of files) {
    const parts = file.path.split(path.sep);

    if (parts.length === 1) continue;

    let moduleDir: string;

    if (sourceRoot && parts[0] === sourceRoot && parts.length > 2) {
      moduleDir = path.join(parts[0], parts[1]);
    } else {
      moduleDir = parts[0];
    }

    if (!moduleGroups.has(moduleDir)) moduleGroups.set(moduleDir, []);
    moduleGroups.get(moduleDir)!.push(file);
  }

  const modules: Module[] = [];

  for (const [moduleDir, moduleFiles] of moduleGroups) {
    const dirName = path.basename(moduleDir).toLowerCase();
    const isTest = ["tests", "__tests__", "test", "e2e", "spec"].includes(dirName);
    const language = detectLanguage(moduleFiles);

    const keyFiles: KeyFile[] = moduleFiles
      .filter(
        (f) =>
          !f.path.includes("__tests__") &&
          !f.path.endsWith(".test.ts") &&
          !f.path.endsWith(".spec.ts")
      )
      .slice(0, 6)
      .map((f) => ({
        path: f.path,
        role: inferFileRole(f.path),
      }));

    const allImports: string[] = [];
    for (const file of moduleFiles.slice(0, 5)) {
      try {
        const content = fs.readFileSync(file.absolutePath, "utf-8");
        allImports.push(...parseImports(content, language));
      } catch {
        // skip unreachable files
      }
    }

    const internalDeps = allImports
      .filter(
        (imp) =>
          imp.startsWith("../") ||
          imp.startsWith("./") ||
          imp.startsWith("@/") ||
          imp.startsWith("~/")
      )
      .map((imp) => {
        const normalized = imp.replace(/^(@\/|~\/|\.\.\/|\.\/)+/, "");
        return normalized.split("/")[0];
      })
      .filter((dep) => dep !== dirName && dep.length > 1);

    const uniqueDeps = [...new Set(internalDeps)].slice(0, 8);

    modules.push({
      name: dirName,
      directory: moduleDir,
      purpose: MODULE_DIR_SIGNALS[dirName] ?? `Code in ${moduleDir}/`,
      keyFiles,
      dependencies: uniqueDeps,
      isTest,
      language,
    });
  }

  return modules.sort((a, b) => {
    if (a.isTest !== b.isTest) return a.isTest ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
