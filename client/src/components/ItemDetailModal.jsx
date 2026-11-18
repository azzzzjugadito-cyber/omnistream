import React, { useEffect, useState } from 'react';
import { 
  X, Star, Play, Film, User, RefreshCw, AlertCircle, ExternalLink 
} from 'lucide-react';
import { api } from '../services/api';

export function ItemDetailModal({ item, onClose, onPlayStream }) {
  const [details, setDetails] = useState(item);
  const [streams, setStreams] = useState([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamError, setStreamError] = useState(null);

  useEffect(() => {
    loadDeepDetails();
    loadStreamOptions();
  }, [item]);

  async function loadDeepDetails() {
    try {
      const res = await api.getVodDetails(item.id);
      if (res) {
        setDetails(prev => ({ ...prev, ...res }));
      }
    } catch (err) {
      console.warn('No se pudieron cargar detalles adicionales:', err);
    }
  }

  async function loadStreamOptions() {
    setLoadingStreams(true);
    setStreamError(null);
    try {
      const res = await api.resolveVodStreams(item.id, item.title);
      setStreams(res.streams || []);
    } catch (err) {
      setStreamError('Error al resolver enlaces de reproducción');
    } finally {
      setLoadingStreams(false);
    }
  }

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

          {/* Enlaces de reproducción y calidades */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Film size={18} color="#0ea5e9" /> Servidores y Opciones de Reproducción
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {streams.map((s, idx) => (
                  <div 
                    key={s.id || idx}
                    style={{
                      background: '#131b2c',
                      padding: '12px 16px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        Calidad: <span style={{ color: '#38bdf8', fontWeight: 700 }}>{s.quality}</span> • Formato: {s.type.toUpperCase()}
                      </div>
                    </div>

                    <button 
                      className="btn-primary" 
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      onClick={() => {
                        onPlayStream({
                          id: details.id,
                          title: `${details.title} [${s.quality}]`,
                          poster: details.poster,
                          streamUrl: s.streamUrl,
                          proxiedUrl: s.proxiedUrl || `/api/proxy/stream?url=${encodeURIComponent(s.streamUrl)}`,
                          category: 'Catálogo VOD'
                        });
                        onClose();
                      }}
                    >
                      <Play size={15} fill="white" /> Reproducir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
