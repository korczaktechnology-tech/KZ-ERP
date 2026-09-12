# F1 — Multi-tenancy / Empresa

## Objetivo

A F1 estabelece a fronteira empresarial do KZ-ERP. O `companyId` do contexto autenticado é a chave de isolamento do tenant em MongoDB. Recursos de negócio devem sempre ser consultados e modificados dentro desse contexto; IDs fornecidos pelo cliente não podem trocar o tenant da operação.

## Garantias implementadas

- `companyId` é derivado da identidade autenticada e não do payload do cliente.
- `tenantFilter(companyId, filter)` sempre força o `companyId` do contexto.
- `tenantCollection` aplica o tenant automaticamente a leitura, inserção, atualização e exclusão.
- `tenantCollection` rejeita tentativas de alterar `companyId` em qualquer nível do update.
- Sessões ativas são vinculadas simultaneamente a usuário e empresa.
- O middleware de sessão valida `companyId`, `userId`, `accessJti` e expiração.
- Empresa inativa invalida o acesso operacional.
- Usuários são únicos por `(companyId, email)`.
- Branches são isoladas por `(companyId, ...)` e código único por empresa.
- Todas as operações de branch verificam `companyId` no filtro.
- Operações de branch geram auditoria com `companyId` e ator.
- Uma empresa não pode ficar sem sua última branch ativa durante desativação.

## API da fronteira

- `GET /api/v1/core/tenant`
- `GET /api/v1/core/branches`
- `GET /api/v1/core/branches/:id`
- `POST /api/v1/core/branches`
- `PATCH /api/v1/core/branches/:id`
- `DELETE /api/v1/core/branches/:id` — desativação lógica; não remove dados.

## Regras

1. Nunca aceitar `companyId` do corpo para definir o tenant.
2. Toda query de dado empresarial deve conter o tenant do contexto autenticado.
3. Toda mutação deve manter o `companyId` imutável.
4. Índices únicos de dados tenant-scoped devem incluir `companyId`.
5. Acesso a tenant inativo deve ser recusado.
6. Branches de outro tenant devem se comportar como inexistentes para o usuário atual.
7. O backend é a autoridade final; a interface não é uma fronteira de segurança.

## Validação

A suíte inclui testes explícitos de precedência do tenant, rejeição de contexto vazio e bloqueio de mutação de `companyId`. A validação de build/testes deve permanecer no CI antes de declarar a fase global como aprovada.
