# API standard

KORCZAK ERP API v1 uses a predictable HTTP contract.

## Success

JSON resources use:

```json
{ "data": {} }
```

Collections should use:

```json
{ "data": { "items": [], "pagination": { "limit": 50, "offset": 0, "total": 0 } } }
```

Creation returns HTTP 201. Successful empty operations return HTTP 204.

## Errors

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": []
  }
}
```

Standard HTTP mapping:

- 400 — malformed or invalid request.
- 401 — missing/invalid authentication.
- 403 — authenticated but unauthorized.
- 404 — resource does not exist.
- 409 — state/uniqueness conflict.
- 500 — unexpected server failure.

## Request tracing

Every request receives an `x-request-id`. A client-supplied request ID is preserved when present; otherwise the API generates a UUID. The same ID is returned in the response header and is intended for logs/support diagnostics.

## Pagination

Endpoints accepting pagination use `limit` and `offset`.

- Default limit: 50.
- Maximum limit: 100.
- Minimum offset: 0.
- Maximum offset: 1,000,000.

The parsing helper rejects unsafe numeric values by falling back to safe defaults.

## Validation

Zod validation failures are converted centrally into `VALIDATION_ERROR` responses. Internal exception details are not exposed to clients.

## Tenant security

Authentication, authorization and `companyId` isolation remain mandatory. Client-provided tenant identifiers must never override the authenticated tenant context.
