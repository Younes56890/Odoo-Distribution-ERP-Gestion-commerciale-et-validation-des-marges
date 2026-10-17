import { Calendar, LogOut, Menu, Search } from './icons';

const labels = { manager: 'Direction', commercial: 'Commercial', logistics: 'Logistique', accountant: 'Finance' };
export default function Header({ user, logout, busy, pageTitle, onSearch, onMenu }) {
  const today = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Casablanca' }).format(new Date());
  return <header className="topbar">
    <div className="topbar-left"><button className="icon-btn mobile-menu-button" aria-label="Ouvrir la navigation" onClick={onMenu}><Menu size={22}/></button><div className="breadcrumb"><span>Espace de travail</span><span className="breadcrumb-separator">/</span><strong>{pageTitle}</strong></div></div>
    <div className="topbar-actions"><button className="global-search" onClick={onSearch}><Search size={17}/><span>Aller à un espace</span><kbd>Ctrl K</kbd></button><span className="header-date"><Calendar size={16}/>{today}</span><div className="user-divider"/><div className="user-avatar">{user.name.charAt(0)}</div><div className="user-info"><strong>{user.name.split(' · ')[0]}</strong><small>{labels[user.role]}</small></div><button className="icon-btn" title="Déconnexion" aria-label="Déconnexion" disabled={busy} onClick={logout}><LogOut size={18}/></button></div>
  </header>;
}
