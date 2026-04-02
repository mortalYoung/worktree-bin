import { test, expect } from "bun:test";
import { sanitizeBranchName, buildTargetPath, generateCodename } from "./index";

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
