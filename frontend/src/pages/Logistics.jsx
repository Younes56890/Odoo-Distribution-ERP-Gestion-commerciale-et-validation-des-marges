import { useState } from 'react';
import { Barcode, Check, PackageCheck, Truck } from '../components/icons';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { date } from '../domain/quote';
import { Badge, Empty, Field, Modal, PageHeading, Pagination, Panel, ResourceState } from '../components/ui';

const columns = [
  { title: 'À préparer', states: ['draft', 'confirmed', 'waiting'], tone: 'amber' },
  { title: 'Disponible', states: ['assigned'], tone: 'teal' },
  { title: 'Terminé', states: ['done', 'cancel'], tone: 'neutral' },
];
export default function Logistics({ revision, run, kind = 'deliveries', topContent }) {
  const [offset, setOffset] = useState(0), [selected, setSelected] = useState(null), [quantities, setQuantities] = useState({});
  const [barcode, setBarcode] = useState(''), [scanMessage, setScanMessage] = useState(''), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const resource = useResource(kind, { offset, limit: 30 }, revision);
  const open = picking => { setSelected(picking); setQuantities(Object.fromEntries(picking.lines.map(l => [l.move_id, 0]))); setConfirmed(false); setBarcode(''); setScanMessage(''); };
  const scan = e => {
    e.preventDefault(); const line = selected.lines.find(l => l.barcode && l.barcode === barcode.trim());
    if (!line) { setScanMessage('Code-barres absent de ce mouvement.'); return; }
    if ((Number(quantities[line.move_id]) || 0) >= line.product_uom_qty) { setScanMessage('La quantité demandée est déjà préparée.'); return; }
    setQuantities(current => ({ ...current, [line.move_id]: Number(current[line.move_id] || 0) + 1 })); setBarcode(''); setScanMessage(`${line.product_name} : une unité ajoutée.`);
  };
  const validate = async () => {
    setBusy(true);
    const result = await run(() => api.validatePicking(kind, selected.id, { backorder: 'create', lines: selected.lines.map(line => ({ move_id: line.move_id, qty_done: Number(quantities[line.move_id]) })) }), 'Mouvement validé. Les quantités restantes sont conservées dans un reliquat.');
    setBusy(false); if (result) setSelected(null);
  };
  return <><PageHeading eyebrow="Tour de contrôle logistique" title={kind === 'deliveries' ? 'Chaque livraison compte.' : 'Achats & réceptions'} description={kind === 'deliveries' ? 'Préparez les commandes, contrôlez les quantités et suivez les reliquats.' : 'Lancez vos achats et enregistrez uniquement les quantités effectivement reçues.'}><span className="subtle-tag"><Truck size={16}/> Suivi des mouvements</span></PageHeading>
    {topContent}
    <ResourceState resource={resource}>{resource.data && <><div className="kanban-board logistics-board">{columns.map(column => {
      const items = resource.data.items.filter(p => column.states.includes(p.state));
      return <section className="kanban-column" key={column.title}><div className="kanban-heading"><span className={`dot ${column.tone}`}/><h2>{column.title}</h2><span>{items.length}</span></div><div className="kanban-content">{items.map(picking => <button className="picking-card" key={picking.id} onClick={() => open(picking)}><div className="card-top"><span>{picking.name}</span><Badge state={picking.state}/></div><h3>{picking.partner_name}</h3><p>{picking.origin || 'Sans commande liée'}</p><div className="picking-lines"><PackageCheck size={16}/>{picking.lines.length} référence{picking.lines.length > 1 ? 's' : ''} · {picking.lines.reduce((sum, line) => sum + line.product_uom_qty, 0)} unités</div>{picking.backorder_id && <span className="badge warning">Reliquat</span>}<div className="picking-footer"><span>{date(picking.scheduled_date)}</span><strong>{picking.state === 'done' ? 'Consulter' : 'Préparer'} →</strong></div></button>)}{!items.length && <div className="column-empty">Aucun mouvement sur cette page</div>}</div></section>;
    })}</div><Pagination data={resource.data} onPage={setOffset}/><p className="small muted">Les colonnes présentent les mouvements de la page actuelle.</p></>}</ResourceState>
    {selected && <Modal title={`${selected.name} · ${selected.partner_name}`} wide onClose={() => setSelected(null)}><div className="detail-top"><Badge state={selected.state}/><span>{selected.origin}</span></div>
      {!['done', 'cancel'].includes(selected.state) && <form className="barcode-form" onSubmit={scan}><Barcode size={22}/><input aria-label="Code-barres du produit" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scanner ou saisir un code-barres"/><button className="btn secondary">Ajouter une unité</button></form>}
      {scanMessage && <p className="scan-message" role="status">{scanMessage}</p>}
      <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Demandé</th><th>{selected.state === 'done' ? 'Traité' : 'Réellement préparé'}</th><th>Restant</th></tr></thead><tbody>{selected.lines.map(line => <tr key={line.move_id}><td><strong>{line.product_name}</strong><small className="cell-note">{line.barcode || 'Sans code-barres'}</small></td><td>{line.product_uom_qty}</td><td>{['done', 'cancel'].includes(selected.state) ? line.quantity : <input className="number-cell" aria-label={`Quantité préparée ${line.product_name}`} type="number" min="0" max={line.product_uom_qty} step="0.01" value={quantities[line.move_id]} onChange={e => setQuantities(current => ({ ...current, [line.move_id]: e.target.value }))}/>}</td><td>{Math.max(0, line.product_uom_qty - Number(selected.state === 'done' ? line.quantity : quantities[line.move_id]))}</td></tr>)}</tbody></table></div>
      {!['done', 'cancel'].includes(selected.state) && <><div className="form-actions"><button className="btn text" onClick={() => setQuantities(Object.fromEntries(selected.lines.map(line => [line.move_id, line.product_uom_qty])))}>Renseigner toutes les quantités demandées</button></div><div className="notice warning"><span>Une livraison partielle crée un reliquat. Les produits suivis par lot ou numéro de série doivent être traités dans Odoo.</span></div><label className="checkbox-field"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/><span>Je confirme les quantités préparées et la conservation des quantités restantes en reliquat.</span></label><button className="btn primary full" disabled={busy || !confirmed || !selected.lines.some(l => Number(quantities[l.move_id]) > 0) || selected.lines.some(l => Number(quantities[l.move_id]) < 0 || Number(quantities[l.move_id]) > l.product_uom_qty)} onClick={validate}><Check size={17}/> Valider les quantités réelles</button></>}
    </Modal>}
  </>;
}
