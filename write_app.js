const fs = require('fs');

const content = import React, { useState, useEffect } from 'react';
import { login, getProducts, createOrder, getApprovals, decideApproval } from './services/api';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [notification, setNotification] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      setUser(data);
      setError('');
      if (data.is_manager) {
        fetchApprovals();
      } else {
        fetchProducts();
      }
    } catch (err) {
      setError('Identifiants incorrects');
    }
  };

  const fetchProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const fetchApprovals = async () => {
    const data = await getApprovals();
    setApprovals(data);
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

  const submitOrder = async () => {
    try {
      const res = await createOrder(cart);
      setCart([]);
      if (res.margin_approval_state === 'waiting') {
        setNotification("Devis créé (#" + res.id + "). Marge à " + res.margin_percent.toFixed(2) + "% : demande d'approbation envoyée.");
      } else {
        setNotification("Devis créé et confirmé avec succès (#" + res.id + ") !");
      }
      setTimeout(() => setNotification(''), 5000);
    } catch (err) {
      alert("Erreur lors de la création de la commande.");
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
          <div className="mt-4 text-xs text-gray-500 text-center">
            Tests : commercial@optika.ma ou manager@optika.ma (mdp: demo123)
          </div>
        </div>
      </div>
    );
  }

  const { untaxed, marginPercent } = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="flex justify-between items-center mb-8 bg-white p-4 rounded shadow">
        <h1 className="text-xl font-bold text-blue-600">Optika B2B</h1>
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700">{user.name} ({user.is_manager ? 'Manager' : 'Commercial'})</span>
          <button onClick={() => { setUser(null); setCart([]); }} className="text-sm text-red-600 hover:underline">Déconnexion</button>
        </div>
      </header>

      {notification && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" role="alert">
          <p>{notification}</p>
        </div>
      )}

      {user.is_manager ? (
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-bold mb-6 text-gray-800">Approbations en attente</h2>
          {approvals.length === 0 ? (
            <p className="text-gray-500">Aucune demande d'approbation en attente.</p>
          ) : (
            <div className="space-y-4">
              {approvals.map(app => (
                <div key={app.id} className="border border-orange-200 bg-orange-50 rounded p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{app.order_name}</h3>
                    <p className="text-sm text-gray-600">Soumis par: {app.salesman}</p>
                    <p className="text-sm">Montant HT: <span className="font-bold">{app.amount.toFixed(2)} MAD</span> | Marge: <span className="font-bold text-red-600">{app.margin_rate.toFixed(2)}%</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDecision(app.id, 'approved')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-medium">Approuver</button>
                    <button onClick={() => handleDecision(app.id, 'refused')} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded font-medium">Refuser</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 bg-white rounded shadow p-6">
            <h2 className="text-lg font-bold mb-4">Catalogue Produits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map(p => (
                <div key={p.id} className="border rounded p-4 flex flex-col justify-between">
                  <h3 className="font-bold text-gray-800">{p.name}</h3>
                  <div className="mt-2 text-blue-600 font-bold">{p.price} MAD</div>
                  <button onClick={() => addToCart(p)} className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-3 rounded text-sm transition">Ajouter au devis</button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="w-full lg:w-96 bg-white rounded shadow p-6 h-fit sticky top-4">
            <h2 className="text-lg font-bold mb-4">Devis en cours</h2>
            {cart.length === 0 ? (
              <p className="text-gray-500 text-sm">Le devis est vide.</p>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {cart.map(item => (
                    <div key={item.id} className="flex flex-col border-b pb-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className="text-sm font-bold">{item.qty}x</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span>Remise (%) :</span>
                        <input type="number" className="w-16 border rounded p-1 text-right" value={item.discount} onChange={e => updateDiscount(item.id, e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 p-4 rounded mb-4">
                  <div className="flex justify-between mb-2">
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
                  <div className="text-xs text-orange-600 mb-4 bg-orange-100 p-2 rounded">
                    ?? Ce devis requiert une approbation du manager (Marge &lt; 15%).
                  </div>
                )}
                <button onClick={submitOrder} className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">
                  Créer le devis
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

fs.writeFileSync('C:/Users/PC/.gemini/antigravity/scratch/odoo-distribution-erp/frontend/src/App.jsx', content, 'utf8');
