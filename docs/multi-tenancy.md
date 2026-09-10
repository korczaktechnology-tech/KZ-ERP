# Multi-company / multi-tenant CORE

KORCZAK ERP is multi-company from the foundation. Every business record owned by a customer must belong to exactly one `companyId`.

## Rules

1. `companyId` comes from the authenticated server-side token context, never from the client body or query as the authority.
2. Tenant-owned reads must include the authenticated `companyId`.
3. Tenant-owned updates and deletes must include the authenticated `companyId` in the filter.
4. The `companyId` of an existing record is immutable. The tenant data-access helper rejects attempts to change it.
5. Tenant-owned inserts receive `companyId` from the server-side tenant context.
6. Users are isolated by `(companyId, email)`; the same email may exist in different companies.
7. If an email belongs to more than one active company and no `companySlug` is supplied at login, the API returns `COMPANY_REQUIRED` instead of selecting a tenant arbitrarily.
8. An authenticated request is rejected if either its user or company is no longer active.
9. Companies themselves are global CORE records and are never exposed through arbitrary client-supplied company identifiers.

## Current tenant-owned collections

- `users`
- `audit_logs`
- Future ERP/module collections must follow the same `companyId` boundary.

## Data-access contract

Use `tenantCollection(db, collectionName)` for tenant-owned module collections. It automatically scopes `findOne`, `find`, `insertOne`, `updateOne`, and `deleteOne` to a company and prevents mutation of `companyId`.

Direct collection access is reserved for genuinely global CORE data (for example, `companies`) or carefully controlled cross-tenant authentication lookups.

## Security boundary

The desktop application is not a tenant authority. It sends authentication credentials/tokens over HTTPS. The API resolves the tenant from the authenticated identity and enforces the boundary before serving protected CORE data.
