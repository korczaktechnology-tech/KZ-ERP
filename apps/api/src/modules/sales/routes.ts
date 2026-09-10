import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Db } from 'mongodb';
import { z } from 'zod';
import { created, ok, paginated, parsePagination } from '../../core/api.js';
import { tenantCollection } from '../../core/db.js';
import type { Customer, Product, SalesOrder } from '../../core/models.js';
import { requireAuth } from '../../core/auth.js';

const lineSchema = z.object({ productId: z.string().uuid(), quantity: z.number().finite().positive().max(1_000_000), unitPrice: z.number().finite().min(0).max(1_000_000_000) });
const orderSchema = z.object({ number: z.string().trim().min(1).max(80), customerId: z.string().uuid(), lines: z.array(lineSchema).min(1).max(500) });

export function salesRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  const orders = tenantCollection<SalesOrder>(db, 'sales_orders');
  const products = tenantCollection<Product>(db, 'products');
  const customers = tenantCollection<Customer>(db, 'customers');

  router.get('/orders', async (req, res, next) => {
    try {
      const companyId = (res.locals.user as { companyId: string }).companyId;
      const p = parsePagination(req.query);
      const [items, total] = await Promise.all([orders.find(companyId).sort({ createdAt: -1 }).skip(p.offset).limit(p.limit).toArray(), orders.find(companyId).count()]);
      paginated(res, items, total, p);
    } catch (e) { next(e); }
  });

  router.post('/orders', async (req, res, next) => {
    try {
      const companyId = (res.locals.user as { companyId: string }).companyId;
      const input = orderSchema.parse(req.body);
      const customer = await customers.findOne(companyId, { _id: input.customerId, active: true });
      if (!customer) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' }, requestId: res.locals.requestId }); return; }
      const ids = [...new Set(input.lines.map(line => line.productId))];
      const found = await products.find(companyId, { _id: { $in: ids }, active: true }).toArray();
      if (found.length !== ids.length) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'One or more products are invalid' }, requestId: res.locals.requestId }); return; }
      const lines = input.lines.map(line => ({ productId: line.productId, description: found.find(p => p._id === line.productId)?.name ?? '', quantity: line.quantity, unitPrice: line.unitPrice, total: line.quantity * line.unitPrice }));
      const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
      const now = new Date();
      const order: SalesOrder = { _id: randomUUID(), companyId, number: input.number, customerId: input.customerId, status: 'draft', lines, subtotal, total: subtotal, createdAt: now, updatedAt: now };
      await orders.insertOne(companyId, order);
      created(res, { id: order._id, number: order.number, status: order.status, customerId: order.customerId, lines: order.lines, subtotal, total: order.total });
    } catch (e) { next(e); }
  });
  return router;
}
