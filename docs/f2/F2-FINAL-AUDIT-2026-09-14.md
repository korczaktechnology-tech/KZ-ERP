# F2 — Auditoria final de implementação

Data: 14/09/2026

## Escopo

A F2 cobre dados mestres e seus serviços transversais: produtos, categorias, marcas, unidades, listas de preços, preços, parceiros, endereços, contatos, armazéns, localização física, classificações, anexos, relacionamentos, busca, integridade, importação, exportação, auditoria, segurança e integração com o Desktop. Centros de custo e estrutura organizacional permanecem nas entidades Core existentes e são expostos pelo Desktop dentro da superfície F2.

## Implementado

- CRUD F2 com isolamento por tenant e RBAC.
- Hierarquia de categorias/classificações com detecção de ciclos.
- Hierarquia física de armazém com ordem zone → aisle → rack → shelf → bin, mesma unidade de armazém e prevenção de ciclos.
- Referências entre entidades com validação antes de gravação/importação.
- Registry central de entidades F2, incluindo referências para cost_center e org_unit.
- Anexos externos e anexos gerenciados por GridFS, com upload, download, remoção do binário e auditoria.
- Proteção contra remoção incorreta de anexos gerenciados.
- Importação em lote com validação, dependências, IDs, ciclos e rollback dos registros inseridos quando o lote falha.
- Exportação JSON com envelope versionado (`schemaVersion`).
- Busca global F2.
- Scanner de integridade incluindo referências quebradas, hierarquias, anexos binários e órfãos de GridFS.
- Auditoria das operações F2 relevantes.
- Índices de unicidade e suporte de consulta para as coleções F2.
- Smoke real contra MongoDB.
- Smoke operacional autenticado.
- Desktop integrado às entidades F2 e às entidades Core de centros de custo/estrutura organizacional, sem depender de mocks para CRUD.
- Desktop integrado a busca, integridade, auditoria, importação/exportação e upload de anexos.

## Validação automatizada

O CI contém jobs separados para API, Mongo smoke, Desktop/Tauri e E2E operacional. O E2E possui fallback para API local isolada + Mongo de CI quando as credenciais remotas não estão configuradas.

O smoke operacional cobre login, criação, atualização, desativação, referências, hierarquia inválida, busca, integridade, exportação, importação e rollback de importação.

## Estado de verificação

A implementação foi atualizada no branch `main`. A execução mais recente do workflow precisa terminar antes de marcar o gate final como verde. Portanto, este documento distingue implementação concluída de verificação CI concluída e não declara aprovação final enquanto o workflow estiver pendente.

## Itens que não são bloqueio de código

- Execução de E2E contra produção depende das credenciais externas configuradas no repositório. O CI possui fallback local determinístico para não bloquear a validação automática por esse motivo.
- Qualquer decisão comercial ou política interna que altere regras de domínio precisa ser fornecida pelo responsável pelo produto; não é uma lacuna técnica da implementação.
