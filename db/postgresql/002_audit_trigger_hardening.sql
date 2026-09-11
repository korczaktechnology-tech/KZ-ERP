CREATE OR REPLACE FUNCTION erp.audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  tenant uuid;
  actor uuid;
  before_row jsonb;
  after_row jsonb;
  row_tenant text;
BEGIN
  before_row := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END;
  row_tenant := COALESCE(after_row->>'tenant_id', before_row->>'tenant_id');
  tenant := COALESCE(NULLIF(current_setting('app.tenant_id', true), '')::uuid, NULLIF(row_tenant, '')::uuid);
  actor := NULLIF(current_setting('app.actor_id', true), '')::uuid;
  INSERT INTO erp.audit_log(id, tenant_id, actor_id, action, table_name, row_id, before_data, after_data, created_at)
  VALUES (uuidv7(), tenant, actor, TG_OP, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, COALESCE((after_row->>'id')::uuid, (before_row->>'id')::uuid), before_row, after_row, now());
  RETURN COALESCE(NEW, OLD);
END;
$$;
