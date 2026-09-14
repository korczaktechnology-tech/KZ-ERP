import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/auth.js';
import { hasPermission } from '../../core/types.js';
import { fail, ok } from '../../core/api.js';
import { tenantCollection } from '../../core/db.js';
import { F2_RELATION_TYPES, validateF2Reference } from './f2-hardening.js';
import type { Db } from 'mongodb';
const relation=z.enum(F2_RELATION_TYPES);
const relationshipPatch=z.object({sourceType:z.string().trim().min(1).max(80).optional(),sourceId:z.string().uuid().optional(),relation:relation.optional(),targetType:z.string().trim().min(1).max(80).optional(),targetId:z.string().uuid().optional(),metadata:z.record(z.string(),z.unknown()).optional()}).refine(value=>Object.keys(value).length>0,'At least one field must be supplied');
export function f2SemanticGuardRouter(db:Db){const r=Router();r.use(requireAuth);r.use('/relationships',async(req,res,next)=>{try{const user=res.locals.user;if(!hasPermission(user.role,'master-data:write'))return next();const b=req.body??{};if(req.method==='POST'||req.method==='PATCH'){if(b.relation!==undefined){const parsed=relation.safeParse(b.relation);if(!parsed.success)return fail(res,422,'VALIDATION_ERROR',`Unsupported relationship type '${String(b.relation)}'`)}}
if(req.method==='POST'){for(const [type,id,label] of [[b.sourceType,b.sourceId,'Relationship source'],[b.targetType,b.targetId,'Relationship target']] as const){if(typeof type!=='string'||typeof id!=='string')return fail(res,422,'VALIDATION_ERROR',`${label} is required`);const error=await validateF2Reference(db,user.companyId,type,id,label);if(error)return fail(res,422,'VALIDATION_ERROR',error)}}
if(req.method==='PATCH'){const id=String(req.params.id);const input=relationshipPatch.parse(b);const collection=tenantCollection<any>(db,'master_relationships');const existing=await collection.findOne(user.companyId,{_id:id});if(!existing)return fail(res,404,'NOT_FOUND');const sourceType=input.sourceType??existing.sourceType;const sourceId=input.sourceId??existing.sourceId;const targetType=input.targetType??existing.targetType;const targetId=input.targetId??existing.targetId;for(const [type,refId,label] of [[sourceType,sourceId,'Relationship source'],[targetType,targetId,'Relationship target']] as const){const error=await validateF2Reference(db,user.companyId,String(type),String(refId),label);if(error)return fail(res,422,'VALIDATION_ERROR',error)}const updated={...input,updatedAt:new Date()};await collection.updateOne(user.companyId,{_id:id},{$set:updated});const doc=await collection.findOne(user.companyId,{_id:id});await db.collection('audit_logs').insertOne({_id:randomUUID(),companyId:user.companyId,actorUserId:user.id,action:'master-data.relationship.update',resource:'relationship',resourceId:id,createdAt:new Date()});return ok(res,{relationship:doc?{id:doc._id,...doc}:null})}}
return next()}catch(error){next(error)}});return r}
