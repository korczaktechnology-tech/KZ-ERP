# F1 status

This file records the intended F1 gate and prevents treating documentation alone as proof of completion. The final F1 status must be based on the current `main` source, tests/builds, and GitHub Actions verification.

Required verification:

1. inspect all Core/data-access paths;
2. inspect tenant scoping and companyId mutation protections;
3. inspect indexes and startup provisioning;
4. inspect validation and API contracts;
5. inspect audit behavior;
6. execute API tests and build;
7. execute desktop build;
8. execute Tauri package validation;
9. verify the final GitHub Actions run is green.
