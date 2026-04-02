import { test, expect } from "bun:test";
import { sanitizeBranchName, buildTargetPath } from "./index";

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
