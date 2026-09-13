# F1 Core — Validation and closure

## Static validation

The repository CI contract for the API runs TypeScript check, unit tests and production build on every push/PR to `main`.

## Deterministic migration

From `apps/api`:

```bash
node --import tsx src/migrations/runner.ts
```

The runner records applied migrations in `schema_migrations` and is idempotent.

## Full operational smoke

Set `KZ_ERP_API_URL`, `KZ_ERP_E2E_EMAIL`, `KZ_ERP_E2E_PASSWORD` and optionally `KZ_ERP_E2E_COMPANY_SLUG`, then run:

```bash
node scripts/f1-full-smoke.mjs
```

The flow validates health/system, login, tenant, company, branch CRUD/deactivation, user CRUD/deactivation, RBAC, audit, refresh rotation and refresh-token revocation.

## OpenAPI

The F1 contract is published at `docs/openapi/f1-core.yaml` and covers bootstrap/authentication, tenant/company, branches, users, audit, RBAC and scopes.
