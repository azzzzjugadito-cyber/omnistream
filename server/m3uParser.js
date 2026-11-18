/**
 * Normalizador y Parser robusto para listas M3U / M3U8
 * Extrae directivas EXTINF, metadatos TVG, directivas EXTVLCOPT y cabeceras por canal.
 */

export function parseM3u(content, defaultCategory = 'General') {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const items = [];
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      // Iniciar nuevo elemento
      currentItem = parseExtInfLine(line, defaultCategory);
    } else if (line.startsWith('#EXTVLCOPT:') && currentItem) {
      // Directivas VLC como http-user-agent o http-referrer
      parseExtVlcOpt(line, currentItem);
    } else if (line.startsWith('#') && currentItem) {
      // Otras directivas de cabeceras en comentario
      if (line.includes('http-user-agent=')) {
        const match = line.match(/http-user-agent=([^\s]+)/i);
        if (match && !currentItem.headers['User-Agent']) {
          currentItem.headers['User-Agent'] = match[1].replace(/["']/g, '');
        }
      }
      if (line.includes('http-referrer=')) {
        const match = line.match(/http-referrer=([^\s]+)/i);
        if (match && !currentItem.headers['Referer']) {
          currentItem.headers['Referer'] = match[1].replace(/["']/g, '');
        }
      }
    } else if (!line.startsWith('#') && currentItem) {
      // Es la URL del stream
      if (line.startsWith('http://') || line.startsWith('https://') || line.startsWith('/')) {
        currentItem.url = line;
        items.push(currentItem);
        currentItem = null;
      }
    }
  }

  return items;
}

function parseExtInfLine(line, defaultCategory) {
  const item = {
    id: '',
    name: 'Canal sin nombre',
    logo: '',
    category: defaultCategory,
    tvgId: '',
    country: '',
    language: '',
    headers: {}
  };

  // Separar metadatos y título por la última coma
  const commaIndex = line.lastIndexOf(',');
  let metaPart = line;
  if (commaIndex !== -1) {
    metaPart = line.substring(0, commaIndex);
    item.name = line.substring(commaIndex + 1).trim() || item.name;
  }

  // Extraer atributos clave="valor" o clave=valor
  const attrRegex = /([a-zA-Z0-9_-]+)=(?:["']([^"']*)["']|([^\s,]+))/g;
  let match;
  while ((match = attrRegex.exec(metaPart)) !== null) {
    const key = match[1].toLowerCase();
    const val = (match[2] !== undefined ? match[2] : match[3] || '').trim();

    switch (key) {
      case 'tvg-id':
        item.tvgId = val;
        break;
      case 'tvg-name':
        if (!item.name || item.name === 'Canal sin nombre') {
          item.name = val;
        }
        break;
      case 'tvg-logo':
        item.logo = val;
        break;
      case 'tvg-country':
        item.country = val;
        break;
      case 'tvg-language':
        item.language = val;
        break;
      case 'group-title':
        if (val) item.category = val;
        break;
      case 'http-referrer':
        item.headers['Referer'] = val;
        break;
      case 'http-user-agent':
        item.headers['User-Agent'] = val;
        break;
    }
  }

  // Si no hay country explícito, intentar inferir del sufijo del tvgId (ej: BarcaTV.es -> ES, SkySports.uk -> UK)
  if (!item.country && item.tvgId && item.tvgId.includes('.')) {
    const parts = item.tvgId.split('.');
    const suffix = parts[parts.length - 1].toUpperCase();
    if (suffix.length === 2 || suffix === 'USA' || suffix === 'MENA' || suffix === 'LATAM') {
      item.country = suffix;
    }
  }

  // Generar ID único normalizado
  item.id = (item.tvgId || item.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `ch-${Math.random().toString(36).substring(2, 9)}`;

  return item;
}

function parseExtVlcOpt(line, currentItem) {
  const opt = line.substring('#EXTVLCOPT:'.length).trim();
  const equalsIndex = opt.indexOf('=');
  if (equalsIndex !== -1) {
    const key = opt.substring(0, equalsIndex).trim().toLowerCase();
    const val = opt.substring(equalsIndex + 1).trim();

    if (key === 'http-referrer') {
      currentItem.headers['Referer'] = val;
    } else if (key === 'http-user-agent') {
      currentItem.headers['User-Agent'] = val;
    } else if (key.startsWith('http-')) {
      const headerName = key.substring(5);
      currentItem.headers[headerName] = val;
    }
  }
}
