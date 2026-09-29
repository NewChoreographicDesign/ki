import { existsSync } from "fs";
import { defineConfig } from "prisma/config";

// Replaces the deprecated package.json#prisma block (removed in Prisma 7 —
// see https://pris.ly/prisma-config). Only carries over what that block
// configured (the seed command).
//
// Unlike the classic package.json config, the mere presence of a
// prisma.config.ts file turns OFF Prisma's own automatic .env loading (see
// the "skipping environment variable loading" line prisma db push/generate
// now print) — schema.prisma's `url = env("DATABASE_URL")` would otherwise
// fail with "Environment variable not found" for any local command (db
// push, seed, ...) that depends on .env rather than a real shell/platform
// env var. Loading it back here restores exactly that. .env is gitignored
// (local-only) and Vercel injects DATABASE_URL as a real env var instead of
// a file, so this is guarded to only run when a .env file actually exists —
// process.loadEnvFile() throws ENOENT otherwise, which would break every
// production build.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
