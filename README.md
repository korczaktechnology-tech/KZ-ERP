# KORCZAK ERP

Desktop ERP da Korczak Technologies para Linux.

## Diretrizes atuais

- Desktop Linux como primeira plataforma.
- MongoDB como banco de dados.
- GitHub como repositório, CI/CD e Releases.
- Render como hospedagem da API.
- Nenhuma integração real com outros produtos KZ nesta fase.
- Contratos de integração ficam preparados por namespaces: `CORE`, `WMS`, `TMS`, `CRM`, `FINANCE`, `FISCAL`, etc.
- Atualização automática do aplicativo via GitHub Releases.
- Arquitetura modular, API-first e preparada para crescimento.

## Estrutura

```text
KZ-ERP/
├── apps/
│   ├── desktop/    # Tauri + React + TypeScript
│   └── api/        # Node.js + Express + MongoDB
├── docs/
├── packages/
└── .github/workflows/
```

## Desenvolvimento

### Desktop

```bash
cd apps/desktop
npm install
npm run tauri dev
```

### API

```bash
cd apps/api
npm install
npm run dev
```

Variáveis da API:

```env
PORT=10000
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=kz_erp
CORS_ORIGIN=http://localhost:1420
```

## Atualização

O aplicativo consulta a Release mais recente de `korczaktechnology-tech/KZ-ERP`, compara a versão instalada com a tag da release e, quando existe versão mais nova compatível, baixa o AppImage publicado e realiza a substituição automática após validar o SHA-256.

A atualização é projetada para instalações por usuário em Linux. Instalações em diretórios protegidos pelo sistema exigem permissões adequadas.
