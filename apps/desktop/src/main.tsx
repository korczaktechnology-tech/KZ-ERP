import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { checkForUpdate } from './updater';

type View = 'overview' | 'cadastros' | 'operacoes' | 'financeiro' | 'fiscal' | 'relatorios' | 'configuracoes';
type Session = { accessToken: string; refreshToken: string; user?: { name?: string; email?: string; role?: string } };
type ModuleData = { eyebrow: string; title: string; description: string; items: string[] };

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:10000';
const nav: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão geral', icon: '⌂' },
  { id: 'cadastros', label: 'Cadastros', icon: '▦' },
  { id: 'operacoes', label: 'Operações', icon: '⇄' },
  { id: 'financeiro', label: 'Financeiro', icon: '◈' },
  { id: 'fiscal', label: 'Fiscal', icon: '◇' },
  { id: 'relatorios', label: 'Relatórios', icon: '▤' },
  { id: 'configuracoes', label: 'Configurações', icon: '⚙' }
];

function readSession(): Session | null { try { const raw = localStorage.getItem('kz-erp-session'); return raw ? JSON.parse(raw) as Session : null; } catch { return null; } }
function saveSession(session: Session) { localStorage.setItem('kz-erp-session', JSON.stringify(session)); }

async function api(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null) as { data?: unknown; error?: { code?: string; message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error?.code ?? `HTTP ${response.status}`);
  return body?.data ?? body;
}

