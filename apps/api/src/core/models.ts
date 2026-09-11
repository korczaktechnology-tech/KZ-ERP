import type { Document, Decimal128 } from 'mongodb';

export type Id = string;
export type BaseDocument = { _id: Id; companyId: Id; createdAt: Date; updatedAt: Date };
export type Product = BaseDocument & { sku: string; name: string; description?: string; active: boolean; unit: string; price: Decimal128 };
export type Customer = BaseDocument & { code: string; name: string; document?: string; email?: string; phone?: string; active: boolean };
export type Supplier = BaseDocument & { code: string; name: string; document?: string; email?: string; phone?: string; active: boolean };
export type Warehouse = BaseDocument & { code: string; name: string; active: boolean };
export type StockBalance = BaseDocument & { warehouseId: Id; productId: Id; quantity: Decimal128; reservedQuantity: Decimal128; minimumQuantity: Decimal128 };
export type DocumentLine = { productId: Id; description: string; quantity: Decimal128; unitPrice: Decimal128; total: Decimal128 };
export type SalesOrder = BaseDocument & { number: string; customerId: Id; status: 'draft' | 'confirmed' | 'cancelled' | 'completed'; lines: DocumentLine[]; subtotal: Decimal128; total: Decimal128; idempotencyKey?: string; operationHash?: string };
export type FinancialEntry = BaseDocument & { description: string; type: 'receivable' | 'payable'; status: 'open' | 'paid' | 'cancelled'; amount: Decimal128; dueDate: Date; paidAt?: Date; reference?: string; idempotencyKey?: string; operationHash?: string };
export type FiscalDocument = BaseDocument & { number: string; series?: string; type: 'invoice' | 'service_invoice' | 'other'; status: 'draft' | 'issued' | 'cancelled'; accessKey?: string; issuedAt?: Date };
export type PeopleRecord = BaseDocument & { code: string; name: string; email?: string; active: boolean };
export type ModuleCollectionMap = { products: Product; customers: Customer; suppliers: Supplier; warehouses: Warehouse; stock_balances: StockBalance; sales_orders: SalesOrder; financial_entries: FinancialEntry; fiscal_documents: FiscalDocument; people: PeopleRecord };
export type TenantDocument = Document & { companyId: string };
