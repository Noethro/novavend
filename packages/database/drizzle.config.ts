import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './drizzle',
  schema: './src/schema.ts',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://novavend:novavend@localhost:5432/novavend',
  },
});
