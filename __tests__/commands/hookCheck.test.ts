import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hookCheckCommand } from "../../src/commands/hookCheck.js";

describe("hookCheckCommand", () => {
  let tmpDir: string;
  let outDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-hook-"));
    outDir = path.join(tmpDir, "codeguide-out");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function makeIndex(content = "# CodeGuide Index\n") {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "INDEX.md"), content);
  }

  // ─── Index present ────────────────────────────────────────────────────────────

  it("writes to stdout when INDEX.md exists", () => {
    makeIndex();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    expect(writeSpy).toHaveBeenCalled();
  });

  it("output contains the index path", () => {
    makeIndex();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    const written = writeSpy.mock.calls.flat().join("");
    expect(written).toContain("codeguide-out/INDEX.md");
  });

  it("output tells Claude to consult the index before searching raw files", () => {
    makeIndex();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    const written = writeSpy.mock.calls.flat().join("");
    expect(written).toContain("Consult it before searching raw files");
  });

  it("output ends with a newline (safe for terminal and hook consumers)", () => {
    makeIndex();
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    const written = writeSpy.mock.calls.flat().join("");
    expect(written.endsWith("\n")).toBe(true);
  });

  // ─── Index absent ─────────────────────────────────────────────────────────────

  it("writes nothing to stdout when INDEX.md does not exist", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    hookCheckCommand(tmpDir);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("does not throw when codeguide-out/ directory does not exist", () => {
    expect(() => hookCheckCommand(tmpDir)).not.toThrow();
  });

  // ─── Default directory ────────────────────────────────────────────────────────

  it("uses process.cwd() when no dir argument is provided", () => {
    // Just verify it doesn't throw when called with no args
    // (cwd likely has no index, so stdout stays silent)
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    expect(() => hookCheckCommand()).not.toThrow();
    writeSpy.mockRestore();
  });
});
