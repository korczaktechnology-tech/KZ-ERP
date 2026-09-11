# F3 — Estoque e operação básica

## Escopo

F3 entrega o controle operacional de estoque do KORCZAK ERP sobre os produtos e depósitos já cadastrados na F2. A fase usa o tenant autenticado como limite de dados, RBAC do Core, auditoria e quantidades BSON `Decimal128`.

## Entregas

- [x] Consulta de depósitos ativos.
- [x] Saldo por produto × depósito.
- [x] Quantidade disponível calculada como quantidade física menos reservado.
- [x] Entrada de estoque.
- [x] Saída de estoque com bloqueio de saldo insuficiente.
- [x] Ajuste positivo e negativo.
- [x] Transferência entre depósitos com validação de origem/destino.
- [x] Histórico de movimentações.
- [x] Reserva de estoque.
- [x] Liberação de reserva.
- [x] Estoque mínimo por produto × depósito.
- [x] Resumo operacional e indicador de estoque baixo.
- [x] Quantidades persistidas como `Decimal128`, sem `double` para o saldo.
- [x] Permissões `stock:read` e `stock:write`.
- [x] Auditoria de movimentações, reservas e alteração de mínimo.
- [x] Tenant isolation em todas as consultas e escritas.
- [x] Interface desktop real ligada à API, sem registros fictícios.
- [x] Renovação de sessão no fluxo de operações do desktop.
- [x] Operações de estoque + auditoria agrupadas em transações MongoDB.
- [x] Transferências são atômicas entre origem, destino, movimento e auditoria.
- [x] Reservas e liberações são atômicas entre saldo, reserva e auditoria.

## Regras

1. Toda leitura e escrita usa o `companyId` autenticado.
2. `owner/admin/manager` podem escrever; `user/viewer` somente leem.
3. Saídas e reduções de ajuste não podem deixar o saldo disponível negativo.
4. Reservas só podem consumir o saldo disponível.
5. Transferências exigem depósitos diferentes e saldo disponível na origem.
6. Quantidades aceitam até 6 casas decimais e são persistidas como `Decimal128`.
7. Exclusão física de movimentos e reservas não é permitida pelo contrato operacional.
8. Operações críticas geram evento em `audit_logs`.
9. O desktop não acessa MongoDB diretamente.
10. Falha em qualquer efeito persistente de uma operação transacional aborta a operação inteira.

## Critério de passagem de engenharia

- Type check da API verde.
- Testes unitários verdes.
- Build da API verde.
- Type check/build do desktop verde.
- Validação do pacote `.deb` verde.
- Release Linux verde.
- Smoke test real de entrada → saldo → saída → transferência → reserva → liberação.
- Smoke test real de bloqueio de saldo insuficiente.
- Smoke test real de RBAC.
- Smoke test real de isolamento entre tenants.
- Smoke test real do aplicativo instalado.

Os smoke tests reais e a execução do `.deb` no ambiente do usuário permanecem como validação externa desta fase; a implementação transacional e os contratos de engenharia já estão fechados no código.