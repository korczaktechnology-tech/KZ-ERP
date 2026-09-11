# Event catalog baseline

The event contract is versioned conceptually from the start. No consumer should rely on another module's private database tables.

## Planned business events

- `customer.created`
- `customer.updated`
- `product.created`
- `stock.reserved`
- `stock.released`
- `order.created`
- `order.approved`
- `order.cancelled`
- `purchase.request.created`
- `purchase.request.submitted`
- `purchase.request.approved`
- `purchase.request.rejected`
- `purchase.request.cancelled`
- `purchase.quote.created`
- `purchase.quote.submitted`
- `purchase.quote.accepted`
- `purchase.quote.rejected`
- `purchase.quote.cancelled`
- `purchase.created`
- `purchase.order.approved`
- `purchase.order.ordered`
- `purchase.order.cancelled`
- `purchase.received`
- `invoice.issued`
- `payment.received`
- `maintenance.work_order.created`
- `service.ticket.opened`
- `project.task.completed`
- `document.created`
- `user.permission.changed`

## F5 SCM delivery

F5 writes critical procurement and receiving events to the tenant-scoped `scm_outbox_events` collection in the same MongoDB transaction as the business mutation. Each record contains a UUID event id, event type, aggregate type/id, payload, attempt count, availability timestamp and delivery status. New publication records carry `schemaVersion` and `correlationId`; legacy producers are normalized with safe defaults at publication time.

The SCM outbox has a durable worker. It atomically claims pending records, publishes them to the internal `integration_events` boundary, marks successful records as `published`, retries failures with exponential backoff, and moves exhausted records to `dead_letter`. A unique `sourceEventId` index makes the publication idempotent. A stale-processing lease is recovered on startup so a crashed worker cannot permanently strand an event.

Operations can inspect the tenant-scoped outbox through `GET /api/v1/scm/outbox` and replay a `dead_letter` event through `POST /api/v1/scm/outbox/:id/replay`. Replay is restricted by `scm:write` and creates an audit record.

`integration_events` is the current modular-monolith publication boundary. A future KORCZAK CONNECT adapter or message broker can consume this durable stream without coupling consumers to SCM's private collections.

## Delivery rule

Critical events use the outbox pattern: the business transaction records the state change and event atomically, a worker publishes pending events, retries failures with backoff, moves exhausted messages to dead-letter handling and records operational evidence. Consumers must be idempotent.

The concrete schemas and producers/consumers are added with their respective modules.
