import type { Db } from 'mongodb';

export async function ensureLogisticsCollections(db: Db): Promise<void> {
  const definitions: Record<string, Array<{ key: Record<string, 1 | -1>; options?: Record<string, unknown> }>> = {
    logistics_shipments: [
      { key: { companyId: 1, number: 1 }, options: { unique: true, name: 'logistics_shipments_company_number_unique' } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'logistics_shipments_company_idempotency_unique' } },
      { key: { companyId: 1, status: 1, createdAt: -1 } },
      { key: { companyId: 1, trackingCode: 1 } },
      { key: { companyId: 1, salesOrderId: 1 } }
    ],
    logistics_events: [
      { key: { companyId: 1, shipmentId: 1, occurredAt: -1 } },
      { key: { companyId: 1, type: 1, occurredAt: -1 } }
    ],
    logistics_outbox_events: [
      { key: { status: 1, availableAt: 1 } },
      { key: { companyId: 1, createdAt: -1 } },
      { key: { aggregateId: 1, createdAt: -1 } }
    ],
    integration_events: [
      { key: { sourceEventId: 1 }, options: { unique: true, name: 'integration_events_source_unique' } }
    ]
  };
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  for (const [name, indexes] of Object.entries(definitions)) {
    if (!existing.has(name)) await db.createCollection(name);
    for (const index of indexes) await db.collection(name).createIndex(index.key, index.options as never);
  }
}
