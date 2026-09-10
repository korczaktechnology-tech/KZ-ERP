import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './styles.css';
import { checkForUpdate } from './updater';

type View = 'overview' | 'cadastros' | 'operacoes' | 'financeiro' | 'fiscal' | 'relatorios' | 'configuracoes';
type Resource = 'products' | 'customers' | 'suppliers' | 'warehouses';
type Session = { accessToken: string; refreshToken: string; expiresIn?: number; user?: { id?: string; name?: string; email?: string; role?: string }; companyId?: string };
type ApiError = { error?: { code?: string; message?: string; details?: unknown }; requestId?: string };
type PageState = 'loading' | 'ready' | 'error';

const API = (import.meta.env.VITE_API_URL ?? 'https://kz-erp.onrender.com').replace(/\/$/, '');
const nav: { id: View; label: string; icon: string; implemented: boolean }[] = [
  { id: 'overview', label: 'Visão geral', icon: '⌂', implemented: true },
  { id: 'cadastros', label: 'Cadastros', icon: '▦', implemented: true },
  { id: 'operacoes', label: 'Operações', icon: '⇄', implemented: true },
  { id: 'financeiro', label: 'Financeiro', icon: '◈', implemented: false },
  { id: 'fiscal', label: 'Fiscal', icon: '◇', implemented: false },
  { id: 'relatorios', label: 'Relatórios', icon: '▤', implemented: false },
  { id: 'configuracoes', label: 'Configurações', icon: '⚙', implemented: true }
];

function readSession(): Session | null { try { const raw = localStorage.getItem('kz-erp-session'); return raw ? JSON.parse(raw) as Session : null; } catch { return null; } }
function saveSession(session: Session) { localStorage.setItem('kz-erp-session', JSON.stringify(session)); }
function clearSession() { localStorage.removeItem('kz-erp-session'); }

async function requestRaw(path: string, options: RequestInit = {}, token?: string): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const headers = new Headers(options.headers);
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return await fetch(`${API}${path}`, { ...options, headers, signal: controller.signal });
  } finally { window.clearTimeout(timer); }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { data?: T } & ApiError | null;
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error?.code ?? `HTTP ${response.status}`);
  return (body?.data ?? body) as T;
}

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await requestRaw(path, options, token);
  return parseResponse<T>(response);
}

