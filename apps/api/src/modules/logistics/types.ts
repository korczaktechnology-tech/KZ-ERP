import type { Decimal128 } from 'mongodb';

export type LogisticsShipmentStatus = 'draft' | 'ready' | 'in_transit' | 'delivered' | 'cancelled';
export type LogisticsEventType = 'created' | 'ready' | 'dispatched' | 'delivered' | 'exception' | 'cancelled';

export type LogisticsShipmentLine = {
  productId: string;
  description: string;
  quantity: Decimal128;
};

export type LogisticsShipment = {
  _id: string;
  companyId: string;
  number: string;
  salesOrderId?: string;
  warehouseId: string;
  customerId?: string;
  carrier?: string;
  trackingCode?: string;
  status: LogisticsShipmentStatus;
  destination: {
    name: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
  };
  lines: LogisticsShipmentLine[];
  notes?: string;
  idempotencyKey?: string;
  operationHash?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LogisticsEvent = {
  _id: string;
  companyId: string;
  shipmentId: string;
  type: LogisticsEventType;
  description?: string;
  occurredAt: Date;
  actorUserId: string;
  createdAt: Date;
};

export type LogisticsOutboxEvent = {
  _id: string;
  companyId: string;
  type: string;
  schemaVersion: number;
  aggregateType: 'shipment';
  aggregateId: string;
  correlationId: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: 'pending' | 'processing' | 'published' | 'dead_letter';
  availableAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
  processingStartedAt?: Date;
};
