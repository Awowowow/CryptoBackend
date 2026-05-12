import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/auth/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});