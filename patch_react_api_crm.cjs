const fs = require('fs');
let content = fs.readFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/services/api.js', 'utf8');

if (!content.includes('export const getLeads')) {
    content += `
export const getLeads = async () => {
  const response = await api.get('/crm/leads');
  return response.data;
};

export const createLead = async (name, partnerId, expectedRevenue) => {
  const response = await api.post('/crm/leads', { name, partner_id: partnerId, expected_revenue: expectedRevenue });
  return response.data;
};

export const markLeadWon = async (id) => {
  const response = await api.post('/crm/leads/' + id + '/won');
  return response.data;
};

export const markLeadLost = async (id) => {
  const response = await api.post('/crm/leads/' + id + '/lost');
  return response.data;
};
`;
    fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/services/api.js', content, 'utf8');
}
