const base = (process.env.KZ_ERP_API_URL || 'https://kz-erp.onrender.com').replace(/\/$/, '');
const email = process.env.KZ_ERP_E2E_EMAIL;
const password = process.env.KZ_ERP_E2E_PASSWORD;
const companySlug = process.env.KZ_ERP_E2E_COMPANY_SLUG;
if (!email || !password) { console.error('KZ_ERP_E2E_EMAIL and KZ_ERP_E2E_PASSWORD are required.'); process.exit(2); }

async function call(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { accept: 'application/json', 'content-type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${body?.error?.code || body?.error?.message || text}`);
  return body?.data ?? body;
}

async function raw(path, options = {}) {
  const response = await fetch(base + path, options);
  const text = await response.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { response, body };
}

const checks = [];
async function check(name, fn) {
  try { const value = await fn(); checks.push(1); console.log(`PASS ${name}`); return value; }
  catch (error) { checks.push(0); console.error(`FAIL ${name}: ${error.message}`); throw error; }
}

const login = await check('login', () => call('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, ...(companySlug ? { companySlug } : {}) }) }));
const access = login.accessToken;
const auth = () => ({ Authorization: `Bearer ${access}` });
const company = await check('tenant company', () => call('/api/v1/core/company', { headers: auth() }));
const companyId = company.company?.id;

const unit = await check('unit create', () => call('/api/v1/master-data/units', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2UN-${Date.now()}`, name: 'F2 Smoke Unit', symbol: 'un', kind: 'unit', decimalPlaces: 0 }) }));
const product = await check('product create', () => call('/api/v1/master-data/products', { method: 'POST', headers: auth(), body: JSON.stringify({ sku: `F2SKU-${Date.now()}`, name: 'F2 Smoke Product', unit: unit.unit.code, price: '10.000000' }) }));
const priceList = await check('price list create', () => call('/api/v1/master-data/price-lists', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2PL-${Date.now()}`, name: 'F2 Smoke Price List', currency: 'BRL' }) }));
await check('price create', () => call(`/api/v1/master-data/price-lists/${priceList.priceList.id}/prices`, { method: 'POST', headers: auth(), body: JSON.stringify({ productId: product.product.id, amount: '12.500000', minQuantity: 1 }) }));

const category = await check('category create', () => call('/api/v1/master-data/f2/categories', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2CAT-${Date.now()}`, name: 'F2 Smoke Category' }) }));
const categoryId = category.category.id;
await check('category read', () => call(`/api/v1/master-data/f2/categories/${categoryId}`, { headers: auth() }));
const brand = await check('brand create', () => call('/api/v1/master-data/f2/brands', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2BR-${Date.now()}`, name: 'F2 Smoke Brand' }) }));
const brandId = brand.brand.id;
const classification = await check('classification create', () => call('/api/v1/master-data/f2/classifications', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2CL-${Date.now()}`, name: 'F2 Smoke Classification', type: 'smoke' }) }));

const warehouse = await check('warehouse list', () => call('/api/v1/master-data/warehouses?limit=1&offset=0', { headers: auth() }));
if (!warehouse.items?.[0]?.id) throw new Error('No active warehouse available for hierarchy smoke');
const warehouseId = warehouse.items[0].id;
const location = await check('zone create', () => call('/api/v1/master-data/f2/warehouse-locations', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2Z-${Date.now()}`, name: 'F2 Smoke Zone', warehouseId, kind: 'zone' }) }));
const zoneId = location.location.id;
await check('aisle create', () => call('/api/v1/master-data/f2/warehouse-locations', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2A-${Date.now()}`, name: 'F2 Smoke Aisle', warehouseId, parentId: zoneId, kind: 'aisle' }) }));
const badParent = await raw('/api/v1/master-data/f2/warehouse-locations', { method: 'POST', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify({ code: `F2BAD-${Date.now()}`, name: 'F2 Bad Location', warehouseId, parentId: zoneId, kind: 'rack' }) });
if (badParent.response.status !== 422) throw new Error(`expected hierarchy rejection, got ${badParent.response.status}`); checks.push(1); console.log('PASS invalid hierarchy rejected');

const party = await check('party create', () => call('/api/v1/master-data/parties', { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2P-${Date.now()}`, kind: 'company', roles: ['customer'], name: 'F2 Smoke Party', active: true }) }));
const partyId = party.party.id;
await check('address create', () => call(`/api/v1/master-data/parties/${partyId}/addresses`, { method: 'POST', headers: auth(), body: JSON.stringify({ code: `F2ADDR-${Date.now()}`, type: 'commercial', postalCode: '01000-000', street: 'F2 Smoke Street', number: '1', district: 'Centro', city: 'São Paulo', state: 'SP', country: 'BR' }) }));
await check('contact create', () => call('/api/v1/master-data/f2/contacts', { method: 'POST', headers: auth(), body: JSON.stringify({ partyId, name: 'F2 Smoke Contact', email: 'f2-smoke@example.invalid' }) }));

