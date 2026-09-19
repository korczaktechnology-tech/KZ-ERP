import type { Db } from 'mongodb';

export async function ensureMasterDataCollections(db: Db): Promise<void> {
  const definitions: Record<string, Array<{ key: Record<string, 1 | -1>; options?: Record<string, unknown> }>> = {
    parties: [
      { key: { companyId: 1, code: 1 }, options: { unique: true, name: 'parties_company_code_unique' } },
      { key: { companyId: 1, active: 1, name: 1 } },
      { key: { companyId: 1, roles: 1 } }
    ]
    units: [
      { key: { companyId: 1, code: 1 }, options: { unique: true, name: 'units_company_code_unique' } },
      { key: { companyId: 1, active: 1 } }
    ],
    price_lists: [
      { key: { companyId: 1, code: 1 }, options: { unique: true, name: 'price_lists_company_code_unique' } },
      { key: { companyId: 1, active: 1 } }
    ],
    prices: [
      { key: { companyId: 1, priceListId: 1, productId: 1 }, options: { unique: true, name: 'prices_list_product_unique' } },
      { key: { companyId: 1, productId: 1, active: 1 } },
      { key: { companyId: 1, priceListId: 1, active: 1 } }
    ]
  };

  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  for (const [name, indexes] of Object.entries(definitions)) {
    if (!existing.has(name)) await db.createCollection(name);
    const collection = db.collection(name);
    for (const index of indexes) {
      try { await collection.createIndex(index.key, index.options); } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('already exists')) throw error;
      }
    }
  }
}
