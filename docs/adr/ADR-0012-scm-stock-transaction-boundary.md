# ADR-0012 — Limite transacional SCM → Stock

## Status

Accepted — transitional modular-monolith decision.

## Contexto

A Arquitetura 1.0 exige fronteiras rígidas entre módulos e proíbe acesso direto à tabela de outro módulo, salvo decisão arquitetural explícita. Ao mesmo tempo, o recebimento de compras precisa garantir atomicidade entre recebimento, pedido de compra, saldo de estoque, movimento, auditoria e outbox.

O KZ-ERP ainda está na implementação MongoDB transitória. Nessa etapa, uma única transação MongoDB permite que o caso de uso de recebimento mantenha essas escritas atômicas.

## Decisão

O SCM pode, temporariamente, escrever `stock_balances` e `stock_movements` dentro do caso de uso transacional de recebimento, sob estas condições:

1. A operação é iniciada exclusivamente pelo caso de uso de recebimento do SCM.
2. Todas as escritas usam o `companyId` do usuário autenticado.
3. O fluxo inteiro permanece dentro de `withMongoTransaction`.
4. O movimento de estoque registra a origem `SCM purchase receipt`.
5. O contrato externo do SCM continua sendo API/evento; outras partes não devem consumir as coleções diretamente.
6. A futura camada `STOCK`/adapter deve assumir essa operação quando a arquitetura migrar para PostgreSQL e separar repositories/application services por módulo.

## Consequência

A decisão preserva a garantia transacional necessária hoje, mas não deve ser interpretada como o desenho final de modularidade. A migração PostgreSQL é o ponto de controle para substituir o acesso direto por uma interface pública de Stock ou comando/evento interno transacional.

## Critério de remoção

Esta exceção deve ser removida quando existir uma operação de Stock formal para `receivePurchase`, capaz de participar da mesma unidade transacional ou de fornecer um mecanismo de integração transacional equivalente.
