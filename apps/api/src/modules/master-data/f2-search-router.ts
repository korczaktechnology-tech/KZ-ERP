import type { Db } from 'mongodb';
import { Router } from 'express';
import { requireAuth } from '../../core/auth.js';
import { hasPermission, type Role } from '../../core/types.js';
import { tenantCollection } from '../../core/db.js';
import { fail, ok } from '../../core/api.js';
type Actor={id:string;companyId:string;role:Role};
type Doc={_id:string;companyId:string;[key:string]:unknown};
const defs:Array<[string,string,string[]]>=[
 ['products','products',['sku','name']],['brands','product_brands',['code','name']],['parties','parties',['code','name','email']],['warehouses','warehouses',['code','name']],['categories','product_categories',['code','name']],['units','units',['code','name','symbol']],['priceLists','price_lists',['code','name','currency']],['prices','prices',['amount','productId','priceListId']],['contacts','party_contacts',['name','email','phone','mobile']],['classifications','classifications',['code','name','type']],['locations','warehouse_locations',['code','name','kind']],['addresses','addresses',['code','postalCode','street','city','state']],['costCenters','cost_centers',['code','name']],['orgUnits','org_units',['code','name','type']],['relationships','master_relationships',['sourceType','sourceId','relation','targetType','targetId']],['attachments','master_attachments',['fileName','entityType','entityId']]
];
export function f2SearchRouter(db:Db):Router{const r=Router();r.use(requireAuth);r.get('/search',async(req,res,next)=>{try{const actor=res.locals.user as Actor;if(!hasPermission(actor.role,'master-data:read'))return fail(res,403,'FORBIDDEN');const query=String(req.query.q??'').trim();if(query.length<2)return fail(res,400,'VALIDATION_ERROR','q must contain at least 2 characters');const regex={$regex:query.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&'),$options:'i'};const results:Record<string,unknown[]|undefined>={};for(const[name,collection,fields] of defs){const c=tenantCollection<Doc>(db,collection);results[name]=await c.find(actor.companyId,{$or:fields.map(field=>({[field]:regex}))}).sort({createdAt:-1}).limit(10).toArray().then(items=>items.map(({companyId:_companyId,...doc})=>doc));}return ok(res,{query,results});}catch(error){next(error);}});return r;}
