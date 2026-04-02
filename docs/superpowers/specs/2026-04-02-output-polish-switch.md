# Output Polish + worktree switch Design Spec

**Date:** 2026-04-02  
**Status:** Approved

## Overview

Five improvements to the existing `worktree` CLI:

1. Change `No branch name provided` message from `console.error` to `console.log`
2. Beautify all output with symbol prefixes (`▶` / `✓`)
3. Add `worktree switch <name>` command — opens a new subshell in the worktree directory
4. At the end of `worktree add`, print `  worktree switch <safeName>` for easy copy-paste
5. `worktree checkout <name>` is an alias for `worktree switch <name>`

## Output Style

All informational/progress output uses `console.log` with symbol prefixes. Errors keep `console.error` (stderr). The `switch` command's subshell spawn produces no extra output from the tool itself.

| Symbol | Meaning |
|--------|---------|
| `▶` | progress / info |
| `✓` | success |

### `worktree add` output

```
▶ No branch name provided. Using generated codename: strip-away
▶ Creating worktree: strip-away
✓ Worktree ready

  worktree switch strip-away
```

When branch name is provided (no codename line):
```
▶ Creating worktree: feature-foo
✓ Worktree ready

  worktree switch feature-foo
```

## Command: `worktree switch <name>` / `worktree checkout <name>`

`<name>` is the sanitized directory name (slashes replaced with dashes), e.g. `unless-chemical` or `feature-foo`.

### Execution Steps

1. **Validate argument** — check `name` is provided; if not, print `Usage: worktree switch <name>` and exit(1)
2. **Resolve git root** — `git rev-parse --show-toplevel`; if fails, print error and exit(1)
3. **Build target path** — `{parent}/{repoName}.worktrees/{name}` (no sanitization needed, name is already sanitized)
4. **Check directory exists** — if `{targetPath}` does not exist, print `Error: worktree '{name}' not found` and exit(1)
5. **Spawn subshell** — `process.chdir(targetPath)`, then `Bun.spawnSync([process.env.SHELL ?? "zsh"], { stdio: ["inherit", "inherit", "inherit"] })`

`checkout` dispatches to the same handler as `switch`.

## Code Changes

### `index.ts`

- Add `commandSwitch(name: string)` async function
- Update `main()` dispatch to handle `switch` and `checkout` (both call `commandSwitch`)
- Update `add` command output to use `▶`/`✓` symbols and `console.log`
- Print `\n  worktree switch <safeName>\n` at the end of a successful `add`
- Update unknown-command usage message to list all three commands

### Error Handling Additions

| Situation | Behavior |
|-----------|----------|
| `worktree switch` with no name | Print `Usage: worktree switch <name>` and exit(1) |
| Worktree directory not found | Print `Error: worktree '{name}' not found` and exit(1) |

## Non-Goals

- Shell rc file modification
- Listing available worktrees
- Tab completion
