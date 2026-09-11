import type { Db } from 'mongodb';

export async function ensureScmCollections(db: Db): Promise<void> {
  const definitions: Record<string, Array<{ key: Record<string, 1 | -1>; options?: Record<string, unknown> }>> = {
    scm_purchase_requests: [
      { key: { companyId: 1, number: 1 }, options: { unique: true, name: 'scm_purchase_requests_company_number_unique' } },
      { key: { companyId: 1, status: 1, createdAt: -1 } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'scm_purchase_requests_idempotency_unique' } }
    ],
    scm_purchase_quotes: [
      { key: { companyId: 1, number: 1 }, options: { unique: true, name: 'scm_purchase_quotes_company_number_unique' } },
      { key: { companyId: 1, requestId: 1, supplierId: 1, createdAt: -1 } },
      { key: { companyId: 1, status: 1, createdAt: -1 } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'scm_purchase_quotes_idempotency_unique' } }
    ],
    scm_purchase_orders: [
      { key: { companyId: 1, number: 1 }, options: { unique: true, name: 'scm_purchase_orders_company_number_unique' } },
      { key: { companyId: 1, supplierId: 1, status: 1, createdAt: -1 } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'scm_purchase_orders_idempotency_unique' } }
    ],
    scm_purchase_receipts: [
      { key: { companyId: 1, number: 1 }, options: { unique: true, name: 'scm_purchase_receipts_company_number_unique' } },
      { key: { companyId: 1, purchaseOrderId: 1, createdAt: -1 } },
      { key: { companyId: 1, warehouseId: 1, createdAt: -1 } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'scm_purchase_receipts_idempotency_unique' } }
    ],
    scm_outbox_events: [
      { key: { companyId: 1, status: 1, availableAt: 1 } },
      { key: { companyId: 1, aggregateType: 1, aggregateId: 1, createdAt: -1 } }
    ]
  };
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  for (const [name, indexes] of Object.entries(definitions)) {
    if (!existing.has(name)) await db.createCollection(name);
    const collection = db.collection(name);
    for (const index of indexes) {
      try { await collection.createIndex(index.key, index.options); }
      catch (error) { const message = error instanceof Error ? error.message : String(error); if (!message.includes('already exists')) throw error; }
    }
  }
}
