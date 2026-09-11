import React from 'react';

type Session = { accessToken: string; refreshToken: string; user?: { role?: string } };
type Paginated<T> = { items: T[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } };
type Party = { _id: string; code: string; kind: 'person' | 'company'; roles: string[]; name: string; legalName?: string; document?: string; email?: string; phone?: string; active: boolean };
type Address = { _id: string; partyId: string; code: string; type: string; label?: string; postalCode: string; street: string; number: string; district: string; city: string; state: string; country: string; active: boolean };
type Unit = { _id: string; code: string; name: string; symbol: string; kind: string; decimalPlaces: number; active: boolean };
type PriceList = { _id: string; code: string; name: string; currency: string; validFrom?: string; validUntil?: string; active: boolean };
type Product = { _id: string; sku: string; name: string; description?: string; unit: string; price: number; active: boolean };
type ProductPrice = { _id: string; priceListId: string; productId: string; amount: string; minQuantity: number; active: boolean };
type Tab = 'parties' | 'products' | 'units' | 'prices';

const API = (import.meta.env.VITE_API_URL ?? 'https://kz-erp.onrender.com').replace(/\/$/, '');
const WRITE_ROLES = new Set(['owner', 'admin', 'manager']);

async function api<T>(path: string, session: Session, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null) as ({ data?: T; error?: { message?: string; code?: string } } | null);
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error?.code ?? `HTTP ${response.status}`);
  return (body?.data ?? body) as T;
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return <label>{label}<input type={type} value={value} placeholder={placeholder} required={required} onChange={e => onChange(e.target.value)} /></label>;
}
function FormActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return <div className="form-actions"><button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancelar</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>;
}
function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  if (!error) return null;
  return <div className="state-box error"><strong>Operação não concluída.</strong><span>{error}</span>{onRetry && <button onClick={onRetry}>Tentar novamente</button>}</div>;
}
function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="panel form-panel"><div className="panel-head"><div><small>F2 · CADASTRO</small><h3>{title}</h3></div></div>{children}</article>;
}

