import React, { useState, useEffect } from 'react';
import { 
  login, getProducts, getCustomers, createCustomer, 
  createOrder, getOrders, getOrderDetails, 
  getApprovals, decideApproval,
  getDeliveries, validateDelivery,
  createPurchase, getReceptions, validateReception,
  getInvoices, createInvoice, payInvoice,
  getLeads, createLead, markLeadWon, markLeadLost,
  getDashboard
} from './services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { TrendingUp, Target, Package, AlertCircle, ArrowRight, DollarSign, Search, UserPlus, ShoppingCart, Check, Plus, ShoppingBag, Eye, FileText } from 'lucide-react';


// --- UTILITY COMPONENTS ---
const Badge = ({ type, text }) => {
  const colors = {
    draft: 'bg-gray-100 text-gray-700 ring-gray-500/10',
    sale: 'bg-green-50 text-green-700 ring-green-600/20',
    waiting: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
    refused: 'bg-red-50 text-red-700 ring-red-600/10',
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    partial: 'bg-blue-50 text-blue-700 ring-blue-700/10',
    posted: 'bg-purple-50 text-purple-700 ring-purple-700/10',
    won: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    lost: 'bg-rose-50 text-rose-700 ring-rose-600/10',
    default: 'bg-gray-50 text-gray-600 ring-gray-500/10'
  };
  const color = colors[type] || colors.default;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${color}`}>
      {text}
    </span>
  );
};

const Card = ({ children, title, icon }) => (
  <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden flex flex-col h-full">
    {title && (
      <div className="border-b border-gray-100 px-6 py-4 flex items-center gap-3 bg-white">
        {icon && <span className="text-xl">{icon}</span>}
        <h3 className="text-base font-semibold leading-6 text-gray-900">{title}</h3>
      </div>
    )}
    <div className="px-6 py-5 flex-1 bg-white">
      {children}
    </div>
  </div>
);

function App() {
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => setIsDark(!isDark);
  
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [cart, setCart] = useState([]);
  
  const [approvals, setApprovals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryInputs, setDeliveryInputs] = useState({});

  const [receptions, setReceptions] = useState([]);
  const [receptionInputs, setReceptionInputs] = useState({});
  const [purchaseForm, setPurchaseForm] = useState({ supplierId: '', productId: '', qty: 1, price: 0 });

  const [invoices, setInvoices] = useState([]);
  const [paymentInputs, setPaymentInputs] = useState({});

  const [leads, setLeads] = useState([]);
  const [newLeadForm, setNewLeadForm] = useState({ name: '', partnerId: '', expectedRevenue: 0 });

  const [dashboard, setDashboard] = useState(null);

  const [activeTab, setActiveTab] = useState('');
  const [notification, setNotification] = useState('');

  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  // --- LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const data = await login(email, password);
      setUser(data);
      setError('');
      
      const role = data.role || (data.is_manager ? 'manager' : 'commercial');
      if (role === 'manager') {
        setActiveTab('dashboard');
        fetchDashboard();
      } else if (role === 'commercial') {
        setActiveTab('crm');
        fetchLeads();
        fetchCustomers();
      } else if (role === 'logistics') {
        setActiveTab('deliveries');
        fetchDeliveries();
      } else if (role === 'accountant') {
        setActiveTab('invoices');
        fetchInvoices();
      } else {
        setActiveTab('dashboard');
      }
    } catch (err) {
      setError('Identifiants incorrects ou problème de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setEmail('');
    setPassword('');
    setActiveTab('');
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const fetchProducts = async () => setProducts(await getProducts());
  const fetchCustomers = async () => {
    const data = await getCustomers();
    setCustomers(data);
    if(data.length > 0 && !selectedCustomer) setSelectedCustomer(data[0].id);
  };
  const fetchApprovals = async () => setApprovals(await getApprovals());
  const fetchOrders = async () => setOrders(await getOrders());
  
  const fetchDeliveries = async () => {
    const data = await getDeliveries();
    setDeliveries(data);
    const initInputs = {};
    data.forEach(d => d.lines.forEach(l => initInputs[l.move_id] = l.quantity || l.product_uom_qty));
    setDeliveryInputs(initInputs);
  };

  const fetchReceptions = async () => {
    const data = await getReceptions();
    setReceptions(data);
    const initInputs = {};
    data.forEach(d => d.lines.forEach(l => initInputs[l.move_id] = l.quantity || l.product_uom_qty));
    setReceptionInputs(initInputs);
  };

  const fetchInvoices = async () => {
    const data = await getInvoices();
    setInvoices(data);
    const initInputs = {};
    data.forEach(i => { if(i.amount_residual > 0) initInputs[i.id] = i.amount_residual; });
    setPaymentInputs(initInputs);
  };

  const fetchLeads = async () => setLeads(await getLeads());
  const fetchDashboard = async () => setDashboard(await getDashboard());

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const created = await createCustomer(newCustomer);
      await fetchCustomers();
      setSelectedCustomer(created.id);
      setShowCustomerForm(false);
      setNewCustomer({ name: '', email: '', phone: '' });
      showNotification("Client créé avec succès.");
    } catch (err) {
      alert("Erreur lors de la création du client");
    }
  };

  const addToCart = (product) => {
    const exists = cart.find(item => item.id === product.id);
    if (exists) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1, discount: 0 }]);
    }
  };

  const updateDiscount = (id, discount) => setCart(cart.map(item => item.id === id ? { ...item, discount: parseFloat(discount) || 0 } : item));
  const updateDeliveryQty = (moveId, qty) => setDeliveryInputs({...deliveryInputs, [moveId]: parseFloat(qty)});
  const updateReceptionQty = (moveId, qty) => setReceptionInputs({...receptionInputs, [moveId]: parseFloat(qty)});
  const updatePaymentQty = (invoiceId, amount) => setPaymentInputs({...paymentInputs, [invoiceId]: parseFloat(amount)});

  const processOrder = async (action) => {
    if (!selectedCustomer) return alert("Veuillez sélectionner un client");
    try {
      const res = await createOrder(cart, selectedCustomer, action);
      setCart([]);
      if (action === 'draft') showNotification(`Brouillon sauvegardé (#${res.name}).`);
      else if (res.margin_approval_state === 'waiting') showNotification(`Devis soumis pour approbation (Marge: ${res.margin_percent.toFixed(2)}%).`);
      else showNotification(`Commande ${res.name} confirmée avec succès !`);
    } catch (err) {
      alert("Erreur lors de la création du devis.");
    }
  };

  const handleDecision = async (id, decision) => {
    await decideApproval(id, decision, 'Décision manager');
    fetchApprovals();
    showNotification(`Devis ${decision === 'approved' ? 'approuvé' : 'refusé'}.`);
  };

  const handleDeliverySubmit = async (picking) => {
    const linesToSubmit = picking.lines.map(l => ({ move_id: l.move_id, qty_done: deliveryInputs[l.move_id] || 0 }));
    try {
      await validateDelivery(picking.id, linesToSubmit);
      showNotification(`Livraison ${picking.name} validée !`);
      fetchDeliveries();
    } catch (e) { alert("Erreur lors de la validation."); }
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if(!purchaseForm.supplierId || !purchaseForm.productId) return alert("Remplissez tous les champs.");
    try {
      const res = await createPurchase(purchaseForm.supplierId, purchaseForm.productId, purchaseForm.qty, purchaseForm.price);
      showNotification(`Commande d'achat ${res.name} envoyée !`);
      fetchReceptions();
      setPurchaseForm({ supplierId: '', productId: '', qty: 1, price: 0 });
    } catch(err) { alert("Erreur d'achat."); }
  };

  const handleReceptionSubmit = async (picking) => {
    const linesToSubmit = picking.lines.map(l => ({ move_id: l.move_id, qty_done: receptionInputs[l.move_id] || 0 }));
    try {
      await validateReception(picking.id, linesToSubmit);
      showNotification(`Réception ${picking.name} validée ! Stock mis à jour.`);
      fetchReceptions();
    } catch (e) { alert("Erreur de réception."); }
  };

  const handleCreateInvoice = async (orderId) => {
    try {
      await createInvoice(orderId);
      showNotification("Facture générée avec succès !");
      fetchOrders();
    } catch(err) { alert("Erreur lors de la facturation."); }
  };

  const handlePayInvoice = async (invoiceId) => {
    try {
      await payInvoice(invoiceId, paymentInputs[invoiceId]);
      showNotification("Paiement enregistré !");
      fetchInvoices();
    } catch(err) { alert("Erreur d'enregistrement."); }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      await createLead(newLeadForm.name, newLeadForm.partnerId, newLeadForm.expectedRevenue);
      showNotification("Nouvelle opportunité créée !");
      fetchLeads();
      setNewLeadForm({ name: '', partnerId: '', expectedRevenue: 0 });
    } catch(err) { alert("Erreur lors de la création de l'opportunité."); }
  };

  const handleLeadAction = async (id, action) => {
    try {
      if(action === 'won') await markLeadWon(id);
      if(action === 'lost') await markLeadLost(id);
      showNotification(`Opportunité marquée comme ${action === 'won' ? 'Gagnée' : 'Perdue'} !`);
      fetchLeads();
    } catch(err) { alert("Erreur lors de la modification de l'opportunité."); }
  };

  const calculateTotals = () => {
    let untaxed = 0, cost = 0;
    cart.forEach(item => {
      untaxed += item.qty * item.price * (1 - item.discount / 100);
      cost += item.qty * item.cost;
    });
    const margin = untaxed - cost;
    const marginPercent = untaxed > 0 ? (margin / untaxed) * 100 : 0;
    return { untaxed, margin, marginPercent };
  };

  const CHART_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];

  // --- RENDER LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md ring-1 ring-gray-900/5">
          <div className="text-center mb-10">
            <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
              <span className="text-white font-bold text-2xl">O</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Optika ERP</h1>
            <p className="text-sm text-gray-500 mt-2">Connectez-vous à votre espace de travail</p>
          </div>
          
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100">{error}</div>}
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Adresse Email</label>
              <div className="mt-2">
                <input 
                  type="text" required 
                  className="block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3" 
                  value={email} onChange={e => setEmail(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium leading-6 text-gray-900">Mot de passe</label>
              <div className="mt-2">
                <input 
                  type="password" required 
                  className="block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3" 
                  value={password} onChange={e => setPassword(e.target.value)} 
                />
              </div>
            </div>
            <button disabled={isLoading} className="w-full bg-indigo-600 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm hover:bg-indigo-500 transition-all disabled:opacity-50">
              {isLoading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-500 text-center mb-4 uppercase tracking-wider font-semibold">Comptes de Démonstration</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setEmail('manager@optika.ma'); setPassword('demo123'); }} className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded border border-slate-200 transition-colors">
                Manager
              </button>
              <button onClick={() => { setEmail('commercial@optika.ma'); setPassword('demo123'); }} className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded border border-slate-200 transition-colors">
                Commercial
              </button>
              <button onClick={() => { setEmail('logistique@optika.ma'); setPassword('demo123'); }} className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded border border-slate-200 transition-colors">
                Logistique
              </button>
              <button onClick={() => { setEmail('compta@optika.ma'); setPassword('demo123'); }} className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded border border-slate-200 transition-colors">
                Comptabilité
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { untaxed, marginPercent } = calculateTotals();

  // --- RENDER APP ---
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      
      {/* SIDEBAR */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user}
        fetchData={{ 
          dashboard: fetchDashboard, 
          manager: fetchApprovals, 
          deliveries: fetchDeliveries, 
          purchases: fetchReceptions, 
          invoices: fetchInvoices, 
          crm: fetchLeads, 
          catalog: fetchProducts, 
          my_orders: fetchOrders 
        }} 
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* HEADER */}
        <Header user={user} toggleTheme={toggleTheme} isDark={isDark} logout={logout} />
          
        {/* MAIN CONTENT */}
        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        
        {/* NOTIFICATION TOAST */}
        {notification && (
          <div className="fixed bottom-4 right-4 z-50 animate-fade-in-up">
            <div className="bg-slate-900 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3">
              <span className="text-emerald-400">✓</span>
              <p className="text-sm font-medium">{notification}</p>
            </div>
          </div>
        )}

        {/* --- DASHBOARD VIEW --- */}
        {activeTab === 'dashboard' && dashboard && (
          <div className="space-y-8 animate-fade-in">
            {/* Header / Welcome */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bonjour, {user?.name.split(' ')[0]} 👋</h2>
                <p className="text-slate-500 mt-1">Voici un résumé de l'activité de votre entreprise aujourd'hui.</p>
              </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* KPI 1 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="flex justify-between items-start relative">
                  <div>
                    <span className="text-sm font-medium text-slate-500">Chiffre d'Affaires</span>
                    <h3 className="text-3xl font-bold text-slate-900 mt-2">{dashboard.kpis.revenue.toLocaleString()} <span className="text-lg text-slate-400 font-medium">MAD</span></h3>
                  </div>
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm">
                  <span className="text-emerald-500 font-medium flex items-center"><TrendingUp className="w-4 h-4 mr-1"/> +12.5%</span>
                  <span className="text-slate-400 ml-2">ce mois</span>
                </div>
              </div>
              
              {/* KPI 2 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="flex justify-between items-start relative">
                  <div>
                    <span className="text-sm font-medium text-slate-500">Taux de Conversion</span>
                    <h3 className="text-3xl font-bold text-slate-900 mt-2">{dashboard.kpis.win_rate}<span className="text-lg text-slate-400 font-medium">%</span></h3>
                  </div>
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                    <Target className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  Sur un total de <span className="font-semibold text-slate-700">{dashboard.kpis.total_leads}</span> opportunités
                </div>
              </div>

              {/* KPI 3 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="flex justify-between items-start relative">
                  <div>
                    <span className="text-sm font-medium text-slate-500">À Livrer</span>
                    <h3 className="text-3xl font-bold text-slate-900 mt-2">{dashboard.kpis.pending_deliveries}</h3>
                  </div>
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                    <Package className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-500">
                  Bons de sortie en attente
                </div>
              </div>

              {/* KPI 4 */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                <div className="flex justify-between items-start relative">
                  <div>
                    <span className="text-sm font-medium text-slate-500">Approbations</span>
                    <h3 className="text-3xl font-bold text-slate-900 mt-2">{dashboard.kpis.pending_approvals}</h3>
                  </div>
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 text-sm text-rose-500 font-medium flex items-center">
                  Devis bloqués par la marge
                </div>
              </div>
            </div>

            {/* Charts & Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col lg:col-span-2">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900 text-lg">Meilleures Ventes</h3>
                  <p className="text-sm text-slate-500">Top 5 des produits en volume</p>
                </div>
                <div className="p-6 flex-1 min-h-[300px]">
                  {dashboard.top_products.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboard.top_products} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 13, fill: '#475569'}} width={140} />
                        <Tooltip 
                          cursor={{fill: '#f1f5f9'}}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px 16px' }} 
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                          {dashboard.top_products.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">Aucune donnée de vente.</div>
                  )}
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="bg-slate-900 rounded-2xl shadow-lg p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                <h3 className="font-semibold text-white text-lg relative z-10 mb-6">Actions Rapides</h3>
                
                <div className="flex flex-col gap-3 relative z-10 flex-1 justify-center">
                  <button onClick={() => {setActiveTab('manager'); fetchApprovals();}} className="group flex items-center justify-between p-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg"><AlertCircle className="w-5 h-5"/></div>
                      <span className="text-white font-medium text-sm">Traiter Approbations</span>
                    </div>
                    <div className="flex items-center text-slate-400 group-hover:text-white transition-colors">
                      {dashboard.kpis.pending_approvals > 0 && <span className="mr-3 bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{dashboard.kpis.pending_approvals}</span>}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  <button onClick={() => {setActiveTab('deliveries'); fetchDeliveries();}} className="group flex items-center justify-between p-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg"><Package className="w-5 h-5"/></div>
                      <span className="text-white font-medium text-sm">Gérer Livraisons</span>
                    </div>
                    <div className="flex items-center text-slate-400 group-hover:text-white transition-colors">
                      {dashboard.kpis.pending_deliveries > 0 && <span className="mr-3 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{dashboard.kpis.pending_deliveries}</span>}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  <button onClick={() => {setActiveTab('invoices'); fetchInvoices();}} className="group flex items-center justify-between p-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><DollarSign className="w-5 h-5"/></div>
                      <span className="text-white font-medium text-sm">Comptabilité</span>
                    </div>
                    <div className="flex items-center text-slate-400 group-hover:text-white transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CRM PIPELINE VIEW --- */}
        {activeTab === 'crm' && (
          <div className="space-y-8 animate-fade-in">
            {/* Header / Welcome */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Espace Commercial 🎯</h2>
                <p className="text-slate-500 mt-1">Gérez vos opportunités et suivez vos prospects.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Formulaire Nouvelle Opportunité */}
              <div className="xl:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-indigo-500" /> Nouvelle Opportunité
                    </h3>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleCreateLead} className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'opportunité</label>
                        <input type="text" required className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 bg-slate-50" value={newLeadForm.name} onChange={e => setNewLeadForm({...newLeadForm, name: e.target.value})} placeholder="Ex: Equipement Optique Pro" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Client (Optionnel)</label>
                        <select className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 bg-slate-50" value={newLeadForm.partnerId} onChange={e => setNewLeadForm({...newLeadForm, partnerId: e.target.value})}>
                          <option value="">-- Sélectionner --</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Revenu espéré (MAD)</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <DollarSign className="h-4 w-4 text-slate-400" />
                          </div>
                          <input type="number" className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pl-9 pr-4 py-2.5 bg-slate-50" value={newLeadForm.expectedRevenue} onChange={e => setNewLeadForm({...newLeadForm, expectedRevenue: e.target.value})} />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-indigo-500 hover:shadow transition-all mt-4 flex items-center justify-center gap-2">
                        Créer l'opportunité
                      </button>
                    </form>
                  </div>
                </div>
              </div>
              
              {/* Pipeline Kanban */}
              <div className="xl:col-span-3">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 flex flex-col h-full overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-500" /> Pipeline Commercial
                    </h3>
                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">{leads.length} opportunités</span>
                  </div>
                  <div className="p-6 bg-slate-50/50 flex-1">
                    {leads.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                        <Target className="w-12 h-12 mb-3 opacity-20" />
                        <p>Aucune opportunité en cours.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {leads.map(lead => (
                          <div key={lead.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col group relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-1 h-full ${lead.stage_name === 'Gagné' ? 'bg-emerald-500' : lead.stage_name === 'Perdu' ? 'bg-rose-500' : 'bg-indigo-500'}`}></div>
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-bold text-slate-900 line-clamp-2 pr-2">{lead.name}</h4>
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap uppercase tracking-wider
                                ${lead.stage_name === 'Gagné' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' 
                                : lead.stage_name === 'Perdu' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20' 
                                : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20'}`}>
                                {lead.stage_name}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 mb-4 flex-1 flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                {(lead.partner_name || 'S')[0]}
                              </div>
                              {lead.partner_name || 'Client Inconnu'}
                            </p>
                            
                            <div className="mt-auto border-t border-slate-100 pt-4">
                              <div className="flex justify-between items-center mb-4">
                                <span className="text-sm font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded-md">{lead.expected_revenue > 0 ? `${lead.expected_revenue.toLocaleString()} MAD` : '-'}</span>
                                <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                                  <Target className="w-3 h-3"/> {lead.probability}%
                                </div>
                              </div>
                              
                              {lead.stage_name !== 'Gagné' && lead.stage_name !== 'Perdu' && (
                                <div className="flex gap-3">
                                  <button onClick={() => handleLeadAction(lead.id, 'won')} className="flex-1 bg-white text-emerald-600 hover:bg-emerald-50 text-sm font-semibold py-2 rounded-lg transition-colors border border-slate-200 hover:border-emerald-200">
                                    Gagné
                                  </button>
                                  <button onClick={() => handleLeadAction(lead.id, 'lost')} className="flex-1 bg-white text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2 rounded-lg transition-colors border border-slate-200 hover:border-rose-200">
                                    Perdu
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- INVOICES VIEW --- */}
        {activeTab === 'invoices' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Comptabilité 🧾</h2>
                <p className="text-slate-500 mt-1">Suivi des factures clients et enregistrement des paiements.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" /> Factures Émises
                </h3>
              </div>
              <div className="p-6">
                {invoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <FileText className="w-12 h-12 mb-3 opacity-20" />
                    <p>Aucune facture émise pour le moment.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-4 px-5">Référence</th>
                          <th className="py-4 px-5">Client</th>
                          <th className="py-4 px-5">Montant Total</th>
                          <th className="py-4 px-5 text-center">Statut</th>
                          <th className="py-4 px-5 text-right">Reste à payer & Paiement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {invoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-5 whitespace-nowrap font-bold text-slate-900">{inv.name || 'Brouillon'}</td>
                            <td className="py-4 px-5 text-slate-600 font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">{(inv.partner_name||'C')[0]}</div>
                                {inv.partner_name}
                              </div>
                            </td>
                            <td className="py-4 px-5 font-bold text-slate-900">{inv.amount_total.toFixed(2)} <span className="text-xs font-normal text-slate-400">MAD</span></td>
                            <td className="py-4 px-5 text-center">
                              <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap uppercase tracking-wide
                                ${inv.payment_state === 'paid' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' 
                                : inv.payment_state === 'partial' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20' 
                                : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'}`}>
                                {inv.payment_state === 'paid' ? 'Payée' : inv.payment_state === 'partial' ? 'Partiel' : 'Non payée'}
                              </span>
                            </td>
                            <td className="py-4 px-5 text-right">
                              {inv.state === 'posted' && inv.amount_residual > 0 ? (
                                <div className="flex items-center justify-end gap-3">
                                  <span className="text-sm text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-md">{inv.amount_residual.toFixed(2)} <span className="text-xs font-normal">MAD</span></span>
                                  <div className="flex items-center">
                                    <input 
                                      type="number" 
                                      className="block w-24 rounded-l-lg border-slate-200 py-2 text-slate-900 shadow-sm focus:ring-2 focus:ring-indigo-600 sm:text-sm text-right bg-white"
                                      value={paymentInputs[inv.id] || 0}
                                      onChange={(e) => updatePaymentQty(inv.id, e.target.value)}
                                      max={inv.amount_residual}
                                      placeholder="0.00"
                                    />
                                    <button onClick={() => handlePayInvoice(inv.id)} className="bg-indigo-600 text-white px-4 py-2 rounded-r-lg text-sm font-semibold hover:bg-indigo-500 transition-colors border border-indigo-600">
                                      Payer
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full"><Check className="w-4 h-4"/> Soldé</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- PURCHASES VIEW --- */}
        {activeTab === 'purchases' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <Card title="Nouvelle Commande d'Achat" icon="🛒">
                <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fournisseur</label>
                    <select required className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm px-3 bg-white" value={purchaseForm.supplierId} onChange={e => setPurchaseForm({...purchaseForm, supplierId: e.target.value})}>
                      <option value="">-- Sélectionner --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Produit manquant</label>
                    <select required className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm px-3 bg-white" value={purchaseForm.productId} onChange={e => setPurchaseForm({...purchaseForm, productId: e.target.value})}>
                      <option value="">-- Sélectionner --</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Quantité</label>
                      <input type="number" min="1" required className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm px-3" value={purchaseForm.qty} onChange={e => setPurchaseForm({...purchaseForm, qty: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prix Unitaire</label>
                      <input type="number" required className="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm px-3" value={purchaseForm.price} onChange={e => setPurchaseForm({...purchaseForm, price: e.target.value})} />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-2.5 px-4 rounded-md shadow-sm hover:bg-slate-800 transition-colors mt-2">
                    Commander au fournisseur
                  </button>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card title="Réceptions en attente" icon="📦">
                {receptions.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Rien à réceptionner pour le moment.</p>
                ) : (
                  <div className="space-y-6">
                    {receptions.map(r => (
                      <div key={r.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                        <div className="bg-slate-100/50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                          <div>
                            <h4 className="font-bold text-slate-900">{r.name}</h4>
                            <p className="text-xs text-slate-500">Fournisseur : {r.partner_name}</p>
                          </div>
                          <Badge type="waiting" text={r.state} />
                        </div>
                        <div className="p-4">
                          <table className="min-w-full text-sm">
                            <thead className="text-slate-500 border-b border-slate-200">
                              <tr>
                                <th className="pb-2 text-left font-medium">Article</th>
                                <th className="pb-2 text-center font-medium">Attendu</th>
                                <th className="pb-2 text-right font-medium">Reçu</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {r.lines.map(l => (
                                <tr key={l.move_id}>
                                  <td className="py-3 font-medium text-slate-900">{l.product_name}</td>
                                  <td className="py-3 text-center text-slate-600">{l.product_uom_qty}</td>
                                  <td className="py-3 text-right">
                                    <input 
                                      type="number" 
                                      className="inline-block w-20 rounded-md border-0 py-1.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm text-center"
                                      value={receptionInputs[l.move_id] !== undefined ? receptionInputs[l.move_id] : (l.quantity || 0)}
                                      onChange={(e) => updateReceptionQty(l.move_id, e.target.value)}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="mt-4 flex justify-end">
                            <button onClick={() => handleReceptionSubmit(r)} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-semibold shadow-sm hover:bg-emerald-500 transition-colors">
                              Mettre en stock
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* --- DELIVERIES VIEW --- */}
        {activeTab === 'deliveries' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Expéditions 🚚</h2>
                <p className="text-slate-500 mt-1">Gérez les bons de livraison et les sorties de stock.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
              {deliveries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Truck className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg">Aucun colis à préparer pour le moment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {deliveries.map(d => (
                    <div key={d.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group">
                      <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                            {d.name}
                          </h4>
                          <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                            <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">{(d.partner_name||'C')[0]}</span>
                            {d.partner_name}
                          </p>
                        </div>
                        <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200/50 uppercase tracking-wide">
                          {d.state === 'assigned' ? 'Prêt à expédier' : d.state}
                        </span>
                      </div>
                      <div className="p-5">
                        <table className="w-full text-sm mb-5">
                          <thead className="text-slate-500 bg-slate-50/50 rounded-lg">
                            <tr>
                              <th className="py-2.5 px-3 text-left font-semibold rounded-l-lg">Produit</th>
                              <th className="py-2.5 px-3 text-center font-semibold">À Livrer</th>
                              <th className="py-2.5 px-3 text-right font-semibold rounded-r-lg">Fait</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {d.lines.map(l => (
                              <tr key={l.move_id} className="group-hover:bg-slate-50/30 transition-colors">
                                <td className="py-3 px-3 text-slate-900 font-medium">
                                  <div className="line-clamp-1" title={l.product_name}>{l.product_name}</div>
                                </td>
                                <td className="py-3 px-3 text-center text-slate-600 font-bold bg-slate-50/50">{l.product_uom_qty}</td>
                                <td className="py-3 px-3 text-right">
                                  <input 
                                    type="number" min="0" max={l.product_uom_qty}
                                    className="inline-block w-20 rounded-xl border-slate-200 py-1.5 text-slate-900 shadow-sm focus:ring-2 focus:ring-indigo-600 sm:text-sm text-center font-semibold bg-white"
                                    value={deliveryInputs[l.move_id] !== undefined ? deliveryInputs[l.move_id] : (l.quantity || 0)}
                                    onChange={(e) => updateDeliveryQty(l.move_id, e.target.value)}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button onClick={() => handleDeliverySubmit(d)} className="w-full bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 hover:shadow">
                          <Check className="w-4 h-4"/> Valider la Sortie
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- APPROVALS VIEW --- */}
        {activeTab === 'manager' && (
          <Card title="Demandes de Dérogation (Marge < 15%)" icon="⚖️">
            {approvals.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Tout est au vert ! Aucune demande.</p>
            ) : (
              <div className="space-y-4">
                {approvals.map(app => (
                  <div key={app.id} className="flex flex-col sm:flex-row justify-between items-center border border-amber-200 bg-amber-50 rounded-xl p-4 shadow-sm">
                    <div className="mb-4 sm:mb-0 text-center sm:text-left">
                      <h4 className="font-bold text-amber-900 text-lg">{app.order_name}</h4>
                      <p className="text-sm text-amber-700 font-medium">Vendeur: {app.salesman}</p>
                      <div className="mt-1 flex items-center gap-4 text-sm justify-center sm:justify-start">
                        <span className="text-slate-600">Total HT: <strong className="text-slate-900">{app.amount.toFixed(2)} MAD</strong></span>
                        <span className="text-slate-600">Marge: <strong className="text-rose-600 text-base">{app.margin_rate.toFixed(2)}%</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleDecision(app.id, 'refused')} className="bg-white text-rose-600 border border-rose-200 px-4 py-2 rounded-md text-sm font-semibold hover:bg-rose-50 transition-colors">
                        Refuser
                      </button>
                      <button onClick={() => handleDecision(app.id, 'approved')} className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-semibold shadow-sm hover:bg-emerald-500 transition-colors">
                        Approuver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* --- SALES: MY ORDERS VIEW --- */}
        {activeTab === 'my_orders' && (
          <Card title="Historique de mes Devis" icon="📋">
            {orders.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Vous n'avez pas encore créé de devis.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Référence</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4 text-right">Montant HT</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4 font-semibold text-slate-900">{o.name}</td>
                        <td className="py-4 px-4 text-slate-500 text-sm">{o.date_order}</td>
                        <td className="py-4 px-4 text-slate-700">{o.partner_name}</td>
                        <td className="py-4 px-4 font-bold text-slate-900 text-right">{o.amount_total.toFixed(2)}</td>
                        <td className="py-4 px-4 text-center">
                          {o.margin_approval_state === 'waiting' ? <Badge type="waiting" text="En approbation" />
                          : o.margin_approval_state === 'refused' ? <Badge type="refused" text="Refusé" />
                          : o.state === 'draft' ? <Badge type="draft" text="Brouillon" />
                          : o.state === 'sale' ? <Badge type="sale" text="Confirmé" />
                          : <Badge type="default" text={o.state} />}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {o.state === 'sale' && (
                            <button onClick={() => handleCreateInvoice(o.id)} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-md font-semibold transition-colors">
                              Facturer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* --- SALES: CATALOG / NEW QUOTE VIEW --- */}
        {activeTab === 'catalog' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Nouveau Devis 📝</h2>
                <p className="text-slate-500 mt-1">Créez un devis en sélectionnant des produits du catalogue.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-900 text-lg flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-indigo-500" /> Catalogue Produits
                    </h3>
                  </div>
                  <div className="p-6 bg-slate-50/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {products.map(p => (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group">
                          <div>
                            <div className="flex justify-between items-start">
                              <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight pr-2">{p.name}</h3>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">REF: P{p.id.toString().padStart(4, '0')}</span>
                            </div>
                          </div>
                          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="text-xl font-bold text-slate-900">{p.price} <span className="text-sm font-medium text-slate-400">MAD</span></span>
                            <button onClick={() => addToCart(p)} className="bg-slate-50 text-indigo-600 hover:bg-indigo-600 hover:text-white h-10 w-10 rounded-xl flex items-center justify-center transition-all border border-slate-200 hover:border-indigo-600 hover:shadow-sm">
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="xl:col-span-1">
                <div className="sticky top-24 space-y-6">
                  
                  {/* CLIENT WIDGET */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-indigo-500" /> Informations Client
                      </h3>
                    </div>
                    <div className="p-5">
                      {showCustomerForm ? (
                        <form onSubmit={handleCreateCustomer} className="space-y-4">
                          <input type="text" placeholder="Nom complet" required className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 bg-slate-50" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                          <input type="email" placeholder="Email" className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 bg-slate-50" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                          <input type="text" placeholder="Téléphone" className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 bg-slate-50" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                          <div className="flex gap-3 pt-2">
                            <button type="submit" className="flex-1 bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-500 shadow-sm transition-colors">Enregistrer</button>
                            <button type="button" onClick={() => setShowCustomerForm(false)} className="flex-1 bg-white text-slate-700 text-sm font-semibold py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors">Annuler</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex gap-3">
                          <select className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 bg-slate-50" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                            <option value="">-- Choisir un client --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <button onClick={() => setShowCustomerForm(true)} className="bg-slate-100 text-indigo-600 px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors border border-slate-200 hover:border-indigo-200 flex items-center justify-center" title="Nouveau client">
                            <Plus className="w-5 h-5"/>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CART WIDGET */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-indigo-500" /> Lignes du devis
                      </h3>
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
                    </div>
                    <div className="p-5">
                      {cart.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 flex flex-col items-center">
                          <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
                          <p className="text-sm">Le devis est vide.</p>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {cart.map(item => (
                              <div key={item.id} className="flex flex-col p-4 bg-slate-50/80 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="font-bold text-sm text-slate-900 leading-tight pr-2">{item.name}</span>
                                  <span className="text-xs font-bold bg-white text-indigo-700 px-2 py-1 rounded-md shadow-sm border border-slate-100 whitespace-nowrap">x {item.qty}</span>
                                </div>
                                <div className="flex justify-between items-center mt-auto pt-3 border-t border-slate-200/60">
                                  <span className="text-xs font-medium text-slate-500">Remise (%)</span>
                                  <input type="number" min="0" max="100" className="w-16 rounded-lg border-slate-200 py-1 text-slate-900 shadow-sm focus:ring-2 focus:ring-indigo-600 sm:text-xs text-right" value={item.discount} onChange={e => updateDiscount(item.id, e.target.value)} />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 border-t border-slate-200 pt-5">
                            <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-16 bg-indigo-500 rounded-full blur-[50px] opacity-20 pointer-events-none"></div>
                              <div className="flex justify-between items-center mb-3 relative z-10">
                                <span className="text-slate-400 text-sm font-medium">Total HT</span>
                                <span className="text-2xl font-bold">{untaxed.toFixed(2)} <span className="text-sm font-normal text-slate-400">MAD</span></span>
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-slate-700/50 relative z-10">
                                <span className="text-slate-400 text-sm font-medium">Taux de marque</span>
                                <span className={`text-lg font-bold ${marginPercent < 15 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                  {marginPercent.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {marginPercent > 0 && marginPercent < 15 && (
                            <div className="mt-5 bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 items-start">
                              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-rose-700 leading-relaxed font-medium">
                                Marge inférieure à 15%. Ce devis sera soumis à l'approbation du manager.
                              </p>
                            </div>
                          )}
                          
                          <div className="mt-5 flex flex-col gap-3">
                            <button onClick={() => processOrder('draft')} className="w-full bg-white text-slate-700 border border-slate-200 font-semibold py-3 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
                              Sauvegarder en Brouillon
                            </button>
                            <button onClick={() => processOrder('submit')} className={`w-full text-white font-semibold py-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 ${marginPercent < 15 ? 'bg-rose-500 hover:bg-rose-600 hover:shadow-md' : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-md'}`}>
                              {marginPercent < 15 ? <><AlertCircle className="w-4 h-4"/> Demander Approbation</> : <><Check className="w-4 h-4"/> Confirmer la commande</>}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

export default App;