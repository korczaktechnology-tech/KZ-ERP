# F6 — Financeiro

O checklist financeiro canônico foi movido para o nome alinhado ao roadmap da Arquitetura 1.0. `docs/f5-checklist.md` permanece como alias histórico para compatibilidade.

## Entregas

- [x] Consulta paginada de lançamentos.
- [x] Filtro por tipo e status.
- [x] Detalhe de lançamento.
- [x] Criação de contas a receber e a pagar.
- [x] Valores monetários persistidos como `Decimal128`.
- [x] Vencimento persistido como data.
- [x] Edição controlada de lançamentos abertos.
- [x] Baixa de lançamento.
- [x] Cancelamento de lançamento.
- [x] Idempotência na criação.
- [x] Resumo de valores em aberto e vencidos.
- [x] RBAC `finance:read` / `finance:write`.
- [x] Tenant isolation.
- [x] Auditoria das mutações.
- [x] Interface desktop ligada à API.
- [x] Sem dados fictícios ou operações simuladas.

## Validação externa pendente

Smoke/E2E físico com banco e aplicativo instalados, incluindo RBAC, isolamento entre tenants e idempotência, deve ser executado no ambiente real do projeto.
