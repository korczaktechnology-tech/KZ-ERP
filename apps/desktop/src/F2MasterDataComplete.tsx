import React from 'react';
import './F2MasterDataComplete.css';

type Api=<T=unknown>(path:string,options?:RequestInit)=>Promise<T>;
type Row=Record<string,unknown>&{_id?:string;id?:string};
type Resource={key:string;label:string;title:string;core?:boolean;importable?:boolean};
const resources:Resource[]=[
  {key:'products',label:'Produtos',title:'Produtos',importable:true},
  {key:'categories',label:'Categorias',title:'Categorias',importable:true},
  {key:'brands',label:'Marcas',title:'Marcas',importable:true},
  {key:'units',label:'Unidades',title:'Unidades de medida',importable:true},
  {key:'price_lists',label:'Listas de preços',title:'Listas de preços',importable:true},
  {key:'prices',label:'Preços',title:'Preços',importable:true},
  {key:'parties',label:'Parceiros',title:'Parceiros',importable:true},
  {key:'addresses',label:'Endereços',title:'Endereços',importable:true},
  {key:'contacts',label:'Contatos',title:'Pessoas e contatos',importable:true},
  {key:'warehouses',label:'Armazéns',title:'Armazéns',importable:true},
  {key:'locations',label:'Estrutura física',title:'Estrutura física do armazém',importable:true},
  {key:'classifications',label:'Classificações',title:'Classificações auxiliares',importable:true},
  {key:'cost_centers',label:'Centros de custo',title:'Centros de custo',core:true,importable:true},
  {key:'org_units',label:'Estrutura organizacional',title:'Estrutura organizacional',core:true,importable:true},
  {key:'relationships',label:'Relacionamentos',title:'Relacionamentos',importable:true},
  {key:'attachments',label:'Anexos',title:'Anexos e documentos',importable:true}
];
const importEntities=resources.filter(r=>r.importable);
const masterPaths:Record<string,string>={products:'/api/v1/master-data/products',units:'/api/v1/master-data/units',price_lists:'/api/v1/master-data/price-lists',parties:'/api/v1/master-data/parties',warehouses:'/api/v1/master-data/warehouses'};
const f2Paths:Record<string,string>={categories:'/api/v1/master-data/f2/categories',brands:'/api/v1/master-data/f2/brands',contacts:'/api/v1/master-data/f2/contacts',locations:'/api/v1/master-data/f2/warehouse-locations',classifications:'/api/v1/master-data/f2/classifications',relationships:'/api/v1/master-data/f2/relationships',attachments:'/api/v1/master-data/f2/attachments'};
const corePaths:Record<string,string>={cost_centers:'/api/v1/master-data/f2/cost-centers',org_units:'/api/v1/master-data/f2/org-units'};
const attachmentTypes:Record<string,string>={products:'product',categories:'category',brands:'brand',units:'unit',price_lists:'price_list',prices:'price',parties:'party',addresses:'address',contacts:'contact',warehouses:'warehouse',locations:'location',classifications:'classification',cost_centers:'cost_center',org_units:'org_unit',relationships:'relationship',attachments:'attachment'};
function idOf(r:Row){return String(r.id??r._id??'')}
function unwrap<T=unknown>(v:any):T{const value=v?.data??v;return (value?.items??value?.records??value) as T}
function display(r:Row){for(const k of ['name','code','sku','fileName','relation','type'])if(r[k]!=null)return String(r[k]);return idOf(r)}
function pathFor(resource:Resource){return resource.core?corePaths[resource.key]:masterPaths[resource.key]??f2Paths[resource.key]}

