import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initiCommand } from "../../src/commands/init.js";

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  }),
}));

describe("initiCommand", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-init-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeProject(
    dir: string,
    opts: { withPackageJson?: boolean; packageName?: string } = {}
  ) {
    if (opts.withPackageJson ?? true) {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: opts.packageName ?? "test-project" }, null, 2)
      );
    }
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "index.ts"), "export const x = 1;");
  }

  // ─── Output files ─────────────────────────────────────────────────────────────

  it("creates codeguide-out/INDEX.md", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "codeguide-out", "INDEX.md"))).toBe(true);
  });

  it("creates codeguide-out/STRUCTURE.md", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "codeguide-out", "STRUCTURE.md"))).toBe(true);
  });

  it("creates codeguide-out/GRAPH_REPORT.md", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "codeguide-out", "GRAPH_REPORT.md"))).toBe(true);
  });

  it("creates codeguide-out/missions/ directory", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    const missionsDir = path.join(tmpDir, "codeguide-out", "missions");
    expect(fs.existsSync(missionsDir)).toBe(true);
    expect(fs.statSync(missionsDir).isDirectory()).toBe(true);
  });

  it("is idempotent — running init twice does not throw or corrupt output", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    await initiCommand(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, "codeguide-out", "INDEX.md"))).toBe(true);
  });

  // ─── manifest.json ────────────────────────────────────────────────────────────

  it("writes manifest.json with expected top-level keys", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    expect(manifest).toMatchObject({
      projectName: expect.any(String),
      generatedAt: expect.any(String),
      fileCount: expect.any(Number),
      moduleCount: expect.any(Number),
      modules: expect.any(Array),
      files: expect.any(Array),
    });
  });

  it("manifest.json fileCount matches the length of the files array", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    expect(manifest.fileCount).toBe(manifest.files.length);
  });

  it("manifest.json module entries have required fields", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    for (const mod of manifest.modules) {
      expect(mod).toMatchObject({
        name: expect.any(String),
        directory: expect.any(String),
        purpose: expect.any(String),
        language: expect.any(String),
        isTest: expect.any(Boolean),
        fileCount: expect.any(Number),
      });
    }
  });

  it("manifest.json moduleCount excludes test modules", async () => {
    makeProject(tmpDir);
    fs.mkdirSync(path.join(tmpDir, "__tests__"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "__tests__", "foo.test.ts"), "it('x', () => {})");
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    const nonTestCount = manifest.modules.filter((m: { isTest: boolean }) => !m.isTest).length;
    expect(manifest.moduleCount).toBe(nonTestCount);
  });

  it("manifest.json generatedAt is a valid ISO 8601 timestamp", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    expect(new Date(manifest.generatedAt).toISOString()).toBe(manifest.generatedAt);
  });

  // ─── Project name ─────────────────────────────────────────────────────────────

  it("uses package.json name as projectName", async () => {
    makeProject(tmpDir, { packageName: "my-awesome-app" });
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    expect(manifest.projectName).toBe("my-awesome-app");
  });

  it("falls back to directory basename when no package.json exists", async () => {
    makeProject(tmpDir, { withPackageJson: false });
    await initiCommand(tmpDir);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "codeguide-out", "manifest.json"), "utf-8")
    );
    expect(manifest.projectName).toBe(path.basename(tmpDir));
  });

  // ─── .gitignore ───────────────────────────────────────────────────────────────

  it("does not modify .gitignore — codeguide-out/ should be committed to SCM", async () => {
    makeProject(tmpDir);
    const original = "node_modules/\n";
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), original);
    await initiCommand(tmpDir);
    expect(fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8")).toBe(original);
  });

  // ─── Console output ───────────────────────────────────────────────────────────

  it("prints the project name to console", async () => {
    makeProject(tmpDir, { packageName: "my-project" });
    await initiCommand(tmpDir);
    const output = (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(output).toContain("my-project");
  });

  it("prints /codeguide tour suggestion", async () => {
    makeProject(tmpDir);
    await initiCommand(tmpDir);
    const output = (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(output).toContain("/codeguide tour");
  });

  it("prints /codeguide mission suggestion when modules are detected", async () => {
    makeProject(tmpDir);
    fs.mkdirSync(path.join(tmpDir, "src", "auth"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "auth", "index.ts"), "export const auth = {};");
    await initiCommand(tmpDir);
    const output = (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(output).toContain("/codeguide mission");
  });

  // ─── Error handling ───────────────────────────────────────────────────────────

  it("calls process.exit(1) when writing output files fails", async () => {
    makeProject(tmpDir);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("disk full");
    });
    await initiCommand(tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs the error message when indexing fails", async () => {
    makeProject(tmpDir);
    vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("disk full");
    });
    await initiCommand(tmpDir);
    const errOutput = (console.error as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
    expect(errOutput).toContain("disk full");
  });
});
