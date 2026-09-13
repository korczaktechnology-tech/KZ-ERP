import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { requireActiveSession } from './auth.js';
import { fail, ok, paginated, parsePagination } from './api.js';
import { ROLE_PERMISSIONS, ROLES, type AuthUser, type Role } from './types.js';

type BaseDoc = { _id: string; companyId: string; name: string; code: string; active: boolean; createdAt: Date; updatedAt: Date };
type RoleDoc = { _id: string; companyId: string; key: Role; name: string; description?: string; active: boolean; createdAt: Date; updatedAt: Date };
type PermissionDoc = { _id: string; key: string; name: string; description?: string; createdAt: Date; updatedAt: Date };
type RolePermissionDoc = { _id: string; companyId: string; roleKey: Role; permissionKey: string; effect: 'allow' | 'deny'; createdAt: Date; updatedAt: Date };
type ScopeDoc = { _id: string; companyId: string; userId: string; module?: string; branchIds: string[]; unitIds: string[]; departmentIds: string[]; costCenterIds: string[]; teamIds: string[]; effect: 'allow' | 'deny'; active: boolean; createdAt: Date; updatedAt: Date };
type PolicyDoc = { _id: string; companyId: string; name: string; effect: 'allow' | 'deny'; permission: string; resource?: string; conditions: Record<string, unknown>; active: boolean; createdAt: Date; updatedAt: Date };
type ConfigDoc = { _id: string; companyId: string; scope: 'company' | 'branch' | 'unit' | 'department' | 'module' | 'user'; scopeId?: string; module?: string; key: string; value: unknown; active: boolean; createdAt: Date; updatedAt: Date };

type Actor = AuthUser;
const id = () => randomUUID();
const now = () => new Date();
const codeSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const nameSchema = z.string().trim().min(2).max(160);
const baseCreate = z.object({ code: codeSchema, name: nameSchema, active: z.boolean().default(true) });
const baseUpdate = z.object({ code: codeSchema.optional(), name: nameSchema.optional(), active: z.boolean().optional() }).refine(v => Object.keys(v).length > 0, 'At least one field must be supplied');
const permissionSchema = z.object({ key: z.string().trim().min(2).max(120).regex(/^[a-z0-9][a-z0-9:._-]*$/), name: nameSchema, description: z.string().trim().max(500).optional() });
const rolePermissionSchema = z.object({ roleKey: z.enum(ROLES), permissionKey: z.string().trim().min(2).max(120), effect: z.enum(['allow', 'deny']).default('allow') });
const scopeSchema = z.object({ userId: z.string().min(1), module: z.string().trim().max(80).optional(), branchIds: z.array(z.string().min(1)).max(200).default([]), unitIds: z.array(z.string().min(1)).max(200).default([]), departmentIds: z.array(z.string().min(1)).max(200).default([]), costCenterIds: z.array(z.string().min(1)).max(200).default([]), teamIds: z.array(z.string().min(1)).max(200).default([]), effect: z.enum(['allow', 'deny']).default('allow'), active: z.boolean().default(true) });
const policySchema = z.object({ name: nameSchema, effect: z.enum(['allow', 'deny']), permission: z.string().trim().min(2).max(120), resource: z.string().trim().max(120).optional(), conditions: z.record(z.string(), z.unknown()).default({}), active: z.boolean().default(true) });
const configSchema = z.object({ scope: z.enum(['company','branch','unit','department','module','user']), scopeId: z.string().min(1).optional(), module: z.string().trim().max(80).optional(), key: z.string().trim().min(1).max(160), value: z.unknown(), active: z.boolean().default(true) });
const roleNames: Record<Role,string> = { owner:'Owner', admin:'Administrator', manager:'Manager', user:'Usuário', viewer:'Visualizador' };

function actor(res: { locals: { user?: unknown } }): Actor { return res.locals.user as Actor; }
function canWrite(a: Actor): boolean { return a.role === 'owner' || a.role === 'admin'; }
function canRead(a: Actor): boolean { return a.role === 'owner' || a.role === 'admin' || a.role === 'manager'; }
async function audit(db: Db, companyId: string, actorUserId: string, action: string, resource: string, resourceId: string | undefined, metadata?: Record<string, unknown>) {
  await db.collection('audit_logs').insertOne({ _id: id(), companyId, actorUserId, action, resource, resourceId, metadata, createdAt: now() });
}
async function ensureCollection(db: Db, name: string): Promise<void> { const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name)); if (!names.has(name)) await db.createCollection(name); }

