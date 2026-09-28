const fs = require('fs');
const content = `import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8069/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

export const login = async (loginId, password) => {
  const response = await api.post('/auth/login', { login: loginId, password });
  return response.data;
};

export const getCustomers = async () => {
  const response = await api.get('/customers');
  return response.data;
};

export const createCustomer = async (data) => {
  const response = await api.post('/customers', data);
  return response.data;
};

export const getProducts = async () => {
  const response = await api.get('/products');
  return response.data;
};

export const getOrders = async () => {
  const response = await api.get('/orders');
  return response.data;
};

export const getOrderDetails = async (id) => {
  const response = await api.get('/orders/' + id);
  return response.data;
};

export const createOrder = async (cartItems, partnerId, action = 'submit') => {
  const lines = cartItems.map(item => ({
    product_id: item.id,
    qty: item.qty,
    price: item.price,
    discount: item.discount
  }));
  const response = await api.post('/orders', { lines, partner_id: partnerId, action });
  return response.data;
};

export const getApprovals = async () => {
  const response = await api.get('/approvals');
  return response.data;
};

export const decideApproval = async (id, decision, reason) => {
  const response = await api.post('/approvals/' + id + '/decide', { decision, reason });
  return response.data;
};

export const getDeliveries = async () => {
  const response = await api.get('/deliveries');
  return response.data;
};

export const validateDelivery = async (id, lines) => {
  const response = await api.post('/deliveries/' + id + '/validate', { lines });
  return response.data;
};

export const createPurchase = async (partnerId, productId, qty, price) => {
  const response = await api.post('/purchases', { partner_id: partnerId, product_id: productId, qty, price });
  return response.data;
};

export const getReceptions = async () => {
  const response = await api.get('/receptions');
  return response.data;
};

export const validateReception = async (id, lines) => {
  const response = await api.post('/receptions/' + id + '/validate', { lines });
  return response.data;
};

export const getInvoices = async () => {
  const response = await api.get('/invoices');
  return response.data;
};

export const createInvoice = async (orderId) => {
  const response = await api.post('/orders/' + orderId + '/invoice');
  return response.data;
};

export const payInvoice = async (invoiceId, amount) => {
  const response = await api.post('/invoices/' + invoiceId + '/pay', { amount });
  return response.data;
};

export default api;`
fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/services/api.js', content, 'utf8');
