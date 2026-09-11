import React from 'react';

type Session = { accessToken: string; refreshToken: string; expiresIn?: number; user?: { id?: string; name?: string; email?: string; role?: string }; companyId?: string };
type PageState = 'loading' | 'ready' | 'error';
type Paginated<T> = { items: T[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } };
type Party = { _id: string; code: string; kind: 'person' | 'company'; roles: string[]; name: string; legalName?: string; document?: string; email?: string; phone?: string; active: boolean };
type Address = { _id: string; partyId: string; code: string; type: string; label?: string; postalCode: string; street: string; number: string; district: string; city: string; state: string; country: string; active: boolean };
type Unit = { _id: string; code: string; name: string; symbol: string; kind: string; decimalPlaces: number; active: boolean };
type PriceList = { _id: string; code: string; name: string; currency: string; validFrom?: string; validUntil?: string; active: boolean };
type Product = { _id: string; sku: string; name: string; unit: string; price: number; active: boolean };
type ProductPrice = { _id: string; priceListId: string; productId: string; amount: string; minQuantity: number; active: boolean };
type ApiError = { error?: { message?: string; code?: string } };

const API = (import.meta.env.VITE_API_URL ?? 'https://kz-erp.onrender.com').replace(/\/$/, '');
const writableRoles = new Set(['owner', 'admin', 'manager']);

async function request(path: string, session: Session, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  return fetch(`${API}${path}`, { ...options, headers });
}
async function api<T>(path: string, session: Session, options: RequestInit = {}): Promise<T> {
  const response = await request(path, session, options);
  const body = await response.json().catch(() => null) as ({ data?: T } & ApiError) | null;
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error?.code ?? `HTTP ${response.status}`);
  return (body?.data ?? body) as T;
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label>{label}<input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} /></label>;
}

