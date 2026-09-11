import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { LogisticsOutboxEvent } from './types.js';

const MAX_ATTEMPTS = 8;
const LEASE_MS = 60_000;
const RETRY_BASE_MS = 2_000;

export async function ensureLogisticsOutboxCollections(db: Db): Promise<void> {
  await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').createIndex({ status: 1, availableAt: 1 });
  await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').createIndex({ companyId: 1, createdAt: -1 });
  await db.collection('integration_events').createIndex({ sourceEventId: 1 }, { unique: true, name: 'integration_events_source_unique' });
  const stale = new Date(Date.now() - LEASE_MS);
  await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').updateMany({ status: 'processing', processingStartedAt: { $lt: stale } }, { $set: { status: 'pending', availableAt: new Date(), updatedAt: new Date() }, $unset: { processingStartedAt: '' } });
}

async function processOne(db: Db): Promise<boolean> {
  const now = new Date();
  const claimed = await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').findOneAndUpdate(
    { status: 'pending', availableAt: { $lte: now } },
    { $set: { status: 'processing', processingStartedAt: now, updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { availableAt: 1, createdAt: 1 }, returnDocument: 'after' }
  );
  if (!claimed) return false;
  try {
    await db.collection('integration_events').updateOne(
      { sourceEventId: claimed._id },
      { $setOnInsert: { _id: randomUUID(), sourceEventId: claimed._id, companyId: claimed.companyId, type: claimed.type, schemaVersion: claimed.schemaVersion, aggregateType: claimed.aggregateType, aggregateId: claimed.aggregateId, correlationId: claimed.correlationId, payload: claimed.payload, createdAt: claimed.createdAt } },
      { upsert: true }
    );
    await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').updateOne({ _id: claimed._id, status: 'processing' }, { $set: { status: 'published', updatedAt: new Date() }, $unset: { processingStartedAt: '' } });
  } catch (error) {
    const attempts = claimed.attempts;
    const message = error instanceof Error ? error.message : 'Unknown outbox error';
    if (attempts >= MAX_ATTEMPTS) await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').updateOne({ _id: claimed._id, status: 'processing' }, { $set: { status: 'dead_letter', lastError: message, updatedAt: new Date() }, $unset: { processingStartedAt: '' } });
    else { const delay = RETRY_BASE_MS * 2 ** Math.min(attempts - 1, 6); await db.collection<LogisticsOutboxEvent>('logistics_outbox_events').updateOne({ _id: claimed._id, status: 'processing' }, { $set: { status: 'pending', lastError: message, availableAt: new Date(Date.now() + delay), updatedAt: new Date() }, $unset: { processingStartedAt: '' } }); }
  }
  return true;
}

export function startLogisticsOutboxWorker(db: Db): () => void {
  let stopped = false;
  const loop = async () => { while (!stopped) { const processed = await processOne(db).catch(() => false); if (!processed) await new Promise(resolve => setTimeout(resolve, 2_000)); } };
  void loop();
  return () => { stopped = true; };
}
