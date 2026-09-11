# Contratos de integração

O KORCZAK ERP não executa integrações com outros produtos KZ nesta fase. Os namespaces abaixo existem como pontos de contrato futuros.

## Namespaces

- `CORE` — núcleo corporativo e identidade de integração
- `WMS` — armazém
- `TMS` — transporte
- `CRM` — relacionamento
- `SCM` — compras e suprimentos
- `FINANCE` — financeiro
- `FISCAL` — fiscal
- `PEOPLE` — pessoas
- `SALES` — vendas
- `COMMERCE` — comércio
- `QUALITY` — qualidade
- `MAINTENANCE` — manutenção
- `DOCUMENTS` — documentos
- `ASSETS` — ativos
- `FIELD` — operações de campo
- `SERVICE` — serviços
- `PROJECTS` — projetos

## Regra

Nenhum módulo do ERP importa código de outro produto KZ. Quando uma integração for implementada, ela deverá entrar por um adaptador/contrato isolado, com autenticação, versionamento, idempotência, timeouts, logs e tratamento de falhas.

## F5 — fronteira interna já preparada

O SCM registra eventos críticos em `scm_outbox_events` dentro da mesma transação da mutação de negócio. O worker publica esses eventos em `integration_events`, que funciona como fronteira durável do modular-monolith. A publicação é idempotente por `sourceEventId`, possui retry com backoff e dead-letter.

Essa publicação interna **não é uma integração externa**. Ela existe para que futuras integrações não precisem acessar tabelas/coleções privadas do SCM.

Exemplo de caminho lógico futuro:

```text
ERP/SCM → Integration Gateway → CORE
ERP/SCM → Integration Gateway → WMS
ERP/SCM → Integration Gateway → TMS
ERP/SCM → Integration Gateway → FINANCE
```

As conexões externas permanecem para fases posteriores.