async function apiWithSession<T>(path: string, session: Session, options: RequestInit = {}, onRefresh?: (next: Session) => void): Promise<T> {
  let response = await requestRaw(path, options, session.accessToken);
  if (response.status !== 401 || !session.refreshToken) return parseResponse<T>(response);
  try {
    const refreshed = await api<{ accessToken: string; refreshToken: string; expiresIn: number }>('/api/v1/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: session.refreshToken }) });
    const next = { ...session, ...refreshed };
    saveSession(next); onRefresh?.(next);
    response = await requestRaw(path, options, next.accessToken);
    return parseResponse<T>(response);
  } catch { clearSession(); throw new Error('Sessão expirada. Entre novamente.'); }
}

type SystemInfo = { name: string; version: string; integrationNamespaces: string[] };
type Company = { name: string; slug: string; active?: boolean };
type Me = { user: { id: string; email: string; name: string; role: string }; companyId: string };
type MasterItem = { _id?: string; sku?: string; code?: string; name: string; description?: string; unit?: string; price?: number; document?: string; email?: string; phone?: string; active: boolean; createdAt?: string };
type Paginated<T> = { items: T[]; pagination: { limit: number; offset: number; total: number; hasMore: boolean } };
type Product = MasterItem & { sku: string; unit: string; price: number };
type Party = MasterItem & { code: string };
type Warehouse = MasterItem & { code: string };
type OrderLine = { productId: string; description: string; quantity: number; unitPrice: number; total: number };
type Order = { _id: string; number: string; customerId: string; status: string; lines: OrderLine[]; subtotal: number; total: number; createdAt: string };

function WindowControls() {
  const win = getCurrentWindow();
  return <div className="window-controls" data-tauri-drag-region>
    <button aria-label="Minimizar" onClick={() => void win.minimize()}>−</button>
    <button aria-label="Maximizar ou restaurar" onClick={() => void win.toggleMaximize()}>□</button>
    <button className="close-window" aria-label="Fechar" onClick={() => void win.close()}>×</button>
  </div>;
}

function Titlebar({ status }: { status: string }) {
  const win = getCurrentWindow();
  return <div className="titlebar" data-tauri-drag-region onDoubleClick={() => void win.toggleMaximize()}>
    <div className="titlebar-brand"><span className="brand-mark mini">KZ</span><strong>KORCZAK ERP</strong><span className="titlebar-status">{status}</span></div>
    <WindowControls />
  </div>;
}

function App() {
  const [view, setView] = React.useState<View>('overview');
  const [apiStatus, setApiStatus] = React.useState<'connecting' | 'online' | 'offline'>('connecting');
  const [session, setSession] = React.useState<Session | null>(readSession);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [me, setMe] = React.useState<Me | null>(null);
  const [system, setSystem] = React.useState<SystemInfo | null>(null);
  const [updateStatus, setUpdateStatus] = React.useState('Verificando atualizações…');
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [healthError, setHealthError] = React.useState('');

  const checkConnection = React.useCallback(async () => {
    setApiStatus('connecting'); setHealthError('');
    try {
      await api<{ status: string }>('/health');
      const info = await api<SystemInfo>('/api/v1/system');
      setSystem(info); setApiStatus('online');
    } catch (error) {
      setApiStatus('offline'); setHealthError(error instanceof Error ? error.message : 'Falha de conexão');
    }
  }, []);

  React.useEffect(() => { void checkConnection(); void checkForUpdate(setUpdateStatus); }, [checkConnection]);

  const hydrateSession = React.useCallback(async (current: Session) => {
    try {
      const [identity, companyData] = await Promise.all([
        apiWithSession<Me>('/api/v1/core/me', current, {}, setSession),
        apiWithSession<{ company: Company }>('/api/v1/core/company', current, {}, setSession)
      ]);
      setMe(identity); setCompany(companyData.company);
    } catch (error) {
      clearSession(); setSession(null); setMe(null); setCompany(null);
      setToast(error instanceof Error ? error.message : 'Sessão inválida.');
    }
  }, []);

  React.useEffect(() => { if (session) void hydrateSession(session); }, [session, hydrateSession]);

  function logout() {
    const current = session;
    clearSession(); setSession(null); setMe(null); setCompany(null);
    if (current?.refreshToken) void api('/api/v1/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: current.refreshToken }) }).catch(() => undefined);
    setToast('Sessão encerrada.');
  }

  function navigate(next: View) { setView(next); }
  const title = nav.find(item => item.id === view)?.label ?? 'Visão geral';
  const statusLabel = apiStatus === 'online' ? 'API online' : apiStatus === 'connecting' ? 'Conectando…' : 'API offline';

  return <div className="app-root">
    <Titlebar status={statusLabel} />
    <div className="shell">
      <aside>
        <div className="brand"><div className="brand-mark">KZ</div><div><strong>KORCZAK</strong><small>ERP</small></div></div>
        <div className="workspace"><span className={`workspace-dot ${apiStatus === 'online' ? 'online' : ''}`} /> {company?.name ?? (session ? 'Carregando empresa…' : 'Não autenticado')}</div>
        <nav>{nav.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><span>{item.icon}</span>{item.label}{!item.implemented && <small className="nav-badge">PREPARADO</small>}</button>)}</nav>
        <div className="side-status"><span className={`dot ${apiStatus === 'online' ? 'online' : ''}`} /> API {statusLabel}<br/><small>{updateStatus}</small></div>
      </aside>

      <main>
        <header><div><p className="eyebrow">KORCZAK TECHNOLOGIES / KORCZAK ERP</p><h1>{title}</h1></div><div className="header-actions"><div className="connection"><span className={`dot ${apiStatus === 'online' ? 'online' : ''}`} /> {statusLabel}</div>{session ? <button className="user-button" onClick={logout}>{me?.user.name ?? session.user?.email ?? 'Conta'} <span>↪</span></button> : <button className="primary small" onClick={() => setLoginOpen(true)}>Entrar</button>}</div></header>

        {apiStatus === 'offline' && <div className="banner-error"><strong>API indisponível</strong><span>{healthError || 'Não foi possível conectar ao backend.'}</span><button onClick={() => void checkConnection()}>Tentar novamente</button></div>}
        {view === 'overview' && <Dashboard apiStatus={apiStatus} session={session} company={company} system={system} onLogin={() => setLoginOpen(true)} onNavigate={navigate} />}
        {view === 'cadastros' && <MasterDataHub session={session} onNavigate={navigate} onToast={setToast} />}
        {view === 'operacoes' && <SalesPage session={session} onToast={setToast} />}
        {view === 'configuracoes' && <SettingsPage session={session} me={me} company={company} system={system} onRefresh={() => session && void hydrateSession(session)} onLogout={logout} />}
        {(view === 'financeiro' || view === 'fiscal' || view === 'relatorios') && <PreparedModule title={title} />}
      </main>
    </div>
    {loginOpen && <Login onClose={() => setLoginOpen(false)} onSuccess={(next) => { saveSession(next); setSession(next); setLoginOpen(false); setToast('Login realizado.'); }} />}
    {toast && <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div>}
  </div>;
}

function Dashboard({ apiStatus, session, company, system, onLogin, onNavigate }: { apiStatus: string; session: Session | null; company: Company | null; system: SystemInfo | null; onLogin: () => void; onNavigate: (view: View) => void }) {
  return <>
    <section className="hero"><div className="hero-copy"><span className="tag">ERP • LINUX DESKTOP</span><h2>Operação centralizada.<br/><em>Dados reais, estado real.</em></h2><p>O centro operacional da Korczak, conectado à API oficial, com isolamento por empresa e sem acesso direto do desktop ao MongoDB.</p><div className="hero-actions">{session ? <button className="primary" onClick={() => onNavigate('cadastros')}>Abrir operação <span>→</span></button> : <button className="primary" onClick={onLogin}>Acessar ERP <span>→</span></button>}<span className="secure">● API server-side · MongoDB protegido</span></div></div><div className="orb"><div>KZ</div><span>{apiStatus === 'online' ? 'ONLINE' : apiStatus.toUpperCase()}</span></div></section>
    <section className="metrics"><Metric label="SISTEMA" value={apiStatus === 'online' ? 'Operacional' : apiStatus === 'connecting' ? 'Conectando…' : 'Offline'} detail={system ? `v${system.version}` : 'Health check'} state={apiStatus === 'online'} /><Metric label="EMPRESA" value={company?.name ?? (session ? 'Carregando…' : 'Não autenticado')} detail={company?.slug ?? 'Sessão necessária'} state={!!company} /><Metric label="USUÁRIO" value={session ? (session.user?.name ?? 'Autenticado') : 'Não autenticado'} detail={session?.user?.role ?? 'Faça login'} state={!!session} /><Metric label="INTEGRAÇÕES" value={system ? `${system.integrationNamespaces.length} namespaces` : 'Não carregado'} detail="Contratos da API" state={!!system} /></section>
    <section className="content-grid"><article className="panel"><div className="panel-head"><div><small>ACESSO RÁPIDO</small><h3>Centro de operações</h3></div><span>01</span></div><div className="quick-grid"><Quick icon="▦" title="Produtos" text="Catálogo e preços" onClick={() => onNavigate('cadastros')} /><Quick icon="♙" title="Clientes" text="Base comercial" onClick={() => onNavigate('cadastros')} /><Quick icon="▣" title="Pedidos" text="Vendas e operações" onClick={() => onNavigate('operacoes')} /><Quick icon="◈" title="Estoque" text="Depósitos" onClick={() => onNavigate('cadastros')} /></div></article><article className="panel status-panel"><div className="panel-head"><div><small>ESTADO REAL</small><h3>Plataforma</h3></div><span>02</span></div><StatusRow label="CORE" text={session ? 'Identidade autenticada' : 'Login necessário'} state={!!session} /><StatusRow label="API" text={apiStatus === 'online' ? 'Health check respondeu' : apiStatus === 'connecting' ? 'Verificando /health' : 'Falha no health check'} state={apiStatus === 'online'} /><StatusRow label="SYSTEM" text={system ? `${system.integrationNamespaces.length} namespaces` : 'Aguardando API'} state={!!system} /></article></section>
  </>;
}
function Metric({ label, value, detail, state }: { label: string; value: string; detail: string; state?: boolean }) { return <article className="metric"><small>{label}</small><strong>{value}</strong><span><i className={`dot ${state ? 'online' : ''}`} />{detail}</span></article>; }
function Quick({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) { return <button className="quick" onClick={onClick}><span className="quick-icon">{icon}</span><span><strong>{title}</strong><small>{text}</small></span><b>→</b></button>; }
function StatusRow({ label, text, state }: { label: string; text: string; state: boolean }) { return <div className="status-row"><span className={`dot ${state ? 'online' : ''}`} /><div><strong>{label}</strong><small>{text}</small></div><b>{state ? 'OK' : '—'}</b></div>; }

function MasterDataHub({ session, onNavigate, onToast }: { session: Session | null; onNavigate: (v: View) => void; onToast: (s: string) => void }) {
  const [resource, setResource] = React.useState<Resource>('products');
  if (!session) return <AuthRequired onLogin={() => onToast('Faça login pelo botão Entrar no topo.')} />;
  return <section className="data-page"><div className="subnav">{([['products','Produtos'],['customers','Clientes'],['suppliers','Fornecedores'],['warehouses','Depósitos']] as [Resource,string][]).map(([id,label]) => <button className={resource === id ? 'active' : ''} key={id} onClick={() => setResource(id)}>{label}</button>)}<button onClick={() => onNavigate('operacoes')}>Pedidos →</button></div><MasterTable resource={resource} session={session} onToast={onToast} /></section>;
}

function MasterTable({ resource, session, onToast }: { resource: Resource; session: Session; onToast: (s: string) => void }) {
  const [state, setState] = React.useState<PageState>('loading');
  const [items, setItems] = React.useState<MasterItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    setState('loading');
    try { const data = await apiWithSession<Paginated<MasterItem>>(`/api/v1/master-data/${resource}?limit=100&offset=0`, session, {}, (next) => { session = next; }); setItems(data.items); setTotal(data.pagination.total); setState('ready'); }
    catch { setState('error'); }
  }, [resource, session]);
  React.useEffect(() => { void load(); }, [load]);

  async function deactivate(id: string) { if (!window.confirm('Desativar este registro?')) return; setBusy(true); try { await apiWithSession(`/api/v1/master-data/${resource}/${id}`, session, { method: 'DELETE' }); onToast('Registro desativado.'); await load(); } catch (e) { onToast(e instanceof Error ? e.message : 'Não foi possível desativar.'); } finally { setBusy(false); } }
  const labels: Record<Resource,string> = { products: 'Produtos', customers: 'Clientes', suppliers: 'Fornecedores', warehouses: 'Depósitos' };
  return <><div className="page-toolbar"><div><span className="eyebrow">DADOS MESTRES</span><h2>{labels[resource]}</h2><p>{total} registro(s) retornado(s) pela API.</p></div><div><button className="secondary" onClick={() => void load()} disabled={state === 'loading' || busy}>Atualizar</button><button className="primary small" onClick={() => setFormOpen(true)}>Novo</button></div></div>
    {state === 'loading' && <div className="state-box">Carregando {labels[resource].toLowerCase()}…</div>}
    {state === 'error' && <div className="state-box error"><strong>Não foi possível carregar.</strong><button onClick={() => void load()}>Tentar novamente</button></div>}
    {state === 'ready' && items.length === 0 && <div className="state-box">Nenhum registro cadastrado.</div>}
    {state === 'ready' && items.length > 0 && <div className="table-wrap"><table><thead><tr><th>Código / SKU</th><th>Nome</th><th>Detalhes</th><th>Status</th><th></th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td>{item.sku ?? item.code ?? '—'}</td><td>{item.name}</td><td>{item.sku ? `${item.unit ?? '—'} · R$ ${(item.price ?? 0).toFixed(2)}` : item.email ?? item.phone ?? item.document ?? '—'}</td><td><span className={`status-pill ${item.active ? 'active' : ''}`}>{item.active ? 'Ativo' : 'Inativo'}</span></td><td><button className="table-action" disabled={!item.active || busy} onClick={() => item._id && void deactivate(item._id)}>Desativar</button></td></tr>)}</tbody></table></div>}
    {formOpen && <MasterForm resource={resource} session={session} onClose={() => setFormOpen(false)} onCreated={async () => { setFormOpen(false); onToast('Registro criado.'); await load(); }} />}
  </>;
}

