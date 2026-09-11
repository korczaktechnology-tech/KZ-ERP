# F6 — Finance

## Objetivo

Entregar a base financeira do KORCZAK ERP com contas a receber, contas a pagar, contas financeiras, categorias, pagamentos, transferências, saldo em aberto, vencidos, auditoria, RBAC e idempotência.

## Entidades

- `financial_entries`: títulos a receber/pagar.
- `finance_payments`: liquidações integrais ou parciais dos títulos.
- `finance_accounts`: caixa, banco, carteira e cartão.
- `finance_categories`: classificação de receitas e despesas.
- `finance_transfers`: transferências entre contas financeiras.

## Regras

1. Valores monetários são armazenados como MongoDB `Decimal128` e agregados em centavos inteiros.
2. Todo recurso é tenant-scoped por `companyId`.
3. Operações de escrita exigem `finance:write`; leitura exige `finance:read`.
4. Criação de recursos suporta `Idempotency-Key` UUID.
5. Um título aberto pode receber pagamentos parciais; ele só passa a `paid` quando o valor pago atingir o valor total.
6. Um pagamento que exceda o saldo pendente é rejeitado.
7. Transferências exigem contas distintas e a mesma moeda.
8. Alteração/cancelamento/liquidação gera evidência de auditoria.

## API

Base: `/api/v1/finance`

- `GET /entries`
- `GET /entries/:id`
- `POST /entries`
- `PATCH /entries/:id`
- `POST /entries/:id/pay`
- `POST /entries/:id/cancel`
- `GET /summary`
- `GET /accounts`
- `POST /accounts`
- `GET /categories`
- `POST /categories`
- `POST /payments`
- `POST /transfers`

## Integrações

F6 não acessa tabelas privadas de outros módulos. SCM e Sales devem solicitar efeitos financeiros através de contratos/eventos versionados. A integração externa definitiva fica para CONNECT/KOS.

## Estado de validação

A implementação de código e contratos é realizada no repositório. Os testes reais de ambiente e os cenários E2E de aceite continuam sendo validação operacional, não são considerados concluídos apenas por compilação.
