# KZ-ERP API contract — F0/F1/F2/F3/F4/F5

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

### Parties

- `GET /api/v1/master-data/parties` — paginated unified party registry.
- `GET /api/v1/master-data/parties/:id` — party detail.
- `POST /api/v1/master-data/parties` — create a person/company party with one or more roles.
- `PATCH /api/v1/master-data/parties/:id` — update party data.
- `DELETE /api/v1/master-data/parties/:id` — logical deactivation; linked addresses are deactivated.

### Addresses

- `GET /api/v1/master-data/parties/:partyId/addresses` — addresses belonging to one party.
- `POST /api/v1/master-data/parties/:partyId/addresses` — create an address for a party.
- `PATCH /api/v1/master-data/addresses/:id` — update an address.
- `DELETE /api/v1/master-data/addresses/:id` — logical deactivation.

Address types: `billing`, `shipping`, `commercial`, `residential`, `other`.

### Products

- `GET /api/v1/master-data/products` — paginated product list.
- `POST /api/v1/master-data/products` — create product; SKU is unique inside the tenant.
- `PATCH /api/v1/master-data/products/:id` — update product.
- `DELETE /api/v1/master-data/products/:id` — logical deactivation.

Product prices use BSON `Decimal128` and are accepted/exposed as decimal strings to preserve monetary precision.

### Units

- `GET /api/v1/master-data/units` — paginated units of measure.
- `POST /api/v1/master-data/units` — create unit.
- `PATCH /api/v1/master-data/units/:id` — update unit.
- `DELETE /api/v1/master-data/units/:id` — logical deactivation.

Unit kinds: `unit`, `weight`, `volume`, `length`, `area`, `time`, `other`.

### Price lists and prices

- `GET /api/v1/master-data/price-lists` — paginated price-list catalog.
- `POST /api/v1/master-data/price-lists` — create a price list.
- `PATCH /api/v1/master-data/price-lists/:id` — update a price list.
- `DELETE /api/v1/master-data/price-lists/:id` — logical deactivation and deactivation of its prices.
- `GET /api/v1/master-data/price-lists/:priceListId/prices` — list prices belonging to a list.
- `POST /api/v1/master-data/price-lists/:priceListId/prices` — create a product price.
- `PATCH /api/v1/master-data/prices/:id` — update amount, minimum quantity or active state.
- `DELETE /api/v1/master-data/prices/:id` — logical deactivation.

## F3 Stock

All F3 routes require an authenticated active tenant. Read operations require `stock:read`; write operations require `stock:write`.

### Warehouses and balances

- `GET /api/v1/stock/warehouses` — active warehouses available to the current tenant.
- `GET /api/v1/stock/balances` — paginated balances, optionally filtered by `warehouseId` and/or `productId`.
- `PATCH /api/v1/stock/balances/:warehouseId/:productId/minimum` — changes the minimum stock threshold.
- `GET /api/v1/stock/summary` — exact-precision operational totals and count of balances at or below minimum.

### Movements

- `GET /api/v1/stock/movements` — paginated movement ledger; optional filters `productId`, `warehouseId`, `type`.
- `POST /api/v1/stock/movements` — records `receipt`, `issue`, `adjustment` or `transfer`.

Quantities are BSON `Decimal128` and API responses use decimal strings. A reduction is rejected with HTTP 409 when available stock would become negative. Transfers require distinct source/destination warehouses. `Idempotency-Key` is supported for mutation retries.

### Reservations

- `GET /api/v1/stock/reservations` — active reservations, optionally filtered by product/warehouse.
- `POST /api/v1/stock/reservations` — reserves available stock; supports `Idempotency-Key`.
- `DELETE /api/v1/stock/reservations/:id` — releases an active reservation.

## F4 Sales

All F4 routes require an authenticated active tenant. Read operations require `sales:read`; writes require `sales:write`.

- `GET /api/v1/sales/orders` — paginated order list; filters include `status` and `customerId`.
- `GET /api/v1/sales/orders/:id` — tenant-scoped order detail.
- `POST /api/v1/sales/orders` — creates a `draft` order; supports `Idempotency-Key`.
- `PATCH /api/v1/sales/orders/:id` — edits customer/lines while the order is `draft`.
- `POST /api/v1/sales/orders/:id/confirm` — transitions `draft` to `confirmed`.
- `POST /api/v1/sales/orders/:id/cancel` — transitions `draft` or `confirmed` to `cancelled`.

Quantities use up to 6 decimal places; prices, line totals and order totals use BSON `Decimal128` with deterministic cent rounding. Customer and products must belong to the authenticated tenant and be active. Reusing an idempotency key with a different payload returns `409 CONFLICT`.

## F5 Finance

All F5 routes require an authenticated active tenant. Read operations require `finance:read`; writes require `finance:write`.

- `GET /api/v1/finance/entries` — paginated receivable/payable entries; filters `type` and `status`.
- `GET /api/v1/finance/entries/:id` — tenant-scoped entry detail.
- `POST /api/v1/finance/entries` — creates an open receivable or payable; supports `Idempotency-Key`.
- `PATCH /api/v1/finance/entries/:id` — edits an open entry.
- `POST /api/v1/finance/entries/:id/pay` — marks an open entry as paid.
- `POST /api/v1/finance/entries/:id/cancel` — cancels an open entry.
- `GET /api/v1/finance/summary` — exact open/overdue receivable and payable totals.

Amounts are BSON `Decimal128` and exposed as decimal strings. Financial mutations pair state changes and audit records inside MongoDB transactions.

## Compatibility master-data endpoints

The existing `/api/v1/master-data/customers`, `/suppliers` and `/warehouses` endpoints remain available for the current desktop flow. They are tenant-isolated and protected by the F2 permissions. The unified `parties` model is the canonical F2 master for new integrations.

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
