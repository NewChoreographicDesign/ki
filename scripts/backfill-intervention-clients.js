#!/usr/bin/env node
// One-time data-preservation step for the Intervention.clientId ->
// InterventionClient (many-to-many) schema change — see schema.prisma's
// Intervention.clients comment for why Intervention moved off a single
// required clientId. This repo has no migration files (vercel-build runs
// `prisma db push --accept-data-loss` straight against production on
// every deploy — see package.json), so a column-dropping change like
// this one needs its own preservation step run BEFORE db push, not a
// migration.sql the way Multi-Woongroep does it.
//
// Reads the still-live clientId/groupInterventionId columns via raw SQL
// (the generated Prisma Client no longer exposes them, since `prisma
// generate` already ran against the new schema by the time this runs —
// see vercel-build), creates InterventionClient if it doesn't exist yet,
// and backfills it: one join row per client, with any rows that still
// share a pre-existing groupInterventionId (the brief per-client-row
// design this replaces) collapsed onto the first-created row, re-pointing
// their follow-up notes first. db push, which runs right after this
// script, then drops the old columns with nothing left depending on them.
//
// Idempotent and safe to leave in vercel-build permanently: once db push
// has dropped Intervention.clientId (the first time this runs
// successfully), the SELECT below fails with "column does not exist" and
// this becomes a no-op on every later deploy.
const { PrismaClient } = require("@prisma/client");

async function main() {
  const db = new PrismaClient();
  try {
    let rows;
    try {
      rows = await db.$queryRaw`SELECT "id", "clientId", "groupInterventionId" FROM "Intervention" WHERE "clientId" IS NOT NULL`;
    } catch (error) {
      console.log("backfill-intervention-clients: Intervention.clientId no longer exists, nothing to do");
      return;
    }
    if (rows.length === 0) {
      console.log("backfill-intervention-clients: no rows to backfill");
      return;
    }

    await db.$executeRaw`
      CREATE TABLE IF NOT EXISTS "InterventionClient" (
        "id" TEXT PRIMARY KEY,
        "interventionId" TEXT NOT NULL,
        "clientId" TEXT NOT NULL
      )
    `;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InterventionClient_interventionId_idx" ON "InterventionClient"("interventionId")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "InterventionClient_clientId_idx" ON "InterventionClient"("clientId")`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "InterventionClient_interventionId_clientId_key" ON "InterventionClient"("interventionId", "clientId")`;

    // Rows sharing a groupInterventionId (the per-client-row design being
    // replaced) collapse onto the first-created one; a standalone row
    // (groupInterventionId null) targets itself.
    const targetByGroup = new Map();
    for (const row of rows) {
      if (row.groupInterventionId && !targetByGroup.has(row.groupInterventionId)) {
        targetByGroup.set(row.groupInterventionId, row.id);
      }
    }

    for (const row of rows) {
      const targetId = row.groupInterventionId ? targetByGroup.get(row.groupInterventionId) : row.id;
      const joinId = `ivc_${row.id}`;
      await db.$executeRaw`
        INSERT INTO "InterventionClient" ("id", "interventionId", "clientId")
        VALUES (${joinId}, ${targetId}, ${row.clientId})
        ON CONFLICT ("interventionId", "clientId") DO NOTHING
      `;
      if (row.id !== targetId) {
        await db.$executeRaw`UPDATE "InterventionNote" SET "interventionId" = ${targetId} WHERE "interventionId" = ${row.id}`;
        await db.$executeRaw`DELETE FROM "Intervention" WHERE "id" = ${row.id}`;
      }
    }

    console.log(`backfill-intervention-clients: backfilled ${rows.length} row(s)`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("backfill-intervention-clients failed:", error);
  process.exit(1);
});
