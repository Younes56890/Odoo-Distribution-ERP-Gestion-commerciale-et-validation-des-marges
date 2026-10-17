import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, X } from './components/icons';
import Sidebar, { navigation } from './components/Sidebar';
import Header from './components/Header';
import Login from './pages/Login';
import CommandMenu from './components/CommandMenu';
import { logout, resetDemo, restoreSession, startDemo } from './services/api';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuoteEditor = lazy(() => import('./pages/QuoteEditor'));
const Orders = lazy(() => import('./pages/Orders'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Logistics = lazy(() => import('./pages/Logistics'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Finance = lazy(() => import('./pages/Finance'));
const CRM = lazy(() => import('./pages/CRM'));
const Settings = lazy(() => import('./pages/Settings'));
const Automation = lazy(() => import('./pages/Automation'));
const home = user => navigation.find(item => user.capabilities.includes(item.capability))?.id;

export default function App() {
  const [user, setUser] = useState(null), [restoring, setRestoring] = useState(true);
  const [tab, setTab] = useState('dashboard'), [revision, setRevision] = useState(0);
  const [collapsed, setCollapsed] = useState(false), [mobileOpen, setMobileOpen] = useState(false), [commandOpen, setCommandOpen] = useState(false);
  const [notice, setNotice] = useState(null), [edit, setEdit] = useState(null), [client, setClient] = useState(null), [editorKey, setEditorKey] = useState(0), [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    let active = true;
    restoreSession().then(current => { if (active) { setUser(current); setTab(home(current)); } }).catch(() => {}).finally(() => active && setRestoring(false));
    const expired = () => { setUser(null); setNotice(null); setCommandOpen(false); setMobileOpen(false); };
    window.addEventListener('optika-session-expired', expired);
    return () => { active = false; window.removeEventListener('optika-session-expired', expired); };
  }, []);
  useEffect(() => { if (notice?.type === 'success') { const timer = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(timer); } }, [notice]);
  useEffect(() => {
    const shortcut = event => {
      if (user && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandOpen(current => !current);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [user]);
  const run = useCallback(async (work, message) => {
    try { const result = await work(); if (message) { setRevision(current => current + 1); setNotice({ type: 'success', message }); } return result; }
    catch (error) { setNotice({ type: 'error', message: error.message }); return null; }
  }, []);
  const navigate = next => {
    if (!navigation.some(item => item.id === next && user.capabilities.includes(item.capability))) return;
    if (next === 'quotes') { setEdit(null); setClient(null); setEditorKey(current => current + 1); }
    setTab(next); setMobileOpen(false); document.getElementById('main-content')?.scrollTo(0, 0);
  };
  const shared = { user, revision, run, navigate };
  if (restoring) return <div className="app-loading"><LoaderCircle size={28} className="spin"/><p>Ouverture de votre espace…</p></div>;
  if (!user) return <Login onLogin={current => { setUser(current); setTab(home(current)); setEdit(null); setClient(null); setNotice(null); setRevision(value => value + 1); }}/>;
  return <div className="app-shell"><a className="skip-link" href="#main-content">Aller au contenu</a><Sidebar user={user} activeTab={tab} navigate={navigate} collapsed={collapsed} onCollapse={() => setCollapsed(current => !current)} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)}/><div className="app-body"><Header user={user} busy={loggingOut} pageTitle={navigation.find(item => item.id === tab)?.label} onSearch={() => setCommandOpen(true)} onMenu={() => setMobileOpen(true)} logout={async () => { setLoggingOut(true); const result = await run(async () => { await logout(); return true; }); setLoggingOut(false); if (result) { setUser(null); setNotice(null); setCommandOpen(false); setMobileOpen(false); } }}/>
      {user.demo && <div className="demo-banner"><span className="badge">Démonstration</span><span>Données fictives. Vos changements restent dans ce navigateur.</span><button onClick={() => { resetDemo(); setUser(startDemo(user.role)); setRevision(value => value + 1); setEdit(null); setClient(null); setEditorKey(value => value + 1); setNotice({ type: 'success', message: 'Démonstration réinitialisée.' }); }}>Réinitialiser</button></div>}
      <main id="main-content" tabIndex={-1} className="main-content"><Suspense fallback={<div className="resource-state"><LoaderCircle className="spin"/><p>Ouverture de l’espace…</p></div>}>
        {tab === 'dashboard' && <Dashboard {...shared}/>}
        {tab === 'quotes' && <QuoteEditor {...shared} key={editorKey} initialOrder={edit} initialClient={client} onSaved={() => { setEdit(null); setClient(null); setTab('orders'); }}/>}
        {tab === 'orders' && <Orders {...shared} editOrder={order => { setEdit(order); setClient(null); setEditorKey(value => value + 1); setTab('quotes'); }}/>}
        {tab === 'approvals' && <Approvals {...shared}/>}
        {tab === 'automation' && <Automation {...shared}/>}
        {tab === 'logistics' && <Logistics {...shared}/>}
        {tab === 'purchases' && <Purchases {...shared}/>}
        {tab === 'finance' && <Finance {...shared}/>}
        {tab === 'crm' && <CRM {...shared} createQuote={(id, name) => { setEdit(null); setClient({ id, name }); setEditorKey(value => value + 1); setTab('quotes'); }}/>}
        {tab === 'settings' && <Settings {...shared} updateUser={setUser}/>}
      </Suspense><footer className="app-footer"><span>Optika Operations</span><span>{user.company} · {user.currency}</span></footer></main>
    </div>{commandOpen && <CommandMenu user={user} navigate={navigate} onClose={() => setCommandOpen(false)}/>} {notice && <div className={`toast ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}<p>{notice.message}</p><button className="icon-btn" aria-label="Fermer la notification" onClick={() => setNotice(null)}><X size={17}/></button></div>}</div>;
}
