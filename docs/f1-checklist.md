# F1 — Data foundation / Core gate

## Objetivo

Estabelecer a fundação de dados do KZ-ERP com MongoDB como banco vigente, mantendo API-first, multiempresa, isolamento por tenant, índices, validação, auditoria e testes. PostgreSQL permanece como alvo futuro e não é introduzido nesta fase.

## Definition of Done

- [x] MongoDB é a persistência oficial da implementação atual.
- [x] Conexão de banco fica somente no backend.
- [x] Coleções CORE e módulos iniciados são provisionadas automaticamente pelo backend.
- [x] `companyId` é obrigatório no acesso aos dados tenant-scoped.
- [x] Operações de leitura/escrita são protegidas contra cross-tenant access.
- [x] Alteração de `companyId` é bloqueada.
- [x] Índices de tenant e unicidade são criados no startup.
- [x] Modelos TypeScript representam as entidades persistidas.
- [x] Contrato de API padroniza sucesso, erro, requestId e paginação.
- [x] Validação de entrada usa Zod nos endpoints relevantes.
- [x] Auditoria existe para ações administrativas/críticas definidas pelo Core.
- [x] Testes cobrem autenticação, tenant isolation e contratos de dados críticos.
- [x] Nenhum segredo ou URI de banco chega ao desktop.
- [x] Documentação de modelo e ERD descreve a implementação vigente.
- [x] CI executa type-check, testes e builds.
- [x] Recuperação de senha é considerada concluída nesta etapa, limitada à troca/reset administrativo existente; validação por e-mail/telefone fica fora do gate enquanto os canais de verificação não estiverem disponíveis.
- [x] Filiais possuem CRUD real no backend e interface administrativa no Desktop.
- [x] Usuários possuem CRUD/ativação real no backend e interface administrativa no Desktop.
- [x] RBAC/ABAC e auditoria estão expostos na interface administrativa do Desktop.
- [x] O Desktop usa a API real para o Core administrativo, sem acesso direto ao MongoDB.
- [x] Existe harness de verificação operacional real para health, system contract, login, Core, refresh rotation e revogação de sessão.

## Gate para F2

F1 não deve ser considerada concluída apenas pela existência dos arquivos. O gate exige que a implementação atual permaneça compilável/testável e que a CI correspondente ao commit final esteja verde. Funcionalidades de módulos posteriores não devem ser simuladas para satisfazer este checklist. A verificação operacional autenticada precisa ser executada com credenciais de teste reais quando essas credenciais estiverem configuradas no ambiente de execução.

## Decisões e limites

A arquitetura mestre recomenda PostgreSQL, mas a decisão posterior do projeto estabeleceu MongoDB para a implementação atual. A migração para PostgreSQL é uma decisão futura e não faz parte de F1. Integrações externas também permanecem como contratos/namespaces, sem conexões reais nesta fase.
