import { randomUUID } from 'node:crypto';
import { Decimal128, MongoServerError } from 'mongodb';
import type { Db, Filter } from 'mongodb';
import { Router } from 'express';
import { z } from 'zod';
import { created, fail, noContent, ok, paginated, parsePagination } from '../../core/api.js';
import { tenantCollection } from '../../core/db.js';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import type { Product, Warehouse } from '../../core/models.js';
import type { StockBalance, StockMovement, StockReservation } from './types.js';

const id = z.string().uuid();
const quantity = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, 'quantity must be a decimal string with up to 6 decimal places').refine(value => value !== '0', 'quantity must be greater than zero');
const positiveQuantity = quantity;
const movementSchema = z.object({
  type: z.enum(['receipt', 'issue', 'adjustment', 'transfer']),
  productId: id,
  warehouseId: id,
  destinationWarehouseId: id.optional(),
  quantity: positiveQuantity,
  direction: z.enum(['increase', 'decrease']).optional(),
  reason: z.string().trim().max(240).optional(),
  reference: z.string().trim().max(120).optional()
}).superRefine((value, context) => {
  if (value.type === 'adjustment' && !value.direction) context.addIssue({ code: 'custom', path: ['direction'], message: 'direction is required for adjustments' });
  if (value.type === 'transfer' && !value.destinationWarehouseId) context.addIssue({ code: 'custom', path: ['destinationWarehouseId'], message: 'destinationWarehouseId is required for transfers' });
  if (value.type !== 'transfer' && value.destinationWarehouseId) context.addIssue({ code: 'custom', path: ['destinationWarehouseId'], message: 'destinationWarehouseId is only valid for transfers' });
});
const reserveSchema = z.object({ productId: id, warehouseId: id, quantity: positiveQuantity, reference: z.string().trim().max(120).optional() });
const minimumSchema = z.object({ minimumQuantity: z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/) });

