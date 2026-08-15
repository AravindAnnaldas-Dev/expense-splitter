import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 removed connection URLs from schema.prisma entirely — the CLI
// (migrate, studio, db push, etc.) now gets its connection from here, via
// the same driver adapter the app itself uses at runtime (see
// src/lib/prisma.ts). Keeping both on the same adapter means "how Migrate
// connects" and "how the app connects" can never drift apart.
export default defineConfig({
  schema: "prisma/schema.prisma",
  // `datasource.url` is what `migrate status`/`migrate deploy` read directly;
  // `migrations.adapter` is what actually executes migrations against the
  // database. Both point at the same DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    adapter: async () => new PrismaPg({ connectionString: process.env.DATABASE_URL as string }),
  },
});
