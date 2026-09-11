import type { Db } from 'mongodb';

export async function ensureStockCollections(db: Db): Promise<void> {
  const definitions: Record<string, Array<{ key: Record<string, 1 | -1>; options?: Record<string, unknown> }>> = {
    stock_balances: [
      { key: { companyId: 1, warehouseId: 1, productId: 1 }, options: { unique: true, name: 'stock_company_warehouse_product_unique' } },
      { key: { companyId: 1, productId: 1 } }
    ],
    stock_movements: [
      { key: { companyId: 1, createdAt: -1 } },
      { key: { companyId: 1, warehouseId: 1, productId: 1, createdAt: -1 } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'stock_movement_idempotency_unique' } }
    ],
    stock_reservations: [
      { key: { companyId: 1, active: 1, createdAt: -1 } },
      { key: { companyId: 1, warehouseId: 1, productId: 1, active: 1 } },
      { key: { companyId: 1, idempotencyKey: 1 }, options: { unique: true, sparse: true, name: 'stock_reservation_idempotency_unique' } }
    ]
  };

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  for (const [name, indexes] of Object.entries(definitions)) {
    if (!existing.has(name)) await db.createCollection(name);
    const collection = db.collection(name);
    for (const index of indexes) {
      try {
        await collection.createIndex(index.key, index.options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('already exists')) throw error;
      }
    }
  }
}
