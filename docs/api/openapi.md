# KZ-ERP API contract — F1 Core

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

The API never returns password hashes to clients. User writes are audited. Owner accounts cannot be deactivated or demoted; administrators cannot manage the owner account.

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

This document is the F1 Core contract baseline. Module-specific contracts must be added when each domain is implemented.
