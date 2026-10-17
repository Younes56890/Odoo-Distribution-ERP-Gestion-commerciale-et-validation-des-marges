import { quoteTotals } from '../domain/quote.js';

export const roles = {
  manager: { name: 'Nadia · Direction', capabilities: ['sales', 'approve', 'stock', 'purchase', 'finance', 'admin'] },
  commercial: { name: 'Yassine · Commercial', capabilities: ['sales'] },
  logistics: { name: 'Salma · Logistique', capabilities: ['stock', 'purchase'] },
  accountant: { name: 'Amine · Finance', capabilities: ['finance'] },
};
const key = 'optika-operations-demo-v1';
const daysAgo = days => { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); };
const now = () => new Date().toISOString();

export function seedDemo() {
  return {
    threshold: 15, sequence: 200,
    products: [
      { id: 1, name: 'Monture Aurora', reference: 'MT-AUR-01', barcode: '6110000000011', category: 'Montures', price: 100, cost: 80, qty_available: 24, currency: 'MAD' },
      { id: 2, name: 'Monture Atlas Titane', reference: 'MT-ATL-02', barcode: '6110000000028', category: 'Montures', price: 650, cost: 390, qty_available: 42, currency: 'MAD' },
      { id: 3, name: 'Verre Blue Protect', reference: 'VR-BLP-03', barcode: '6110000000035', category: 'Verres', price: 280, cost: 150, qty_available: 86, currency: 'MAD' },
      { id: 4, name: 'Solaire Riviera', reference: 'SL-RIV-04', barcode: '6110000000042', category: 'Solaires', price: 420, cost: 260, qty_available: 8, currency: 'MAD' },
      { id: 5, name: 'Étui Signature', reference: 'ET-SIG-05', barcode: '6110000000059', category: 'Accessoires', price: 65, cost: 28, qty_available: 125, currency: 'MAD' },
      { id: 6, name: 'Kit entretien Premium', reference: 'AC-KIT-06', barcode: '6110000000066', category: 'Accessoires', price: 45, cost: 18, qty_available: 0, currency: 'MAD' },
    ],
    customers: [
      { id: 1, name: 'Optique Atlas', city: 'Casablanca', email: 'atlas@example.com', phone: '0522 00 00 01', supplier: false },
      { id: 2, name: 'Vision Rabat', city: 'Rabat', email: 'vision@example.com', phone: '0537 00 00 02', supplier: false },
      { id: 3, name: 'Maison des Lunettes', city: 'Marrakech', email: 'maison@example.com', phone: '0524 00 00 03', supplier: false },
      { id: 4, name: 'OptiSupply Maroc', city: 'Tanger', email: 'supply@example.com', phone: '0539 00 00 04', supplier: true },
    ],
    orders: [
      { id: 101, name: 'S00101', partner_id: 1, partner_name: 'Optique Atlas', salesman: 'Yassine · Commercial', state: 'draft', margin_approval_state: 'waiting', revision: 1, amount_untaxed: 900, amount_total: 900, margin: 100, margin_percent: 11.111, currency: 'MAD', date_order: daysAgo(1), invoice_status: 'no', lines: [{ id: 1, product_id: 1, name: 'Monture Aurora', qty: 10, price: 100, discount: 10 }], history: [{ id: 101, state: 'waiting', requested_at: daysAgo(1), requested_by: 'Yassine · Commercial', justification: 'Ouverture de trois magasins. Première commande pour un partenariat annuel.', revision: 1 }] },
      { id: 102, name: 'S00102', partner_id: 2, partner_name: 'Vision Rabat', salesman: 'Yassine · Commercial', state: 'sale', margin_approval_state: 'no_required', revision: 1, amount_untaxed: 6500, amount_total: 6500, margin: 2600, margin_percent: 40, currency: 'MAD', date_order: daysAgo(3), invoice_status: 'to invoice', lines: [{ id: 2, product_id: 2, name: 'Monture Atlas Titane', qty: 10, price: 650, discount: 0 }], history: [] },
      { id: 103, name: 'S00103', partner_id: 3, partner_name: 'Maison des Lunettes', salesman: 'Yassine · Commercial', state: 'draft', margin_approval_state: 'no_required', revision: 1, amount_untaxed: 5600, amount_total: 5600, margin: 2600, margin_percent: 46.429, currency: 'MAD', date_order: daysAgo(2), invoice_status: 'no', lines: [{ id: 3, product_id: 3, name: 'Verre Blue Protect', qty: 20, price: 280, discount: 0 }], history: [] },
    ],
    approvals: [{ id: 101, order_id: 101, order_name: 'S00101', partner_name: 'Optique Atlas', salesman: 'Yassine · Commercial', margin_rate: 11.111, margin: 100, threshold: 15, amount: 900, currency: 'MAD', state: 'waiting', requested_at: daysAgo(1), revision: 1, justification: 'Ouverture de trois magasins. Première commande pour un partenariat annuel.' }],
    deliveries: [
      { id: 101, name: 'WH/OUT/00101', origin: 'S00102', state: 'assigned', partner_name: 'Vision Rabat', scheduled_date: daysAgo(0), backorder_id: false, lines: [{ move_id: 101, product_name: 'Monture Atlas Titane', barcode: '6110000000028', product_uom_qty: 10, quantity: 10, tracking: 'none' }] },
      { id: 102, name: 'WH/OUT/00102', origin: 'S00098', state: 'confirmed', partner_name: 'Optique Atlas', scheduled_date: daysAgo(-1), backorder_id: false, lines: [{ move_id: 102, product_name: 'Solaire Riviera', barcode: '6110000000042', product_uom_qty: 12, quantity: 0, tracking: 'none' }] },
    ],
    receptions: [{ id: 110, name: 'WH/IN/00110', origin: 'P00042', state: 'assigned', partner_name: 'OptiSupply Maroc', scheduled_date: daysAgo(0), lines: [{ move_id: 110, product_name: 'Kit entretien Premium', barcode: '6110000000066', product_uom_qty: 50, quantity: 0, tracking: 'none' }] }],
    invoices: Array.from({ length: 9 }, (_, index) => ({
      id: index + 1, name: `INV/2026/${String(index + 1).padStart(5, '0')}`,
      partner_name: ['Optique Atlas', 'Vision Rabat', 'Maison des Lunettes'][index % 3],
      state: 'posted', payment_state: index < 5 ? 'paid' : index === 5 ? 'partial' : 'not_paid',
      currency: 'MAD', amount_total: [8500, 12400, 6700, 9200, 4800, 11200, 6500, 3800, 7100][index],
      amount_residual: index < 5 ? 0 : [3200, 6500, 3800, 7100][index - 5],
      invoice_date: daysAgo((8 - index) * 18), due_date: daysAgo((7 - index) * 18),
    })),
    leads: [
      { id: 1, name: 'Collection printemps · 3 boutiques', partner_id: 1, partner_name: 'Optique Atlas', expected_revenue: 42000, probability: 65, stage_name: 'Proposition', won: false, salesman: 'Yassine' },
      { id: 2, name: 'Renouvellement gamme titane', partner_id: 2, partner_name: 'Vision Rabat', expected_revenue: 18500, probability: 40, stage_name: 'Qualification', won: false, salesman: 'Yassine' },
      { id: 3, name: 'Ouverture magasin Gueliz', partner_id: 3, partner_name: 'Maison des Lunettes', expected_revenue: 32000, probability: 15, stage_name: 'Nouveau', won: false, salesman: 'Yassine' },
      { id: 4, name: 'Accord accessoires annuel', partner_id: 2, partner_name: 'Vision Rabat', expected_revenue: 12500, probability: 100, stage_name: 'Gagné', won: true, salesman: 'Yassine' },
    ],
  };
}

