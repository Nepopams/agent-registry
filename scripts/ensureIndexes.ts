import { getDb, closeDb } from "../src/db/mongo";
import { ensureIndexes } from "../src/db/agentsRepo";

const run = async () => {
  const db = await getDb();
  await ensureIndexes(db);
  await closeDb();
};
run().catch(e => { console.error(e); process.exit(1); });
