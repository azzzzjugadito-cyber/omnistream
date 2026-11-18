import React, { useEffect, useState, useMemo } from 'react';
import { 
  Trophy, Clock, Play, Flame, Heart, AlertCircle, RefreshCw, 
  Radio, Globe, Tv, Layers, Calendar, Star, ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

const COUNTRIES_LIST = [
  'Todos', 'España', 'Reino Unido', 'Italia', 'Alemania', 'Francia', 
  'Portugal', 'Países Bajos', 'Arabia Saudí', 'Argentina', 'Brasil', 
  'México', 'Estados Unidos', 'Turquía', 'Grecia', 'Rusia', 'Polonia', 
  'Sudáfrica', 'Egipto', 'Marruecos', 'India', 'Australia', 'Europa'
];

export function HomeView({ onSelectChannel, onSelectVod, onSelectEvent, favorites, onToggleFavorite }) {
  const [events, setEvents] = useState([]);
  const [featuredChannels, setFeaturedChannels] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados del Explorador País -> Competición -> Partido
  const [explorerCountry, setExplorerCountry] = useState('Todos');
  const [explorerComp, setExplorerComp] = useState('Todas');
  const [userLang, setUserLang] = useState(() => localStorage.getItem('omnistream_commentary_lang') || 'es');

  useEffect(() => {
    loadHomeData();
  }, [userLang]);

  async function loadHomeData() {
    setLoading(true);
    setError(null);
    try {
      const [evRes, chRes, histRes] = await Promise.all([
        api.getSportsEvents({ lang: userLang }).catch(() => ({ events: [] })),
        api.getLiveChannels({ onlySports: true, limit: 12 }).catch(() => ({ channels: [] })),
        api.getHistory().catch(() => ({ history: [] }))
      ]);

      setEvents(evRes.events || []);
      setFeaturedChannels(chRes.channels || []);
      setContinueWatching(histRes.history || []);
    } catch (err) {
      setError('No se pudieron cargar los datos de portada. Comprueba la conexión con el backend.');
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

  function formatDayLabel(timestamp) {
    if (!timestamp) return 'Próximamente';
    const d = new Date(timestamp);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Hoy';
    const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  // Comprobar si un equipo es favorito del usuario
  function isTeamFavorite(teamName) {
    if (!teamName) return false;
    const norm = teamName.toLowerCase().trim();
    return favorites.some(f => (f.title && f.title.toLowerCase().trim() === norm) || (f.item_id === `team::${norm}`));
  }

  function handleToggleTeamFavorite(teamName) {
    if (!teamName) return;
    const norm = teamName.toLowerCase().trim();
    onToggleFavorite({
      id: `team::${norm}`,
      item_id: `team::${norm}`,
      title: teamName,
      type: 'team',
      category: 'Equipo Favorito'
    });
  }

  // Reproducir un canal de emisión de un fixture
  function handlePlayBroadcast(ev, broadcast) {
    onSelectChannel({
      id: broadcast.id,
      title: `${ev.title} (${broadcast.channelName})`,
      streamUrl: broadcast.streamUrl,
      proxiedUrl: `/api/proxy/stream?url=${encodeURIComponent(broadcast.streamUrl)}`,
      backupUrls: broadcast.backupUrls || [],
      headers: broadcast.headers || {},
      category: ev.competition,
      isFootball: true
    });
  }

  // 1. Partidos en DIRECTO AHORA (status === 'live')
  const liveNowFixtures = useMemo(() => {
    return events.filter(e => e.status === 'live');
  }, [events]);

  // 2. Próximos partidos (scheduled) agrupados por día
  const upcomingByDay = useMemo(() => {
    const scheduled = events.filter(e => e.status !== 'live');
    const groups = {};
    for (const ev of scheduled) {
      const day = formatDayLabel(ev.timestamp);
      if (!groups[day]) groups[day] = [];
      groups[day].push(ev);
    }
    return groups;
  }, [events]);

  // 3. Explorador País -> Competición -> Partido
  const availableExplorerComps = useMemo(() => {
    if (explorerCountry === 'Todos') return ['Todas'];
    const comps = new Set();
    events.filter(e => e.country === explorerCountry).forEach(e => {
      if (e.competition) comps.add(e.competition);
    });
    return ['Todas', ...Array.from(comps)];
  }, [events, explorerCountry]);

  // Partidos filtrados para el explorador
  const explorerFixtures = useMemo(() => {
    let list = [...events];
    if (explorerCountry !== 'Todos') {
      list = list.filter(e => e.country === explorerCountry);
    }
    if (explorerComp !== 'Todas') {
      list = list.filter(e => e.competition === explorerComp);
    }

    // Los favoritos de equipo suben sus partidos al principio del explorador
    list.sort((a, b) => {
      const aFav = isTeamFavorite(a.homeTeam) || isTeamFavorite(a.awayTeam);
      const bFav = isTeamFavorite(b.homeTeam) || isTeamFavorite(b.awayTeam);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    return list;
  }, [events, explorerCountry, explorerComp, favorites]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <RefreshCw size={40} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
        <div style={{ marginTop: 16, color: '#94a3b8' }}>Sincronizando partidos, parrilla EPG y enlaces de emisión...</div>
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

      {/* 1. BLOQUE SUPERIOR: EN DIRECTO AHORA (status === 'live') */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title" style={{ color: '#ef4444' }}>
              <Radio size={22} className="animate-pulse" /> En Directo Ahora
            </h2>
            <p className="section-subtitle">
              Partidos con emisión activa confirmada por guía de programación (EPG)
            </p>
          </div>
        </div>

        {liveNowFixtures.length === 0 ? (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: 20,
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#94a3b8',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <Calendar size={20} color="#38bdf8" />
            <span>No hay partidos en directo con emisión confirmada en este minuto. Consulta los <strong>Próximos Partidos</strong> y el <strong>Explorador Multipaís</strong> más abajo.</span>
          </div>
        ) : (
          <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {liveNowFixtures.map(ev => renderFixtureCard(ev))}
          </div>
        )}
      </section>

      {/* 2. PRÓXIMOS PARTIDOS CON HORA LOCAL Y AGRUPADO POR DÍA */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Clock size={22} color="#0ea5e9" /> Próximos Partidos
            </h2>
            <p className="section-subtitle">
              Calendario oficial agrupado por fecha con hora local y canales asignados
            </p>
          </div>
        </div>

        {Object.keys(upcomingByDay).length === 0 ? (
          <div style={{ color: '#94a3b8' }}>No hay próximos eventos programados.</div>
        ) : (
          Object.entries(upcomingByDay).map(([dayLabel, dayEvents]) => (
            <div key={dayLabel} style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#38bdf8',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                paddingBottom: 6
              }}>
                <Calendar size={17} /> {dayLabel}
              </div>

              <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {dayEvents.map(ev => renderFixtureCard(ev))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 3. EXPLORADOR PAÍS -> COMPETICIÓN -> PARTIDO (TODOS LOS PAÍSES) */}
      <section style={{
        background: 'rgba(15, 23, 42, 0.7)',
        padding: 24,
        borderRadius: 16,
        border: '1px solid rgba(14, 165, 233, 0.25)'
      }}>
        <div className="section-header" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="section-title">
              <Globe size={22} color="#38bdf8" /> Explorador de Fútbol Mundial
            </h2>
            <p className="section-subtitle">
              Navega por más de 20 países y sus competiciones oficiales. Tus equipos favoritos suben arriba.
            </p>
          </div>
        </div>

        {/* Selector de País */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>PAÍS / REGIÓN:</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
            {COUNTRIES_LIST.map(c => (
              <button
                key={c}
                onClick={() => {
                  setExplorerCountry(c);
                  setExplorerComp('Todas');
                }}
                className={`filter-pill ${explorerCountry === c ? 'active' : ''}`}
                style={{ fontSize: '0.8rem', padding: '5px 12px', whiteSpace: 'nowrap' }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Competición si el país tiene varias */}
        {availableExplorerComps.length > 1 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>COMPETICIÓN:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {availableExplorerComps.map(comp => (
                <button
                  key={comp}
                  onClick={() => setExplorerComp(comp)}
                  style={{
                    background: explorerComp === comp ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                    color: explorerComp === comp ? '#ffffff' : '#cbd5e1',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: explorerComp === comp ? 600 : 400,
                    cursor: 'pointer'
                  }}
                >
                  {comp}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Listado de partidos filtrados en el explorador */}
        <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {explorerFixtures.length === 0 ? (
            <div style={{ color: '#94a3b8', padding: 20 }}>No se encontraron partidos para la selección actual.</div>
          ) : (
            explorerFixtures.map(ev => renderFixtureCard(ev))
          )}
        </div>
      </section>

      {/* 4. CANALES DEPORTIVOS DESTACADOS */}
      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title">
              <Trophy size={20} color="#0ea5e9" /> Canales Deportivos Destacados
            </h2>
            <p className="section-subtitle">Emisiones en abierto y retransmisiones oficiales</p>
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

  // Renderizador de Tarjeta de Partido / Fixture
  function renderFixtureCard(ev) {
    const isLive = ev.status === 'live';
    const hasBroadcast = ev.hasBroadcast && Array.isArray(ev.broadcasts) && ev.broadcasts.length > 0;
    const isHomeFav = isTeamFavorite(ev.homeTeam);
    const isAwayFav = isTeamFavorite(ev.awayTeam);
    const isAnyFav = isHomeFav || isAwayFav;

    return (
      <div 
        key={ev.id} 
        className="event-card"
        style={{
          opacity: hasBroadcast ? 1 : 0.6,
          border: isLive ? '1px solid #ef4444' : (isAnyFav ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)'),
          background: isLive ? 'rgba(239, 68, 68, 0.05)' : '#0f141f',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease'
        }}
      >
        <div>
          {/* Cabecera del partido: Competición, Hora local, Bandera de directo */}
          <div className="event-header">
            <span className="event-competition" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trophy size={13} color="#38bdf8" /> {ev.competition}
            </span>
            <span className="event-time" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={13} /> {formatEventTime(ev.timestamp)}
            </span>
          </div>

          {/* Título de equipos con botón de favoritos para subir al principio */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0 6px 0' }}>
            <div className="event-teams" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.3 }}>
              <span 
                style={{ color: isHomeFav ? '#38bdf8' : 'inherit', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); handleToggleTeamFavorite(ev.homeTeam); }}
                title="Marcar equipo como favorito"
              >
                {ev.homeTeam} {isHomeFav && '★'}
              </span>
              <span style={{ color: '#64748b', margin: '0 6px', fontWeight: 400 }}>vs</span>
              <span 
                style={{ color: isAwayFav ? '#38bdf8' : 'inherit', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); handleToggleTeamFavorite(ev.awayTeam); }}
                title="Marcar equipo como favorito"
              >
                {ev.awayTeam} {isAwayFav && '★'}
              </span>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); handleToggleTeamFavorite(ev.homeTeam || ev.awayTeam); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isAnyFav ? '#38bdf8' : '#475569' }}
              title="Guardar equipo en favoritos"
            >
              <Star size={17} fill={isAnyFav ? '#38bdf8' : 'none'} />
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: 12 }}>
            País: {ev.country}
          </div>
        </div>

        {/* Sección de Canales de Emisión (Broadcasts) */}
        <div>
          {hasBroadcast ? (
            <div>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tv size={12} /> CANALES DISPONIBLES ({ev.broadcasts.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ev.broadcasts.map(b => (
                  <button
                    key={b.id}
                    onClick={(e) => { e.stopPropagation(); handlePlayBroadcast(ev, b); }}
                    style={{
                      background: b.isPreferredLang ? 'rgba(14, 165, 233, 0.18)' : 'rgba(30, 41, 59, 0.8)',
                      border: b.isPreferredLang ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      textAlign: 'left',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Play size={13} fill="#0ea5e9" color="#0ea5e9" />
                      <strong style={{ color: '#f1f5f9' }}>{b.channelName}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 4px',
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.1)',
                        textTransform: 'uppercase'
                      }}>
                        {b.language}
                      </span>
                      {b.footballTier === 1 && (
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'rgba(16, 185, 129, 0.25)',
                          color: '#34d399'
                        }}>
                          T1
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 6,
              padding: '8px 10px',
              fontSize: '0.75rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Sin emisión disponible</span>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>Consulte guía EPG</span>
            </div>
          )}

          {/* Pie de tarjeta con estado */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={`health-badge ${isLive ? 'offline' : 'online'}`} style={{ fontSize: '0.7rem' }}>
              <span className={`health-dot ${isLive ? 'offline' : 'online'}`} />
              {isLive ? 'EN DIRECTO (EPG CONFIRMADO)' : 'PROGRAMADO'}
            </span>
          </div>
        </div>
      </div>
    );
  }
}
