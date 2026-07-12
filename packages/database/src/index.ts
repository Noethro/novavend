import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

export * from './domain';
export * from './schema';
export * from './repositories/audit';
export * from './repositories/avatars';
export * from './repositories/idempotency';
export * from './repositories/users';
export * from './repositories/workspaces';

export interface ConnectivityClient {
  end(options?: { timeout?: number }): Promise<void>;
  unsafe(query: string): Promise<unknown>;
}

export const createConnectivityManager = (client: ConnectivityClient) => ({
  checkConnectivity: async (): Promise<void> => {
    await client.unsafe('select 1');
  },
  close: async (): Promise<void> => {
    await client.end({ timeout: 5 });
  },
});

export const createDatabase = (databaseUrl: string) => {
  const client = postgres(databaseUrl, { max: 10 });
  const lifecycle = createConnectivityManager(client);
  return {
    client,
    database: drizzle(client, { schema }),
    ...lifecycle,
  };
};

export type NovaVendDatabase = ReturnType<typeof createDatabase>['database'];
