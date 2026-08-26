// Prisma's `datasource` provider has to be a literal string in the schema
// file — it can't read an env var the way the `url` field can. So a
// non-technical person deploying to Vercel with a real Postgres database
// would otherwise have to hand-edit prisma/schema.prisma before every
// deploy, which defeats the point of a no-terminal, no-code install.
//
// Instead, this script runs as the first step of `vercel-build` and rewrites
// the provider based on what DATABASE_URL actually looks like. It only
// touches the ephemeral build checkout, never the repository — nothing is
// committed back to git. Local development (DATABASE_URL="file:./dev.db")
// is unaffected and keeps using sqlite.
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "..", "prisma", "schema.prisma");
const databaseUrl = process.env.DATABASE_URL || "";
const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);
const desiredProvider = isPostgres ? "postgresql" : "sqlite";

const schema = fs.readFileSync(schemaPath, "utf8");
const updated = schema.replace(
  /(datasource\s+db\s*{[^}]*provider\s*=\s*")[a-z]+(")/,
  `$1${desiredProvider}$2`
);

if (updated !== schema) {
  fs.writeFileSync(schemaPath, updated);
  console.log(`prepare-datasource: provider set to "${desiredProvider}" (based on DATABASE_URL)`);
} else {
  console.log(`prepare-datasource: provider already "${desiredProvider}", nothing to change`);
}
