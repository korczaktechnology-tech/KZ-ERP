# F2 — Master Data / Cadastros Fundamentais

## Definition of done
F2 is considered implementation-complete when the 27 planned areas have a persisted tenant-scoped data model, API surface, validation, indexes, auditability, security controls, integrity checks, import/export capability where applicable, tests, and integration boundaries for later phases.

## 27-step closure

1. **Produtos** — existing product CRUD retained; tenant isolation, validation, decimal pricing, activation/deactivation and audit are preserved.
2. **Categorias de produtos** — hierarchical CRUD at `/api/v1/master-data/f2/categories` with unique tenant code and parent references.
3. **Marcas** — CRUD at `/api/v1/master-data/f2/brands` with tenant uniqueness and lifecycle.
4. **Unidades de medida** — existing unit CRUD retained and covered by bulk I/O.
5. **Listas de preços** — existing price-list CRUD retained and covered by bulk I/O.
6. **Preços** — existing product-price CRUD retained; bulk I/O supports controlled import/export.
7. **Parceiros** — existing party CRUD retained; addresses deactivate with the party.
8. **Pessoas/contatos** — contacts are modeled separately and linked to a live party; CRUD is tenant-scoped.
9. **Endereços** — existing address model retained and linked to parties; orphan detection added.
10. **Armazéns** — existing warehouse model retained and included in global search and bulk I/O.
11. **Estrutura física do armazém** — hierarchical warehouse locations (zone/aisle/rack/shelf/bin), capacity and parent validation model.
12. **Centros de custo** — existing governance cost-center model remains the authoritative implementation; F2 does not duplicate it.
13. **Estrutura organizacional** — existing governance organization/department/team model remains authoritative; F2 does not duplicate it.
14. **Classificações auxiliares** — typed hierarchical classifications with CRUD and indexes.
15. **Anexos e documentos** — attachment metadata, storage key, checksum and entity binding with lifecycle and audit; binary storage remains externalized by storageKey.
16. **Busca e consulta** — tenant-scoped cross-entity search for products, brands, parties, warehouses and categories; paginated CRUD endpoints are retained.
17. **Relacionamentos** — generic, unique, tenant-scoped typed relationships with metadata and query filters.
18. **Integridade dos dados** — `/integrity` detects orphan addresses, locations, category parents and relationship sources without crossing tenants.
19. **Segurança** — authentication middleware plus `master-data:read` / `master-data:write` permissions; all F2 writes are tenant-scoped and audited.
20. **API** — dedicated `/api/v1/master-data/f2` router with consistent success/error helpers and RESTful CRUD conventions.
21. **Banco de dados** — dedicated MongoDB collections and centralized Portuguese physical collection names.
22. **Índices** — unique tenant keys and lookup indexes for categories, brands, contacts, locations, classifications, attachments and relationships.
23. **Auditoria F2** — create/update/deactivate/delete/import operations write audit records with actor, company, resource and action.
24. **Importação** — bounded JSON bulk import for all primary F2 master entities, validation per record, per-record error reporting and audit event.
25. **Exportação** — tenant-scoped JSON bulk export for all primary F2 master entities with companyId removed from the external representation.
26. **Testes** — F2 contract tests cover route presence, tenant/auth/permission boundaries and safety limits; CI also executes the full API type-check/test/build suite.
27. **Integração com fases seguintes** — F2 data uses the existing `tenantCollection` abstraction and existing module collection names, allowing Sales/Stock/Finance/SCM/Logistics to consume the same tenant-scoped master records without duplicate master-data sources.

## Operational verification
The repository CI is the authoritative compile/test/build gate. Live MongoDB/E2E homologation still requires the deployment environment and test credentials; no secret is stored in the repository.
