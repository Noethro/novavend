import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export const createDatabase = (databaseUrl: string) => {
  const client = postgres(databaseUrl, { max: 10 });
  return {
    client,
    database: drizzle(client),
  };
};
