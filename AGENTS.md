
---

## CodeGuide — codebase learning

A structured codebase index lives in `codeguide-out/`.

### Before answering any architecture or "how does X work" question:
1. Read `codeguide-out/INDEX.md` — it maps every module with key files
2. Read `codeguide-out/STRUCTURE.md` for the dependency graph
3. Reference specific files and line numbers in answers — never generic advice
4. Only grep raw source files if the index doesn't answer the question

### Slash commands available in this session:
| Command | What it does |
|---|---|
| `/codeguide init` | Re-index this repository (run after major refactors) |
| `/codeguide tour` | Give a structured orientation of this codebase |
| `/codeguide mission <topic>` | Run a step-by-step interactive learning mission |
| `/codeguide ask "<question>"` | Answer a question using the index |
| `/codeguide sync` | Incrementally update the index for changed files |

### Running a mission — follow this format exactly:
When `/codeguide mission <topic>` is run:
1. Check if `codeguide-out/missions/<topic>.md` exists
2. If yes: load it and start from Step 1
3. If no: generate the mission file using the index, save it, then start Step 1
4. **Present one step at a time.** Wait for the user to say "done", "next",
   or ask a question before showing the next step
5. When the user asks a question mid-mission: answer it with file references,
   then offer to continue with the current step
6. Never skip steps. The pacing is the learning
7. After the final step: suggest a follow-up mission from GRAPH_REPORT.md

### Generating a mission file — use this structure exactly:
```markdown
# Mission: <Title>

Generated for: <project> | Topic: <topic>

## Overview
<2-3 sentences about how <topic> works specifically in THIS codebase.
Reference actual file paths.>

## Steps

### Step 1 — Learn: <concept>
**Read:** `<file path>` lines <N>-<M>
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

**Next mission:** `/codeguide mission <related-topic>`
```

---
