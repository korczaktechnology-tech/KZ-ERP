# KZ-ERP API contract — F2/F3

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
- `POST /api/v1/auth/logout` — revokes the supplied refresh session.
- `POST /api/v1/auth/change-password` — changes the authenticated user's password and revokes that user's sessions.
- `GET /api/v1/core/me` — authenticated identity and tenant context.

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

Price amounts are stored as BSON `Decimal128` and accepted by the API as decimal strings, e.g. `"19.90"`, to preserve monetary precision.

## F3 Stock

All F3 routes require an authenticated active tenant. Read operations require `stock:read`; write operations require `stock:write`.

### Warehouses

- `GET /api/v1/stock/warehouses` — active warehouses available to the current tenant.

Warehouse creation/editing remains in the F2 compatibility master-data contract; F3 consumes those canonical warehouse records.

### Balances

- `GET /api/v1/stock/balances` — paginated balances, optionally filtered by `warehouseId` and/or `productId`.
- `PATCH /api/v1/stock/balances/:warehouseId/:productId/minimum` — changes the minimum stock threshold.
- `GET /api/v1/stock/summary` — operational totals and count of balances at or below minimum.

Balance quantities are BSON `Decimal128`. API responses expose them as decimal strings. `availableQuantity = quantity - reservedQuantity`.

### Movements

- `GET /api/v1/stock/movements` — paginated movement ledger; optional filters `productId`, `warehouseId`, `type`.
- `POST /api/v1/stock/movements` — records `receipt`, `issue`, `adjustment` or `transfer`.

A reduction is rejected with HTTP 409 when it would make available stock negative. Transfers require distinct source/destination warehouses.

### Reservations

- `GET /api/v1/stock/reservations` — active reservations, optionally filtered by product/warehouse.
- `POST /api/v1/stock/reservations` — reserves available stock.
- `DELETE /api/v1/stock/reservations/:id` — releases an active reservation.

## Compatibility master-data endpoints

The existing `/api/v1/master-data/customers`, `/suppliers` and `/warehouses` endpoints remain available for the current desktop flow. They are tenant-isolated and protected by the F2 permissions. The unified `parties` model is the canonical F2 master for new integrations.

## Tenant isolation

Every tenant-owned collection access must bind `companyId` from the authenticated context. The persistence helper overwrites caller-supplied `companyId` filters with the authenticated tenant and rejects attempts to mutate `companyId`. Tenant-scoped unique indexes prevent collisions between records of different companies while allowing identical business identifiers across companies.

## Contract rules

- JSON request/response bodies.
- Protected endpoints use `Authorization: Bearer <access-token>`.
- Validation happens at the API boundary with Zod.
- Errors use `{ error: { code, message, details? }, requestId }`.
- Duplicate-key conflicts return HTTP 409 instead of leaking database errors.
- Pagination uses explicit `limit` and `offset` where applicable.
- Password hashes, refresh-token values and other authentication secrets are never returned by API responses.
- Mutating critical operations must gain idempotency support before production use where retries could create duplicate business effects.
