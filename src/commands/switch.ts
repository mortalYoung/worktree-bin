import path from "node:path";
import { buildTargetPath } from "../domain/worktree";
import { getGitRoot } from "../infra/git";
import { ensureDirectoryExists } from "../infra/fs";
import { exitNotGitRepository } from "./shared";

export async function commandSwitch(name: string): Promise<void> {
  let gitRoot: string;
  try {
    gitRoot = await getGitRoot();
  } catch {
    exitNotGitRepository();
  }

  const repoName = path.basename(gitRoot);
  const targetPath = name === "root" ? gitRoot : buildTargetPath(gitRoot, repoName, name);
  const currentPath = process.cwd();

  if (!(await ensureDirectoryExists(targetPath))) {
    console.error(`Error: worktree '${name}' not found`);
    process.exit(1);
  }

  if (path.resolve(currentPath) === path.resolve(targetPath)) {
    console.log(`▶ Already in worktree: ${name}`);
    return;
  }

  process.chdir(targetPath);
  Bun.spawnSync([process.env.SHELL ?? "zsh"], {
    stdio: ["inherit", "inherit", "inherit"],
  });
}
