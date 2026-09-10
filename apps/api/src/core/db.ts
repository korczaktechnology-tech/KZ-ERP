import type { Db, Document, Filter, OptionalUnlessRequiredId } from 'mongodb';

export function tenantFilter<T extends Document>(companyId: string, filter: Filter<T> = {}): Filter<T> {
  return { ...filter, companyId } as Filter<T>;
}

export function tenantCollection<T extends Document & { companyId: string }>(db: Db, name: string) {
  const collection = db.collection<T>(name);
  return {
    findOne: (companyId: string, filter: Filter<T> = {}) => collection.findOne(tenantFilter(companyId, filter)),
    find: (companyId: string, filter: Filter<T> = {}) => collection.find(tenantFilter(companyId, filter)),
    insertOne: (companyId: string, document: Omit<T, 'companyId'>) =>
      collection.insertOne({ ...document, companyId } as OptionalUnlessRequiredId<T>),
    updateOne: (companyId: string, filter: Filter<T>, update: Document) => collection.updateOne(tenantFilter(companyId, filter), update),
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
