import type { Db } from 'mongodb';
import { ensureCoreCollections } from '../core/db.js';
import { ensureTenantCollections } from '../core/tenant.js';
import { ensureTenantFoundation } from '../core/tenant-foundation.js';
import { ensureGovernanceCollections } from '../core/governance.js';
import { ensureGovernanceIndexes } from '../core/governance-extra.js';

export const id = '001-f1-core';
export const description = 'Create and reconcile the F1 Core schema, tenant foundation and governance indexes.';

export async function up(db: Db): Promise<void> {
  await ensureCoreCollections(db);
  await ensureTenantCollections(db);
  await ensureTenantFoundation(db);
  await ensureGovernanceCollections(db);
  await ensureGovernanceIndexes(db);
}
