import { Db, Collection, ObjectId } from "mongodb";
import crypto from "node:crypto";

export type AgentStatus = "draft" | "published" | "deprecated";

export interface AgentCard {
  protocolVersion: string;
  name: string;
  version: string;
  [k: string]: unknown;
}

export interface StoredAgent {
  _id?: ObjectId;
  card: AgentCard;
  owner: string;
  publishedAt: Date;
  status: AgentStatus;
  fingerprint: string;
}

function sortObjectKeys<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys) as any;
  if (obj && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj as any).sort().forEach(k => {
      // @ts-ignore
      sorted[k] = sortObjectKeys((obj as any)[k]);
    });
    return sorted as any;
  }
  return obj;
}

function stableStringify(v: unknown) {
  return JSON.stringify(sortObjectKeys(v));
}
function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function collection(db: Db): Collection<StoredAgent> {
  return db.collection<StoredAgent>("agents");
}

export async function ensureIndexes(db: Db) {
  const col = collection(db);
  await col.createIndex(
    { "card.name": 1, "card.version": 1 },
    { unique: true, name: "uniq_name_version" }
  );
}

export async function insertIfNew(db: Db, card: AgentCard, owner: string): Promise<StoredAgent> {
  const col = collection(db);
  const fp = sha256(stableStringify(card));
  const now = new Date();
  try {
    const res = await col.insertOne({
      card,
      owner,
      publishedAt: now,
      status: "published",
      fingerprint: fp
    });
    const inserted = await col.findOne({ _id: res.insertedId });
    if (!inserted) throw new Error("inserted document not found");
    return inserted;
  } catch (e: any) {
    if (e?.code === 11000) {
      const existing = await col.findOne({
        "card.name": card.name,
        "card.version": card.version
      });
      if (!existing) throw e;
      if (existing.fingerprint !== fp) {
        const err: any = new Error("AgentCard for name@version already exists with different content (immutable)");
        err.statusCode = 409;
        err.code = "CARD_IMMUTABLE_CONFLICT";
        throw err;
      }
      return existing; // идемпотентно
    }
    throw e;
  }
}

export async function findByNameVersion(db: Db, name: string, version: string) {
  return collection(db).findOne({ "card.name": name, "card.version": version });
}
