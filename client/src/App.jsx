import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { LiveView } from './components/LiveView';
import { VodView } from './components/VodView';
import { SearchView } from './components/SearchView';
import { FavoritesView } from './components/FavoritesView';
import { HealthModal } from './components/HealthModal';
import { SettingsView } from './components/SettingsView';
import { Player } from './components/Player';
import { ItemDetailModal } from './components/ItemDetailModal';
import { Toast } from './components/Toast';
import { api } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  
  // Reproductor y Modales
  const [playingItem, setPlayingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    try {
      const res = await api.getFavorites();
      setFavorites(res.favorites || []);
    } catch (err) {
      console.warn('Error cargando favoritos:', err);
    }
  }

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleToggleFavorite = async (item) => {
    try {
      const res = await api.toggleFavorite(item);
      await loadFavorites();
      if (res.status === 'added') {
        showToast(`"${item.title}" añadido a tus favoritos`);
      } else {
        showToast(`"${item.title}" eliminado de favoritos`);
      }
    } catch (err) {
      showToast('Error al actualizar favoritos');
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSubmittedQuery(searchQuery.trim());
    setActiveTab('search');
  };

  // Reproducir un canal en directo
  const handleSelectChannel = (channel) => {
    const proxiedUrl = channel.proxiedUrl || `/api/proxy/stream?url=${encodeURIComponent(channel.streamUrl)}`;
    setPlayingItem({
      ...channel,
      proxiedUrl
    });
  };

  // Sintonizar un partido o evento deportivo en vivo
  const handleSelectEvent = async (event) => {
    showToast(`Buscando retransmisión para: ${event.title}...`);
    try {
      // Buscar canales deportivos que estén emitiendo o relacionados
      const res = await api.getLiveChannels({ query: event.sport === 'Fútbol' ? 'teledeporte' : 'sport', limit: 5 });
      const channel = (res.channels && res.channels[0]) || {
        title: `${event.title} (${event.competition})`,
        streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        category: event.competition
      };

      handleSelectChannel({
        ...channel,
        title: `${event.title} [${event.competition}]`
      });
    } catch (err) {
      showToast('No se pudo sintonizar el evento');
    }
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'search') setSubmittedQuery('');
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      <main className="main-content">
        {activeTab === 'home' && (
          <HomeView
            onSelectChannel={handleSelectChannel}
            onSelectVod={(vod) => setDetailItem(vod)}
            onSelectEvent={handleSelectEvent}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'sports' && (
          <LiveView
            onSelectChannel={handleSelectChannel}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'vod' && (
          <VodView
            onSelectItem={(item) => setDetailItem(item)}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'search' && (
          <SearchView
            query={submittedQuery || searchQuery}
            onSelectChannel={handleSelectChannel}
            onSelectVod={(item) => setDetailItem(item)}
            onSelectEvent={handleSelectEvent}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            onSelectChannel={handleSelectChannel}
            onSelectVod={(item) => setDetailItem(item)}
            onRemoveFavorite={async (id) => {
              await api.toggleFavorite({ id });
              await loadFavorites();
              showToast('Elemento eliminado de favoritos');
            }}
          />
        )}

        {activeTab === 'health' && (
          <HealthModal onShowToast={showToast} />
        )}

        {activeTab === 'settings' && (
          <SettingsView onShowToast={showToast} />
        )}
      </main>

      {/* Reproductor modal con HLS y controles */}
      {playingItem && (
        <Player
          item={playingItem}
          onClose={() => setPlayingItem(null)}
          onShowToast={showToast}
        />
      )}

      {/* Ficha técnica y selección de servidores para VOD */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onPlayStream={(streamItem) => setPlayingItem(streamItem)}
        />
      )}

      {/* Notificaciones discretas */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
