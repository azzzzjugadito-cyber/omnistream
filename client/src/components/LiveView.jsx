import React, { useEffect, useState, useMemo } from 'react';
import { 
  Trophy, Search, Heart, Play, RefreshCw, AlertCircle, Filter, ShieldCheck, Layers
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
  const [selectedCompetition, setSelectedCompetition] = useState('Todas');
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    loadChannels();
  }, [selectedSport, selectedCountry]);

  // Restablecer subfiltro de competición al cambiar de deporte
  useEffect(() => {
    setSelectedCompetition('Todas');
  }, [selectedSport]);

  async function loadChannels() {
    setLoading(true);
    setError(null);
    try {
      const params = {
        onlySports: true
      };
      if (selectedSport === 'Fútbol') {
        params.isFootball = true;
      } else if (selectedSport !== 'Todos') {
        params.sport = selectedSport;
      }
      if (selectedCountry !== 'Todos') {
        params.country = selectedCountry;
      }

      const res = await api.getLiveChannels(params);
      setChannels(res.channels || []);
    } catch (err) {
      setError('Error al conectar con los adaptadores de televisión en directo.');
    } finally {
      setLoading(false);
    }
  }

  // Lista de competiciones disponibles en los canales cargados
  const availableCompetitions = useMemo(() => {
    if (selectedSport !== 'Fútbol') return [];
    const comps = new Set();
    channels.forEach(ch => {
      if (Array.isArray(ch.competitions)) {
        ch.competitions.forEach(c => comps.add(c));
      }
    });
    return ['Todas', ...Array.from(comps).sort()];
  }, [channels, selectedSport]);

  const filteredChannels = useMemo(() => {
    let list = [...channels];

    // Subfiltro por competición
    if (selectedSport === 'Fútbol' && selectedCompetition !== 'Todas') {
      list = list.filter(ch => 
        Array.isArray(ch.competitions) && ch.competitions.includes(selectedCompetition)
      );
    }

    // Filtro por texto en el buscador
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase().trim();
      list = list.filter(ch => 
        (ch.title && ch.title.toLowerCase().includes(q)) ||
        (ch.category && ch.category.toLowerCase().includes(q)) ||
        (Array.isArray(ch.competitions) && ch.competitions.some(c => c.toLowerCase().includes(q)))
      );
    }

    // Ordenar canales de fútbol por Tier (Tier 1 canales dedicados primero, luego Tier 2 generalistas)
    if (selectedSport === 'Fútbol') {
      list.sort((a, b) => {
        const tierA = a.footballTier || 99;
        const tierB = b.footballTier || 99;
        if (tierA !== tierB) return tierA - tierB;
        return (a.effectivePriority || 10) - (b.effectivePriority || 10);
      });
    }

    return list;
  }, [channels, selectedSport, selectedCompetition, filterQuery]);

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

      {/* Subfiltros por Competición de Fútbol cuando la píldora Fútbol está activa */}
      {selectedSport === 'Fútbol' && availableCompetitions.length > 1 && (
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 14,
          padding: '8px 12px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 8,
          border: '1px solid rgba(14, 165, 233, 0.2)'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', marginRight: 4 }}>
            Competición:
          </span>
          {availableCompetitions.map((comp) => (
            <button
              key={comp}
              onClick={() => setSelectedCompetition(comp)}
              style={{
                background: selectedCompetition === comp ? '#0284c7' : 'rgba(30, 41, 59, 0.8)',
                color: selectedCompetition === comp ? '#ffffff' : '#cbd5e1',
                border: 'none',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: selectedCompetition === comp ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {comp}
            </button>
          ))}
        </div>
      )}

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
          <div style={{ marginTop: 12, color: '#94a3b8' }}>Sincronizando canales deportivos y clasificando fútbol...</div>
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
          <p>No hay canales coincidentes con el filtro de deporte "{selectedSport}", competición "{selectedCompetition}" o país "{selectedCountry}".</p>
          <button className="btn-secondary" onClick={() => { setSelectedSport('Todos'); setSelectedCountry('Todos'); setSelectedCompetition('Todas'); setFilterQuery(''); }}>
            Restablecer Filtros
          </button>
        </div>
      )}

      {!loading && !error && filteredChannels.length > 0 && (
        <div className="grid-container">
          {filteredChannels.map((ch) => {
            const isFav = favorites.some(f => (f.item_id || f.id) === ch.id);
            const hasBackups = Array.isArray(ch.backupUrls) && ch.backupUrls.length > 0;

            return (
              <div key={ch.id} className="channel-card" onClick={() => onSelectChannel(ch)}>
                <div className="channel-thumb-wrapper">
                  <img src={ch.logo} alt={ch.title} className="channel-logo" loading="lazy" />
                  
                  {/* Badges superiores */}
                  <div className="live-badge">
                    <span className="live-dot" /> EN DIRECTO
                  </div>

                  {ch.isFootball && ch.footballTier && (
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      background: ch.footballTier === 1 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(234, 179, 8, 0.9)',
                      color: ch.footballTier === 1 ? '#ffffff' : '#0f172a',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      textTransform: 'uppercase'
                    }}>
                      <ShieldCheck size={11} /> {ch.footballTier === 1 ? 'Tier 1 Fútbol' : 'Tier 2 Generalista'}
                    </div>
                  )}

                  {hasBackups && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#38bdf8',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      padding: '2px 5px',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      border: '1px solid rgba(56, 189, 248, 0.3)'
                    }} title={`${ch.backupUrls.length} enlaces de respaldo consolidados`}>
                      <Layers size={11} /> +{ch.backupUrls.length}
                    </div>
                  )}

                  <div className="card-play-overlay">
                    <div className="play-circle"><Play size={22} fill="white" /></div>
                  </div>
                </div>

                <div className="channel-info">
                  <div className="channel-title">{ch.title}</div>
                  
                  {/* Competiciones asociadas */}
                  {Array.isArray(ch.competitions) && ch.competitions.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      ⚽ {ch.competitions.join(' • ')}
                    </div>
                  )}

                  <div className="channel-meta">
                    <span>{ch.country}</span>
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
