# F1 Core — acceptance runbook

This is the final human verification layer after automated CI. It deliberately uses the real MongoDB/Render environment and does not require secrets to be pasted into chat.

## 1. API automated gate

The final `main` commit must have the CI workflow green for:

- API type-check;
- API unit tests;
- API production build;
- desktop build;
- Linux `.deb` package build and package validation.

A cancelled or pending workflow is not a green result.

## 2. Real API/Core smoke test

With the Render environment configured with `MONGODB_URI`, `MONGODB_DB`, `AUTH_SECRET` and `CORE_BOOTSTRAP_KEY`:

1. `GET /health/live` returns 200.
2. `GET /health/ready` returns 200 and reports `database: ok`.
3. First bootstrap creates exactly one company and one owner.
4. A second bootstrap is rejected.
5. Login succeeds with valid credentials and fails with invalid credentials.
6. Refresh rotates the refresh token; reusing the previous refresh token fails.
7. `/core/me` returns only the authenticated tenant context.
8. `/core/company` returns the current company.
9. Owner can list/create/update users.
10. Admin cannot modify the owner account.
11. An inactive user cannot authenticate or access tenant routes.
12. Password change revokes all stored refresh sessions for that user.
13. `/core/audit` contains the expected Core administration events.

## 3. Tenant isolation test

Create two test companies/tenants in an isolated test database/environment. Verify that a token from tenant A cannot read, modify or delete a record belonging to tenant B, even when the record ID is known. Repeat for users, company context, audit records and module records that use `tenantCollection`.

## 4. Desktop smoke test

Install the generated `.deb` on a clean Linux environment and verify:

- the custom titlebar works;
- minimize, maximize/restore and close work;
- the app reaches the real Render API;
- login/logout works;
- the Core data displayed in the UI matches the backend;
- an expired access token is refreshed or the session returns to login;
- no MongoDB URI or bootstrap secret appears in the desktop bundle.

## 5. Evidence rule

F1 may be marked operationally accepted only after the automated CI gate is green and the human smoke tests above have been performed against a real environment. The human checks are environment-dependent and therefore cannot be honestly simulated by repository inspection.
