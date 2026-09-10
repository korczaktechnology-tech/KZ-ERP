# Deploy inicial

## 1. MongoDB

Crie um cluster MongoDB gratuito e gere uma URI de conexão. O valor nunca entra no Git; será configurado como `MONGODB_URI` no Render.

## 2. Render

Crie um Web Service a partir do repositório `korczaktechnology-tech/KZ-ERP` usando `render.yaml`.

Variáveis obrigatórias:

- `MONGODB_URI`
- `MONGODB_DB=kz_erp`
- `CORS_ORIGIN=*` na fase inicial ou uma lista de origens controladas posteriormente
- `GITHUB_TOKEN` com somente leitura de Contents para o repositório, usado exclusivamente para consultar Releases e baixar assets privados

## 3. Releases

O fluxo de publicação é baseado em tags semânticas:

```text
git tag v0.1.0
git push origin v0.1.0
```

O GitHub Actions compila o desktop Linux, publica AppImage/DEB e envia `SHA256SUMS.txt` para a Release.

## 4. Atualização do desktop

Ao iniciar:

```text
Desktop
  ↓
Render /api/v1/updates/latest
  ↓
Render consulta GitHub Releases
  ↓
versão nova?
  ↓ sim
asset AppImage + SHA-256
  ↓
download
  ↓
SHA-256 validado localmente
  ↓
substituição do AppImage
  ↓
reinício
```

O token do GitHub nunca é distribuído no aplicativo desktop.