export function F2MasterData({ session, onToast }: { session: Session; onToast: (message: string) => void }) {
  const canWrite = writableRoles.has(session.user?.role ?? '');
  const [tab, setTab] = React.useState<'parties' | 'units' | 'prices'>('parties');
  const [parties, setParties] = React.useState<Party[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [priceLists, setPriceLists] = React.useState<PriceList[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [prices, setPrices] = React.useState<ProductPrice[]>([]);
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [selectedParty, setSelectedParty] = React.useState<string>('');
  const [selectedPriceList, setSelectedPriceList] = React.useState<string>('');
  const [state, setState] = React.useState<PageState>('loading');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [showPartyForm, setShowPartyForm] = React.useState(false);
  const [showAddressForm, setShowAddressForm] = React.useState(false);
  const [showUnitForm, setShowUnitForm] = React.useState(false);
  const [showPriceListForm, setShowPriceListForm] = React.useState(false);
  const [showPriceForm, setShowPriceForm] = React.useState(false);

  const load = React.useCallback(async () => {
    setState('loading'); setError('');
    try {
      const [partyData, unitData, listData, productData] = await Promise.all([
        api<Paginated<Party>>('/api/v1/master-data/parties?limit=100&offset=0', session),
        api<Paginated<Unit>>('/api/v1/master-data/units?limit=100&offset=0', session),
        api<Paginated<PriceList>>('/api/v1/master-data/price-lists?limit=100&offset=0', session),
        api<Paginated<Product>>('/api/v1/master-data/products?limit=100&offset=0', session)
      ]);
      setParties(partyData.items); setUnits(unitData.items); setPriceLists(listData.items); setProducts(productData.items);
      if (!selectedParty && partyData.items[0]) setSelectedParty(partyData.items[0]._id);
      if (!selectedPriceList && listData.items[0]) setSelectedPriceList(listData.items[0]._id);
      setState('ready');
    } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Falha ao carregar dados mestres.'); }
  }, [session, selectedParty, selectedPriceList]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!selectedParty) { setAddresses([]); return; }
    void api<Paginated<Address>>(`/api/v1/master-data/parties/${selectedParty}/addresses?limit=100&offset=0`, session).then(data => setAddresses(data.items)).catch(e => setError(e instanceof Error ? e.message : 'Falha ao carregar endereços.'));
  }, [session, selectedParty]);
  React.useEffect(() => {
    if (!selectedPriceList) { setPrices([]); return; }
    void api<Paginated<ProductPrice>>(`/api/v1/master-data/price-lists/${selectedPriceList}/prices?limit=100&offset=0`, session).then(data => setPrices(data.items)).catch(e => setError(e instanceof Error ? e.message : 'Falha ao carregar preços.'));
  }, [session, selectedPriceList]);

  async function runWrite(action: () => Promise<void>, success: string) {
    setBusy(true); setError('');
    try { await action(); onToast(success); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Operação não concluída.'); }
    finally { setBusy(false); }
  }

  async function deactivate(path: string, success: string) {
    if (!canWrite || !window.confirm('Desativar este registro?')) return;
    await runWrite(async () => { await api(path, session, { method: 'DELETE' }); }, success);
  }

  return <section className="data-page">
    <div className="page-toolbar">
      <div><span className="eyebrow">F2 · DADOS MESTRES</span><h2>Cadastros centrais</h2><p>Partes, endereços, unidades e formação de preços usando os recursos oficiais da API.</p></div>
      <button className="secondary" onClick={() => void load()} disabled={state === 'loading' || busy}>Atualizar</button>
    </div>
    <div className="subnav"><button className={tab === 'parties' ? 'active' : ''} onClick={() => setTab('parties')}>Partes e endereços</button><button className={tab === 'units' ? 'active' : ''} onClick={() => setTab('units')}>Unidades</button><button className={tab === 'prices' ? 'active' : ''} onClick={() => setTab('prices')}>Tabelas de preço</button></div>
    {!canWrite && <div className="info-box">Seu perfil tem acesso somente à leitura para F2. Criação e desativação ficam bloqueadas pela interface e pela API.</div>}
    {state === 'loading' && <div className="state-box">Carregando dados mestres…</div>}
    {state === 'error' && <div className="state-box error"><strong>Não foi possível carregar os dados mestres.</strong><span>{error}</span><button onClick={() => void load()}>Tentar novamente</button></div>}
    {state === 'ready' && tab === 'parties' && <div className="f2-grid">
      <article className="panel"><div className="panel-head"><div><small>PARTIES</small><h3>Partes</h3></div><button className="primary small" disabled={!canWrite} onClick={() => setShowPartyForm(true)}>Nova parte</button></div>
        {parties.length === 0 ? <div className="state-box">Nenhuma parte cadastrada.</div> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Perfis</th><th></th></tr></thead><tbody>{parties.map(p => <tr key={p._id} className={selectedParty === p._id ? 'selected-row' : ''}><td>{p.code}</td><td><button className="link-button" onClick={() => setSelectedParty(p._id)}>{p.name}</button></td><td>{p.kind === 'company' ? 'Empresa' : 'Pessoa'}</td><td>{p.roles.join(', ')}</td><td><button className="table-action" disabled={!canWrite || !p.active || busy} onClick={() => void deactivate(`/api/v1/master-data/parties/${p._id}`, 'Parte desativada.')}>Desativar</button></td></tr>)}</tbody></table></div>}
      </article>
      <article className="panel"><div className="panel-head"><div><small>ADDRESSES</small><h3>Endereços</h3></div><button className="primary small" disabled={!canWrite || !selectedParty} onClick={() => setShowAddressForm(true)}>Novo endereço</button></div><p className="selection-note">{parties.find(p => p._id === selectedParty)?.name ?? 'Selecione uma parte.'}</p>
        {addresses.length === 0 ? <div className="state-box">Nenhum endereço cadastrado para esta parte.</div> : <div className="table-wrap"><table><thead><tr><th>Código</th><th>Tipo</th><th>Endereço</th><th></th></tr></thead><tbody>{addresses.map(a => <tr key={a._id}><td>{a.code}</td><td>{a.type}</td><td>{a.street}, {a.number} · {a.city}/{a.state}</td><td><button className="table-action" disabled={!canWrite || !a.active || busy} onClick={() => void deactivate(`/api/v1/master-data/addresses/${a._id}`, 'Endereço desativado.')}>Desativar</button></td></tr>)}</tbody></table></div>}
      </article>
    </div>}
    {state === 'ready' && tab === 'units' && <article className="panel"><div className="panel-head"><div><small>UNITS</small><h3>Unidades de medida</h3></div><button className="primary small" disabled={!canWrite} onClick={() => setShowUnitForm(true)}>Nova unidade</button></div><div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Símbolo</th><th>Tipo</th><th>Decimais</th><th></th></tr></thead><tbody>{units.map(u => <tr key={u._id}><td>{u.code}</td><td>{u.name}</td><td>{u.symbol}</td><td>{u.kind}</td><td>{u.decimalPlaces}</td><td><button className="table-action" disabled={!canWrite || !u.active || busy} onClick={() => void deactivate(`/api/v1/master-data/units/${u._id}`, 'Unidade desativada.')}>Desativar</button></td></tr>)}</tbody></table></div>{units.length === 0 && <div className="state-box">Nenhuma unidade cadastrada.</div>}</article>}
    {state === 'ready' && tab === 'prices' && <div className="f2-grid"><article className="panel"><div className="panel-head"><div><small>PRICE LISTS</small><h3>Tabelas de preço</h3></div><button className="primary small" disabled={!canWrite} onClick={() => setShowPriceListForm(true)}>Nova tabela</button></div><div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Moeda</th><th>Vigência</th><th></th></tr></thead><tbody>{priceLists.map(l => <tr key={l._id} className={selectedPriceList === l._id ? 'selected-row' : ''}><td>{l.code}</td><td><button className="link-button" onClick={() => setSelectedPriceList(l._id)}>{l.name}</button></td><td>{l.currency}</td><td>{l.validFrom ? new Date(l.validFrom).toLocaleDateString('pt-BR') : '—'} → {l.validUntil ? new Date(l.validUntil).toLocaleDateString('pt-BR') : 'aberta'}</td><td><button className="table-action" disabled={!canWrite || !l.active || busy} onClick={() => void deactivate(`/api/v1/master-data/price-lists/${l._id}`, 'Tabela desativada.')}>Desativar</button></td></tr>)}</tbody></table></div>{priceLists.length === 0 && <div className="state-box">Nenhuma tabela cadastrada.</div>}</article>
      <article className="panel"><div className="panel-head"><div><small>PRICES</small><h3>Preços da tabela</h3></div><button className="primary small" disabled={!canWrite || !selectedPriceList || products.length === 0} onClick={() => setShowPriceForm(true)}>Adicionar preço</button></div><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Preço</th><th>Mínimo</th><th>Status</th><th></th></tr></thead><tbody>{prices.map(price => <tr key={price._id}><td>{products.find(p => p._id === price.productId)?.name ?? price.productId}</td><td>R$ {price.amount}</td><td>{price.minQuantity}</td><td>{price.active ? 'Ativo' : 'Inativo'}</td><td><button className="table-action" disabled={!canWrite || !price.active || busy} onClick={() => void deactivate(`/api/v1/master-data/prices/${price._id}`, 'Preço desativado.')}>Desativar</button></td></tr>)}</tbody></table></div>{prices.length === 0 && <div className="state-box">Nenhum preço nesta tabela.</div>}</article>
    </div>}
    {showPartyForm && <PartyForm session={session} onClose={() => setShowPartyForm(false)} onCreated={() => runWrite(async () => { await api('/api/v1/master-data/parties', session, { method: 'POST', body: JSON.stringify({ code: `P-${Date.now()}`, kind: 'company', roles: ['customer'], name: 'Nova parte', active: true }) }); setShowPartyForm(false); }, 'Parte criada.')} />}
    {showAddressForm && selectedParty && <AddressForm session={session} partyId={selectedParty} onClose={() => setShowAddressForm(false)} onCreated={() => runWrite(async () => { await api('/api/v1/master-data/parties/' + selectedParty + '/addresses', session, { method: 'POST', body: JSON.stringify({ code: `A-${Date.now()}`, type: 'commercial', postalCode: '00000-000', street: 'Informar', number: 'S/N', district: 'Informar', city: 'Informar', state: 'SP', country: 'BR', active: true }) }); setShowAddressForm(false); }, 'Endereço criado.')} />}
    {showUnitForm && <UnitForm session={session} onClose={() => setShowUnitForm(false)} onCreated={() => runWrite(async () => { await api('/api/v1/master-data/units', session, { method: 'POST', body: JSON.stringify({ code: `UN-${Date.now()}`, name: 'Nova unidade', symbol: 'un', kind: 'unit', decimalPlaces: 0, active: true }) }); setShowUnitForm(false); }, 'Unidade criada.')} />}
    {showPriceListForm && <PriceListForm session={session} onClose={() => setShowPriceListForm(false)} onCreated={() => runWrite(async () => { await api('/api/v1/master-data/price-lists', session, { method: 'POST', body: JSON.stringify({ code: `PL-${Date.now()}`, name: 'Nova tabela', currency: 'BRL', active: true }) }); setShowPriceListForm(false); }, 'Tabela criada.')} />}
    {showPriceForm && selectedPriceList && <PriceForm session={session} priceListId={selectedPriceList} products={products} onClose={() => setShowPriceForm(false)} onCreated={() => runWrite(async () => { setShowPriceForm(false); const data = await api<Paginated<ProductPrice>>(`/api/v1/master-data/price-lists/${selectedPriceList}/prices?limit=100&offset=0`, session); setPrices(data.items); }, 'Preço criado.')} />}
    {error && state === 'ready' && <div className="form-error">{error}</div>}
  </section>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="form-card" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={onClose}>×</button><span className="eyebrow">F2</span><h2>{title}</h2>{children}</div></div>; }
function PartyForm({ session, onClose, onCreated }: { session: Session; onClose: () => void; onCreated: () => Promise<void> }) { const [name,setName]=React.useState(''); const [code,setCode]=React.useState(''); const [email,setEmail]=React.useState(''); const [kind,setKind]=React.useState('company'); const [error,setError]=React.useState(''); const [busy,setBusy]=React.useState(false); return <Modal title="Nova parte" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('/api/v1/master-data/parties',session,{method:'POST',body:JSON.stringify({code,name,kind,roles:['customer'],email:email||undefined,active:true})});await onCreated()}catch(e){setError(e instanceof Error?e.message:'Falha ao criar parte.')}finally{setBusy(false)}}}><Field label="Código" value={code} onChange={setCode} required/><Field label="Nome" value={name} onChange={setName} required/><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="company">Empresa</option><option value="person">Pessoa</option></select></label><Field label="E-mail" value={email} onChange={setEmail} type="email"/>{error&&<div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar'}</button></form></Modal>; }
function AddressForm({ session, partyId, onClose, onCreated }: { session: Session; partyId: string; onClose: () => void; onCreated: () => Promise<void> }) { const [values,setValues]=React.useState<Record<string,string>>({code:'',postalCode:'',street:'',number:'',district:'',city:'',state:'SP'}); const [error,setError]=React.useState(''); const [busy,setBusy]=React.useState(false); const set=(k:string,v:string)=>setValues(x=>({...x,[k]:v})); return <Modal title="Novo endereço" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api(`/api/v1/master-data/parties/${partyId}/addresses`,session,{method:'POST',body:JSON.stringify({...values,type:'commercial',country:'BR',active:true})});await onCreated()}catch(e){setError(e instanceof Error?e.message:'Falha ao criar endereço.')}finally{setBusy(false)}}}><Field label="Código" value={values.code} onChange={v=>set('code',v)} required/><Field label="CEP" value={values.postalCode} onChange={v=>set('postalCode',v)} required/><Field label="Rua" value={values.street} onChange={v=>set('street',v)} required/><Field label="Número" value={values.number} onChange={v=>set('number',v)} required/><Field label="Bairro" value={values.district} onChange={v=>set('district',v)} required/><Field label="Cidade" value={values.city} onChange={v=>set('city',v)} required/><Field label="Estado" value={values.state} onChange={v=>set('state',v)} required/>{error&&<div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar'}</button></form></Modal>; }
function UnitForm({ session, onClose, onCreated }: { session: Session; onClose: () => void; onCreated: () => Promise<void> }) { const [code,setCode]=React.useState('');const[name,setName]=React.useState('');const[symbol,setSymbol]=React.useState('');const[kind,setKind]=React.useState('unit');const[error,setError]=React.useState('');const[busy,setBusy]=React.useState(false);return <Modal title="Nova unidade" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('/api/v1/master-data/units',session,{method:'POST',body:JSON.stringify({code,name,symbol,kind,decimalPlaces:0,active:true})});await onCreated()}catch(e){setError(e instanceof Error?e.message:'Falha ao criar unidade.')}finally{setBusy(false)}}}><Field label="Código" value={code} onChange={setCode} required/><Field label="Nome" value={name} onChange={setName} required/><Field label="Símbolo" value={symbol} onChange={setSymbol} required/><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option value="unit">Unidade</option><option value="weight">Peso</option><option value="volume">Volume</option><option value="length">Comprimento</option><option value="area">Área</option><option value="time">Tempo</option><option value="other">Outro</option></select></label>{error&&<div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar'}</button></form></Modal>; }
function PriceListForm({ session, onClose, onCreated }: { session: Session; onClose: () => void; onCreated: () => Promise<void> }) { const [code,setCode]=React.useState('');const[name,setName]=React.useState('');const[currency,setCurrency]=React.useState('BRL');const[error,setError]=React.useState('');const[busy,setBusy]=React.useState(false);return <Modal title="Nova tabela de preço" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api('/api/v1/master-data/price-lists',session,{method:'POST',body:JSON.stringify({code,name,currency,active:true})});await onCreated()}catch(e){setError(e instanceof Error?e.message:'Falha ao criar tabela.')}finally{setBusy(false)}}}><Field label="Código" value={code} onChange={setCode} required/><Field label="Nome" value={name} onChange={setName} required/><Field label="Moeda" value={currency} onChange={v=>setCurrency(v.toUpperCase())} required/>{error&&<div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar'}</button></form></Modal>; }
function PriceForm({ session, priceListId, products, onClose, onCreated }: { session: Session; priceListId: string; products: Product[]; onClose: () => void; onCreated: () => Promise<void> }) { const [productId,setProductId]=React.useState(products[0]?._id??'');const[amount,setAmount]=React.useState('');const[minQuantity,setMinQuantity]=React.useState('1');const[error,setError]=React.useState('');const[busy,setBusy]=React.useState(false);return <Modal title="Adicionar preço" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api(`/api/v1/master-data/price-lists/${priceListId}/prices`,session,{method:'POST',body:JSON.stringify({productId,amount,minQuantity:Number(minQuantity),active:true})});await onCreated()}catch(e){setError(e instanceof Error?e.message:'Falha ao criar preço.')}finally{setBusy(false)}}}><label>Produto<select value={productId} onChange={e=>setProductId(e.target.value)}>{products.filter(p=>p.active).map(p=><option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}</select></label><Field label="Preço" value={amount} onChange={setAmount} required/><Field label="Quantidade mínima" value={minQuantity} onChange={setMinQuantity} type="number" required/>{error&&<div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar preço'}</button></form></Modal>; }
