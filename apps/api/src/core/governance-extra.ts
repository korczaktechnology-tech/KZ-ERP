import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { AuthUser } from './types.js';

type Scope = { _id:string; companyId:string; userId:string; module?:string; branchIds:string[]; unitIds:string[]; departmentIds:string[]; costCenterIds:string[]; teamIds:string[]; effect:'allow'|'deny'; active:boolean; createdAt:Date };
type Config = { _id:string; companyId:string; scope:'company'|'branch'|'unit'|'department'|'module'|'user'; scopeId?:string; module?:string; key:string; value:unknown; active:boolean; createdAt:Date; updatedAt:Date };

export async function ensureGovernanceIndexes(db: Db): Promise<void> {
  for (const [collection,name] of [['org_units','org_units_company_code_unique'],['departments','departments_company_code_unique'],['cost_centers','cost_centers_company_code_unique'],['teams','teams_company_code_unique']] as const) await db.collection(collection).createIndex({companyId:1,code:1},{unique:true,name});
  await db.collection('access_scopes').createIndex({companyId:1,userId:1,module:1,active:1},{name:'access_scopes_lookup'});
  await db.collection('access_policies').createIndex({companyId:1,permission:1,resource:1,active:1},{name:'access_policies_lookup'});
}

export async function getEffectiveScope(db: Db,user: AuthUser,module?:string): Promise<Scope|null> {
  const scopes=await db.collection<Scope>('access_scopes').find({companyId:user.companyId,userId:user.id,active:true,$or:[{module},{module:{$exists:false}}]}).sort({createdAt:-1}).toArray();
  const deny=scopes.find(s=>s.effect==='deny'); if(deny)return deny; return scopes.find(s=>s.effect==='allow')??null;
}

export async function getEffectiveConfiguration(db: Db,user: AuthUser,key:string,module?:string,branchId?:string,unitId?:string,departmentId?:string): Promise<Config|null> {
  const configs=await db.collection<Config>('core_configurations').find({companyId:user.companyId,key,active:true,$or:[{scope:'user',scopeId:user.id},{scope:'department',scopeId:departmentId},{scope:'unit',scopeId:unitId},{scope:'branch',scopeId:branchId},{scope:'module',module},{scope:'company'}]}).toArray();
  const rank=(c:Config)=>c.scope==='user'?6:c.scope==='department'?5:c.scope==='unit'?4:c.scope==='branch'?3:c.scope==='module'?2:1;
  return configs.filter(c=>c.scope!=='module'||c.module===module).sort((a,b)=>rank(b)-rank(a))[0]??null;
}

export async function appendAudit(db: Db,entry:{companyId:string;actorUserId:string;action:string;resource:string;resourceId?:string;metadata?:Record<string,unknown>}):Promise<void> {
  await db.collection<{_id:string;companyId:string;actorUserId:string;action:string;resource:string;resourceId?:string;metadata?:Record<string,unknown>;createdAt:Date}>('audit_logs').insertOne({_id:randomUUID(),...entry,createdAt:new Date()});
}
