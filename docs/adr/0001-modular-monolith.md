# ADR-0001 — Modular monolith first

- Status: Accepted
- Date: 2026-09-10

## Decision

Start the ERP as a modular monolith with strict domain boundaries. Modules expose interfaces/contracts and do not write directly to another module's tables without an explicit architectural decision.

## Consequences

This reduces deployment and operational complexity at zero budget while preserving a path to independently deployed services when measurable load, ownership or reliability requirements justify extraction.
