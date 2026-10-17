import { useState } from 'react';
import { ArrowLeft, Check, Glasses, Plus, ShieldAlert, ShoppingBag, Trash2 } from '../components/icons';
import { api } from '../services/api';
import { useDebounced, useResource } from '../hooks/useResource';
import { maximumDiscount, money, percent, quoteTotals } from '../domain/quote';
import { Badge, Empty, Field, Modal, PageHeading, Pagination, Panel, ResourceState, SearchField } from '../components/ui';

export default function QuoteEditor({ user, revision, run, initialOrder, initialClient, onSaved, navigate }) {
  const [q, setQ] = useState(''), [offset, setOffset] = useState(0);
  const [clientQuery, setClientQuery] = useState('');
  const products = useResource('products', { q: useDebounced(q), offset, limit: 6 }, revision);
  const customers = useResource('customers', { q: useDebounced(clientQuery), limit: 200 }, revision);
  const [partnerId, setPartnerId] = useState(initialOrder?.partner_id || initialClient?.id || '');
  const [lines, setLines] = useState(initialOrder?.lines.map(line => ({ ...line, cost: line.cost ?? 0 })) || []);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false), [customerForm, setCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [createdCustomer, setCreatedCustomer] = useState(null);
  const totals = quoteTotals(lines, user.threshold);
  const currency = initialOrder?.currency || user.currency;
  const add = product => {
    if (product.currency !== currency) return;
    setLines(current => current.some(line => line.product_id === product.id)
      ? current.map(line => line.product_id === product.id ? { ...line, qty: line.qty + 1 } : line)
      : [...current, { product_id: product.id, name: product.name, price: product.price, cost: product.cost, qty: 1, discount: 0, qty_available: product.qty_available }]);
  };
  const update = (id, field, value) => setLines(current => current.map(line => line.product_id === id ? { ...line, [field]: value === '' ? '' : Number(value) } : line));
  const save = async action => {
    const valid = partnerId && lines.length && lines.every(line => Number(line.qty) > 0 && Number(line.price) > 0 && Number(line.discount) >= 0 && Number(line.discount) <= 100);
    if (!valid) return;
    setBusy(true);
    const result = await run(async () => {
      const data = { partner_id: Number(partnerId), lines: lines.map(line => ({ product_id: line.product_id, qty: Number(line.qty), price: Number(line.price), discount: Number(line.discount) })), action, justification };
      const order = initialOrder ? await api.updateOrder(initialOrder.id, data) : await api.createOrder(data);
      if (initialOrder && action === 'submit') return api.submitOrder(order.id, { justification });
      return order;
    }, action === 'draft' ? 'Devis enregistré. Les modifications invalident les accords précédents.' : 'Devis soumis. La décision finale de marge est calculée par le serveur.');
    setBusy(false);
    if (result) onSaved(result);
  };
  const clientItems = [...(customers.data?.items || [])];
  if (initialOrder && !clientItems.some(c => c.id === initialOrder.partner_id)) clientItems.unshift({ id: initialOrder.partner_id, name: initialOrder.partner_name });
  if (createdCustomer && !clientItems.some(c => c.id === createdCustomer.id)) clientItems.unshift(createdCustomer);
  if (initialClient && !clientItems.some(c => c.id === initialClient.id)) clientItems.unshift(initialClient);
  return <><PageHeading eyebrow="Espace commercial" title={initialOrder ? `Modifier ${initialOrder.name}` : 'Construisez votre prochain accord.'} description="Un devis clair, une marge maîtrisée, une décision traçable."><button className="btn secondary" onClick={() => navigate('orders')}><ArrowLeft size={16}/> Voir les devis</button></PageHeading>
    {initialOrder && <div className="notice warning"><ShieldAlert size={19}/><span>Une modification invalide les demandes et accords actifs. Une nouvelle dérogation pourra être nécessaire.</span></div>}
    <div className="quote-layout"><div className="quote-main">
      <Panel title="01 · Votre client" subtitle="Sélectionnez le destinataire du devis" action={<button className="btn text" onClick={() => setCustomerForm(true)}><Plus size={15}/> Nouveau client</button>}>
        <div className="client-picker"><SearchField value={clientQuery} onChange={setClientQuery} placeholder="Rechercher un client…"/><Field label="Client"><select value={partnerId} onChange={e => setPartnerId(e.target.value)} required><option value="">Sélectionner un client</option>{clientItems.filter(c => !c.supplier).map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}</select></Field></div>
        {customers.error && <p className="inline-error">{customers.error}</p>}
      </Panel>
      <Panel title="02 · Votre sélection" subtitle="Recherchez par produit, référence ou code-barres" action={<span className="subtle-tag">Catalogue</span>}>
        <div className="panel-toolbar"><SearchField value={q} onChange={value => { setQ(value); setOffset(0); }} placeholder="Monture, verre, référence…"/></div>
        <ResourceState resource={products}>{products.data && <>{products.data.items.length ? <div className="product-grid">{products.data.items.map(product => <article className="product-card" key={product.id}>
          <div className="product-illustration"><Glasses size={42} strokeWidth={1.25}/><span>{product.category}</span></div><div className="product-content"><small>{product.reference || 'Référence catalogue'}</small><h3>{product.name}</h3><div className="product-stock"><i className={product.qty_available <= 0 ? 'out' : product.qty_available < 10 ? 'low' : ''}/>{product.qty_available > 0 ? `${product.qty_available} disponibles` : 'Réapprovisionnement nécessaire'}</div><div className="product-bottom"><strong>{money(product.price, product.currency)}</strong><button className="icon-btn primary" disabled={product.currency !== currency} title={product.currency !== currency ? 'Devise incompatible avec ce devis' : `Ajouter ${product.name}`} aria-label={`Ajouter ${product.name}`} onClick={() => add(product)}><Plus size={18}/></button></div></div>
        </article>)}</div> : <Empty description="Essayez une autre référence ou un autre nom."/>}<Pagination data={products.data} onPage={setOffset}/></>}</ResourceState>
      </Panel>
      <Panel title="03 · Les conditions commerciales" subtitle={`${lines.length} produit${lines.length > 1 ? 's' : ''} dans votre devis`}>
        {lines.length ? <div className="table-wrap"><table><thead><tr><th>Produit</th><th>Quantité</th><th>Prix HT</th><th>Remise %</th><th>Total HT</th><th><span className="sr-only">Retirer</span></th></tr></thead><tbody>{lines.map(line => <tr key={line.product_id}>
          <td><strong>{line.name}</strong><small className="cell-note">Remise max. indicative : {percent(maximumDiscount(line.price, line.cost, user.threshold))}</small></td>
          <td><input className="number-cell" aria-label={`Quantité ${line.name}`} type="number" min="0.01" step="0.01" value={line.qty} onChange={e => update(line.product_id, 'qty', e.target.value)}/></td>
          <td><input className="number-cell price-cell" aria-label={`Prix ${line.name}`} type="number" min="0.01" step="0.01" value={line.price} onChange={e => update(line.product_id, 'price', e.target.value)}/></td>
          <td><input className="number-cell" aria-label={`Remise ${line.name}`} type="number" min="0" max="100" step="0.1" value={line.discount} onChange={e => update(line.product_id, 'discount', e.target.value)}/></td>
          <td className="numeric">{money(line.qty * line.price * (1 - line.discount / 100), currency)}</td><td><button className="icon-btn" aria-label={`Retirer ${line.name}`} onClick={() => setLines(current => current.filter(l => l.product_id !== line.product_id))}><Trash2 size={16}/></button></td>
        </tr>)}</tbody></table></div> : <Empty title="Votre devis commence ici" description="Ajoutez un produit depuis le catalogue ci-dessus."/>}
      </Panel>
    </div><aside className="quote-summary"><div className="summary-header"><ShoppingBag size={20}/><h2>Votre devis, en résumé</h2></div>
      <div className="summary-total"><span>Total HT estimé</span><strong>{money(totals.subtotal, currency)}</strong></div>
      <div className="summary-row"><span>Coût estimé</span><strong>{money(totals.cost, currency)}</strong></div><div className="summary-row"><span>Marge estimée</span><strong>{money(totals.margin, currency)}</strong></div>
      <div className="margin-card"><div><span>Taux de marque</span><strong className={totals.required ? 'text-amber' : 'text-teal'}>{percent(totals.rate)}</strong></div><div className="margin-track"><i style={{ width: `${Math.min(100, Math.max(0, totals.rate))}%` }} className={totals.required ? 'low' : ''}/><b style={{ left: `${user.threshold}%` }}/></div><small>Seuil de la société : {percent(user.threshold)}</small></div>
      <div className={`notice ${totals.required ? 'warning' : 'success'}`}>{totals.required ? <ShieldAlert size={20}/> : <Check size={20}/>}<span>{!lines.length ? 'Ajoutez vos produits pour calculer la marge.' : totals.required ? 'Une décision du responsable sera nécessaire.' : 'La marge estimée respecte le seuil.'}</span></div>
      <Field label={`Justification commerciale${totals.required ? ' *' : ' (facultative)'}`}><textarea rows="3" value={justification} onChange={e => setJustification(e.target.value)} placeholder="Contexte client, potentiel du contrat, raison de la remise…"/></Field>
      <button className="btn primary full" disabled={busy || !partnerId || !lines.length || (totals.required && !justification.trim()) || lines.some(line => !line.qty || !line.price || line.discount < 0 || line.discount > 100)} onClick={() => save('submit')}>{busy ? 'Enregistrement…' : totals.required ? 'Demander l’approbation' : 'Soumettre le devis'}</button>
      <button className="btn secondary full" disabled={busy || !partnerId || !lines.length} onClick={() => save('draft')}>Enregistrer le brouillon</button>
      <p className="summary-footnote">Estimation sur prix catalogue. Odoo recalcule les coûts, taxes et conditions avant toute confirmation.</p>
    </aside></div>
    {customerForm && <Modal title="Créer un client" onClose={() => setCustomerForm(false)}><form onSubmit={async e => { e.preventDefault(); setBusy(true); const result = await run(() => api.createCustomer(newCustomer), 'Client créé.'); setBusy(false); if (result) { setCreatedCustomer(result); setPartnerId(result.id); setCustomerForm(false); } }}><Field label="Raison sociale"><input required value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}/></Field><Field label="Adresse e-mail"><input type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}/></Field><Field label="Téléphone"><input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}/></Field><button className="btn primary full" disabled={busy}>Créer le client</button></form></Modal>}
  </>;
}
