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

export default api;`
fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/services/api.js', content, 'utf8');
