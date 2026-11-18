import React, { useEffect, useState } from 'react';
import { 
  Activity, RefreshCw, FileText, CheckCircle2, AlertTriangle, XCircle, Clock, Zap 
} from 'lucide-react';
import { api } from '../services/api';

export function HealthModal({ onShowToast }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const res = await api.getSources();
      setSources(res.sources || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    try {
      await api.checkHealth();
      await loadSources();
      if (onShowToast) onShowToast('Comprobación de salud finalizada con éxito.');
    } catch (err) {
      if (onShowToast) onShowToast('Error al ejecutar comprobación de salud');
    } finally {
      setChecking(false);
    }
  }

  async function handleReloadYaml() {
    setReloading(true);
    try {
      const res = await api.reloadSources();
      await loadSources();
      if (onShowToast) {
        onShowToast(`sources.yaml recargado en caliente (${res.activeSources} adaptadores activos).`);
      }
    } catch (err) {
      if (onShowToast) onShowToast('Error recargando sources.yaml');
    } finally {
      setReloading(false);
    }
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <Activity size={24} color="#10b981" /> Estado de Salud de Fuentes
          </h1>
          <p className="section-subtitle">
            Semáforo de disponibilidad, monitor de latencia y recarga en caliente de sources.yaml
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            className="btn-secondary" 
            onClick={handleReloadYaml} 
            disabled={reloading}
            title="Recarga sources.yaml sin reiniciar el servidor"
          >
            <RefreshCw size={16} className={reloading ? 'animate-spin' : ''} style={reloading ? { animation: 'spin 1s linear infinite' } : {}} />
            Recargar YAML
          </button>

          <button 
            className="btn-primary" 
            onClick={handleCheckNow} 
            disabled={checking}
          >
            <Zap size={16} className={checking ? 'animate-spin' : ''} style={checking ? { animation: 'spin 1s linear infinite' } : {}} />
            Comprobar Ahora
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <RefreshCw size={36} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
          <div style={{ marginTop: 12, color: '#94a3b8' }}>Consultando estado de los adaptadores...</div>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sources.map((src) => {
            const status = src.healthStatus || 'unknown';
            const isActive = src.isActive;

            return (
              <div 
                key={src.id}
                style={{
                  background: '#0f141f',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Semáforo de estado */}
                  <div 
                    style={{ 
                      width: 14, 
                      height: 14, 
                      borderRadius: '50%',
                      background: !isActive ? '#64748b' : status === 'online' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#ef4444',
                      boxShadow: isActive && status === 'online' ? '0 0 10px #10b981' : 'none'
                    }} 
                  />

                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {src.name}
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>
                        {src.type}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 3 }}>
                      Prioridad: {src.priority} • {src.url ? src.url.substring(0, 50) + '...' : 'Entrada manual'}
                    </div>

                    {src.error && (
                      <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: 4 }}>
                        Aviso: {src.error}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {src.latencyMs !== null && src.latencyMs !== undefined && (
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                      {src.latencyMs} ms
                    </div>
                  )}

                  <span className={`health-badge ${!isActive ? 'offline' : status}`}>
                    <span className={`health-dot ${!isActive ? 'offline' : status}`} />
                    {!isActive ? 'Desactivada' : status === 'online' ? 'Óptima' : status === 'degraded' ? 'Degradada' : 'Caída'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
