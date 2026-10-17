import { useState } from 'react';
import { navigation } from './Sidebar';
import { ArrowRight, Search } from './icons';
import { Empty, Modal } from './ui';

export default function CommandMenu({ user, navigate, onClose }) {
  const [query, setQuery] = useState('');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const items = navigation.filter(item => user.capabilities.includes(item.capability)
    && normalize(`${item.label} ${item.section}`).includes(normalize(query)));
  return <Modal title="Aller à un espace" onClose={onClose}>
    <div className="command-search"><Search size={20}/><input autoFocus aria-label="Rechercher un espace" placeholder="Devis, approbations, livraisons…" value={query} onChange={event => setQuery(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter' && items[0]) { navigate(items[0].id); onClose(); } }}/><kbd>Entrée</kbd></div>
    <div className="command-results">{items.map(item => <button key={item.id} onClick={() => { navigate(item.id); onClose(); }}>
      <item.icon size={20}/><span><strong>{item.label}</strong><small>{item.section}</small></span><ArrowRight size={16}/>
    </button>)}{!items.length && <Empty title="Aucun espace trouvé" description="Essayez un autre nom. Les résultats respectent les permissions de votre compte."/>}</div>
    <p className="command-hint">Recherchez un espace puis appuyez sur Entrée, ou sélectionnez-le dans la liste.</p>
  </Modal>;
}
