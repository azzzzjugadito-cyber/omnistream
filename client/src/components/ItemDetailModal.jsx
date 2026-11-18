import React, { useEffect, useState } from 'react';
import { 
  X, Star, Play, Film, User, RefreshCw, AlertCircle, ExternalLink, Tv 
} from 'lucide-react';
import { api } from '../services/api';

export function ItemDetailModal({ item, onClose, onPlayStream }) {
  const [details, setDetails] = useState(item);
  const [streams, setStreams] = useState([]);
  const [audioFilter, setAudioFilter] = useState('all'); // 'all' | 'castellano'
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamError, setStreamError] = useState(null);

  // Control de temporadas y episodios para series
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  const isSeries = details.contentType === 'series' || item.contentType === 'series' || (details.videos && details.videos.length > 0);

  useEffect(() => {
    loadDeepDetails();
    loadStreamOptions(1, 1);
  }, [item]);

  async function loadDeepDetails() {
    try {
      const detectedType = item.contentType === 'series' ? 'series' : '';
      const res = await api.getVodDetails(item.id, detectedType);
      if (res) {
        setDetails(prev => ({ ...prev, ...res }));
      }
    } catch (err) {
      console.warn('No se pudieron cargar detalles adicionales:', err);
    }
  }

  async function loadStreamOptions(season = 1, episode = 1) {
    setLoadingStreams(true);
    setStreamError(null);
    try {
      const type = item.contentType === 'series' ? 'series' : 'movie';
      const res = await api.resolveVodStreams(item.id, item.title, season, episode, type);
      const fetchedStreams = res.streams || [];
      setStreams(fetchedStreams);
      if (fetchedStreams.some(s => s.isCastellano)) {
        setAudioFilter('castellano');
      }
    } catch (err) {
      setStreamError('Error al resolver enlaces de reproducción');
    } finally {
      setLoadingStreams(false);
    }
  }

  // Agrupar episodios por temporada
  const seasonsMap = new Map();
  if (isSeries && Array.isArray(details.videos) && details.videos.length > 0) {
    details.videos.forEach(v => {
      const s = v.season || 1;
      if (!seasonsMap.has(s)) seasonsMap.set(s, []);
      seasonsMap.get(s).push(v);
    });
  }
  const seasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
  const currentSeasonEpisodes = seasonsMap.get(selectedSeason) || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Banner de fondo */}
        <div style={{ position: 'relative', height: 260, background: '#0b0f19', overflow: 'hidden' }}>
          {details.banner && (
            <img 
              src={details.banner} 
              alt={details.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} 
            />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, #0f141f 10%, transparent 100%)' }} />
          
          <button 
            className="player-close-btn" 
            onClick={onClose} 
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Ficha técnica y sinopsis */}
        <div style={{ padding: '0 24px 24px 24px', marginTop: -60, position: 'relative', zIndex: 5 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <img 
              src={details.poster} 
              alt={details.title} 
              style={{ width: 130, borderRadius: 10, boxShadow: '0 10px 25px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }} 
            />

            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>{details.title}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 12 }}>
                {details.year && <span>{details.year}</span>}
                <span>•</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fbbf24', fontWeight: 700 }}>
                  <Star size={14} fill="#fbbf24" /> {details.rating || '7.5'}
                </span>
                <span>•</span>
                <span>{Array.isArray(details.genres) ? details.genres.join(', ') : 'Cine'}</span>
              </div>

              {details.director && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 4 }}>
                  <strong style={{ color: '#cbd5e1' }}>Dirección:</strong> {details.director}
                </div>
              )}

              {details.cast && details.cast.length > 0 && (
                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  <strong style={{ color: '#cbd5e1' }}>Reparto:</strong> {details.cast.slice(0, 4).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Sinopsis */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Sinopsis</h4>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6 }}>
              {details.synopsis}
            </p>
          </div>

          {/* Panel distinguible de Temporadas y Episodios (Sólo para Series) */}
          {isSeries && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <Tv size={18} color="#0ea5e9" /> Temporadas y Episodios
                </h4>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                  Temporada {selectedSeason} • Episodio {selectedEpisode}
                </span>
              </div>

              {/* Pestañas de Temporadas */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
                {seasons.length > 0 ? (
                  seasons.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSeason(s);
                        const firstEp = (seasonsMap.get(s) || [])[0]?.episode || 1;
                        setSelectedEpisode(firstEp);
                        loadStreamOptions(s, firstEp);
                      }}
                      style={{
                        background: selectedSeason === s ? '#0ea5e9' : '#131b2c',
                        color: selectedSeason === s ? '#ffffff' : '#94a3b8',
                        border: selectedSeason === s ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
                        padding: '6px 16px',
                        borderRadius: 8,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Temporada {s}
                    </button>
                  ))
                ) : (
                  [1, 2, 3].map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSeason(s);
                        setSelectedEpisode(1);
                        loadStreamOptions(s, 1);
                      }}
                      style={{
                        background: selectedSeason === s ? '#0ea5e9' : '#131b2c',
                        color: selectedSeason === s ? '#ffffff' : '#94a3b8',
                        border: selectedSeason === s ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.08)',
                        padding: '6px 16px',
                        borderRadius: 8,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Temporada {s}
                    </button>
                  ))
                )}
              </div>

              {/* Selector / Grid de Episodios */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 10,
                marginTop: 12,
                maxHeight: 260,
                overflowY: 'auto',
                paddingRight: 4
              }}>
                {currentSeasonEpisodes.length > 0 ? (
                  currentSeasonEpisodes.map((ep, idx) => {
                    const epNum = ep.episode || ep.number || (idx + 1);
                    const isSelected = selectedEpisode === epNum;
                    return (
                      <div
                        key={ep.id || idx}
                        onClick={() => {
                          setSelectedEpisode(epNum);
                          loadStreamOptions(selectedSeason, epNum);
                        }}
                        style={{
                          background: isSelected ? 'rgba(14, 165, 233, 0.15)' : '#131b2c',
                          border: isSelected ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center'
                        }}
                      >
                        {ep.thumbnail ? (
                          <img
                            src={ep.thumbnail}
                            alt={ep.name}
                            style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                            loading="lazy"
                          />
                        ) : (
                          <div style={{
                            width: 64,
                            height: 40,
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            E{epNum}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#38bdf8' : '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {epNum}. {ep.name || `Episodio ${epNum}`}
                          </div>
                          {ep.overview && (
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                              {ep.overview}
                            </div>
                          )}
                        </div>
                        <div style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: isSelected ? '#0ea5e9' : 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Play size={11} fill="white" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                    <div
                      key={num}
                      onClick={() => {
                        setSelectedEpisode(num);
                        loadStreamOptions(selectedSeason, num);
                      }}
                      style={{
                        background: selectedEpisode === num ? 'rgba(14, 165, 233, 0.15)' : '#131b2c',
                        border: selectedEpisode === num ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: selectedEpisode === num ? '#38bdf8' : '#e2e8f0' }}>
                        Episodio {num}
                      </span>
                      <Play size={13} fill={selectedEpisode === num ? '#38bdf8' : '#94a3b8'} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Enlaces de reproducción y calidades */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Film size={18} color="#0ea5e9" /> {isSeries ? `Servidores para Temporada ${selectedSeason} • Episodio ${selectedEpisode}` : 'Servidores y Opciones de Reproducción'}
            </h4>

            {loadingStreams && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', padding: 12 }}>
                <RefreshCw size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span>Resolviendo enlaces públicos de reproducción...</span>
              </div>
            )}

            {streamError && (
              <div style={{ color: '#ef4444', fontSize: '0.88rem' }}>{streamError}</div>
            )}

            {!loadingStreams && streams.length > 0 && (
              <div>
                {/* Banner de ayuda para audio en Castellano */}
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.8rem',
                  color: '#86efac'
                }}>
                  <span>🇪🇸 <strong>Audio en Castellano:</strong> Usa el Servidor 1. Si el reproductor muestra botones de idioma arriba a la izquierda, asegúrate de tener marcado <strong>CASTELLANO</strong>.</span>
                </div>

                {/* Filtro rápido de audio */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button 
                    onClick={() => setAudioFilter('all')} 
                    style={{
                      background: audioFilter === 'all' ? '#0ea5e9' : 'rgba(255,255,255,0.06)',
                      color: 'white',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Todos ({streams.length})
                  </button>
                  <button 
                    onClick={() => setAudioFilter('castellano')} 
                    style={{
                      background: audioFilter === 'castellano' ? '#22c55e' : 'rgba(255,255,255,0.06)',
                      color: 'white',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    🇪🇸 Castellano / Dual ({streams.filter(s => s.isCastellano).length})
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {streams
                    .filter(s => audioFilter === 'castellano' ? s.isCastellano : true)
                    .map((s, idx) => (
                    <div 
                      key={s.id || idx}
                      style={{
                        background: '#131b2c',
                        padding: '12px 16px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: s.isCastellano ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>{s.name}</span>
                          {s.isCastellano ? (
                            <span style={{ 
                              background: 'rgba(34, 197, 94, 0.2)', 
                              color: '#4ade80', 
                              border: '1px solid rgba(34, 197, 94, 0.4)', 
                              borderRadius: 4, 
                              padding: '2px 8px', 
                              fontSize: '0.74rem', 
                              fontWeight: 700 
                            }}>
                              🇪🇸 {s.audio || 'Castellano'}
                            </span>
                          ) : s.audio ? (
                            <span style={{ 
                              background: 'rgba(255, 255, 255, 0.08)', 
                              color: '#94a3b8', 
                              borderRadius: 4, 
                              padding: '2px 6px', 
                              fontSize: '0.72rem' 
                            }}>
                              {s.audio}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Calidad: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{s.quality}</span> • Formato: {(s.type || 'stream').toUpperCase()}
                        </div>
                      </div>

                      <button 
                        className="btn-primary" 
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        onClick={() => {
                          onPlayStream({
                            id: details.id,
                            title: isSeries 
                              ? `${details.title} - T${selectedSeason}:E${selectedEpisode} [${s.quality}]` 
                              : `${details.title} [${s.quality}]`,
                            poster: details.poster,
                            streamUrl: s.streamUrl,
                            embedUrl: s.embedUrl,
                            isEmbed: !!s.isEmbed,
                            proxiedUrl: s.proxiedUrl,
                            category: isSeries 
                              ? `Serie • Temporada ${selectedSeason} Episodio ${selectedEpisode}` 
                              : 'Cine Bajo Demanda'
                          });
                          onClose();
                        }}
                      >
                        <Play size={15} fill="white" /> Reproducir
                      </button>
                    </div>
                  ))}
                  {audioFilter === 'castellano' && streams.filter(s => s.isCastellano).length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '12px', textAlign: 'center' }}>
                      No se detectaron pistas con etiqueta explícita de Castellano. Prueba con "Todos" para ver las pistas V.O. o Dual.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
