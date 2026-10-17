import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, CheckCheck, FilePlus2, Files, Settings2, ShoppingBag, SidebarToggle, Target, Truck, Wallet, X } from './icons';
import OptikaMark from './OptikaMark';

export const navigation = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: BarChart3, capability: 'finance', section: 'Espace de travail' },
  { id: 'crm', label: 'Pipeline commercial', icon: Target, capability: 'sales', section: 'Commercial' },
  { id: 'quotes', label: 'Nouveau devis', icon: FilePlus2, capability: 'sales', section: 'Commercial' },
  { id: 'orders', label: 'Devis & commandes', icon: Files, capability: 'sales', section: 'Commercial' },
  { id: 'approvals', label: 'Approbations', icon: CheckCheck, capability: 'approve', section: 'Opérations' },
  { id: 'automation', label: 'Suivi automatique', icon: Settings2, capability: 'approve', section: 'Opérations' },
  { id: 'logistics', label: 'Livraisons', icon: Truck, capability: 'stock', section: 'Opérations' },
  { id: 'purchases', label: 'Achats & réceptions', icon: ShoppingBag, capability: 'stock', section: 'Opérations' },
  { id: 'finance', label: 'Finance & échéances', icon: Wallet, capability: 'finance', section: 'Opérations' },
  { id: 'settings', label: 'Administration', icon: Settings2, capability: 'admin', section: 'Configuration' },
];

export default function Sidebar({ activeTab, navigate, user, collapsed, onCollapse, mobileOpen, onCloseMobile }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const dialogRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const visible = navigation.filter(item => user.capabilities.includes(item.capability));
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const changed = event => setMobile(event.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!mobile || !dialogRef.current) return;
    const dialog = dialogRef.current;
    if (mobileOpen && !dialog.open) dialog.showModal();
    else if (!mobileOpen && dialog.open) dialog.close();
  }, [mobile, mobileOpen]);
  const go = id => { setTooltip(null); navigate(id); if (mobile) onCloseMobile(); };
  const revealTooltip = (event, label) => {
    if (!collapsed || mobile) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTooltip({ label, top: Math.min(window.innerHeight - 28, bounds.top + bounds.height / 2), left: bounds.right + 16 });
  };
  const content = <aside className={`sidebar ${collapsed && !mobile ? 'collapsed' : ''}`}>
    <div className="sidebar-brand-row"><button className="brand" aria-label="Optika, accueil" onClick={() => go(visible[0]?.id)}><span className="brand-mark"><OptikaMark size={35}/></span><span>optika<span className="brand-period">.</span><strong>operations</strong></span></button>
      {mobile && <button className="icon-btn" aria-label="Fermer la navigation" onClick={onCloseMobile}><X size={20}/></button>}
    </div>
    <div className="workspace"><span className="workspace-avatar">OD</span><div><strong>{user.company}</strong><small>Distribution optique</small></div></div>
    {!mobile && <button className="collapse-control" onClick={() => { setTooltip(null); onCollapse(); }} aria-label={collapsed ? 'Développer la navigation' : 'Réduire la navigation'} aria-expanded={!collapsed} aria-controls="workspace-navigation"><SidebarToggle size={19}/><span>Réduire le menu</span></button>}
    <nav id={mobile ? 'mobile-workspace-navigation' : 'workspace-navigation'} aria-label="Navigation principale">{visible.map((item, index) => <div className="nav-entry" key={item.id}>
      {(index === 0 || visible[index - 1].section !== item.section) && <p className="nav-section">{item.section}</p>}
      <button aria-label={item.label} className={activeTab === item.id ? 'active' : ''} aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => go(item.id)} onMouseEnter={event => revealTooltip(event, item.label)} onFocus={event => revealTooltip(event, item.label)} onMouseLeave={() => setTooltip(null)} onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null); }}>
        <item.icon size={19}/><span className="nav-label">{item.label}</span>
      </button>
    </div>)}</nav>
    <div className="sidebar-footer"><span className="status-dot"/><div><strong>{user.demo ? 'Espace de démonstration' : 'Session Odoo active'}</strong><small>{user.demo ? 'Parcours commercial interactif*' : 'Votre compte, vos permissions'}</small></div></div>
    {!collapsed && user.demo && <p className="sidebar-disclaimer">* Données fictives, enregistrées localement.</p>}
  </aside>;
  return mobile ? <dialog ref={dialogRef} className="mobile-navigation" aria-label="Menu de navigation" onCancel={event => { event.preventDefault(); onCloseMobile(); }} onClick={event => { if (event.target === dialogRef.current) onCloseMobile(); }}>{content}</dialog> : <>{content}{tooltip && collapsed && createPortal(<span className="floating-nav-tooltip" aria-hidden="true" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</span>, document.body)}</>;
}
