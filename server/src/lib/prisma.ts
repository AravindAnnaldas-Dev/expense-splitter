import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter instead of reading a
// connection URL out of schema.prisma — see prisma.config.ts for the
// (separate) adapter Migrate/the CLI uses, which points at the same
// DATABASE_URL so app and CLI always agree on where the database is.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });

// A single shared PrismaClient instance. Creating a new client per request
// would exhaust the Postgres connection pool under load.
export const prisma = new PrismaClient({ adapter });
