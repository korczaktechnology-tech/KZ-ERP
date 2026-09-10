# API contract baseline

The public API is versioned under `/api/v1` and uses JSON envelopes.

## Operational endpoints

### GET `/health`
Returns HTTP 200 when the API and its database dependency are available; returns HTTP 503 when the database is unavailable.

### GET `/api/v1/system`
Returns application name, version and integration namespaces.

## Core authentication contract

- `POST /api/v1/auth/bootstrap` — one-time creation of the first company and owner account; protected by server-side `CORE_BOOTSTRAP_KEY`.
- `POST /api/v1/auth/login` — creates an access/refresh session.
- `POST /api/v1/auth/refresh` — rotates the refresh session.
- `POST /api/v1/auth/logout` — revokes the supplied refresh session.
- `GET /api/v1/core/me` — authenticated identity.
- `GET /api/v1/core/company` — authenticated company context.

## Contract rules

- JSON request/response bodies.
- Protected endpoints use `Authorization: Bearer <access-token>`.
- Validation happens at the API boundary.
- Errors use `{ error: { code, message, details? }, requestId }`.
- Mutating critical operations must gain idempotency support before production use.
- Pagination uses explicit `limit` and `offset` where applicable.

This document is the F0 contract baseline. Module-specific contracts must be added when each domain is implemented.
