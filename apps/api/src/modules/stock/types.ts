import type { Decimal128 } from 'mongodb';

export type StockBalance = {
  _id?: string;
  companyId: string;
  warehouseId: string;
  productId: string;
  quantity: Decimal128;
  reservedQuantity: Decimal128;
  minimumQuantity: Decimal128;
  createdAt: Date;
  updatedAt: Date;
};

export type StockMovement = {
  _id?: string;
  companyId: string;
  type: 'receipt' | 'issue' | 'adjustment' | 'transfer';
  productId: string;
  warehouseId: string;
  destinationWarehouseId?: string;
  quantity: Decimal128;
  direction?: 'increase' | 'decrease';
  reason?: string;
  reference?: string;
  idempotencyKey?: string;
  operationHash?: string;
  actorUserId: string;
  createdAt: Date;
};

export type StockReservation = {
  _id?: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: Decimal128;
  reference?: string;
  idempotencyKey?: string;
  operationHash?: string;
  active: boolean;
  actorUserId: string;
  createdAt: Date;
  updatedAt: Date;
};
