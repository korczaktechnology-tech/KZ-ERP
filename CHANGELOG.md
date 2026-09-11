# Changelog

## Unreleased — F5 Finance hardening

- Added the first operational finance module for accounts receivable and payable.
- Added real financial entry creation, editing, payment and cancellation flows.
- Added exact cent-based aggregation on top of MongoDB `Decimal128` values to avoid binary floating-point totals.
- Added tenant isolation, RBAC, UUID idempotency and audit coverage for finance operations.
- Added the desktop Finance interface and F5 acceptance/runbook documentation.

## 0.1.3

- Fixed the custom titlebar controls so minimize, maximize/restore and close are outside the draggable region and explicitly marked non-draggable.
- Added the F0 foundation CI pipeline for API checks/tests/build, desktop build and Linux `.deb` validation.
- Added architecture, ADR, API contract, event catalog, data model, security and operations documentation.
- Added a reproducible local Docker API + MongoDB development stack.
- Aligned desktop package metadata and updater fallback version to 0.1.3.

## 0.1.2

- Initial real desktop/API integration baseline.
- Custom dark Tauri titlebar.
- Real API health and system status.
- Session authentication and refresh flow.
- Master-data and sales flows connected to the API.
- Linux Debian release packaging with SHA-256 verification.

Unreleased work follows the Architecture 1.0 roadmap and must preserve the architectural contract.
