import 'dotenv/config';
import { MongoClient } from 'mongodb';

type Address = {
  _id?: string;
  partyId?: string;
  companyId?: string;
  code: string;
  type: 'billing' | 'shipping' | 'commercial' | 'residential' | 'other';
  label?: string;
  recipientName?: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  country: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const client = new MongoClient(required('MONGODB_URI'));
await client.connect();

try {
  const db = client.db(process.env.MONGODB_DB?.trim() || undefined);
  const parties = db.collection('parties');
  const addresses = db.collection<Address>('addresses');

  const count = await addresses.countDocuments();
  if (count === 0) {
    console.log('No legacy addresses found; nothing to migrate.');
    process.exitCode = 0;
  } else {
    const docs = await addresses.find({}).toArray();
    const grouped = new Map<string, Address[]>();

    for (const address of docs) {
      if (!address.partyId) throw new Error(`Address ${String(address._id)} has no partyId`);
      const party = await parties.findOne({ _id: address.partyId, ...(address.companyId ? { companyId: address.companyId } : {}) });
      if (!party) throw new Error(`Address ${String(address._id)} references a missing party`);
      const normalized: Address = { ...address };
      delete normalized.partyId;
      delete normalized.companyId;
      const list = grouped.get(address.partyId) ?? [];
      list.push(normalized);
      grouped.set(address.partyId, list);
    }

    for (const [partyId, incoming] of grouped) {
      const party = await parties.findOne({ _id: partyId });
      if (!party) throw new Error(`Party ${partyId} disappeared during migration`);
      const existing = Array.isArray(party.addresses) ? party.addresses : [];
      const existingIds = new Set(existing.map((x: Address) => String(x._id)));
      const pending = incoming.filter(x => !x._id || !existingIds.has(String(x._id)));
      const codes = new Set(existing.map((x: Address) => `${x.type}::${x.code}`));
      for (const address of pending) {
        const key = `${address.type}::${address.code}`;
        if (codes.has(key)) throw new Error(`Address code conflict on party ${partyId}: ${key}`);
        codes.add(key);
      }
      if (existing.length + pending.length > 50) throw new Error(`Party ${partyId} would exceed the 50-address limit`);
    }

    for (const [partyId, incoming] of grouped) {
      const party = await parties.findOne({ _id: partyId });
      const existing = Array.isArray(party?.addresses) ? party.addresses : [];
      const pending = incoming.filter(x => !x._id || !existing.some((y: Address) => y._id && x._id && String(y._id) === String(x._id)));
      if (pending.length) await parties.updateOne({ _id: partyId }, { $push: { addresses: { $each: pending } }, $set: { updatedAt: new Date() } });
    }

    await addresses.drop();
    console.log(`Migrated ${count} address(es) into parties.addresses and dropped the legacy collection.`);
  }
} finally {
  await client.close();
}
