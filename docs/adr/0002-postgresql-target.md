# ADR-0002 — PostgreSQL as target transactional database

- Status: Accepted
- Date: 2026-09-10

## Decision

PostgreSQL is the target transactional database for Architecture 1.0. Migrations must be versioned, reproducible and portable.

## Current state

The running implementation uses MongoDB. This is tracked as a temporary implementation deviation and is not to be hidden as an architectural choice.

## Exit criterion

Before the Core/data foundation is declared complete, the transactional model, migrations, tests and operational backup/restore procedure must run on PostgreSQL without provider-specific coupling.
