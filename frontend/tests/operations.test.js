import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteTotals, maximumDiscount } from '../src/domain/quote.js';
import { createDemoService } from '../src/services/demo.js';

const service = role => { const api = createDemoService(null); api.start(role); return api; };
const quote = { partner_id: 1, action: 'submit', justification: 'Partenariat annuel', lines: [{ product_id: 1, qty: 10, price: 100, discount: 10 }] };

test('margin calculation respects exact threshold and maximum discount', () => {
  const result = quoteTotals([{ qty: 10, price: 100, discount: 10, cost: 80 }]);
  assert.equal(result.subtotal, 900); assert.equal(result.margin, 100); assert.equal(result.required, true);
  assert.equal(quoteTotals([{ qty: 1, price: 100, discount: 0, cost: 85 }]).required, false);
  assert.ok(Math.abs(maximumDiscount(100, 80, 15) - 5.882352941) < 1e-6);
});

test('low-margin submission creates a request rather than a confirmed sale', async () => {
  const api = service('manager'), order = await api.createOrder(quote);
  assert.equal(order.state, 'draft'); assert.equal(order.margin_approval_state, 'waiting');
  const approvals = await api.approvals({ state: 'waiting' });
  assert.ok(approvals.items.some(a => a.order_id === order.id));
});

test('unauthorized commercial cannot decide approvals or register payments', async () => {
  const api = service('commercial');
  await assert.rejects(api.decideApproval(101, { decision: 'approved', reason: 'Accord' }), /rôle/);
  await assert.rejects(api.payInvoice(6, { amount: 100 }), /rôle/);
});

test('invalid submission leaves no partially saved order', async () => {
  const api = service('commercial'), before = (await api.orders()).total;
  await assert.rejects(api.createOrder({ ...quote, justification: '' }), /raison/);
  assert.equal((await api.orders()).total, before);
});

test('approval, partial delivery, partial invoicing and payment complete the scenario', async () => {
  const api = service('manager'), order = await api.createOrder(quote);
  const approval = (await api.approvals({ state: 'waiting' })).items.find(a => a.order_id === order.id);
  await api.decideApproval(approval.id, { decision: 'approved', reason: 'Potentiel annuel confirmé' });
  assert.equal((await api.order(order.id)).state, 'draft');
  await api.submitOrder(order.id, {});
  const picking = (await api.deliveries()).items.find(p => p.origin === order.name);
  const result = await api.validatePicking('deliveries', picking.id, { backorder: 'create', lines: [{ move_id: picking.lines[0].move_id, qty_done: 4 }] });
  assert.equal(result.backorders.length, 1);
  const backorder = (await api.deliveries()).items.find(p => p.backorder_id === picking.id);
  assert.equal(backorder.lines[0].product_uom_qty, 6);
  const created = await api.createInvoice(order.id);
  const invoice = (await api.invoices()).items.find(inv => inv.name === created.invoices[0]);
  assert.equal(invoice.amount_total, 360);
  await api.payInvoice(invoice.id, { amount: 100 });
  assert.equal((await api.invoices()).items.find(i => i.id === invoice.id).amount_residual, 260);
  await assert.rejects(api.payInvoice(invoice.id, { amount: 261 }), /solde/);
  await assert.rejects(api.createInvoice(order.id), /quantité/);
});

test('commercial edit cancels the approval and requires a new request', async () => {
  const api = service('manager');
  await api.decideApproval(101, { decision: 'approved', reason: 'Accord exceptionnel' });
  const updated = await api.updateOrder(101, { partner_id: 1, lines: [{ product_id: 1, qty: 10, price: 100, discount: 12 }] });
  assert.equal(updated.revision, 2); assert.equal(updated.margin_approval_state, 'to_request');
  assert.equal(updated.history[0].state, 'cancelled');
  await assert.rejects(api.submitOrder(101, {}), /raison/);
});

test('changing company threshold prevents reuse of an earlier approval', async () => {
  const api = service('manager');
  await api.decideApproval(101, { decision: 'approved', reason: 'Accord exceptionnel' });
  await api.updateSettings({ threshold: 20 });
  await assert.rejects(api.submitOrder(101, {}), /conditions/);
});

test('negative preparation does not change inventory', async () => {
  const api = service('manager'), before = (await api.products()).items.find(p => p.id === 2).qty_available;
  await assert.rejects(api.validatePicking('deliveries', 101, { backorder: 'create', lines: [{ move_id: 101, qty_done: -1 }] }));
  assert.equal((await api.products()).items.find(p => p.id === 2).qty_available, before);
});

test('aging totals reconcile with receivables', async () => {
  const api = service('accountant'), dashboard = await api.dashboard();
  assert.equal(dashboard.aging.reduce((sum, bucket) => sum + bucket.value, 0), dashboard.kpis.receivable);
  assert.equal(dashboard.kpis.invoiced - dashboard.kpis.settled, dashboard.kpis.receivable);
});

test('demo data persists between roles and can be reset', async () => {
  const memory = new Map(), storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const first = createDemoService(storage); first.start('commercial'); await first.createOrder({ ...quote, action: 'draft' });
  const second = createDemoService(storage); second.start('manager'); assert.equal((await second.orders()).total, 4);
  second.reset(); assert.equal((await second.orders()).total, 3);
});
