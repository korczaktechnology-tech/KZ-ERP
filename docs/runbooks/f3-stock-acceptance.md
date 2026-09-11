# Runbook de aceitação — F3 Estoque

## Pré-requisitos

- API configurada com MongoDB, autenticação e CORS.
- Um tenant provisionado.
- Usuário owner/admin/manager para escrita e user/viewer para leitura.
- Pelo menos um produto e um depósito ativos.

## Fluxo crítico

1. Autenticar como operador com escrita.
2. Consultar `/api/v1/stock/warehouses`.
3. Registrar entrada de 100 unidades em um produto/depósito.
4. Consultar `/api/v1/stock/balances` e confirmar quantidade `100`.
5. Registrar saída de 25.
6. Confirmar quantidade `75` e disponibilidade `75`.
7. Tentar saída de 100 e confirmar HTTP 409 sem alteração do saldo.
8. Criar um segundo depósito.
9. Transferir 20 unidades para o segundo depósito.
10. Confirmar origem `55` e destino `20`.
11. Criar reserva de 10 no destino.
12. Confirmar físico `20`, reservado `10` e disponível `10`.
13. Tentar reservar 11 e confirmar HTTP 409 sem aumento de reservado.
14. Liberar a reserva e confirmar disponível `20`.
15. Definir estoque mínimo e confirmar o indicador de estoque baixo quando aplicável.
16. Consultar movimentações e auditoria.

## RBAC

- owner/admin/manager: leitura e escrita de estoque.
- user/viewer: leitura de estoque, sem escrita.
- sem autenticação: 401.

## Tenant isolation

Criar saldos e movimentações em dois tenants diferentes e confirmar que cada sessão só enxerga seus próprios registros. Um identificador de produto ou depósito de outro tenant não pode ser usado para movimentar o estoque do tenant autenticado.

## Precisão

Usar quantidades como strings decimais, por exemplo `19.900000`. Não usar vírgula, sinal negativo direto no campo de quantidade ou mais de seis casas decimais. A direção de redução é expressa pelo tipo da operação/direção do ajuste.

## Evidências obrigatórias

- `npm run check` da API;
- `npm test` da API;
- `npm run build` da API;
- type check/build do desktop;
- validação do `.deb` no CI;
- smoke test HTTP do fluxo crítico;
- smoke test de RBAC;
- smoke test de tenant isolation;
- teste externo do `.deb` e do atualizador.
