# F7 — Logistics DoD

- [x] Tenant isolation with `companyId`.
- [x] MongoDB collections and indexes.
- [x] Shipment creation with validation.
- [x] Optional Sales Order linkage.
- [x] Warehouse/customer/product validation.
- [x] Decimal quantity handling up to 6 places.
- [x] Duplicate-line protection.
- [x] Idempotent shipment creation.
- [x] Shipment state machine.
- [x] Immutable operational event history.
- [x] Exception event endpoint.
- [x] RBAC (`logistics:read` / `logistics:write`).
- [x] Audit records for mutations.
- [x] Transactional outbox.
- [x] Retry and dead-letter handling.
- [x] Stale processing lease recovery.
- [x] Integration-event publication with source-event deduplication.
- [x] API documentation.
- [x] Automated RBAC contract tests.
- [ ] Desktop Logistics UI wired to these endpoints.
- [ ] External carrier/TMS integration.
- [ ] Freight quotation and calculation.
- [ ] Route optimization.
- [ ] Proof-of-delivery files/signature.
- [ ] Full E2E smoke test against deployed Render + real MongoDB.

The unchecked items are intentionally outside the F7 backend core and remain future integration/extension work.
