# KORCZAK ERP — testes automatizados

## Objetivo

O Passo 14 cria uma base de testes automatizados para impedir regressões no CORE, autenticação e isolamento multiempresa.

## API

Executar em `apps/api`:

```bash
npm run check
npm test
npm run build
```

A suíte atual cobre:

- contrato de paginação da API;
- política mínima de senha;
- hash e verificação de senha;
- assinatura e verificação de access token;
- rejeição de token adulterado;
- isolamento de `companyId` nos filtros tenant-scoped.

## Desktop

Os testes desktop devem permanecer independentes de APIs nativas do Tauri. A suíte inicial valida que o runner está disponível sem tentar abrir uma janela nativa.

## Regra para os próximos módulos

Cada módulo novo deve adicionar testes para:

1. validação de entrada;
2. autorização/RBAC;
3. isolamento entre empresas;
4. criação e atualização de dados;
5. casos de erro e conflitos;
6. contratos de integração quando aplicável.

## Limite atual

A suíte não deve ser considerada cobertura completa de produção ainda. Os fluxos que dependem de MongoDB real e Tauri nativo precisam de testes de integração/E2E dedicados antes do fechamento do Passo 15.
