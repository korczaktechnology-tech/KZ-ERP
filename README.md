# KORCZAK ERP

Desktop ERP da Korczak Technologies para Linux.

## Estado da arquitetura

O projeto segue o documento mestre **Arquitetura 1.0 — 10/09/2026**. A implementação é incremental por fases F0–F15. F0 é a fundação; ela não significa que todos os módulos do ERP já estejam implementados.

## Stack atual

- Desktop Linux: Tauri 2 + React + TypeScript.
- API: Node.js + Express + TypeScript.
- Persistência atual: MongoDB.
- Banco alvo da Arquitetura 1.0: PostgreSQL; migração registrada em ADR e obrigatória antes do Core/data foundation ser considerado alinhado.
- GitHub: código, CI/CD e Releases.
- Render: hospedagem da API.
- Comunicação desktop/API: HTTPS; o desktop não acessa o banco diretamente.
- Atualização: GitHub Releases + SHA-256 + instalação Debian via `pkexec`.

## Estrutura

```text
KZ-ERP/
├── apps/
│   ├── desktop/       # Tauri + React + TypeScript
│   └── api/           # Node.js + Express + MongoDB (transitório)
├── docs/
│   ├── adr/
│   ├── api/
│   ├── data/
│   ├── events/
│   ├── runbooks/
│   └── security/
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

Cada push em `main` e cada pull request para `main` executa verificação TypeScript, testes e build da API, build do desktop e validação do pacote Linux `.deb`.

O workflow de Release Linux continua responsável por publicar releases em tags `vX.Y.Z`.

## Operação

- `GET /health` valida API e dependência de banco.
- `GET /api/v1/system` expõe versão e namespaces de integração.
- `GET /api/v1/core/me` valida a identidade autenticada.

Para operação e recuperação, consulte `docs/runbooks/development.md` e `docs/release-checklist.md`.

## Primeira conta administrativa

Configure `CORE_BOOTSTRAP_KEY` somente no ambiente do servidor e use `POST /api/v1/auth/bootstrap` uma única vez. O primeiro usuário recebe o papel `owner`.

## Arquitetura

A base arquitetural, contratos e decisões estão em `docs/architecture.md`, `docs/api/openapi.md`, `docs/events/catalog.md`, `docs/data/erd.md` e `docs/adr/`.
