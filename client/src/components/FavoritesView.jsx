import React from 'react';
import { Heart, Play, Trash2 } from 'lucide-react';

export function FavoritesView({ favorites, onSelectChannel, onSelectVod, onRemoveFavorite }) {
  if (!favorites || favorites.length === 0) {
    return (
      <div className="error-state-card" style={{ marginTop: 60 }}>
        <Heart size={48} color="#64748b" />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Aún no tienes favoritos</h2>
        <p style={{ color: '#94a3b8' }}>
          Guarda canales deportivos o películas pulsando en el icono de corazón para tenerlos siempre a mano.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <Heart size={24} color="#ef4444" fill="#ef4444" /> Mis Favoritos ({favorites.length})
          </h1>
          <p className="section-subtitle">Tus canales y películas marcadas para acceso rápido</p>
        </div>
      </div>

      <div className="grid-container" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {favorites.map((fav) => (
          <div 
            key={fav.id || fav.item_id} 
            className="channel-card"
            onClick={() => {
              if (fav.type === 'vod') {
                onSelectVod({ id: fav.item_id, title: fav.title, poster: fav.poster });
              } else {
                onSelectChannel({
                  id: fav.item_id,
                  title: fav.title,
                  streamUrl: fav.stream_url,
                  proxiedUrl: `/api/proxy/stream?url=${encodeURIComponent(fav.stream_url)}`,
                  category: fav.category
                });
              }
            }}
          >
            <div className="channel-thumb-wrapper">
              <img src={fav.poster} alt={fav.title} className="channel-logo" style={{ maxHeight: '85%', maxWidth: '85%' }} />
              <div className="card-play-overlay">
                <div className="play-circle"><Play size={22} fill="white" /></div>
              </div>
            </div>

            <div className="channel-info">
              <div className="channel-title">{fav.title}</div>
              <div className="channel-meta">
                <span>{fav.category || (fav.type === 'vod' ? 'Cine' : 'En Directo')}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFavorite(fav.item_id);
                  }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                  title="Eliminar de Favoritos"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
