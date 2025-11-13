import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { ensureIndexes, insertIfNew, findByNameVersion, AgentCard } from "../src/db/agentsRepo";

let mongod: MongoMemoryServer;
let client: MongoClient;

function baseCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    protocolVersion: "0.3.0",
    name: "YouTrackPlanning",
    version: "1.0.0",
    ...overrides
  };
}

describe("agentsRepo storage & immutability", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    client = new MongoClient(mongod.getUri());
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    const db = client.db("testdb");
    await db.dropDatabase();
    await ensureIndexes(db);
  });

  it("inserts new card and reads by name@version", async () => {
    const db = client.db("testdb");
    const inserted = await insertIfNew(db, baseCard(), "owner@acme");
    expect(inserted.card.name).toBe("YouTrackPlanning");
    const got = await findByNameVersion(db, "YouTrackPlanning", "1.0.0");
    expect(got?.card.version).toBe("1.0.0");
  });

  it("is idempotent for identical content", async () => {
    const db = client.db("testdb");
    const a = await insertIfNew(db, baseCard(), "owner@acme");
    const b = await insertIfNew(db, baseCard(), "owner@acme");
    expect(a._id?.toString()).toBe(b._id?.toString());
  });

  it("throws 409 if same name@version but different content", async () => {
    const db = client.db("testdb");
    await insertIfNew(db, baseCard({ description: "v1" } as any), "owner@acme");
    await expect(insertIfNew(db, baseCard({ description: "v2" } as any), "owner@acme"))
      .rejects.toMatchObject({ statusCode: 409, code: "CARD_IMMUTABLE_CONFLICT" });
  });
});
