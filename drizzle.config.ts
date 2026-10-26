import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/data/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
})
