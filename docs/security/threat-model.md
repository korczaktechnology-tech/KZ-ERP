# Security baseline and threat model

## Assets

- User credentials and sessions.
- Tenant/company data.
- API credentials and database credentials.
- Release artifacts and update metadata.
- Audit records.

## Trust boundaries

1. Desktop ↔ public HTTPS API.
2. API ↔ database.
3. API ↔ external integrations.
4. CI ↔ release repository.

## Required controls

- No secrets in Git or desktop bundles.
- HTTPS for production API traffic.
- Input validation at the API boundary.
- Authentication and authorization on protected endpoints.
- Tenant isolation on every tenant-scoped operation.
- Tokens and passwords excluded from logs.
- Revocable/expiring sessions.
- Audit of sensitive administrative actions.
- Webhook authentication and replay protection before production integrations.
- Checksums for downloaded release artifacts.
- Dependency updates and CI checks.

## F0 risk register

| Risk | Mitigation | Owner phase |
|---|---|---|
| Database provider lock-in | Keep persistence behind domain/repository boundary | F1 |
| Tenant data leakage | Central authorization + tenant filters | F1 |
| Secret exposure | Environment/secrets only | F0/F1 |
| Malicious update artifact | HTTPS + SHA-256 verification | F0 |
| Unobservable production failure | request IDs + health endpoint + structured logs | F0 |
| Broken release | CI package validation + rollback procedure | F0 |
