const API_BASE = '/api';

export const api = {
  // Canales en directo y agenda deportiva
  async getLiveChannels(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/live/channels?${query}`);
    if (!res.ok) throw new Error('Error al cargar canales en directo');
    return res.json();
  },

  async getSportsEvents(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/live/events?${query}`);
    if (!res.ok) throw new Error('Error al cargar eventos deportivos');
    return res.json();
  },

  async resolveStream(params) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/live/resolve?${query}`);
    if (!res.ok) throw new Error('Error al resolver stream');
    return res.json();
  },

  // Catálogo VOD (Cine y Series)
  async getVodCatalog(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/vod/catalog?${query}`);
    if (!res.ok) throw new Error('Error al cargar catálogo VOD');
    return res.json();
  },

  async getVodDetails(id) {
    const res = await fetch(`${API_BASE}/vod/details/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Error al cargar detalles de la película o serie');
    return res.json();
  },

  async resolveVodStreams(id, title = '') {
    const res = await fetch(`${API_BASE}/vod/resolve/${encodeURIComponent(id)}?title=${encodeURIComponent(title)}`);
    if (!res.ok) throw new Error('Error al resolver streams VOD');
    return res.json();
  },

  // Buscador global unificado
  async globalSearch(q) {
    if (!q || !q.trim()) return { live: [], events: [], vod: [] };
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q.trim())}`);
    if (!res.ok) throw new Error('Error en búsqueda global');
    return res.json();
  },

  // Favoritos
  async getFavorites() {
    const res = await fetch(`${API_BASE}/user/favorites`);
    if (!res.ok) throw new Error('Error al obtener favoritos');
    return res.json();
  },

  async toggleFavorite(item) {
    const res = await fetch(`${API_BASE}/user/favorites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id || item.itemId,
        type: item.type || 'live',
        title: item.title,
        poster: item.poster || item.logo,
        streamUrl: item.streamUrl,
        category: item.category || item.competition,
        extraJson: item
      })
    });
    if (!res.ok) throw new Error('Error al alternar favorito');
    return res.json();
  },

  // Historial
  async getHistory() {
    const res = await fetch(`${API_BASE}/user/history`);
    if (!res.ok) throw new Error('Error al obtener historial');
    return res.json();
  },

  async updateHistoryProgress(item, positionSeconds, durationSeconds) {
    const res = await fetch(`${API_BASE}/user/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id || item.itemId,
        type: item.type || 'video',
        title: item.title,
        poster: item.poster || item.logo,
        streamUrl: item.streamUrl,
        positionSeconds,
        durationSeconds
      })
    });
    return res.json();
  },

  // Fuentes y Salud
  async getSources() {
    const res = await fetch(`${API_BASE}/settings/sources`);
    if (!res.ok) throw new Error('Error al obtener fuentes');
    return res.json();
  },

  async reloadSources() {
    const res = await fetch(`${API_BASE}/settings/reload-sources`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al recargar sources.yaml');
    return res.json();
  },

  async checkHealth() {
    const res = await fetch(`${API_BASE}/settings/check-health`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al verificar salud');
    return res.json();
  },

  // Capa Xtream Codes
  async testXtreamConnection(params) {
    const res = await fetch(`${API_BASE}/settings/test-xtream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return res.json();
  },

  async saveXtreamProvider(params) {
    const res = await fetch(`${API_BASE}/settings/save-xtream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Error guardando proveedor Xtream');
    return res.json();
  },

  async deleteXtreamProvider(id) {
    const res = await fetch(`${API_BASE}/settings/xtream/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error eliminando proveedor Xtream');
    return res.json();
  },

  async getLogs() {
    const res = await fetch(`${API_BASE}/settings/logs`);
    if (!res.ok) throw new Error('Error al obtener logs');
    return res.json();
  },

  async setDebugMode(enabled) {
    const res = await fetch(`${API_BASE}/settings/debug`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    return res.json();
  },

  async getSystemInfo() {
    const res = await fetch(`${API_BASE}/settings/info`);
    if (!res.ok) throw new Error('Error al obtener información de red');
    return res.json();
  }
};
