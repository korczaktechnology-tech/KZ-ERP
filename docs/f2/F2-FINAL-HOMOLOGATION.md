# F2 — Homologação Final

## Resultado

A F2 foi endurecida e homologada no estado atual da `main` para os critérios de domínio, segurança, multi-tenancy, validação, integridade, busca, importação/exportação, auditoria, índices e integração MongoDB.

## 14 etapas executadas

1. **Correção de compilação:** normalização dos parâmetros de rota e remoção do roteador duplicado obsoleto.
2. **Hierarquia física:** ordem semântica `zone → aisle → rack → shelf → bin` e validação do pai.
3. **Ciclos e isolamento de armazém:** bloqueio de ciclos indiretos, auto-parenting e pais de outro armazém.
4. **Anexos:** validação do alvo e ciclo real de arquivo com MongoDB GridFS, download e exclusão.
5. **Relacionamentos:** validação dos dois lados, tenant e unicidade do relacionamento.
6. **Integridade:** detecção de órfãos, ciclos, hierarquia inválida, unidades/preços inválidos, anexos e relacionamentos inválidos.
7. **Busca:** produtos, parceiros, marcas, categorias, unidades, listas, preços, contatos, classificações, localizações e endereços.
8. **Importação:** limite de 1000 registros, schemas, referências cruzadas e hierarquia.
9. **Exportação:** cobertura de todos os principais cadastros F2 e auditoria da operação.
10. **Auditoria:** mutações, importações, exportações e ciclo de anexos registrados.
11. **Validação centralizada:** referências e regras de importação concentradas em `f2-hardening.ts`.
12. **Banco e índices:** índices únicos por tenant, índices hierárquicos e smoke real contra MongoDB.
13. **Segurança e testes:** autenticação, RBAC, tenant boundary, contratos F2 e testes unitários.
14. **Homologação final:** type check, testes, build, MongoDB real, desktop build e pipeline de integração.

## Evidências do CI

No run `34779993627`:

- API type check: **PASS**
- API unit tests: **PASS** — 66 testes, 66 aprovados no último run de homologação
- API production build: **PASS**
- Desktop build: **PASS**
- MongoDB configuration validation: **PASS**
- F2 real MongoDB integration: **PASS**
- F2 operational API smoke: **não executado**, porque os segredos de E2E não estão configurados no GitHub Actions

O smoke de MongoDB foi executado contra um MongoDB real em container e validou criação de índices, unicidade e persistência F2.

## Observação sobre E2E de produção

A ausência de credenciais de E2E não representa uma falha de implementação F2. O pipeline foi configurado para executar o smoke operacional automaticamente assim que `KZ_ERP_E2E_EMAIL` e `KZ_ERP_E2E_PASSWORD` forem disponibilizados como secrets do repositório.
