import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncCommand } from "../../src/commands/sync.js";

vi.mock("ora", () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  }),
}));

vi.mock("../../src/commands/init.js", () => ({
  initiCommand: vi.fn().mockResolvedValue(undefined),
}));

describe("syncCommand", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-sync-"));
    outDir = path.join(tmpDir, "codeguide-out");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeManifest(generatedAt: string) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "manifest.json"),
      JSON.stringify({ generatedAt, fileCount: 0, moduleCount: 0, modules: [], files: [] }, null, 2)
    );
  }

  function makeProject() {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export const x = 1;");
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test-project" }, null, 2)
    );
  }

  function output() {
    return (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
  }

  // ─── No manifest — fall back to init ─────────────────────────────────────────

  it("logs a message when no manifest exists", async () => {
    await syncCommand(tmpDir);
    expect(output()).toContain("No manifest found");
  });

  it("calls initiCommand when no manifest exists", async () => {
    const { initiCommand } = await import("../../src/commands/init.js");
    await syncCommand(tmpDir);
    expect(initiCommand).toHaveBeenCalledWith(tmpDir);
  });

  it("does not attempt to read files when no manifest exists", async () => {
    const readSpy = vi.spyOn(fs, "readFileSync");
    await syncCommand(tmpDir);
    // readFileSync should not have been called for the manifest (it doesn't exist)
    const manifestReads = readSpy.mock.calls.filter((args) =>
      String(args[0]).endsWith("manifest.json")
    );
    expect(manifestReads).toHaveLength(0);
  });

  // ─── No changed files ─────────────────────────────────────────────────────────

  it("does not rebuild the index when no files changed since the last index", async () => {
    makeProject();
    const futureTime = new Date(Date.now() + 10_000_000).toISOString();
    makeManifest(futureTime);
    await syncCommand(tmpDir);
    const saved = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf-8"));
    expect(saved.generatedAt).toBe(futureTime);
  });

  it("does not create INDEX.md when nothing has changed", async () => {
    makeProject();
    makeManifest(new Date(Date.now() + 10_000_000).toISOString());
    await syncCommand(tmpDir);
    expect(fs.existsSync(path.join(outDir, "INDEX.md"))).toBe(false);
  });

  // ─── Changed files — full rebuild ─────────────────────────────────────────────

  it("creates INDEX.md when files have changed since the last index", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString()); // epoch — all files appear newer
    await syncCommand(tmpDir);
    expect(fs.existsSync(path.join(outDir, "INDEX.md"))).toBe(true);
  });

  it("creates STRUCTURE.md when files have changed", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString());
    await syncCommand(tmpDir);
    expect(fs.existsSync(path.join(outDir, "STRUCTURE.md"))).toBe(true);
  });

  it("creates GRAPH_REPORT.md when files have changed", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString());
    await syncCommand(tmpDir);
    expect(fs.existsSync(path.join(outDir, "GRAPH_REPORT.md"))).toBe(true);
  });

  it("updates manifest.generatedAt to a newer timestamp after rebuild", async () => {
    makeProject();
    const oldTime = new Date(0).toISOString();
    makeManifest(oldTime);
    await syncCommand(tmpDir);
    const updated = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf-8"));
    expect(updated.generatedAt).not.toBe(oldTime);
    expect(new Date(updated.generatedAt).getTime()).toBeGreaterThan(new Date(oldTime).getTime());
  });

  it("updates manifest.fileCount after rebuild", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString());
    await syncCommand(tmpDir);
    const updated = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf-8"));
    expect(updated.fileCount).toBeGreaterThan(0);
  });

  // ─── Error handling ───────────────────────────────────────────────────────────

  it("calls process.exit(1) when writing output files fails", async () => {
    makeProject();
    makeManifest(new Date(0).toISOString());
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("disk full");
    });
    await syncCommand(tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls process.exit(1) when manifest.json is corrupted", async () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "manifest.json"), "{ not valid json }");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    await syncCommand(tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
