---
name: create-agentsmd
description: Draft a new AGENTS.md for this repository by inspecting the main app or src code structure and inferring concise project conventions. Use when the user explicitly asks to create a new AGENTS.md or requests an AGENTS.md draft.
---

# Create AGENTS.md

## Purpose

Create a new `AGENTS.md` draft for the current repository.

This skill is for draft generation, not blind replacement:
- Do not overwrite an existing `AGENTS.md` unless the user explicitly asks.
- Prefer presenting a proposed draft or writing to a separate draft file first.
- Keep the result concise, practical, and repository-specific.

## Default Behavior

1. Inspect the main product code first:
   - `app/`
   - `src/`
2. Infer the project's actual structure, framework usage, and implementation style from code.
3. Write the draft in Korean.
4. Keep tone short, clear, and practical.
5. Always include a `목표` section.
6. Add other sections only when the repository clearly supports them.

## Workflow

1. Check whether `AGENTS.md` already exists.
2. If it exists and the user did not ask to replace it:
   - keep it untouched
   - prepare a draft proposal instead
3. Read a small set of high-signal files and folders:
   - entry pages, layouts, route handlers, shared UI, hooks, or utilities under `app/` or `src/`
4. Infer:
   - product purpose
   - framework and rendering patterns
   - coding conventions already visible in the repo
   - testing or validation commands only if clearly present
   - security or config guidance only if clearly supported by the repo
5. Draft `AGENTS.md` with concrete rules, not generic filler.

## Writing Rules

- Prefer repo-specific guidance over universal advice.
- Keep sections brief and scannable.
- Avoid invented tools, workflows, or infrastructure.
- Avoid large architecture claims unless visible in code.
- Match the repository's package manager and framework conventions.
- Prefer MVP scope and simple guidance unless the codebase clearly requires more.

## Output Shape

Use this structure as a default:

```markdown
# [프로젝트 이름] 프로젝트 규칙

## 목표

- ...

## 개발 환경

- ...

## 프레임워크 규칙

- ...

## 출력 스타일

- ...
```

Only include extra sections such as testing, security, UI, deployment, or storage when they are supported by the repository evidence.

## Guardrails

- Do not copy generic boilerplate unrelated to the repo.
- Do not claim databases, CI, cloud infra, or auth systems unless confirmed.
- Do not expose secrets or instruct committing secret files.
- If evidence is weak, state assumptions briefly and keep the draft conservative.

## Example Trigger Requests

- "Create an AGENTS.md for this repo."
- "Draft a new AGENTS.md from the current Next.js app."
- "Write project rules based on the codebase."
