import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'ERP';
if (!uri) throw new Error('MONGODB_URI is required');

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const parties = db.collection('parties');

  for (const [legacyName, role] of [['customers', 'customer'], ['suppliers', 'supplier']] as const) {
    const legacy = db.collection(legacyName);
    const docs = await legacy.find({}).toArray();
    if (docs.length === 0) {
      if ((await db.listCollections({ name: legacyName }).toArray()).length) await legacy.drop();
      continue;
    }

    const conflicts: string[] = [];
    for (const doc of docs) {
      const existingById = await parties.findOne({ _id: doc._id });
      const existingByCode = doc.companyId && doc.code ? await parties.findOne({ companyId: doc.companyId, code: doc.code }) : null;
      if (existingByCode && String(existingByCode._id) !== String(doc._id)) conflicts.push(`${legacyName}:${doc.companyId}:${doc.code}`);
      if (existingById && existingById.companyId !== doc.companyId) conflicts.push(`${legacyName}:${String(doc._id)}:tenant-mismatch`);
    }
    if (conflicts.length) throw new Error(`PARTY_MIGRATION_CONFLICT:${conflicts.join(',')}`);

    for (const doc of docs) {
      const existing = await parties.findOne({ _id: doc._id });
      const roles = new Set<string>([...(existing?.roles ?? []), role]);
      const now = new Date();
      const party = {
        _id: doc._id,
        companyId: doc.companyId,
        code: String(doc.code),
        kind: 'company' as const,
        roles: [...roles],
        name: String(doc.name),
        document: doc.document ? String(doc.document) : undefined,
        email: doc.email ? String(doc.email).toLowerCase() : undefined,
        phone: doc.phone ? String(doc.phone) : undefined,
        active: Boolean(doc.active),
        createdAt: existing?.createdAt ?? doc.createdAt ?? now,
        updatedAt: now
      };
      await parties.replaceOne({ _id: party._id }, party, { upsert: true });
    }

    await legacy.drop();
    console.log(`Consolidated ${docs.length} ${legacyName} documents into parties.`);
  }

  const people = db.collection('people');
  const peopleExists = (await db.listCollections({ name: 'people' }).toArray()).length > 0;
  if (peopleExists) {
    const count = await people.countDocuments({});
    if (count > 0) throw new Error(`OBSOLETE_PEOPLE_COLLECTION_NOT_EMPTY:${count}`);
    await people.drop();
    console.log('Removed empty obsolete people collection.');
  }
} finally {
  await client.close();
}
