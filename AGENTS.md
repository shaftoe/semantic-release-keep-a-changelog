# Development Guidelines for AI Agents

This file contains important rules and guidelines for AI agents working on this project. Follow these strictly to prevent regressions.

## Code Quality and Testing Requirements


- Use pnpm (v12+) as package manager and vitest as test suite. Never use `npm` or `bun` unless strictly necessary
- Don't use `Date()` APIs, only Temporal use with polyfill is allowed

## Rule: Always Run Tests and Checks Before Completing Changes

Before considering any change complete, **you MUST** run both of the following commands:

```bash
pnpm run test
pnpm run validate
```

- `pnpm run test`: Runs all unit tests to ensure functionality is not broken
- `pnpm run format` to apply formatting and linting rules
- `pnpm run validate`: Runs both `pnpm run typecheck` (TypeScript type checking) and `pnpm run check` (linting)

**Both commands must pass with zero failures and zero errors before a change can be considered complete.**

If either command fails:

1. Fix all reported issues
2. Re-run both commands to verify the fixes
3. Only then consider the change complete

This prevents regressions and ensures code quality standards are maintained.
