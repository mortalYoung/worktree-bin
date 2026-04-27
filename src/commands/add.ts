import { buildGeneratedBranchName } from "../domain/branchName";
import path from "node:path";
import { generateCodename } from "../domain/codename";
import { buildTargetPath, sanitizeBranchName } from "../domain/worktree";
import {
  addExistingBranchWorktree,
  addNewBranchWorktree,
  doesLocalBranchExist,
  getGitRoot,
} from "../infra/git";
import { copyConfigDirectories } from "../infra/fs";
import { exitNotGitRepository } from "./shared";

export async function commandAdd(
  branchName: string | undefined,
  options: { prefix?: string } = {}
): Promise<void> {
  let name = branchName;

  if (!name) {
    name = buildGeneratedBranchName(options.prefix, generateCodename());
    console.log(`▶ No branch name provided. Using generated codename: ${name}`);
  }

  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    exitNotGitRepository();
  }

  const repoName = path.basename(gitRoot);
  const safeName = sanitizeBranchName(name);
  const targetPath = buildTargetPath(gitRoot, repoName, name);

  console.log(`▶ Creating worktree: ${safeName}`);

  if (await doesLocalBranchExist(name)) {
    await addExistingBranchWorktree(targetPath, name);
  } else {
    await addNewBranchWorktree(targetPath, name);
  }

  await copyConfigDirectories(gitRoot, targetPath);

  console.log("✓ Worktree ready");
  console.log(`\n  worktree switch ${safeName}\n`);
}
