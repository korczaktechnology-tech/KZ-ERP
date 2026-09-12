# F1 — Multi-tenancy

## Modelo oficial

No KZ-ERP, Company (empresa) e a unidade de tenant do runtime atual. `companyId` e o UUID publico que representa a fronteira de isolamento de dados, autorizacao, sessao, auditoria e integracoes.

Nao existe uma segunda colecao `tenants`. Isso evita duplicar a identidade empresarial no modelo atual. Se o KOS futuramente precisar de uma organizacao agrupando varias empresas juridicas, uma camada de organizacao podera ser introduzida acima de `companyId` sem quebrar os contratos existentes.

## Regras

1. Todo recurso tenant-scoped possui `companyId`.
2. Operacoes autenticadas usam o `companyId` da sessao, nunca um valor confiado do cliente.
3. O tenant guard rejeita `companyId` conflitante em body, query ou params.
4. IDs publicos sao UUIDs e nao concedem acesso fora do tenant.
5. `companyId` e imutavel em recursos tenant-scoped.
6. Sessoes sao vinculadas a usuario e empresa.
7. Usuario e empresa precisam estar ativos.
8. Indices de unicidade por empresa incluem `companyId`.
9. Auditoria tenant-scoped inclui `companyId`.
10. Nenhuma operacao pode trocar de tenant pela requisicao.

## Provisionamento

`POST /api/v1/auth/provision-tenant` cria atomicamente empresa/tenant, owner, filial matriz, sessao inicial e auditoria. Exige sessao autenticada e `CORE_TENANT_PROVISIONING_KEY`. A criacao usa transacao MongoDB; falha em qualquer etapa causa rollback.

Slug do tenant e globalmente unico. Codigo de filial e unico dentro do tenant. O mesmo e-mail pode existir em empresas diferentes porque a unicidade e `(companyId, email)`.

## Bootstrap

`/auth/bootstrap` inicializa somente a primeira instalacao. Novos tenants usam o fluxo de provisionamento administrativo.

## Criterio

A camada multi-tenant esta estruturalmente completa quando autenticacao estabelece o tenant, operacoes usam o tenant autenticado, conflitos sao bloqueados, novos tenants sao provisionados atomicamente, filiais sao isoladas, sessoes nao atravessam tenants, auditoria permanece no tenant e o CI valida os testes e builds.
