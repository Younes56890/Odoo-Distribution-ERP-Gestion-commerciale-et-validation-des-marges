import { useState } from 'react';
import { Plus } from '../components/icons';
import { api } from '../services/api';
import { useResource } from '../hooks/useResource';
import { Field, Panel, ResourceState } from '../components/ui';
import Logistics from './Logistics';

export default function Purchases({ user, revision, run }) {
  const customers = useResource('customers', { limit: 200 }, revision), products = useResource('products', { limit: 200 }, revision);
  const [form, setForm] = useState({ partner_id: '', product_id: '', qty: 1, price: '' }), [busy, setBusy] = useState(false);
  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const content = user.capabilities.includes('purchase') && <Panel title="Nouvelle commande fournisseur" subtitle="La confirmation de l’achat génère une réception dans Odoo.">
    <ResourceState resource={customers}><ResourceState resource={products}><form className="purchase-form" onSubmit={async e => { e.preventDefault(); setBusy(true); const result = await run(() => api.createPurchase({ partner_id: Number(form.partner_id), product_id: Number(form.product_id), qty: Number(form.qty), price: Number(form.price) }), 'Commande fournisseur créée.'); setBusy(false); if (result) setForm({ partner_id: '', product_id: '', qty: 1, price: '' }); }}>
      <Field label="Fournisseur"><select required value={form.partner_id} onChange={e => update('partner_id', e.target.value)}><option value="">Choisir un fournisseur</option>{customers.data?.items.filter(c => c.supplier).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Produit"><select required value={form.product_id} onChange={e => { const product = products.data.items.find(p => p.id === Number(e.target.value)); setForm(current => ({ ...current, product_id: e.target.value, price: product?.cost || '' })); }}><option value="">Choisir un produit</option>{products.data?.items.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Quantité"><input required type="number" min="0.01" step="0.01" value={form.qty} onChange={e => update('qty', e.target.value)}/></Field><Field label={`Prix unitaire (${user.currency})`}><input required type="number" min="0.01" step="0.01" value={form.price} onChange={e => update('price', e.target.value)}/></Field><button className="btn primary" disabled={busy}><Plus size={17}/> Commander</button>
    </form></ResourceState></ResourceState>
  </Panel>;
  return <Logistics kind="receptions" revision={revision} run={run} topContent={content}/>;
}
