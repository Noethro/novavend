export const isPostgresErrorCode = (error: unknown, code: string): boolean => {
  let current = error;
  const visited = new Set<unknown>();
  while (
    typeof current === 'object' &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    if ('code' in current && current.code === code) return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
};

export const requireRow = <T>(row: T | undefined, operation: string): T => {
  if (!row) throw new Error(`Database returned no row for ${operation}`);
  return row;
};
