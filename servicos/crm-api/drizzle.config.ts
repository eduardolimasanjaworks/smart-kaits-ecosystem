// Configuração do Drizzle Kit para migrações PostgreSQL do CRM.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infra/banco/schema/indiceSchema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://crm:crm@127.0.0.1:5432/crm'
  }
});
