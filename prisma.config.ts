const prismaConfig = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "file:/app/data/prod.db",
  },
  migrations: {
    seed: 'tsx ./prisma/seed.ts',
  },
};

export default prismaConfig;
