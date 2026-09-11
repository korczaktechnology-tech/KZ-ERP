# F4 — API de Vendas

Base: `/api/v1/sales`

Todas as rotas exigem autenticação, tenant ativo e RBAC.

## Permissões

- `sales:read`: listar e consultar pedidos.
- `sales:write`: criar, editar, confirmar e cancelar.
- owner/admin/manager: leitura e escrita.
- user/viewer: somente leitura.

## Endpoints

- `GET /orders` — lista paginada; filtros opcionais `status` e `customerId`.
- `GET /orders/:id` — detalhe do pedido.
- `POST /orders` — cria pedido em `draft`; aceita `Idempotency-Key` UUID.
- `PATCH /orders/:id` — altera cliente/linhas enquanto `draft`.
- `POST /orders/:id/confirm` — `draft` → `confirmed`.
- `POST /orders/:id/cancel` — `draft|confirmed` → `cancelled`.

## Dinheiro e quantidade

- Quantidade: string decimal com até 6 casas.
- Preço: string decimal com até 2 casas.
- Linhas, subtotal e total são persistidos como BSON `Decimal128`.
- Total de linha é arredondado deterministicamente para centavos.
- Não há conversão monetária por `Number`/ponto flutuante.

## Integridade

- Cliente e produtos precisam pertencer ao tenant autenticado e estar ativos.
- Número do pedido é único por tenant através do índice de `sales_orders`.
- `Idempotency-Key` é vinculada ao hash da operação: repetição idêntica é segura; reutilização com payload diferente retorna conflito.
- Criação, edição e transições de estado executam a mutação e o respectivo evento de auditoria na mesma transação MongoDB.
- Transições inválidas retornam `409`.
- O commit da operação só ocorre quando todos os efeitos persistentes da operação são confirmados.

## Estoque

F4 confirma o ciclo comercial do pedido, mas não realiza automaticamente baixa ou reserva de estoque. O estoque é responsabilidade do F3 até que um contrato de integração comercial/estoque seja formalmente ativado.
