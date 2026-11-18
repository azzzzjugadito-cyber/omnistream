import React, { useEffect, useState } from 'react';
import { 
  Search, Tv, Trophy, Film, Play, Star, Heart, RefreshCw, AlertCircle 
} from 'lucide-react';
import { api } from '../services/api';

export function SearchView({ query, onSelectChannel, onSelectVod, onSelectEvent, favorites, onToggleFavorite }) {
  const [results, setResults] = useState({ live: [], events: [], vod: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query || !query.trim()) return;
    executeSearch(query.trim());
  }, [query]);

  async function executeSearch(q) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.globalSearch(q);
      setResults(res);
    } catch (err) {
      setError('Fallo al realizar la búsqueda unificada');
    } finally {
      setLoading(false);
    }
  }

  const totalResults = (results.live?.length || 0) + (results.events?.length || 0) + (results.vod?.length || 0);

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <Search size={24} color="#0ea5e9" /> Resultados de Búsqueda
          </h1>
          <p className="section-subtitle">
            Mostrando resultados para: <strong style={{ color: '#ffffff' }}>"{query}"</strong>
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
          <div style={{ marginTop: 12, color: '#94a3b8' }}>Consultando todas las fuentes simultáneamente...</div>
        </div>
      )}

      {error && (
        <div className="error-state-card">
          <AlertCircle size={44} color="#ef4444" />
          <h3>Error en la búsqueda</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && totalResults === 0 && (
        <div className="error-state-card">
          <Search size={44} color="#64748b" />
          <h3>Sin coincidencias</h3>
          <p>No se encontraron canales, partidos ni películas que coincidan con "{query}".</p>
        </div>
      )}

      {!loading && !error && totalResults > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {/* 1. Emisión en Directo (Canales) */}
          {results.live && results.live.length > 0 && (
            <section>
              <div className="section-header">
                <h3 className="section-title" style={{ fontSize: '1.15rem' }}>
                  <Tv size={18} color="#ef4444" /> Canales en Directo ({results.live.length})
                </h3>
              </div>
              <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {results.live.map((ch) => (
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Partidos y Eventos Deportivos */}
          {results.events && results.events.length > 0 && (
            <section>
              <div className="section-header">
                <h3 className="section-title" style={{ fontSize: '1.15rem' }}>
                  <Trophy size={18} color="#38bdf8" /> Partidos y Eventos ({results.events.length})
                </h3>
              </div>
              <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {results.events.map((ev) => (
                  <div key={ev.id} className="event-card" onClick={() => onSelectEvent(ev)}>
                    <div className="event-header">
                      <span className="event-competition">{ev.competition}</span>
                      <span className="health-badge online">{ev.status}</span>
                    </div>
                    <div className="event-teams">{ev.title}</div>
                    <div className="event-footer">
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ev.sport}</span>
                      <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        <Play size={13} /> Sintonizar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Cine y Series Bajo Demanda */}
          {results.vod && results.vod.length > 0 && (
            <section>
              <div className="section-header">
                <h3 className="section-title" style={{ fontSize: '1.15rem' }}>
                  <Film size={18} color="#fbbf24" /> Cine y Series Bajo Demanda ({results.vod.length})
                </h3>
              </div>
              <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {results.vod.map((item) => (
                  <div key={item.id} className="vod-card" onClick={() => onSelectVod(item)}>
                    <div className="vod-poster-wrapper">
                      <img src={item.poster} alt={item.title} className="vod-poster" loading="lazy" />
                      <div className="vod-rating-badge">
                        <Star size={12} fill="#fbbf24" /> {item.rating || '7.5'}
                      </div>
                      <div className="card-play-overlay">
                        <div className="play-circle"><Play size={22} fill="white" /></div>
                      </div>
                    </div>
                    <div className="vod-info">
                      <div className="vod-title">{item.title}</div>
                      <div className="vod-year">{item.year || 'Película'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
