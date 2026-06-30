# SKILL.md — quality-gate

name: quality-gate
version: "1.0"
category: engineering
description: |
Enforces code quality standards for type safety, dead code removal, and
comment hygiene. Run after EVERY task completion — no exceptions.

triggers:

- after_task_completion
- before_commit
- before_push
- ci_pipeline

## Checklist (ALL must pass)

### 1. Type Safety

- [ ] `tsc --noEmit` — zero errors
- [ ] No `any` in codebase (`grep -r ": any\b\|as any\b" src/`)
- [ ] No loose `Record<string, *>` where a specific type exists

### 2. Single Source of Truth

- [ ] No duplicate type definitions across files
- [ ] Constants derive from canonical types (e.g. `Record<CanonicalType, string>`)
- [ ] No removed/deprecated enum values in runtime code

### 3. Dead Code Removal

- [ ] No unused types, interfaces, or files
- [ ] No unused imports
- [ ] No unused exports

### 4. Comment Hygiene

- [ ] No historical references: `FIX #`, `Bug N`, `Feature Request N`, `Tier N`, `used to`, `previously`, `formerly`, `no longer`, `had been`, `was a`, `were`, `recreated`, `the original`, `PR #`
- [ ] No self-referential tags: `I1:`, `I2:`, etc.
- [ ] Comments describe CURRENT behavior only

### 5. Test Coverage

- [ ] All tests pass
- [ ] No skipped tests without implementation plan
- [ ] Tests import from canonical types, not barrels when direct is clearer

### 6. Build & Lint

- [ ] Build passes — zero errors
- [ ] Lint passes — zero warnings
- [ ] All tests pass

### 7. Duplication Check

- [ ] No duplicate type definitions for the same concept
- [ ] Constants derive from canonical types (e.g. `Record<CanonicalType, string>`)

## Automation

### Git Hooks (.husky/pre-commit)

```bash
#!/usr/bin/env bash
set -e
pnpm lint && pnpm test && pnpm build && npx tsc --noEmit
```

### Hermes Cron (Daily Drift Detection)

```bash
# cronjob: daily scan
grep -r "FIX #\|Bug [0-9]\|used to\|previously\|no longer" src/ --include="*.ts" --include="*.tsx"
grep -r "as any\|: any\b" src/ --include="*.ts" --include="*.tsx"
grep -rn "^export interface\|^export type" src/ --include="*.ts" | sort | check_duplicates
```

## Escape Hatch

Only bypass with explicit user approval: "I know this violates quality-gate, proceed anyway"
