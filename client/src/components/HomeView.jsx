import React, { useEffect, useState } from 'react';
import { 
  Trophy, Clock, Play, Flame, Heart, AlertCircle, RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';

export function HomeView({ onSelectChannel, onSelectVod, onSelectEvent, favorites, onToggleFavorite }) {
  const [events, setEvents] = useState([]);
  const [featuredChannels, setFeaturedChannels] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadHomeData();
  }, []);

  async function loadHomeData() {
    setLoading(true);
    setError(null);
    try {
      const [evRes, chRes, histRes] = await Promise.all([
        api.getSportsEvents({ today: 'true' }).catch(() => ({ events: [] })),
        api.getLiveChannels({ onlySports: true, limit: 12 }).catch(() => ({ channels: [] })),
        api.getHistory().catch(() => ({ history: [] }))
      ]);

      setEvents(evRes.events || []);
      setFeaturedChannels(chRes.channels || []);
      setContinueWatching(histRes.history || []);
    } catch (err) {
      setError('No se pudieron cargar los datos de portada. Comprueba la conexión.');
    } finally {
      setLoading(false);
    }
  }

  function formatEventTime(timestamp) {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function formatProgressTime(seconds) {
    if (!seconds) return '0 min';
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  }

  // Agrupar eventos por competición
  const eventsByCompetition = events.reduce((acc, ev) => {
    const comp = ev.competition || 'Competición';
    if (!acc[comp]) acc[comp] = [];
    acc[comp].push(ev);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <RefreshCw size={40} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
        <div style={{ marginTop: 16, color: '#94a3b8' }}>Cargando agenda de partidos y canales...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state-card">
        <AlertCircle size={44} color="#ef4444" />
        <h3>Error al Cargar Portada</h3>
        <p>{error}</p>
        <button className="btn-primary" onClick={loadHomeData}>
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
      {/* 1. Carrusel "Continuar Viendo" si hay historial */}
      {continueWatching.length > 0 && (
        <section>
          <div className="section-header">
            <div>
              <h2 className="section-title">
                <Clock size={20} color="#0ea5e9" /> Continuar Viendo
              </h2>
              <p className="section-subtitle">Reanuda tus reproducciones en el minuto exacto</p>
            </div>
          </div>

          <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {continueWatching.slice(0, 4).map((hist) => {
              const progressPct = hist.duration_seconds > 0 
                ? Math.min(100, Math.round((hist.position_seconds / hist.duration_seconds) * 100))
                : 0;

              return (
                <div 
                  key={hist.id} 
                  className="channel-card" 
                  onClick={() => onSelectChannel({
                    id: hist.item_id,
                    title: hist.title,
                    streamUrl: hist.stream_url,
                    proxiedUrl: `/api/proxy/stream?url=${encodeURIComponent(hist.stream_url)}`,
                    positionSeconds: hist.position_seconds,
                    category: 'Continuar Viendo'
                  })}
                >
                  <div className="channel-thumb-wrapper">
                    {hist.poster ? (
                      <img src={hist.poster} alt={hist.title} className="channel-logo" style={{ maxHeight: '90%', maxWidth: '90%' }} />
                    ) : (
                      <Play size={36} color="#0ea5e9" />
                    )}
                    <div className="card-play-overlay">
                      <div className="play-circle"><Play size={22} fill="white" /></div>
                    </div>
                  </div>
                  <div className="channel-info">
                    <div className="channel-title">{hist.title}</div>
                    <div className="channel-meta">
                      <span>Progreso: {progressPct > 0 ? `${progressPct}%` : formatProgressTime(hist.position_seconds)}</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${Math.max(5, progressPct)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. Agenda de Partidos y Eventos de Hoy agrupados por competición */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Flame size={22} color="#ef4444" /> Partidos y Eventos de Hoy
            </h2>
            <p className="section-subtitle">
              Fútbol (LaLiga, Premier, Champions), NBA, UFC, F1 y MotoGP con hora local
            </p>
          </div>
        </div>

        {Object.keys(eventsByCompetition).length === 0 ? (
          <div style={{ background: '#0f141f', padding: 24, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
            No hay eventos en vivo registrados para este momento. Consulta los canales deportivos en directo más abajo.
          </div>
        ) : (
          Object.entries(eventsByCompetition).map(([compName, evList]) => (
            <div key={compName} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Trophy size={18} /> {compName}
              </div>

              <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {evList.map((ev) => (
                  <div key={ev.id} className="event-card" onClick={() => onSelectEvent(ev)}>
                    <div className="event-header">
                      <span className="event-competition">{ev.sport}</span>
                      <span className="event-time">
                        <Clock size={14} /> {formatEventTime(ev.timestamp)}
                      </span>
                    </div>

                    <div className="event-teams">{ev.title}</div>

                    <div className="event-footer">
                      <span className={`health-badge ${ev.status === 'EN DIRECTO' ? 'offline' : 'online'}`}>
                        <span className={`health-dot ${ev.status === 'EN DIRECTO' ? 'offline' : 'online'}`} />
                        {ev.status}
                      </span>
                      <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        <Play size={14} /> Sintonizar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 3. Canales Deportivos Destacados */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Trophy size={20} color="#0ea5e9" /> Canales Deportivos Destacados
            </h2>
            <p className="section-subtitle">Emisiones en abierto y retransmisiones HLS verificadas</p>
          </div>
        </div>

        <div className="grid-container">
          {featuredChannels.map((ch) => {
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
      </section>
    </div>
  );
}
