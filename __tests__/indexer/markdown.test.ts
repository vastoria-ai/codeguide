import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  IndexData,
  buildGraphReport,
  buildIndexMarkdown,
  buildStructureMarkdown,
  readPackageJson,
  readReadmeSnippet,
} from "../../src/indexer/markdown.js";

// Shared fixture used across the build* tests
const BASE_DATA: IndexData = {
  projectName: "my-app",
  generatedAt: new Date("2025-01-15").toISOString(),
  fileCount: 10,
  moduleCount: 3,
  repoRoot: "/repo",
  modules: [
    {
      name: "utils",
      directory: "src/utils",
      purpose: "Shared helpers",
      keyFiles: [{ path: "src/utils/index.ts", role: "barrel export" }],
      dependencies: [],
      isTest: false,
      language: "typescript",
    },
    {
      name: "api",
      directory: "src/api",
      purpose: "HTTP handlers",
      keyFiles: [{ path: "src/api/router.ts", role: "route definitions" }],
      dependencies: ["utils"],
      isTest: false,
      language: "typescript",
    },
    {
      name: "tests",
      directory: "src/__tests__",
      purpose: "Unit tests",
      keyFiles: [],
      dependencies: [],
      isTest: true,
      language: "typescript",
    },
  ],
  files: [
    { path: "src/index.ts", language: "typescript", size: 100, lines: 10 },
    { path: "src/utils/index.ts", language: "typescript", size: 200, lines: 20 },
    { path: "src/api/router.ts", language: "typescript", size: 300, lines: 30 },
  ],
};

// ─── buildIndexMarkdown ────────────────────────────────────────────────────

describe("buildIndexMarkdown", () => {
  it("includes the project name in the heading", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("# CodeGuide Index — my-app");
  });

  it("shows file and module counts", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("Files: 10");
    expect(md).toContain("Modules: 3");
  });

  it("uses package.json description when provided", () => {
    const data: IndexData = { ...BASE_DATA, packageJSON: { description: "My cool project" } };
    expect(buildIndexMarkdown(data)).toContain("My cool project");
  });

  it("falls back to readme snippet when no package.json description", () => {
    const data: IndexData = { ...BASE_DATA, readmeSnippet: "From the README" };
    expect(buildIndexMarkdown(data)).toContain("From the README");
  });

  it("falls back to default message when neither description nor readme", () => {
    expect(buildIndexMarkdown(BASE_DATA)).toContain("No description found.");
  });

  it("renders non-test modules in the module map", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("### src/utils");
    expect(md).toContain("### src/api");
  });

  it("excludes test modules from the module map", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).not.toContain("### src/__tests__");
  });

  it("renders a Test locations section when test modules exist", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("## Test locations");
    expect(md).toContain("src/__tests__/");
  });

  it("renders key files for each module", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("`src/utils/index.ts` - barrel export");
    expect(md).toContain("`src/api/router.ts` - route definitions");
  });

  it("renders module dependencies", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("-> utils");
  });

  it("renders notable tech stack from packageJSON dependencies", () => {
    const data: IndexData = {
      ...BASE_DATA,
      packageJSON: { dependencies: { react: "^18", express: "^4" }, devDependencies: {} },
    };
    const md = buildIndexMarkdown(data);
    expect(md).toContain("## Tech stack");
    expect(md).toContain("- react");
    expect(md).toContain("- express");
  });

  it("renders entry points section for index.ts files", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("## Entry points");
    expect(md).toContain("`src/index.ts`");
  });

  it("renders file tree section", () => {
    const md = buildIndexMarkdown(BASE_DATA);
    expect(md).toContain("## File tree");
    expect(md).toContain("```");
  });
});

// ─── buildStructureMarkdown ───────────────────────────────────────────────

