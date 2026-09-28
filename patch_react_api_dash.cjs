const fs = require('fs');
let content = fs.readFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/services/api.js', 'utf8');

if (!content.includes('export const getDashboard')) {
    content += `
export const getDashboard = async () => {
  const response = await api.get('/dashboard');
  return response.data;
};
`;
    fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/services/api.js', content, 'utf8');
}
