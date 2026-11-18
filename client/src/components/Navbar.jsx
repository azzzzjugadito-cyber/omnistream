import React from 'react';
import { 
  Home, Trophy, Film, Heart, Activity, Settings, Search, Tv 
} from 'lucide-react';

export function Navbar({ activeTab, onTabChange, searchQuery, onSearchChange, onSearchSubmit, healthAlert }) {
  return (
    <>
      <header className="navbar">
        <div className="nav-brand" onClick={() => onTabChange('home')}>
          <div className="brand-logo">
            <Tv size={22} color="#ffffff" />
          </div>
          <span className="brand-text">OmniStream</span>
          <span className="brand-tag">OTT TFG</span>
        </div>

        {/* Enlaces de escritorio */}
        <nav className="nav-links">
          <button 
            className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => onTabChange('home')}
          >
            <Home size={18} /> Inicio
          </button>

          <button 
            className={`nav-btn ${activeTab === 'sports' ? 'active' : ''}`}
            onClick={() => onTabChange('sports')}
          >
            <Trophy size={18} /> Deportes
          </button>

          <button 
            className={`nav-btn ${activeTab === 'vod' ? 'active' : ''}`}
            onClick={() => onTabChange('vod')}
          >
            <Film size={18} /> Cine y Series
          </button>

          <button 
            className={`nav-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => onTabChange('favorites')}
          >
            <Heart size={18} /> Favoritos
          </button>

          <button 
            className={`nav-btn ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => onTabChange('health')}
          >
            <Activity size={18} />
            Estado
            {healthAlert && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </button>

          <button 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onTabChange('settings')}
          >
            <Settings size={18} /> Ajustes
          </button>
        </nav>

        {/* Buscador unificado en cabecera */}
        <form onSubmit={onSearchSubmit} className="nav-search-box">
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            className="nav-search-input"
            placeholder="Buscar canal, partido, película..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </form>
      </header>

      {/* Barra de pestañas inferior para iPhone / PWA */}
      <nav className="mobile-tabbar">
        <button 
          className={`mobile-tab-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onTabChange('home')}
        >
          <Home size={20} />
          <span>Inicio</span>
        </button>

        <button 
          className={`mobile-tab-item ${activeTab === 'sports' ? 'active' : ''}`}
          onClick={() => onTabChange('sports')}
        >
          <Trophy size={20} />
          <span>Deportes</span>
        </button>

        <button 
          className={`mobile-tab-item ${activeTab === 'vod' ? 'active' : ''}`}
          onClick={() => onTabChange('vod')}
        >
          <Film size={20} />
          <span>Catálogo</span>
        </button>

        <button 
          className={`mobile-tab-item ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => onTabChange('favorites')}
        >
          <Heart size={20} />
          <span>Favoritos</span>
        </button>

        <button 
          className={`mobile-tab-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          <Settings size={20} />
          <span>Ajustes</span>
        </button>
      </nav>
    </>
  );
}