export async function ensureGovernanceCollections(db: Db): Promise<void> {
  for (const n of ['roles','permissions','role_permissions','access_scopes','access_policies','org_units','departments','cost_centers','teams','core_configurations']) await ensureCollection(db,n);
  const roles = db.collection<RoleDoc>('roles');
  for (const key of ROLES) await roles.updateOne({ companyId: '__SYSTEM__', key }, { $setOnInsert: { _id:id(), companyId:'__SYSTEM__', key, name:roleNames[key], active:true, createdAt:now(), updatedAt:now() } }, { upsert:true });
  const permissions = db.collection<PermissionDoc>('permissions');
  const keys = new Set(Object.values(ROLE_PERMISSIONS).flat());
  keys.delete('*');
  for (const key of keys) await permissions.updateOne({ key }, { $setOnInsert:{ _id:id(), key, name:key, createdAt:now(), updatedAt:now() } }, { upsert:true });
  for (const name of ['roles','permissions','role_permissions','access_scopes','access_policies','org_units','departments','cost_centers','teams','core_configurations']) { await db.collection(name).createIndex({ companyId:1, createdAt:-1 }, { name:`${name}_company_created` }); }
  await roles.createIndex({ companyId:1, key:1 }, { unique:true, name:'roles_company_key_unique' });
  await permissions.createIndex({ key:1 }, { unique:true, name:'permissions_key_unique' });
  await db.collection('role_permissions').createIndex({ companyId:1, roleKey:1, permissionKey:1 }, { unique:true, name:'role_permissions_unique' });
  await db.collection('access_scopes').createIndex({ companyId:1,userId:1,module:1,active:1 });
  await db.collection('access_policies').createIndex({ companyId:1,permission:1,active:1 });
  await db.collection('core_configurations').createIndex({ companyId:1,scope:1,scopeId:1,module:1,key:1 }, { unique:true, name:'core_config_unique' });
  for (const key of ROLES) { const defaults = ROLE_PERMISSIONS[key]; for (const permissionKey of defaults) if (permissionKey !== '*') await db.collection<RolePermissionDoc>('role_permissions').updateOne({ companyId:'__SYSTEM__',roleKey:key,permissionKey },{$setOnInsert:{_id:id(),companyId:'__SYSTEM__',roleKey:key,permissionKey,effect:'allow',createdAt:now(),updatedAt:now()}},{upsert:true}); }
}

export async function hasPersistentPermission(db: Db, user: AuthUser, permission: string): Promise<boolean> {
  if (user.role === 'owner') return true;
  const custom = await db.collection<RolePermissionDoc>('role_permissions').find({ $or:[{companyId:user.companyId},{companyId:'__SYSTEM__'}], roleKey:user.role, permissionKey:permission }).sort({companyId:-1}).toArray();
  if (custom.some(x => x.effect === 'deny')) return false;
  if (custom.some(x => x.effect === 'allow')) return true;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}

