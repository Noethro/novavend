export const isPostgresErrorCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === code;

export const requireRow = <T>(row: T | undefined, operation: string): T => {
  if (!row) throw new Error(`Database returned no row for ${operation}`);
  return row;
};
