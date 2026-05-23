import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendIfMissing,
  appendToGitignore,
  deepMerge,
  ensureDir,
  getMissionsDir,
  getOutDir,
  readJsonFile,
  writeJsonFile,
} from "../../src/utils/fs.js";

describe("appendIfMissing", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-fs-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the file with content when it does not exist and returns true", () => {
    const filePath = path.join(tmpDir, "NEW.md");
    const result = appendIfMissing(filePath, "hello world", "hello");
    expect(result).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("hello world");
  });

  it("appends content to an existing file that lacks the marker and returns true", () => {
    const filePath = path.join(tmpDir, "EXISTING.md");
    fs.writeFileSync(filePath, "# Project\n");
    const result = appendIfMissing(filePath, "new section", "new section");
    expect(result).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("# Project");
    expect(content).toContain("new section");
  });

  it("prepends a newline before the appended content", () => {
    const filePath = path.join(tmpDir, "EXISTING.md");
    fs.writeFileSync(filePath, "existing");
    appendIfMissing(filePath, "appended", "appended");
    expect(fs.readFileSync(filePath, "utf-8")).toBe("existing\nappended");
  });

  it("returns false and leaves the file unchanged when the marker is already present", () => {
    const filePath = path.join(tmpDir, "EXISTING.md");
    fs.writeFileSync(filePath, "## My Marker\nsome content");
    const result = appendIfMissing(filePath, "new content", "My Marker");
    expect(result).toBe(false);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("## My Marker\nsome content");
  });

  it("does not duplicate the content on a second call", () => {
    const filePath = path.join(tmpDir, "FILE.md");
    appendIfMissing(filePath, "section", "section");
    appendIfMissing(filePath, "section", "section");
    const occurrences = fs.readFileSync(filePath, "utf-8").split("section").length - 1;
    expect(occurrences).toBe(1);
  });
});

// ─── deepMerge ────────────────────────────────────────────────────────────────

describe("deepMerge", () => {
  it("returns all keys from both objects at the top level", () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("override value wins for a shared top-level key", () => {
    const result = deepMerge({ a: 1 }, { a: 99 });
    expect(result).toEqual({ a: 99 });
  });

  it("recursively merges nested objects", () => {
    const base = { hooks: { PreToolUse: ["existing"] } };
    const override = { hooks: { PostToolUse: ["new"] } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ hooks: { PreToolUse: ["existing"], PostToolUse: ["new"] } });
  });

  it("override array replaces base array entirely (no concat)", () => {
    const result = deepMerge({ list: [1, 2] }, { list: [3] });
    expect(result).toEqual({ list: [3] });
  });

  it("does not mutate the base object", () => {
    const base = { a: { b: 1 } };
    deepMerge(base, { a: { c: 2 } });
    expect(base).toEqual({ a: { b: 1 } });
  });

  it("handles empty base", () => {
    expect(deepMerge({}, { x: 1 })).toEqual({ x: 1 });
  });

  it("handles empty override", () => {
    expect(deepMerge({ x: 1 }, {})).toEqual({ x: 1 });
  });

  it("null override value replaces a nested object", () => {
    const result = deepMerge({ a: { b: 1 } }, { a: null } as never);
    expect(result.a).toBeNull();
  });
});

// ─── appendToGitignore ────────────────────────────────────────────────────────

describe("appendToGitignore", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-fs-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends the entry to an existing .gitignore that does not contain it", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\n");
    appendToGitignore(tmpDir, "codeguide-out/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("codeguide-out/");
  });

  it("includes the CodeGuide comment before the entry", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "");
    appendToGitignore(tmpDir, "codeguide-out/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    expect(content).toContain("# CodeGuide generated index");
  });

  it("does not duplicate the entry when called twice", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "");
    appendToGitignore(tmpDir, "codeguide-out/");
    appendToGitignore(tmpDir, "codeguide-out/");
    const content = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
    const occurrences = content.split("codeguide-out/").length - 1;
    expect(occurrences).toBe(1);
  });

  it("does nothing when .gitignore does not exist", () => {
    expect(() => appendToGitignore(tmpDir, "codeguide-out/")).not.toThrow();
    expect(fs.existsSync(path.join(tmpDir, ".gitignore"))).toBe(false);
  });
});

// ─── ensureDir ────────────────────────────────────────────────────────────────

describe("ensureDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-fs-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a directory that does not exist", () => {
    const target = path.join(tmpDir, "new-dir");
    ensureDir(target);
    expect(fs.existsSync(target)).toBe(true);
  });

  it("creates nested directories in one call", () => {
    const target = path.join(tmpDir, "a", "b", "c");
    ensureDir(target);
    expect(fs.existsSync(target)).toBe(true);
  });

  it("does not throw when the directory already exists", () => {
    expect(() => ensureDir(tmpDir)).not.toThrow();
  });
});

// ─── readJsonFile ─────────────────────────────────────────────────────────────

describe("readJsonFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-fs-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the parsed object for a valid JSON file", () => {
    const filePath = path.join(tmpDir, "data.json");
    fs.writeFileSync(filePath, JSON.stringify({ key: "value" }));
    expect(readJsonFile(filePath)).toEqual({ key: "value" });
  });

  it("returns null when the file does not exist", () => {
    expect(readJsonFile(path.join(tmpDir, "missing.json"))).toBeNull();
  });

  it("returns null for a file with invalid JSON", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, "not json {{{");
    expect(readJsonFile(filePath)).toBeNull();
  });

  it("returns null for an empty file", () => {
    const filePath = path.join(tmpDir, "empty.json");
    fs.writeFileSync(filePath, "");
    expect(readJsonFile(filePath)).toBeNull();
  });
});

// ─── writeJsonFile ────────────────────────────────────────────────────────────

describe("writeJsonFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codeguide-fs-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes data as valid JSON", () => {
    const filePath = path.join(tmpDir, "out.json");
    writeJsonFile(filePath, { a: 1 });
    expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({ a: 1 });
  });

  it("uses 2-space indentation", () => {
    const filePath = path.join(tmpDir, "out.json");
    writeJsonFile(filePath, { a: 1 });
    expect(fs.readFileSync(filePath, "utf-8")).toContain("  ");
  });

  it("overwrites an existing file", () => {
    const filePath = path.join(tmpDir, "out.json");
    writeJsonFile(filePath, { old: true });
    writeJsonFile(filePath, { new: true });
    expect(JSON.parse(fs.readFileSync(filePath, "utf-8"))).toEqual({ new: true });
  });
});

// ─── getOutDir / getMissionsDir ───────────────────────────────────────────────

describe("getOutDir", () => {
  it("returns <repoRoot>/codeguide-out", () => {
    expect(getOutDir("/projects/my-app")).toBe(path.join("/projects/my-app", "codeguide-out"));
  });
});

describe("getMissionsDir", () => {
  it("returns <repoRoot>/codeguide-out/missions", () => {
    expect(getMissionsDir("/projects/my-app")).toBe(
      path.join("/projects/my-app", "codeguide-out", "missions")
    );
  });
});
