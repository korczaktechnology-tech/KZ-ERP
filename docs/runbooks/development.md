# Development runbook

## Desktop

```bash
cd apps/desktop
npm install
npm run build
npm run tauri dev
```

The desktop reads `VITE_API_URL` when supplied and otherwise uses the production API URL configured in source.

## API

```bash
cd apps/api
npm install
npm run check
npm test
npm run build
npm run dev
```

Required environment variables are documented in `apps/api/.env.example`. Never commit real credentials.

## First administrator

Set `CORE_BOOTSTRAP_KEY` only on the server and call `POST /api/v1/auth/bootstrap` once. The first account is created as `owner`. Do not put the bootstrap key in source control.

## Release

Tagged `vX.Y.Z` commits trigger the Linux release workflow. The workflow builds the Debian package, validates it with `dpkg-deb`, and publishes the package plus SHA-256 checksums.

## Operational checks

- Liveness/database check: `GET /health`.
- API contract/system metadata: `GET /api/v1/system`.
- Protected identity check: `GET /api/v1/core/me` with a valid bearer token.

## Incident basics

1. Check the health endpoint.
2. Inspect Render logs using the request identifier returned by the API.
3. Check the latest GitHub Actions run and commit SHA.
4. If a release is faulty, stop distributing it and revert/replace the release after identifying the regression.
5. Never debug by exposing tokens, database credentials or personal data in issues or chat.
