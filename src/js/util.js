// Allgemeine Hilfsfunktionen
const Util = (() => {
  const MONTHS = {
    'de-AT': ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'de-DE': ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    'en': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  };
  const WEEKDAYS = {
    'de-AT': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    'de-DE': ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    'en': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  };

  const pad = (n, w = 2) => String(n).padStart(w, '0');

  function distKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  // Lokaler Kalendertag als 'YYYY-MM-DD'
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayFromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysBetween = (a, b) => Math.round((dayFromKey(dayKey(b)) - dayFromKey(dayKey(a))) / 864e5);
  const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
  // Deutsch 04.11.2026, Englisch 2026-11-04 (eindeutig fuer UK und US)
  const fmtDate = d => I18n.lang === 'en' ? dayKey(d) : `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const fmtDateTime = d => `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  // Platzhalter fuer ein Datum, optional mit Praefix (z.B. "E" fuer Enddatum)
  function dateTokens(d, lang, prefix = '') {
    return {
      [prefix + 'YYYY']: String(d.getFullYear()),
      [prefix + 'YY']: pad(d.getFullYear() % 100),
      [prefix + 'MM']: pad(d.getMonth() + 1),
      [prefix + 'MMMM']: (MONTHS[lang] || MONTHS['de-AT'])[d.getMonth()],
      [prefix + 'DD']: pad(d.getDate()),
      [prefix + 'WT']: (WEEKDAYS[lang] || WEEKDAYS['de-AT'])[d.getDay()],
      [prefix + 'DOW']: (WEEKDAYS[lang] || WEEKDAYS['de-AT'])[d.getDay()],
      [prefix + 'hh']: pad(d.getHours()),
      [prefix + 'mm']: pad(d.getMinutes()),
      [prefix + 'ss']: pad(d.getSeconds()),
    };
  }

  const fillTemplate = (tpl, tokens) => tpl.replace(/\{([A-Za-z]+)\}/g, (m, k) => (k in tokens ? tokens[k] : m));

  // Ein Ordner- oder Dateiname, der auf Windows, macOS und Linux gueltig ist
  function sanitizeSegment(s) {
    return String(s)
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/, '')
      .trim() || '_';
  }

  // Pfad-Vorlage -> Liste gueltiger Ordnernamen
  const templatePath = (tpl, tokens) =>
    fillTemplate(tpl, tokens).split(/[\\/]+/).map(s => s.trim()).filter(Boolean).map(sanitizeSegment);

  const fmtCoord = (lat, lon) =>
    `${Math.abs(lat).toFixed(2)}${lat >= 0 ? 'N' : 'S'}_${Math.abs(lon).toFixed(2)}${lon >= 0 ? 'E' : 'W'}`;

  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // DOM-Element erzeugen: h('div', { class: 'x', onclick: fn }, kind1, kind2 …)
  function h(tag, attrs = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c);
    return el;
  }

  // Icon aus dem SVG-Sprite in index.html
  function icon(name, cls = 'ic') {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', cls);
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + name);
    s.append(u);
    return s;
  }

  const fmtBytes = b => b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;

  // Minimaler IndexedDB-Schluessel/Wert-Speicher (fuer Index-Cache und Ordner-Handles)
  const idb = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open('fotosortierer', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('kv', mode);
        const req = fn(t.objectStore('kv'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    };
    return {
      get: k => tx('readonly', s => s.get(k)),
      set: (k, v) => tx('readwrite', s => s.put(v, k)),
      del: k => tx('readwrite', s => s.delete(k)),
    };
  })();

  return {
    MONTHS, pad, distKm, dayKey, dayFromKey, addDays, daysBetween, isWeekend, fmtDate, fmtDateTime,
    dateTokens, fillTemplate, sanitizeSegment, templatePath, fmtCoord, escapeHtml, debounce, fmtBytes, idb, h, icon,
  };
})();
