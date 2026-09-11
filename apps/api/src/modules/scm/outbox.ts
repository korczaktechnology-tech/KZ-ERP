import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { ScmOutboxEvent } from './types.js';

const MAX_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2_000;
const BASE_BACKOFF_MS = 1_000;
const PROCESSING_LEASE_MS = 60_000;

type PublishedIntegrationEvent = {
  _id: string;
  sourceEventId: string;
  companyId: string;
  type: string;
  schemaVersion: number;
  correlationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  publishedAt: Date;
  createdAt: Date;
};

async function publishInternal(db: Db, event: ScmOutboxEvent): Promise<void> {
  const collection = db.collection<PublishedIntegrationEvent>('integration_events');
  try {
    await collection.insertOne({
      _id: randomUUID(),
      sourceEventId: event._id,
      companyId: event.companyId,
      type: event.type,
      schemaVersion: event.schemaVersion ?? 1,
      correlationId: event.correlationId ?? event.aggregateId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      publishedAt: new Date(),
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
      { $set: { status: 'published', updatedAt: new Date() }, $unset: { lastError: '' } }
    );
  } catch (error) {
    const attempts = claimed.attempts;
    const terminal = attempts >= MAX_ATTEMPTS;
    const nextUpdate = terminal
      ? { status: 'dead_letter' as const, updatedAt: new Date() }
      : { status: 'pending' as const, availableAt: new Date(Date.now() + BASE_BACKOFF_MS * 2 ** Math.min(attempts - 1, 6)), updatedAt: new Date() };
    await collection.updateOne(
      { _id: claimed._id, status: 'processing' },
      { $set: { ...nextUpdate, lastError: error instanceof Error ? error.message : String(error) } }
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
  await collection.createIndex({ companyId: 1, correlationId: 1, createdAt: -1 }, { name: 'integration_events_company_correlation_created' });

  await db.collection<ScmOutboxEvent>('scm_outbox_events').updateMany(
    { status: 'processing', updatedAt: { $lt: new Date(Date.now() - PROCESSING_LEASE_MS) } },
    { $set: { status: 'pending', availableAt: new Date(), updatedAt: new Date(), lastError: 'Recovered stale processing lease' } }
  );
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