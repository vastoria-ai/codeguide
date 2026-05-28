import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { missionCommand } from "../../src/commands/mission.js";

describe("missionCommand", () => {
  let tmpDir: string;
  let outDir: string;
  let missionDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-mission-"));
    outDir = path.join(tmpDir, "codeguide-out");
    missionDir = path.join(outDir, "missions");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Helpers
  function makeIndex() {
    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(missionDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "INDEX.md"),
      "## Modules\n\n### src/auth/\nAuthentication module.\n\n## File tree\n..."
    );
  }

  function makeManifest(modules: { name: string; directory: string; purpose: string }[] = []) {
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ modules }, null, 2));
  }

  function makeMissionFile(topic: string, content = `# Mission: ${topic}\n\n## Steps\n`) {
    fs.writeFileSync(path.join(missionDir, `${topic}.md`), content);
  }

  function consoleOutput() {
    return (console.log as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
  }

  function consoleErrors() {
    return (console.error as ReturnType<typeof vi.spyOn>).mock.calls.flat().join("\n");
  }

  // ─── Guard: no index ─────────────────────────────────────────────────────────

  it("calls process.exit(1) when codeguide-out/INDEX.md does not exist", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    // Make the index check fail but the mission-file check succeed so execution
    // takes the existing-mission branch (no readFileSync on the missing index).
    vi.spyOn(fs, "existsSync").mockImplementation((p) => !String(p).endsWith("INDEX.md"));
    missionCommand("auth", tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("logs an error telling the user to run codeguide init first", () => {
    vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    vi.spyOn(fs, "existsSync").mockImplementation((p) => !String(p).endsWith("INDEX.md"));
    missionCommand("auth", tmpDir);
    expect(consoleErrors()).toContain("codeguide init");
  });

  // ─── Existing mission ────────────────────────────────────────────────────────

  it("confirms the mission is ready when the mission file exists", () => {
    makeIndex();
    makeMissionFile("auth");
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("Mission ready");
  });

  it("prints the correct mission file path when it exists", () => {
    makeIndex();
    makeMissionFile("auth");
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("codeguide-out/missions/auth.md");
  });

  it("includes the AI instruction to read the mission file and present Step 1", () => {
    makeIndex();
    makeMissionFile("payments");
    missionCommand("payments", tmpDir);
    const out = consoleOutput();
    expect(out).toContain("INSTRUCTION FOR AI");
    expect(out).toContain("Step 1");
  });

  it("does not print the index content when the mission file already exists", () => {
    makeIndex();
    makeMissionFile("auth");
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).not.toContain("INDEX CONTEXT");
  });

  // ─── Generate new mission ─────────────────────────────────────────────────────

  it("prints a 'Generating now' message when no mission file exists", () => {
    makeIndex();
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("Generating now");
  });

  it("includes the topic name in the generation message", () => {
    makeIndex();
    missionCommand("scanner", tmpDir);
    expect(consoleOutput()).toContain('"scanner"');
  });

  it("prints INSTRUCTION FOR AI section when generating a new mission", () => {
    makeIndex();
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("INSTRUCTION FOR AI");
  });

  it("includes the correct save path in generation instructions", () => {
    makeIndex();
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("codeguide-out/missions/auth.md");
  });

  it("includes INDEX CONTEXT in generation output", () => {
    makeIndex();
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("INDEX CONTEXT");
  });

  it("truncates the index content at ~6000 chars for token efficiency", () => {
    makeIndex();
    const longIndex = "## Modules\n" + "x".repeat(10000) + "\n## File tree\n";
    fs.writeFileSync(path.join(outDir, "INDEX.md"), longIndex);
    missionCommand("auth", tmpDir);
    const out = consoleOutput();
    // Output should not contain the full 10k repeated chars
    expect(out.length).toBeLessThan(9000);
  });

  it("omits the file tree section from the index context", () => {
    makeIndex();
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).not.toContain("File tree");
  });

  // ─── Module context from manifest ────────────────────────────────────────────

  it("prints matched module context when manifest has an exact name match", () => {
    makeIndex();
    makeManifest([{ name: "auth", directory: "src/auth", purpose: "Handles authentication" }]);
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("Matched module");
    expect(consoleOutput()).toContain("src/auth");
  });

  it("matches module by directory substring", () => {
    makeIndex();
    makeManifest([{ name: "users", directory: "src/auth/users", purpose: "User records" }]);
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).toContain("Matched module");
  });

  it("matches module by purpose keyword (case-insensitive)", () => {
    makeIndex();
    makeManifest([
      { name: "tokens", directory: "src/tokens", purpose: "JWT Authentication logic" },
    ]);
    missionCommand("authentication", tmpDir);
    expect(consoleOutput()).toContain("Matched module");
  });

  it("does not print module context when no module matches", () => {
    makeIndex();
    makeManifest([{ name: "payments", directory: "src/payments", purpose: "Billing" }]);
    missionCommand("auth", tmpDir);
    expect(consoleOutput()).not.toContain("Matched module");
  });

  it("does not crash when manifest.json is absent", () => {
    makeIndex();
    // No makeManifest() call — file simply doesn't exist
    expect(() => missionCommand("auth", tmpDir)).not.toThrow();
  });

  it("does not crash when manifest.json contains invalid JSON", () => {
    makeIndex();
    fs.writeFileSync(path.join(outDir, "manifest.json"), "{ not valid json }");
    expect(() => missionCommand("auth", tmpDir)).not.toThrow();
  });
});
