# F5 — Financeiro

## Escopo

F5 entrega o primeiro núcleo financeiro do KORCZAK ERP: contas a receber e a pagar, com lançamento, consulta, edição controlada, baixa, cancelamento, vencimento, resumo operacional, tenant isolation, RBAC, idempotência e auditoria.

## Entregas

- [x] Consulta paginada de lançamentos.
- [x] Filtro por tipo e status.
- [x] Detalhe de lançamento.
- [x] Criação de contas a receber e a pagar.
- [x] Valores monetários persistidos como `Decimal128`.
- [x] Vencimento persistido como data.
- [x] Referência opcional para rastreabilidade futura.
- [x] Edição somente enquanto o lançamento estiver `open`.
- [x] Baixa de lançamento como `paid`.
- [x] Cancelamento de lançamento.
- [x] Idempotência na criação por `Idempotency-Key`.
- [x] Resumo de valores em aberto e vencidos.
- [x] RBAC `finance:read` / `finance:write`.
- [x] Tenant isolation em todas as operações.
- [x] Auditoria de criação, alteração, baixa e cancelamento.
- [x] Interface desktop real ligada à API.
- [x] Sem dados fictícios ou operações simuladas.

## Regras de negócio

1. O lançamento nasce como `open`.
2. Somente lançamentos `open` podem ser editados.
3. Somente lançamentos `open` podem ser baixados ou cancelados.
4. Um lançamento `paid` não volta para `open`.
5. Um lançamento `cancelled` não volta para `open`.
6. O valor deve ser positivo e ter no máximo duas casas decimais.
7. Valores financeiros não são persistidos como `number`; usam `Decimal128`.
8. A mesma `Idempotency-Key` repetida para a mesma operação retorna o mesmo lançamento; reutilização para outra operação é rejeitada.
9. Toda consulta e mutação é limitada ao `companyId` do usuário autenticado.
10. Nenhum acesso do desktop ao MongoDB é permitido.

## Critério de passagem

- API type check verde.
- Testes unitários verdes.
- Build da API verde.
- Type check/build do desktop verde.
- Pacote `.deb` validado.
- Release Linux verde.
- Smoke test real: criar conta a receber → consultar → editar → baixar.
- Smoke test real: criar conta a pagar → consultar → cancelar.
- Smoke test real: impedir edição de lançamento pago/cancelado.
- Smoke test real: RBAC de leitura/escrita.
- Smoke test real: isolamento entre tenants.
- Smoke test real: repetição da mesma `Idempotency-Key` sem duplicação.
- Smoke test real do aplicativo instalado.

Os testes físicos no ambiente do usuário continuam sendo validação externa; a engenharia deve deixar todos os testes automatizáveis verdes antes disso.
