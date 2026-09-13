import type { Db } from 'mongodb';
import { randomUUID } from 'node:crypto';
import type { ZodType } from 'zod';
import { F2_ENTITY_COLLECTIONS, f2EntityCollection, validLocationParentKind } from './f2-hardening.js';

export type F2ImportResult = {
  inserted: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
};

type ImportRecord = Record<string, unknown> & { id?: string };
type ImportOptions = {
  db: Db;
  companyId: string;
  entity: string;
  records: unknown[];
  schema: ZodType;
  collection: any;
};

const REF_FIELDS: Record<string, Array<[string, string, string]>> = {
  addresses: [['partyId', 'party', 'Party']],
  contacts: [['partyId', 'party', 'Party']],
  prices: [['priceListId', 'price_list', 'Price list'], ['productId', 'product', 'Product']],
};

function asId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function batchId(record: ImportRecord): string {
  return asId(record.id) ?? randomUUID();
}

async function existingIds(db: Db, companyId: string, type: string): Promise<Set<string>> {
  const collection = f2EntityCollection(db, type);
  if (!collection) return new Set();
  const rows = await collection.find({ companyId }, { projection: { _id: 1 } }).toArray();
  return new Set(rows.map((row: { _id: unknown }) => String(row._id)));
}

function detectParentCycle(parentById: Map<string, string | undefined>, id: string): boolean {
  const seen = new Set<string>([id]);
  let current = parentById.get(id);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = parentById.get(current);
  }
  return false;
}

function logicalType(entity: string): string {
  if (entity === 'categories') return 'category';
  if (entity === 'locations') return 'location';
  return entity === 'classifications' ? 'classification' : entity;
}

async function referenceExists(
  db: Db,
  companyId: string,
  type: string,
  id: string,
  batchIds: Set<string>,
  sameEntity: boolean,
): Promise<boolean> {
  if (sameEntity && batchIds.has(id)) return true;
  const collection = f2EntityCollection(db, type);
  return Boolean(collection && await collection.findOne({ _id: id, companyId }, { projection: { _id: 1 } }));
}

async function validateRecord(
  db: Db,
  companyId: string,
  entity: string,
  record: ImportRecord,
  batchIds: Set<string>,
  parentById: Map<string, string | undefined>,
  kindById: Map<string, string>,
  warehouseById: Map<string, string>,
): Promise<string | null> {
  for (const [field, type, label] of REF_FIELDS[entity] ?? []) {
    const refId = asId(record[field]);
    if (!refId) return `${label} id is required`;
    if (!(await referenceExists(db, companyId, type, refId, batchIds, type === logicalType(entity)))) {
      return `${label} '${type}:${refId}' not found`;
    }
  }

  if (entity === 'locations') {
    const warehouseId = asId(record.warehouseId);
    if (!warehouseId) return 'Warehouse id is required';
    if (!(await referenceExists(db, companyId, 'warehouse', warehouseId, batchIds, false))) {
      return `Warehouse '${warehouseId}' not found`;
    }
  }

  if (entity === 'categories' || entity === 'classifications' || entity === 'locations') {
    const parentId = asId(record.parentId);
    if (!parentId) return null;
    const parentType = logicalType(entity);
    if (!(await referenceExists(db, companyId, parentType, parentId, batchIds, true))) {
      return entity === 'locations' ? 'Location parent not found' : 'Parent not found';
    }
    if (detectParentCycle(parentById, String(record.id))) return 'Hierarchy cycle detected';

    if (entity === 'locations') {
      const childKind = String(record.kind ?? '');
      const childWarehouse = asId(record.warehouseId);
      const parentKind = kindById.get(parentId) ?? String((await db.collection(F2_ENTITY_COLLECTIONS.location).findOne({ _id: parentId, companyId }, { projection: { kind: 1 } }))?.kind ?? '');
      const parentWarehouse = warehouseById.get(parentId) ?? String((await db.collection(F2_ENTITY_COLLECTIONS.location).findOne({ _id: parentId, companyId }, { projection: { warehouseId: 1 } }))?.warehouseId ?? '');
      if (!childWarehouse || !validLocationParentKind(childKind, parentKind) || parentWarehouse !== childWarehouse) return 'Invalid location hierarchy';
    }
  }

  return null;
}

/** Deterministic, dependency-aware import for one F2 entity. */
export async function importF2Batch(options: ImportOptions): Promise<F2ImportResult> {
  const { db, companyId, entity, records, schema, collection } = options;
  const parsed: Array<{ index: number; id: string; value: ImportRecord }> = [];
  const errors: F2ImportResult['errors'] = [];
  const seenIds = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    try {
      const value = schema.parse(records[index]) as ImportRecord;
      const id = batchId(value);
      if (seenIds.has(id)) throw new Error(`Duplicate id '${id}' in import batch`);
      seenIds.add(id);
      parsed.push({ index, id, value: { ...value, id } });
    } catch (error) {
      errors.push({ index, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const type = logicalType(entity);
  const existing = await existingIds(db, companyId, type);
  for (const row of parsed) {
    if (existing.has(row.id)) errors.push({ index: row.index, error: `Entity '${row.id}' already exists` });
  }

  const batchIds = new Set(parsed.map((row) => row.id));
  const parentById = new Map<string, string | undefined>();
  const kindById = new Map<string, string>();
  const warehouseById = new Map<string, string>();
  for (const row of parsed) {
    parentById.set(row.id, asId(row.value.parentId));
    if (entity === 'locations') {
      kindById.set(row.id, String(row.value.kind ?? ''));
      warehouseById.set(row.id, asId(row.value.warehouseId) ?? '');
    }
  }

  const pending = parsed.filter((row) => !errors.some((error) => error.index === row.index));
  const insertedIds = new Set<string>();
  let progress = true;

  while (pending.length > 0 && progress) {
    progress = false;
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const row = pending[i];
      const parentId = asId(row.value.parentId);
      if (parentId && batchIds.has(parentId) && !insertedIds.has(parentId)) continue;
      const validation = await validateRecord(db, companyId, entity, row.value, batchIds, parentById, kindById, warehouseById);
      if (validation) {
        if (parentId && batchIds.has(parentId) && !insertedIds.has(parentId) && (validation === 'Parent not found' || validation === 'Location parent not found' || validation === 'Invalid location hierarchy')) continue;
        errors.push({ index: row.index, error: validation });
        pending.splice(i, 1);
        continue;
      }
      const now = new Date();
      const { id: _id, ...body } = row.value;
      await collection.insertOne(companyId, { _id: row.id, companyId, ...body, createdAt: now, updatedAt: now });
      insertedIds.add(row.id);
      pending.splice(i, 1);
      progress = true;
    }
  }

  for (const row of pending) errors.push({ index: row.index, error: 'Unresolvable dependency or hierarchy cycle' });
  errors.sort((a, b) => a.index - b.index);
  return { inserted: insertedIds.size, failed: records.length - insertedIds.size, errors };
}

export function assertF2ImportEntity(entity: string): void {
  const supported = new Set([...Object.keys(F2_ENTITY_COLLECTIONS), 'categories', 'brands', 'contacts', 'locations', 'classifications', 'attachments', 'relationships']);
  if (!supported.has(entity)) throw new Error(`Unsupported master-data entity '${entity}'`);
}
