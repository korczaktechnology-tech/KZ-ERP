import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { checkForUpdate } from './updater';

function App() {
  const [status, setStatus] = React.useState('Pronto');
  const [api, setApi] = React.useState('Não verificada');

  React.useEffect(() => {
    void checkForUpdate(setStatus);
    fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:10000'}/health`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setApi('Online'))
      .catch(() => setApi('Indisponível'));
  }, []);

  return <div className="shell">
    <aside><div className="brand"><span>KZ</span><div><strong>KORCZAK</strong><small>ERP</small></div></div><nav><button className="active">Visão geral</button><button>Cadastros</button><button>Operações</button><button>Financeiro</button><button>Fiscal</button><button>Relatórios</button><button>Configurações</button></nav><div className="side-status">Atualização: {status}</div></aside>
    <main><header><div><p className="eyebrow">KORCZAK TECHNOLOGIES</p><h1>Visão geral</h1></div><div className="pill">API: {api}</div></header><section className="hero"><div><span className="tag">ERP • LINUX DESKTOP</span><h2>Operação centralizada.<br/>Arquitetura preparada para crescer.</h2><p>Base inicial do KORCZAK ERP, com MongoDB, API e atualização por GitHub Releases.</p></div><div className="orb">KZ</div></section><section className="grid"><article><small>STATUS</small><strong>Fundação</strong><span>Desktop + API</span></article><article><small>DADOS</small><strong>MongoDB</strong><span>Banco principal</span></article><article><small>INTEGRAÇÕES</small><strong>Contratos prontos</strong><span>CORE · WMS · TMS</span></article></section></main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
