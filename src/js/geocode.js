// ONLINE: Ortsnamen ueber OpenStreetMap Nominatim (nur auf Wunsch, pro Ereignis eine Anfrage)
const Geo = (() => {
  const KEY = 'fotosortierer.geocache';
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { cache = {}; }

  const k = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const lookup = (lat, lon) => cache[k(lat, lon)] || null;

  function format(g, s) {
    const tpl = g.country && g.country === s.homeCountry ? s.placeTplHome : s.placeTpl;
    return Util.fillTemplate(tpl, { LAND: g.country || '', STADT: g.town || '', REGION: g.state || '' })
      .replace(/^[_\s-]+|[_\s-]+$/g, '') || 'Unbekannt';
  }

  async function fetchOne(lat, lon, s) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=${s.geocodeZoom}` +
      `&accept-language=${encodeURIComponent(s.geocodeLang)}&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const a = j.address || {};
    return {
      country: a.country || '',
      state: a.state || '',
      town: a.city || a.town || a.village || a.municipality || a.county || a.state || 'Unbekannt',
    };
  }

  // Fehlende Orte nacheinander holen (Nominatim erlaubt max. 1 Anfrage pro Sekunde)
  async function fetchMissing(events, s, onProgress, signal) {
    const todo = events.filter(e => !lookup(e.lat, e.lon));
    let n = 0, errors = 0;
    for (const e of todo) {
      if (signal?.aborted) break;
      onProgress?.(`Ortsnamen (online) … ${++n} / ${todo.length}`);
      try { cache[k(e.lat, e.lon)] = await fetchOne(e.lat, e.lon, s); }
      catch { errors++; }
      localStorage.setItem(KEY, JSON.stringify(cache));
      await new Promise(r => setTimeout(r, 1100));
    }
    return { fetched: n - errors, errors };
  }

  function clear() { cache = {}; localStorage.removeItem(KEY); }
  const size = () => Object.keys(cache).length;

  return { lookup, format, fetchMissing, clear, size };
})();
