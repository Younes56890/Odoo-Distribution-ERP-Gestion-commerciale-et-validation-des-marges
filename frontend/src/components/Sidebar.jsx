import React from 'react';
import { LayoutDashboard, CheckSquare, Truck, ShoppingCart, FileText, Target, FilePlus, Files } from 'lucide-react';

const menuItems = [
  { name: 'Tableau de Bord', icon: LayoutDashboard, tab: 'dashboard', roles: ['manager', 'accountant'] },
  { name: 'CRM Pipeline', icon: Target, tab: 'crm', roles: ['commercial', 'manager'] },
  { name: 'Nouveau Devis', icon: FilePlus, tab: 'catalog', roles: ['commercial', 'manager'] },
  { name: 'Mes Devis', icon: Files, tab: 'my_orders', roles: ['commercial', 'manager'] },
  { name: 'Approbations', icon: CheckSquare, tab: 'manager', roles: ['manager'] },
  { name: 'Livraisons', icon: Truck, tab: 'deliveries', roles: ['manager', 'logistics'] },
  { name: 'Achats & Réceptions', icon: ShoppingCart, tab: 'purchases', roles: ['manager', 'logistics'] },
  { name: 'Facturation', icon: FileText, tab: 'invoices', roles: ['manager', 'accountant'] },
];

export default function Sidebar({ activeTab, setActiveTab, fetchData, user }) {
  const userRole = user?.role || (user?.is_manager ? 'manager' : 'commercial');
  
  const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

  const handleClick = (item) => {
    setActiveTab(item.tab);
    if (fetchData && typeof fetchData[item.tab] === 'function') {
      fetchData[item.tab]();
    }
  };

  return (
    <aside className="hidden lg:block w-64 bg-white border-r border-slate-200 h-screen overflow-y-auto custom-scrollbar">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="h-9 w-9 bg-indigo-600 rounded-xl shadow-inner flex items-center justify-center text-white font-bold text-xl ring-2 ring-indigo-600/20">O</div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">Optika ERP</span>
        </div>
        
        <div className="mb-6 px-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Menu Principal</div>
          <nav className="space-y-1">
            {visibleItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => handleClick(item)}
                  className={`flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} transition-colors`} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
