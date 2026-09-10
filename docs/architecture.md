# KORCZAK ERP — Architecture Foundation

Companion to the Architecture 1.0 master document dated 2026-09-10.

## Current foundation

- Desktop: Tauri 2 + React + TypeScript.
- API: Node.js + Express + TypeScript.
- Current persistence implementation: MongoDB.
- Deployment: Render.
- CI and releases: GitHub Actions.
- Public API prefix: `/api/v1`.
- Health endpoint: `/health`.
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

## Migration gate

Architecture 1.0 specifies PostgreSQL as the target transactional database. The current implementation still uses MongoDB. This is an explicit implementation-stage deviation. PostgreSQL migration is a Core/data foundation gate and must be completed before the ERP is declared fully aligned with Architecture 1.0.

## Phase map

F0 Foundation → F1 Core → F2 Master Data → F3 Stock → F4 Sales/CRM → F5 SCM → F6 Finance → F7 Logistics → F8 Flow → F9 Documents/Audit → F10 Specialized Operations → F11 BI/Analytics → F12 Connect → F13 KOS → F14 AI/IoT → F15 Hardening.
