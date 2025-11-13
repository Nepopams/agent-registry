import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import {
  ensureIndexes,
  insertIfNew,
  findByNameVersion,
  list,
  searchBySkill,
  AgentCard
} from "../src/db/agentsRepo";

let mongod: MongoMemoryServer;
let client: MongoClient;
const TEST_MONGO_VERSION = process.env.MONGOMS_VERSION ?? "5.0.15";

function baseCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    protocolVersion: "1.0.0",
    name: "Agent" + Math.random().toString(36).slice(2, 6),
    version: "1.0.0",
    skills: [],
    ...overrides
  };
}

describe("agentsRepo list & search", () => {
beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    binary: { version: TEST_MONGO_VERSION }
  });
  client = new MongoClient(mongod.getUri());
  await client.connect();
}, 180_000);

afterAll(async () => {
  if (client) {
    await client.close();
  }
  if (mongod) {
    await mongod.stop();
  }
}, 30_000);

  beforeEach(async () => {
    const db = client.db("testdb");
    await db.dropDatabase();
    await ensureIndexes(db);
  });

  it("enforces uniqueness for name@version and keeps stored card immutable", async () => {
    const db = client.db("testdb");
    const card = baseCard({ name: "SalesBot", version: "2.0.0" });
    await insertIfNew(db, card, "team@sales");

    await expect(
      insertIfNew(
        db,
        { ...card, description: "mutated" } as AgentCard,
        "team@sales"
      )
    ).rejects.toMatchObject({ statusCode: 409, code: "CARD_IMMUTABLE_CONFLICT" });

    const stored = await findByNameVersion(db, "SalesBot", "2.0.0");
    expect(stored?.card.description).toBeUndefined();
  });

  it("lists agents with pagination", async () => {
    const db = client.db("testdb");
    const names = ["Alpha", "Beta", "Gamma"];
    for (const name of names) {
      await insertIfNew(
        db,
        baseCard({ name, version: "1.0.0" }),
        `${name.toLowerCase()}@example.com`
      );
    }

    const results = await list(db, { limit: 2, offset: 1 });
    expect(results).toHaveLength(2);
    expect(results[0].card.name <= results[1].card.name).toBe(true);
  });

  it("searches agents by skill id", async () => {
    const db = client.db("testdb");
    await insertIfNew(
      db,
      baseCard({ name: "Router", skills: [{ id: "skill.router" }] }),
      "router@ops"
    );
    await insertIfNew(
      db,
      baseCard({ name: "Indexer", skills: [{ id: "skill.index" }] }),
      "index@ops"
    );
    await insertIfNew(
      db,
      baseCard({ name: "RouterPro", skills: [{ id: "skill.router" }, { id: "skill.extra" }] }),
      "router@ops"
    );

    const hits = await searchBySkill(db, "skill.router");
    expect(hits.map((doc) => doc.card.name).sort()).toEqual(["Router", "RouterPro"]);
  });
});
