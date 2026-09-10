# Contratos de integração

O KORCZAK ERP não executa integrações com outros produtos KZ nesta fase. Os namespaces abaixo existem apenas como pontos de contrato futuros.

## Namespaces

- `CORE` — núcleo corporativo e identidade de integração
- `WMS` — armazém
- `TMS` — transporte
- `CRM` — relacionamento
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

Exemplo de caminho lógico:

```text
ERP → Integration Gateway → CORE
ERP → Integration Gateway → WMS
ERP → Integration Gateway → TMS
```

Os contratos são preparados agora; as conexões reais ficam para uma fase posterior.
