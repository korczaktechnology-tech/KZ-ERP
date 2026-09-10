# KORCZAK ERP — Architecture Foundation

Companion to the Architecture 1.0 master document dated 2026-09-10.

## Current foundation

- Desktop: Tauri 2 + React + TypeScript.
- API: Node.js + Express + TypeScript.
- Current persistence implementation: MongoDB.
- Deployment: Render.
- CI and releases: GitHub Actions.
- Public API prefix: `/api/v1`.
- Liveness endpoint: `/health/live`.
- Readiness endpoint: `/health/ready`.
- Compatibility health endpoint: `/health`.
- System endpoint: `/api/v1/system`.

## Boundary

Desktop code communicates with the API over HTTPS and never connects directly to the database. The API owns authentication, authorization, validation, persistence and integration boundaries.

## F0 definition of done

1. Repository structure and development commands are documented.
2. Environment variables have safe examples and no secrets are committed.
3. CI performs API type checking, tests, production build, desktop build and Linux package validation.
4. Release workflow validates the Debian artifact and publishes its SHA-256 checksum for tagged releases.
5. Health and system endpoints exist for operational checks.
6. Tauri packaging has controlled application identity and custom window chrome.
7. Operational runbook, ADRs, security baseline and release checklist exist.
8. Architectural deviations are explicit and assigned to a future phase.

## F1 Core definition of done

1. Authentication uses signed access tokens and server-side refresh sessions.
2. Passwords are salted and hashed with Node's `scrypt`; the minimum password policy is enforced at the API boundary.
3. Core is multi-tenant from the first persisted business record.
4. Tenant-scoped persistence forces `companyId` from the authenticated context and rejects attempts to mutate it.
5. Core collections and all currently declared module collections are provisioned automatically; no manual Atlas collection creation is required.
6. Core indexes cover tenant uniqueness, lookup paths, audit chronology and refresh-session lifecycle, including TTL cleanup.
7. User administration supports paginated listing, creation, controlled updates, activation/deactivation and password reset, with owner protections.
8. Company administration supports authenticated reading and controlled name updates.
9. Audit records are written for bootstrap, user administration, company administration and password changes and are tenant-scoped.
10. API errors normalize validation, authorization, tenant-integrity and duplicate-key failures into the public contract.
11. API responses never expose password hashes or refresh-token secrets.
12. API documentation describes the complete Core contract and security invariants.
13. Automated checks must remain green on the final F1 commit.

## Migration gate

Architecture 1.0 specifies PostgreSQL as the target transactional database. The current implementation still uses MongoDB because the project's explicit implementation decision is MongoDB. PostgreSQL migration remains a future architectural/data gate and is not introduced by F1.

## Phase map

F0 Foundation → F1 Core → F2 Master Data → F3 Stock → F4 Sales/CRM → F5 SCM → F6 Finance → F7 Logistics → F8 Flow → F9 Documents/Audit → F10 Specialized Operations → F11 BI/Analytics → F12 Connect → F13 KOS → F14 AI/IoT → F15 Hardening.
