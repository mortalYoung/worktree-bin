import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildTargetPath,
  detectShell,
  formatWorktreeList,
  generateCodename,
  parseWorktreeList,
  renderCompletionInstructions,
  renderCompletionScript,
  sanitizeBranchName,
  shouldCompleteWorktreeNames,
} from "./index";

const cliPath = path.join(import.meta.dir, "index.ts");
const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function run(
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
  } = {}
): { exitCode: number; stdout: string; stderr: string } {
  const env = { ...process.env, ...options.env };
  const result = Bun.spawnSync(["bun", "run", cliPath, ...args], {
    cwd: options.cwd ?? import.meta.dir,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function runGit(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() || result.stdout.toString());
  }
}

function createRepoWithWorktree(): { repoDir: string; worktreeDir: string } {
  const baseDir = createTempDir("worktree-bin-");
  const repoDir = path.join(baseDir, "sample-repo");
  mkdirSync(repoDir, { recursive: true });

  runGit(repoDir, ["init", "--initial-branch=main"]);
  runGit(repoDir, ["config", "user.name", "Codex"]);
  runGit(repoDir, ["config", "user.email", "codex@example.com"]);

  writeFileSync(path.join(repoDir, "README.md"), "# sample\n");
  runGit(repoDir, ["add", "README.md"]);
  runGit(repoDir, ["commit", "-m", "init"]);

  const worktreeDir = path.join(baseDir, "sample-repo.worktrees", "feature-foo");
  runGit(repoDir, ["worktree", "add", "-b", "feature/foo", worktreeDir]);

  return { repoDir, worktreeDir };
}

afterAll(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sanitizeBranchName: no slashes → unchanged", () => {
  expect(sanitizeBranchName("main")).toBe("main");
});

test("sanitizeBranchName: single slash → dash", () => {
  expect(sanitizeBranchName("feature/my-branch")).toBe("feature-my-branch");
});

test("sanitizeBranchName: multiple slashes → all dashes", () => {
  expect(sanitizeBranchName("feat/scope/detail")).toBe("feat-scope-detail");
});

test("buildTargetPath: normal branch", () => {
  expect(buildTargetPath("/Users/user/my-project", "my-project", "main")).toBe(
    "/Users/user/my-project.worktrees/main"
  );
});

test("buildTargetPath: branch with slash → sanitized dir name", () => {
  expect(buildTargetPath("/Users/user/my-project", "my-project", "feature/foo")).toBe(
    "/Users/user/my-project.worktrees/feature-foo"
  );
});

test("generateCodename: returns a string", () => {
  expect(typeof generateCodename()).toBe("string");
});

test("generateCodename: contains exactly one dash separating two non-empty words", () => {
  const name = generateCodename();
  const parts = name.split("-");
  expect(parts.length).toBe(2);
  expect(parts[0].length).toBeGreaterThan(0);
  expect(parts[1].length).toBeGreaterThan(0);
});

test("parseWorktreeList: extracts branch names and code names", () => {
  const output = `
worktree /Users/user/my-project
HEAD abc123
branch refs/heads/main

worktree /Users/user/my-project.worktrees/feature-foo
HEAD def456
branch refs/heads/feature/foo

worktree /Users/user/my-project.worktrees/strip-away
HEAD ghi789
branch refs/heads/strip-away
`;

  expect(parseWorktreeList(output, "/Users/user/my-project", "my-project")).toEqual([
    {
      path: "/Users/user/my-project",
      branchName: "main",
      codeName: "root",
      isCurrent: true,
    },
    {
      path: "/Users/user/my-project.worktrees/feature-foo",
      branchName: "feature/foo",
      codeName: "feature-foo",
      isCurrent: false,
    },
    {
      path: "/Users/user/my-project.worktrees/strip-away",
      branchName: "strip-away",
      codeName: "strip-away",
      isCurrent: false,
    },
  ]);
});

test("formatWorktreeList: prints aligned table rows", () => {
  expect(
    formatWorktreeList([
      {
        path: "/Users/user/my-project",
        branchName: "main",
        codeName: "root",
        isCurrent: true,
      },
      {
        path: "/Users/user/my-project.worktrees/feature-foo",
        branchName: "feature/foo",
        codeName: "feature-foo",
        isCurrent: false,
      },
    ])
  ).toEqual([
    "CURRENT  BRANCH       CODE-NAME  ",
    "*        main         root       ",
    "         feature/foo  feature-foo",
  ]);
});

test("detectShell: defaults to bash unless shell looks like zsh", () => {
  expect(detectShell("/bin/zsh")).toBe("zsh");
  expect(detectShell("/bin/bash")).toBe("bash");
  expect(detectShell(undefined)).toBe("bash");
});

