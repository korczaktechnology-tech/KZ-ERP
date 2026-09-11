# SCM — Contrato de eventos

## Envelope

Todo evento SCM publicado pelo outbox possui:

- `id`: identificador único da mensagem de origem (`sourceEventId` na publicação interna).
- `companyId`: tenant proprietário do evento.
- `type`: nome do evento de negócio.
- `schemaVersion`: versão inteira do contrato; a versão inicial é `1`.
- `correlationId`: identificador usado para rastrear uma jornada; quando o produtor legado não fornece um valor, o publicador usa o `aggregateId` como fallback.
- `aggregateType`: agregado que originou o evento.
- `aggregateId`: identificador do agregado.
- `payload`: dados de negócio específicos do evento.
- `createdAt`: instante de criação em UTC.

## Eventos SCM

| Evento | Agregado | Quando ocorre |
|---|---|---|
| `purchase.request.created` | `purchase_request` | Requisição criada |
| `purchase.request.submitted` | `purchase_request` | Requisição enviada |
| `purchase.request.approved` | `purchase_request` | Requisição aprovada |
| `purchase.request.rejected` | `purchase_request` | Requisição rejeitada |
| `purchase.request.cancelled` | `purchase_request` | Requisição cancelada |
| `purchase.quote.created` | `purchase_quote` | Cotação criada |
| `purchase.quote.submitted` | `purchase_quote` | Cotação enviada |
| `purchase.quote.accepted` | `purchase_quote` | Cotação aceita |
| `purchase.quote.rejected` | `purchase_quote` | Cotação rejeitada |
| `purchase.quote.cancelled` | `purchase_quote` | Cotação cancelada |
| `purchase.order.created` | `purchase_order` | Pedido criado |
| `purchase.order.approved` | `purchase_order` | Pedido aprovado |
| `purchase.order.ordered` | `purchase_order` | Pedido emitido |
| `purchase.order.cancelled` | `purchase_order` | Pedido cancelado |
| `purchase.receipt.created` | `purchase_receipt` | Recebimento registrado |
| `purchase.receipt.partially_received` | `purchase_order` | Pedido parcialmente recebido |
| `purchase.receipt.received` | `purchase_order` | Pedido totalmente recebido |

## Garantias

1. A alteração de negócio e a entrada na outbox são gravadas na mesma transação MongoDB.
2. O worker usa claim atômico para evitar processamento concorrente do mesmo registro.
3. Falhas são reagendadas com backoff exponencial.
4. Após o limite de tentativas, o evento entra em `dead_letter`.
5. Publicação interna é idempotente por `sourceEventId`.
6. Eventos abandonados em `processing` são recuperados após o lease.
7. Eventos em `dead_letter` podem ser reenfileirados por operação autenticada e auditada.
8. Consumidores externos devem ser idempotentes e não devem escrever diretamente nas coleções do SCM.

## Fronteira com outros módulos

SCM não expõe suas coleções como contrato para outros módulos. O caminho de integração é API/evento/adapter. A implementação atual publica em `integration_events` como destino durável interno; o KORCZAK CONNECT pode posteriormente substituir esse destino por broker/webhook/conector sem alterar o caso de uso de compras.