export function F2MasterData({ session, onToast }: { session: Session; onToast: (message: string) => void }) {
  const canWrite = WRITE_ROLES.has(session.user?.role ?? '');
  const [tab, setTab] = React.useState<Tab>('parties');
  const [parties, setParties] = React.useState<Party[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [lists, setLists] = React.useState<PriceList[]>([]);
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [prices, setPrices] = React.useState<ProductPrice[]>([]);
  const [selectedParty, setSelectedParty] = React.useState('');
  const [selectedList, setSelectedList] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState<Tab | 'address' | 'price' | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [p, pr, u, l] = await Promise.all([
        api<Paginated<Party>>('/api/v1/master-data/parties?limit=100&offset=0', session),
        api<Paginated<Product>>('/api/v1/master-data/products?limit=100&offset=0', session),
        api<Paginated<Unit>>('/api/v1/master-data/units?limit=100&offset=0', session),
        api<Paginated<PriceList>>('/api/v1/master-data/price-lists?limit=100&offset=0', session)
      ]);
      setParties(p.items); setProducts(pr.items); setUnits(u.items); setLists(l.items);
      setSelectedParty(current => p.items.some(x => x._id === current) ? current : (p.items[0]?._id ?? ''));
      setSelectedList(current => l.items.some(x => x._id === current) ? current : (l.items[0]?._id ?? ''));
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar dados mestres.'); }
    finally { setLoading(false); }
  }, [session]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!selectedParty) { setAddresses([]); return; }
    void api<Paginated<Address>>(`/api/v1/master-data/parties/${selectedParty}/addresses?limit=100&offset=0`, session).then(x => setAddresses(x.items)).catch(e => setError(e instanceof Error ? e.message : 'Falha ao carregar endereços.'));
  }, [session, selectedParty]);
  React.useEffect(() => {
    if (!selectedList) { setPrices([]); return; }
    void api<Paginated<ProductPrice>>(`/api/v1/master-data/price-lists/${selectedList}/prices?limit=100&offset=0`, session).then(x => setPrices(x.items)).catch(e => setError(e instanceof Error ? e.message : 'Falha ao carregar preços.'));
  }, [session, selectedList]);

  async function write(action: () => Promise<void>, message: string) {
    setBusy(true); setError('');
    try { await action(); setForm(null); setEditing(null); onToast(message); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Operação não concluída.'); }
    finally { setBusy(false); }
  }
  async function remove(path: string, message: string) {
    if (!canWrite || !window.confirm('Desativar este registro? Esta ação é lógica e auditável.')) return;
    await write(() => api(path, session, { method: 'DELETE' }).then(() => undefined), message);
  }
  const startCreate = (kind: Tab | 'address' | 'price') => { setEditing(null); setForm(kind); setError(''); };
  const startEdit = (kind: Tab | 'address' | 'price', id: string) => { setEditing(id); setForm(kind); setError(''); };
  const closeForm = () => { if (!busy) { setForm(null); setEditing(null); } };

  return <section className="data-page">
    <div className="page-toolbar"><div><span className="eyebrow">F2 · DADOS MESTRES</span><h2>Cadastros centrais</h2><p>CRUD real conectado à API oficial. Nenhum registro é criado com dados fictícios.</p></div><button className="secondary" onClick={() => void load()} disabled={loading || busy}>Atualizar</button></div>
    <div className="subnav"><button className={tab === 'parties' ? 'active' : ''} onClick={() => setTab('parties')}>Partes</button><button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>Produtos</button><button className={tab === 'units' ? 'active' : ''} onClick={() => setTab('units')}>Unidades</button><button className={tab === 'prices' ? 'active' : ''} onClick={() => setTab('prices')}>Preços</button></div>
    {!canWrite && <div className="info-box">Seu perfil possui acesso somente à leitura. A API também bloqueia operações de escrita.</div>}
    <ErrorBox error={error} onRetry={() => void load()} />
    {loading ? <div className="state-box">Carregando dados mestres…</div> : <>
      {tab === 'parties' && <PartiesTab parties={parties} addresses={addresses} selectedParty={selectedParty} setSelectedParty={setSelectedParty} canWrite={canWrite} busy={busy} onCreate={() => startCreate('parties')} onAddress={() => startCreate('address')} onEdit={id => startEdit('parties', id)} onEditAddress={id => startEdit('address', id)} onDelete={id => void remove(`/api/v1/master-data/parties/${id}`, 'Parte desativada.')} onDeleteAddress={id => void remove(`/api/v1/master-data/addresses/${id}`, 'Endereço desativado.')} />}
      {tab === 'products' && <ProductsTab products={products} canWrite={canWrite} busy={busy} onCreate={() => startCreate('products')} onEdit={id => startEdit('products', id)} onDelete={id => void remove(`/api/v1/master-data/products/${id}`, 'Produto desativado.')} />}
      {tab === 'units' && <UnitsTab units={units} canWrite={canWrite} busy={busy} onCreate={() => startCreate('units')} onEdit={id => startEdit('units', id)} onDelete={id => void remove(`/api/v1/master-data/units/${id}`, 'Unidade desativada.')} />}
      {tab === 'prices' && <PricesTab lists={lists} prices={prices} products={products} selectedList={selectedList} setSelectedList={setSelectedList} canWrite={canWrite} busy={busy} onCreateList={() => startCreate('prices')} onEditList={id => startEdit('prices', id)} onDeleteList={id => void remove(`/api/v1/master-data/price-lists/${id}`, 'Tabela desativada.')} onCreatePrice={() => startCreate('price')} onEditPrice={id => startEdit('price', id)} onDeletePrice={id => void remove(`/api/v1/master-data/prices/${id}`, 'Preço desativado.')} />}
    </>}
    {form === 'parties' && <PartyForm value={editing ? parties.find(x => x._id === editing) : undefined} busy={busy} onCancel={closeForm} onSave={payload => void write(() => editing ? api(`/api/v1/master-data/parties/${editing}`, session, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) : api('/api/v1/master-data/parties', session, { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined), editing ? 'Parte atualizada.' : 'Parte criada.')} />}
    {form === 'address' && selectedParty && <AddressForm value={editing ? addresses.find(x => x._id === editing) : undefined} busy={busy} onCancel={closeForm} onSave={payload => void write(() => editing ? api(`/api/v1/master-data/addresses/${editing}`, session, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) : api(`/api/v1/master-data/parties/${selectedParty}/addresses`, session, { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined), editing ? 'Endereço atualizado.' : 'Endereço criado.')} />}
    {form === 'products' && <ProductForm value={editing ? products.find(x => x._id === editing) : undefined} busy={busy} onCancel={closeForm} onSave={payload => void write(() => editing ? api(`/api/v1/master-data/products/${editing}`, session, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) : api('/api/v1/master-data/products', session, { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined), editing ? 'Produto atualizado.' : 'Produto criado.')} />}
    {form === 'units' && <UnitForm value={editing ? units.find(x => x._id === editing) : undefined} busy={busy} onCancel={closeForm} onSave={payload => void write(() => editing ? api(`/api/v1/master-data/units/${editing}`, session, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) : api('/api/v1/master-data/units', session, { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined), editing ? 'Unidade atualizada.' : 'Unidade criada.')} />}
    {form === 'prices' && <PriceListForm value={editing ? lists.find(x => x._id === editing) : undefined} busy={busy} onCancel={closeForm} onSave={payload => void write(() => editing ? api(`/api/v1/master-data/price-lists/${editing}`, session, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) : api('/api/v1/master-data/price-lists', session, { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined), editing ? 'Tabela atualizada.' : 'Tabela criada.')} />}
    {form === 'price' && selectedList && <PriceForm products={products} value={editing ? prices.find(x => x._id === editing) : undefined} busy={busy} onCancel={closeForm} onSave={payload => void write(() => editing ? api(`/api/v1/master-data/prices/${editing}`, session, { method: 'PATCH', body: JSON.stringify(payload) }).then(() => undefined) : api(`/api/v1/master-data/price-lists/${selectedList}/prices`, session, { method: 'POST', body: JSON.stringify(payload) }).then(() => undefined), editing ? 'Preço atualizado.' : 'Preço criado.')} />}
  </section>;
}

function Actions({ canWrite, busy, onEdit, onDelete }: { canWrite: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  return <div className="table-actions"><button className="table-action" disabled={!canWrite || busy} onClick={onEdit}>Editar</button><button className="table-action" disabled={!canWrite || busy} onClick={onDelete}>Desativar</button></div>;
}

function PartiesTab({ parties, addresses, selectedParty, setSelectedParty, canWrite, busy, onCreate, onAddress, onEdit, onEditAddress, onDelete, onDeleteAddress }: { parties: Party[]; addresses: Address[]; selectedParty: string; setSelectedParty: (v: string) => void; canWrite: boolean; busy: boolean; onCreate: () => void; onAddress: () => void; onEdit: (id: string) => void; onEditAddress: (id: string) => void; onDelete: (id: string) => void; onDeleteAddress: (id: string) => void }) {
  return <div className="f2-grid"><article className="panel"><div className="panel-head"><div><small>PARTIES</small><h3>Partes</h3></div><button className="primary small" disabled={!canWrite} onClick={onCreate}>Nova parte</button></div>{parties.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>Perfis</th><th>Status</th><th>Ações</th></tr></thead><tbody>{parties.map(p => <tr key={p._id} className={selectedParty === p._id ? 'selected-row' : ''}><td>{p.code}</td><td><button className="link-button" onClick={() => setSelectedParty(p._id)}>{p.name}</button></td><td>{p.kind === 'company' ? 'Empresa' : 'Pessoa'}</td><td>{p.roles.join(', ')}</td><td>{p.active ? 'Ativo' : 'Inativo'}</td><td><Actions canWrite={canWrite} busy={busy} onEdit={() => onEdit(p._id)} onDelete={() => onDelete(p._id)} /></td></tr>)}</tbody></table></div> : <div className="state-box">Nenhuma parte cadastrada.</div>}</article><article className="panel"><div className="panel-head"><div><small>ADDRESSES</small><h3>Endereços</h3></div><button className="primary small" disabled={!canWrite || !selectedParty} onClick={onAddress}>Novo endereço</button></div><p className="selection-note">{parties.find(p => p._id === selectedParty)?.name ?? 'Selecione uma parte.'}</p>{addresses.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Tipo</th><th>Endereço</th><th>Status</th><th>Ações</th></tr></thead><tbody>{addresses.map(a => <tr key={a._id}><td>{a.code}</td><td>{a.type}</td><td>{a.street}, {a.number} · {a.city}/{a.state}</td><td>{a.active ? 'Ativo' : 'Inativo'}</td><td><Actions canWrite={canWrite} busy={busy} onEdit={() => onEditAddress(a._id)} onDelete={() => onDeleteAddress(a._id)} /></td></tr>)}</tbody></table></div> : <div className="state-box">Nenhum endereço cadastrado para esta parte.</div>}</article></div>;
}
function ProductsTab({ products, canWrite, busy, onCreate, onEdit, onDelete }: { products: Product[]; canWrite: boolean; busy: boolean; onCreate: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return <article className="panel"><div className="panel-head"><div><small>PRODUCTS</small><h3>Produtos</h3></div><button className="primary small" disabled={!canWrite} onClick={onCreate}>Novo produto</button></div>{products.length ? <div className="table-wrap"><table><thead><tr><th>SKU</th><th>Nome</th><th>Unidade</th><th>Preço base</th><th>Status</th><th>Ações</th></tr></thead><tbody>{products.map(p => <tr key={p._id}><td>{p.sku}</td><td>{p.name}</td><td>{p.unit}</td><td>R$ {p.price.toFixed(2)}</td><td>{p.active ? 'Ativo' : 'Inativo'}</td><td><Actions canWrite={canWrite} busy={busy} onEdit={() => onEdit(p._id)} onDelete={() => onDelete(p._id)} /></td></tr>)}</tbody></table></div> : <div className="state-box">Nenhum produto cadastrado.</div>}</article>;
}
function UnitsTab({ units, canWrite, busy, onCreate, onEdit, onDelete }: { units: Unit[]; canWrite: boolean; busy: boolean; onCreate: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return <article className="panel"><div className="panel-head"><div><small>UNITS</small><h3>Unidades de medida</h3></div><button className="primary small" disabled={!canWrite} onClick={onCreate}>Nova unidade</button></div>{units.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Símbolo</th><th>Tipo</th><th>Decimais</th><th>Status</th><th>Ações</th></tr></thead><tbody>{units.map(u => <tr key={u._id}><td>{u.code}</td><td>{u.name}</td><td>{u.symbol}</td><td>{u.kind}</td><td>{u.decimalPlaces}</td><td>{u.active ? 'Ativo' : 'Inativo'}</td><td><Actions canWrite={canWrite} busy={busy} onEdit={() => onEdit(u._id)} onDelete={() => onDelete(u._id)} /></td></tr>)}</tbody></table></div> : <div className="state-box">Nenhuma unidade cadastrada.</div>}</article>;
}
function PricesTab({ lists, prices, products, selectedList, setSelectedList, canWrite, busy, onCreateList, onEditList, onDeleteList, onCreatePrice, onEditPrice, onDeletePrice }: { lists: PriceList[]; prices: ProductPrice[]; products: Product[]; selectedList: string; setSelectedList: (v: string) => void; canWrite: boolean; busy: boolean; onCreateList: () => void; onEditList: (id: string) => void; onDeleteList: (id: string) => void; onCreatePrice: () => void; onEditPrice: (id: string) => void; onDeletePrice: (id: string) => void }) {
  return <div className="f2-grid"><article className="panel"><div className="panel-head"><div><small>PRICE LISTS</small><h3>Tabelas de preço</h3></div><button className="primary small" disabled={!canWrite} onClick={onCreateList}>Nova tabela</button></div>{lists.length ? <div className="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Moeda</th><th>Vigência</th><th>Status</th><th>Ações</th></tr></thead><tbody>{lists.map(l => <tr key={l._id} className={selectedList === l._id ? 'selected-row' : ''}><td>{l.code}</td><td><button className="link-button" onClick={() => setSelectedList(l._id)}>{l.name}</button></td><td>{l.currency}</td><td>{l.validFrom ? new Date(l.validFrom).toLocaleDateString('pt-BR') : '—'} → {l.validUntil ? new Date(l.validUntil).toLocaleDateString('pt-BR') : 'aberta'}</td><td>{l.active ? 'Ativa' : 'Inativa'}</td><td><Actions canWrite={canWrite} busy={busy} onEdit={() => onEditList(l._id)} onDelete={() => onDeleteList(l._id)} /></td></tr>)}</tbody></table></div> : <div className="state-box">Nenhuma tabela cadastrada.</div>}</article><article className="panel"><div className="panel-head"><div><small>PRICES</small><h3>Preços da tabela selecionada</h3></div><button className="primary small" disabled={!canWrite || !selectedList || !products.length} onClick={onCreatePrice}>Adicionar preço</button></div>{selectedList ? (prices.length ? <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Valor</th><th>Qtd. mínima</th><th>Status</th><th>Ações</th></tr></thead><tbody>{prices.map(p => <tr key={p._id}><td>{products.find(x => x._id === p.productId)?.name ?? p.productId}</td><td>R$ {p.amount}</td><td>{p.minQuantity}</td><td>{p.active ? 'Ativo' : 'Inativo'}</td><td><Actions canWrite={canWrite} busy={busy} onEdit={() => onEditPrice(p._id)} onDelete={() => onDeletePrice(p._id)} /></td></tr>)}</tbody></table></div> : <div className="state-box">Nenhum preço cadastrado nesta tabela.</div>) : <div className="state-box">Selecione uma tabela.</div>}</article></div>;
}

function PartyForm({ value, busy, onCancel, onSave }: { value?: Party; busy: boolean; onCancel: () => void; onSave: (v: unknown) => void }) {
  const [code,setCode]=React.useState(value?.code ?? ''); const [kind,setKind]=React.useState<'person'|'company'>(value?.kind ?? 'company'); const [roles,setRoles]=React.useState(value?.roles.join(', ') ?? 'customer'); const [name,setName]=React.useState(value?.name ?? ''); const [legalName,setLegalName]=React.useState(value?.legalName ?? ''); const [document,setDocument]=React.useState(value?.document ?? ''); const [email,setEmail]=React.useState(value?.email ?? ''); const [phone,setPhone]=React.useState(value?.phone ?? '');
  return <FormCard title={value ? 'Editar parte' : 'Nova parte'}><form onSubmit={e=>{e.preventDefault();onSave({code,kind,roles:roles.split(',').map(x=>x.trim()).filter(Boolean),name,legalName:legalName||undefined,document:document||undefined,email:email||undefined,phone:phone||undefined,active:value?.active ?? true});}}><div className="form-grid"><Field label="Código" value={code} onChange={setCode} required/><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value as 'person'|'company')}><option value="company">Empresa</option><option value="person">Pessoa</option></select></label><Field label="Nome" value={name} onChange={setName} required/><Field label="Nome legal" value={legalName} onChange={setLegalName}/><Field label="Documento" value={document} onChange={setDocument}/><Field label="E-mail" value={email} onChange={setEmail} type="email"/><Field label="Telefone" value={phone} onChange={setPhone}/><Field label="Papéis (separados por vírgula)" value={roles} onChange={setRoles} required/></div><FormActions busy={busy} onCancel={onCancel}/></form></FormCard>;
}
function AddressForm({ value, busy, onCancel, onSave }: { value?: Address; busy: boolean; onCancel: () => void; onSave: (v: unknown) => void }) {
  const [code,setCode]=React.useState(value?.code ?? ''); const [type,setType]=React.useState(value?.type ?? 'commercial'); const [label,setLabel]=React.useState(value?.label ?? ''); const [postalCode,setPostalCode]=React.useState(value?.postalCode ?? ''); const [street,setStreet]=React.useState(value?.street ?? ''); const [number,setNumber]=React.useState(value?.number ?? ''); const [district,setDistrict]=React.useState(value?.district ?? ''); const [city,setCity]=React.useState(value?.city ?? ''); const [state,setState]=React.useState(value?.state ?? ''); const [country,setCountry]=React.useState(value?.country ?? 'BR');
  return <FormCard title={value ? 'Editar endereço' : 'Novo endereço'}><form onSubmit={e=>{e.preventDefault();onSave({code,type,label:label||undefined,postalCode,street,number,district,city,state,country,active:value?.active ?? true});}}><div className="form-grid"><Field label="Código" value={code} onChange={setCode} required/><label>Tipo<select value={type} onChange={e=>setType(e.target.value)}><option>commercial</option><option>billing</option><option>shipping</option><option>residential</option><option>other</option></select></label><Field label="Rótulo" value={label} onChange={setLabel}/><Field label="CEP" value={postalCode} onChange={setPostalCode} required/><Field label="Rua" value={street} onChange={setStreet} required/><Field label="Número" value={number} onChange={setNumber} required/><Field label="Bairro" value={district} onChange={setDistrict} required/><Field label="Cidade" value={city} onChange={setCity} required/><Field label="Estado" value={state} onChange={setState} required/><Field label="País" value={country} onChange={setCountry} required/></div><FormActions busy={busy} onCancel={onCancel}/></form></FormCard>;
}
function ProductForm({ value, busy, onCancel, onSave }: { value?: Product; busy: boolean; onCancel: () => void; onSave: (v: unknown) => void }) {
  const [sku,setSku]=React.useState(value?.sku ?? ''); const [name,setName]=React.useState(value?.name ?? ''); const [description,setDescription]=React.useState(value?.description ?? ''); const [unit,setUnit]=React.useState(value?.unit ?? ''); const [price,setPrice]=React.useState(value ? String(value.price) : '');
  return <FormCard title={value ? 'Editar produto' : 'Novo produto'}><form onSubmit={e=>{e.preventDefault();onSave({sku,name,description:description||undefined,unit,price:Number(price),active:value?.active ?? true});}}><div className="form-grid"><Field label="SKU" value={sku} onChange={setSku} required/><Field label="Nome" value={name} onChange={setName} required/><Field label="Descrição" value={description} onChange={setDescription}/><Field label="Unidade" value={unit} onChange={setUnit} required/><Field label="Preço base" value={price} onChange={setPrice} type="number" required/></div><FormActions busy={busy} onCancel={onCancel}/></form></FormCard>;
}
function UnitForm({ value, busy, onCancel, onSave }: { value?: Unit; busy: boolean; onCancel: () => void; onSave: (v: unknown) => void }) {
  const [code,setCode]=React.useState(value?.code ?? ''); const [name,setName]=React.useState(value?.name ?? ''); const [symbol,setSymbol]=React.useState(value?.symbol ?? ''); const [kind,setKind]=React.useState(value?.kind ?? 'unit'); const [decimalPlaces,setDecimalPlaces]=React.useState(String(value?.decimalPlaces ?? 0));
  return <FormCard title={value ? 'Editar unidade' : 'Nova unidade'}><form onSubmit={e=>{e.preventDefault();onSave({code,name,symbol,kind,decimalPlaces:Number(decimalPlaces),active:value?.active ?? true});}}><div className="form-grid"><Field label="Código" value={code} onChange={setCode} required/><Field label="Nome" value={name} onChange={setName} required/><Field label="Símbolo" value={symbol} onChange={setSymbol} required/><label>Tipo<select value={kind} onChange={e=>setKind(e.target.value)}><option>unit</option><option>weight</option><option>volume</option><option>length</option><option>area</option><option>time</option><option>other</option></select></label><Field label="Casas decimais" value={decimalPlaces} onChange={setDecimalPlaces} type="number" required/></div><FormActions busy={busy} onCancel={onCancel}/></form></FormCard>;
}
function PriceListForm({ value, busy, onCancel, onSave }: { value?: PriceList; busy: boolean; onCancel: () => void; onSave: (v: unknown) => void }) {
  const [code,setCode]=React.useState(value?.code ?? ''); const [name,setName]=React.useState(value?.name ?? ''); const [currency,setCurrency]=React.useState(value?.currency ?? 'BRL'); const [validFrom,setValidFrom]=React.useState(value?.validFrom ? value.validFrom.slice(0,10) : ''); const [validUntil,setValidUntil]=React.useState(value?.validUntil ? value.validUntil.slice(0,10) : '');
  return <FormCard title={value ? 'Editar tabela de preço' : 'Nova tabela de preço'}><form onSubmit={e=>{e.preventDefault();onSave({code,name,currency:currency.toUpperCase(),validFrom:validFrom||undefined,validUntil:validUntil||undefined,active:value?.active ?? true});}}><div className="form-grid"><Field label="Código" value={code} onChange={setCode} required/><Field label="Nome" value={name} onChange={setName} required/><Field label="Moeda (ISO 4217)" value={currency} onChange={setCurrency} required/><Field label="Válida desde" value={validFrom} onChange={setValidFrom} type="date"/><Field label="Válida até" value={validUntil} onChange={setValidUntil} type="date"/></div><FormActions busy={busy} onCancel={onCancel}/></form></FormCard>;
}
function PriceForm({ products, value, busy, onCancel, onSave }: { products: Product[]; value?: ProductPrice; busy: boolean; onCancel: () => void; onSave: (v: unknown) => void }) {
  const [productId,setProductId]=React.useState(value?.productId ?? products[0]?._id ?? ''); const [amount,setAmount]=React.useState(value?.amount ?? ''); const [minQuantity,setMinQuantity]=React.useState(String(value?.minQuantity ?? 1));
  return <FormCard title={value ? 'Editar preço' : 'Novo preço'}><form onSubmit={e=>{e.preventDefault();onSave({productId,amount,minQuantity:Number(minQuantity),active:value?.active ?? true});}}><div className="form-grid"><label>Produto<select value={productId} onChange={e=>setProductId(e.target.value)} required>{products.map(p=><option key={p._id} value={p._id}>{p.sku} · {p.name}</option>)}</select></label><Field label="Valor" value={amount} onChange={setAmount} required placeholder="149.90"/><Field label="Quantidade mínima" value={minQuantity} onChange={setMinQuantity} type="number" required/></div><FormActions busy={busy} onCancel={onCancel}/></form></FormCard>;
}
