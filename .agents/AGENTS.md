# Project Rules

- I am strictly forbidden from using `any` (or `as any`) anywhere in the codebase. All typings must be strict. If third-party libraries require a generic, I must define proper interfaces or use `unknown` and type guards.
