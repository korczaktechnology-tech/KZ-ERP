BEGIN;

CREATE SCHEMA IF NOT EXISTS erp;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION erp.audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  tenant uuid;
  actor uuid;
BEGIN
  tenant := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  actor := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  INSERT INTO erp.audit_log(id, tenant_id, actor_id, action, table_name, row_id, before_data, after_data, created_at)
  VALUES (uuidv7(), COALESCE(tenant, COALESCE(NEW.tenant_id, OLD.tenant_id)), actor, TG_OP, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END, CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END, now());
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TABLE IF NOT EXISTS erp.tenant (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  legal_name text NOT NULL,
  trade_name text NOT NULL,
  tax_id text NOT NULL UNIQUE,
  default_currency char(3) NOT NULL DEFAULT 'BRL',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.user_account (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  email citext NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS erp.role (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  code text NOT NULL,
  name text NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS erp.permission (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS erp.role_permission (
  role_id uuid NOT NULL REFERENCES erp.role(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES erp.permission(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS erp.user_role (
  user_id uuid NOT NULL REFERENCES erp.user_account(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES erp.role(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS erp.product (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  unit_code text NOT NULL DEFAULT 'UN',
  barcode text,
  ncm text,
  cest text,
  cost numeric(19,6) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  sale_price numeric(19,6) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  active boolean NOT NULL DEFAULT true,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku),
  UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS erp.warehouse (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS erp.stock_balance (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouse(id),
  product_id uuid NOT NULL REFERENCES erp.product(id),
  quantity numeric(24,6) NOT NULL DEFAULT 0,
  reserved_quantity numeric(24,6) NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, warehouse_id, product_id),
  CHECK (reserved_quantity >= 0),
  CHECK (reserved_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS erp.stock_movement (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouse(id),
  product_id uuid NOT NULL REFERENCES erp.product(id),
  movement_type text NOT NULL CHECK (movement_type IN ('receipt','issue','transfer_in','transfer_out','adjustment','reservation','release')),
  quantity numeric(24,6) NOT NULL CHECK (quantity > 0),
  reference_type text,
  reference_id uuid,
  idempotency_key uuid,
  created_by uuid REFERENCES erp.user_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS erp.customer (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  code text NOT NULL,
  legal_name text NOT NULL,
  trade_name text,
  tax_id text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','prospect','inactive')),
  credit_limit numeric(19,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, tax_id)
);

CREATE TABLE IF NOT EXISTS erp.sales_order (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  customer_id uuid NOT NULL REFERENCES erp.customer(id),
  order_number bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','allocated','fulfilled','cancelled')),
  currency char(3) NOT NULL DEFAULT 'BRL',
  subtotal numeric(19,2) NOT NULL DEFAULT 0,
  discount_total numeric(19,2) NOT NULL DEFAULT 0,
  tax_total numeric(19,2) NOT NULL DEFAULT 0,
  grand_total numeric(19,2) NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES erp.user_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS erp.sales_order_item (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  sales_order_id uuid NOT NULL REFERENCES erp.sales_order(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES erp.product(id),
  line_number integer NOT NULL,
  quantity numeric(24,6) NOT NULL CHECK (quantity > 0),
  unit_price numeric(19,6) NOT NULL CHECK (unit_price >= 0),
  discount numeric(19,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax numeric(19,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total numeric(19,2) NOT NULL CHECK (total >= 0),
  UNIQUE (sales_order_id, line_number)
);

CREATE TABLE IF NOT EXISTS erp.finance_account (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('cash','bank','wallet','credit_card')),
  currency char(3) NOT NULL DEFAULT 'BRL',
  opening_balance numeric(19,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS erp.finance_category (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  code text NOT NULL,
  name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('income','expense')),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS erp.financial_entry (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  entry_type text NOT NULL CHECK (entry_type IN ('receivable','payable')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','cancelled')),
  description text NOT NULL,
  amount numeric(19,2) NOT NULL CHECK (amount > 0),
  paid_amount numeric(19,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
  due_date date NOT NULL,
  paid_at timestamptz,
  category_id uuid REFERENCES erp.finance_category(id),
  reference text,
  idempotency_key uuid,
  created_by uuid REFERENCES erp.user_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS erp.finance_payment (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  financial_entry_id uuid NOT NULL REFERENCES erp.financial_entry(id),
  account_id uuid NOT NULL REFERENCES erp.finance_account(id),
  amount numeric(19,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL,
  method text NOT NULL CHECK (method IN ('cash','bank_transfer','pix','card','other')),
  reference text,
  idempotency_key uuid,
  created_by uuid REFERENCES erp.user_account(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS erp.tax_profile (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  code text NOT NULL,
  name text NOT NULL,
  regime text NOT NULL,
  icms_rate numeric(9,4) NOT NULL DEFAULT 0 CHECK (icms_rate >= 0),
  ipi_rate numeric(9,4) NOT NULL DEFAULT 0 CHECK (ipi_rate >= 0),
  pis_rate numeric(9,4) NOT NULL DEFAULT 0 CHECK (pis_rate >= 0),
  cofins_rate numeric(9,4) NOT NULL DEFAULT 0 CHECK (cofins_rate >= 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS erp.fiscal_document (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  customer_id uuid REFERENCES erp.customer(id),
  document_type text NOT NULL CHECK (document_type IN ('nfe','nfse','nfce','cte','other')),
  series text NOT NULL,
  number bigint NOT NULL,
  access_key text,
  status text NOT NULL CHECK (status IN ('draft','authorized','rejected','cancelled','denied')),
  issue_date timestamptz NOT NULL,
  total_amount numeric(19,2) NOT NULL DEFAULT 0,
  xml_storage_key text,
  protocol text,
  UNIQUE (tenant_id, document_type, series, number),
  UNIQUE (tenant_id, access_key)
);

CREATE TABLE IF NOT EXISTS erp.audit_log (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid,
  actor_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  row_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.outbox_event (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id uuid NOT NULL REFERENCES erp.tenant(id),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','published','dead_letter')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_product_tenant_name ON erp.product(tenant_id, name);
CREATE INDEX IF NOT EXISTS ix_stock_balance_product ON erp.stock_balance(tenant_id, product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS ix_stock_movement_created ON erp.stock_movement(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_sales_order_customer_created ON erp.sales_order(tenant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_financial_entry_due ON erp.financial_entry(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS ix_finance_payment_entry ON erp.finance_payment(tenant_id, financial_entry_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS ix_fiscal_document_issue ON erp.fiscal_document(tenant_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS ix_outbox_ready ON erp.outbox_event(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS ix_audit_tenant_created ON erp.audit_log(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION erp.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant','user_account','product','warehouse','stock_balance','customer','sales_order','finance_account','financial_entry'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON erp.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON erp.%I FOR EACH ROW EXECUTE FUNCTION erp.touch_updated_at()', t, t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant','user_account','product','warehouse','stock_balance','stock_movement','customer','sales_order','sales_order_item','finance_account','finance_category','financial_entry','finance_payment','tax_profile','fiscal_document','outbox_event'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit ON erp.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON erp.%I FOR EACH ROW EXECUTE FUNCTION erp.audit_row()', t, t);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_account','role','product','warehouse','stock_balance','stock_movement','customer','sales_order','sales_order_item','finance_account','finance_category','financial_entry','finance_payment','tax_profile','fiscal_document','outbox_event'] LOOP
    EXECUTE format('ALTER TABLE erp.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON erp.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON erp.%I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', t);
  END LOOP;
END $$;

ALTER TABLE erp.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_tenant_isolation ON erp.audit_log;
CREATE POLICY audit_tenant_isolation ON erp.audit_log USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

COMMIT;
