import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';

type Tenant={_id:string;name:string;slug:string;companyId:string;active:boolean;createdAt:Date;updatedAt:Date};
type Company={_id?:string;name:string;slug:string;active:boolean;createdAt:Date;updatedAt:Date};
type Branch={_id:string;companyId:string;code:string;name:string;active:boolean;createdAt:Date;updatedAt:Date};

export async function ensureTenantFoundation(db:Db):Promise<void>{
 const existing=new Set((await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name));
 if(!existing.has('tenants'))await db.createCollection('tenants');
 const tenants=db.collection<Tenant>('tenants');
 await tenants.createIndex({slug:1},{unique:true,name:'tenants_slug_unique'});
 await tenants.createIndex({companyId:1},{unique:true,name:'tenants_company_unique'});
 await tenants.createIndex({active:1,createdAt:-1},{name:'tenants_active_created'});
 const companies=db.collection<Company>('companies');const branches=db.collection<Branch>('branches');
 for await(const company of companies.find({})){
  if(!company._id)continue;const now=new Date();
  await tenants.updateOne({companyId:company._id},{$set:{name:company.name,slug:company.slug,active:company.active,updatedAt:now},$setOnInsert:{_id:randomUUID(),companyId:company._id,createdAt:company.createdAt??now}},{upsert:true});
  const activeBranch=await branches.findOne({companyId:company._id,active:true},{projection:{_id:1}});
  if(!activeBranch){const branch:Branch={_id:randomUUID(),companyId:company._id,code:'MATRIZ',name:'Matriz',active:true,createdAt:now,updatedAt:now};await branches.updateOne({companyId:company._id,code:'MATRIZ'},{$setOnInsert:branch},{upsert:true});}
 }
}

export async function ensureTenantRecord(db:Db,company:{_id:string;name:string;slug:string;active:boolean;createdAt:Date;updatedAt:Date}):Promise<Tenant>{const tenants=db.collection<Tenant>('tenants');const now=new Date();await tenants.updateOne({companyId:company._id},{$set:{name:company.name,slug:company.slug,active:company.active,updatedAt:now},$setOnInsert:{_id:randomUUID(),companyId:company._id,createdAt:company.createdAt??now}},{upsert:true});const tenant=await tenants.findOne({companyId:company._id});if(!tenant)throw new Error('TENANT_NOT_FOUND_AFTER_UPSERT');return tenant;}