export function F2MasterDataComplete({api,onNavigateAdmin,onToast}:{api:Api;onNavigateAdmin:()=>void;onToast:(message:string)=>void}){
  const[resource,setResource]=React.useState(resources[0]);
  const[rows,setRows]=React.useState<Row[]>([]);
  const[selected,setSelected]=React.useState<Row|null>(null);
  const[json,setJson]=React.useState('{}');
  const[query,setQuery]=React.useState('');
  const[loading,setLoading]=React.useState(false);
  const[busy,setBusy]=React.useState(false);
  const[error,setError]=React.useState('');
  const[tool,setTool]=React.useState<'none'|'search'|'integrity'|'io'|'audit'>('none');
  const[importEntity,setImportEntity]=React.useState(importEntities[0].key);
  const[importJson,setImportJson]=React.useState('[\n\n]');
  const[health,setHealth]=React.useState<unknown>(null);
  const[auditRows,setAuditRows]=React.useState<Row[]>([]);
  const[file,setFile]=React.useState<File|null>(null);

  const load=React.useCallback(async()=>{
    setLoading(true);setError('');
    try{
      if(resource.key==='addresses'){
        const parties=unwrap<Row[]>(await api('/api/v1/master-data/parties?limit=1000&offset=0'));
        const grouped=await Promise.all(parties.map(async party=>{const partyId=idOf(party);if(!partyId)return[];try{return unwrap<Row[]>(await api(`/api/v1/master-data/parties/${encodeURIComponent(partyId)}/addresses?limit=1000&offset=0`))}catch{return[]}}));
        setRows(grouped.flat());
      }else if(resource.key==='prices'){
        const lists=unwrap<Row[]>(await api('/api/v1/master-data/price-lists?limit=1000&offset=0'));
        const grouped=await Promise.all(lists.map(async list=>{const listId=idOf(list);if(!listId)return[];try{return unwrap<Row[]>(await api(`/api/v1/master-data/price-lists/${encodeURIComponent(listId)}/prices?limit=1000&offset=0`))}catch{return[]}}));
        setRows(grouped.flat());
      }else{
        const r=await api<any>(`${pathFor(resource)}?limit=100&offset=0`);const v=unwrap<Row[]>(r);setRows(Array.isArray(v)?v:[]);
      }
    }catch(e){setRows([]);setError(e instanceof Error?e.message:'Falha ao carregar o cadastro.')}finally{setLoading(false)}
  },[api,resource]);
  React.useEffect(()=>{setSelected(null);setJson('{}');if(tool==='none'||tool==='audit')void load()},[load,tool]);

  function select(r:Row){setSelected(r);const c={...r};delete c._id;setJson(JSON.stringify({...c,id:idOf(r)},null,2))}
  async function save(){
    setBusy(true);setError('');
    try{
      const p=JSON.parse(json);const id=selected?idOf(selected):'';let endpoint=pathFor(resource);let method=id?'PATCH':'POST';
      if(resource.key==='addresses'){
        if(id){endpoint=`/api/v1/master-data/addresses/${encodeURIComponent(id)}`;delete p.id;delete p._id}else{const partyId=String(p.partyId??'');if(!partyId)throw new Error('partyId é obrigatório para criar um endereço.');endpoint=`/api/v1/master-data/parties/${encodeURIComponent(partyId)}/addresses`;delete p.id;delete p._id;method='POST'}
      }else if(resource.key==='prices'){
        if(id){endpoint=`/api/v1/master-data/prices/${encodeURIComponent(id)}`;delete p.id;delete p._id;delete p.priceListId}else{const listId=String(p.priceListId??'');if(!listId)throw new Error('priceListId é obrigatório para criar um preço.');endpoint=`/api/v1/master-data/price-lists/${encodeURIComponent(listId)}/prices`;delete p.id;delete p._id;delete p.priceListId;method='POST'}
      }else{delete p.id;delete p._id}
      await api(endpoint,{method,body:JSON.stringify(p)});onToast(id?'Registro atualizado.':'Registro criado.');setSelected(null);setJson('{}');await load();
    }catch(e){setError(e instanceof Error?e.message:'JSON inválido ou operação recusada.')}finally{setBusy(false)}
  }
  async function remove(r:Row){
    const id=idOf(r);if(!id||!window.confirm('Desativar este registro?'))return;setBusy(true);setError('');
    try{let endpoint=`${pathFor(resource)}/${encodeURIComponent(id)}`;if(resource.key==='addresses')endpoint=`/api/v1/master-data/addresses/${encodeURIComponent(id)}`;if(resource.key==='prices')endpoint=`/api/v1/master-data/prices/${encodeURIComponent(id)}`;await api(endpoint,{method:'DELETE'});onToast('Registro desativado.');await load()}catch(e){setError(e instanceof Error?e.message:'Falha ao desativar.')}finally{setBusy(false)}
  }
  async function runSearch(){
    const q=query.trim();if(q.length<2){setError('A busca precisa de pelo menos 2 caracteres.');return}setLoading(true);setError('');
    try{const response=await api<any>(`/api/v1/master-data/f2/search?q=${encodeURIComponent(q)}`);const value=unwrap<any>(response);const results=value?.results??{};const flattened=Object.entries(results).flatMap(([type,items])=>(Array.isArray(items)?items:[]).map(item=>({...item,searchType:type})));setRows(flattened as Row[])}catch(e){setError(e instanceof Error?e.message:'Falha na busca.')}finally{setLoading(false)}
  }
  async function runIntegrity(){setLoading(true);setError('');try{setHealth(await api('/api/v1/master-data/f2/integrity'))}catch(e){setError(e instanceof Error?e.message:'Falha na integridade.')}finally{setLoading(false)}}
  async function runAudit(){setLoading(true);setError('');try{const r=await api<any>('/api/v1/core/audit?limit=100&offset=0');const v=unwrap<Row[]>(r);setAuditRows(Array.isArray(v)?v:[])}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar auditoria.')}finally{setLoading(false)}}
  async function exportEntity(){setBusy(true);setError('');try{const r=await api<any>(`/api/v1/master-data/f2/bulk/export/${importEntity}`);const blob=new Blob([JSON.stringify(unwrap(r),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`kz-erp-f2-${importEntity}.json`;a.click();URL.revokeObjectURL(url);onToast('Exportação concluída.')}catch(e){setError(e instanceof Error?e.message:'Falha na exportação.')}finally{setBusy(false)}}
  async function importBatch(){setBusy(true);setError('');try{const p=JSON.parse(importJson);if(!Array.isArray(p))throw new Error('A importação deve ser um array JSON.');const r=await api<any>(`/api/v1/master-data/f2/bulk/import/${importEntity}`,{method:'POST',body:JSON.stringify(p)});const value=unwrap<any>(r);onToast(`Importação concluída: ${value?.inserted??0} registros.`);await load()}catch(e){setError(e instanceof Error?e.message:'Falha na importação.')}finally{setBusy(false)}}
  async function uploadAttachment(){
    if(!file||!selected)return setError('Selecione um registro e um arquivo.');setBusy(true);setError('');
    try{const entityType=attachmentTypes[resource.key];if(!entityType)throw new Error('Este cadastro não aceita anexos diretamente.');await api('/api/v1/master-data/f2/attachments/upload',{method:'POST',headers:{'x-f2-entity-type':entityType,'x-f2-entity-id':idOf(selected),'x-f2-file-name':file.name,'x-f2-mime-type':file.type||'application/octet-stream'},body:file});onToast('Anexo enviado.');setFile(null)}catch(e){setError(e instanceof Error?e.message:'Falha no upload do anexo.')}finally{setBusy(false)}
  }
  const canAttach=Boolean(attachmentTypes[resource.key]);

  return <section className="f2-complete">
    <div className="f2-complete-head"><div><span className="eyebrow">F2 · DADOS MESTRES</span><h2>Cadastros completos</h2><p>Catálogo operacional conectado à API real, com isolamento por tenant e permissões.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading||busy}>Atualizar</button></div>
    <div className="f2-complete-tools"><button className={tool==='search'?'active':''} onClick={()=>setTool(tool==='search'?'none':'search')}>Busca global</button><button className={tool==='integrity'?'active':''} onClick={()=>{setTool('integrity');void runIntegrity()}}>Integridade</button><button className={tool==='io'?'active':''} onClick={()=>setTool(tool==='io'?'none':'io')}>Importar / exportar</button><button className={tool==='audit'?'active':''} onClick={()=>{setTool('audit');void runAudit()}}>Auditoria</button></div>
    {tool==='search'&&<div className="f2-tool"><div className="inline-form"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SKU, código, nome, parceiro…"/><button className="primary" onClick={()=>void runSearch()}>Buscar</button></div></div>}
    {tool==='integrity'&&<div className="f2-tool"><pre>{JSON.stringify(health,null,2)}</pre></div>}
    {tool==='audit'&&<div className="f2-tool"><pre>{JSON.stringify(auditRows,null,2)}</pre></div>}
    {tool==='io'&&<div className="f2-tool io-grid"><div><label>Entidade<select value={importEntity} onChange={e=>setImportEntity(e.target.value)}>{importEntities.map(x=><option key={x.key} value={x.key}>{x.label}</option>)}</select></label><button className="secondary" onClick={()=>void exportEntity()} disabled={busy}>Exportar JSON</button></div><div><label>Importação JSON<textarea value={importJson} onChange={e=>setImportJson(e.target.value)}/></label><button className="primary" onClick={()=>void importBatch()} disabled={busy}>Importar</button></div></div>}
    {error&&<div className="f2-error">{error}</div>}
    <div className="f2-layout"><aside className="f2-menu">{resources.map(x=><button key={x.key} className={resource.key===x.key?'active':''} onClick={()=>{setTool('none');setResource(x)}}>{x.label}</button>)}</aside>
      <div className="f2-content"><div className="f2-content-head"><div><small>{resource.core?'CORE':'F2'}</small><h3>{resource.title}</h3></div><button className="primary small" onClick={()=>{setSelected(null);setJson('{}')}} disabled={busy}>Novo</button></div>
        {loading?<div className="state-box">Carregando…</div>:<div className="f2-table"><table><thead><tr><th>Registro</th><th>ID</th><th>Resumo</th><th>Ações</th></tr></thead><tbody>{rows.map(r=><tr key={`${resource.key}-${idOf(r)}`}><td>{display(r)}</td><td><code>{idOf(r).slice(0,12)}</code></td><td>{r.active===false?'Inativo':'Ativo'}{r.kind?` · ${String(r.kind)}`:''}</td><td><button className="table-action" onClick={()=>select(r)}>Editar</button><button className="table-action" onClick={()=>void remove(r)} disabled={busy}>Desativar</button></td></tr>)}{rows.length===0&&<tr><td colSpan={4}>Nenhum registro encontrado.</td></tr>}</tbody></table></div>}
        <div className="f2-editor"><div className="panel-head"><div><small>{selected?'EDIÇÃO':'CRIAÇÃO'}</small><h3>{selected?`Editar ${resource.title}`:`Novo ${resource.title}`}</h3></div></div><textarea value={json} onChange={e=>setJson(e.target.value)} spellCheck={false}/><div className="form-actions"><button className="secondary" onClick={()=>setJson('{}')}>Limpar</button><button className="primary" onClick={()=>void save()} disabled={busy}>{busy?'Salvando…':selected?'Salvar alterações':'Criar registro'}</button></div>{selected&&canAttach&&<div className="f2-attachment"><label>Arquivo <input type="file" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={busy}/></label><button className="secondary" onClick={()=>void uploadAttachment()} disabled={busy||!file}>Enviar anexo</button></div>}</div>
        <p className="f2-footnote">Dados persistidos no tenant atual. Nenhuma operação fictícia é exibida.</p>
      </div>
    </div>
  </section>
}