import fs from "fs";
import path from "path";

export interface ScannedFile {
  path: string;
  absolutePath: string;
  extension: string;
  sizeBytes: string;
}

const CODE_EXTENSIONS = new Set([
  // Javascript / Typescript
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  // Python
  ".py",
  // Backend Languages
  ".go",
  ".rs",
  ".rb",
  ".java",
  ".kt",
  ".swift",
  ".php",
  ".cs",
  ".c",
  ".cpp",
  ".h",
  // Web
  ".css",
  ".scss",
  ".html",
  ".vue",
  ".svelte",
  ".astro",
  // Config / Schema
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".env.example",
  ".prisma",
  ".graphql",
  ".sql",
  // Docs
  ".md",
  ".mdx",
  ".txt",
  // Shell
  ".sh",
  ".bash",
  ".zsh",
]);

const NAMED_FILES = new Set([
  "Dockerfile",
  "Makefile",
  "Procfile",
  "Brewfile",
  "Jenkinsfile",
  ".env.example",
  ".env.sample",
  "CLAUDE.md",
  "AGENTS.md",
  "README",
]);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "coverage",
  ".nyc_output",
  "__pycache__",
  ".venv",
  "venv",
  ".mypy_cache",
  "vendor",
  ".cargo",
  "target",
  ".turbo",
  "codeguide-out",
  ".codeguide",
  "graphify-out",
  ".vercel",
  ".netlify",
  "storybook-static",
]);

const MAX_FILE_SIZE = 500_000;

export function scanRepo(repoRoot: string): ScannedFile[] {
  const files: ScannedFile[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        const absPath = path.join(dir, entry.name);
        const ext = path.extname(entry.name);
        const isCodeFile = CODE_EXTENSIONS.has(ext);
        const isNamedFile = NAMED_FILES.has(entry.name);

        if (isCodeFile || isNamedFile) {
          try {
            const stat = fs.statSync(absPath);
            if (stat.size < MAX_FILE_SIZE) {
              files.push({
                path: path.relative(repoRoot, absPath),
                absolutePath: absPath,
                extension: ext || entry.name,
                sizeBytes: `${stat.size}`,
              });
            }
          } catch {
            // skip files we can't stat
          }
        }
      }
    }
  }

  walk(repoRoot);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function buildFileTree(files: ScannedFile[], repoRoot: string): string {
  const projectName = path.basename(repoRoot);
  const lines: string[] = [`${projectName}`];

  const groups = new Map<string, string[]>();
  for (const file of files) {
    const parts = file.path.split(path.sep);
    const group = parts.length > 1 ? parts[0] : ".";
    if (!groups.has(group)) groups.set(group, []);

    groups.get(group)!.push(file.path);
  }

  for (const [group, groupFiles] of groups) {
    if (group === ".") {
      for (const f of groupFiles) {
        lines.push(`  ${path.basename(f)}`);
      }
    } else {
      lines.push(`  ${group}/`);
      for (const f of groupFiles.slice(0, 20)) {
        lines.push(`  ${f.replace(group + path.sep, "")}`);
      }
      if (groupFiles.length > 20) {
        lines.push(`  ... and ${groupFiles.length - 20} more files`);
      }
    }
  }

  return lines.join("\n");
}
