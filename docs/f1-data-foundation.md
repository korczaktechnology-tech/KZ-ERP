# F1 Data Foundation

## Scope

MongoDB is the current persistence layer. The desktop communicates only through the HTTP API. Tenant-scoped records are owned by a company and must never be readable or writable across company boundaries.

## Quality gate

F1 requires executable guarantees for data ownership, validation, indexes, auditing, error contracts, tests, and builds. This document does not mark those guarantees as implemented; the source and CI are the authority.
