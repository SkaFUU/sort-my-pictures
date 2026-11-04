// Lokale Gesichtserkennung mit ONNX Runtime Web. Modelle und Laufzeit sind eingebettet, nichts geht ins Internet.
//   YuNet (MIT)       findet Gesichter und 5 Merkpunkte (Augen, Nase, Mundwinkel)
//   SFace (Apache 2)  berechnet aus dem ausgerichteten Gesicht 128 Merkmale zum Wiedererkennen
// Gerechnet wird in mehreren Web Workern gleichzeitig (ein Prozessorkern je Worker, WebAssembly).
const Faces = (() => {
  const VERSION = 2;  // 1 = face-api (alt), 2 = YuNet + SFace

  // ---------- Dieser Teil laeuft im Worker (wird als Text in einen Blob kopiert) ----------
  function workerMain() {
    const MAX_SIDE = 1024;      // Bild fuer die Suche verkleinern
    const SMALL_SIDE = 448;     // zweiter Durchgang fuer sehr grosse Gesichter (YuNet findet etwa 10–300 px)
    const SCORE = 0.75, NMS_IOU = 0.3;
    const CROP = 72;            // Groesse der gespeicherten Gesichtsausschnitte
    // Zielpunkte der Ausrichtung auf 112×112 (ArcFace-Vorlage)
    const TEMPLATE = [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]];
    let det, rec;

    // Canvas -> Tensor [1,3,H,W] mit Werten 0..255
    function tensor(ctx, w, h, bgr) {
      const px = ctx.getImageData(0, 0, w, h).data, n = w * h;
      const f = new Float32Array(3 * n);
      const [r, b] = bgr ? [2, 0] : [0, 2];
      for (let i = 0; i < n; i++) {
        f[r * n + i] = px[i * 4];
        f[n + i] = px[i * 4 + 1];
        f[b * n + i] = px[i * 4 + 2];
      }
      return new ort.Tensor('float32', f, [1, 3, h, w]);
    }
    const iou = (a, b) => {
      const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
      const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
      const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      return i / (a.w * a.h + b.w * b.h - i);
    };
    const nms = list => {
      list.sort((a, b) => b.score - a.score);
      const keep = [];
      for (const d of list) if (keep.every(k => iou(k, d) < NMS_IOU)) keep.push(d);
      return keep;
    };

    // YuNet auf dem Bild (verkleinert auf w×h, Seiten auf Vielfache von 32 aufgefuellt); f rechnet in Bildkoordinaten um
    async function runDetector(src, w, h, f) {
      const W = Math.ceil(w / 32) * 32, H = Math.ceil(h / 32) * 32;
      const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
      ctx.drawImage(src, 0, 0, w, h);
      const out = await det.run({ [det.inputNames[0]]: tensor(ctx, W, H, true) });
      const found = [];
      for (const s of [8, 16, 32]) {
        const cls = out['cls_' + s].data, obj = out['obj_' + s].data, box = out['bbox_' + s].data, kps = out['kps_' + s].data;
        const cols = W / s;
        for (let i = 0; i < cls.length; i++) {
          const score = Math.sqrt(Math.min(1, Math.max(0, cls[i])) * Math.min(1, Math.max(0, obj[i])));
          if (score < SCORE) continue;
          const r = Math.floor(i / cols), c = i % cols;
          const cx = (c + box[i * 4]) * s, cy = (r + box[i * 4 + 1]) * s;
          const bw = Math.exp(box[i * 4 + 2]) * s, bh = Math.exp(box[i * 4 + 3]) * s;
          const pts = [];
          for (let k = 0; k < 5; k++) pts.push([(kps[i * 10 + 2 * k] + c) * s * f, (kps[i * 10 + 2 * k + 1] + r) * s * f]);
          found.push({ x: (cx - bw / 2) * f, y: (cy - bh / 2) * f, w: bw * f, h: bh * f, score, pts });
        }
      }
      return found;
    }

    // Aehnlichkeitstransformation (Drehung, Skalierung, Verschiebung), die die Merkpunkte auf die Vorlage legt
    function similarity(pts) {
      const n = pts.length;
      let sx = 0, sy = 0, dx = 0, dy = 0;
      for (let i = 0; i < n; i++) { sx += pts[i][0]; sy += pts[i][1]; dx += TEMPLATE[i][0]; dy += TEMPLATE[i][1]; }
      sx /= n; sy /= n; dx /= n; dy /= n;
      let num1 = 0, num2 = 0, den = 0;
      for (let i = 0; i < n; i++) {
        const px = pts[i][0] - sx, py = pts[i][1] - sy, qx = TEMPLATE[i][0] - dx, qy = TEMPLATE[i][1] - dy;
        num1 += px * qx + py * qy; num2 += px * qy - py * qx; den += px * px + py * py;
      }
      const a = num1 / den, b = num2 / den;
      return [a, b, -b, a, dx - (a * sx - b * sy), dy - (b * sx + a * sy)];
    }

    // -> [{ box: [x, y, w, h] relativ 0..1, d: Float32Array(128) normiert, crop: dataURL, q: Qualitaet 0..1 }]
    async function detect(file, minSize) {
      // Schon beim Entpacken verkleinern, das ist deutlich schneller als das volle Bild zu dekodieren
      let bmp;
      try { bmp = await createImageBitmap(file, { resizeWidth: MAX_SIDE, resizeQuality: 'medium' }); }
      catch { bmp = await createImageBitmap(file); }
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
      const img = new OffscreenCanvas(w, h);
      img.getContext('2d').drawImage(bmp, 0, 0, w, h);
      bmp.close();

      let found = await runDetector(img, w, h, 1);
      const k = SMALL_SIDE / Math.max(w, h);
      if (k < 0.8) found = found.concat(await runDetector(img, Math.round(w * k), Math.round(h * k), 1 / k));
      found = nms(found);

      const out = [];
      const actx = new OffscreenCanvas(112, 112).getContext('2d', { willReadFrequently: true });
      const crop = new OffscreenCanvas(CROP, CROP), cctx = crop.getContext('2d');
      for (const f of found) {
        if (Math.min(f.w, f.h) < minSize * w / 1280) continue;  // Mindestgroesse bezogen auf 1280 px Bildbreite
        actx.setTransform(1, 0, 0, 1, 0, 0);
        actx.fillStyle = '#000'; actx.fillRect(0, 0, 112, 112);
        actx.setTransform(...similarity(f.pts));
        actx.drawImage(img, 0, 0);
        const r = await rec.run({ [rec.inputNames[0]]: tensor(actx, 112, 112, false) });
        const v = new Float32Array(r[rec.outputNames[0]].data);
        let norm = 0;
        for (const x of v) norm += x * x;
        norm = Math.sqrt(norm) || 1;
        for (let i = 0; i < v.length; i++) v[i] /= norm;

        // Ausschnitt etwas groesser als die Box, quadratisch
        const side = Math.max(f.w, f.h) * 1.3, cx = f.x + f.w / 2, cy = f.y + f.h / 2;
        cctx.fillStyle = '#ddd'; cctx.fillRect(0, 0, CROP, CROP);
        cctx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, CROP, CROP);
        // Qualitaet: Sicherheit, Groesse; seitliche Gesichter (Nase weit weg von der Augenmitte) zaehlen weniger
        const eye = Math.hypot(f.pts[1][0] - f.pts[0][0], f.pts[1][1] - f.pts[0][1]) || 1;
        const off = Math.abs(f.pts[2][0] - (f.pts[0][0] + f.pts[1][0]) / 2) / eye;
        out.push({
          box: [f.x / w, f.y / h, f.w / w, f.h / h],
          d: v,
          crop: new FileReaderSync().readAsDataURL(await crop.convertToBlob({ type: 'image/jpeg', quality: 0.75 })),
          q: +(f.score * Math.min(1, Math.min(f.w, f.h) / 64) * Math.max(0.2, 1 - off)).toFixed(3),
        });
      }
      return out;
    }

    onmessage = async ({ data: m }) => {
      try {
        if (m.type === 'init') {
          importScripts(m.ortUrl);
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.wasmBinary = m.wasm;
          ort.env.wasm.wasmPaths = { mjs: m.mjsUrl };
          const opt = { executionProviders: ['wasm'], logSeverityLevel: 3 };
          det = await ort.InferenceSession.create(m.yunet, opt);
          rec = await ort.InferenceSession.create(m.sface, opt);
          postMessage({ id: m.id, ok: true });
        } else if (m.type === 'detect') {
          postMessage({ id: m.id, faces: await detect(m.file, m.minSize) });
        }
      } catch (e) { postMessage({ id: m.id, error: String(e?.message || e) }); }
    };
  }

  // ---------- Hauptseite: Worker verwalten ----------
  let ready = null, pool = [], threads = 0;

  async function gunzip(b64) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }

  function spawn(url) {
    const w = new Worker(url);
    const waiting = new Map();
    let seq = 0;
    w.onmessage = ({ data }) => {
      const p = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.error) p.reject(new Error(data.error)); else p.resolve(data);
    };
    w.onerror = e => { for (const p of waiting.values()) p.reject(new Error(e.message || 'Worker-Fehler')); waiting.clear(); };
    const call = (msg, transfer) => new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      w.postMessage({ ...msg, id }, transfer || []);
    });
    return { w, call, busy: false };
  }

  // Laufzeit und Modelle einmalig laden; liefert die Anzahl Worker
  function load() {
    if (!ready) ready = (async () => {
      const [wasm, yunet, sface] = await Promise.all([gunzip(ORT_WASM.wasm), gunzip(FACE_MODELS.yunet), gunzip(FACE_MODELS.sface)]);
      const blobUrl = (t, type = 'text/javascript') => URL.createObjectURL(new Blob([t], { type }));
      const ortUrl = blobUrl(ORT_WASM.js), mjsUrl = blobUrl(ORT_WASM.mjs);
      const url = blobUrl(`(${workerMain})()`);
      // ein Kern bleibt fuer die Oberflaeche und das Laden der Dateien frei
      const n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1));
      const started = await Promise.allSettled(Array.from({ length: n }, async () => {
        const p = spawn(url);
        await p.call({ type: 'init', ortUrl, mjsUrl, wasm, yunet, sface });
        return p;
      }));
      pool = started.filter(r => r.status === 'fulfilled').map(r => r.value);
      started.filter(r => r.status === 'rejected').forEach(r => console.warn('Gesichter-Worker:', r.reason));
      if (!pool.length) throw started[0].reason;
      threads = pool.length;
      return threads;
    })().catch(e => { ready = null; throw e; });
    return ready;
  }

  // Gesichter in einer Datei finden (auf einem freien Worker)
  const freeWaiters = [];
  async function detect(file, s) {
    await load();
    let p = pool.find(x => !x.busy);
    while (!p) { await new Promise(r => freeWaiters.push(r)); p = pool.find(x => !x.busy); }
    p.busy = true;
    try { return (await p.call({ type: 'detect', file, minSize: s.faceMinSize })).faces; }
    finally { p.busy = false; freeWaiters.shift()?.(); }
  }

  const cacheKey = it => `${it.path}|${it.size}|${it.mtime}`;
  const dbKey = rootName => `faces${VERSION}:${rootName}`;

  const boxIou = (a, b) => {
    const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return i / (a[2] * a[3] + b[2] * b[3] - i);
  };

  // Namen von Gesichtern der alten Erkennung auf die neu gefundenen uebertragen (gleiche Stelle im Bild)
  function carryNames(it, oldFaces, newFaces, names) {
    if (!oldFaces?.length) return false;
    const moved = [];
    oldFaces.forEach((o, i) => {
      const id = `${it.path}#${i}`;
      if (!names[id]) return;
      moved.push([o.box, names[id]]);
      delete names[id];
    });
    for (const [b, name] of moved) {
      let best = -1, bestIou = 0.3;
      newFaces.forEach((n, j) => { const v = boxIou(b, n.box); if (v > bestIou) { bestIou = v; best = j; } });
      if (best >= 0) names[`${it.path}#${best}`] = name;
    }
    return moved.length > 0;
  }

  // Alle Fotos analysieren; bereits analysierte kommen aus dem Cache. Mehrere Fotos laufen gleichzeitig.
  // names wird angepasst, wenn Fotos aus der alten Erkennung neu analysiert werden.
  async function scanAll(items, rootName, s, names, onProgress, signal) {
    const n = await load();
    let cache = {}, old = {};
    try { cache = (await Util.idb.get(dbKey(rootName))) || {}; } catch { /* ohne Cache */ }
    try { old = (await Util.idb.get('faces:' + rootName)) || {}; } catch { /* keine alten Daten */ }
    const photos = items.filter(i => !i.isVideo);
    const todo = photos.filter(it => !cache[cacheKey(it)]);
    let done = photos.length - todo.length, found = 0, errors = 0, sinceSave = 0, namesChanged = false, fatal = null;
    for (const it of photos) found += cache[cacheKey(it)]?.length || 0;
    const t0 = Date.now();
    let fresh = 0;
    const report = () => onProgress?.({ done, total: photos.length, found, errors, secs: (Date.now() - t0) / 1000, fresh, threads: n });
    report();

    let next = 0;
    const lane = async () => {
      while (next < todo.length && !signal?.aborted && !fatal) {
        const it = todo[next++];
        const k = cacheKey(it);
        try { cache[k] = await detect(await Phone.full(await it.handle.getFile()), s); }
        catch (e) { if (e.name === 'PhoneError') { fatal = e; return; } cache[k] = []; errors++; }
        if (carryNames(it, old[k], cache[k], names)) namesChanged = true;
        found += cache[k].length;
        done++; fresh++;
        if (++sinceSave >= 50) { sinceSave = 0; Util.idb.set(dbKey(rootName), cache).catch(() => {}); }
        if (fresh % 4 === 0) report();
      }
    };
    // etwas mehr Laeufe als Worker, damit das Lesen der naechsten Datei die Rechnung ueberlappt
    await Promise.all(Array.from({ length: n + 1 }, lane));
    report();
    await Util.idb.set(dbKey(rootName), cache).catch(() => {});
    if (fatal) throw fatal;
    return { cache, namesChanged };
  }

  async function loadCache(rootName) {
    try { return (await Util.idb.get(dbKey(rootName))) || null; } catch { return null; }
  }

  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const unit = v => { const n = Math.sqrt(dot(v, v)) || 1; return v.map(x => x / n); };

  // Gesichter gruppieren. names: { faceId: 'Name' | '#ignore' }; threshold: Abstand 1 − Kosinus (klein = streng)
  // 1. Benannte Gesichter bilden feste Gruppen.
  // 2. Die uebrigen werden nach Qualitaet sortiert (gute, frontale Gesichter zuerst) der aehnlichsten Gruppe
  //    zugeordnet oder bilden eine neue.
  // 3. Zwei Runden Nachsortieren: jedes automatische Gesicht wandert zur jetzt aehnlichsten Gruppe.
  function cluster(items, cache, names, threshold) {
    const all = [];
    for (const it of items) {
      if (it.isVideo) continue;
      const faces = cache[cacheKey(it)];
      if (!faces) continue;
      faces.forEach((f, i) => all.push({ id: `${it.path}#${i}`, item: it, ...f }));
    }
    const minSim = 1 - threshold;
    const groups = [];
    const byName = new Map();
    const newGroup = name => { const g = { name, fixed: [], members: [], c: null }; groups.push(g); return g; };
    const centre = g => {
      const sum = new Float32Array(128);
      for (const f of g.fixed.concat(g.members)) { const w = f.q ?? 1; for (let i = 0; i < 128; i++) sum[i] += f.d[i] * w; }
      g.c = unit(sum);
    };
    const best = f => {
      let b = null, bs = minSim;
      for (const g of groups) { if (!g.c) continue; const v = dot(f.d, g.c); if (v > bs) { bs = v; b = g; } }
      return [b, bs];
    };

    for (const f of all) {
      const n = names[f.id];
      if (!n || n === '#ignore') continue;
      if (!byName.has(n)) byName.set(n, newGroup(n));
      byName.get(n).fixed.push(f);
    }
    groups.forEach(centre);
    const free = all.filter(f => !names[f.id]).sort((a, b) => (b.q ?? 1) - (a.q ?? 1));
    for (const f of free) {
      const [g] = best(f);
      const t = g || newGroup(null);
      t.members.push(f);
      if (!g || t.members.length + t.fixed.length <= 20) centre(t);  // Mittelpunkt anfangs laufend nachfuehren
    }
    for (let round = 0; round < 2; round++) {
      groups.forEach(centre);
      for (const g of groups) g.members = [];
      for (const f of free) { const [g] = best(f); (g || newGroup(null)).members.push(f); }
      for (let i = groups.length - 1; i >= 0; i--) if (!groups[i].name && !groups[i].members.length) groups.splice(i, 1);
    }
    groups.forEach(centre);
    for (const g of groups) {
      for (const f of g.members) f.sim = dot(f.d, g.c);
      g.members.sort((a, b) => b.sim - a.sim);  // sicherste zuerst
      g.faces = [...g.fixed.map(f => ({ ...f, auto: false })), ...g.members.map(f => ({ ...f, auto: true }))];
    }
    groups.sort((a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0) || b.faces.length - a.faces.length);
    groups.forEach((g, i) => { g.id = g.name ? 'n:' + g.name : 'c' + i; g.photos = new Set(g.faces.map(f => f.item.id)).size; });

    // Personen je Bild (nur benannte Gruppen)
    const byItem = new Map();
    for (const g of groups) {
      if (!g.name) continue;
      for (const f of g.faces) {
        if (!byItem.has(f.item.id)) byItem.set(f.item.id, new Set());
        byItem.get(f.item.id).add(g.name);
      }
    }
    return { groups, byItem, faceCount: all.length, ignored: all.filter(f => names[f.id] === '#ignore').length };
  }

  // Gesichter eines Bildes (fuer die Bildansicht)
  const facesOf = (it, cache) => (cache && cache[cacheKey(it)]) || [];

  return { VERSION, load, detect, scanAll, loadCache, cluster, facesOf };
})();
