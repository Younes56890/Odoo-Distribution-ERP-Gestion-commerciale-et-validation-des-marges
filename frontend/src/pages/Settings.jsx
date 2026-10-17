import { useState } from 'react';
import { ExternalLink, ShieldCheck, SlidersHorizontal } from '../components/icons';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { Field, PageHeading, Panel, ResourceState } from '../components/ui';

export default function Settings({ user, revision, run, updateUser }) {
  const resource = useResource('settings', {}, revision);
  const [threshold, setThreshold] = useState(null), [busy, setBusy] = useState(false);
  return <><PageHeading eyebrow="Administration" title="Des règles claires pour toute l’équipe." description="Configurez le contrôle de marge et consultez les responsabilités par rôle."/>
    <div className="settings-grid"><Panel title="Politique de marge" subtitle={user.company} action={<SlidersHorizontal size={20}/>}><ResourceState resource={resource}>{resource.data && <form className="settings-form" onSubmit={async e => { e.preventDefault(); setBusy(true); const result = await run(() => api.updateSettings({ threshold: Number(threshold ?? resource.data.threshold) }), 'Seuil de marge mis à jour pour la société.'); setBusy(false); if (result) updateUser({ ...user, threshold: result.threshold }); }}><Field label="Taux de marque minimum (%)" hint="Le taux de marque correspond à la marge divisée par le montant HT."><input type="number" min="0" max="99.99" step="0.1" required value={threshold ?? resource.data.threshold} onChange={e => setThreshold(e.target.value)}/></Field><div className="notice warning"><span>Un changement de seuil oblige à réexaminer les accords dont les conditions ne correspondent plus à la politique actuelle.</span></div><button className="btn primary" disabled={busy}>Enregistrer la politique</button></form>}</ResourceState></Panel>
    <Panel title="Responsabilités et accès" subtitle="Les permissions sont vérifiées par le serveur" action={<ShieldCheck size={20}/>}><div className="role-list">{[['Commercial', 'Opportunités, clients et devis autorisés'], ['Approbateur', 'Décisions motivées sur les dérogations'], ['Logistique', 'Préparation et réception des mouvements autorisés'], ['Finance', 'Facturation et paiements autorisés'], ['Responsable des opérations', 'Politique de marge et pilotage global']].map(([name, text]) => <div key={name}><strong>{name}</strong><p>{text}</p></div>)}</div></Panel></div>
    <Panel title="Gestion des utilisateurs" subtitle="Les comptes, groupes et sociétés sont administrés dans Odoo."><div className="settings-link"><p>Attribuez les groupes adaptés à chaque collaborateur. La navigation s’ajuste aux permissions réelles du compte.</p>{!user.demo && <a className="btn secondary" href={import.meta.env.VITE_ODOO_URL || 'http://localhost:8069/web'} target="_blank" rel="noreferrer">Ouvrir Odoo <ExternalLink size={16}/></a>}</div></Panel>
  </>;
}
