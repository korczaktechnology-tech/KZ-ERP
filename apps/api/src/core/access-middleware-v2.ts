import type { NextFunction, Request, Response } from 'express';
import type { Db } from 'mongodb';
import type { AuthUser } from './types.js';
import { authorizeABAC, resolveScope } from './governance.js';

const moduleFor = (path:string):string|null => {
  if (path.startsWith('/core/tenant')||path.startsWith('/core/company')||path.startsWith('/core/branches')||path.startsWith('/core/org_units')||path.startsWith('/core/departments')||path.startsWith('/core/cost_centers')||path.startsWith('/core/teams')||path.startsWith('/core/configurations')) return 'company';
  if (path.startsWith('/core/users')||path.startsWith('/core/rbac')||path.startsWith('/core/scopes')||path.startsWith('/core/policies')) return 'users';
  if (path.startsWith('/core/audit')) return 'audit';
  return path.split('/').filter(Boolean)[0]??null;
};
const permissionFor=(method:string,path:string):string|null=>{if(path==='/core/me')return null;const module=moduleFor(path);return module?`${module}:${method==='GET'||method==='HEAD'?'read':'write'}`:null;};
const value=(req:Request,key:string):string|undefined=>{for(const source of [req.body as Record<string,unknown>|undefined,req.query as Record<string,unknown>,req.params as Record<string,unknown>]){const v=source?.[key];if(typeof v==='string'&&v)return v;}return undefined;};
export function accessControlGuardV2(db:Db){return async(req:Request,res:Response,next:NextFunction):Promise<void>=>{
  if(req.path.startsWith('/auth/')||req.path==='/system'){next();return;}
  const user=res.locals.user as AuthUser|undefined;if(!user){next();return;}
  const permission=permissionFor(req.method,req.path);
  if(permission&&!(await authorizeABAC(db,user,permission,{resource:req.path,method:req.method}))){res.status(403).json({error:{code:'FORBIDDEN',message:'Access denied'},requestId:res.locals.requestId});return;}
  const module=moduleFor(req.path);if(!module){next();return;}
  const scopes=(await resolveScope(db,user,module)).filter(s=>!s.module||s.module===module);
  const dimensions=[['branchId','branchIds'],['unitId','unitIds'],['departmentId','departmentIds'],['costCenterId','costCenterIds'],['teamId','teamIds']] as const;
  for(const [requestKey,scopeKey] of dimensions){const v=value(req,requestKey);const allows=scopes.filter(s=>s.effect==='allow'&&s[scopeKey].length>0);if(v){if(scopes.some(s=>s.effect==='deny'&&s[scopeKey].includes(v))||(allows.length>0&&!allows.some(s=>s[scopeKey].includes(v)))){res.status(403).json({error:{code:'SCOPE_DENIED',message:'Scope restriction'},requestId:res.locals.requestId});return;}}else if(req.method==='GET'&&allows.length>0){res.status(403).json({error:{code:'SCOPE_FILTER_REQUIRED',message:'Scope filter required'},requestId:res.locals.requestId});return;}}
  next();
};}