export function createDemoService(storage = globalThis.localStorage) {
  let state;
  try { state = JSON.parse(storage?.getItem(key)) || seedDemo(); } catch { state = seedDemo(); }
  let user;
  const persist = () => storage?.setItem(key, JSON.stringify(state));
  const authorize = capability => { if (!user?.capabilities.includes(capability)) throw new Error('Votre rôle ne permet pas cette opération.'); };
  const find = (list, id) => { const item = list.find(item => item.id === Number(id)); if (!item) throw new Error('Élément introuvable.'); return item; };
  const list = (items, query = {}) => {
    const q = (query.q || '').toLowerCase();
    const filtered = items.filter(item => `${item.name || ''} ${item.partner_name || ''} ${item.reference || ''} ${item.barcode || ''}`.toLowerCase().includes(q));
    const offset = Number(query.offset || 0), limit = Number(query.limit || 20);
    return structuredClone({ items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit });
  };
  const linesWithCosts = lines => lines.map(line => {
    const product = find(state.products, line.product_id);
    if (!(line.qty > 0) || !(line.price > 0) || line.discount < 0 || line.discount > 100) throw new Error('Vérifiez les quantités, prix et remises.');
    return { ...line, cost: product.cost, name: product.name };
  });
  const submit = (order, justification = '') => {
    authorize('sales');
    if (!['draft', 'sent'].includes(order.state)) throw new Error('Seul un devis peut être soumis.');
    const totals = quoteTotals(linesWithCosts(order.lines), state.threshold);
    if (totals.required && order.margin_approval_state !== 'approved') {
      if (order.margin_approval_state === 'waiting') throw new Error('Une demande est déjà en attente.');
      if (!justification.trim()) throw new Error('Expliquez la raison de cette dérogation.');
      const approval = { id: ++state.sequence, order_id: order.id, order_name: order.name, partner_name: order.partner_name, salesman: user.name, margin_rate: totals.rate, margin: totals.margin, threshold: state.threshold, amount: totals.subtotal, currency: 'MAD', state: 'waiting', requested_at: now(), justification, revision: order.revision };
      state.approvals.unshift(approval);
      order.history.unshift({ ...approval, requested_by: user.name });
      order.margin_approval_state = 'waiting';
    } else {
      const approval = state.approvals.find(a => a.order_id === order.id && a.state === 'approved');
      if (totals.required && (!approval || approval.revision !== order.revision || approval.threshold !== state.threshold)) throw new Error('Les conditions ont changé. Modifiez et soumettez une nouvelle demande.');
      order.state = 'sale'; order.invoice_status = 'no';
      const id = ++state.sequence;
      state.deliveries.unshift({ id, name: `WH/OUT/${id}`, origin: order.name, partner_name: order.partner_name, state: 'confirmed', scheduled_date: daysAgo(0), lines: order.lines.map((line, index) => ({ move_id: id * 100 + index, product_name: line.name, barcode: find(state.products, line.product_id).barcode, product_uom_qty: line.qty, quantity: 0, tracking: 'none' })) });
    }
    persist(); return structuredClone(order);
  };
  return {
    start(role) { user = { uid: role === 'commercial' ? 2 : 1, ...roles[role], role, demo: true, company: 'Optika Distribution', currency: 'MAD', threshold: state.threshold }; return structuredClone(user); },
    async logout() { user = null; },
    async products(query) { if (!user?.capabilities.some(c => ['sales', 'stock', 'purchase'].includes(c))) throw new Error('Accès refusé.'); return list(state.products, query); },
    async customers(query) { return list(state.customers, query); },
    async createCustomer(data) { authorize('sales'); const item = { ...data, id: ++state.sequence, supplier: false }; state.customers.unshift(item); persist(); return item; },
    async orders(query) { if (!user?.capabilities.some(c => ['sales', 'finance'].includes(c))) throw new Error('Accès refusé.'); return list(state.orders, query); },
    async order(id) { authorize('sales'); const order = find(state.orders, id); return structuredClone({ ...order, lines: linesWithCosts(order.lines) }); },
    async createOrder(data) {
      authorize('sales'); const customer = find(state.customers, data.partner_id);
      if (!data.lines.length) throw new Error('Ajoutez au moins un produit.');
      const lines = linesWithCosts(data.lines), totals = quoteTotals(lines, state.threshold);
      if (data.action === 'submit' && totals.required && !data.justification?.trim()) throw new Error('Expliquez la raison de cette dérogation.');
      const id = ++state.sequence;
      const order = { id, name: `S${String(id).padStart(5, '0')}`, partner_id: customer.id, partner_name: customer.name, salesman: user.name, state: 'draft', margin_approval_state: totals.required ? 'to_request' : 'no_required', amount_total: totals.subtotal, amount_untaxed: totals.subtotal, margin: totals.margin, margin_percent: totals.rate, currency: 'MAD', revision: 1, date_order: now(), lines, history: [], invoice_status: 'no' };
      state.orders.unshift(order);
      if (data.action === 'submit') return submit(order, data.justification);
      persist(); return structuredClone(order);
    },
    async updateOrder(id, data) {
      authorize('sales'); const order = find(state.orders, id);
      if (order.state !== 'draft') throw new Error('Ce devis ne peut plus être modifié.');
      const lines = linesWithCosts(data.lines), totals = quoteTotals(lines, state.threshold);
      state.approvals.filter(a => a.order_id === order.id && ['waiting', 'approved'].includes(a.state)).forEach(a => { a.state = 'cancelled'; a.reason = 'Modification des conditions commerciales'; });
      order.history.filter(a => ['waiting', 'approved'].includes(a.state)).forEach(a => { a.state = 'cancelled'; a.reason = 'Modification des conditions commerciales'; });
      const customer = find(state.customers, data.partner_id);
      Object.assign(order, { lines, partner_id: customer.id, partner_name: customer.name, amount_total: totals.subtotal, amount_untaxed: totals.subtotal, margin: totals.margin, margin_percent: totals.rate, revision: order.revision + 1, margin_approval_state: totals.required ? 'to_request' : 'no_required' });
      persist(); return structuredClone(order);
    },
    async submitOrder(id, data) { return submit(find(state.orders, id), data.justification); },
    async approvals(query) { authorize('approve'); return list(state.approvals.filter(a => !query?.state || query.state === 'all' || a.state === query.state).map(a => ({ ...a, name: a.order_name })), query); },
    async decideApproval(id, data) {
      authorize('approve'); const approval = find(state.approvals, id), order = find(state.orders, approval.order_id);
      if (approval.state !== 'waiting' || !['approved', 'refused'].includes(data.decision) || !data.reason.trim()) throw new Error('Une demande en attente et un motif sont nécessaires.');
      if (approval.revision !== order.revision || approval.threshold !== state.threshold) throw new Error('Les conditions ont changé. Une nouvelle demande est nécessaire.');
      Object.assign(approval, { state: data.decision, reason: data.reason, decided_by: user.name, decided_at: now() });
      Object.assign(find(order.history, id), approval); order.margin_approval_state = data.decision;
      persist(); return structuredClone(approval);
    },
    async deliveries(query) { authorize('stock'); return list(state.deliveries, query); },
    async receptions(query) { authorize('stock'); return list(state.receptions, query); },
    async validatePicking(kind, id, data) {
      authorize('stock'); const items = state[kind], picking = find(items, id);
      if (['done', 'cancel'].includes(picking.state)) throw new Error('Mouvement déjà traité.');
      if (data.backorder !== 'create' || !data.lines.some(l => l.qty_done > 0)) throw new Error('Préparez une quantité et confirmez le reliquat.');
      if (data.lines.length !== picking.lines.length || new Set(data.lines.map(l => l.move_id)).size !== picking.lines.length) throw new Error('Renseignez chaque ligne.');
      const remaining = [];
      for (const line of data.lines) {
        const move = picking.lines.find(m => m.move_id === line.move_id);
        if (!move || !Number.isFinite(line.qty_done) || line.qty_done < 0 || line.qty_done > move.product_uom_qty) throw new Error('Quantité préparée invalide.');
      }
      for (const line of data.lines) {
        const move = picking.lines.find(m => m.move_id === line.move_id), product = state.products.find(p => p.name === move.product_name);
        move.quantity = line.qty_done;
        if (product) product.qty_available += (kind === 'receptions' ? 1 : -1) * line.qty_done;
        if (line.qty_done < move.product_uom_qty) remaining.push({ ...move, product_uom_qty: move.product_uom_qty - line.qty_done, quantity: 0 });
      }
      picking.state = 'done';
      if (remaining.length) { const next = ++state.sequence; items.unshift({ ...picking, id: next, name: `${picking.name}-R`, backorder_id: picking.id, state: 'confirmed', lines: remaining.map((m, i) => ({ ...m, move_id: next * 100 + i })) }); }
      const order = state.orders.find(o => o.name === picking.origin);
      if (order) {
        for (const line of data.lines) {
          const move = picking.lines.find(m => m.move_id === line.move_id);
          const orderLine = order.lines.find(l => l.name === move.product_name);
          if (orderLine) orderLine.delivered_qty = (orderLine.delivered_qty || 0) + line.qty_done;
        }
        order.invoice_status = 'to invoice';
      }
      persist(); return { state: 'done', backorders: remaining.length ? [`${picking.name}-R`] : [] };
    },
    async createPurchase(data) {
      authorize('purchase'); const partner = find(state.customers, data.partner_id), product = find(state.products, data.product_id);
      if (!(data.qty > 0) || !(data.price > 0)) throw new Error('Vérifiez la quantité et le prix.');
      const id = ++state.sequence, name = `P${id}`;
      state.receptions.unshift({ id, name: `WH/IN/${id}`, origin: name, state: 'assigned', partner_name: partner.name, scheduled_date: daysAgo(0), lines: [{ move_id: id, product_name: product.name, barcode: product.barcode, product_uom_qty: data.qty, quantity: 0, tracking: 'none' }] });
      persist(); return { id, name };
    },
    async invoices(query) { authorize('finance'); const items = state.invoices.map(inv => ({ ...inv, overdue_days: inv.amount_residual > 0 ? Math.max(0, Math.floor((new Date(daysAgo(0)) - new Date(inv.due_date)) / 86400000)) : 0 })); return list(items, query); },
    async createInvoice(id) {
      authorize('finance'); const order = find(state.orders, id);
      if (order.invoice_status !== 'to invoice') throw new Error('Aucune quantité à facturer.');
      const idNext = ++state.sequence;
      const invoiceAmount = order.lines.reduce((sum, line) => sum + Math.max(0, (line.delivered_qty || 0) - (line.invoiced_qty || 0)) * line.price * (1 - line.discount / 100), 0);
      if (invoiceAmount <= 0) throw new Error('Aucune quantité livrée à facturer.');
      state.invoices.unshift({ id: idNext, name: `INV/2026/${idNext}`, partner_name: order.partner_name, state: 'posted', payment_state: 'not_paid', currency: 'MAD', amount_total: invoiceAmount, amount_residual: invoiceAmount, invoice_date: daysAgo(0), due_date: daysAgo(-30) });
      order.lines.forEach(line => { line.invoiced_qty = line.delivered_qty || 0; });
      order.invoice_status = order.lines.every(l => l.invoiced_qty >= l.qty) ? 'invoiced' : 'no';
      persist(); return { invoices: [`INV/2026/${idNext}`] };
    },
    async payInvoice(id, data) {
      authorize('finance'); const invoice = find(state.invoices, id);
      if (!Number.isFinite(data.amount) || data.amount <= 0 || data.amount > invoice.amount_residual) throw new Error('Le paiement doit être positif et ne pas dépasser le solde.');
      invoice.amount_residual -= data.amount; invoice.payment_state = invoice.amount_residual === 0 ? 'paid' : 'partial';
      persist(); return { residual: invoice.amount_residual };
    },
    async leads(query) { authorize('sales'); return list(state.leads, query); },
    async createLead(data) { authorize('sales'); const customer = data.partner_id ? find(state.customers, data.partner_id) : null; const lead = { ...data, id: ++state.sequence, partner_name: customer?.name || '', probability: 10, stage_name: 'Nouveau', won: false, salesman: user.name }; state.leads.unshift(lead); persist(); return lead; },
    async leadAction(id, action) { authorize('sales'); const lead = find(state.leads, id); if (action === 'lost') state.leads = state.leads.filter(l => l.id !== lead.id); else Object.assign(lead, { won: true, probability: 100, stage_name: 'Gagné' }); persist(); return lead; },
    async dashboard() {
      authorize('finance'); const invoices = state.invoices, trend = new Map();
      for (const inv of [...invoices].sort((a, b) => a.invoice_date.localeCompare(b.invoice_date))) {
        const month = inv.invoice_date.slice(0, 7); trend.set(month, (trend.get(month) || 0) + inv.amount_total);
      }
      const buckets = [{ name: 'Non échues', value: 0 }, { name: '1–30 jours', value: 0 }, { name: '31–60 jours', value: 0 }, { name: 'Plus de 60 jours', value: 0 }];
      for (const inv of invoices) {
        const days = Math.floor((new Date(daysAgo(0)) - new Date(inv.due_date)) / 86400000);
        buckets[days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3].value += inv.amount_residual;
      }
      return { currency: 'MAD', aging: buckets, kpis: { invoiced: invoices.reduce((s, i) => s + i.amount_total, 0), settled: invoices.reduce((s, i) => s + i.amount_total - i.amount_residual, 0), receivable: invoices.reduce((s, i) => s + i.amount_residual, 0), overdue: invoices.filter(i => i.due_date < daysAgo(0)).reduce((s, i) => s + i.amount_residual, 0) }, trend: [...trend].slice(-6).map(([name, value]) => ({ name: new Date(`${name}-02`).toLocaleDateString('fr-FR', { month: 'short' }), value })), pending_approvals: user.capabilities.includes('approve') ? state.approvals.filter(a => a.state === 'waiting').length : null, pending_deliveries: user.capabilities.includes('stock') ? state.deliveries.filter(p => !['done', 'cancel'].includes(p.state)).length : null };
    },
    async settings() { authorize('admin'); return { company: user.company, threshold: state.threshold, currency: 'MAD' }; },
    async updateSettings(data) { authorize('admin'); if (!Number.isFinite(data.threshold) || data.threshold < 0 || data.threshold >= 100) throw new Error('Seuil invalide.'); state.threshold = data.threshold; persist(); return { threshold: state.threshold }; },
    reset() { state = seedDemo(); persist(); },
  };
}
