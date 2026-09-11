# Logistics Events — v1

| Event | Aggregate | Payload mínimo |
|---|---|---|
| `logistics.shipment.created` | shipment | `number`, `status` |
| `logistics.shipment.ready` | shipment | `status`, `description?` |
| `logistics.shipment.dispatched` | shipment | `status`, `description?` |
| `logistics.shipment.delivered` | shipment | `status`, `description?` |
| `logistics.shipment.cancelled` | shipment | `status`, `description?` |
| `logistics.shipment.exception` | shipment | `description?` |

Todos os eventos usam `schemaVersion=1`, `companyId`, `aggregateId` e `correlationId`. A publicação externa ocorre após persistência transacional através do outbox.
