# Arquitectura del Sistema - OmniStream OTT (TFG)

Este documento detalla el diseño técnico, patrones arquitectónicos, diagramas de flujo y modelos de datos implementados en la plataforma **OmniStream OTT**, como base analítica para el Trabajo de Fin de Grado (TFG) en Ingeniería.

---

## 1. Visión General y Objetivos de Diseño

El objetivo central de la investigación es demostrar la viabilidad técnica de una **arquitectura de agregación desacoplada**, capaz de unificar dos paradigmas de distribución multimedia tradicionalmente dispersos:
1. **Emisión lineal en directo (Live OTT / IPTV)**: Flujos HLS (`.m3u8`) con segmentación temporal (`.ts` / `.m4s`), latencia adaptativa y requisitos de cabeceras de origen.
2. **Catálogo no lineal bajo demanda (VOD)**: Metadatos jerárquicos (títulos, sinopsis, reparto, carátulas, tráilers) acoplados a resolvedores de flujo distribuidos.

Todo ello sin almacenar contenido en servidores propios, operando exclusivamente bajo el principio de **enlace e intermediación técnica transparente** (similar a la funcionalidad de un navegador web con capacidades multimedia).

```
 +-------------------------------------------------------------------------+
 |                           CLIENTE (FRONTEND)                            |
 |        React 18 + Vite | HLS.js Player | Mobile Safari PWA | Tauri      |
 +------------------------------------+------------------------------------+
                                      | HTTP REST / Range Streaming
                                      v
 +-------------------------------------------------------------------------+
 |                            BACKEND LOCAL                                |
 |             Node.js + Express (Escuchando en 127.0.0.1 y LAN)           |
 |                                                                         |
 |  +-----------------------+  +-------------------+  +-----------------+  |
 |  |   Internal CORS Proxy |  |  Health Checker   |  | SQLite (WAL)    |  |
 |  |   & Range / Headers   |  |  Monitor & Rank   |  | Favoritos/Hist  |  |
 |  +-----------+-----------+  +---------+---------+  +--------+--------+  |
 |              |                        |                     |           |
 |              v                        v                     v           |
 |  +-------------------------------------------------------------------+  |
 |  |                  SOURCE MANAGER (Patrón Adaptadores)             |  |
 |  +-------+------------+-------------+-------------+------------+-----+  |
 +----------|------------|-------------|-------------|------------|--------+
            |            |             |             |            |
            v            v             v             v            v
     +------------+ +----------+ +-----------+ +-----------+ +----------+
     |  iptv-org  | |   TDT    | |TheSportsDB| | Cinemeta  | | Torrentio|
     | Sports/ES  | | Channels | | Live Agnd | |   /TMDB   | | Resolver |
     +------------+ +----------+ +-----------+ +-----------+ +----------+
```

---

## 2. Patrón de Diseño: Adaptador (Adapter Pattern)

Para aislar el núcleo del servidor de las particularidades de cada proveedor externo (formatos M3U, APIs REST propietarias, scraping de índices o enlaces efímeros), se adopta el **Patrón Adaptador**.

### Diagrama de Clases

```
                 +---------------------------------------+
                 |          <<Abstract>>                 |
                 |          BaseAdapter                  |
                 +---------------------------------------+
                 | + id: string                          |
                 | + name: string                        |
                 | + type: string                        |
                 | + priority: number                    |
                 | + headers: object                     |
                 +---------------------------------------+
                 | + init(): Promise<void>               |
                 | + list(filters): Promise<Item[]>      |
                 | + search(query): Promise<Item[]>      |
                 | + resolveStream(id): Promise<Stream>  |
                 | + checkHealth(): Promise<Health>      |
                 | + getProxiedUrl(url, hdrs): string    |
                 +---------------------------------------+
                                     ^
                                     |
       +-----------------------------+-----------------------------+
       |                             |                             |
+--------------+              +--------------+              +--------------+
| IptvOrgAdapt |              | TdtChanAdapt |              | SportsEvAdap |
+--------------+              +--------------+              +--------------+
| M3U parsing  |              | M3U8 parse   |              | TheSportsDB  |
| Sport detect |              | DTT canales  |              | Partidos hoy |
| Country tag  |              | Backups mirr |              | Local timing |
+--------------+              +--------------+              +--------------+
       |                             |                             |
+--------------+              +--------------+              +--------------+
| CinemetaAdap |              | StremioResol |              | CustomM3uAdp |
+--------------+              +--------------+              +--------------+
| TMDB / Cine  |              | Torrentio    |              | sources.yaml |
| Sinopsis/Cast|              | Open HLS/MP4 |              | Entradas     |
| Tráilers YT  |              | Quality tiers|              | manuales     |
+--------------+              +--------------+              +--------------+
```

### Configuración Declarativa en Caliente (`sources.yaml`)
El fichero `sources.yaml` define la lista de fuentes activas con su prioridad y cabeceras exigidas. La clase `SourceManager` implementa el método `reload()` que recarga en caliente los adaptadores sin necesidad de reiniciar el proceso Node.js.

