import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { created, noContent, ok, paginated, parsePagination } from '../../core/api.js';
import { tenantCollection } from '../../core/db.js';
import type { Customer, Product, Supplier, Warehouse } from '../../core/models.js';
import { requireAuth } from '../../core/auth.js';

const productSchema = z.object({ sku: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), unit: z.string().trim().min(1).max(20), price: z.number().finite().min(0).max(1_000_000_000), active: z.boolean().default(true) });
const partySchema = z.object({ code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), document: z.string().trim().max(40).optional(), email: z.string().email().max(320).optional(), phone: z.string().trim().max(40).optional(), active: z.boolean().default(true) });
const warehouseSchema = z.object({ code: z.string().trim().min(1).max(80), name: z.string().trim().min(1).max(160), active: z.boolean().default(true) });

function tenant(req: Parameters<typeof requireAuth>[0], res: Parameters<typeof requireAuth>[1]): string { return (res.locals.user as { companyId: string }).companyId; }

export function masterDataRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  const products = tenantCollection<Product>(db, 'products');
  const customers = tenantCollection<Customer>(db, 'customers');
  const suppliers = tenantCollection<Supplier>(db, 'suppliers');
  const warehouses = tenantCollection<Warehouse>(db, 'warehouses');

  const list = async <T extends { companyId: string }>(res: Parameters<typeof ok>[0], collection: ReturnType<typeof tenantCollection<T>>, companyId: string, query: Parameters<typeof parsePagination>[0]) => {
    const p = parsePagination(query);
    const [items, total] = await Promise.all([collection.find(companyId).sort({ createdAt: -1 }).skip(p.offset).limit(p.limit).toArray(), collection.find(companyId).count()]);
    paginated(res, items, total, p);
  };

  router.get('/products', async (req, res, next) => { try { await list(res, products, tenant(req, res), req.query); } catch (e) { next(e); } });
  router.post('/products', async (req, res, next) => { try { const c = tenant(req, res); const input = productSchema.parse(req.body); const now = new Date(); const doc: Product = { _id: randomUUID(), companyId: c, ...input, createdAt: now, updatedAt: now }; await products.insertOne(c, doc); created(res, { id: doc._id, ...input }); } catch (e) { next(e); } });
  router.delete('/products/:id', async (req, res, next) => { try { const c = tenant(req, res); await products.updateOne(c, { _id: req.params.id }, { $set: { active: false, updatedAt: new Date() } }); noContent(res); } catch (e) { next(e); } });

  router.get('/customers', async (req, res, next) => { try { await list(res, customers, tenant(req, res), req.query); } catch (e) { next(e); } });
  router.post('/customers', async (req, res, next) => { try { const c = tenant(req, res); const input = partySchema.parse(req.body); const now = new Date(); const doc: Customer = { _id: randomUUID(), companyId: c, ...input, createdAt: now, updatedAt: now }; await customers.insertOne(c, doc); created(res, { id: doc._id, ...input }); } catch (e) { next(e); } });
  router.delete('/customers/:id', async (req, res, next) => { try { const c = tenant(req, res); await customers.updateOne(c, { _id: req.params.id }, { $set: { active: false, updatedAt: new Date() } }); noContent(res); } catch (e) { next(e); } });

  router.get('/suppliers', async (req, res, next) => { try { await list(res, suppliers, tenant(req, res), req.query); } catch (e) { next(e); } });
  router.post('/suppliers', async (req, res, next) => { try { const c = tenant(req, res); const input = partySchema.parse(req.body); const now = new Date(); const doc: Supplier = { _id: randomUUID(), companyId: c, ...input, createdAt: now, updatedAt: now }; await suppliers.insertOne(c, doc); created(res, { id: doc._id, ...input }); } catch (e) { next(e); } });
  router.delete('/suppliers/:id', async (req, res, next) => { try { const c = tenant(req, res); await suppliers.updateOne(c, { _id: req.params.id }, { $set: { active: false, updatedAt: new Date() } }); noContent(res); } catch (e) { next(e); } });

  router.get('/warehouses', async (req, res, next) => { try { await list(res, warehouses, tenant(req, res), req.query); } catch (e) { next(e); } });
  router.post('/warehouses', async (req, res, next) => { try { const c = tenant(req, res); const input = warehouseSchema.parse(req.body); const now = new Date(); const doc: Warehouse = { _id: randomUUID(), companyId: c, ...input, createdAt: now, updatedAt: now }; await warehouses.insertOne(c, doc); created(res, { id: doc._id, ...input }); } catch (e) { next(e); } });
  router.delete('/warehouses/:id', async (req, res, next) => { try { const c = tenant(req, res); await warehouses.updateOne(c, { _id: req.params.id }, { $set: { active: false, updatedAt: new Date() } }); noContent(res); } catch (e) { next(e); } });
  return router;
}
