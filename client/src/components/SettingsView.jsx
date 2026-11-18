import React, { useEffect, useState } from 'react';
import { 
  Settings, Smartphone, Terminal, RefreshCw, CheckCircle2, AlertTriangle, 
  Key, Server, Plus, Trash2, Shield, Activity, Radio, Globe 
} from 'lucide-react';
import { api } from '../services/api';

export function SettingsView({ onShowToast }) {
  const [sysInfo, setSysInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isDebug, setIsDebug] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Preferencia de idioma de comentarios
  const [commentaryLang, setCommentaryLang] = useState(() => localStorage.getItem('omnistream_commentary_lang') || 'es');

  // Estado de proveedores Xtream
  const [sources, setSources] = useState([]);
  const [testingXtream, setTestingXtream] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savingXtream, setSavingXtream] = useState(false);
  const [useEnvCredentials, setUseEnvCredentials] = useState(false);

  const [form, setForm] = useState({
    name: '',
    protocol: 'http',
    host: '',
    port: '8080',
    username: '',
    usernameEnv: '',
    password: '',
    passwordEnv: '',
    streamExt: 'm3u8',
    priority: '1'
  });

  useEffect(() => {
    loadInfo();
    loadLogs();
    loadSources();
  }, []);

  async function loadInfo() {
    try {
      const info = await api.getSystemInfo();
      setSysInfo(info);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSources() {
    try {
      const res = await api.getSources();
      setSources(res.sources || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const res = await api.getLogs();
      setLogs(res.logs || []);
      setIsDebug(!!res.isDebug);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function handleToggleDebug() {
    try {
      const res = await api.setDebugMode(!isDebug);
      setIsDebug(res.isDebug);
      if (onShowToast) {
        onShowToast(`Modo depuración ${res.isDebug ? 'activado' : 'desactivado'}`);
      }
      loadLogs();
    } catch (err) {
      if (onShowToast) onShowToast('Error al cambiar modo depuración');
    }
  }

  // Probar conexión Xtream antes de guardar
  async function handleTestXtream() {
    setTestingXtream(true);
    setTestResult(null);

    const payload = {
      protocol: form.protocol,
      host: form.host,
      port: form.port,
      username: useEnvCredentials ? undefined : form.username,
      usernameEnv: useEnvCredentials ? form.usernameEnv : undefined,
      password: useEnvCredentials ? undefined : form.password,
      passwordEnv: useEnvCredentials ? form.passwordEnv : undefined
    };

    try {
      const res = await api.testXtreamConnection(payload);
      setTestResult(res);
      if (res.success && onShowToast) {
        onShowToast('Conexión con el servidor Xtream verificada con éxito.');
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingXtream(false);
    }
  }

  // Guardar proveedor en sources.yaml
  async function handleSaveXtream(e) {
    e.preventDefault();
    setSavingXtream(true);

    const payload = {
      name: form.name.trim() || `Xtream (${form.host})`,
      protocol: form.protocol,
      host: form.host.trim(),
      port: parseInt(form.port, 10) || 8080,
      username: useEnvCredentials ? undefined : form.username.trim(),
      usernameEnv: useEnvCredentials ? form.usernameEnv.trim() : undefined,
      password: useEnvCredentials ? undefined : form.password.trim(),
      passwordEnv: useEnvCredentials ? form.passwordEnv.trim() : undefined,
      streamExt: form.streamExt,
      priority: parseInt(form.priority, 10) || 1,
      enabled: true
    };

    try {
      await api.saveXtreamProvider(payload);
      if (onShowToast) {
        onShowToast(`Proveedor Xtream "${payload.name}" guardado y sincronizado.`);
      }
      // Resetear formulario
      setForm({
        name: '',
        protocol: 'http',
        host: '',
        port: '8080',
        username: '',
        usernameEnv: '',
        password: '',
        passwordEnv: '',
        streamExt: 'm3u8',
        priority: '1'
      });
      setTestResult(null);
      await loadSources();
    } catch (err) {
      if (onShowToast) onShowToast(`Error guardando proveedor: ${err.message}`);
    } finally {
      setSavingXtream(false);
    }
  }

  async function handleDeleteProvider(id) {
    if (!confirm('¿Seguro que deseas eliminar este proveedor?')) return;
    try {
      await api.deleteXtreamProvider(id);
      if (onShowToast) onShowToast('Proveedor eliminado de sources.yaml');
      await loadSources();
    } catch (err) {
      if (onShowToast) onShowToast('Error al eliminar proveedor');
    }
  }

  const xtreamSources = sources.filter(s => s.type === 'xtream');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="section-header">
        <div>
          <h1 className="section-title">
            <Settings size={24} color="#0ea5e9" /> Ajustes del Agregador OTT
          </h1>
          <p className="section-subtitle">
            Capa de proveedores Xtream Codes, red local PWA y herramientas de depuración
          </p>
        </div>
      </div>

      {/* 0. Preferencia de Idioma de Retransmisión y Comentarios */}
      <section style={{ background: '#0f141f', border: '1px solid rgba(14, 165, 233, 0.2)', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#38bdf8' }}>
          <Globe size={22} color="#0ea5e9" /> Idioma de Retransmisión de Partidos
        </h3>
        <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
          Prioriza automáticamente los canales de emisión que coinciden con tu idioma preferido (sin ocultar los demás canales internacionales).
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'es', label: '🇪🇸 Español (Predeterminado)' },
            { id: 'en', label: '🇬🇧 English' },
            { id: 'fr', label: '🇫🇷 Français' },
            { id: 'it', label: '🇮🇹 Italiano' },
            { id: 'de', label: '🇩🇪 Deutsch' },
            { id: 'pt', label: '🇵🇹 Português' },
            { id: 'all', label: '🌐 Todas las señales (Sin preferencia)' }
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setCommentaryLang(item.id);
                localStorage.setItem('omnistream_commentary_lang', item.id);
                if (onShowToast) onShowToast(`Comentarios priorizados en: ${item.label}`);
              }}
              className={`filter-pill ${commentaryLang === item.id ? 'active' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 1. Gestor Multi-Proveedor Xtream Codes */}
      <section style={{ background: '#0f141f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Server size={22} color="#0ea5e9" /> Capa de Proveedores Xtream Codes (IPTV)
        </h3>
        <p style={{ fontSize: '0.86rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>
          Conecta servidores IPTV compatibles con la API estándar de Xtream (<code>player_api.php</code> y <code>xmltv.php</code>). 
          Los canales se integran automáticamente en la parrilla con reintentos y prioridad configurable.
        </p>

        {/* Proveedores Xtream ya configurados */}
        {xtreamSources.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#cbd5e1', marginBottom: 10 }}>
              Proveedores Activos ({xtreamSources.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {xtreamSources.map((src) => (
                <div 
                  key={src.id}
                  style={{
                    background: '#07090e',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {src.name}
                      <span className={`health-badge ${src.healthStatus || 'offline'}`}>
                        <span className={`health-dot ${src.healthStatus || 'offline'}`} />
                        {src.healthStatus === 'online' ? 'Conectado' : src.healthStatus === 'degraded' ? 'Lento' : 'Comprobando...'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>
                      Servidor: {src.host}:{src.port} • Prioridad: {src.priority} • Formato: {src.streamExt?.toUpperCase() || 'M3U8'}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDeleteProvider(src.id)}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 8 }}
                    title="Eliminar este proveedor"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario de Alta / Conexión */}
        <form onSubmit={handleSaveXtream} style={{ background: '#090d16', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> Añadir Nuevo Proveedor Xtream
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Nombre del Proveedor</label>
              <input
                type="text"
                placeholder="Ej: Servidor Primario"
                className="player-select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Protocolo</label>
              <select
                className="player-select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
              >
                <option value="http">HTTP (Estándar)</option>
                <option value="https">HTTPS (Seguro)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Servidor (Host o IP)</label>
              <input
                type="text"
                required
                placeholder="ejemplo.com o 192.168.x.x"
                className="player-select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Puerto</label>
              <input
                type="text"
                placeholder="8080"
                className="player-select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
              />
            </div>

            {/* Alternar entre credenciales directas o variables .env */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
              <input
                type="checkbox"
                id="envCreds"
                checked={useEnvCredentials}
                onChange={(e) => setUseEnvCredentials(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#0ea5e9' }}
              />
              <label htmlFor="envCreds" style={{ fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <Shield size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Usar variables de entorno (.env) para no guardar usuario y contraseña en claro
              </label>
            </div>

            {useEnvCredentials ? (
              <>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Variable de Usuario (.env)</label>
                  <input
                    type="text"
                    placeholder="XTREAM_USER"
                    className="player-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={form.usernameEnv}
                    onChange={(e) => setForm({ ...form, usernameEnv: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Variable de Contraseña (.env)</label>
                  <input
                    type="text"
                    placeholder="XTREAM_PASS"
                    className="player-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={form.passwordEnv}
                    onChange={(e) => setForm({ ...form, passwordEnv: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Usuario</label>
                  <input
                    type="text"
                    required={!useEnvCredentials}
                    placeholder="Tu usuario"
                    className="player-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Contraseña</label>
                  <input
                    type="password"
                    required={!useEnvCredentials}
                    placeholder="••••••••"
                    className="player-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Extensión de Stream</label>
              <select
                className="player-select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.streamExt}
                onChange={(e) => setForm({ ...form, streamExt: e.target.value })}
              >
                <option value="m3u8">HLS (.m3u8) - Recomendado</option>
                <option value="ts">MPEG-TS (.ts)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>Prioridad (1 = Mayor)</label>
              <input
                type="number"
                min="1"
                max="10"
                className="player-select"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
          </div>

          {/* Resultado de la prueba de conexión */}
          {testResult && (
            <div 
              style={{ 
                marginTop: 16, 
                padding: 12, 
                borderRadius: 8, 
                background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: testResult.success ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                color: testResult.success ? '#34d399' : '#f87171',
                fontSize: '0.85rem'
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {testResult.success ? 'Conexión verificada con éxito' : 'Fallo en la prueba'}
              </div>
              <div>{testResult.message || testResult.error}</div>
              {testResult.userInfo && (
                <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#cbd5e1' }}>
                  Usuario: <strong>{testResult.userInfo.username}</strong> • Caducidad: {testResult.userInfo.expDate} • Conexiones: {testResult.userInfo.activeCons}/{testResult.userInfo.maxCons}
                </div>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: 12, marginTop: 18, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTestXtream}
              disabled={testingXtream || !form.host}
            >
              <Activity size={16} className={testingXtream ? 'animate-spin' : ''} />
              {testingXtream ? 'Probando...' : 'Probar Conexión'}
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={savingXtream || !form.host}
            >
              <Plus size={16} />
              {savingXtream ? 'Guardando...' : 'Guardar Proveedor'}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Tarjeta de Instalación PWA en iPhone / Móvil */}
      <section style={{ background: '#0f141f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Smartphone size={22} color="#38bdf8" /> Acceso e Instalación PWA en iPhone (Safari)
        </h3>
        
        <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: 16 }}>
          Para ver el fútbol, deportes y cine en tu iPhone o iPad desde cualquier punto de la casa con AirPlay:
        </p>

        <div style={{ background: '#07090e', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 4 }}>URL de acceso en red local:</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
            {sysInfo ? `http://${sysInfo.primaryIp}:3000` : 'http://<IP_LOCAL>:3000'}
          </div>
        </div>

        <ol style={{ fontSize: '0.86rem', color: '#cbd5e1', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Asegúrate de que tu iPhone esté conectado a la misma red WiFi del ordenador.</li>
          <li>Abre <strong>Safari</strong> en el iPhone e introduce la URL indicada arriba.</li>
          <li>Pulsa el botón de <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba).</li>
          <li>Selecciona <strong>"Añadir a pantalla de inicio"</strong>. La app se abrirá a pantalla completa como una app nativa.</li>
        </ol>
      </section>

      {/* 3. Estado de TMDB y Metadatos */}
      <section style={{ background: '#0f141f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Key size={20} color="#fbbf24" /> Clave de Metadatos TMDB
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
              {sysInfo?.tmdbConfigured ? 'Clave de TMDB Configurada' : 'Modo Cinemeta Fallback (Sin registro)'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
              {sysInfo?.tmdbConfigured 
                ? 'Conectado a la API oficial de The Movie Database'
                : 'El catálogo funciona mediante el motor Cinemeta. Puedes añadir tu TMDB_API_KEY en el archivo .env'}
            </div>
          </div>

          <span className={`health-badge ${sysInfo?.tmdbConfigured ? 'online' : 'degraded'}`}>
            {sysInfo?.tmdbConfigured ? 'TMDB Activo' : 'Cinemeta Activo'}
          </span>
        </div>
      </section>

      {/* 4. Visor de Logs y Modo Depuración */}
      <section style={{ background: '#0f141f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={20} color="#a855f7" /> Registro de Logs y Depuración
          </h3>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={handleToggleDebug}>
              {isDebug ? 'Desactivar Modo Depuración' : 'Activar Modo Depuración'}
            </button>
            <button className="btn-secondary" onClick={loadLogs} disabled={loadingLogs}>
              <RefreshCw size={15} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div 
          style={{ 
            background: '#07090e', 
            borderRadius: 8, 
            padding: 14, 
            fontFamily: 'monospace', 
            fontSize: '0.78rem', 
            color: '#94a3b8', 
            height: 240, 
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {logs.length === 0 ? (
            <div>Sin logs registrados aún.</div>
          ) : (
            logs.map((line, idx) => (
              <div key={idx} style={{ marginBottom: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
