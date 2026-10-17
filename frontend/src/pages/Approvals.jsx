import { useState } from 'react';
import { Check, Clock3, ShieldCheck, X } from '../components/icons';
import { api } from '../services/api';
import { useDebounced, useResource } from '../hooks/useResource';
import { date, money, percent } from '../domain/quote';
import { Badge, Empty, Field, Modal, PageHeading, Pagination, Panel, ResourceState, SearchField } from '../components/ui';

export default function Approvals({ revision, run }) {
  const [state, setState] = useState('waiting'), [q, setQ] = useState(''), [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(null), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [order, setOrder] = useState(null);
  const resource = useResource('approvals', { state, q: useDebounced(q), offset, limit: 12 }, revision);
  const selected = resource.data?.items.find(item => item.id === selectedId) || resource.data?.items[0];
  const select = id => { setSelectedId(id); setReason(''); };
  const decide = async decision => {
    setBusy(true);
    const result = await run(() => api.decideApproval(selected.id, { decision, reason }), decision === 'approved' ? 'Dérogation approuvée. Le commercial peut confirmer la commande.' : 'Dérogation refusée. Le motif est enregistré.');
    setBusy(false); if (result) { setReason(''); setSelectedId(null); }
  };
  return <><PageHeading eyebrow="Contrôle de la marge" title="Des décisions éclairées." description="Évaluez chaque dérogation avec son contexte, sa marge et son historique."><span className="subtle-tag"><ShieldCheck size={15}/> Décisions tracées</span></PageHeading>
    <div className="tabs" role="group" aria-label="Filtrer les demandes">{[['waiting', 'À décider'], ['approved', 'Approuvées'], ['refused', 'Refusées'], ['all', 'Tout l’historique']].map(([value, label]) => <button className={state === value ? 'active' : ''} key={value} onClick={() => { setState(value); setOffset(0); select(null); }}>{label}</button>)}</div>
    <ResourceState resource={resource}>{resource.data && <div className="approval-layout"><Panel title="Demandes de dérogation" subtitle={`${resource.data.total} résultat${resource.data.total > 1 ? 's' : ''}`}><div className="panel-toolbar"><SearchField value={q} onChange={value => { setQ(value); setOffset(0); }} placeholder="Devis ou client…"/></div>
      {resource.data.items.length ? <div className="approval-list">{resource.data.items.map(item => <button className={`approval-item ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => select(item.id)}><div><strong>{item.partner_name}</strong><span className="text-amber">{percent(item.margin_rate)}</span></div><p>{item.order_name} · {item.salesman}</p><div><small><Clock3 size={12}/> {date(item.requested_at)}</small><strong>{money(item.amount, item.currency)}</strong></div><Badge state={item.state}/></button>)}</div> : <Empty title="Tout est à jour" description="Les nouvelles demandes apparaîtront ici."/>}<Pagination data={resource.data} onPage={setOffset}/>
    </Panel>
      {selected ? <Panel className="approval-detail" title={selected.order_name} subtitle={`${selected.partner_name} · version ${selected.revision}`} action={<Badge state={selected.state}/>}>
        <div className="approval-summary"><div><small>Montant HT demandé</small><strong>{money(selected.amount, selected.currency)}</strong></div><div><small>Marge estimée</small><strong>{money(selected.margin, selected.currency)}</strong></div></div>
        <div className="comparison"><div><small>Taux demandé</small><strong className="text-amber">{percent(selected.margin_rate)}</strong></div><span>vs</span><div><small>Seuil à la demande</small><strong>{percent(selected.threshold)}</strong></div></div>
        <div className="notice warning"><span>Écart au seuil : <strong>{percent(Math.max(0, selected.threshold - selected.margin_rate))}</strong>. La décision autorise ces conditions précises.</span></div>
        <h3 className="section-title">Contexte commercial</h3><blockquote>{selected.justification}</blockquote><p className="muted small">Soumis par {selected.salesman}, le {date(selected.requested_at)}.</p>
        <button className="btn text" onClick={async () => { const result = await run(() => api.order(selected.order_id)); if (result) setOrder(result); }}>Consulter les lignes et l’historique →</button>
        {selected.state === 'waiting' ? <><Field label="Motif de votre décision *"><textarea rows="4" value={reason} onChange={e => setReason(e.target.value)} placeholder="Précisez votre analyse : potentiel client, contrepartie, conditions de l’accord…"/></Field><div className="form-actions"><button className="btn secondary danger-text" disabled={busy || !reason.trim()} onClick={() => decide('refused')}><X size={17}/> Refuser</button><button className="btn primary" disabled={busy || !reason.trim()} onClick={() => decide('approved')}><Check size={17}/> Approuver la dérogation</button></div><p className="small muted">Une modification du devis invalide l’accord. La confirmation reste une étape distincte.</p></> : <div className="decision-note"><strong>Décision enregistrée</strong><p>{selected.reason || 'Demande invalidée après une modification.'}</p><small>{selected.decided_by} · {date(selected.decided_at)}</small></div>}
      </Panel> : <Panel><Empty title="Aucune demande sélectionnée" description="Sélectionnez une demande pour examiner ses conditions."/></Panel>}
    </div>}</ResourceState>
    {order && <Modal title={`${order.name} · détail du devis`} wide onClose={() => setOrder(null)}><div className="table-wrap"><table><thead><tr><th>Produit</th><th>Quantité</th><th>Prix HT</th><th>Remise</th></tr></thead><tbody>{order.lines.map((line, i) => <tr key={line.id || i}><td>{line.name}</td><td>{line.qty}</td><td>{money(line.price, order.currency)}</td><td>{percent(line.discount)}</td></tr>)}</tbody></table></div><h3 className="section-title">Historique</h3><div className="timeline">{order.history.map(item => <div className="timeline-item" key={item.id}><i/><div><Badge state={item.state}/><p>{item.justification}</p>{item.reason && <p>{item.reason}</p>}<small>Version {item.revision} · {date(item.requested_at)}</small></div></div>)}</div></Modal>}
  </>;
}
