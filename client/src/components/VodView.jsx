import React, { useEffect, useState } from 'react';
import { 
  Film, Tv, Star, Heart, Play, RefreshCw, AlertCircle, Search, Flame 
} from 'lucide-react';
import { api } from '../services/api';

const CONTENT_TYPES = [
  { id: '', label: '🎬 Todo el Catálogo' },
  { id: 'netflix', label: '🔴 Top Series Netflix' },
  { id: 'series', label: '📺 Todas las Series' },
  { id: 'movie', label: '🍿 Películas' }
];

const GENRES = [
  'Todos', 'Acción', 'Drama', 'Comedia', 'Ciencia Ficción', 
  'Misterio', 'Crimen', 'Animación', 'Aventura', 'Fantasía', 'Terror'
];

export function VodView({ onSelectItem, favorites, onToggleFavorite }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedType, setSelectedType] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Todos');
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    loadCatalog();
  }, [selectedType, selectedGenre]);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedType) params.type = selectedType;
      if (selectedGenre !== 'Todos') params.genre = selectedGenre;

      const res = await api.getVodCatalog(params);
      setItems(res.items || []);
    } catch (err) {
      setError('Error al consultar el catálogo de películas y series.');
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = items.filter(it => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      it.title.toLowerCase().includes(q) || 
      (it.synopsis && it.synopsis.toLowerCase().includes(q)) ||
      (it.genres && it.genres.some(g => g.toLowerCase().includes(q)))
    );
  });

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <Film size={24} color="#0ea5e9" /> Cine y Series Bajo Demanda
          </h1>
          <p className="section-subtitle">
            Catálogo completo con las mejores series de Netflix, estrenos de cine y series mundiales
          </p>
        </div>

        <div className="nav-search-box" style={{ width: 240 }}>
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            className="nav-search-input"
            placeholder="Buscar película o serie..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Pestañas de Tipo de Contenido (Todo / Netflix / Series / Películas) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {CONTENT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            style={{
              background: selectedType === t.id 
                ? (t.id === 'netflix' ? '#e50914' : '#0ea5e9') 
                : '#131b2c',
              color: selectedType === t.id ? '#ffffff' : '#94a3b8',
              border: selectedType === t.id 
                ? (t.id === 'netflix' ? '1px solid #e50914' : '1px solid #0ea5e9')
                : '1px solid rgba(255,255,255,0.08)',
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: selectedType === t.id ? '0 4px 14px rgba(0,0,0,0.4)' : 'none'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros por Género */}
      <div className="filter-bar">
        {GENRES.map((g) => (
          <button
            key={g}
            className={`filter-pill ${selectedGenre === g ? 'active' : ''}`}
            onClick={() => setSelectedGenre(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
          <div style={{ marginTop: 12, color: '#94a3b8' }}>Cargando títulos del catálogo ampliado...</div>
        </div>
      )}

      {error && (
        <div className="error-state-card">
          <AlertCircle size={44} color="#ef4444" />
          <h3>Error en Catálogo</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={loadCatalog}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      )}

      {!loading && !error && filteredItems.length === 0 && (
        <div className="error-state-card">
          <h3>Sin resultados</h3>
          <p>No se encontraron títulos con los filtros seleccionados.</p>
          <button className="btn-secondary" onClick={() => { setSelectedType(''); setSelectedGenre('Todos'); setFilterQuery(''); }}>
            Restablecer Filtros
          </button>
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 16 }}>
            Mostrando <strong>{filteredItems.length}</strong> títulos disponibles
          </div>

          <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))' }}>
            {filteredItems.map((item) => {
              const isFav = favorites.some(f => (f.item_id || f.id) === item.id);

              return (
                <div key={item.id} className="vod-card" onClick={() => onSelectItem(item)}>
                  <div className="vod-poster-wrapper">
                    <img src={item.poster} alt={item.title} className="vod-poster" loading="lazy" />
                    
                    {/* Badge de Plataforma o Tipo */}
                    {item.isNetflix ? (
                      <div 
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: '#e50914',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          padding: '2px 6px',
                          borderRadius: 3,
                          letterSpacing: 0.5
                        }}
                      >
                        NETFLIX
                      </div>
                    ) : item.contentType === 'series' ? (
                      <div 
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: 'rgba(14, 165, 233, 0.85)',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 3
                        }}
                      >
                        SERIE
                      </div>
                    ) : null}

                    <div className="vod-rating-badge">
                      <Star size={12} fill="#fbbf24" /> {item.rating || '7.5'}
                    </div>

                    <div className="card-play-overlay">
                      <div className="play-circle"><Play size={22} fill="white" /></div>
                    </div>
                  </div>

                  <div className="vod-info">
                    <div className="vod-title">{item.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span className="vod-year">
                        {item.year || (item.contentType === 'series' ? 'Serie' : 'Película')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(item);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isFav ? '#ef4444' : '#64748b' }}
                        title="Guardar en Favoritos"
                      >
                        <Heart size={15} fill={isFav ? '#ef4444' : 'none'} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
