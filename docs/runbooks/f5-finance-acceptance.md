# F5 — Runbook de aceite do Financeiro

## Pré-condições

- API disponível em ambiente configurado.
- MongoDB conectado ao banco `ERP`.
- Usuário autenticado no tenant de teste.
- Pelo menos uma conta com permissão `finance:write` e outra com somente `finance:read`.

## Fluxo 1 — receber

1. Abrir **Financeiro**.
2. Criar lançamento **A receber** com descrição, valor e vencimento.
3. Confirmar que aparece na lista como `aberto`.
4. Abrir o detalhe e alterar descrição/valor/vencimento.
5. Confirmar persistência após atualizar a tela.
6. Baixar o lançamento.
7. Confirmar status `pago` e data de pagamento.
8. Confirmar que edição e nova baixa são recusadas.

## Fluxo 2 — pagar

1. Criar lançamento **A pagar**.
2. Confirmar `aberto`.
3. Cancelar.
4. Confirmar status `cancelado`.
5. Confirmar que não pode ser editado ou baixado depois do cancelamento.

## Fluxo 3 — precisão e idempotência

- Usar valores com duas casas, incluindo valores altos.
- Repetir a criação com a mesma `Idempotency-Key`.
- Confirmar que somente um lançamento é criado.
- Reutilizar a mesma chave com payload diferente e confirmar `409 CONFLICT`.

## Fluxo 4 — segurança

- Usuário `user`/`viewer`: leitura permitida, escrita recusada.
- Usuário de empresa A não pode consultar, editar, baixar ou cancelar lançamento da empresa B.

## Evidências automatizáveis

- `npm run check` na API.
- `npm test` na API.
- build da API.
- type check/build do desktop.
- validação do `.deb`.
- release Linux.

## Limite do aceite automatizado

A instalação e execução física do `.deb`, bem como os fluxos completos com uma conta real, permanecem testes externos no ambiente do usuário.
