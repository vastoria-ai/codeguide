---
name: pr-description
description: Use this skill when the user asks to "generate a PR description", "create a PR description", "write PR description for this branch", or wants a pull request summary for the current branch.
version: 1.0.0
---

# PR Description Skill

Generates a structured pull request description in markdown by inspecting the current branch's commits and diff against `main`.

## When This Skill Applies

- "generate PR description"
- "create PR description"
- "write a PR description for this branch"
- "generate PR description for the current branch"

## Implementation Steps

### 1. Gather branch information

Run the following commands in parallel:

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD
```

### 2. Analyse the changes

From the output above, identify:
- **What changed** — new files, modified files, deleted files
- **Why it changed** — infer intent from commit messages and the diff
- **Scope** — is this a new feature, bug fix, refactor, docs update, etc.?

### 3. Produce the PR description

Output the description as a raw markdown code block so the user can copy-paste it directly into GitHub. Use this exact structure:

~~~markdown
## Summary

- <bullet — what was added/changed and why, one idea per bullet>
- <bullet>
- ...

## Test plan

- [ ] <concrete step the reviewer should take to verify the change>
- [ ] <another step>
- ...

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
~~~

### 4. Guidelines

- Keep the **Summary** focused on *why*, not just *what* — the diff already shows what.
- Each **Test plan** item should be actionable (e.g. "Run `npm test` and confirm all tests pass", not "Test the code").
- If the branch has no commits ahead of `main`, tell the user and stop.
- Do not create a GitHub PR — only produce the description text.
