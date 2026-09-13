# KORCZAK ERP

Desktop ERP da Korczak Technologies para Linux.

## Estado da arquitetura

O projeto segue o documento mestre **Arquitetura 1.0 — 10/09/2026**. A implementação é incremental por fases F0–F15. F0 é a fundação; ela não significa que todos os módulos do ERP já estejam implementados.

## Stack atual

- Desktop Linux: Tauri 2 + React + TypeScript.
- API: Node.js + Express + TypeScript.
- Persistência oficial: MongoDB.
- Database padrão do ambiente: `ERP`.
- O desktop nunca acessa o banco diretamente; toda comunicação passa pela API HTTPS.
- GitHub: código, CI/CD e Releases.
- Render: hospedagem da API.
- Atualização: GitHub Releases + SHA-256 + instalação Debian via `pkexec`.

## Estrutura

```text
KZ-ERP/
├── apps/
│   ├── desktop/       # Tauri + React + TypeScript
│   └── api/           # Node.js + Express + TypeScript + MongoDB
├── docs/
│   ├── adr/
│   ├── api/
│   ├── data/
│   ├── events/
│   └── runbooks/
├── .github/workflows/
├── CONTRIBUTING.md
└── CHANGELOG.md
```

## Desenvolvimento

### Desktop

```bash
cd apps/desktop
npm install
npm run build
npm run tauri dev
```

### API

```bash
cd apps/api
npm install
npm run check
npm test
npm run build
npm run dev
```

Variáveis da API ficam em `apps/api/.env.example`. Nunca coloque valores reais de secrets no Git.

## CI

Cada push em `main` e cada pull request para `main` executa verificação TypeScript, testes e build da API, build do desktop, validação do pacote Linux `.deb`, validação da configuração MongoDB e validação da infraestrutura.

O workflow de Release Linux pode ser executado manualmente ou por um push em `main` cuja mensagem contenha `[release]`. O pipeline cria a Release em draft, publica somente após validar os três assets e executa um smoke test de download.

## Operação

- `GET /health` valida API e dependência de banco.
- `GET /health/live` valida disponibilidade do processo.
- `GET /health/ready` valida disponibilidade da API e MongoDB.
- `GET /api/v1/system` expõe versão e namespaces de integração.
- `GET /api/v1/core/me` valida a identidade autenticada.

Para operação e recuperação, consulte `docs/runbooks/development.md` e `docs/release-checklist.md`.

## Primeira conta administrativa

Configure `CORE_BOOTSTRAP_KEY` somente no ambiente do servidor e use `POST /api/v1/auth/bootstrap` uma única vez. O primeiro usuário recebe o papel `owner`.

## Arquitetura

A base arquitetural, contratos e decisões estão em `docs/architecture.md`, `docs/api/openapi.md`, `docs/events/catalog.md`, `docs/data/erd.md` e `docs/adr/`.

### Banco de dados — decisão definitiva

O KORCZAK ERP utiliza **MongoDB como banco oficial**. PostgreSQL não faz parte da stack, da infraestrutura, do CI/CD, das variáveis de ambiente ou do runtime do produto. Novos módulos devem seguir os padrões MongoDB já estabelecidos: `companyId` para isolamento de tenant, índices por tenant, transações quando necessárias e contratos de persistência centralizados em `apps/api/src/core/db.ts`.
