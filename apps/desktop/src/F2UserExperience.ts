import './F2UserExperience.css';

const API='/api/v1/master-data';
const lookupMap:Record<string,string>={
  'Lista de preços':'/price-lists?limit=1000&offset=0',
  'Produto':'/products?limit=1000&offset=0',
  'Parceiro':'/parties?limit=1000&offset=0',
  'Armazém':'/warehouses?limit=1000&offset=0',
  'Categoria pai':'/f2/categories?limit=1000&offset=0',
  'Localização pai':'/f2/warehouse-locations?limit=1000&offset=0',
  'Centro pai':'/f2/cost-centers?limit=1000&offset=0',
  'Unidade pai':'/f2/org-units?limit=1000&offset=0',
  'Classificação pai':'/f2/classifications?limit=1000&offset=0'
};

function unwrap(v:any){const x=v?.data??v;return x?.items??x?.records??x}
function labelFor(row:any){return String(row?.name??row?.code??row?.sku??row?.symbol??row?.id??row?._id??'')}
function idFor(row:any){return String(row?.id??row?._id??'')}

async function addLookup(input:HTMLInputElement,label:string){
  const normalized=label.replace(/\s*\(ID\)/g,'').trim();
  const path=lookupMap[normalized];
  if(!path||input.dataset.kzLookup)return;
  input.dataset.kzLookup='loading';
  try{
    const response=await fetch(`${API}${path}`,{credentials:'include'});
    if(!response.ok)throw new Error('lookup');
    const data=unwrap(await response.json());
    if(!Array.isArray(data))return;
    const listId=`kz-f2-lookup-${Math.random().toString(36).slice(2)}`;
    const list=document.createElement('datalist');list.id=listId;
    for(const row of data){const id=idFor(row);if(!id)continue;const option=document.createElement('option');option.value=id;option.label=labelFor(row);list.appendChild(option)}
    input.setAttribute('list',listId);input.insertAdjacentElement('afterend',list);
    input.title='Use a lista de sugestões para localizar o registro pelo nome, código ou identificador.';
    input.dataset.kzLookup='ready';
  }catch{input.dataset.kzLookup='failed'}
}

function hideTechnicalMetadata(root:ParentNode){
  root.querySelectorAll<HTMLElement>('.f2-pro-field').forEach(field=>{
    const text=(field.querySelector('label')?.textContent??'').trim().toLowerCase();
    if(text.includes('metadados json'))field.classList.add('kz-f2-technical-hidden');
  });
}

function improveLabels(root:ParentNode){
  root.querySelectorAll<HTMLElement>('.f2-pro-field label').forEach(label=>{
    const text=label.textContent??'';
    if(text.includes('(ID)'))label.textContent=text.replace(/\s*\(ID\)/g,'');
  });
  root.querySelectorAll<HTMLElement>('label').forEach(label=>{
    const text=(label.textContent??'').trim();
    if(text==='MIME type')label.textContent='Tipo de arquivo';
    if(text==='Tamanho (bytes)')label.textContent='Tamanho';
    if(text==='Chave de armazenamento')label.textContent='Armazenamento';
    if(text==='Checksum')label.textContent='Verificação do arquivo';
  });
}

function improveSearch(root:ParentNode){
  root.querySelectorAll<HTMLInputElement>('.f2-pro-search input').forEach(input=>{
    input.placeholder='Pesquisar cadastros por nome, código, SKU, documento ou parceiro…';
    input.setAttribute('aria-label','Pesquisar cadastros');
  });
}

function addDownloads(root:ParentNode){
  const heading=[...root.querySelectorAll<HTMLElement>('.f2-pro-card h3')].find(x=>x.textContent?.trim()==='Anexos e documentos');
  if(!heading)return;
  const card=heading.closest('.f2-pro-card');
  card?.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row=>{
    if(row.dataset.kzDownload==='ready')return;
    const id=row.querySelector('.f2-pro-id')?.textContent?.trim();
    const actions=row.querySelector('.f2-pro-actions');
    if(!id||!actions)return;
    const button=document.createElement('button');button.type='button';button.textContent='Baixar';button.className='kz-f2-download';button.title='Baixar arquivo';
    button.addEventListener('click',async()=>{
      button.disabled=true;button.textContent='Baixando…';
      try{
        const response=await fetch(`${API}/f2/attachments/${encodeURIComponent(id)}/file`,{credentials:'include'});
        if(!response.ok)throw new Error('Falha ao baixar o arquivo.');
        const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=row.querySelector('.f2-pro-primary')?.textContent?.trim()||`anexo-${id}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(error){window.alert(error instanceof Error?error.message:'Falha ao baixar o arquivo.')}finally{button.disabled=false;button.textContent='Baixar'}
    });
    actions.insertBefore(button,actions.firstChild);row.dataset.kzDownload='ready';
  });
}

function improveLookups(root:ParentNode){
  root.querySelectorAll<HTMLInputElement>('.f2-pro-field input').forEach(input=>{
    const label=input.closest('.f2-pro-field')?.querySelector('label')?.textContent?.replace('*','').trim()??'';
    void addLookup(input,label);
  });
}

function renameAdministration(){
  if(!document.body)return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const nodes:Text[]=[];let node:Node|null;
  while((node=walker.nextNode()))nodes.push(node as Text);
  for(const text of nodes){const value=text.nodeValue??'';if(value.includes('Administração'))text.nodeValue=value.replaceAll('Administração','Configurações')}
}

function apply(){
  const root=document.querySelector('.f2-pro');
  if(root){hideTechnicalMetadata(root);improveLabels(root);improveSearch(root);improveLookups(root);addDownloads(root)}
  renameAdministration();
}

let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}

function start(){
  if(!document.body){window.addEventListener('DOMContentLoaded',start,{once:true});return}
  const observer=new MutationObserver(schedule);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  window.addEventListener('load',schedule);schedule();
}
start();