function MasterForm({ resource, session, onClose, onCreated }: { resource: Resource; session: Session; onClose: () => void; onCreated: () => Promise<void> }) {
  const [values, setValues] = React.useState<Record<string,string>>({}); const [error, setError] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const fields: Record<Resource,{ key: string; label: string; type?: string; required?: boolean }[]> = {
    products: [{key:'sku',label:'SKU',required:true},{key:'name',label:'Nome',required:true},{key:'unit',label:'Unidade',required:true},{key:'price',label:'Preço',type:'number',required:true},{key:'description',label:'Descrição'}],
    customers: [{key:'code',label:'Código',required:true},{key:'name',label:'Nome',required:true},{key:'document',label:'Documento'},{key:'email',label:'E-mail',type:'email'},{key:'phone',label:'Telefone'}],
    suppliers: [{key:'code',label:'Código',required:true},{key:'name',label:'Nome',required:true},{key:'document',label:'Documento'},{key:'email',label:'E-mail',type:'email'},{key:'phone',label:'Telefone'}],
    warehouses: [{key:'code',label:'Código',required:true},{key:'name',label:'Nome',required:true}]
  };
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const body: Record<string,unknown> = {...values, active:true}; if (resource === 'products') body.price = Number(values.price); await apiWithSession(`/api/v1/master-data/${resource}`, session, { method:'POST', body: JSON.stringify(body) }); await onCreated(); } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível criar.'); } finally { setBusy(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="form-card" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={onClose}>×</button><span className="eyebrow">NOVO REGISTRO</span><h2>Cadastrar</h2><form onSubmit={submit}>{fields[resource].map(field => <label key={field.key}>{field.label}<input type={field.type ?? 'text'} value={values[field.key] ?? ''} onChange={e => setValues(v => ({...v,[field.key]:e.target.value}))} required={field.required} /></label>)}{error && <div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar registro'}</button></form></div></div>;
}

