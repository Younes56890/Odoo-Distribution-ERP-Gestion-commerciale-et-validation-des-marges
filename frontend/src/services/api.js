import axios from 'axios';
import { createDemoService } from './demo.js';

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true });
let csrfToken;
let demo;
http.interceptors.request.use(config => {
  if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});
http.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && !error.config.url.endsWith('/auth/login')) window.dispatchEvent(new Event('optika-session-expired'));
  const failure = new Error(error.response?.data?.error || 'Connexion au serveur impossible. Vérifiez que Odoo est démarré.');
  failure.status = error.response?.status;
  return Promise.reject(failure);
});
const get = async (path, params) => (await http.get(path, { params })).data;
const post = async (path, data = {}) => (await http.post(path, data)).data;
const methods = {
  products: query => get('/products', query), customers: query => get('/customers', query),
  createCustomer: data => post('/customers', data), orders: query => get('/orders', query),
  order: id => get(`/orders/${id}`), createOrder: data => post('/orders', data),
  updateOrder: (id, data) => post(`/orders/${id}`, data), submitOrder: (id, data) => post(`/orders/${id}/submit`, data),
  approvals: query => get('/approvals', query), decideApproval: (id, data) => post(`/approvals/${id}/decide`, data),
  deliveries: query => get('/deliveries', query), receptions: query => get('/receptions', query),
  validatePicking: (kind, id, data) => post(`/${kind}/${id}/validate`, data),
  createPurchase: data => post('/purchases', data), invoices: query => get('/invoices', query),
  createInvoice: id => post(`/orders/${id}/invoice`), payInvoice: (id, data) => post(`/invoices/${id}/pay`, data),
  leads: query => get('/crm/leads', query), createLead: data => post('/crm/leads', data),
  leadAction: (id, action) => post(`/crm/leads/${id}/${action}`), dashboard: () => get('/dashboard'),
  settings: () => get('/settings'), updateSettings: data => post('/settings', data),
  automationOverview: () => get('/automation').catch(error => {
    if (error.status === 404) return { available: false };
    throw error;
  }),
  automationJobs: query => get('/automation/jobs', query), automationRuns: query => get('/automation/runs', query),
  updateAutomation: data => post('/automation/policy', data), runAutomation: () => post('/automation/run'),
  retryAutomation: id => post(`/automation/jobs/${id}/retry`),
  automationDocument: id => get(`/automation/jobs/${id}/document`),
};
export const api = Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, (...args) => demo ? demo[name](...args) : method(...args)]));
export async function login(login, password) {
  demo = null;
  await post('/auth/login', { login, password });
  return restoreSession();
}
export async function restoreSession() {
  const user = await get('/auth/session'); csrfToken = user.csrf_token; return user;
}
export async function logout() {
  if (demo) { await demo.logout(); demo = null; } else await post('/auth/logout');
  csrfToken = null;
}
export function startDemo(role) { demo = createDemoService(); return demo.start(role); }
export function resetDemo() { demo?.reset(); }
