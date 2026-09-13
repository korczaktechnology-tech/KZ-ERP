import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { ensureF2Collections } from '../src/modules/master-data/f2.ts';
import { localizeDatabase } from '../src/core/collection-names.ts';

const uri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/kz_erp_f2_smoke';
const client=new MongoClient(uri);await client.connect();
try{
  const raw=client.db();const db=localizeDatabase(raw);await ensureF2Collections(db);
  const categories=raw.collection('categorias_produtos');
  const companyId='f2-smoke-company';const id='f2-smoke-category';
  await categories.deleteMany({companyId});
  await categories.insertOne({_id:id,companyId,code:'F2SMOKE',name:'F2 Smoke',active:true,createdAt:new Date(),updatedAt:new Date()});
  const indexes=await categories.listIndexes().toArray();
  assert.ok(indexes.some(index=>index.name==='product_categories_company_code_unique'&&index.unique===true),'F2 category unique index missing');
  await assert.rejects(()=>categories.insertOne({_id:'f2-smoke-category-2',companyId,code:'F2SMOKE',name:'Duplicate',active:true,createdAt:new Date(),updatedAt:new Date()}));
  const locations=raw.collection('localizacoes_armazens');
  await locations.insertMany([{_id:'zone',companyId,warehouseId:'warehouse',kind:'zone',code:'Z',name:'Zone',createdAt:new Date(),updatedAt:new Date()},{_id:'aisle',companyId,warehouseId:'warehouse',parentId:'zone',kind:'aisle',code:'A',name:'Aisle',createdAt:new Date(),updatedAt:new Date()}]);
  assert.equal((await locations.findOne({_id:'aisle',companyId})).parentId,'zone');
  await categories.deleteMany({companyId});await locations.deleteMany({companyId});
  console.log('F2 Mongo smoke: PASS');
}finally{await client.close()}
