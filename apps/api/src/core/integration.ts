export const INTEGRATION_CONTRACT_VERSION = 1 as const;

export type IntegrationPhase = 'F0' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
export type IntegrationStatus = 'connected' | 'contract-ready' | 'boundary';

export type IntegrationFlow = {
  id: string;
  from: IntegrationPhase;
  to: IntegrationPhase;
  namespace: string;
  status: IntegrationStatus;
  contract: string;
  events?: string[];
};

/**
 * Canonical F0-F7 integration map. Modules exchange contracts/events instead
 * of importing each other's persistence implementation. This keeps MongoDB
 * tenant isolation and the outbox boundary intact while allowing later KOS
 * products (WMS/TMS/CRM) to subscribe to the same contracts.
 */
export const F0_F7_INTEGRATION_FLOWS: readonly IntegrationFlow[] = [
  { id: 'core-master-data', from: 'F1', to: 'F2', namespace: 'CORE', status: 'connected', contract: 'authenticated tenant -> master-data', events: ['master-data.*'] },
  { id: 'master-data-stock', from: 'F2', to: 'F3', namespace: 'WMS', status: 'connected', contract: 'product/warehouse references -> stock', events: ['stock.*'] },
  { id: 'master-data-sales', from: 'F2', to: 'F4', namespace: 'CRM', status: 'connected', contract: 'customer/product references -> sales', events: ['sales.*'] },
  { id: 'sales-scm', from: 'F4', to: 'F5', namespace: 'SCM', status: 'contract-ready', contract: 'sales demand -> supply planning', events: ['sales.order.*'] },
  { id: 'sales-finance', from: 'F4', to: 'F6', namespace: 'FINANCE', status: 'contract-ready', contract: 'sales receivable -> finance ledger', events: ['sales.order.*', 'finance.entry.*'] },
  { id: 'stock-finance', from: 'F3', to: 'F6', namespace: 'FINANCE', status: 'contract-ready', contract: 'inventory valuation movement -> finance', events: ['stock.movement.*'] },
  { id: 'scm-stock', from: 'F5', to: 'F3', namespace: 'WMS', status: 'connected', contract: 'supply receipt -> stock movement', events: ['scm.receipt.*'] },
  { id: 'sales-logistics', from: 'F4', to: 'F7', namespace: 'TMS', status: 'connected', contract: 'sales order -> shipment tracking', events: ['logistics.shipment.*'] },
  { id: 'stock-logistics', from: 'F3', to: 'F7', namespace: 'TMS', status: 'contract-ready', contract: 'available inventory -> fulfillment', events: ['stock.movement.*', 'logistics.shipment.*'] },
  { id: 'finance-logistics', from: 'F6', to: 'F7', namespace: 'TMS', status: 'contract-ready', contract: 'financial clearance -> shipment release', events: ['finance.entry.*', 'logistics.shipment.*'] }
];

export const F0_F7_PHASE_STATUS = {
  F0: 'connected',
  F1: 'connected',
  F2: 'connected',
  F3: 'connected',
  F4: 'connected',
  F5: 'connected',
  F6: 'connected',
  F7: 'connected'
} as const;
