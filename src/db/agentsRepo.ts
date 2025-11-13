import { Db, Collection, ObjectId, Filter, Document } from "mongodb";
import crypto from "node:crypto";

export type AgentStatus = "draft" | "published" | "deprecated";

export interface AgentSkill {
  id: string;
  [k: string]: unknown;
}

export interface AgentCard {
  protocolVersion: string;
  name: string;
  version: string;
  skills?: AgentSkill[];
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

export interface ListParams {
  limit?: number;
  offset?: number;
  owner?: string;
  status?: AgentStatus;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const COLLECTION_NAME = "agents";

export function collection(db: Db): Collection<StoredAgent> {
  return db.collection<StoredAgent>(COLLECTION_NAME);
}

function normalizeLimit(limit?: number) {
  if (!limit && limit !== 0) return DEFAULT_LIMIT;
  return Math.min(Math.max(limit, 1), MAX_LIMIT);
}

function normalizeOffset(offset?: number) {
  if (!offset) return 0;
  return Math.max(offset, 0);
}

function sortObjectKeys<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys) as unknown as T;
  if (obj && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .forEach((key) => {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
      });
    return sorted as unknown as T;
  }
  return obj;
}

function stableStringify(value: unknown) {
  return JSON.stringify(sortObjectKeys(value));
}

function fingerprintOf(card: AgentCard) {
  const payload = stableStringify(card);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function ensureIndexes(db: Db) {
  const col = collection(db);
  await col.createIndex(
    { "card.name": 1, "card.version": 1 },
    { unique: true, name: "uniq_name_version" }
  );
  await col.createIndex({ "card.skills.id": 1 }, { name: "idx_skill_id" });
}

export async function insertIfNew(db: Db, card: AgentCard, owner: string): Promise<StoredAgent> {
  const col = collection(db);
  const fingerprint = fingerprintOf(card);
  const now = new Date();
  try {
    const res = await col.insertOne({
      card,
      owner,
      publishedAt: now,
      status: "published",
      fingerprint
    });
    const inserted = await col.findOne({ _id: res.insertedId });
    if (!inserted) throw new Error("inserted document not found");
    return inserted;
  } catch (error: any) {
    if (error?.code === 11000) {
      const existing = await col.findOne({
        "card.name": card.name,
        "card.version": card.version
      });
      if (!existing) throw error;
      if (existing.fingerprint !== fingerprint) {
        const conflict: any = new Error(
          "AgentCard for name@version already exists with different content (immutable)"
        );
        conflict.statusCode = 409;
        conflict.code = "CARD_IMMUTABLE_CONFLICT";
        throw conflict;
      }
      return existing;
    }
    throw error;
  }
}

export async function findByName(db: Db, name: string, params: ListParams = {}) {
  const col = collection(db);
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);
  return col
    .find({ "card.name": name })
    .sort({ "card.version": -1 })
    .skip(offset)
    .limit(limit)
    .toArray();
}

export async function findByNameVersion(db: Db, name: string, version: string) {
  return collection(db).findOne({ "card.name": name, "card.version": version });
}

export async function list(db: Db, params: ListParams = {}) {
  const col = collection(db);
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);
  const filter: Filter<StoredAgent> = {};
  if (params.owner) {
    filter.owner = params.owner;
  }
  if (params.status) {
    filter.status = params.status;
  }

  return col
    .find(filter)
    .sort({ "card.name": 1, "card.version": -1 })
    .skip(offset)
    .limit(limit)
    .toArray();
}

export async function searchBySkill(db: Db, skillId: string, params: ListParams = {}) {
  const col = collection(db);
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);

  const filter: Filter<StoredAgent & Document> = {
    "card.skills.id": skillId
  };
  if (params.status) {
    filter.status = params.status;
  }
  if (params.owner) {
    filter.owner = params.owner;
  }

  return col
    .find(filter)
    .sort({ "card.name": 1 })
    .skip(offset)
    .limit(limit)
    .toArray();
}
