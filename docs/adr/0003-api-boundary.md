# ADR-0003 — API boundary

- Status: Accepted
- Date: 2026-09-10

## Decision

The desktop application communicates with the server through versioned HTTP APIs. Database credentials and direct database access never ship in the desktop application.

## Contract

External APIs live under `/api/v1`, return JSON, use structured errors and request identifiers, and require authentication/authorization for protected operations.
