# Contributing to KORCZAK ERP

## Before changing code

- Read `docs/architecture.md` and the relevant ADR.
- Keep changes focused and reversible.
- Do not commit secrets or real customer data.

## Local validation

API:

```bash
cd apps/api
npm run check
npm test
npm run build
```

Desktop:

```bash
cd apps/desktop
npm run build
```

For Linux packaging, use `npm run tauri build -- --bundles deb` from `apps/desktop` on a system with the Tauri Linux dependencies installed.

## Pull requests

A PR should explain the behavior changed, tests executed and any architectural decision required. A failing CI check blocks merge.

## Definition of done

Code is not complete merely because it compiles. Critical paths require tests, API contracts, authorization, error handling, observability and documentation appropriate to the phase.
