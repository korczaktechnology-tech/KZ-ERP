import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root=path.dirname(fileURLToPath(import.meta.url));
const source=await readFile(path.join(root,'../modules/master-data/f2.ts'),'utf8');
const requiredRoutes=['/categories','/brands','/contacts','/warehouse-locations','/classifications','/attachments','/relationships','/search','/integrity','/export/:entity','/import/:entity'];

test('F2 exposes every planned extension area',()=>{for(const route of requiredRoutes)assert.match(source,new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')))});
test('F2 is tenant-scoped and permission protected',()=>{assert.match(source,/r\.use\(requireAuth\)/);assert.match(source,/master-data:read/);assert.match(source,/master-data:write/);assert.match(source,/tenantCollection/)});
test('F2 has integrity, audit, pagination and bounded import controls',()=>{assert.match(source,/audit\(db/);assert.match(source,/parsePagination/);assert.match(source,/Maximum 1000 records per import/);assert.match(source,/orphan_address/)});
