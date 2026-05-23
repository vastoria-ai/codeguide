import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectModules } from "../../src/indexer/modules.js";
import { ScannedFile } from "../../src/indexer/scanner.js";

function makeFile(filePath: string, ext: string, absPath = ""): ScannedFile {
  return { path: filePath, absolutePath: absPath, extension: ext, sizeBytes: "100" };
}

// ─── module grouping ──────────────────────────────────────────────────────

describe("detectModules — grouping", () => {
  it("groups files in src/ subdirectories as src/<subdir> modules", () => {
    const files = [
      makeFile("src/utils/helpers.ts", ".ts"),
      makeFile("src/utils/format.ts", ".ts"),
      makeFile("src/api/router.ts", ".ts"),
    ];
    const dirs = detectModules(files, "/repo").map((m) => m.directory);
    expect(dirs).toContain("src/utils");
    expect(dirs).toContain("src/api");
  });

  it("groups top-level directories without a source root", () => {
    const files = [makeFile("utils/helpers.ts", ".ts"), makeFile("api/router.ts", ".ts")];
    const dirs = detectModules(files, "/repo").map((m) => m.directory);
    expect(dirs).toContain("utils");
    expect(dirs).toContain("api");
  });

  it("skips single-depth files (no parent directory)", () => {
    const files = [makeFile("README.md", ".md")];
    expect(detectModules(files, "/repo")).toHaveLength(0);
  });

  it("creates one module per unique directory, not one per file", () => {
    const files = Array.from({ length: 5 }, (_, i) => makeFile(`src/utils/file${i}.ts`, ".ts"));
    expect(detectModules(files, "/repo")).toHaveLength(1);
  });
});

// ─── isTest flag ──────────────────────────────────────────────────────────

describe("detectModules — isTest", () => {
  it.each(["__tests__", "tests", "test", "e2e", "spec"])(
    "marks '%s' directory as isTest=true",
    (dirName) => {
      const files = [makeFile(`src/${dirName}/foo.test.ts`, ".ts")];
      const modules = detectModules(files, "/repo");
      expect(modules[0].isTest).toBe(true);
    }
  );

  it("marks regular source directories as isTest=false", () => {
    const files = [makeFile("src/utils/helpers.ts", ".ts")];
    expect(detectModules(files, "/repo")[0].isTest).toBe(false);
  });

  it("sorts non-test modules before test modules", () => {
    const files = [
      makeFile("src/__tests__/foo.test.ts", ".ts"),
      makeFile("src/utils/helpers.ts", ".ts"),
    ];
    const modules = detectModules(files, "/repo");
    expect(modules[0].isTest).toBe(false);
    expect(modules[1].isTest).toBe(true);
  });
});

// ─── language detection ───────────────────────────────────────────────────

describe("detectModules — language", () => {
  it.each([
    [".ts", "typescript"],
    [".tsx", "typescript"],
    [".js", "javascript"],
    [".py", "python"],
    [".go", "go"],
    [".rb", "ruby"],
    [".rs", "rust"],
  ] as const)("detects %s files as %s", (ext, lang) => {
    const files = [makeFile(`src/utils/a${ext}`, ext), makeFile(`src/utils/b${ext}`, ext)];
    expect(detectModules(files, "/repo")[0].language).toBe(lang);
  });
});

// ─── purpose ─────────────────────────────────────────────────────────────

describe("detectModules — purpose", () => {
  it.each([
    ["auth", "Authentication and authorization"],
    ["payments", "Payment processing"],
    ["utils", "Shared utilities"],
    ["middleware", "HTTP middleware"],
    ["components", "UI components"],
  ])("maps known directory '%s' to its purpose", (dir, purpose) => {
    const files = [makeFile(`src/${dir}/index.ts`, ".ts")];
    expect(detectModules(files, "/repo")[0].purpose).toBe(purpose);
  });

  it("uses a generic fallback purpose for unknown directory names", () => {
    const files = [makeFile("src/widgets/foo.ts", ".ts")];
    expect(detectModules(files, "/repo")[0].purpose).toBe("Code in src/widgets/");
  });
});

// ─── key files ────────────────────────────────────────────────────────────

describe("detectModules — key files", () => {
  it("excludes .test.ts files from key files", () => {
    const files = [
      makeFile("src/utils/helpers.ts", ".ts"),
      makeFile("src/utils/helpers.test.ts", ".ts"),
    ];
    const keyPaths = detectModules(files, "/repo")[0].keyFiles.map((kf) => kf.path);
    expect(keyPaths.some((p) => p.endsWith(".test.ts"))).toBe(false);
  });

  it("excludes .spec.ts files from key files", () => {
    const files = [
      makeFile("src/utils/helpers.ts", ".ts"),
      makeFile("src/utils/helpers.spec.ts", ".ts"),
    ];
    const keyPaths = detectModules(files, "/repo")[0].keyFiles.map((kf) => kf.path);
    expect(keyPaths.some((p) => p.endsWith(".spec.ts"))).toBe(false);
  });

  it("limits key files to 6 per module", () => {
    const files = Array.from({ length: 10 }, (_, i) => makeFile(`src/utils/file${i}.ts`, ".ts"));
    expect(detectModules(files, "/repo")[0].keyFiles.length).toBeLessThanOrEqual(6);
  });

  it("assigns a role to each key file", () => {
    const files = [makeFile("src/api/router.ts", ".ts")];
    const keyFiles = detectModules(files, "/repo")[0].keyFiles;
    expect(keyFiles[0].role).toBeTruthy();
  });
});

// ─── dependency extraction ────────────────────────────────────────────────

describe("detectModules — dependency extraction", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-modules-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFile(relPath: string, content: string): ScannedFile {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return { path: relPath, absolutePath: abs, extension: path.extname(relPath), sizeBytes: "50" };
  }

  it("extracts relative imports as internal dependencies", () => {
    const file = writeFile(
      path.join("src", "api", "router.ts"),
      `import { helper } from '../utils/helpers.js';`
    );
    const modules = detectModules([file], tmpDir);
    expect(modules[0].dependencies).toContain("utils");
  });

  it("ignores external npm package imports", () => {
    const file = writeFile(
      path.join("src", "api", "router.ts"),
      `import express from 'express';\nimport { z } from 'zod';`
    );
    const modules = detectModules([file], tmpDir);
    expect(modules[0].dependencies).toHaveLength(0);
  });

  it("deduplicates repeated imports of the same module", () => {
    const file = writeFile(
      path.join("src", "api", "router.ts"),
      `import { a } from '../utils/a.js';\nimport { b } from '../utils/b.js';`
    );
    const modules = detectModules([file], tmpDir);
    const utilsCount = modules[0].dependencies.filter((d) => d === "utils").length;
    expect(utilsCount).toBe(1);
  });

  it("handles files that cannot be read without crashing", () => {
    const file = makeFile(path.join("src", "api", "router.ts"), ".ts", "/nonexistent/path.ts");
    expect(() => detectModules([file], tmpDir)).not.toThrow();
  });
});
