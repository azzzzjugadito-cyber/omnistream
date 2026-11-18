import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, X, RefreshCw, AlertCircle, Cast, PictureInPicture2 
} from 'lucide-react';
import { api } from '../services/api';

export function Player({ item, onClose, onShowToast }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Calidades y pistas
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [subtitles, setSubtitles] = useState([]);
  const [currentSubtitle, setCurrentSubtitle] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [hasAirPlay, setHasAirPlay] = useState(false);

  // Estado de error y reintento
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const [availableStreams, setAvailableStreams] = useState([]);

  // Inicializar streams disponibles (stream principal + copias de seguridad)
  useEffect(() => {
    if (!item) return;

    const streams = [];
    if (item.proxiedUrl) streams.push({ url: item.proxiedUrl, name: 'Proxy Seguro (Principal)' });
    if (item.streamUrl) streams.push({ url: item.streamUrl, name: 'Stream Directo' });
    if (Array.isArray(item.backupUrls)) {
      item.backupUrls.forEach((bUrl, idx) => {
        streams.push({ 
          url: `/api/proxy/stream?url=${encodeURIComponent(bUrl)}`, 
          name: `Fuente de Respaldo ${idx + 1}` 
        });
      });
    }

    setAvailableStreams(streams);
    setCurrentStreamIndex(0);
  }, [item]);

  // Cargar stream actual
  useEffect(() => {
    if (!availableStreams.length || !videoRef.current) return;
    loadStream(availableStreams[currentStreamIndex].url);

    return () => {
      destroyPlayer();
    };
  }, [availableStreams, currentStreamIndex]);

  // Soporte AirPlay para Safari / iOS
  useEffect(() => {
    const video = videoRef.current;
    if (video && window.WebKitPlaybackTargetAvailabilityEvent) {
      video.addEventListener('webkitplaybacktargetavailabilitychanged', (e) => {
        setHasAirPlay(e.availability === 'available');
      });
    }
  }, []);

  function destroyPlayer() {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }

  function loadStream(url) {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);
    destroyPlayer();

    const isHls = url.includes('.m3u8') || url.includes('type=hls') || !url.includes('.mp4');

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30
      });

      hls.loadSource(url);
      hls.attachMedia(video);
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setLoading(false);
        setLevels(data.levels || []);
        video.play().catch(() => {});

        // Si tenemos posición guardada en el historial
        if (item.positionSeconds && item.positionSeconds > 5) {
          video.currentTime = item.positionSeconds;
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (event, data) => {
        setSubtitles(data.subtitleTracks || []);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          handleStreamFailure(data.type);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Reproducción nativa en Safari (iOS / macOS) o MP4
      video.src = url;
      video.load();
      video.play().catch(() => {});
      setLoading(false);

      if (item.positionSeconds && item.positionSeconds > 5) {
        video.currentTime = item.positionSeconds;
      }
    } else {
      handleStreamFailure('Formato de vídeo no compatible en este navegador');
    }
  }

  // Manejo de fallo y reintento automático con fuentes alternativas
  function handleStreamFailure(reason) {
    destroyPlayer();
    
    const nextIdx = currentStreamIndex + 1;
    if (nextIdx < availableStreams.length) {
      if (onShowToast) {
        onShowToast(`Fuente principal no disponible. Conectando con fuente alternativa (${nextIdx + 1}/${availableStreams.length})...`);
      }
      setCurrentStreamIndex(nextIdx);
    } else {
      setLoading(false);
      setError(`No se pudo reproducir ninguna de las ${availableStreams.length} fuentes disponibles (${reason}).`);
    }
  }

  // Guardar progreso cada 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused && video.currentTime > 0) {
        api.updateHistoryProgress(item, video.currentTime, video.duration || 0).catch(() => {});
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [item]);

  // Controles
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    try {
      if (videoRef.current && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoRef.current.requestPictureInPicture();
        }
      }
    } catch (err) {
      console.warn('PiP no disponible:', err);
    }
  };

  const triggerAirPlay = () => {
    if (videoRef.current && videoRef.current.webkitShowPlaybackTargetPicker) {
      videoRef.current.webkitShowPlaybackTargetPicker();
    }
  };

  const handleLevelChange = (e) => {
    const lvl = parseInt(e.target.value, 10);
    setCurrentLevel(lvl);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvl;
    }
  };

  const handleSubtitleChange = (e) => {
    const sub = parseInt(e.target.value, 10);
    setCurrentSubtitle(sub);
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = sub;
    }
  };

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <div className="player-modal-backdrop" ref={containerRef}>
      {/* Cabecera del reproductor */}
      <div className="player-header">
        <div className="player-title-info">
          <div className="player-title">{item.title}</div>
          <div className="player-subtitle">
            {item.category || item.competition || 'Emisión en Directo'} • {availableStreams[currentStreamIndex]?.name || 'Stream'}
          </div>
        </div>
        <button className="player-close-btn" onClick={onClose} title="Cerrar reproductor">
          <X size={22} />
        </button>
      </div>

      {/* Pantalla de vídeo */}
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          playsInline
          x-webkit-airplay="allow"
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => handleStreamFailure('Error de decodificación o conexión con el stream')}
        />

        {/* Spinner de carga */}
        {loading && (
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={44} className="animate-spin" style={{ animation: 'spin 1s linear infinite', color: '#0ea5e9' }} />
            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Conectando con la fuente...</div>
          </div>
        )}

        {/* Tarjeta visible ante error (Cero pantallas en blanco) */}
        {error && (
          <div className="error-state-card" style={{ zIndex: 20 }}>
            <AlertCircle size={48} color="#ef4444" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Fallo de Reproducción</h3>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>{error}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                className="btn-primary" 
                onClick={() => {
                  setCurrentStreamIndex(0);
                  loadStream(availableStreams[0].url);
                }}
              >
                <RefreshCw size={18} /> Reintentar
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Volver
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Controles */}
      <div className="player-controls-bottom">
        <div className="player-control-group">
          <button className="player-btn" onClick={togglePlay} title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          
          <button className="player-btn" onClick={toggleMute} title={isMuted ? 'Desmutear' : 'Mutear'}>
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={{ width: 80, accentColor: '#0ea5e9', cursor: 'pointer' }}
          />

          {duration > 0 && (
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginLeft: 8 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          )}
        </div>

        <div className="player-control-group">
          {/* Selector de Calidades HLS */}
          {levels.length > 0 && (
            <select className="player-select" value={currentLevel} onChange={handleLevelChange} title="Seleccionar Calidad">
              <option value="-1">Auto (Adaptativa)</option>
              {levels.map((lvl, idx) => (
                <option key={idx} value={idx}>
                  {lvl.height}p ({Math.round(lvl.bitrate / 1000)} kbps)
                </option>
              ))}
            </select>
          )}

          {/* Subtítulos */}
          {subtitles.length > 0 && (
            <select className="player-select" value={currentSubtitle} onChange={handleSubtitleChange} title="Subtítulos">
              <option value="-1">Subtítulos: Desactivados</option>
              {subtitles.map((sub, idx) => (
                <option key={idx} value={idx}>{sub.name || `Pista ${idx + 1}`}</option>
              ))}
            </select>
          )}

          {/* Soporte AirPlay */}
          {hasAirPlay && (
            <button className="player-btn" onClick={triggerAirPlay} title="Transmitir por AirPlay">
              <Cast size={20} />
            </button>
          )}

          {/* PiP (Picture in Picture) */}
          <button className="player-btn" onClick={togglePiP} title="Modo Imagen en Imagen (PiP)">
            <PictureInPicture2 size={20} />
          </button>

          {/* Pantalla Completa */}
          <button className="player-btn" onClick={toggleFullscreen} title="Pantalla Completa">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
