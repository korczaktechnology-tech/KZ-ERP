import { randomUUID } from 'node:crypto';
import type { Db, Document } from 'mongodb';
import type { ScmOutboxEvent } from './types.js';

const MAX_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2_000;
const BASE_BACKOFF_MS = 1_000;

type PublishedIntegrationEvent = {
  _id: string;
  sourceEventId: string;
  companyId: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  publishedAt: Date;
  createdAt: Date;
};

/**
 * Durable internal publication target for the modular-monolith boundary.
 * Consumers can later be replaced by a broker/Connect adapter without
 * changing the transactional outbox contract.
 */
async function publishInternal(db: Db, event: ScmOutboxEvent): Promise<void> {
  const collection = db.collection<PublishedIntegrationEvent>('integration_events');
  const now = new Date();
  try {
    await collection.insertOne({
      _id: randomUUID(),
      sourceEventId: event._id,
      companyId: event.companyId,
      type: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      publishedAt: now,
      createdAt: event.createdAt
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 11000) return;
    throw error;
  }
}

async function processOne(db: Db): Promise<boolean> {
  const now = new Date();
  const collection = db.collection<ScmOutboxEvent>('scm_outbox_events');
  const claimed = await collection.findOneAndUpdate(
    { status: 'pending', availableAt: { $lte: now } },
    { $set: { status: 'processing', updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { availableAt: 1, createdAt: 1 }, returnDocument: 'after' }
  );
  if (!claimed) return false;

  try {
    await publishInternal(db, claimed);
    await collection.updateOne(
      { _id: claimed._id, status: 'processing' },
      { $set: { status: 'published', updatedAt: new Date() } }
    );
  } catch (error) {
    const attempts = claimed.attempts;
    const terminal = attempts >= MAX_ATTEMPTS;
    const delay = BASE_BACKOFF_MS * 2 ** Math.min(attempts - 1, 6);
    await collection.updateOne(
      { _id: claimed._id, status: 'processing' },
      {
        $set: terminal
          ? { status: 'dead_letter', updatedAt: new Date() }
          : { status: 'pending', availableAt: new Date(Date.now() + delay), updatedAt: new Date() },
        $setOnInsert: { lastError: error instanceof Error ? error.message : String(error) }
      } as Document
    );
  }
  return true;
}

export async function ensureScmOutboxPublicationCollections(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  if (!existing.has('integration_events')) await db.createCollection('integration_events');
  const collection = db.collection('integration_events');
  await collection.createIndex({ sourceEventId: 1 }, { unique: true, name: 'integration_events_source_unique' });
  await collection.createIndex({ companyId: 1, createdAt: -1 }, { name: 'integration_events_company_created' });
  await collection.createIndex({ companyId: 1, type: 1, createdAt: -1 }, { name: 'integration_events_company_type_created' });
}

export function startScmOutboxWorker(db: Db): () => void {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      while (!stopped && await processOne(db)) {
        // Drain all currently available events before sleeping.
      }
    } catch (error) {
      console.error('SCM outbox worker error:', error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  timer.unref?.();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
