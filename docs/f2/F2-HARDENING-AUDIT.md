# F2 — Hardening audit

## Correções aplicadas

1. Hierarquia física de armazéns: `zone → aisle → rack → shelf → bin`.
2. Prevenção de auto-referência e ciclos indiretos em categorias, classificações e localizações.
3. Localização pai deve pertencer ao mesmo armazém.
4. Anexos exigem `entityType/entityId` apontando para uma entidade F2 suportada e existente.
5. Relacionamentos validam origem e destino contra uma lista de entidades suportadas.
6. Integridade passou a detectar órfãos, ciclos, referências de preço, anexos e relacionamentos inválidos.
7. Busca F2 cobre produtos, marcas, parceiros, armazéns, categorias, unidades, listas de preço, contatos, classificações e localizações.
8. Exportações geram evento de auditoria.
9. Importações limitadas a 1000 registros e com validação de referências.
10. Regras de referência foram centralizadas em `f2-hardening.ts`.
11. Índices F2 permanecem tenant-scoped e foram reforçados para relações.
12. Foram adicionados testes unitários para hierarquia e detecção de ciclos.

## Critério de fechamento

A F2 só deve ser considerada operacionalmente homologada quando o CI estiver verde em todos os jobs e o smoke/E2E com MongoDB real confirmar os fluxos de criação, alteração, busca, integridade, importação e exportação.
