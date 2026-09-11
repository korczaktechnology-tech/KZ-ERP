import type { Decimal128 } from 'mongodb';
import type { BaseDocument, Id } from '../../core/models.js';

export type PurchaseLine = { productId: Id; description: string; quantity: Decimal128 };
export type PurchaseRequest = BaseDocument & { number: string; status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled'; lines: PurchaseLine[]; notes?: string; idempotencyKey?: string; operationHash?: string };
export type PurchaseQuoteLine = PurchaseLine & { unitPrice: Decimal128; total: Decimal128 };
export type PurchaseQuote = BaseDocument & { number: string; requestId: Id; supplierId: Id; status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'cancelled'; lines: PurchaseQuoteLine[]; subtotal: Decimal128; idempotencyKey?: string; operationHash?: string };
export type PurchaseOrderLine = PurchaseQuoteLine;
export type PurchaseOrder = BaseDocument & { number: string; supplierId: Id; quoteId?: Id; status: 'draft' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled'; lines: PurchaseOrderLine[]; subtotal: Decimal128; receivedQuantities?: Record<Id, Decimal128>; idempotencyKey?: string; operationHash?: string };
export type PurchaseReceiptLine = { productId: Id; quantity: Decimal128 };
export type PurchaseReceipt = BaseDocument & { number: string; purchaseOrderId: Id; warehouseId: Id; lines: PurchaseReceiptLine[]; receivedAt: Date; idempotencyKey?: string; operationHash?: string; actorUserId: Id };
export type ScmOutboxEvent = {
  _id: Id;
  companyId: Id;
  type: string;
  schemaVersion: number;
  correlationId: Id;
  aggregateType: string;
  aggregateId: Id;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'published' | 'dead_letter';
  attempts: number;
  availableAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
};
