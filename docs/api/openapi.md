# KZ-ERP API contract — F0/F1/F2/F3/F4/F5/F6

The public API is versioned under `/api/v1` and uses JSON envelopes.

## Operational endpoints

### GET `/health/live`
Process liveness check. Does not require MongoDB.

### GET `/health/ready`
Readiness check. Returns HTTP 200 only when the API can reach MongoDB; otherwise HTTP 503.

### GET `/health`
Compatibility alias for the database-ready health check.

### GET `/api/v1/system`
Returns application name, version and integration namespaces.

## Core authentication

- `POST /api/v1/auth/bootstrap` — one-time creation of the first company and owner account; protected by server-side `CORE_BOOTSTRAP_KEY`.
- `POST /api/v1/auth/login` — creates an access/refresh session.
- `POST /api/v1/auth/refresh` — rotates the refresh session and invalidates the previous refresh token.
- `POST /api/v1/auth/logout` — revokes the supplied refresh session and its access session.
- `POST /api/v1/auth/change-password` — changes the authenticated user's password and revokes that user's sessions.
- `GET /api/v1/core/me` — authenticated identity and tenant context.

All authenticated API routes require an active access session; revoked sessions are rejected immediately.

## Core administration

All routes below require an authenticated, active user and active company.

- `GET /api/v1/core/company` — reads the current company.
- `PATCH /api/v1/core/company` — updates the company name; requires `company:write`.
- `GET /api/v1/core/users` — paginated tenant-scoped user list; requires `users:read`.
- `POST /api/v1/core/users` — creates a non-owner user; requires `users:write`.
- `PATCH /api/v1/core/users/:id` — updates name, role, active state or resets password; requires `users:write`.
- `GET /api/v1/core/audit` — paginated tenant-scoped audit history; requires `audit:read`.

## F2 Master Data

All F2 routes require an authenticated active tenant. Read operations require `master-data:read`; write operations require `master-data:write`.

- Parties: unified party registry, detail, create, update and logical deactivation.
- Addresses: tenant-scoped create, list, update and logical deactivation.
- Products: tenant-scoped create, list, update and logical deactivation.
- Units: tenant-scoped create, list, update and logical deactivation.
- Price lists/prices: tenant-scoped CRUD with logical deactivation.

Product prices use BSON `Decimal128` and are accepted/exposed as decimal strings to preserve monetary precision.

## F3 Stock

All F3 routes require an authenticated active tenant. Read operations require `stock:read`; write operations require `stock:write`.

- Warehouses/balances: list, minimum threshold and summary.
- Movements: receipt, issue, adjustment and transfer, with UUID `Idempotency-Key`.
- Reservations: create/list/release with UUID `Idempotency-Key`.

Quantities use BSON `Decimal128` and API responses use decimal strings. Reductions that would make available stock negative return HTTP 409.

## F4 Sales

All F4 routes require an authenticated active tenant. Read operations require `sales:read`; writes require `sales:write`.

- Orders: list/detail/create draft/update draft/confirm/cancel.
- Customer and product references are validated inside the authenticated tenant.
- Critical create operations support UUID `Idempotency-Key`.
- Prices and totals use BSON `Decimal128` with deterministic cent rounding.

## F5 SCM — Supply Chain Management

All F5 routes require an authenticated active tenant. Read operations require `scm:read`; write operations require `scm:write`.

### Purchase requests

- `GET /api/v1/scm/requests` — paginated requests; optional `status` filter.
- `POST /api/v1/scm/requests` — creates a draft purchase request; supports `Idempotency-Key`.
- `POST /api/v1/scm/requests/:id/submit` — draft → submitted.
- `POST /api/v1/scm/requests/:id/approve` — submitted → approved.
- `POST /api/v1/scm/requests/:id/reject` — submitted → rejected.
- `POST /api/v1/scm/requests/:id/cancel` — draft/submitted → cancelled.

### Quotations

- `GET /api/v1/scm/quotes` — paginated quotations; optional request, supplier and status filters.
- `POST /api/v1/scm/quotes` — creates a supplier quotation for a submitted/approved request; supports `Idempotency-Key`.
- `POST /api/v1/scm/quotes/:id/submit` — draft → submitted.
- `POST /api/v1/scm/quotes/:id/accept` — submitted → accepted.
- `POST /api/v1/scm/quotes/:id/reject` — submitted → rejected.

