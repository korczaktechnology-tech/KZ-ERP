# F2 — Dados mestre

## Escopo

F2 entrega o núcleo de dados mestre do KORCZAK ERP: parties, produtos, endereços, unidades e preços. A implementação mantém MongoDB, tenant isolation, RBAC, auditoria e API versionada já estabelecidos no Core.

## Entregas

- [x] Party unificado com tipo pessoa/empresa e múltiplos papéis.
- [x] CRUD de parties com desativação lógica.
- [x] Endereços vinculados a party, com tipos e desativação lógica.
- [x] CRUD de produtos com SKU único por tenant.
- [x] CRUD de unidades de medida.
- [x] Tabelas de preço por tenant.
- [x] Preços por produto/tabela usando BSON Decimal128.
- [x] Quantidade mínima por preço.
- [x] Índices de unicidade e consulta por tenant.
- [x] Permissões `master-data:read` e `master-data:write`.
- [x] Auditoria de criação, alteração e desativação dos mestres.
- [x] Compatibilidade dos cadastros antigos de customers/suppliers/warehouses usados pela tela atual.
- [x] Contratos HTTP sob `/api/v1/master-data`.

## Regras

1. Nenhuma consulta de F2 pode sair do `companyId` autenticado.
2. Escrita exige `master-data:write`; leitura exige `master-data:read`.
3. Exclusão é lógica nos mestres operacionais.
4. Preços são armazenados como `Decimal128`, evitando erro de ponto flutuante para valores monetários.
5. IDs públicos são UUIDs.
6. Datas são persistidas como `Date` e representam instantes em UTC.
7. Duplicidades devem resultar em erro HTTP padronizado pelo middleware existente.

## Critério de passagem

- Type check verde.
- Testes unitários verdes.
- Build da API verde.
- Desktop continua compilando.
- CI completo verde, incluindo pacote `.deb`.
- Smoke test real de bootstrap → party → endereço → produto → unidade → tabela de preço → preço.
- Smoke test de isolamento entre dois tenants.
- Smoke test de RBAC para leitura/escrita.
- Documentação de API atualizada.

## Observação

A arquitetura mestre descreve PostgreSQL, mas a decisão vigente do projeto é MongoDB. Esta fase não migra o banco. A escolha do MongoDB deve permanecer explícita nos ADRs e documentação operacional.