function SalesPage({ session, onToast }: { session: Session | null; onToast: (s: string) => void }) {
  if (!session) return <AuthRequired onLogin={() => onToast('Faça login pelo botão Entrar no topo.')} />;
  return <SalesContent session={session} onToast={onToast} />;
}
function SalesContent({ session, onToast }: { session: Session; onToast: (s: string) => void }) {
  const [orders, setOrders] = React.useState<Order[]>([]); const [customers, setCustomers] = React.useState<Party[]>([]); const [products, setProducts] = React.useState<Product[]>([]); const [state,setState]=React.useState<PageState>('loading'); const [formOpen,setFormOpen]=React.useState(false);
  const load = React.useCallback(async () => { setState('loading'); try { const [o,c,p]=await Promise.all([apiWithSession<Paginated<Order>>('/api/v1/sales/orders?limit=100&offset=0',session),apiWithSession<Paginated<Party>>('/api/v1/master-data/customers?limit=100&offset=0',session),apiWithSession<Paginated<Product>>('/api/v1/master-data/products?limit=100&offset=0',session)]); setOrders(o.items); setCustomers(c.items); setProducts(p.items); setState('ready'); } catch { setState('error'); } },[session]);
  React.useEffect(()=>{void load()},[load]);
  return <section className="data-page"><div className="page-toolbar"><div><span className="eyebrow">SALES</span><h2>Pedidos de venda</h2><p>Pedidos reais consultados pela API, com cliente e produtos do tenant atual.</p></div><div><button className="secondary" onClick={()=>void load()} disabled={state==='loading'}>Atualizar</button><button className="primary small" onClick={()=>setFormOpen(true)} disabled={customers.length===0||products.length===0}>Novo pedido</button></div></div>{(customers.length===0||products.length===0)&&state==='ready'&&<div className="info-box">Para criar um pedido, cadastre pelo menos um cliente e um produto.</div>}{state==='loading'&&<div className="state-box">Carregando pedidos…</div>}{state==='error'&&<div className="state-box error"><strong>Não foi possível carregar os pedidos.</strong><button onClick={()=>void load()}>Tentar novamente</button></div>}{state==='ready'&&orders.length===0&&<div className="state-box">Nenhum pedido cadastrado.</div>}{state==='ready'&&orders.length>0&&<div className="table-wrap"><table><thead><tr><th>Número</th><th>Cliente</th><th>Status</th><th>Total</th><th>Criação</th></tr></thead><tbody>{orders.map(o=><tr key={o._id}><td>{o.number}</td><td>{customers.find(c=>c._id===o.customerId)?.name ?? o.customerId}</td><td><span className="status-pill active">{o.status}</span></td><td>R$ {o.total.toFixed(2)}</td><td>{new Date(o.createdAt).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>}{formOpen&&<OrderForm session={session} customers={customers} products={products} onClose={()=>setFormOpen(false)} onCreated={async()=>{setFormOpen(false);onToast('Pedido criado.');await load()}}/>}</section>;
}
function OrderForm({session,customers,products,onClose,onCreated}:{session:Session;customers:Party[];products:Product[];onClose:()=>void;onCreated:()=>Promise<void>}){
  const [number,setNumber]=React.useState('');const[customerId,setCustomerId]=React.useState(customers[0]?._id??'');const[productId,setProductId]=React.useState(products[0]?._id??'');const[quantity,setQuantity]=React.useState('1');const[unitPrice,setUnitPrice]=React.useState(String(products[0]?.price??0));const[error,setError]=React.useState('');const[busy,setBusy]=React.useState(false);
  function chooseProduct(id:string){setProductId(id);setUnitPrice(String(products.find(p=>p._id===id)?.price??0));}
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await apiWithSession('/api/v1/sales/orders',session,{method:'POST',body:JSON.stringify({number,customerId,lines:[{productId,quantity:Number(quantity),unitPrice:Number(unitPrice)}]})});await onCreated()}catch(e){setError(e instanceof Error?e.message:'Não foi possível criar o pedido.')}finally{setBusy(false)}}
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="form-card" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={onClose}>×</button><span className="eyebrow">SALES / NOVO PEDIDO</span><h2>Criar pedido</h2><form onSubmit={submit}><label>Número<input value={number} onChange={e=>setNumber(e.target.value)} required /></label><label>Cliente<select value={customerId} onChange={e=>setCustomerId(e.target.value)}>{customers.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}</select></label><label>Produto<select value={productId} onChange={e=>chooseProduct(e.target.value)}>{products.map(p=><option key={p._id} value={p._id}>{p.name} · R$ {p.price.toFixed(2)}</option>)}</select></label><div className="form-row"><label>Quantidade<input type="number" min="0.000001" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)} required /></label><label>Preço unitário<input type="number" min="0" step="0.01" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} required /></label></div>{error&&<div className="form-error">{error}</div>}<button className="primary" disabled={busy}>{busy?'Criando…':'Criar pedido'}</button></form></div></div>;
}

