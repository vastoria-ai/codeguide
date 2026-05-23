import fs from "fs";
import path from "path";
import chalk from "chalk";

import { appendIfMissing, deepMerge, ensureDir, writeJsonFile } from "../utils/fs.js";

const MARKER = "CodeGuide — codebase learning";

// ─────────────────────────────────────────────────────────────────────────────
// The directive is identical for both CLAUDE.md and AGENTS.md.
// CLAUDE.md: Claude Code reads this before every session.
// AGENTS.md: OpenAI Codex + Cursor + OpenCode + Factory Droid read this.
// ─────────────────────────────────────────────────────────────────────────────
const DIRECTIVE = `
---

## ${MARKER}

A structured codebase index lives in \`codeguide-out/\`.

### Before answering any architecture or "how does X work" question:
1. Read \`codeguide-out/INDEX.md\` — it maps every module with key files
2. Read \`codeguide-out/STRUCTURE.md\` for the dependency graph
3. Reference specific files and line numbers in answers — never generic advice
4. Only grep raw source files if the index doesn't answer the question

### Slash commands available in this session:
| Command | What it does |
|---|---|
| \`/codeguide init\` | Re-index this repository (run after major refactors) |
| \`/codeguide tour\` | Give a structured orientation of this codebase |
| \`/codeguide mission <topic>\` | Run a step-by-step interactive learning mission |
| \`/codeguide ask "<question>"\` | Answer a question using the index |
| \`/codeguide sync\` | Incrementally update the index for changed files |

### Running a mission — follow this format exactly:
When \`/codeguide mission <topic>\` is run:
1. Check if \`codeguide-out/missions/<topic>.md\` exists
2. If yes: load it and start from Step 1
3. If no: generate the mission file using the index, save it, then start Step 1
4. **Present one step at a time.** Wait for the user to say "done", "next",
   or ask a question before showing the next step
5. When the user asks a question mid-mission: answer it with file references,
   then offer to continue with the current step
6. Never skip steps. The pacing is the learning
7. After the final step: suggest a follow-up mission from GRAPH_REPORT.md

### Generating a mission file — use this structure exactly:
\`\`\`markdown
# Mission: <Title>

Generated for: <project> | Topic: <topic>

## Overview
<2-3 sentences about how <topic> works specifically in THIS codebase.
Reference actual file paths.>

## Steps

### Step 1 — Learn: <concept>
**Read:** \`<file path>\` lines <N>-<M>
<Explanation referencing specific functions, variables, and patterns from the code.>

**Concept check:** <A question to confirm understanding before moving on.>

---

### Step 2 — Learn: <next concept>
...

### Step N — Task: <something to build or modify>
<Specific task. Reference existing files as patterns to follow.>
**Hint:** <Hint for when they get stuck.>

---

### Step N+1 — Verify: <check understanding>
<A question or small challenge that confirms they understood the task.>

---

### Reflect
You now understand:
- <bullet 1>
- <bullet 2>

**Next mission:** \`/codeguide mission <related-topic>\`
\`\`\`

---
`;

// ─────────────────────────────────────────────────────────────────────────────
// Claude Code PreToolUse hook — fires before every Grep/Glob/Read call.
// Tells Claude to check the index before grepping raw files.
// OpenAI Codex does not support PreToolUse hooks — AGENTS.md handles it instead.
// ─────────────────────────────────────────────────────────────────────────────

const CLAUDE_HOOK_CONFIG = {
  hooks: {
    PreToolUse: [
      {
        matcher: "Glob|Grep|Read",
        hooks: [
          {
            type: "command",
            command: "codeguide hook-check",
          },
        ],
      },
    ],
  },
};

export function installCommand(dir: string = process.cwd()): void {
  console.log(chalk.bold("\n CodeGuide - install\n"));

  let claudeWritten = false;
  let agentsWritten = false;
  let hookWritten = false;

  const claudeMdPath = path.join(dir, "CLAUDE.md");
  claudeWritten = appendIfMissing(claudeMdPath, DIRECTIVE, MARKER);
  if (claudeWritten) {
    console.log(chalk.green("  ✓ CLAUDE.md") + chalk.dim("- Claude Code directive written"));
  } else {
    console.log(chalk.dim(" . CLAUDE.md already has CodeGuide section"));
  }

  const agentsMdPath = path.join(dir, "AGENTS.md");
  agentsWritten = appendIfMissing(agentsMdPath, DIRECTIVE, MARKER);
  if (agentsWritten) {
    console.log(
      chalk.green("  ✓ AGENTS.md") + chalk.dim(" — Codex / Cursor / OpenCode directive written")
    );
  } else {
    console.log(chalk.dim("  · AGENTS.md already has CodeGuide section"));
  }

  const settingsDir = path.join(dir, ".claude");
  const settingPath = path.join(settingsDir, "settings.json");
  try {
    ensureDir(settingsDir);
    const existing = fs.existsSync(settingPath)
      ? JSON.parse(fs.readFileSync(settingPath, "utf-8"))
      : {};
    const merged = deepMerge(existing, CLAUDE_HOOK_CONFIG);
    writeJsonFile(settingPath, merged);
    hookWritten = true;
    console.log(
      chalk.green("  ✓ .claude/settings.json") + chalk.dim(" — PreToolUse hook registered")
    );
  } catch {
    console.log(chalk.yellow("  ⚠ Could not write .claude/settings.json — hook not installed"));
  }

  // Summary
  console.log("");
  if (claudeWritten || agentsWritten || hookWritten) {
    console.log(chalk.bold("  Supported platforms:"));
    console.log(chalk.dim("    Claude Code ............. CLAUDE.md + PreToolUse hook"));
    console.log(chalk.dim("    OpenAI Codex ............ AGENTS.md"));
    console.log(chalk.dim("    Cursor (agent mode) ..... AGENTS.md"));
    console.log(chalk.dim("    OpenCode ................ AGENTS.md"));
    console.log(chalk.dim("    Factory Droid ........... AGENTS.md"));
    console.log("");
    console.log(chalk.bold("  Next steps:"));
    console.log(chalk.cyan("    codeguide init") + chalk.dim("     — index this repository"));
    console.log(chalk.cyan("    codeguide doctor") + chalk.dim("   — verify the installation"));
  } else {
    console.log(chalk.dim("  Already installed. Run `codeguide doctor` to verify."));
  }

  console.log("");
}