type AuditLogEntry = { _id: string; companyId: string; actorUserId: string; action: string; resource: string; resourceId: string; metadata?: Record<string, unknown>; createdAt: Date };
function actor(res: Parameters<typeof requireAuth>[1]): { id: string; companyId: string; role: Role } { return res.locals.user as { id: string; companyId: string; role: Role }; }
function canRead(res: Parameters<typeof requireAuth>[1]): boolean { return hasPermission(actor(res).role, 'stock:read'); }
function canWrite(res: Parameters<typeof requireAuth>[1]): boolean { return hasPermission(actor(res).role, 'stock:write'); }
function decimal(value: string): Decimal128 { return Decimal128.fromString(value); }
function scaled(value: string): bigint { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0')); }
function fromScaled(value: bigint): string { if (value <= 0n) return '0'; const whole = value / 1_000_000n; const fraction = (value % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, ''); return fraction ? `${whole}.${fraction}` : whole.toString(); }
function availableQuantity(quantityValue: Decimal128, reservedValue: Decimal128): string { return fromScaled(scaled(quantityValue.toString()) - scaled(reservedValue.toString())); }
function serializeBalance(balance: StockBalance) { return { ...balance, quantity: balance.quantity.toString(), reservedQuantity: balance.reservedQuantity.toString(), minimumQuantity: balance.minimumQuantity.toString(), availableQuantity: availableQuantity(balance.quantity, balance.reservedQuantity) }; }

export function stockRouter(db: Db): Router {
  const router = Router();
  router.use(requireAuth);
  const balances = tenantCollection<StockBalance>(db, 'stock_balances');
  const movements = tenantCollection<StockMovement>(db, 'stock_movements');
  const reservations = tenantCollection<StockReservation>(db, 'stock_reservations');
  const products = tenantCollection<Product>(db, 'products');
  const warehouses = tenantCollection<Warehouse>(db, 'warehouses');
  const audit = (companyId: string, actorUserId: string, action: string, resource: string, resourceId: string, metadata?: Record<string, unknown>) => db.collection<AuditLogEntry>('audit_logs').insertOne({ _id: randomUUID(), companyId, actorUserId, action, resource, resourceId, metadata, createdAt: new Date() });

  async function getProduct(companyId: string, productId: string) { return products.findOne(companyId, { _id: productId, active: true }); }
  async function getWarehouse(companyId: string, warehouseId: string) { return warehouses.findOne(companyId, { _id: warehouseId, active: true }); }
  async function ensureBalance(companyId: string, warehouseId: string, productId: string): Promise<StockBalance> {
    const current = await balances.findOne(companyId, { warehouseId, productId });
    if (current) return current;
    const now = new Date();
    const createdBalance: StockBalance = { _id: randomUUID(), companyId, warehouseId, productId, quantity: decimal('0'), reservedQuantity: decimal('0'), minimumQuantity: decimal('0'), createdAt: now, updatedAt: now };
    try { await balances.insertOne(companyId, createdBalance); return createdBalance; }
    catch (error) { if (error instanceof MongoServerError && error.code === 11000) { const retry = await balances.findOne(companyId, { warehouseId, productId }); if (retry) return retry; } throw error; }
  }
  async function updateBalance(companyId: string, warehouseId: string, productId: string, delta: Decimal128, requireAvailable = false) {
    await ensureBalance(companyId, warehouseId, productId);
    const filter: Filter<StockBalance> = { warehouseId, productId };
    if (delta.toString().startsWith('-')) {
      const amount = decimal(delta.toString().slice(1));
      filter.quantity = { $gte: amount };
      if (requireAvailable) filter.$expr = { $gte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, amount] };
    }
    const result = await balances.updateOne(companyId, filter, { $inc: { quantity: delta }, $set: { updatedAt: new Date() } });
    if (!result.matchedCount) return null;
    return balances.findOne(companyId, { warehouseId, productId });
  }

  router.get('/warehouses', async (req, res, next) => {
    try { if (!canRead(res)) { fail(res, 403, 'FORBIDDEN'); return; } const a = actor(res); const p = parsePagination(req.query); const [items, total] = await Promise.all([warehouses.find(a.companyId, { active: true }).sort({ code: 1 }).skip(p.offset).limit(p.limit).toArray(), warehouses.find(a.companyId, { active: true }).count()]); paginated(res, items, total, p); }
    catch (error) { next(error); }
  });

  router.get('/balances', async (req, res, next) => {
    try {
      if (!canRead(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const p = parsePagination(req.query); const filter: Filter<StockBalance> = {};
      if (typeof req.query.warehouseId === 'string') filter.warehouseId = id.parse(req.query.warehouseId);
      if (typeof req.query.productId === 'string') filter.productId = id.parse(req.query.productId);
      const [items, total] = await Promise.all([balances.find(a.companyId, filter).sort({ updatedAt: -1 }).skip(p.offset).limit(p.limit).toArray(), balances.find(a.companyId, filter).count()]);
      paginated(res, items.map(serializeBalance), total, p);
    } catch (error) { next(error); }
  });

  router.patch('/balances/:warehouseId/:productId/minimum', async (req, res, next) => {
    try {
      if (!canWrite(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const warehouseId = id.parse(req.params.warehouseId); const productId = id.parse(req.params.productId); const input = minimumSchema.parse(req.body);
      if (!(await getWarehouse(a.companyId, warehouseId))) { fail(res, 404, 'NOT_FOUND', 'Warehouse not found'); return; }
      if (!(await getProduct(a.companyId, productId))) { fail(res, 404, 'NOT_FOUND', 'Product not found'); return; }
      await ensureBalance(a.companyId, warehouseId, productId);
      await balances.updateOne(a.companyId, { warehouseId, productId }, { $set: { minimumQuantity: decimal(input.minimumQuantity), updatedAt: new Date() } });
      const balance = await balances.findOne(a.companyId, { warehouseId, productId });
      await audit(a.companyId, a.id, 'stock.balance.minimum.update', 'stock_balance', balance?._id ?? `${warehouseId}:${productId}`);
      ok(res, { balance: balance ? serializeBalance(balance) : null });
    } catch (error) { next(error); }
  });

  router.get('/movements', async (req, res, next) => {
    try {
      if (!canRead(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const p = parsePagination(req.query); const filter: Filter<StockMovement> = {};
      if (typeof req.query.productId === 'string') filter.productId = id.parse(req.query.productId);
      if (typeof req.query.warehouseId === 'string') filter.warehouseId = id.parse(req.query.warehouseId);
      if (typeof req.query.type === 'string') filter.type = z.enum(['receipt', 'issue', 'adjustment', 'transfer']).parse(req.query.type);
      const [items, total] = await Promise.all([movements.find(a.companyId, filter).sort({ createdAt: -1 }).skip(p.offset).limit(p.limit).toArray(), movements.find(a.companyId, filter).count()]);
      paginated(res, items.map(item => ({ ...item, quantity: item.quantity.toString() })), total, p);
    } catch (error) { next(error); }
  });

  router.post('/movements', async (req, res, next) => {
    try {
      if (!canWrite(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const input = movementSchema.parse(req.body); const amount = decimal(input.quantity);
      if (!(await getProduct(a.companyId, input.productId))) { fail(res, 404, 'NOT_FOUND', 'Product not found'); return; }
      if (!(await getWarehouse(a.companyId, input.warehouseId))) { fail(res, 404, 'NOT_FOUND', 'Warehouse not found'); return; }
      if (input.type === 'transfer') {
        const destinationId = input.destinationWarehouseId!; const destination = await getWarehouse(a.companyId, destinationId);
        if (!destination) { fail(res, 404, 'NOT_FOUND', 'Destination warehouse not found'); return; }
        if (destination._id === input.warehouseId) { fail(res, 400, 'VALIDATION_ERROR', 'Source and destination warehouses must differ'); return; }
        const sourceBalance = await updateBalance(a.companyId, input.warehouseId, input.productId, decimal(`-${input.quantity}`), true);
        if (!sourceBalance) { fail(res, 409, 'CONFLICT', 'Insufficient available stock'); return; }
        const destinationBalance = await updateBalance(a.companyId, destinationId, input.productId, amount);
        if (!destinationBalance) { await updateBalance(a.companyId, input.warehouseId, input.productId, amount); fail(res, 500, 'INTERNAL_ERROR', 'Transfer could not be completed safely'); return; }
        const movement: StockMovement = { _id: randomUUID(), companyId: a.companyId, type: 'transfer', productId: input.productId, warehouseId: input.warehouseId, destinationWarehouseId: destinationId, quantity: amount, reason: input.reason, reference: input.reference, actorUserId: a.id, createdAt: new Date() };
        try { await movements.insertOne(a.companyId, movement); await audit(a.companyId, a.id, 'stock.movement.transfer', 'stock_movement', movement._id!, { productId: input.productId, quantity: input.quantity, destinationWarehouseId: destinationId }); }
        catch (error) { await movements.deleteOne(a.companyId, { _id: movement._id }); await updateBalance(a.companyId, input.warehouseId, input.productId, amount); await updateBalance(a.companyId, destinationId, input.productId, decimal(`-${input.quantity}`)); throw error; }
        created(res, { movement: { ...movement, quantity: movement.quantity.toString() }, source: serializeBalance(sourceBalance), destination: serializeBalance(destinationBalance) }); return;
      }
      const decreasing = input.type === 'issue' || (input.type === 'adjustment' && input.direction === 'decrease');
      const delta = decreasing ? decimal(`-${input.quantity}`) : amount;
      const balance = await updateBalance(a.companyId, input.warehouseId, input.productId, delta, decreasing);
      if (!balance) { fail(res, 409, 'CONFLICT', 'Insufficient available stock'); return; }
      const movement: StockMovement = { _id: randomUUID(), companyId: a.companyId, type: input.type, productId: input.productId, warehouseId: input.warehouseId, quantity: amount, direction: input.direction, reason: input.reason, reference: input.reference, actorUserId: a.id, createdAt: new Date() };
      try { await movements.insertOne(a.companyId, movement); await audit(a.companyId, a.id, `stock.movement.${input.type}`, 'stock_movement', movement._id!, { productId: input.productId, quantity: input.quantity, direction: input.direction }); }
      catch (error) { await movements.deleteOne(a.companyId, { _id: movement._id }); await updateBalance(a.companyId, input.warehouseId, input.productId, decreasing ? amount : decimal(`-${input.quantity}`)); throw error; }
      created(res, { movement: { ...movement, quantity: movement.quantity.toString() }, balance: serializeBalance(balance) });
    } catch (error) { next(error); }
  });

  router.get('/reservations', async (req, res, next) => {
    try {
      if (!canRead(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const p = parsePagination(req.query); const filter: Filter<StockReservation> = { active: true };
      if (typeof req.query.productId === 'string') filter.productId = id.parse(req.query.productId);
      if (typeof req.query.warehouseId === 'string') filter.warehouseId = id.parse(req.query.warehouseId);
      const [items, total] = await Promise.all([reservations.find(a.companyId, filter).sort({ createdAt: -1 }).skip(p.offset).limit(p.limit).toArray(), reservations.find(a.companyId, filter).count()]);
      paginated(res, items.map(item => ({ ...item, quantity: item.quantity.toString() })), total, p);
    } catch (error) { next(error); }
  });

  router.post('/reservations', async (req, res, next) => {
    try {
      if (!canWrite(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const input = reserveSchema.parse(req.body); const amount = decimal(input.quantity);
      if (!(await getProduct(a.companyId, input.productId))) { fail(res, 404, 'NOT_FOUND', 'Product not found'); return; }
      if (!(await getWarehouse(a.companyId, input.warehouseId))) { fail(res, 404, 'NOT_FOUND', 'Warehouse not found'); return; }
      await ensureBalance(a.companyId, input.warehouseId, input.productId);
      const result = await balances.updateOne(a.companyId, { warehouseId: input.warehouseId, productId: input.productId, $expr: { $gte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, amount] } }, { $inc: { reservedQuantity: amount }, $set: { updatedAt: new Date() } });
      if (!result.matchedCount) { fail(res, 409, 'CONFLICT', 'Insufficient available stock'); return; }
      const reservation: StockReservation = { _id: randomUUID(), companyId: a.companyId, productId: input.productId, warehouseId: input.warehouseId, quantity: amount, reference: input.reference, active: true, actorUserId: a.id, createdAt: new Date(), updatedAt: new Date() };
      try { await reservations.insertOne(a.companyId, reservation); await audit(a.companyId, a.id, 'stock.reservation.create', 'stock_reservation', reservation._id!, { productId: input.productId, quantity: input.quantity }); }
      catch (error) { await reservations.deleteOne(a.companyId, { _id: reservation._id }); await balances.updateOne(a.companyId, { warehouseId: input.warehouseId, productId: input.productId, reservedQuantity: { $gte: amount } }, { $inc: { reservedQuantity: decimal(`-${input.quantity}`) }, $set: { updatedAt: new Date() } }); throw error; }
      created(res, { reservation: { ...reservation, quantity: reservation.quantity.toString() } });
    } catch (error) { next(error); }
  });

  router.delete('/reservations/:id', async (req, res, next) => {
    try {
      if (!canWrite(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const reservationId = id.parse(req.params.id); const reservation = await reservations.findOne(a.companyId, { _id: reservationId, active: true });
      if (!reservation) { fail(res, 404, 'NOT_FOUND', 'Reservation not found'); return; }
      const result = await balances.updateOne(a.companyId, { warehouseId: reservation.warehouseId, productId: reservation.productId, reservedQuantity: { $gte: reservation.quantity } }, { $inc: { reservedQuantity: decimal(`-${reservation.quantity.toString()}`) }, $set: { updatedAt: new Date() } });
      if (!result.matchedCount) { fail(res, 409, 'CONFLICT', 'Reservation balance is inconsistent'); return; }
      try { await reservations.updateOne(a.companyId, { _id: reservationId, active: true }, { $set: { active: false, updatedAt: new Date() } }); await audit(a.companyId, a.id, 'stock.reservation.release', 'stock_reservation', reservationId); }
      catch (error) { await reservations.updateOne(a.companyId, { _id: reservationId }, { $set: { active: true, updatedAt: new Date() } }); await balances.updateOne(a.companyId, { warehouseId: reservation.warehouseId, productId: reservation.productId }, { $inc: { reservedQuantity: reservation.quantity }, $set: { updatedAt: new Date() } }); throw error; }
      noContent(res);
    } catch (error) { next(error); }
  });

  router.get('/summary', async (req, res, next) => {
    try {
      if (!canRead(res)) { fail(res, 403, 'FORBIDDEN'); return; }
      const a = actor(res); const warehouseId = typeof req.query.warehouseId === 'string' ? id.parse(req.query.warehouseId) : undefined; const filter: Filter<StockBalance> = warehouseId ? { warehouseId } : {};
      const rows = await balances.find(a.companyId, filter).toArray();
      const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity.toString()), 0); const totalReserved = rows.reduce((sum, row) => sum + Number(row.reservedQuantity.toString()), 0);
      const lowStock = rows.filter(row => Number(row.quantity.toString()) - Number(row.reservedQuantity.toString()) <= Number(row.minimumQuantity.toString())).length;
      ok(res, { warehouses: warehouseId ? 1 : await warehouses.find(a.companyId, { active: true }).count(), productsWithBalance: rows.length, totalQuantity, totalReserved, availableQuantity: totalQuantity - totalReserved, lowStock });
    } catch (error) { next(error); }
  });

  return router;
}
