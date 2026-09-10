# Data model baseline

Architecture 1.0 uses UUID public identifiers and requires timestamps, state/deletion markers where applicable, indexes aligned to query cases, integrity constraints, numeric/decimal money values, UTC timestamps, immutable numbered migrations and transaction boundaries.

## Core objects

- Organization/Tenant — tenant boundary; owns branches, users and configuration.
- Company/LegalEntity — legal/company identity; relates to fiscal documents, accounts and addresses.
- Branch — operational branch; relates to stock, sales and people.
- Party — common party abstraction for customers, suppliers, contacts and employees.
- Product — SKU, pricing, stock, purchasing and sales references.
- Warehouse — stock location and movement context.
- Document — orders, invoices, contracts and billing documents.
- FinancialAccount — financial postings and payments.
- User — roles, permissions and audit actor.
- Asset — maintenance, location and custody.
- Event — outbox/integration/audit technical event.

## Current implementation note

The current API persists these concepts through MongoDB collections. The target architecture is PostgreSQL with versioned migrations; the migration is a future Core/data gate and must not be hidden.
