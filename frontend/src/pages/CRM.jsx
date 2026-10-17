import { useState } from 'react';
import { ArrowRight, Plus, Target, X } from '../components/icons';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { money, percent } from '../domain/quote';
import { Field, Modal, PageHeading, Pagination, ResourceState } from '../components/ui';

const stages = [
  { name: 'Découverte', match: l => !l.won && l.probability < 30 },
  { name: 'Qualification', match: l => !l.won && l.probability >= 30 && l.probability < 60 },
  { name: 'Proposition', match: l => !l.won && l.probability >= 60 },
  { name: 'Gagné', match: l => l.won },
];
export default function CRM({ user, revision, run, createQuote }) {
  const [offset, setOffset] = useState(0), [showForm, setShowForm] = useState(false), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', partner_id: '', expected_revenue: '' });
  const resource = useResource('leads', { offset, limit: 40 }, revision);
  const customers = useResource('customers', { limit: 200 }, revision, showForm);
  return <><PageHeading eyebrow="Espace commercial" title="Des relations qui deviennent des accords." description="Un pipeline regroupé par probabilité ; chaque carte conserve son étape Odoo."><button className="btn primary" onClick={() => setShowForm(true)}><Plus size={17}/> Nouvelle opportunité</button></PageHeading>
    <ResourceState resource={resource}>{resource.data && <><div className="kanban-board crm-board">{stages.map(stage => {
      const items = resource.data.items.filter(stage.match);
      return <section className="kanban-column" key={stage.name}><div className="kanban-heading"><span className={`dot ${stage.name === 'Gagné' ? 'teal' : 'neutral'}`}/><h2>{stage.name}</h2><span>{items.length}</span></div><div className="column-total">{money(items.reduce((sum, l) => sum + l.expected_revenue, 0), user.currency)}</div><div className="kanban-content">{items.map(lead => <article className="lead-card" key={lead.id}><small>{lead.partner_name || 'Client à qualifier'}</small><h3>{lead.name}</h3><strong className="lead-amount">{money(lead.expected_revenue, user.currency)}</strong><div className="lead-progress"><i style={{ width: `${lead.probability}%` }}/></div><div className="lead-meta"><span>{lead.stage_name}</span><strong>{percent(lead.probability)}</strong></div><div className="lead-actions"><button className="btn text" disabled={!lead.partner_id} onClick={() => createQuote(lead.partner_id, lead.partner_name)}>Créer un devis <ArrowRight size={14}/></button>{!lead.won && <><button className="icon-btn" title="Marquer comme gagnée" aria-label={`Gagner ${lead.name}`} disabled={busy} onClick={async () => { setBusy(true); await run(() => api.leadAction(lead.id, 'won'), 'Opportunité gagnée.'); setBusy(false); }}><Target size={16}/></button><button className="icon-btn" title="Marquer comme perdue" aria-label={`Perdre ${lead.name}`} disabled={busy} onClick={async () => { setBusy(true); await run(() => api.leadAction(lead.id, 'lost'), 'Opportunité archivée comme perdue.'); setBusy(false); }}><X size={16}/></button></>}</div></article>)}{!items.length && <div className="column-empty">Aucune opportunité sur cette page</div>}</div></section>;
    })}</div><Pagination data={resource.data} onPage={setOffset}/></>}</ResourceState>
    {showForm && <Modal title="Nouvelle opportunité" onClose={() => setShowForm(false)}><form onSubmit={async e => { e.preventDefault(); setBusy(true); const result = await run(() => api.createLead({ ...form, partner_id: form.partner_id ? Number(form.partner_id) : null, expected_revenue: Number(form.expected_revenue) }), 'Opportunité créée.'); setBusy(false); if (result) { setShowForm(false); setForm({ name: '', partner_id: '', expected_revenue: '' }); } }}><Field label="Nom de l’opportunité"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Collection, ouverture de boutique, renouvellement…"/></Field><Field label="Client"><select value={form.partner_id} onChange={e => setForm({ ...form, partner_id: e.target.value })}><option value="">À qualifier</option>{customers.data?.items.filter(c => !c.supplier).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label={`Revenu estimé (${user.currency})`}><input required type="number" min="0" step="0.01" value={form.expected_revenue} onChange={e => setForm({ ...form, expected_revenue: e.target.value })}/></Field><button className="btn primary full" disabled={busy}>Créer l’opportunité</button></form></Modal>}
  </>;
}
