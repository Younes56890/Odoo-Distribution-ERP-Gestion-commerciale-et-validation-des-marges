const fs = require('fs');

const content = `import React, { useState, useEffect } from 'react';
import { 
  login, getProducts, getCustomers, createCustomer, 
  createOrder, getOrders, getOrderDetails, 
  getApprovals, decideApproval 
} from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [cart, setCart] = useState([]);
  
  const [approvals, setApprovals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('catalog'); // catalog, my_orders, manager
  const [notification, setNotification] = useState('');

  // Customer creation form
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      setUser(data);
      setError('');
      if (data.is_manager) {
        setActiveTab('manager');
        fetchApprovals();
      } else {
        setActiveTab('catalog');
        fetchProducts();
        fetchCustomers();
      }
    } catch (err) {
      setError('Identifiants incorrects');
    }
  };

  const fetchProducts = async () => setProducts(await getProducts());
  const fetchCustomers = async () => {
    const data = await getCustomers();
    setCustomers(data);
    if(data.length > 0 && !selectedCustomer) setSelectedCustomer(data[0].id);
  };
  const fetchApprovals = async () => setApprovals(await getApprovals());
  const fetchOrders = async () => setOrders(await getOrders());

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const created = await createCustomer(newCustomer);
      await fetchCustomers();
      setSelectedCustomer(created.id);
      setShowCustomerForm(false);
      setNewCustomer({ name: '', email: '', phone: '' });
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

  const updateDiscount = (id, discount) => {
    setCart(cart.map(item => item.id === id ? { ...item, discount: parseFloat(discount) || 0 } : item));
  };

  const processOrder = async (action) => { // 'draft' or 'submit'
    if (!selectedCustomer) return alert("Veuillez sélectionner un client");
    try {
      const res = await createOrder(cart, selectedCustomer, action);
      setCart([]);
      if (action === 'draft') {
        setNotification("Brouillon sauvegardé (#" + res.name + ").");
      } else if (res.margin_approval_state === 'waiting') {
        setNotification("Devis (" + res.name + ") soumis. Marge à " + res.margin_percent.toFixed(2) + "% : approbation requise.");
      } else {
        setNotification("Commande (" + res.name + ") confirmée avec succès !");
      }
      setTimeout(() => setNotification(''), 5000);
    } catch (err) {
      alert("Erreur lors de la création du devis.");
    }
  };

  const handleDecision = async (id, decision) => {
    await decideApproval(id, decision, 'Décision depuis App React');
    fetchApprovals();
  };

  const calculateTotals = () => {
    let untaxed = 0;
    let cost = 0;
    cart.forEach(item => {
      const lineTotal = item.qty * item.price * (1 - item.discount / 100);
      untaxed += lineTotal;
      cost += item.qty * item.cost;
    });
    const margin = untaxed - cost;
    const marginPercent = untaxed > 0 ? (margin / untaxed) * 100 : 0;
    return { untaxed, margin, marginPercent };
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96 border-t-4 border-blue-600">
          <h1 className="text-2xl font-bold mb-6 text-center text-blue-600">Optika B2B</h1>
          {error && <div className="bg-red-100 text-red-600 p-3 rounded mb-4">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
              <input type="text" className="w-full p-2 border rounded" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">Mot de passe</label>
              <input type="password" className="w-full p-2 border rounded" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700">Connexion</button>
          </form>
        </div>
      </div>
    );
  }

  const { untaxed, marginPercent } = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-blue-600">Optika ERP</h1>
          {user.is_manager ? (
            <nav className="flex gap-4">
              <button onClick={() => {setActiveTab('manager'); fetchApprovals();}} className={activeTab === 'manager' ? "font-bold text-blue-600 border-b-2 border-blue-600 pb-1" : "text-gray-600"}>Approbations</button>
            </nav>
          ) : (
            <nav className="flex gap-4">
              <button onClick={() => setActiveTab('catalog')} className={activeTab === 'catalog' ? "font-bold text-blue-600 border-b-2 border-blue-600 pb-1" : "text-gray-600"}>Nouveau Devis</button>
              <button onClick={() => {setActiveTab('my_orders'); fetchOrders();}} className={activeTab === 'my_orders' ? "font-bold text-blue-600 border-b-2 border-blue-600 pb-1" : "text-gray-600"}>Mes Devis</button>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">{user.name}</span>
          <button onClick={() => { setUser(null); setCart([]); }} className="text-xs text-red-600 hover:underline">Déconnexion</button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {notification && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
            <p>{notification}</p>
          </div>
        )}

        {/* --- MANAGER VIEW --- */}
        {activeTab === 'manager' && (
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Dérogations de marge</h2>
            {approvals.length === 0 ? (
              <p className="text-gray-500">Aucune demande en attente.</p>
            ) : (
              <div className="space-y-4">
                {approvals.map(app => (
                  <div key={app.id} className="border border-orange-200 bg-orange-50 rounded p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{app.order_name}</h3>
                      <p className="text-sm text-gray-600">Par: {app.salesman}</p>
                      <p className="text-sm">Montant HT: <span className="font-bold">{app.amount.toFixed(2)} MAD</span> | Marge: <span className="font-bold text-red-600">{app.margin_rate.toFixed(2)}%</span></p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDecision(app.id, 'approved')} className="bg-green-500 text-white px-4 py-2 rounded">Approuver</button>
                      <button onClick={() => handleDecision(app.id, 'refused')} className="bg-red-500 text-white px-4 py-2 rounded">Refuser</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- SALES: MY ORDERS VIEW --- */}
        {activeTab === 'my_orders' && (
          <div className="bg-white rounded shadow p-6">
            <h2 className="text-xl font-bold mb-6">Mon Historique</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500">Vous n'avez aucun devis.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-sm">
                    <th className="p-2 border-b">Référence</th>
                    <th className="p-2 border-b">Date</th>
                    <th className="p-2 border-b">Client</th>
                    <th className="p-2 border-b">Montant HT</th>
                    <th className="p-2 border-b">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{o.name}</td>
                      <td className="p-2 text-sm text-gray-600">{o.date_order}</td>
                      <td className="p-2">{o.partner_name}</td>
                      <td className="p-2 font-bold">{o.amount_total.toFixed(2)}</td>
                      <td className="p-2">
                        {o.margin_approval_state === 'waiting' ? (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">En approbation</span>
                        ) : o.margin_approval_state === 'refused' ? (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Refusé</span>
                        ) : o.state === 'draft' ? (
                          <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">Brouillon</span>
                        ) : o.state === 'sale' ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Confirmé</span>
                        ) : (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">{o.state}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* --- SALES: CATALOG / NEW QUOTE VIEW --- */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <h2 className="text-lg font-bold mb-4">Catalogue</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map(p => (
                  <div key={p.id} className="bg-white border rounded p-4 flex flex-col justify-between shadow-sm hover:shadow">
                    <h3 className="font-bold text-gray-800">{p.name}</h3>
                    <div className="mt-2 text-blue-600 font-bold">{p.price} MAD</div>
                    <button onClick={() => addToCart(p)} className="mt-4 bg-gray-100 hover:bg-gray-200 text-sm font-medium py-1 px-3 rounded transition">Ajouter</button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="w-full lg:w-96 flex flex-col gap-4">
              {/* Client Selection */}
              <div className="bg-white rounded shadow-sm border p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-gray-800">Client</h3>
                  <button onClick={() => setShowCustomerForm(!showCustomerForm)} className="text-xs text-blue-600 hover:underline">+ Nouveau</button>
                </div>
                {showCustomerForm ? (
                  <form onSubmit={handleCreateCustomer} className="text-sm flex flex-col gap-2 bg-blue-50 p-3 rounded">
                    <input type="text" placeholder="Nom complet" required className="p-1 border rounded" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                    <input type="email" placeholder="Email" className="p-1 border rounded" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                    <input type="text" placeholder="Téléphone" className="p-1 border rounded" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                    <div className="flex gap-2 mt-1">
                      <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded w-full">Créer</button>
                      <button type="button" onClick={() => setShowCustomerForm(false)} className="bg-gray-300 px-2 py-1 rounded w-full">Annuler</button>
                    </div>
                  </form>
                ) : (
                  <select className="w-full p-2 border rounded text-sm" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                    <option value="">-- Choisir un client --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              {/* Cart / Quote */}
              <div className="bg-white rounded shadow-sm border p-4 sticky top-4">
                <h3 className="font-bold text-gray-800 mb-4">Lignes du devis</h3>
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-sm">Le devis est vide.</p>
                ) : (
                  <>
                    <div className="space-y-3 mb-6 max-h-60 overflow-y-auto pr-2">
                      {cart.map(item => (
                        <div key={item.id} className="flex flex-col border-b pb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-sm truncate pr-2">{item.name}</span>
                            <span className="text-sm font-bold bg-gray-100 px-2 rounded">{item.qty}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Remise (%)</span>
                            <input type="number" className="w-16 border rounded p-1 text-right bg-blue-50" value={item.discount} onChange={e => updateDiscount(item.id, e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50 p-3 rounded mb-4 text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600">Total HT</span>
                        <span className="font-bold">{untaxed.toFixed(2)} MAD</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Taux de marque</span>
                        <span className={marginPercent < 15 ? 'font-bold text-red-500' : 'font-bold text-green-500'}>
                          {marginPercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {marginPercent > 0 && marginPercent < 15 && (
                      <div className="text-xs text-orange-700 bg-orange-100 p-2 rounded mb-4 flex items-start gap-1">
                        <span>??</span>
                        <span>Attention : La marge étant sous les 15%, ce devis nécessitera une dérogation manager s'il est soumis.</span>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2">
                      <button onClick={() => processOrder('draft')} className="w-full bg-gray-200 text-gray-800 font-medium py-2 rounded hover:bg-gray-300">
                        Sauvegarder (Brouillon)
                      </button>
                      <button onClick={() => processOrder('submit')} className="w-full bg-blue-600 text-white font-medium py-2 rounded hover:bg-blue-700">
                        {marginPercent < 15 ? 'Demander l\\'approbation' : 'Confirmer la commande'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;`

fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/App.jsx', content, 'utf8');
