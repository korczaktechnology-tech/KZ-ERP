import type { Db, Document, Filter, OptionalUnlessRequiredId, UpdateFilter } from 'mongodb';

export function tenantFilter<T extends Document>(companyId: string, filter: Filter<T> = {}): Filter<T> {
  return { ...filter, companyId } as Filter<T>;
}

function assertTenantImmutable(update: Document): void {
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'companyId') throw new Error('TENANT_ID_IMMUTABLE');
      visit(child);
    }
  };
  visit(update);
}

export function tenantCollection<T extends Document & { companyId: string }>(db: Db, name: string) {
  const collection = db.collection<T>(name);
  return {
    findOne: (companyId: string, filter: Filter<T> = {}) => collection.findOne(tenantFilter(companyId, filter)),
    find: (companyId: string, filter: Filter<T> = {}) => collection.find(tenantFilter(companyId, filter)),
    insertOne: (companyId: string, document: Omit<T, 'companyId'>) =>
      collection.insertOne({ ...document, companyId } as OptionalUnlessRequiredId<T>),
    updateOne: (companyId: string, filter: Filter<T>, update: UpdateFilter<T>) => {
      assertTenantImmutable(update);
      return collection.updateOne(tenantFilter(companyId, filter), update);
    },
    deleteOne: (companyId: string, filter: Filter<T>) => collection.deleteOne(tenantFilter(companyId, filter))
  };
}

export async function ensureCoreCollections(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name));
  for (const name of ['companies', 'users', 'audit_logs']) {
    if (!existing.has(name)) await db.createCollection(name);
  }

  await db.collection('users').createIndex({ companyId: 1, email: 1 }, { unique: true, name: 'users_company_email_unique' });
  await db.collection('users').createIndex({ companyId: 1, role: 1 }, { name: 'users_company_role' });
  await db.collection('audit_logs').createIndex({ companyId: 1, createdAt: -1 }, { name: 'audit_company_created' });
  await db.collection('companies').createIndex({ slug: 1 }, { unique: true, name: 'companies_slug_unique' });
}

export type CoreCompany = {
  _id?: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CoreUser = {
  _id?: string;
  companyId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'owner' | 'admin' | 'manager' | 'user' | 'viewer';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLog = {
  _id?: string;
  companyId: string;
  actorUserId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