describe("buildStructureMarkdown", () => {
  it("includes the project name in the heading", () => {
    const md = buildStructureMarkdown(BASE_DATA);
    expect(md).toContain("# CodeGuide Structure — my-app");
  });

  it("marks foundational modules with no internal dependencies", () => {
    const md = buildStructureMarkdown(BASE_DATA);
    expect(md).toContain("**utils** — no internal dependencies (foundational module)");
  });

  it("lists dependencies for modules that have them", () => {
    const md = buildStructureMarkdown(BASE_DATA);
    expect(md).toContain("**api** → depends on: utils");
  });

  it("omits test modules from the dependency graph", () => {
    const md = buildStructureMarkdown(BASE_DATA);
    expect(md).not.toContain("**tests**");
  });

  it("renders a Start here section", () => {
    const md = buildStructureMarkdown(BASE_DATA);
    expect(md).toContain("## Start here");
  });

  it("lists foundational modules first in reading order", () => {
    const md = buildStructureMarkdown(BASE_DATA);
    const utilsPos = md.indexOf("`src/utils/`");
    const apiPos = md.indexOf("`src/api/`");
    expect(utilsPos).toBeGreaterThan(-1);
    expect(apiPos).toBeGreaterThan(-1);
    expect(utilsPos).toBeLessThan(apiPos);
  });
});

// ─── buildGraphReport ─────────────────────────────────────────────────────

describe("buildGraphReport", () => {
  it("includes the project name in the heading", () => {
    const md = buildGraphReport(BASE_DATA);
    expect(md).toContain("# CodeGuide Report — my-app");
  });

  it("shows file and module counts in the summary line", () => {
    const md = buildGraphReport(BASE_DATA);
    expect(md).toContain("**10 files**");
    expect(md).toContain("**2 modules**"); // non-test modules only
  });

  it("lists non-test modules in the at-a-glance section", () => {
    const md = buildGraphReport(BASE_DATA);
    expect(md).toContain("**utils**");
    expect(md).toContain("**api**");
    expect(md).not.toContain("**tests**");
  });

  it("renders the CodeGuide commands table", () => {
    const md = buildGraphReport(BASE_DATA);
    expect(md).toContain("## CodeGuide commands");
    expect(md).toContain("/codeguide tour");
    expect(md).toContain("/codeguide init");
  });

  it("renders suggested missions section", () => {
    const md = buildGraphReport(BASE_DATA);
    expect(md).toContain("## Suggested missions");
    expect(md).toContain("/codeguide mission api");
  });
});

// ─── readPackageJson ──────────────────────────────────────────────────────

describe("readPackageJson", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns parsed JSON when package.json exists", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-pkg" }));
    expect(readPackageJson(tmpDir)).toEqual({ name: "test-pkg" });
  });

  it("returns undefined when package.json does not exist", () => {
    expect(readPackageJson(tmpDir)).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), "{ bad json }");
    expect(readPackageJson(tmpDir)).toBeUndefined();
  });
});

// ─── readReadmeSnippet ────────────────────────────────────────────────────

describe("readReadmeSnippet", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns undefined when no readme file exists", () => {
    expect(readReadmeSnippet(tmpDir)).toBeUndefined();
  });

  it("reads README.md and returns non-heading lines", () => {
    fs.writeFileSync(
      path.join(tmpDir, "README.md"),
      "# Heading\n\nThis is the description.\nMore info here."
    );
    const snippet = readReadmeSnippet(tmpDir);
    expect(snippet).not.toContain("# Heading");
    expect(snippet).toContain("This is the description.");
  });

  it("caps the result at 500 characters", () => {
    const longLine = "word ".repeat(200);
    fs.writeFileSync(path.join(tmpDir, "README.md"), longLine);
    expect(readReadmeSnippet(tmpDir)!.length).toBeLessThanOrEqual(500);
  });

  it("falls back to readme.md (lowercase)", () => {
    fs.writeFileSync(path.join(tmpDir, "readme.md"), "lowercase readme content");
    expect(readReadmeSnippet(tmpDir)).toContain("lowercase readme content");
  });
});
