# F5 — SCM / Compras e Suprimentos

Este checklist complementa a arquitetura 1.0, na qual F5 é o módulo de SCM. O antigo `docs/f5-checklist.md` permanece preservado por compatibilidade histórica com a numeração anterior do projeto.

## Entregas implementadas

- [x] Requisições de compra com ciclo de vida explícito.
- [x] Cotações por fornecedor.
- [x] Aceite/rejeição de cotação.
- [x] Pedido de compra.
- [x] Aprovação e emissão do pedido.
- [x] Recebimento parcial e total.
- [x] Atualização transacional do saldo de estoque no recebimento.
- [x] Movimentação de estoque vinculada ao recebimento.
- [x] Tenant isolation por `companyId`.
- [x] RBAC `scm:read` / `scm:write`.
- [x] Idempotência nas criações com `Idempotency-Key`.
- [x] Rejeição de reutilização de chave com payload diferente.
- [x] Precisão de quantidade em até 6 casas decimais.
- [x] Precisão monetária em até 2 casas decimais.
- [x] Proteção contra linhas duplicadas.
- [x] Proteção contra recebimento acima do pedido.
- [x] Proteção contra transições de estado inválidas.
- [x] Auditoria das mutações críticas.
- [x] Eventos críticos persistidos via transactional outbox.
- [x] Envelope de evento versionável com `schemaVersion` e `correlationId`.
- [x] Worker de publicação durável.
- [x] Retry com backoff exponencial.
- [x] Dead-letter após tentativas máximas.
- [x] Recuperação de leases de eventos presos em `processing`.
- [x] Publicação idempotente por `sourceEventId`.
- [x] Consulta operacional paginada da outbox.
- [x] Replay controlado de eventos `dead_letter`.
- [x] Auditoria de replay da outbox.
- [x] Limites e índices tenant-scoped nas coleções SCM.

## Limites conscientes

- [ ] Validação física/E2E com banco real e ambiente de execução: depende da execução guiada pelo usuário.
- [ ] Teste de carga/concor­rência em ambiente real: depende de execução externa.
- [ ] Integração externa com KORCZAK CONNECT/WMS/TMS/FINANCE: não faz parte desta fase; o contrato interno `integration_events` está preparado para isso.
- [ ] Migração definitiva de MongoDB para PostgreSQL: requisito arquitetural transversal do projeto, não é resolvido apenas dentro do SCM.
- [ ] Broker externo/fila gerenciada: a implementação atual usa publicação durável interna, mantendo a fronteira para um adapter futuro de CONNECT.

## Critério técnico antes da validação externa

O código deve manter type check, testes automatizados e build verdes. A validação externa não deve ser substituída por testes falsos ou mocks que afirmem sucesso sem executar o fluxo real.
