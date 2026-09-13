import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';

type Tenant = {
  _id: string;
  name: string;
  slug: string;
  companyId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * F1 tenant foundation.
 * Keeps Organization/Tenant as a first-class resource while preserving
 * companyId as the compatibility key currently used by the ERP modules.
 */
export async function ensureTenantFoundation(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  if (!existing.has('tenants')) await db.createCollection('tenants');

  const tenants = db.collection<Tenant>('tenants');
  await tenants.createIndex({ slug: 1 }, { unique: true, name: 'tenants_slug_unique' });
  await tenants.createIndex({ companyId: 1 }, { unique: true, name: 'tenants_company_unique' });
  await tenants.createIndex({ active: 1, createdAt: -1 }, { name: 'tenants_active_created' });

  // Backfill the first-class tenant record for companies created by older builds.
  const companies = db.collection<{ _id?: string; name: string; slug: string; active: boolean; createdAt: Date; updatedAt: Date }>('companies');
  for await (const company of companies.find({})) {
    if (!company._id) continue;
    const now = new Date();
    await tenants.updateOne(
      { companyId: company._id },
      {
        $set: {
          name: company.name,
          slug: company.slug,
          active: company.active,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: randomUUID(),
          companyId: company._id,
          createdAt: company.createdAt ?? now,
        },
      },
      { upsert: true },
    );
  }
}

export async function ensureTenantRecord(
  db: Db,
  company: { _id: string; name: string; slug: string; active: boolean; createdAt: Date; updatedAt: Date },
): Promise<Tenant> {
  const tenants = db.collection<Tenant>('tenants');
  const now = new Date();
  await tenants.updateOne(
    { companyId: company._id },
    {
      $set: {
        name: company.name,
        slug: company.slug,
        active: company.active,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: randomUUID(),
        companyId: company._id,
        createdAt: company.createdAt ?? now,
      },
    },
    { upsert: true },
  );
  const tenant = await tenants.findOne({ companyId: company._id });
  if (!tenant) throw new Error('TENANT_NOT_FOUND_AFTER_UPSERT');
  return tenant;
}
