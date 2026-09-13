import assert from 'node:assert/strict';
import { MongoClient, GridFSBucket } from 'mongodb';
import { ensureF2Collections } from '../src/modules/master-data/f2.ts';
import { localizeDatabase } from '../src/core/collection-names.ts';
import { importF2Batch } from '../src/modules/master-data/f2-import.ts';
import { scanF2Integrity } from '../src/modules/master-data/f2-integrity.ts';
import { z } from 'zod';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kz_erp_f2_smoke';
const client = new MongoClient(uri);
await client.connect();
try {
  const raw = client.db();
  const db = localizeDatabase(raw);
  const companyId = 'f2-smoke-company';
  await ensureF2Collections(db);
  await Promise.all(Object.values({ categories: 'categorias_produtos', locations: 'localizacoes_armazens', units: 'unidades_medida', products: 'produtos', priceLists: 'listas_precos', prices: 'precos', attachments: 'anexos_cadastros' }).map((name) => raw.collection(name).deleteMany({ companyId })));

  const categories = raw.collection('categorias_produtos');
  await categories.insertOne({ _id: 'existing-category', companyId, code: 'F2EXIST', name: 'Existing', active: true, createdAt: new Date(), updatedAt: new Date() });
  const indexes = await categories.listIndexes().toArray();
  assert.ok(indexes.some((index) => index.name === 'product_categories_company_code_unique' && index.unique === true), 'F2 category unique index missing');
  await assert.rejects(() => categories.insertOne({ _id: 'duplicate-category', companyId, code: 'F2EXIST', name: 'Duplicate', active: true, createdAt: new Date(), updatedAt: new Date() }));

  const categorySchema = z.object({ id: z.string().uuid().optional(), code: z.string(), name: z.string(), parentId: z.string().uuid().optional(), active: z.boolean().default(true) });
  const childId = '11111111-1111-4111-8111-111111111111';
  const parentId = '22222222-2222-4222-8222-222222222222';
  const imported = await importF2Batch({ db, companyId, entity: 'categories', records: [{ id: childId, code: 'CHILD', name: 'Child', parentId }, { id: parentId, code: 'PARENT', name: 'Parent' }], schema: categorySchema, collection: db.collection('categorias_produtos') });
  assert.deepEqual({ inserted: imported.inserted, failed: imported.failed }, { inserted: 2, failed: 0 }, 'dependency-aware category import failed');
  assert.equal((await categories.findOne({ _id: childId, companyId }))?.parentId, parentId);

  const locations = raw.collection('localizacoes_armazens');
  await locations.insertMany([
    { _id: 'zone', companyId, warehouseId: 'warehouse', kind: 'zone', code: 'Z', name: 'Zone', createdAt: new Date(), updatedAt: new Date() },
    { _id: 'aisle', companyId, warehouseId: 'warehouse', parentId: 'zone', kind: 'aisle', code: 'A', name: 'Aisle', createdAt: new Date(), updatedAt: new Date() },
  ]);
  assert.equal((await locations.findOne({ _id: 'aisle', companyId }))?.parentId, 'zone');

  const bucket = new GridFSBucket(raw, { bucketName: 'f2_attachments' });
  const attachmentId = '33333333-3333-4333-8333-333333333333';
  const data = Buffer.from('f2 smoke attachment');
  await new Promise((resolve, reject) => {
    const stream = bucket.openUploadStreamWithId(attachmentId, 'smoke.txt', { metadata: { companyId, entityType: 'category', entityId: parentId } });
    stream.on('finish', resolve); stream.on('error', reject); stream.end(data);
  });
  await raw.collection('anexos_cadastros').insertOne({ _id: attachmentId, companyId, entityType: 'category', entityId: parentId, fileName: 'smoke.txt', mimeType: 'text/plain', size: data.length, storageKey: `f2_attachments/${companyId}/${attachmentId}`, storageManaged: true, createdAt: new Date(), updatedAt: new Date() });

  const integrity = await scanF2Integrity(db, companyId);
  assert.equal(integrity.healthy, true, `unexpected integrity issues: ${JSON.stringify(integrity.issues)}`);

  await categories.deleteMany({ companyId });
  await locations.deleteMany({ companyId });
  await raw.collection('anexos_cadastros').deleteMany({ companyId });
  await bucket.delete(attachmentId).catch(() => undefined);
  console.log('F2 Mongo smoke: PASS');
} finally {
  await client.close();
}
