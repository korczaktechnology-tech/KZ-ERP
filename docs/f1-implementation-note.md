# F1 implementation note

F1 is the data-foundation gate. This repository currently uses MongoDB by explicit project decision. This phase must strengthen the existing foundation rather than introduce PostgreSQL prematurely.

The authoritative acceptance checklist is `docs/f1-checklist.md`. Any future implementation change must preserve tenant isolation, backend-only persistence access, validation, indexing, auditing, API contracts, and automated verification.
