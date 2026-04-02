import { test, expect } from "bun:test";
import {
  sanitizeBranchName,
  buildTargetPath,
  generateCodename,
  parseWorktreeList,
  formatWorktreeList,
} from "./index";

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
  expect(buildTargetPath("/Users/user/my-project", "my-project", "main"))
    .toBe("/Users/user/my-project.worktrees/main");
});

test("buildTargetPath: branch with slash → sanitized dir name", () => {
  expect(buildTargetPath("/Users/user/my-project", "my-project", "feature/foo"))
    .toBe("/Users/user/my-project.worktrees/feature-foo");
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
