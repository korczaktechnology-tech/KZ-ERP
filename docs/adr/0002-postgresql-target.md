# ADR-0002 — MongoDB as the official transactional database

- Status: Accepted
- Date: 2026-09-11

## Decision

MongoDB is the official transactional database for KZ-ERP. The implementation uses the existing KOS MongoDB infrastructure and the `ERP` database. All modules must use MongoDB-native repositories, indexes, transactions where required, tenant isolation and operational controls.

PostgreSQL is not part of the KZ-ERP architecture, CI, local development, production infrastructure or migration strategy.

## Current state

The running implementation already uses MongoDB. The database connection is supplied through `MONGODB_URI` and `MONGODB_DB`, with `ERP` as the default database name.

## Operational requirements

- MongoDB remains the single application database technology.
- Local development may use the repository's MongoDB Docker Compose service.
- Production may use the existing managed KOS/ERP MongoDB deployment; the application infrastructure must not provision a PostgreSQL database.
- MongoDB backups, restore tests, replica-set/availability configuration, indexes and migration procedures remain part of the production hardening work.
- Future modules must preserve tenant isolation and use the established MongoDB data-access conventions.

## Exit criterion

This decision is complete when repository-wide CI, infrastructure, documentation and runtime configuration contain no PostgreSQL dependency and all database operations are covered by MongoDB tests and operational procedures.