---

## 3. Proxy Interno de Streaming: CORS, Range y Reescritura M3U8

Muchas fuentes emisoras en Internet emplean restricciones HTTP mediante cabeceras:
- Verificación del `User-Agent`.
- Comprobación del `Referer` u `Origin`.
- Bloqueo de peticiones cross-domain (CORS) desde el navegador.
- Requisito de peticiones parciales (`Range: bytes=X-Y`) para el correcto rebobinado (seek) en vídeos MP4/MKV.

### Secuencia de Streaming y Reescritura

```
[Navegador/HLS.js]            [OmniStream Proxy]             [Servidor Remoto (CDN)]
        |                              |                                |
        | 1. GET /api/proxy/stream     |                                |
        |    ?url=https://cdn/live.m3u8|                                |
        |----------------------------->| 2. GET /live.m3u8              |
        |                              |    + User-Agent / Referer      |
        |                              |------------------------------->|
        |                              | 3. 200 OK (Playlist cruda)     |
        |                              |<-------------------------------|
        | 4. 200 OK                    |                                |
        |    (URLs reescritas a proxy) |                                |
        |<-----------------------------|                                |
        |                              |                                |
        | 5. GET /api/proxy/stream     |                                |
        |    ?url=https://cdn/seg1.ts  |                                |
        |    Range: bytes=0-1048575    | 6. GET /seg1.ts                |
        |----------------------------->|    Range: bytes=0-1048575      |
        |                              |------------------------------->|
        |                              | 7. 206 Partial Content         |
        | 8. 206 Partial Content       |<-------------------------------|
        |    (Pipe directo de bytes)   |                                |
        |<-----------------------------|                                |
```

### Reglas de Reescritura M3U8:
1. Sublistas de calidades adaptativas (`#EXT-X-STREAM-INF`) -> Reescritas a URLs proxificadas.
2. Claves de cifrado AES-128 (`#EXT-X-KEY:URI="..."`) -> Reescritas para evitar fallos de certificado y CORS.
3. Segmentos de transporte de vídeo (`.ts`, `.m4s`, `.mp4`) -> Enrutados automáticamente a través del proxy.

---

## 4. Monitor de Salud en Segundo Plano y Mecanismo de Failover

Para garantizar **cero pantallas en blanco**, el sistema incorpora un doble mecanismo:

1. **Health Checker Periódico**:
   - Cada $N$ minutos (configurable en `.env`), un hilo en segundo plano emite peticiones `HEAD` / `Range GET` con timeout de 8 segundos a cada fuente.
   - Clasifica el estado en:
     - 🟢 **Óptimo (`online`)**: Latencia $< 3500$ ms.
     - 🟡 **Degradado (`degraded`)**: Latencia $\ge 3500$ ms o lentitud puntual.
     - 🔴 **Caído (`offline`)**: Error HTTP (403, 404, 500) o timeout.
   - Las fuentes caídas son degradadas en el orden de ponderación (se les añade $+100$ a su prioridad efectiva).

2. **Failover Silencioso en el Reproductor**:
   - Cada canal o evento compila una lista de `availableStreams` (`[streamPrincipal, streamRespaldo1, streamRespaldo2]`).
   - Si durante la reproducción se detecta un error irrecuperable (corte de red, 403 sobrevenido), el reproductor conmuta inmediatamente a la siguiente fuente alternativa disponible y emite un `Toast` discreto al usuario sin detener el flujo.

---

## 5. Modelo de Datos Local (SQLite WAL)

La persistencia se implementa mediante SQLite con modo WAL (*Write-Ahead Logging*) para soportar lecturas y escrituras concurrentes sin bloqueos:

```sql
-- Favoritos
CREATE TABLE favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,           -- 'live' | 'vod' | 'event'
  title TEXT NOT NULL,
  poster TEXT,
  stream_url TEXT,
  category TEXT,
  extra_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historial y Posición Exacta (Continuar Viendo)
CREATE TABLE history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  poster TEXT,
  stream_url TEXT,
  position_seconds REAL DEFAULT 0,
  duration_seconds REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estado de Salud de Fuentes
CREATE TABLE source_health (
  source_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,         -- 'online' | 'degraded' | 'offline'
  latency_ms INTEGER,
  last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);
```

---

## 6. Distribución Multiplataforma: Desktop (Tauri) y Móvil (PWA)

- **Desktop (macOS y Windows)**: Empaquetado nativo mediante **Tauri** (Rust), utilizando el motor WebView2 (Windows) y WebKit (macOS). Consume menos de 40 MB de memoria RAM frente a los >300 MB habituales de Electron.
- **Móvil (iOS Safari / PWA)**: El servidor Express escucha en `0.0.0.0` (red LAN). El usuario introduce la IP local en Safari de su iPhone y mediante *"Añadir a pantalla de inicio"* obtiene una experiencia nativa sin pasar por la App Store, con soporte completo de AirPlay y aceleración por hardware.
