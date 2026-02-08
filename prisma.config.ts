import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "file:/app/data/dev.db",
  },
  migrations: {
    seed: 'ts-node ./prisma/seed.ts',
  },
});
