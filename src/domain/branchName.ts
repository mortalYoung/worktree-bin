export function buildGeneratedBranchName(prefix: string | undefined, codename: string): string {
  if (!prefix) {
    return codename;
  }

  return `${prefix}${codename}`;
}
