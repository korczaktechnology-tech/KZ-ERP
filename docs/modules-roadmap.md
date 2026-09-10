# Module implementation order

The ERP modules are implemented by dependency order rather than all at once.

## Implemented foundation

1. CORE — company, identity, RBAC, authentication and audit.
2. Master Data — products, customers, suppliers and warehouses.
3. SALES foundation — sales orders using customers and products.

## Next dependency layers

4. WMS — inventory movements, stock ledger, reservations and warehouse operations.
5. TMS — transport planning and execution based on sales/logistics documents.
6. FINANCE — receivables, payables, cash and financial reconciliation.
7. FISCAL — fiscal documents and Brazilian fiscal workflows.
8. PEOPLE — employees and organizational data.
9. CRM — leads, opportunities and customer relationship history.
10. COMMERCE — channels and commerce operations.
11. QUALITY — inspections, nonconformities and quality controls.
12. MAINTENANCE — assets and maintenance work orders.
13. DOCUMENTS — document metadata, versions and links.
14. ASSETS — asset registry and lifecycle.
15. FIELD — field operations.
16. SERVICE — service orders and after-sales execution.
17. PROJECTS — projects, tasks and cost tracking.

Every module must preserve the API contract, tenant isolation, server-side MongoDB access and integration namespace boundaries established by the foundation.