function matchesConditions(conditions: Record<string, unknown>, context: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = context[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const op = expected as Record<string, unknown>;
      if ('$in' in op && !Array.isArray(op.$in)) return false;
      if ('$in' in op && !(op.$in as unknown[]).includes(actual)) return false;
      if ('$eq' in op && actual !== op.$eq) return false;
      if ('$ne' in op && actual === op.$ne) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

export async function authorizeABAC(db: Db, user: AuthUser, permission: string, context: Record<string, unknown> = {}): Promise<boolean> {
  if (!(await hasPersistentPermission(db,user,permission))) return false;
  const policies = await db.collection<PolicyDoc>('access_policies').find({companyId:user.companyId,active:true,$or:[{permission},{permission:'*'}]}).toArray();
  const relevant = policies.filter(p => !p.resource || !context.resource || p.resource === context.resource).filter(p => matchesConditions(p.conditions, {...context,userId:user.id,companyId:user.companyId,role:user.role}));
  if (relevant.some(p => p.effect === 'deny')) return false;
  if (relevant.some(p => p.effect === 'allow')) return true;
  return true;
}

export async function resolveScope(db: Db, user: AuthUser, module?: string) {
  const scopes = await db.collection<ScopeDoc>('access_scopes').find({companyId:user.companyId,userId:user.id,active:true,$or:[{module},{module:{$exists:false}}]}).toArray();
  return scopes;
}

export function governanceRouter(db: Db): Router {
  const router = Router(); router.use(requireActiveSession(db));
  const collectionFor = (kind:string) => db.collection<BaseDoc>(kind);
  const resourceKinds = ['org_units','departments','cost_centers','teams'] as const;
  for (const kind of resourceKinds) {
    router.get(`/core/${kind}`, async (req,res,next)=>{ try { const a=actor(res); if(!canRead(a)){fail(res,403,'FORBIDDEN');return;} const p=parsePagination(req.query); const c=collectionFor(kind); const [items,total]=await Promise.all([c.find({companyId:a.companyId}).sort({code:1}).skip(p.offset).limit(p.limit).toArray(),c.countDocuments({companyId:a.companyId})]); paginated(res,items,total,p); } catch(e){next(e);} });
    router.post(`/core/${kind}`, async (req,res,next)=>{ try { const a=actor(res); if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;} const input=baseCreate.parse(req.body); const t=now(); const doc={_id:id(),companyId:a.companyId,...input,createdAt:t,updatedAt:t}; await collectionFor(kind).insertOne(doc); await audit(db,a.companyId,a.id,`core.${kind}.create`,kind,doc._id,{code:doc.code}); ok(res,{[kind.slice(0,-1)]:doc},201); }catch(e){next(e);} });
    router.patch(`/core/${kind}/:id`, async (req,res,next)=>{ try { const a=actor(res); if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;} const input=baseUpdate.parse(req.body); const t=now(); const result=await collectionFor(kind).updateOne({_id:req.params.id,companyId:a.companyId},{$set:{...input,updatedAt:t}}); if(result.matchedCount!==1){fail(res,404,'NOT_FOUND');return;} const doc=await collectionFor(kind).findOne({_id:req.params.id,companyId:a.companyId}); await audit(db,a.companyId,a.id,`core.${kind}.update`,kind,req.params.id,{changed:Object.keys(input)}); ok(res,{[kind.slice(0,-1)]:doc}); }catch(e){next(e);} });
  }
  router.get('/core/rbac/roles', async(req,res,next)=>{try{const a=actor(res);if(!canRead(a)){fail(res,403,'FORBIDDEN');return;}const roles=await db.collection<RoleDoc>('roles').find({$or:[{companyId:'__SYSTEM__'},{companyId:a.companyId}]}).sort({key:1}).toArray();ok(res,{roles});}catch(e){next(e);}});
  router.get('/core/rbac/permissions', async(req,res,next)=>{try{const a=actor(res);if(!canRead(a)){fail(res,403,'FORBIDDEN');return;}ok(res,{permissions:await db.collection<PermissionDoc>('permissions').find({}).sort({key:1}).toArray()});}catch(e){next(e);}});
  router.post('/core/rbac/permissions', async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=permissionSchema.parse(req.body);const t=now();const doc={_id:id(),...input,createdAt:t,updatedAt:t};await db.collection<PermissionDoc>('permissions').insertOne(doc);await audit(db,a.companyId,a.id,'core.rbac.permission.create','permission',doc._id,{key:doc.key});ok(res,{permission:doc},201);}catch(e){next(e);}});
  router.put('/core/rbac/role-permissions', async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=rolePermissionSchema.parse(req.body);const t=now();const doc={_id:id(),companyId:a.companyId,...input,createdAt:t,updatedAt:t};await db.collection<RolePermissionDoc>('role_permissions').updateOne({companyId:a.companyId,roleKey:input.roleKey,permissionKey:input.permissionKey},{$set:{effect:input.effect,updatedAt:t},$setOnInsert:{_id:doc._id,createdAt:t}},{upsert:true});await audit(db,a.companyId,a.id,'core.rbac.role_permission.update','role_permission',`${input.roleKey}:${input.permissionKey}`,input);ok(res,{rolePermission:{...input,companyId:a.companyId}});}catch(e){next(e);}});
  router.get('/core/rbac/role-permissions/:roleKey', async(req,res,next)=>{try{const a=actor(res);if(!canRead(a)){fail(res,403,'FORBIDDEN');return;}const role=z.enum(ROLES).parse(req.params.roleKey);const items=await db.collection<RolePermissionDoc>('role_permissions').find({$or:[{companyId:'__SYSTEM__'},{companyId:a.companyId}],roleKey:role}).sort({permissionKey:1}).toArray();ok(res,{role,permissions:items});}catch(e){next(e);}});
  router.get('/core/scopes',async(req,res,next)=>{try{const a=actor(res);if(!canRead(a)){fail(res,403,'FORBIDDEN');return;}const p=parsePagination(req.query);const filter:{companyId:string;userId?:string}={companyId:a.companyId};if(typeof req.query.userId==='string')filter.userId=req.query.userId;const c=db.collection<ScopeDoc>('access_scopes');const [items,total]=await Promise.all([c.find(filter).sort({createdAt:-1}).skip(p.offset).limit(p.limit).toArray(),c.countDocuments(filter)]);paginated(res,items,total,p);}catch(e){next(e);}});
  router.post('/core/scopes',async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=scopeSchema.parse(req.body);const user=await db.collection('users').findOne({_id:input.userId,companyId:a.companyId});if(!user){fail(res,404,'NOT_FOUND','User not found');return;}const t=now();const doc={_id:id(),companyId:a.companyId,...input,createdAt:t,updatedAt:t};await db.collection<ScopeDoc>('access_scopes').insertOne(doc);await audit(db,a.companyId,a.id,'core.scope.create','scope',doc._id,{userId:doc.userId,module:doc.module});ok(res,{scope:doc},201);}catch(e){next(e);}});
  router.patch('/core/scopes/:id',async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=scopeSchema.partial().parse(req.body);const result=await db.collection<ScopeDoc>('access_scopes').updateOne({_id:req.params.id,companyId:a.companyId},{$set:{...input,updatedAt:now()}});if(result.matchedCount!==1){fail(res,404,'NOT_FOUND');return;}ok(res,{scope:await db.collection<ScopeDoc>('access_scopes').findOne({_id:req.params.id,companyId:a.companyId})});}catch(e){next(e);}});
  router.get('/core/policies',async(req,res,next)=>{try{const a=actor(res);if(!canRead(a)){fail(res,403,'FORBIDDEN');return;}ok(res,{policies:await db.collection<PolicyDoc>('access_policies').find({companyId:a.companyId}).sort({createdAt:-1}).toArray()});}catch(e){next(e);}});
  router.post('/core/policies',async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=policySchema.parse(req.body);const t=now();const doc={_id:id(),companyId:a.companyId,...input,createdAt:t,updatedAt:t};await db.collection<PolicyDoc>('access_policies').insertOne(doc);await audit(db,a.companyId,a.id,'core.policy.create','policy',doc._id,{permission:doc.permission,effect:doc.effect});ok(res,{policy:doc},201);}catch(e){next(e);}});
  router.patch('/core/policies/:id',async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=policySchema.partial().parse(req.body);const result=await db.collection<PolicyDoc>('access_policies').updateOne({_id:req.params.id,companyId:a.companyId},{$set:{...input,updatedAt:now()}});if(result.matchedCount!==1){fail(res,404,'NOT_FOUND');return;}await audit(db,a.companyId,a.id,'core.policy.update','policy',req.params.id,{changed:Object.keys(input)});ok(res,{policy:await db.collection<PolicyDoc>('access_policies').findOne({_id:req.params.id,companyId:a.companyId})});}catch(e){next(e);}});
  router.get('/core/configurations',async(req,res,next)=>{try{const a=actor(res);if(!canRead(a)){fail(res,403,'FORBIDDEN');return;}const p=parsePagination(req.query);const c=db.collection<ConfigDoc>('core_configurations');const [items,total]=await Promise.all([c.find({companyId:a.companyId}).sort({key:1}).skip(p.offset).limit(p.limit).toArray(),c.countDocuments({companyId:a.companyId})]);paginated(res,items,total,p);}catch(e){next(e);}});
  router.put('/core/configurations',async(req,res,next)=>{try{const a=actor(res);if(!canWrite(a)){fail(res,403,'FORBIDDEN');return;}const input=configSchema.parse(req.body);if(input.scope!=='company'&&!input.scopeId){fail(res,400,'VALIDATION_ERROR','scopeId is required for this configuration scope');return;}const t=now();await db.collection<ConfigDoc>('core_configurations').updateOne({companyId:a.companyId,scope:input.scope,scopeId:input.scopeId,module:input.module,key:input.key},{$set:{...input,companyId:a.companyId,updatedAt:t},$setOnInsert:{_id:id(),createdAt:t}},{upsert:true});const doc=await db.collection<ConfigDoc>('core_configurations').findOne({companyId:a.companyId,scope:input.scope,scopeId:input.scopeId,module:input.module,key:input.key});await audit(db,a.companyId,a.id,'core.configuration.upsert','configuration',doc?._id,{scope:input.scope,scopeId:input.scopeId,module:input.module,key:input.key});ok(res,{configuration:doc});}catch(e){next(e);}});
  return router;
}