test("renderCompletionScript: prints zsh and bash templates", () => {
  expect(renderCompletionScript("zsh")).toContain("#compdef worktree");
  expect(renderCompletionScript("bash")).toContain(
    "complete -o bashdefault -o default -F _worktree_yargs_completions worktree"
  );
});

test("renderCompletionInstructions: prints friendly setup steps", () => {
  expect(renderCompletionInstructions("zsh").join("\n")).toContain(
    "source <(worktree completion zsh --script)"
  );
  expect(renderCompletionInstructions("bash").join("\n")).toContain("~/.bashrc");
});

test("shouldCompleteWorktreeNames: only true for switch/checkout positional completion", () => {
  expect(shouldCompleteWorktreeNames({ _: ["worktree", "switch"] } as never)).toBe(true);
  expect(shouldCompleteWorktreeNames({ _: ["worktree", "checkout", "root"] } as never)).toBe(true);
  expect(shouldCompleteWorktreeNames({ _: ["worktree", "list"] } as never)).toBe(false);
  expect(shouldCompleteWorktreeNames({ _: ["worktree", "switch", "root", "extra"] } as never)).toBe(
    false
  );
});

test("CLI help: shows yargs-generated commands including completion", () => {
  const result = run(["--help"]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("worktree completion [shell]");
  expect(result.stdout).toContain("[aliases: checkout]");
});

test("CLI invalid command: shows help and exits non-zero", () => {
  const result = run(["nope"]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("worktree <command>");
  expect(result.stderr).toContain("Unknown command: nope");
});

test("CLI completion command: defaults to human-friendly instructions", () => {
  const detected = run(["completion"], { env: { SHELL: "/bin/zsh" } });
  const zsh = run(["completion", "zsh"]);

  expect(detected.exitCode).toBe(0);
  expect(detected.stdout).toContain("▶ Shell completion for zsh");
  expect(detected.stdout).toContain("worktree completion zsh --script");

  expect(zsh.exitCode).toBe(0);
  expect(zsh.stdout).toContain("▶ Shell completion for zsh");
  expect(zsh.stdout).not.toContain("#compdef worktree");
});

test("CLI completion command: prints raw script with --script", () => {
  const zsh = run(["completion", "zsh", "--script"]);
  const bash = run(["completion", "bash", "--script"]);

  expect(zsh.exitCode).toBe(0);
  expect(zsh.stdout).toContain("#compdef worktree");

  expect(bash.exitCode).toBe(0);
  expect(bash.stdout).toContain("complete -o bashdefault -o default");
});

test("dynamic completion: switch/checkout return worktree names in a git repo", () => {
  const { repoDir } = createRepoWithWorktree();

  const switchResult = run(["--get-yargs-completions", "worktree", "switch", ""], {
    cwd: repoDir,
    env: { SHELL: "/bin/bash" },
  });
  const checkoutResult = run(["--get-yargs-completions", "worktree", "checkout", ""], {
    cwd: repoDir,
    env: { SHELL: "/bin/bash" },
  });

  expect(switchResult.exitCode).toBe(0);
  expect(switchResult.stdout).toContain("root");
  expect(switchResult.stdout).toContain("feature-foo");

  expect(checkoutResult.exitCode).toBe(0);
  expect(checkoutResult.stdout).toContain("root");
  expect(checkoutResult.stdout).toContain("feature-foo");
});

test("dynamic completion: switch filters worktree names by the current prefix", () => {
  const { repoDir } = createRepoWithWorktree();
  const result = run(["--get-yargs-completions", "worktree", "switch", "fe"], {
    cwd: repoDir,
    env: { SHELL: "/bin/bash" },
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("feature-foo");
  expect(result.stdout).not.toContain("root");
  expect(result.stderr).toBe("");
});

test("dynamic completion: unrelated commands do not return worktree names", () => {
  const { repoDir } = createRepoWithWorktree();

  const result = run(["--get-yargs-completions", "worktree", "list", ""], {
    cwd: repoDir,
    env: { SHELL: "/bin/bash" },
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout).not.toContain("root");
  expect(result.stdout).not.toContain("feature-foo");
});

test("dynamic completion: non-git directories fail gracefully with no worktree suggestions", () => {
  const cwd = createTempDir("worktree-bin-non-git-");
  const result = run(["--get-yargs-completions", "worktree", "switch", ""], {
    cwd,
    env: { SHELL: "/bin/bash" },
  });

  expect(result.stderr).not.toContain("Error: not a git repository");
  expect(result.stdout).not.toContain("root");
  expect(result.stdout).not.toContain("feature-foo");
});
