// Dateien einlesen: Aufnahmedatum und GPS aus EXIF (Fotos) bzw. MP4/MOV-Atomen (Videos)
const Meta = (() => {
  const PHOTO = ['jpg', 'jpeg', 'heic', 'heif', 'png', 'tif', 'tiff', 'dng', 'webp'];
  const VIDEO = ['mp4', 'mov', 'm4v', '3gp'];

  // Ordner rekursiv auflisten
  async function listFiles(dirHandle, { recursive, exts }, onProgress) {
    const out = [];
    async function walk(dir, prefix) {
      for await (const [name, h] of dir.entries()) {
        if (h.kind === 'directory') {
          if (recursive) await walk(h, prefix + name + '/');
          continue;
        }
        const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
        if (!exts.includes(ext)) continue;
        out.push({ path: prefix + name, name, ext, handle: h });
        if (out.length % 200 === 0) onProgress?.(out.length);
      }
    }
    await walk(dirHandle, '');
    return out;
  }

  // ---------- Videos: Atome bis "moov" durchgehen und darin suchen ----------
  async function readBytes(file, start, len) {
    return new Uint8Array(await file.slice(start, start + len).arrayBuffer());
  }

  async function findMoov(file) {
    let pos = 0;
    while (pos + 8 <= file.size) {
      const h = await readBytes(file, pos, 16);
      const dv = new DataView(h.buffer);
      let size = dv.getUint32(0);
      const type = String.fromCharCode(h[4], h[5], h[6], h[7]);
      let hdr = 8;
      if (size === 1) { size = Number(dv.getBigUint64(8)); hdr = 16; }
      else if (size === 0) size = file.size - pos;
      if (size < hdr) return null;
      if (type === 'moov') return [pos, size];
      pos += size;
    }
    return null;
  }

  async function videoMeta(file) {
    const r = {};
    const moov = await findMoov(file);
    if (!moov || moov[1] > 64e6) return r;
    const bytes = await readBytes(file, moov[0], moov[1]);
    const txt = new TextDecoder('latin1').decode(bytes);

    // GPS: Android "©xyz" oder Apple "ISO6709"
    let m = /\xA9xyz[\s\S]{4}([+-]\d{1,2}\.\d+)([+-]\d{1,3}\.\d+)/.exec(txt)
      || /ISO6709[\s\S]{0,40}?([+-]\d{1,2}\.\d+)([+-]\d{1,3}\.\d+)/.exec(txt);
    if (m) { r.lat = parseFloat(m[1]); r.lon = parseFloat(m[2]); }

    // Datum: Apple creationdate (mit Zeitzone) oder mvhd (UTC, Sekunden seit 1904)
    m = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:?\d{2})/.exec(txt);
    if (m) {
      const d = new Date(m[1].replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
      if (!isNaN(d)) r.metaDate = d.getTime();
    }
    const i = txt.indexOf('mvhd');
    if (!r.metaDate && i > 0) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset + i + 4);
      const secs = dv.getUint8(0) === 1 ? Number(dv.getBigUint64(4)) : dv.getUint32(4);
      const ms = (secs - 2082844800) * 1000;
      if (secs > 0 && ms > Date.UTC(2000, 0, 1)) r.metaDate = ms;
    }
    return r;
  }

  // ---------- Fotos ----------
  async function photoMeta(file) {
    const r = {};
    try {
      const x = await exifr.parse(file, {
        tiff: true, exif: true, gps: true, ifd1: false, interop: false,
        xmp: false, icc: false, iptc: false, jfif: false, ihdr: false,
      });
      if (!x) return r;
      const d = x.DateTimeOriginal || x.CreateDate || x.ModifyDate;
      if (d && typeof d.getTime === 'function' && !isNaN(d.getTime())) r.metaDate = d.getTime();
      if (Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && !(x.latitude === 0 && x.longitude === 0)) {
        r.lat = x.latitude; r.lon = x.longitude;
      }
      if (x.Model) r.model = String(x.Model).trim();
      if (x.Make) r.make = String(x.Make).trim();
    } catch { /* keine oder defekte EXIF-Daten */ }
    return r;
  }

  // ---------- Datum aus dem Dateinamen ----------
  function dateFromName(name, utcPrefixes, mtime) {
    const valid = (y, mo, d, h = 0, mi = 0, s = 0) =>
      y >= 1990 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24 && mi < 60 && s < 60;
    const utc = utcPrefixes.some(p => p && name.toUpperCase().startsWith(p.toUpperCase()));
    let m = /(?:^|\D)((?:19|20)\d{2})[-_.]?(\d{2})[-_.]?(\d{2})[-_ T.]?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})/.exec(name);
    if (m) {
      const p = m.slice(1).map(Number);
      if (valid(...p)) {
        const ms = utc ? Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]) : new Date(p[0], p[1] - 1, p[2], p[3], p[4], p[5]).getTime();
        return { date: ms, src: utc ? 'Dateiname (UTC)' : 'Dateiname' };
      }
    }
    m = /(?:^|\D)((?:19|20)\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?:\D|$)/.exec(name);
    if (m) {
      const p = m.slice(1).map(Number);
      if (valid(...p)) {
        // Nur Datum im Namen (z.B. WhatsApp): Uhrzeit vom Aenderungsdatum, falls gleicher Tag
        const t = new Date(mtime);
        const same = t.getFullYear() === p[0] && t.getMonth() === p[1] - 1 && t.getDate() === p[2];
        const d = same ? t : new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
        return { date: d.getTime(), src: 'Dateiname (nur Datum)' };
      }
    }
    return null;
  }

  // Endgueltiges Datum je nach Einstellungen bestimmen
  function resolveDate(item, s) {
    const utcPrefixes = s.utcPrefixes.split(',').map(x => x.trim());
    const fromName = () => dateFromName(item.name, utcPrefixes, item.mtime);
    const fromMeta = () => item.metaDate ? { date: item.metaDate, src: item.isVideo ? 'Video-Metadaten' : 'EXIF' } : null;
    const order = item.isVideo && s.videoDateFromName ? [fromName, fromMeta] : [fromMeta, fromName];
    for (const f of order) { const r = f(); if (r) return r; }
    return { date: item.mtime, src: 'Änderungsdatum' };
  }

  // Alle Dateien lesen (parallel), bereits bekannte aus dem Cache
  async function scan(dirHandle, s, onProgress, signal) {
    const exts = [...(s.includePhotos ? PHOTO : []), ...(s.includeVideos ? VIDEO : [])];
    const files = await listFiles(dirHandle, { recursive: s.recursive, exts }, n => onProgress?.(T('Suche Dateien … {0}', n)));
    const cacheKey = 'cache:' + dirHandle.name;
    let cache = {};
    try { cache = (await Util.idb.get(cacheKey)) || {}; } catch { /* ohne Cache weiter */ }
    const newCache = {};
    const items = [];
    let done = 0, next = 0;

    async function worker() {
      while (next < files.length) {
        if (signal?.aborted) return;
        const f = files[next++];
        const file = await f.handle.getFile();
        const isVideo = VIDEO.includes(f.ext);
        const key = `${f.path}|${file.size}|${file.lastModified}`;
        let meta = cache[key];
        if (!meta) {
          // Vom Handy nur den Dateianfang holen (EXIF steht bei JPEG vorne), HEIC ganz
          const photo = () => (['heic', 'heif'].includes(f.ext) ? Phone.full(file) : Phone.head(file, 128 * 1024));
          try { meta = isVideo ? await videoMeta(file) : await photoMeta(await photo()); } catch (e) { if (e.name === 'PhoneError') throw e; meta = {}; }
        }
        newCache[key] = meta;
        items.push({
          id: f.path, path: f.path, name: f.name, ext: f.ext, handle: f.handle, isVideo,
          size: file.size, mtime: file.lastModified, ...meta,
          hasGps: Number.isFinite(meta.lat),
        });
        if (++done % 25 === 0 || done === files.length) onProgress?.(T('Lese Metadaten … {0} / {1}', done, files.length));
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));
    try { await Util.idb.set(cacheKey, newCache); } catch { /* Cache ist optional */ }
    for (const it of items) applyDate(it, s);
    return items;
  }

  function applyDate(it, s) {
    const r = resolveDate(it, s);
    it.date = new Date(r.date);
    it.dateSrc = r.src;
  }

  return { scan, applyDate, PHOTO, VIDEO };
})();
