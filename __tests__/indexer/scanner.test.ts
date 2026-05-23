import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ScannedFile, buildFileTree, scanRepo } from "../../src/indexer/scanner.js";

describe("scanRepo", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-scan-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function touch(relPath: string, content = "") {
    const abs = path.join(tmpDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  it("returns empty array for an empty directory", () => {
    expect(scanRepo(tmpDir)).toEqual([]);
  });

  it("collects files with code extensions", () => {
    touch("src/index.ts");
    touch("src/app.js");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths).toContain(path.join("src", "index.ts"));
    expect(paths).toContain(path.join("src", "app.js"));
  });

  it("returns paths relative to repoRoot", () => {
    touch("src/utils/helpers.ts");
    const files = scanRepo(tmpDir);
    expect(files[0].path).toBe(path.join("src", "utils", "helpers.ts"));
    expect(files[0].path).not.toContain(tmpDir);
  });

  it("sets absolutePath to the full path on disk", () => {
    touch("src/index.ts");
    const files = scanRepo(tmpDir);
    expect(files[0].absolutePath).toBe(path.join(tmpDir, "src", "index.ts"));
  });

  it("sets extension from the file", () => {
    touch("src/index.ts");
    const files = scanRepo(tmpDir);
    expect(files[0].extension).toBe(".ts");
  });

  it("returns files sorted alphabetically by path", () => {
    touch("src/z.ts");
    touch("src/a.ts");
    touch("src/m.ts");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
  });

  it("ignores node_modules", () => {
    touch("node_modules/lodash/index.js");
    touch("src/index.ts");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
  });

  it("ignores .git directory", () => {
    touch(".git/config");
    touch("src/index.ts");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.includes(".git"))).toBe(false);
  });

  it("ignores dist and build directories", () => {
    touch("dist/index.js");
    touch("build/app.js");
    touch("src/index.ts");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.startsWith("dist"))).toBe(false);
    expect(paths.some((p) => p.startsWith("build"))).toBe(false);
  });

  it("ignores hidden directories (starting with .)", () => {
    touch(".hidden/secret.ts");
    touch("src/index.ts");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.includes(".hidden"))).toBe(false);
  });

  it("skips files larger than 500KB", () => {
    touch("src/big.ts", "x".repeat(500_001));
    touch("src/small.ts", "x".repeat(100));
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.includes("big.ts"))).toBe(false);
    expect(paths.some((p) => p.includes("small.ts"))).toBe(true);
  });

  it("includes named files like Dockerfile and Makefile", () => {
    touch("Dockerfile");
    touch("Makefile");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths).toContain("Dockerfile");
    expect(paths).toContain("Makefile");
  });

  it("excludes files with unknown extensions", () => {
    touch("src/image.png");
    touch("src/data.bin");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.includes("image.png"))).toBe(false);
    expect(paths.some((p) => p.includes("data.bin"))).toBe(false);
  });

  it("includes config and schema files", () => {
    touch("src/schema.prisma");
    touch("src/config.yaml");
    touch("schema.graphql");
    const paths = scanRepo(tmpDir).map((f) => f.path);
    expect(paths.some((p) => p.includes("schema.prisma"))).toBe(true);
    expect(paths.some((p) => p.includes("config.yaml"))).toBe(true);
    expect(paths.some((p) => p.includes("schema.graphql"))).toBe(true);
  });
});

// ─── buildFileTree ────────────────────────────────────────────────────────

describe("buildFileTree", () => {
  function file(filePath: string): ScannedFile {
    return { path: filePath, absolutePath: "", extension: path.extname(filePath), sizeBytes: "0" };
  }

  it("starts with the project name (basename of repoRoot)", () => {
    const tree = buildFileTree([], "/projects/my-app");
    expect(tree).toMatch(/^my-app/);
  });

  it("groups files by top-level directory", () => {
    const files = [file("src/index.ts"), file("src/utils.ts")];
    const tree = buildFileTree(files, "/repo");
    expect(tree).toContain("src/");
    expect(tree).toContain("index.ts");
    expect(tree).toContain("utils.ts");
  });

  it("lists root-level files without a directory prefix", () => {
    const tree = buildFileTree([file("README.md")], "/repo");
    expect(tree).toContain("README.md");
  });

  it("shows truncation notice when a group has more than 20 files", () => {
    const files = Array.from({ length: 25 }, (_, i) => file(`src/file${i}.ts`));
    const tree = buildFileTree(files, "/repo");
    expect(tree).toContain("... and 5 more files");
  });

  it("does not truncate groups with exactly 20 files", () => {
    const files = Array.from({ length: 20 }, (_, i) => file(`src/file${i}.ts`));
    const tree = buildFileTree(files, "/repo");
    expect(tree).not.toContain("more files");
  });

  it("handles files from multiple top-level directories", () => {
    const files = [file("src/index.ts"), file("scripts/build.sh"), file("docs/README.md")];
    const tree = buildFileTree(files, "/repo");
    expect(tree).toContain("src/");
    expect(tree).toContain("scripts/");
    expect(tree).toContain("docs/");
  });
});