function SettingsPage({session,me,company,system,onRefresh,onLogout}:{session:Session|null;me:Me|null;company:Company|null;system:SystemInfo|null;onRefresh:()=>void;onLogout:()=>void}){return <section className="module-page"><div className="module-intro"><span className="tag">SISTEMA</span><h2>Configurações</h2><p>Informações da sessão e da plataforma obtidas dos serviços reais.</p></div>{session?<div className="settings-grid"><article className="panel"><small>SESSÃO</small><h3>Usuário atual</h3><dl><dt>Nome</dt><dd>{me?.user.name??'—'}</dd><dt>E-mail</dt><dd>{me?.user.email??session.user?.email??'—'}</dd><dt>Role</dt><dd>{me?.user.role??'—'}</dd><dt>Empresa</dt><dd>{company?.name??'—'} ({company?.slug??'—'})</dd></dl><div className="panel-actions"><button className="secondary" onClick={onRefresh}>Atualizar</button><button className="danger" onClick={onLogout}>Sair</button></div></article><article className="panel"><small>API</small><h3>Informações do sistema</h3><dl><dt>Nome</dt><dd>{system?.name??'—'}</dd><dt>Versão</dt><dd>{system?.version??'—'}</dd><dt>Namespaces</dt><dd>{system?.integrationNamespaces.join(' · ')??'—'}</dd></dl></article></div>:<AuthRequired onLogin={()=>undefined} />}</section>}
function PreparedModule({title}:{title:string}){return <section className="prepared"><div className="prepared-mark">—</div><span className="tag">MÓDULO PREPARADO</span><h2>{title}</h2><p>A API deste módulo ainda está em implementação. A navegação está disponível, mas nenhuma operação fictícia é apresentada.</p></section>}
function AuthRequired({onLogin}:{onLogin:()=>void}){return <section className="state-box auth-required"><strong>Autenticação necessária.</strong><p>Entre com uma conta válida para consultar e alterar dados reais.</p><button className="primary small" onClick={onLogin}>Entrar</button></section>}

function Login({onClose,onSuccess}:{onClose:()=>void;onSuccess:(session:Session)=>void}){const[email,setEmail]=React.useState('');const[password,setPassword]=React.useState('');const[companySlug,setCompanySlug]=React.useState('');const[error,setError]=React.useState('');const[loading,setLoading]=React.useState(false);async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');try{const data=await api<{accessToken:string;refreshToken:string;expiresIn:number}>('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email,password,...(companySlug?{companySlug}: {})})});onSuccess({...data,user:{email}})}catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.')}finally{setLoading(false)}}return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-card" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={onClose}>×</button><div className="login-mark">KZ</div><p className="eyebrow">KORCZAK ERP</p><h2>Entrar no sistema</h2><p className="login-subtitle">Acesse sua empresa com autenticação real.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus /></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><label>Empresa <span>opcional</span><input value={companySlug} onChange={e=>setCompanySlug(e.target.value)} placeholder="minha-empresa" /></label>{error&&<div className="form-error">{error}</div>}<button className="primary login-submit" disabled={loading}>{loading?'Entrando…':'Entrar'} <span>→</span></button></form></div></div>}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
