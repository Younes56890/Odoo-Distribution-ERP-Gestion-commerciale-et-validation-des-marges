import React from 'react';

export default function Header({ user, toggleTheme, isDark, logout }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          <div className="flex items-center gap-2 pr-4">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight hidden sm:block">Optika</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="Toggle theme"
          >
            {isDark ? '🌙' : '☀️'}
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
              {user?.name?.charAt(0) || ''}
            </div>
            <button
              onClick={logout}
              className="text-sm text-slate-500 hover:text-red-600 font-medium transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
