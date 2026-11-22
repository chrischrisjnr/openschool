/**
 * Creates the demo school. Run with `npm run db:seed` (or `npm run db:reset`
 * to start again from scratch).
 */
import fs from "node:fs";
import { openDatabase, databasePath } from "../src/db/connection";
import { schools } from "../src/db/schema";
import { seedAssemble } from "./seed/assemble";
import { seedCore } from "./seed/core";
import { seedFete } from "./seed/fete";
import { seedQuad } from "./seed/quad";

async function main() {
  if (process.argv.includes("--reset")) {
    const file = databasePath();
    for (const f of [file, `${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
    console.log(`Removed ${file}`);
  }
  const db = openDatabase();
  if (db.select().from(schools).get()) {
    console.log(`Database already has data (${databasePath()}). Run "npm run db:reset" to start fresh.`);
    return;
  }
  const ctx = await seedCore(db);
  await seedAssemble(db, ctx);
  await seedQuad(db, ctx);
  await seedFete(db, ctx);
  console.log(`✔ Seeded ${ctx.school.name}: ${ctx.students.length} students, ${ctx.parents.length} parents, ${ctx.staff.length} staff.`);
  console.log(`  Sign in at http://localhost:3000 — try parent@demo.openschools.au / openschools`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