function App() {
  const [view, setView] = React.useState<View>('overview');
  const [status, setStatus] = React.useState('Pronto');
  const [apiStatus, setApiStatus] = React.useState('Verificando');
  const [session, setSession] = React.useState<Session | null>(readSession);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [company, setCompany] = React.useState<{ name: string; slug: string } | null>(null);

  React.useEffect(() => {
    void checkForUpdate(setStatus);
    api('/health').then(() => setApiStatus('Online')).catch(() => setApiStatus('Indisponível'));
  }, []);

  React.useEffect(() => {
    if (!session) return;
    void api('/api/v1/core/company', {}, session.accessToken).then((data) => setCompany((data as { company: { name: string; slug: string } }).company)).catch(() => {
      localStorage.removeItem('kz-erp-session'); setSession(null); setToast('Sessão expirada.');
    });
  }, [session]);

  function logout() { localStorage.removeItem('kz-erp-session'); setSession(null); setCompany(null); setToast('Sessão encerrada.'); }

  const title = nav.find(item => item.id === view)?.label ?? 'Visão geral';

  return <div className="shell">
    <aside>
      <div className="brand"><div className="brand-mark">KZ</div><div><strong>KORCZAK</strong><small>ERP</small></div></div>
      <div className="workspace"><span className="workspace-dot" /> {company?.name ?? 'Ambiente local'}</div>
      <nav>{nav.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="side-status"><span className={apiStatus === 'Online' ? 'dot online' : 'dot'} /> API {apiStatus}<br/><small>Atualização: {status}</small></div>
    </aside>

    <main>
      <header><div><p className="eyebrow">KORCZAK TECHNOLOGIES / KORCZAK ERP</p><h1>{title}</h1></div><div className="header-actions"><div className="connection"><span className={apiStatus === 'Online' ? 'dot online' : 'dot'} /> {apiStatus}</div>{session ? <button className="user-button" onClick={logout}>{session.user?.name ?? session.user?.email ?? 'Conta'} <span>↪</span></button> : <button className="primary small" onClick={() => setLoginOpen(true)}>Entrar</button>}</div></header>

      {view === 'overview' ? <Dashboard apiStatus={apiStatus} session={session} onLogin={() => setLoginOpen(true)} /> : <ModuleView view={view} />}
    </main>

    {loginOpen && <Login onClose={() => setLoginOpen(false)} onSuccess={(next) => { saveSession(next); setSession(next); setLoginOpen(false); setToast('Login realizado.'); }} />}
    {toast && <div className="toast" onAnimationEnd={() => setToast('')}>{toast}</div>}
  </div>;
}

function Dashboard({ apiStatus, session, onLogin }: { apiStatus: string; session: Session | null; onLogin: () => void }) {
  return <>
    <section className="hero"><div className="hero-copy"><span className="tag">ERP • LINUX DESKTOP</span><h2>Operação centralizada.<br/><em>Arquitetura pronta para crescer.</em></h2><p>O centro operacional da Korczak, com dados isolados por empresa, API segura e contratos preparados para futuras integrações.</p><div className="hero-actions">{session ? <button className="primary">Abrir operação <span>→</span></button> : <button className="primary" onClick={onLogin}>Acessar ERP <span>→</span></button>}<span className="secure">● MongoDB · API server-side</span></div></div><div className="orb"><div>KZ</div><span>CORE</span></div></section>
    <section className="metrics"><Metric label="SISTEMA" value={apiStatus === 'Online' ? 'Operacional' : apiStatus} detail="API principal" state={apiStatus === 'Online'} /><Metric label="DADOS" value="MongoDB" detail="Banco principal" state /><Metric label="TENANCY" value="Multiempresa" detail="Isolamento ativo" state /><Metric label="INTEGRAÇÕES" value="Contratos" detail="CORE · WMS · TMS" state /></section>
    <section className="content-grid"><article className="panel"><div className="panel-head"><div><small>ACESSO RÁPIDO</small><h3>Centro de operações</h3></div><span>01</span></div><div className="quick-grid"><Quick icon="▦" title="Produtos" text="Catálogo e preços" /><Quick icon="♙" title="Clientes" text="Base comercial" /><Quick icon="▣" title="Pedidos" text="Vendas e operações" /><Quick icon="◈" title="Estoque" text="Saldos e depósitos" /></div></article><article className="panel status-panel"><div className="panel-head"><div><small>ARQUITETURA</small><h3>Estado da plataforma</h3></div><span>02</span></div><div className="status-row"><span className="dot online"/><div><strong>CORE</strong><small>Identidade e tenancy</small></div><b>OK</b></div><div className="status-row"><span className="dot online"/><div><strong>API</strong><small>Contrato v1</small></div><b>OK</b></div><div className="status-row"><span className="dot online"/><div><strong>UPDATES</strong><small>GitHub Releases</small></div><b>OK</b></div></article></section>
  </>;
}

function Metric({ label, value, detail, state }: { label: string; value: string; detail: string; state?: boolean }) { return <article className="metric"><small>{label}</small><strong>{value}</strong><span><i className={state ? 'dot online' : 'dot'} />{detail}</span></article>; }
function Quick({ icon, title, text }: { icon: string; title: string; text: string }) { return <button className="quick"><span className="quick-icon">{icon}</span><span><strong>{title}</strong><small>{text}</small></span><b>→</b></button>; }

function ModuleView({ view }: { view: Exclude<View, 'overview'> }) {
  const data: Record<Exclude<View, 'overview'>, ModuleData> = {
    cadastros: { eyebrow: 'DADOS MESTRES', title: 'Cadastros', description: 'Base central de produtos, clientes, fornecedores e depósitos.', items: ['Produtos', 'Clientes', 'Fornecedores', 'Depósitos'] },
    operacoes: { eyebrow: 'OPERAÇÃO', title: 'Operações', description: 'Pedidos e processos operacionais do ERP.', items: ['Pedidos de venda', 'Estoque', 'WMS', 'TMS'] },
    financeiro: { eyebrow: 'FINANCEIRO', title: 'Financeiro', description: 'Estrutura financeira preparada para contas e lançamentos.', items: ['Lançamentos', 'Contas a receber', 'Contas a pagar', 'Fluxo de caixa'] },
    fiscal: { eyebrow: 'FISCAL', title: 'Fiscal', description: 'Documentos e operações fiscais em uma camada dedicada.', items: ['Documentos fiscais', 'Regras fiscais', 'Tributos', 'Apurações'] },
    relatorios: { eyebrow: 'INTELIGÊNCIA', title: 'Relatórios', description: 'Visões operacionais e indicadores para tomada de decisão.', items: ['Visão geral', 'Vendas', 'Estoque', 'Financeiro'] },
    configuracoes: { eyebrow: 'SISTEMA', title: 'Configurações', description: 'Controle da empresa, usuários e preferências do ambiente.', items: ['Empresa', 'Usuários', 'Permissões', 'Integrações'] }
  };
  const current = data[view];
  return <section className="module-page"><div className="module-intro"><span className="tag">{current.eyebrow}</span><h2>{current.title}</h2><p>{current.description}</p></div><div className="module-cards">{current.items.map((item, i) => <article key={item} className="module-card"><span>0{i + 1}</span><h3>{item}</h3><p>Estrutura preparada no KORCZAK ERP.</p><button>Em breve <b>→</b></button></article>)}</div></section>;
}

function Login({ onClose, onSuccess }: { onClose: () => void; onSuccess: (session: Session) => void }) {
  const [email, setEmail] = React.useState(''); const [password, setPassword] = React.useState(''); const [companySlug, setCompanySlug] = React.useState(''); const [error, setError] = React.useState(''); const [loading, setLoading] = React.useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(''); try { const data = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, ...(companySlug ? { companySlug } : {}) }) }) as { accessToken: string; refreshToken: string }; onSuccess({ ...data, user: { email } }); } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível entrar.'); } finally { setLoading(false); } }
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-card" onMouseDown={e => e.stopPropagation()}><button className="close" onClick={onClose}>×</button><div className="login-mark">KZ</div><p className="eyebrow">KORCZAK ERP</p><h2>Entrar no sistema</h2><p className="login-subtitle">Acesse sua empresa com segurança.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></label><label>Senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label><label>Empresa <span>opcional</span><input value={companySlug} onChange={e => setCompanySlug(e.target.value)} placeholder="minha-empresa" /></label>{error && <div className="form-error">{error}</div>}<button className="primary login-submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'} <span>→</span></button></form></div></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
