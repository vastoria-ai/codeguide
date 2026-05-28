#!/usr/bin/env node
// Writes ~/.claude/commands/codeguide.md so that /codeguide tour,
// /codeguide mission <topic>, etc. resolve as real slash commands in every
// Claude Code session — no per-project setup needed.

import fs from "fs";
import os from "os";
import path from "path";

const COMMAND_CONTENT = `---
description: CodeGuide — tour, mission <topic>, ask "<question>", sync
argument-hint: [tour | mission <topic> | ask "<question>" | sync]
---

Execute CodeGuide sub-command: $ARGUMENTS

If \`codeguide-out/\` does not exist in the current project, tell the user to run \`codeguide init\` in their terminal first, then stop.

---

### tour
1. Read \`codeguide-out/GRAPH_REPORT.md\`
2. Read \`codeguide-out/INDEX.md\`
3. Present: what the project does, the top-level modules, entry points, and 2–3 suggested missions

---

### mission <topic>
Extract topic = everything after "mission " in the arguments.
1. Check if \`codeguide-out/missions/<topic>.md\` exists
2. If yes: load it and present Step 1
3. If no: generate the mission file using the index, save it to \`codeguide-out/missions/<topic>.md\`, then present Step 1
4. Present **one step at a time** — wait for "done", "next", or a question before continuing
5. When the user asks a question mid-mission: answer with file references, then offer to continue
6. Never skip steps
7. After the final step: suggest a follow-up mission from GRAPH_REPORT.md

Mission file format:
\`\`\`
# Mission: <Title>
Generated for: <project> | Topic: <topic>

## Overview
<2-3 sentences referencing actual file paths.>

## Steps

### Step 1 — Learn: <concept>
**Read:** \`<file>\` lines <N>-<M>
<Explanation with specific functions and patterns.>
**Concept check:** <Question before moving on.>

---

### Step N — Task: <build or modify something>
<Specific task referencing existing files as patterns.>
**Hint:** <Hint for when stuck.>

---

### Reflect
You now understand:
- <bullet>

**Next mission:** \`/codeguide mission <related-topic>\`
\`\`\`

---

### ask "<question>"
1. Read \`codeguide-out/INDEX.md\` and \`codeguide-out/STRUCTURE.md\`
2. Answer with specific file paths and line numbers
3. Only read raw source files if the index does not answer the question

---

### sync / init
Tell the user to run \`codeguide init\` in the terminal to regenerate the index.
`;

const commandsDir = path.join(os.homedir(), ".claude", "commands");
const commandFile = path.join(commandsDir, "codeguide.md");

try {
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.writeFileSync(commandFile, COMMAND_CONTENT);
  console.log("  codeguide: registered /codeguide slash command in ~/.claude/commands/");
} catch {
  // Non-fatal — Claude Code may not be installed, or the directory may be read-only.
}
