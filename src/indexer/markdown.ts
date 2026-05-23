import fs from "fs";
import path from "path";
import { Module } from "./modules.js";
import { ScannedFile, buildFileTree } from "./scanner.js";

export interface IndexData {
  projectName: string;
  generatedAt: string;
  fileCount: number;
  moduleCount: number;
  modules: Module[];
  files: ScannedFile[];
  repoRoot: string;
  packageJSON?: Record<string, unknown>;
  readmeSnippet?: string;
}

export function readPackageJson(repoRoot: string): Record<string, unknown> | undefined {
  const pkgPath = path.join(repoRoot, "package.json");
  if (!fs.existsSync(pkgPath)) return undefined;

  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch {
    return undefined;
  }
}

export function readReadmeSnippet(repoRoot: string): string | undefined {
  const candidates = ["README.md", "readme.md", "README.MD", "README", "readme"];
  for (const name of candidates) {
    const readmePath = path.join(repoRoot, name);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      return lines.slice(0, 4).join(" ").slice(0, 500);
    }
  }
  return undefined;
}

export function buildIndexMarkdown(data: IndexData): string {
  const pkg = data.packageJSON;
  const description = (pkg?.description as string) ?? data.readmeSnippet ?? "No description found.";
  const dateStr = new Date(data.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const lines: string[] = [
    `# CodeGuide Index — ${data.projectName}`,
    "",
    `Generated: ${dateStr} | Files: ${data.fileCount} | Modules: ${data.moduleCount}`,
    "",
    `## What this project does`,
    "",
    description,
    "",
  ];

  if (pkg?.dependencies || pkg?.devDependencies) {
    const deps = Object.keys({
      ...((pkg.dependencies as object) ?? {}),
      ...((pkg.devDependencies as object) ?? {}),
    });
    const notableFrameworks = deps
      .filter((d) =>
        [
          "express",
          "fastify",
          "next",
          "nuxt",
          "react",
          "vue",
          "svelte",
          "nestjs",
          "prisma",
          "typeorm",
          "mongoose",
          "sequelize",
          "drizzle",
          "stripe",
          "twilio",
          "sendgrid",
          "nodemailer",
          "jest",
          "vitest",
          "playwright",
          "cypress",
        ].some((f) => d.includes(f))
      )
      .slice(0, 8);

    if (notableFrameworks.length > 0) {
      lines.push(`## Tech stack`, "", notableFrameworks.map((f) => `- ${f}`).join("\n"), "");
    }
  }

  lines.push(`## Module map`, "");

  for (const mod of data.modules) {
    if (mod.isTest) continue;

    lines.push(`### ${mod.directory}`);
    lines.push(`**Purpose:** ${mod.purpose}`);
    lines.push(``);

    if (mod.keyFiles.length > 0) {
      lines.push("**Key files: **");
      for (const kf of mod.keyFiles) {
        lines.push(`- \`${kf.path}\` - ${kf.role}`);
      }
    }

    if (mod.dependencies.length > 0) {
      lines.push(`**Imports from:** ${mod.dependencies.map((d) => `-> ${d}`).join(", ")}`);
    }

    lines.push("");
  }

  const testModules = data.modules.filter((m) => m.isTest);
  if (testModules.length > 0) {
    lines.push(`## Test locations`, "");
    for (const mod of testModules) {
      lines.push(`- \`${mod.directory}/\` - ${mod.purpose}`);
    }
    lines.push("");
  }

  const entryPoints = data.files.filter((f) => {
    const name = path.basename(f.path);
    return (
      [
        "index.ts",
        "index.js",
        "main.ts",
        "main.js",
        "app.ts",
        "app.js",
        "server.ts",
        "server.js",
      ].includes(name) && !f.path.includes("__tests__")
    );
  });

  if (entryPoints.length > 0) {
    lines.push(`## Entry points`, "");
    for (const ep of entryPoints.slice(0, 5)) {
      lines.push(`- \`${ep.path}\``);
    }
    lines.push("");
  }

  lines.push(`## File tree`, "", "```", buildFileTree(data.files, data.repoRoot), "```", "");
  return lines.join("\n");
}

export function buildStructureMarkdown(data: IndexData): string {
  const lines: string[] = [
    `# CodeGuide Structure — ${data.projectName}`,
    "",
    `Module dependency graph. Read this to understand how the codebase fits together.`,
    "",
    `## Module dependencies`,
    "",
  ];

  for (const mod of data.modules.filter((m) => !m.isTest)) {
    if (mod.dependencies.length === 0) {
      lines.push(`**${mod.name}** — no internal dependencies (foundational module)`);
    } else {
      lines.push(`**${mod.name}** → depends on: ${mod.dependencies.join(", ")}`);
    }
  }

  lines.push("", `## Start here`, "");
  lines.push(
    `When learning this codebase, a good reading order is:`,
    "",
    ...data.modules
      .filter((m) => !m.isTest && m.dependencies.length === 0)
      .map((m) => `1. \`${m.directory}/\` — ${m.purpose} (no deps, foundational)`),
    ...data.modules
      .filter((m) => !m.isTest && m.dependencies.length > 0)
      .map((m) => `2. \`${m.directory}/\` — ${m.purpose}`),
    ""
  );

  return lines.join("\n");
}

export function buildGraphReport(data: IndexData): string {
  const nonTestModules = data.modules.filter((m) => !m.isTest);

  const lines: string[] = [
    `# CodeGuide Report — ${data.projectName}`,
    "",
    `> Quick-read summary. Generated ${new Date(data.generatedAt).toLocaleDateString()}.`,
    "",
    `**${data.fileCount} files** across **${nonTestModules.length} modules**`,
    "",
    `## At a glance`,
    "",
  ];

  for (const mod of nonTestModules) {
    lines.push(`- **${mod.name}** (\`${mod.directory}/\`) — ${mod.purpose}`);
  }

  lines.push("", `## Suggested missions`, "");
  lines.push(
    `Run these in Claude Code or Codex to learn the codebase interactively:`,
    "",
    ...nonTestModules
      .filter((m) => !["utils", "helpers", "types", "config"].includes(m.name))
      .slice(0, 5)
      .map((m) => `- \`/codeguide mission ${m.name}\``),
    ""
  );

  lines.push(
    `## CodeGuide commands`,
    "",
    "| Command | What it does |",
    "|---|---|",
    "| `/codeguide tour` | Get a structured orientation of this codebase |",
    "| `/codeguide mission <topic>` | Start a step-by-step learning mission |",
    '| `/codeguide ask "<question>"` | Ask anything about this codebase |',
    "| `/codeguide init` | Rebuild this index after major refactors |",
    ""
  );

  return lines.join("\n");
}
