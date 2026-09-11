# F4 — Vendas

## Escopo

F4 entrega o primeiro fluxo comercial do KORCZAK ERP: pedidos de venda ligados aos clientes e produtos dos dados mestre, com ciclo de vida controlado, valores monetários decimais, tenant isolation, RBAC e auditoria.

## Entregas

- [x] Consulta paginada de pedidos.
- [x] Detalhe de pedido.
- [x] Criação de pedido com cliente ativo.
- [x] Linhas de produto validadas contra o tenant.
- [x] Quantidades com até 6 casas decimais.
- [x] Valores monetários persistidos como `Decimal128`.
- [x] Totais calculados no servidor sem `number` para persistência monetária.
- [x] Edição somente enquanto o pedido estiver em `draft`.
- [x] Confirmação de pedido.
- [x] Cancelamento de pedido.
- [x] Idempotência na criação por `Idempotency-Key`.
- [x] RBAC `sales:read` / `sales:write`.
- [x] Tenant isolation em todas as operações.
- [x] Auditoria de criação, alteração, confirmação e cancelamento.
- [x] Interface desktop real ligada à API.
- [x] Sem dados fictícios ou operações simuladas.

## Regras de negócio

1. Somente clientes ativos do tenant podem receber pedidos.
2. Somente produtos ativos do tenant podem compor pedidos.
3. Um pedido nasce como `draft`.
4. Apenas `draft` pode ser editado ou confirmado.
5. `draft` e `confirmed` podem ser cancelados.
6. Pedidos cancelados não podem voltar a ser ativos.
7. Cada número de pedido é único por tenant.
8. Valores monetários são tratados como decimal, não como ponto flutuante persistido.
9. A mesma `Idempotency-Key` repetida para a mesma operação retorna o mesmo pedido; reutilização para outra operação é rejeitada.
10. Nenhum acesso do desktop ao MongoDB é permitido.

## Critério de passagem

- API type check verde.
- Testes unitários verdes.
- Build da API verde.
- Type check/build do desktop verde.
- Pacote `.deb` validado.
- Release Linux verde.
- Smoke test real: cliente → pedido → item → salvar → consultar.
- Smoke test real: editar draft → confirmar → impedir edição.
- Smoke test real: cancelar pedido → impedir nova confirmação.
- Smoke test real: RBAC de leitura/escrita.
- Smoke test real: isolamento entre tenants.
- Smoke test real: repetição da mesma `Idempotency-Key` sem duplicação.
- Smoke test real do aplicativo instalado.

Os testes físicos no ambiente do usuário continuam sendo validação externa; a engenharia deve deixar todos os testes automatizáveis verdes antes disso.
