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

export const getProducts = async () => {
  const response = await api.get('/products');
  return response.data;
};

export const createOrder = async (cartItems) => {
  const lines = cartItems.map(item => ({
    product_id: item.id,
    qty: item.qty,
    price: item.price,
    discount: item.discount
  }));
  const response = await api.post('/orders', { lines });
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
