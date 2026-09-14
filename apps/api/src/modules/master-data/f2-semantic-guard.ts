import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../core/auth.js';
import { hasPermission } from '../../core/types.js';
import { fail } from '../../core/api.js';
import { F2_RELATION_TYPES, validateF2Reference } from './f2-hardening.js';
import type { Db } from 'mongodb';
const relation=z.enum(F2_RELATION_TYPES);
export function f2SemanticGuardRouter(db:Db){const r=Router();r.use(requireAuth);r.use('/relationships',async(req,res,next)=>{try{if(!['POST','PATCH'].includes(req.method))return next();const user=res.locals.user;if(!hasPermission(user.role,'master-data:write'))return next();const b=req.body??{};if(b.relation!==undefined){const parsed=relation.safeParse(b.relation);if(!parsed.success)return fail(res,422,'VALIDATION_ERROR',`Unsupported relationship type '${String(b.relation)}'`)}if(req.method==='POST'){for(const [type,id,label] of [[b.sourceType,b.sourceId,'Relationship source'],[b.targetType,b.targetId,'Relationship target']] as const){if(typeof type!=='string'||typeof id!=='string')return fail(res,422,'VALIDATION_ERROR',`${label} is required`);const error=await validateF2Reference(db,user.companyId,type,id,label);if(error)return fail(res,422,'VALIDATION_ERROR',error)}}else{for(const [type,id,label] of [[b.sourceType,b.sourceId,'Relationship source'],[b.targetType,b.targetId,'Relationship target']] as const){if(type!==undefined||id!==undefined){if(typeof type!=='string'||typeof id!=='string')return fail(res,422,'VALIDATION_ERROR',`${label} must include type and id`);const error=await validateF2Reference(db,user.companyId,type,id,label);if(error)return fail(res,422,'VALIDATION_ERROR',error)}}}return next()}catch(error){next(error)}});return r}
