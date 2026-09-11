# F5 — Finance API contract

All routes require an authenticated active tenant. Read operations require `finance:read`; writes require `finance:write`.

## Entries

- `GET /api/v1/finance/entries` — paginated entries; filters: `type` and `status`.
- `GET /api/v1/finance/entries/:id` — tenant-scoped detail.
- `POST /api/v1/finance/entries` — creates an open receivable or payable. Supports `Idempotency-Key`.
- `PATCH /api/v1/finance/entries/:id` — edits an open entry.
- `POST /api/v1/finance/entries/:id/pay` — marks an open entry as paid.
- `POST /api/v1/finance/entries/:id/cancel` — cancels an open entry.
- `GET /api/v1/finance/summary` — returns open and overdue receivable/payable totals and open count.

## Entry contract

```json
{
  "description": "Mensalidade",
  "type": "receivable",
  "amount": "1250.00",
  "dueDate": "2026-10-10T03:00:00.000Z",
  "reference": "CTR-001"
}
```

`amount` is stored as BSON `Decimal128` and exposed as a decimal string. `dueDate` is stored as a BSON date. Statuses are `open`, `paid`, and `cancelled`.

## Idempotency

`Idempotency-Key` must be a UUID. Repeating the same key with the same payload returns the original entry; reusing it with a different payload returns `409 CONFLICT`.

## Security

All collection operations bind the authenticated `companyId`. The desktop communicates only with the API and never receives database credentials or direct MongoDB access.
