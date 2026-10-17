export function quoteTotals(lines, threshold = 15) {
  const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price * (1 - line.discount / 100), 0);
  const cost = lines.reduce((sum, line) => sum + line.qty * (line.cost ?? 0), 0);
  const margin = subtotal - cost;
  const rate = subtotal > 0 ? margin / subtotal * 100 : 0;
  return { subtotal, cost, margin, rate, required: subtotal > 0 && rate + 1e-7 < threshold };
}

export function maximumDiscount(price, cost, threshold) {
  if (price <= 0 || threshold >= 100) return 0;
  return Math.max(0, Math.min(100, (1 - cost / (price * (1 - threshold / 100))) * 100));
}

export const money = (value, currency = 'MAD') => new Intl.NumberFormat('fr-MA', {
  style: 'currency', currency, maximumFractionDigits: 2,
}).format(Number(value) || 0);

export const percent = value => `${Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
export function date(value) {
  if (!value) return '—';
  const normalized = String(value).replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(parsed);
}
