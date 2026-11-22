import "server-only";
import { openDatabase, type DB } from "./connection";
import * as schema from "./schema";

// Re-use one connection across hot reloads in development.
const g = globalThis as unknown as { __openSchoolsDb?: DB };
export const db: DB = g.__openSchoolsDb ?? (g.__openSchoolsDb = openDatabase());
export type { DB };
export { schema };
