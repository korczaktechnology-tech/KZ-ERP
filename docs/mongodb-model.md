# MongoDB domain model

KORCZAK ERP uses MongoDB with database `ERP`. The model is designed for multi-company operation from the beginning.

## Rules

- Every tenant-owned document contains `companyId`.
- Tenant-owned collections must be accessed through `tenantCollection()`.
- `companyId` is supplied by authenticated server context, never trusted from client input.
- Business identifiers such as SKU, customer code and order number are unique within a company, not globally.
- Cross-entity references use string IDs and must be validated against the same `companyId` before use.
- Dates are stored as BSON `Date` values.
- Monetary values are represented as numbers in the current foundation; financial precision/decimal policy must be finalized before fiscal/financial production workflows.

## Collections

### CORE

- `companies` — global company registry.
- `users` — tenant users and RBAC roles.
- `audit_logs` — immutable operational audit trail.
- `auth_sessions` — refresh-token sessions with TTL expiration.

### Initial business model

- `products` — product/service catalog foundation.
- `customers` — customer master data.
- `suppliers` — supplier master data.
- `warehouses` — warehouse master data.
- `stock_balances` — product quantity per warehouse.
- `sales_orders` — sales order header and lines.
- `financial_entries` — accounts receivable/payable foundation.
- `fiscal_documents` — fiscal document foundation.
- `people` — people/employee master foundation.

## Index policy

Indexes always begin with `companyId` for tenant-owned data. Natural business keys have compound unique indexes scoped to the company. Operational queries receive indexes for status, date and foreign-key access patterns.

The API creates missing collections and indexes at startup, so Atlas does not require manual schema provisioning for these foundations.

## Module evolution

This is a foundation, not permission to implement all modules prematurely. WMS, TMS, CRM, Finance, Fiscal, People, Sales, Commerce, Quality, Maintenance, Documents, Assets, Field, Service and Projects will extend this model in their implementation steps while preserving the same tenant boundary.
