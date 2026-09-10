# Runbook de aceitação — F2 Dados mestre

## Pré-requisitos

- API com `MONGODB_URI`, `AUTH_SECRET`, `CORE_BOOTSTRAP_KEY` e `CORS_ORIGIN` configurados.
- Banco vazio para o primeiro bootstrap ou tenant já provisionado.
- Um usuário owner e um usuário com papel manager/user para validar RBAC.

## Fluxo crítico

1. Autenticar um owner.
2. Criar uma Party `company` com papel `customer`.
3. Criar endereço de cobrança e endereço de entrega para a Party.
4. Criar uma unidade `unit`.
5. Criar um produto com SKU único.
6. Criar uma tabela de preços em BRL.
7. Inserir preço do produto usando uma string decimal, por exemplo `19.90`.
8. Consultar a tabela e verificar que o preço retorna `19.90` sem conversão para double.
9. Alterar e desativar registros.
10. Conferir os eventos correspondentes em `/api/v1/core/audit`.

## RBAC

- owner/admin/manager: leitura e escrita de F2.
- user/viewer: leitura de F2, sem escrita.
- Sem autenticação: 401.

## Tenant isolation

Criar o mesmo `code` em dois tenants diferentes deve ser permitido. Consultar os mestres de um tenant autenticado nunca pode retornar registros do outro.

## Duplicidade

Dentro do mesmo tenant, validar conflitos em:

- party code;
- product SKU;
- unit code;
- price-list code;
- combinação price-list + product;
- party + tipo + código do endereço.

O resultado esperado é HTTP 409 pelo middleware de conflito do Core.

## Segurança de preço

Os valores monetários da entidade `prices` são BSON Decimal128. O MongoDB documenta Decimal128 como o tipo indicado quando precisão decimal e arredondamento importam, especialmente em dados monetários.

## Evidências obrigatórias

- saída de `npm run check`;
- saída de `npm test`;
- saída de `npm run build`;
- execução do CI completo;
- respostas HTTP do smoke test;
- confirmação de isolamento de tenant;
- confirmação de RBAC;
- pacote `.deb` gerado pelo CI.
