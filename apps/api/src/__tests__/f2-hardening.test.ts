import test from 'node:test';
import assert from 'node:assert/strict';
import { validLocationParentKind, wouldCreateCycle } from '../modules/master-data/f2-hardening.js';

test('warehouse location hierarchy only accepts the immediate semantic parent',()=>{assert.equal(validLocationParentKind('zone'),undefined===undefined);assert.equal(validLocationParentKind('aisle','zone'),true);assert.equal(validLocationParentKind('rack','zone'),false);assert.equal(validLocationParentKind('rack','aisle'),true);assert.equal(validLocationParentKind('shelf','rack'),true);assert.equal(validLocationParentKind('bin','shelf'),true);});
test('warehouse root cannot have a parent',()=>{assert.equal(validLocationParentKind('zone','zone'),false);});
test('cycle detection catches indirect parent cycles',async()=>{const docs=new Map([['a',{parentId:'b'}],['b',{parentId:'c'}],['c',{parentId:'a'}]]);const c:any={findOne:async(filter:any)=>docs.get(filter._id)??null};assert.equal(await wouldCreateCycle(c,'company','a','b'),true);});
test('cycle detection accepts an acyclic hierarchy',async()=>{const docs=new Map([['child',{parentId:'parent'}],['parent',{parentId:undefined}]]);const c:any={findOne:async(filter:any)=>docs.get(filter._id)??null};assert.equal(await wouldCreateCycle(c,'company','new','parent'),false);});
test('cycle detection stops at missing parents',async()=>{const c:any={findOne:async()=>null};assert.equal(await wouldCreateCycle(c,'company','new','missing'),false);});