const relationship = await check('relationship create', () => call('/api/v1/master-data/f2/relationships', { method: 'POST', headers: auth(), body: JSON.stringify({ sourceType: 'category', sourceId: categoryId, relation: 'related-to', targetType: 'brand', targetId: brandId }) }));

const uploadBody = Buffer.from('F2 operational smoke attachment');
const upload = await check('attachment upload', async () => {
  const { response, body } = await raw('/api/v1/master-data/f2/attachments/upload', { method: 'POST', headers: { ...auth(), 'content-length': String(uploadBody.length), 'x-f2-entity-type': 'category', 'x-f2-entity-id': categoryId, 'x-f2-file-name': 'f2-smoke.txt', 'x-f2-mime-type': 'text/plain' }, body: uploadBody });
  if (!response.ok) throw new Error(`upload HTTP ${response.status}: ${body?.error?.message || body?.raw}`);
  return body.data ?? body;
});
const attachmentId = upload.attachment.id;
await check('attachment download', async () => { const { response, body } = await raw(`/api/v1/master-data/f2/attachments/${attachmentId}/download`, { headers: auth() }); if (!response.ok || body.raw !== uploadBody.toString()) throw new Error('attachment binary round-trip failed'); });

const search = await check('search', () => call('/api/v1/master-data/f2/search?q=F2', { headers: auth() }));
if (!search.results?.categories || !search.results?.parties || !search.results?.locations || !search.results?.products) throw new Error('search contract incomplete');

await check('integrity', async () => { const x = await call('/api/v1/master-data/f2/integrity', { headers: auth() }); if (x.healthy !== true || !Array.isArray(x.issues)) throw new Error(`integrity reported issues: ${JSON.stringify(x.issues)}`); });
await check('category export', async () => { const x = await call('/api/v1/master-data/f2/export/categories', { headers: auth() }); if (!Array.isArray(x.records) || !x.records.some((record) => record.id === categoryId)) throw new Error('export contract invalid'); });

const importParentId = crypto.randomUUID();
const importChildId = crypto.randomUUID();
await check('dependency-aware category import', async () => {
  const x = await call('/api/v1/master-data/f2/bulk/import/categories', { method: 'POST', headers: auth(), body: JSON.stringify([{ id: importChildId, code: `F2IMP-C-${Date.now()}`, name: 'F2 Imported Child', parentId: importParentId }, { id: importParentId, code: `F2IMP-P-${Date.now()}`, name: 'F2 Imported Parent' }]) });
  if (x.inserted !== 2 || x.failed !== 0) throw new Error(`import failed: ${JSON.stringify(x)}`);
});

await check('audit evidence', async () => { const x = await call('/api/v1/core/audit?limit=200&offset=0', { headers: auth() }); if (!x.items?.some((item) => String(item.action).includes('master-data.category.create'))) throw new Error('F2 category mutation missing from audit'); });
await check('attachment delete lifecycle', async () => { const { response } = await raw(`/api/v1/master-data/f2/attachments/${attachmentId}/file`, { method: 'DELETE', headers: auth() }); if (response.status !== 204) throw new Error(`expected 204, got ${response.status}`); });
await check('relationship delete', async () => { const { response } = await raw(`/api/v1/master-data/f2/relationships/${relationship.relationship.id}`, { method: 'DELETE', headers: auth() }); if (response.status !== 204) throw new Error(`expected 204, got ${response.status}`); });

console.log(`F2 full operational smoke: ${checks.reduce((a, b) => a + b, 0)}/${checks.length} passed for company ${companyId}`);
