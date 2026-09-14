import assert from 'node:assert/strict';

const base = process.env.KZ_ERP_E2E_BASE_URL || 'http://127.0.0.1:10000';
const email = process.env.KZ_ERP_E2E_EMAIL || 'e2e@kz-erp.local';
const password = process.env.KZ_ERP_E2E_PASSWORD || 'KzErp-E2E-2026-Local!';
let token = '';
const id = (v) => v?.id || v?._id;

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return data;
}

async function mustFail(path, options, pattern) {
  try {
    await call(path, options);
    throw new Error(`Expected failure: ${options?.method || 'GET'} ${path}`);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.startsWith('Expected failure:')) throw error;
    if (pattern && !pattern.test(message)) throw new Error(`Unexpected failure for ${path}: ${message}`);
  }
}

const login = await call('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
token = login.token || login.accessToken;
assert.ok(token, 'login token');
const suffix = Date.now().toString(36);

const unit = await call('/api/v1/master-data/f2/units', { method: 'POST', body: JSON.stringify({ code: `E2E-${suffix}`, name: 'E2E Unit', symbol: 'un', active: true }) });
const unitId = id(unit); assert.ok(unitId);
const product = await call('/api/v1/master-data/f2/products', { method: 'POST', body: JSON.stringify({ sku: `E2E-${suffix}`, name: 'E2E Product', unitId, active: true }) });
const productId = id(product); assert.ok(productId);
const list = await call('/api/v1/master-data/f2/price-lists', { method: 'POST', body: JSON.stringify({ code: `E2E-${suffix}`, name: 'E2E Price List', currency: 'BRL', active: true }) });
const listId = id(list); assert.ok(listId);
const price = await call('/api/v1/master-data/f2/prices', { method: 'POST', body: JSON.stringify({ priceListId: listId, productId, amount: 12.5, minQuantity: 1, active: true }) });
assert.ok(id(price?.price ?? price));
const category = await call('/api/v1/master-data/f2/categories', { method: 'POST', body: JSON.stringify({ code: `E2E-${suffix}`, name: 'E2E Category', active: true }) });
const categoryId = id(category); assert.ok(categoryId);
const brand = await call('/api/v1/master-data/f2/brands', { method: 'POST', body: JSON.stringify({ code: `E2E-${suffix}`, name: 'E2E Brand', active: true }) });
assert.ok(id(brand));
const party = await call('/api/v1/master-data/f2/parties', { method: 'POST', body: JSON.stringify({ type: 'company', name: 'E2E Party', document: `E2E-${suffix}`, active: true }) });
const partyId = id(party); assert.ok(partyId);
const address = await call('/api/v1/master-data/f2/addresses', { method: 'POST', body: JSON.stringify({ partyId, street: 'Rua E2E', number: '1', city: 'São Paulo', state: 'SP', country: 'BR', zipCode: '01000000', active: true }) });
assert.ok(id(address));
const contact = await call('/api/v1/master-data/f2/contacts', { method: 'POST', body: JSON.stringify({ partyId, name: 'E2E Contact', email: `${suffix}@example.invalid`, phone: '+5500000000000', active: true }) });
assert.ok(id(contact));
const warehouse = await call('/api/v1/master-data/f2/warehouses', { method: 'POST', body: JSON.stringify({ code: `E2E-${suffix}`, name: 'E2E Warehouse', active: true }) });
const warehouseId = id(warehouse); assert.ok(warehouseId);
const zone = await call('/api/v1/master-data/f2/locations', { method: 'POST', body: JSON.stringify({ warehouseId, code: `Z-${suffix}`, name: 'Zone', kind: 'zone', active: true }) });
const zoneId = id(zone); assert.ok(zoneId);
await mustFail('/api/v1/master-data/f2/locations', { method: 'POST', body: JSON.stringify({ warehouseId, code: `B-${suffix}`, name: 'Invalid Bin', kind: 'bin', parentId: zoneId, active: true }) }, /400|409/);
const classification = await call('/api/v1/master-data/f2/classifications', { method: 'POST', body: JSON.stringify({ code: `E2E-${suffix}`, name: 'E2E Classification', active: true }) });
assert.ok(id(classification));
const relationship = await call('/api/v1/master-data/f2/relationships', { method: 'POST', body: JSON.stringify({ sourceEntity: 'product', sourceId: productId, targetEntity: 'category', targetId: categoryId, type: 'related_to' }) });
assert.ok(id(relationship));
await mustFail('/api/v1/master-data/f2/relationships', { method: 'POST', body: JSON.stringify({ sourceEntity: 'product', sourceId: '000000000000000000000000', targetEntity: 'category', targetId: categoryId, type: 'related_to' }) }, /400|404|409/);
const attachment = await call('/api/v1/master-data/f2/attachments', { method: 'POST', body: JSON.stringify({ entityType: 'product', entityId: productId, fileName: 'external.txt', mimeType: 'text/plain', size: 5, storageManaged: false, active: true }) });
assert.ok(id(attachment));
await call('/api/v1/master-data/f2/search?q=E2E');
await call('/api/v1/master-data/f2/integrity');
const exported = await call('/api/v1/master-data/f2/export/categories');
assert.equal(exported.entity, 'category'); assert.ok(Array.isArray(exported.records)); assert.equal(typeof exported.schemaVersion, 'string');
await call('/api/v1/core/cost_centers');
await call('/api/v1/core/org_units');
const imported = await call('/api/v1/master-data/f2/bulk/import/category', { method: 'POST', body: JSON.stringify({ records: [{ code: `IMP-${suffix}`, name: 'Imported E2E', active: true }] }) });
assert.ok(imported.inserted >= 1);
const duplicateId = `dup-${suffix}`;
const duplicate = await call('/api/v1/master-data/f2/bulk/import/category', { method: 'POST', body: JSON.stringify({ records: [{ id: duplicateId, code: `DUP-${suffix}-1`, name: 'Dup 1', active: true }, { id: duplicateId, code: `DUP-${suffix}-2`, name: 'Dup 2', active: true }] }) });
assert.equal(duplicate.inserted, 0); assert.ok(duplicate.failed >= 2); assert.ok(Array.isArray(duplicate.errors));
await mustFail(`/api/v1/master-data/f2/categories/${duplicateId}`, {}, /404/);
console.log('F2 operational smoke: PASS');
