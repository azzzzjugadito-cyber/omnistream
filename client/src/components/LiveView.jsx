import React, { useEffect, useState } from 'react';
import { 
  Trophy, Search, Heart, Play, RefreshCw, AlertCircle, Filter 
} from 'lucide-react';
import { api } from '../services/api';

const SPORTS = ['Todos', 'Fútbol', 'Baloncesto', 'Motor', 'Deportes de contacto', 'Tenis', 'Golf'];
const COUNTRIES = ['Todos', 'España', 'Reino Unido', 'Estados Unidos', 'Internacional'];

export function LiveView({ onSelectChannel, favorites, onToggleFavorite }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSport, setSelectedSport] = useState('Todos');
  const [selectedCountry, setSelectedCountry] = useState('Todos');
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    loadChannels();
  }, [selectedSport, selectedCountry]);

  async function loadChannels() {
    setLoading(true);
    setError(null);
    try {
      const params = {
        onlySports: true
      };
      if (selectedSport !== 'Todos') params.sport = selectedSport;
      if (selectedCountry !== 'Todos') params.country = selectedCountry;

      const res = await api.getLiveChannels(params);
      setChannels(res.channels || []);
    } catch (err) {
      setError('Error al conectar con los adaptadores de televisión en directo.');
    } finally {
      setLoading(false);
    }
  }

  const filteredChannels = channels.filter(ch => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return ch.title.toLowerCase().includes(q) || (ch.category && ch.category.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <Trophy size={24} color="#0ea5e9" /> Deportes en Directo
          </h1>
          <p className="section-subtitle">
            Fútbol, UFC, NBA, F1, MotoGP y retransmisiones oficiales en abierto
          </p>
        </div>

        {/* Buscador de canales dentro de deportes */}
        <div className="nav-search-box" style={{ width: 220 }}>
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            className="nav-search-input"
            placeholder="Filtrar canales..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filtros por Deporte */}
      <div className="filter-bar">
        {SPORTS.map((sport) => (
          <button
            key={sport}
            className={`filter-pill ${selectedSport === sport ? 'active' : ''}`}
            onClick={() => setSelectedSport(sport)}
          >
            {sport}
          </button>
        ))}
      </div>

      {/* Filtros por País */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, fontSize: '0.85rem', color: '#94a3b8' }}>
        <Filter size={15} />
        <span>País:</span>
        {COUNTRIES.map((ctry) => (
          <button
            key={ctry}
            onClick={() => setSelectedCountry(ctry)}
            style={{
              background: selectedCountry === ctry ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
              border: 'none',
              color: selectedCountry === ctry ? '#38bdf8' : '#94a3b8',
              fontWeight: selectedCountry === ctry ? 700 : 400,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4
            }}
          >
            {ctry}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
          <div style={{ marginTop: 12, color: '#94a3b8' }}>Sincronizando canales deportivos...</div>
        </div>
      )}

      {error && (
        <div className="error-state-card">
          <AlertCircle size={44} color="#ef4444" />
          <h3>Error al Cargar Canales</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadChannels}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      )}

      {!loading && !error && filteredChannels.length === 0 && (
        <div className="error-state-card">
          <h3>No se encontraron canales</h3>
          <p>No hay canales coincidentes con el filtro de deporte "{selectedSport}" o país "{selectedCountry}".</p>
          <button className="btn-secondary" onClick={() => { setSelectedSport('Todos'); setSelectedCountry('Todos'); setFilterQuery(''); }}>
            Restablecer Filtros
          </button>
        </div>
      )}

      {!loading && !error && filteredChannels.length > 0 && (
        <div className="grid-container">
          {filteredChannels.map((ch) => {
            const isFav = favorites.some(f => (f.item_id || f.id) === ch.id);

            return (
              <div key={ch.id} className="channel-card" onClick={() => onSelectChannel(ch)}>
                <div className="channel-thumb-wrapper">
                  <img src={ch.logo} alt={ch.title} className="channel-logo" loading="lazy" />
                  <div className="live-badge">
                    <span className="live-dot" /> EN DIRECTO
                  </div>
                  <div className="card-play-overlay">
                    <div className="play-circle"><Play size={22} fill="white" /></div>
                  </div>
                </div>

                <div className="channel-info">
                  <div className="channel-title">{ch.title}</div>
                  <div className="channel-meta">
                    <span>{ch.sport || ch.category} • {ch.country}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(ch);
                      }}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : '#64748b' }}
                      title="Guardar en Favoritos"
                    >
                      <Heart size={16} fill={isFav ? '#ef4444' : 'none'} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
