# OmniStream OTT - Agregador Unificado de Contenido OTT

Aplicación de escritorio local y web progresiva (PWA) desarrollada como proyecto de ingeniería (TFG) para demostrar la agregación unificada de **emisiones deportivas en directo** y **catálogo de cine y series bajo demanda** en una sola interfaz reactiva, desacoplada y sin alojamiento de contenido propio.

---

## 🌟 Características Principales

- **Deporte en directo**:
  - Agenda de partidos de hoy y próximas horas con hora local (LaLiga EA Sports, Premier League, Champions League, NBA, UFC, Formula 1, MotoGP).
  - Canales de emisión en abierto y retransmisiones HLS verificadas (TDTChannels, iptv-org, Teledeporte, Real Madrid TV, Esport3, FIFA+, Fight Network, etc.).
  - Filtros instantáneos por deporte (Fútbol, Baloncesto, Motor, Deportes de contacto, Tenis, etc.) y país.
- **Cine y Series bajo demanda**:
  - Carruseles por género (Acción, Drama, Comedia, Ciencia Ficción, Animación, etc.).
  - Fichas interactivas con sinopsis, reparto, director, año, puntuación y tráilers.
  - Soporte de metadatos vía TMDB y Cinemeta (fallback sin registro necesario).
  - Selector de calidades (4K, 1080p, 720p) y formatos (HLS `.m3u8`, MP4, MKV).
- **Buscador Global Unificado**:
  - Un único campo de búsqueda que devuelve simultáneamente canales en directo, eventos deportivos y títulos del catálogo, clasificados por tipo.
- **Reproductor Multimedia Avanzado (HLS.js)**:
  - Selector dinámico de resolución/bitrate.
  - Selección de pistas de audio y subtítulos.
  - Modo Imagen en Imagen (PiP - *Picture-in-Picture*).
  - Soporte nativo de **AirPlay** para enviar el vídeo a Apple TV o smart TVs desde iOS/macOS.
  - **Reintento automático silencioso (Failover)** con fuentes alternativas ante caídas o errores 403/404 sin cortar la reproducción.
- **Persistencia Local (SQLite WAL)**:
  - Favoritos sincronizados.
  - Historial con **"Continuar viendo"** guardando el segundo exacto de reproducción.
- **Arquitectura de Adaptadores y Proxy Interno**:
  - Fuentes declarativas configurables en `sources.yaml`.
  - **Recarga en caliente de fuentes** desde la sección de Ajustes sin reiniciar el servidor.
  - Proxy interno que resuelve restricciones CORS e inyecta cabeceras personalizadas (`User-Agent`, `Referer`), con soporte completo de peticiones parciales (`Range: bytes`) para permitir rebobinado y seek fluido.
  - **Comprobador de salud en segundo plano** con panel de semáforos por fuente (verde, amarillo, rojo) y monitor de latencia.
- **PWA Instalable en iPhone (iOS Safari)**:
  - Acceso mediante IP local LAN, manifest web, service worker y soporte para "Añadir a pantalla de inicio".

---

## 🚀 Arranque Rápido con un Solo Comando

### Requisitos Previos
- Node.js (v18 o superior). Verifica con `node -v`.
- Conexión a Internet.

### Instalación y Ejecución

1. Clona o descarga el repositorio y accede a la carpeta:
```bash
cd "iptv futbol"
```

2. Instala las dependencias del backend y del cliente (se realiza una sola vez):
```bash
npm install
npm --prefix client install
```

3. Arranca el sistema completo con **un solo comando**:
```bash
npm start
```

