import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(
  uri = process.env.MONGO_URL ?? "mongodb://localhost:27017/agent-registry",
  dbName = process.env.MONGO_DB ?? "agent-registry"
) {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
