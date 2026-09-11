# KORCZAK ERP — F0–F7 Integration & Completion Gate

This document is the synchronization gate for F0 through F7. It does not mark a capability complete merely because a route or type exists: the final gate requires API contract, tenant isolation, persistence, audit, events/outbox where applicable, tests, desktop state handling and CI validation.

## Canonical dependency chain

`F0 Foundation → F1 Core → F2 Master Data → F3 Stock → F4 Sales/CRM → F5 SCM → F6 Finance → F7 Logistics`

The modules remain independently deployable inside the ERP API. Cross-module communication is contract/event based; one module must not reach into another module's persistence implementation.

## Synchronized contracts

| Flow | Contract | Current state |
|---|---|---|
| F1 → F2 | authenticated tenant → master data | Connected |
| F2 → F3 | product/warehouse references → stock | Connected |
| F2 → F4 | customer/product references → sales | Connected |
| F4 → F5 | sales demand → supply planning | Contract-ready |
| F4 → F6 | sales receivable → finance | Contract-ready |
| F3 → F6 | inventory valuation → finance | Contract-ready |
| F5 → F3 | supply receipt → stock | Connected |
| F4 → F7 | sales order → shipment tracking | Connected |
| F3 → F7 | inventory availability → fulfillment | Contract-ready |
| F6 → F7 | financial clearance → shipment release | Contract-ready |

The canonical contract registry is exposed by `/api/v1/system` and versioned independently from application releases.

## Phase gates

### F0 — Foundation
- MongoDB is the only application persistence technology.
- Render is the deployment target.
- CI validates API, desktop, Tauri `.deb` and MongoDB configuration.
- Health/readiness/system endpoints exist.
- Custom Tauri titlebar is owned by the application.
- Secrets are environment-only.

### F1 — Core
- Authentication/session lifecycle and tenant context are mandatory.
- RBAC is explicit for every implemented module.
- Tenant identifiers are immutable at API boundaries.
- Audit is tenant-scoped.
- Core indexes and session TTL are provisioned automatically.

### F2 — Master Data
- Products, warehouses and customers are the shared business references.
- CRUD operations use the same tenant/auth/audit/API conventions as Core.
- Downstream modules reference IDs instead of duplicating master records.

### F3 — Stock
- Inventory mutations remain transactional and tenant-scoped.
- Quantities use exact decimal representations where required.
- Stock becomes the source of inventory state; consumers use contracts rather than direct collection access.

### F4 — Sales / CRM
- Sales orders validate customer/product references.
- Monetary and quantity precision rules are enforced.
- Sales remains the commercial source; finance and logistics consume defined contracts.

### F5 — SCM
- Supply transactions have transactional persistence and outbox publication.
- Retry/dead-letter/recovery behavior is part of the integration boundary.
- SCM can hand supply receipts into the stock contract without importing stock internals.

### F6 — Finance
- Financial entries, accounts, categories, payments and transfers use exact monetary values.
- Idempotency, tenant isolation, RBAC and audit are enforced.
- Finance outbox publishes integration events with retry and dead-letter handling.

### F7 — Logistics
- Shipment creation validates warehouse/customer/product/sales-order references.
- Shipment lifecycle is guarded: draft → ready → in_transit → delivered, with controlled cancellation.
- Shipment history, audit and outbox are transactional.
- Logistics is ready for a future TMS/carrier adapter without coupling the ERP to an external provider.

## 90% gate definition

A phase may be considered **≥90%** only when all of the following are true for the phase's declared scope:

1. Backend domain behavior is implemented.
2. API contract and validation are implemented.
3. MongoDB persistence and indexes are provisioned automatically.
4. Authentication, RBAC and tenant isolation are enforced.
5. Mutations have audit coverage.
6. Integration contracts/events are defined and wired where the phase declares an event boundary.
7. Unit/integration/contract tests cover critical paths.
8. Desktop UI consumes the real API and exposes loading, empty, error, success and blocked states.
9. CI is green on the final commit.
10. Remaining external dependencies are explicit rather than simulated.

## Remaining work before declaring every F0–F7 phase ≥90%

- Complete the desktop UI for SCM and Logistics and verify real API round-trips.
- Add/finish end-to-end tests spanning master data → stock/sales → SCM/finance → logistics.
- Wire the contract-ready sales/finance, stock/finance, stock/logistics and finance/logistics event consumers/adapters; the current registry intentionally does not pretend these are already direct business automations.
- Finish external smoke validation against the deployed Render API and MongoDB.
- Configure the Render `GITHUB_TOKEN` required by the private-repository `.deb` updater.
- Keep CI green after all integration changes.
