import path from "node:path";
import { readdirSync, rmSync } from "node:fs";
import { $ } from "bun";

export function getManagedWorktreeRoot(gitRoot: string): string {
  return path.join(path.dirname(gitRoot), `${path.basename(gitRoot)}.worktrees`);
}

export async function copyConfigDirectories(gitRoot: string, targetPath: string): Promise<void> {
  const vscodeSource = path.join(gitRoot, ".vscode");

  try {
    await $`test -d ${vscodeSource}`.quiet();
    await $`cp -r ${vscodeSource} ${targetPath}/`;
  } catch {
    // .vscode does not exist, skip silently.
  }

  const serversSource = path.join(gitRoot, "servers");
  const serversTarget = path.join(targetPath, "servers");

  try {
    await $`test -d ${serversSource}`.quiet();
  } catch {
    return;
  }

  const serverDirs = await $`ls -1 ${serversSource}`.text();
  for (const serverDir of serverDirs.trim().split("\n")) {
    if (!serverDir) continue;

    const sourceEnv = path.join(serversSource, serverDir, ".env");
    const targetEnv = path.join(serversTarget, serverDir, ".env");

    try {
      await $`test -f ${sourceEnv}`.quiet();
      await $`mkdir -p ${path.dirname(targetEnv)}`;
      await $`cp ${sourceEnv} ${targetEnv}`;
    } catch {
      // .env does not exist in this server dir, skip silently.
    }
  }
}

export function cleanupEmptyManagedWorktreeRoot(gitRoot: string, removedPath: string): void {
  const managedRoot = getManagedWorktreeRoot(gitRoot);
  const resolvedManagedRoot = path.resolve(managedRoot);
  const resolvedRemovedPath = path.resolve(removedPath);

  if (!resolvedRemovedPath.startsWith(`${resolvedManagedRoot}${path.sep}`)) {
    return;
  }

  try {
    if (readdirSync(managedRoot).length === 0) {
      rmSync(managedRoot, { recursive: true, force: true });
    }
  } catch {
    // Directory already missing or unreadable; nothing to do.
  }
}

export async function ensureDirectoryExists(targetPath: string): Promise<boolean> {
  try {
    await $`test -d ${targetPath}`.quiet();
    return true;
  } catch {
    return false;
  }
}
