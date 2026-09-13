import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { migrateCollectionNames, localizeDatabase } from '../core/collection-names.js';
import * as f1 from './001-f1-core.js';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? 'ERP';
if (!uri) throw new Error('MONGODB_URI is required');

const mongo = new MongoClient(uri);
const migrations = [f1];

async function main(): Promise<void> {
  await mongo.connect();
  const raw = mongo.db(dbName);
  await migrateCollectionNames(raw);
  const db = localizeDatabase(raw);
  const history = db.collection<{ _id: string; appliedAt: Date; description: string }>('schema_migrations');
  await history.createIndex({ appliedAt: 1 }, { name: 'schema_migrations_applied_at' });
  for (const migration of migrations) {
    if (await history.findOne({ _id: migration.id })) continue;
    await migration.up(db);
    await history.insertOne({ _id: migration.id, appliedAt: new Date(), description: migration.description });
    console.log(`APPLIED ${migration.id}: ${migration.description}`);
  }
  console.log('Migration runner completed.');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await mongo.close().catch(() => undefined); });
