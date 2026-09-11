# F7 — Logistics

## Objetivo

F7 adiciona a camada logística do KORCZAK ERP, responsável pelo ciclo operacional de expedição e acompanhamento de remessas. O módulo é tenant-scoped, usa MongoDB como persistência oficial e não acessa o banco diretamente pelo desktop.

## Domínio

### LogisticsShipment
- identificação e número operacional;
- vínculo opcional com Sales Order;
- armazém de origem;
- cliente e destino;
- transportadora e código de rastreio;
- linhas de produtos com quantidade decimal exata;
- estado operacional.

Estados:
`draft → ready → in_transit → delivered`

Cancelamento permitido em `draft`, `ready` e `in_transit`.

### LogisticsEvent
Histórico imutável da remessa: criação, preparação, despacho, entrega, exceção e cancelamento.

## API

Base: `/api/v1/logistics`

- `GET /shipments` — lista paginada e filtrável por status, armazém e rastreio.
- `GET /shipments/:id` — detalhe + histórico.
- `POST /shipments` — criação idempotente.
- `POST /shipments/:id/ready` — prepara para despacho.
- `POST /shipments/:id/dispatch` — coloca em trânsito.
- `POST /shipments/:id/deliver` — confirma entrega.
- `POST /shipments/:id/cancel` — cancela.
- `POST /shipments/:id/events` — registra exceção operacional.

Operações mutáveis exigem `logistics:write`; consultas exigem `logistics:read`.

## Integridade

- isolamento obrigatório por `companyId`;
- validação de produtos, armazém, cliente e pedido de venda;
- somente produtos ativos podem entrar na remessa;
- linhas duplicadas são rejeitadas;
- quantidades aceitam até 6 casas decimais;
- número da remessa é único por empresa;
- `Idempotency-Key` UUID evita criação duplicada;
- transições de estado são verificadas dentro de transação MongoDB;
- toda mutação gera auditoria;
- eventos são gravados na mesma transação da mudança de estado.

## Eventos de integração

A publicação segue o padrão `transaction → outbox → worker → integration_events`, com retry, recuperação de lease e dead-letter.

Eventos principais:
- `logistics.shipment.created`
- `logistics.shipment.ready`
- `logistics.shipment.dispatched`
- `logistics.shipment.delivered`
- `logistics.shipment.cancelled`
- `logistics.shipment.exception`

`schemaVersion=1` e `correlationId` são persistidos no outbox para preparar contratos futuros com TMS/WMS/CRM sem acoplamento direto entre módulos.

## Limites desta fase

F7 não implementa ainda roteirização, cálculo de frete, cotação de transportadoras, emissão fiscal, integração externa de TMS ou prova de entrega com arquivo. Esses recursos pertencem às extensões posteriores e devem consumir os contratos de integração, não acessar as coleções internas diretamente.
