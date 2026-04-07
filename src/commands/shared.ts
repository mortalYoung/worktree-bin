export function exitNotGitRepository(): never {
  console.error("Error: not a git repository");
  process.exit(1);
}
