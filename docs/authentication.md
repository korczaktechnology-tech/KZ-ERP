# KORCZAK ERP — Authentication

The CORE authentication lifecycle is server-side and tenant-aware.

## Credentials

- Passwords are never stored in plaintext.
- Passwords use Node.js `scrypt` with a random per-password salt.
- Minimum password length is 10 characters.
- Email addresses are normalized to lowercase.

## Tokens

- Access token: signed HS256 token, 8-hour lifetime.
- Refresh token: 48-byte random secret, stored only as a SHA-256 hash in MongoDB.
- Refresh tokens are rotated on every successful refresh.
- Refresh sessions expire after 30 days and are automatically removed by MongoDB TTL.
- `AUTH_SECRET` must be at least 32 characters and is read server-side.

## Tenant binding

Every authenticated session is bound to both `companyId` and `userId`. Refreshing a session verifies that both the user and company are still active.

Login supports `companySlug`. If the same active email exists in multiple companies and no slug is provided, the API returns `COMPANY_REQUIRED`.

## Lifecycle endpoints

- `POST /api/v1/auth/bootstrap` — first installation only.
- `POST /api/v1/auth/login` — credentials + optional company slug.
- `POST /api/v1/auth/refresh` — rotates a refresh token.
- `POST /api/v1/auth/logout` — revokes a refresh token.
- `POST /api/v1/auth/change-password` — changes the authenticated user's password and revokes all of that user's refresh sessions.

## Security boundary

The desktop application is a client, not an authority. Credentials and tokens are sent to the API over HTTPS. MongoDB credentials and authentication secrets never belong in the desktop application.