### Purchase orders

- `GET /api/v1/scm/orders` — paginated purchase orders; optional supplier/status filters.
- `POST /api/v1/scm/orders` — creates a draft purchase order; an optional `quoteId` must reference an accepted quote from the same supplier; supports `Idempotency-Key`.
- `POST /api/v1/scm/orders/:id/approve` — draft → approved.
- `POST /api/v1/scm/orders/:id/order` — approved → ordered.
- `POST /api/v1/scm/orders/:id/cancel` — draft → cancelled.

### Receiving

- `GET /api/v1/scm/receipts` — paginated receipts; optional purchase order and warehouse filters.
- `POST /api/v1/scm/receipts` — receives products against an ordered/partially received purchase order into an active warehouse; supports `Idempotency-Key`.

Receiving is transactional: the receipt, purchase-order received quantities/status, stock balance increase, stock movement and audit/outbox records are committed together. A receipt cannot exceed the ordered quantity, and concurrent order changes are rejected rather than silently overwriting state.

### Outbox operations

- `GET /api/v1/scm/outbox` — paginated tenant-scoped operational view; filters `status`, `type` and `aggregateType`.
- `POST /api/v1/scm/outbox/:id/replay` — requeues a `dead_letter` event, resets its retry counter and records an audit entry.

Outbox read requires `scm:read`; replay requires `scm:write`.

### F5 invariants

- Supplier, product and warehouse references are tenant-scoped and active when required.
- Purchase request, quotation and order state transitions are explicit and invalid transitions return HTTP 409.
- Decimal quantities support up to 6 fractional places; money supports up to 2.
- UUID idempotency keys are persisted with operation hashes; reusing a key with a different payload returns HTTP 409.
- Audit records are written for every SCM mutation and outbox replay.
- Critical SCM business changes create pending outbox events in `scm_outbox_events` for asynchronous publication.
- Published events are idempotent by `sourceEventId` and carry a versioned envelope (`schemaVersion`, `correlationId`).
- Tenant-owned persistence binds `companyId` to the authenticated context.

## F6 Finance

All F6 routes require an authenticated active tenant. Read operations require `finance:read`; writes require `finance:write`.

- `GET /api/v1/finance/entries` — paginated receivable/payable entries; filters `type` and `status`.
- `GET /api/v1/finance/entries/:id` — tenant-scoped entry detail.
- `POST /api/v1/finance/entries` — creates an open receivable or payable; supports `Idempotency-Key`.
- `PATCH /api/v1/finance/entries/:id` — edits an open entry.
- `POST /api/v1/finance/entries/:id/pay` — marks an open entry as paid.
- `POST /api/v1/finance/entries/:id/cancel` — cancels an open entry.
- `GET /api/v1/finance/summary` — exact open/overdue receivable and payable totals.

Amounts are BSON `Decimal128` and exposed as decimal strings. Financial mutations pair state changes and audit records inside MongoDB transactions.

## Compatibility master-data endpoints

The existing `/api/v1/master-data/customers`, `/suppliers` and `/warehouses` endpoints remain available for the current desktop flow. They are tenant-isolated and protected by F2 permissions. The unified `parties` model is the canonical F2 master for new integrations.

## Tenant isolation

Every tenant-owned collection access binds `companyId` from the authenticated context. The persistence helper overwrites caller-supplied `companyId` filters with the authenticated tenant and rejects attempts to mutate `companyId`. Tenant-scoped unique indexes prevent collisions between records of different companies while allowing identical business identifiers across companies.

## Contract rules

- JSON request/response bodies.
- Protected endpoints use `Authorization: Bearer <access-token>`.
- Protected endpoints also require the access token's active server-side session.
- Validation happens at the API boundary with Zod.
- Errors use `{ error: { code, message, details? }, requestId }`.
- Duplicate-key conflicts return HTTP 409 instead of leaking database errors.
- Pagination uses explicit `limit` and `offset` where applicable.
- Password hashes, refresh-token values, session identifiers and other authentication secrets are never returned by API responses.
- Critical retriable mutations use UUID `Idempotency-Key` where specified.
- Monetary values are never converted through JavaScript floating-point arithmetic.
