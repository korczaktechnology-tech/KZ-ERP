import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import { tenantCollection } from '../../core/db.js';
import { fail, ok } from '../../core/api.js';
import { importF2Batch } from './f2-import.js';

const id = z.string().uuid();
const base = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  active: z.boolean().default(true),
});
const withId = <T extends z.ZodRawShape>(shape: T) => z.object({ id: id.optional(), ...shape });
const schemas = {
  products: withId({ sku: z.string().min(1).max(80), name: z.string().min(1).max(160), description: z.string().max(2000).optional(), unit: z.string().min(1).max(20), price: z.union([z.string(), z.number().finite().min(0)]), active: z.boolean().default(true) }),
  parties: withId({ code: z.string().min(1).max(80), kind: z.enum(['person', 'company']), roles: z.array(z.string()).min(1).max(5), name: z.string().min(1).max(160), legalName: z.string().max(200).optional(), document: z.string().max(40).optional(), email: z.string().email().max(320).optional(), phone: z.string().max(40).optional(), active: z.boolean().default(true) }),
  addresses: withId({ partyId: id, code: z.string().min(1).max(80), type: z.string().min(1).max(40), postalCode: z.string().min(3).max(20), street: z.string().min(1).max(160), number: z.string().min(1).max(30), district: z.string().min(1).max(120), city: z.string().min(1).max(120), state: z.string().min(1).max(120), country: z.string().min(2).max(80).default('BR'), active: z.boolean().default(true) }),
  units: withId({ code: z.string().min(1).max(20), name: z.string().min(1).max(80), symbol: z.string().min(1).max(12), kind: z.string().min(1).max(30), decimalPlaces: z.number().int().min(0).max(6).default(0), active: z.boolean().default(true) }),
  price_lists: withId({ code: z.string().min(1).max(40), name: z.string().min(1).max(120), currency: z.string().regex(/^[A-Z]{3}$/), active: z.boolean().default(true) }),
  prices: withId({ priceListId: id, productId: id, amount: z.union([z.string(), z.number().finite().min(0)]), minQuantity: z.number().int().positive().default(1), active: z.boolean().default(true) }),
  warehouses: withId({ code: z.string().min(1).max(80), name: z.string().min(1).max(160), active: z.boolean().default(true) }),
  categories: withId({ ...base.shape, parentId: id.optional() }),
  brands: withId({ ...base.shape }),
  contacts: withId({ partyId: id, name: z.string().trim().min(1).max(160), role: z.string().trim().max(80).optional(), email: z.string().email().max(320).optional(), phone: z.string().trim().max(40).optional(), mobile: z.string().trim().max(40).optional(), active: z.boolean().default(true) }),
  locations: withId({ ...base.shape, warehouseId: id, parentId: id.optional(), kind: z.enum(['zone', 'aisle', 'rack', 'shelf', 'bin']), capacity: z.number().finite().nonnegative().max(1e12).optional() }),
  classifications: withId({ ...base.shape, type: z.string().trim().min(1).max(80), parentId: id.optional() }),
  attachments: withId({ entityType: z.string().trim().min(1).max(80), entityId: id, fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(160), size: z.number().int().nonnegative().max(50_000_000), storageKey: z.string().trim().min(1).max(500), checksum: z.string().trim().max(128).optional(), metadata: z.record(z.string(), z.unknown()).optional() }),
  relationships: withId({ sourceType: z.string().trim().min(1).max(80), sourceId: id, relation: z.string().trim().min(1).max(80), targetType: z.string().trim().min(1).max(80), targetId: id, metadata: z.record(z.string(), z.unknown()).optional() }),
};

type Actor = { id: string; companyId: string; role: Role };
type Doc = { _id: string; companyId: string; createdAt: Date; updatedAt: Date; [key: string]: unknown };
const physical: Record<string, string> = { products: 'products', parties: 'parties', addresses: 'addresses', units: 'units', price_lists: 'price_lists', prices: 'prices', warehouses: 'warehouses', categories: 'product_categories', brands: 'product_brands', contacts: 'party_contacts', locations: 'warehouse_locations', classifications: 'classifications', attachments: 'master_attachments', relationships: 'master_relationships' };
const names = Object.keys(physical);

export function f2ImportRouter(db: Db): Router {
  const r = Router();
  r.use(requireAuth);
  r.post('/bulk/import/:entity', async (req, res, next) => {
    try {
      const actor = res.locals.user as Actor;
      if (!hasPermission(actor.role, 'master-data:write')) return fail(res, 403, 'FORBIDDEN');
      const entity = String(req.params.entity);
      if (!names.includes(entity)) return fail(res, 404, 'NOT_FOUND', `Unsupported master-data entity '${entity}'`);
      if (!Array.isArray(req.body)) return fail(res, 400, 'VALIDATION_ERROR', 'Import body must be an array');
      if (req.body.length > 1000) return fail(res, 413, 'VALIDATION_ERROR', 'Maximum 1000 records per import');
      const result = await importF2Batch({ db, companyId: actor.companyId, entity, records: req.body, schema: schemas[entity as keyof typeof schemas], collection: tenantCollection<Doc>(db, physical[entity]) });
      await db.collection('audit_logs').insertOne({ _id: randomUUID(), companyId: actor.companyId, actorUserId: actor.id, action: `master-data.${entity}.bulk-import`, resource: entity, resourceId: randomUUID(), metadata: result, createdAt: new Date(), updatedAt: new Date() });
      ok(res, { entity, ...result });
    } catch (error) {
      next(error);
    }
  });
  return r;
}