El sistema iniciará simultáneamente el backend en el puerto `3001` y el frontend en el puerto `3000`:
- **Interfaz Web en el ordenador**: [http://localhost:3000](http://localhost:3000)
- **Servidor Backend y Proxy**: [http://localhost:3001](http://localhost:3001)

---

## 📱 Instalación como PWA en iPhone (Safari)

Para disfrutar de los partidos y el catálogo en el iPhone o iPad a pantalla completa:

1. Asegúrate de que el ordenador y el iPhone estén conectados a la **misma red Wi-Fi**.
2. Abre la app en el ordenador y dirígete a la pestaña **Ajustes** para ver tu dirección IP local (por ejemplo `http://192.168.1.45:3000`).
3. Abre **Safari** en tu iPhone e introduce esa URL.
4. Pulsa el botón **Compartir** (icono de cuadrado con flecha hacia arriba en la barra inferior de Safari).
5. Desliza hacia abajo y pulsa **"Añadir a pantalla de inicio"**.
6. Se creará el icono de **OmniStream** en tu pantalla de inicio, abriéndose como app nativa independiente, con soporte de reproducción en segundo plano y AirPlay.

---

## 🔑 Configuración de la Clave Gratuita de TMDB

El catálogo funciona inmediatamente sin clave mediante el proveedor público **Cinemeta**. Si deseas vincular la API oficial de The Movie Database (TMDB) para acceder a estrenos mundiales y búsquedas en español:

1. Crea una cuenta gratuita en [The Movie Database (TMDB)](https://www.themoviedb.org/signup).
2. Ve a **Ajustes** -> **API** ([https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)) y solicita una clave de API (elige la opción "Personal / Estudiante"). La aprobación es instantánea y 100% gratuita.
3. Copia tu clave API (v3 auth) y pégala en el archivo `.env` del proyecto:
```env
TMDB_API_KEY=tu_clave_api_aqui
```
4. Guarda el archivo `.env` y el backend la cargará automáticamente.

---

## ⚙️ Configuración y Recarga en Caliente (`sources.yaml`)

Las fuentes se declaran en `sources.yaml`. Puedes editar el archivo en cualquier momento para añadir tus propias listas M3U o canales personalizados:

```yaml
sources:
  - id: "mi-lista-privada"
    name: "Mi Lista Personalizada"
    type: "m3u"
    category: "live"
    url: "https://ejemplo.com/lista.m3u"
    enabled: true
    priority: 1
    headers:
      User-Agent: "MiCliente/1.0"
      Referer: "https://ejemplo.com/"
```

Una vez editado el archivo, ve a **Ajustes** o **Estado de Fuentes** en la aplicación y pulsa **"Recargar YAML"**. El sistema actualizará las fuentes en memoria **sin necesidad de reiniciar el servidor**.

---

## 🧪 Ejecución de Tests Unitarios

El proyecto cuenta con una batería de tests unitarios que verifican el normalizador M3U, los adaptadores de contenido, la detección de deportes y el proxy:

```bash
npm test
```

---

## 📦 Empaquetado de Escritorio con Tauri (macOS y Windows)

La aplicación utiliza **Tauri** en lugar de Electron para lograr ejecutables ligeros (<40 MB de RAM y binarios compactos).

### En macOS:
1. Asegúrate de tener instalado Rust (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).
2. Compila el binario nativo (`.app` y `.dmg`):
```bash
npm run desktop:build
```
El instalador se generará en `src-tauri/target/release/bundle/dmg/`.

### En Windows:
1. Instala Rust y las herramientas de compilación de C++ (Visual Studio Build Tools con la carga de trabajo "Desarrollo para el escritorio con C++").
2. Asegúrate de tener instalado el WebView2 Runtime (incluido por defecto en Windows 10 y 11).
3. Ejecuta en PowerShell:
```cmd
npm run desktop:build
```
El instalador `.msi` y el ejecutable `.exe` se generarán en `src-tauri\target\release\bundle\msi\`.

---

## 📂 Estructura del Proyecto

```
iptv futbol/
├── sources.yaml            # Configuración declarativa de fuentes con recarga en caliente
├── .env.example            # Plantilla de variables de entorno (puerto, TMDB, salud)
├── .env                    # Configuración activa del entorno local
├── package.json            # Scripts de arranque unificado y dependencias
├── ARQUITECTURA.md         # Documento técnico detallado con diagramas para el TFG
├── LEGAL.md                # Encuadre jurídico, jurisprudencia TJUE y LSSI-CE
├── README.md               # Este documento
├── data/
│   └── app.db              # Base de datos SQLite (favoritos, historial, salud)
├── logs/
│   └── app.log             # Registro rotativo de eventos y depuración
├── server/
│   ├── index.js            # Servidor Express y arranque de subsistemas
│   ├── config.js           # Variables y rutas absolutas
│   ├── logger.js           # Logger con rotación de ficheros y modo debug
│   ├── db.js               # Conexión SQLite WAL y operaciones CRUD
│   ├── proxy.js            # Proxy inverso HLS/Range/CORS con reescritura M3U8
│   ├── health.js           # Comprobador de salud periódico y semáforos
│   ├── m3uParser.js        # Parser y normalizador robusto de listas M3U/EXTINF
│   ├── sources/            # Módulos del Patrón Adaptadores
│   │   ├── BaseAdapter.js
│   │   ├── IptvOrgAdapter.js
│   │   ├── TdtChannelsAdapter.js
│   │   ├── SportsEventAdapter.js
│   │   ├── CinemetaVodAdapter.js
│   │   ├── StremioResolverAdapter.js
│   │   ├── CustomM3uAdapter.js
│   │   └── index.js
│   └── routes/             # Controladores REST API
│       ├── live.js
│       ├── vod.js
│       ├── search.js
│       ├── user.js
│       ├── proxy.js
│       └── settings.js
├── client/                 # Aplicación Frontend React 18 + Vite (Dark Theme)
│   ├── index.html          # Entrada HTML5 con meta tags PWA y Safari
│   ├── vite.config.js      # Configuración de proxy y puerto 3000
│   ├── public/
│   │   ├── manifest.webmanifest # Manifiesto PWA
│   │   ├── sw.js           # Service Worker para caché offline
│   │   └── icons/          # Iconos de la aplicación
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── services/api.js # Cliente HTTP con la API del servidor
│       └── components/
│           ├── Navbar.jsx
│           ├── HomeView.jsx
│           ├── LiveView.jsx
│           ├── VodView.jsx
│           ├── SearchView.jsx
│           ├── FavoritesView.jsx
│           ├── HealthModal.jsx
│           ├── SettingsView.jsx
│           ├── ItemDetailModal.jsx
│           ├── Player.jsx  # Reproductor HLS.js con PiP, AirPlay y Failover
│           └── Toast.jsx
├── src-tauri/              # Configuración de empaquetado nativo con Tauri
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/main.rs
└── tests/                  # Tests unitarios con el test runner nativo de Node.js
    ├── m3uParser.test.js
    ├── adapters.test.js
    └── proxy.test.js
```

---

## 📜 Licencia y Advertencia Académica
Este software ha sido creado exclusivamente con propósitos educativos y de investigación en arquitecturas OTT. Consulta [LEGAL.md](LEGAL.md) para más detalles sobre intermediación técnica y propiedad intelectual.
