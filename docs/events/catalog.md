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
- `purchase.created`
- `invoice.issued`
- `payment.received`
- `maintenance.work_order.created`
- `service.ticket.opened`
- `project.task.completed`
- `document.created`
- `user.permission.changed`

## Delivery rule

Critical events use the outbox pattern: the business transaction records the state change and event atomically, a worker publishes pending events, retries failures with backoff, moves exhausted messages to dead-letter handling and records operational evidence. Consumers must be idempotent.

The concrete schemas and producers/consumers are added with their respective modules.
