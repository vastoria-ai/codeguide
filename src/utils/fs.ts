import fs from "fs";
import path from "path";

export function appendIfMissing(filePath: string, content: string, marker: string): boolean {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    if (existing.includes(marker)) return false; // already installed
    fs.appendFileSync(filePath, "\n" + content);
  } else {
    fs.writeFileSync(filePath, content);
  }
  return true;
}

export function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function appendToGitignore(repoRoot: string, entry: string): void {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes(entry)) {
      fs.appendFileSync(gitignorePath, `\n# CodeGuide generated index\n${entry}\n`);
    }
  }
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeJsonFile(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getOutDir(repoRoot: string): string {
  return path.join(repoRoot, "codeguide-out");
}

export function getMissionsDir(repoRoot: string): string {
  return path.join(getOutDir(repoRoot), "missions");
}
