import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authorizeABAC, hasPersistentPermission, resolveScope } from '../core/governance.js';
import { getEffectiveConfiguration } from '../core/governance-extra.js';

type User = { id:string; companyId:string; email:string; role:'owner'|'admin'|'manager'|'user'|'viewer' };
const user:User={id:'u1',companyId:'c1',email:'u@example.com',role:'manager'};
const chain=(items:unknown[])=>({find:()=>({sort:()=>({toArray:async()=>items}),toArray:async()=>items}),findOne:async()=>items[0]??null});
const db=(roles:unknown[]=[],policies:unknown[]=[],scopes:unknown[]=[],configs:unknown[]=[])=>({collection:(name:string)=>name==='role_permissions'?chain(roles):name==='access_policies'?chain(policies):name==='access_scopes'?chain(scopes):chain(configs)}) as never;

describe('F1 governance',()=>{
  it('uses persisted RBAC allow and deny decisions',async()=>{
    assert.equal(await hasPersistentPermission(db([{effect:'allow',companyId:'__SYSTEM__',roleKey:'manager',permissionKey:'sales:write'}]),user,'sales:write'),true);
    assert.equal(await hasPersistentPermission(db([{effect:'deny',companyId:'c1',roleKey:'manager',permissionKey:'sales:write'}]),user,'sales:write'),false);
  });
  it('does not let ABAC policies elevate a role without permission',async()=>{
    const policies=[{companyId:'c1',active:true,permission:'sales:read',effect:'allow',conditions:{}}];
    assert.equal(await authorizeABAC(db([],policies),user,'sales:read'),false);
    assert.equal(await authorizeABAC(db([],policies),user,'finance:write'),false);
  });
  it('applies a matching ABAC deny policy',async()=>{
    const roles=[{companyId:'__SYSTEM__',roleKey:'manager',permissionKey:'sales:write',effect:'allow'}];
    const policies=[{companyId:'c1',active:true,permission:'sales:write',effect:'deny',conditions:{resource:{$eq:'/sales/orders'}}}];
    assert.equal(await authorizeABAC(db(roles,policies),user,'sales:write',{resource:'/sales/orders'}),false);
  });
  it('resolves active scopes for the authenticated user',async()=>{
    const scopes=[{companyId:'c1',userId:'u1',active:true,module:'sales',effect:'allow',branchIds:['b1'],unitIds:[],departmentIds:[],costCenterIds:[],teamIds:[]}];
    const result=await resolveScope(db([],[],scopes),user,'sales');
    assert.equal(result.length,1);assert.deepEqual(result[0].branchIds,['b1']);
  });
  it('selects the most specific configuration',async()=>{
    const configs=[
      {companyId:'c1',scope:'company',key:'currency',value:'BRL',active:true,createdAt:new Date('2026-01-01')},
      {companyId:'c1',scope:'branch',scopeId:'b1',key:'currency',value:'USD',active:true,createdAt:new Date('2026-01-02')},
      {companyId:'c1',scope:'user',scopeId:'u1',key:'currency',value:'EUR',active:true,createdAt:new Date('2026-01-03')}
    ];
    const result=await getEffectiveConfiguration(db([],[],[],configs),user,'currency',undefined,'b1');
    assert.equal(result?.value,'EUR');
  });
});
