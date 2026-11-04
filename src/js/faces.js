// Lokale Gesichtserkennung (face-api / TensorFlow.js). Modelle sind eingebettet, nichts geht ins Internet.
const Faces = (() => {
  let ready = null;
  const MAX_SIDE = 1024;  // Bilder vor der Erkennung verkleinern
  const CROP = 72;        // Groesse der gespeicherten Gesichtsausschnitte

  function b64ToBuffer(b64) {
    const bin = atob(b64);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }

  // Modelle einmalig aus FACE_MODELS laden
  function load() {
    if (!ready) ready = (async () => {
      await faceapi.tf.setBackend('webgl').catch(() => faceapi.tf.setBackend('cpu'));
      await faceapi.tf.ready();
      const nets = {
        tiny_face_detector_model: faceapi.nets.tinyFaceDetector,
        face_landmark_68_tiny_model: faceapi.nets.faceLandmark68TinyNet,
        face_recognition_model: faceapi.nets.faceRecognitionNet,
      };
      for (const [name, net] of Object.entries(nets)) {
        const m = FACE_MODELS[name];
        net.loadFromWeightMap(faceapi.tf.io.decodeWeights(b64ToBuffer(m.data), m.specs));
      }
      return faceapi.tf.getBackend();
    })();
    return ready;
  }

  // Gesichter in einer Datei finden -> [{ box: [x, y, w, h] relativ 0..1, d: Float32Array(128), crop: dataURL }]
  async function detect(file, s) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * scale);
    cv.height = Math.round(bmp.height * scale);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    bmp.close();

    const res = await faceapi
      .detectAllFaces(cv, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptors();

    const out = [];
    const crop = document.createElement('canvas');
    crop.width = crop.height = CROP;
    const cctx = crop.getContext('2d');
    for (const r of res) {
      const b = r.detection.box;
      if (Math.min(b.width, b.height) < s.faceMinSize) continue;
      // Ausschnitt etwas groesser als die Box, quadratisch
      const side = Math.max(b.width, b.height) * 1.3;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      cctx.fillStyle = '#ddd'; cctx.fillRect(0, 0, CROP, CROP);
      cctx.drawImage(cv, cx - side / 2, cy - side / 2, side, side, 0, 0, CROP, CROP);
      out.push({
        box: [b.x / cv.width, b.y / cv.height, b.width / cv.width, b.height / cv.height],
        d: new Float32Array(r.descriptor),
        crop: crop.toDataURL('image/jpeg', 0.75),
      });
    }
    return out;
  }

  const cacheKey = it => `${it.path}|${it.size}|${it.mtime}`;

  // Alle Fotos analysieren; bereits analysierte kommen aus dem Cache
  async function scanAll(items, rootName, s, onProgress, signal) {
    await load();
    const key = 'faces:' + rootName;
    let cache = {};
    try { cache = (await Util.idb.get(key)) || {}; } catch { /* ohne Cache */ }
    const photos = items.filter(i => !i.isVideo);
    let done = 0, found = 0, errors = 0, sinceSave = 0;
    const t0 = Date.now();
    for (const it of photos) {
      if (signal?.aborted) break;
      const k = cacheKey(it);
      if (!cache[k]) {
        try { cache[k] = await detect(await Phone.full(await it.handle.getFile()), s); }
        catch (e) { if (e.name === 'PhoneError') throw e; cache[k] = []; errors++; }
        if (++sinceSave >= 40) { sinceSave = 0; await Util.idb.set(key, cache).catch(() => {}); }
      }
      found += cache[k].length;
      done++;
      if (done % 5 === 0 || done === photos.length) {
        const secs = (Date.now() - t0) / 1000;
        onProgress?.({ done, total: photos.length, found, errors, secs });
      }
    }
    await Util.idb.set(key, cache).catch(() => {});
    return cache;
  }

  async function loadCache(rootName) {
    try { return (await Util.idb.get('faces:' + rootName)) || null; } catch { return null; }
  }

  function dist(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) { const x = a[i] - b[i]; s += x * x; }
    return Math.sqrt(s);
  }

  // Gesichter gruppieren. names: { faceId: 'Name' | '#ignore' }
  // Benannte Gesichter bilden feste Gruppen, unbenannte werden der naechsten Gruppe zugeordnet (oder neue Gruppe).
  function cluster(items, cache, names, threshold) {
    const all = [];
    for (const it of items) {
      if (it.isVideo) continue;
      const faces = cache[cacheKey(it)];
      if (!faces) continue;
      faces.forEach((f, i) => all.push({ id: `${it.path}#${i}`, item: it, ...f }));
    }
    const groups = [];
    const byName = new Map();
    const newGroup = (name) => { const g = { id: name ? 'n:' + name : 'c' + groups.length, name, faces: [], sum: new Float32Array(128), c: null }; groups.push(g); return g; };
    const add = (g, f, auto) => {
      g.faces.push({ ...f, auto });
      for (let i = 0; i < 128; i++) g.sum[i] += f.d[i];
      g.c = g.sum.map(v => v / g.faces.length);
    };

    for (const f of all) {
      const n = names[f.id];
      if (!n || n === '#ignore') continue;
      if (!byName.has(n)) byName.set(n, newGroup(n));
      add(byName.get(n), f, false);
    }
    for (const f of all) {
      if (names[f.id]) continue;
      let best = null, bestD = threshold;
      for (const g of groups) { const d = dist(f.d, g.c); if (d < bestD) { bestD = d; best = g; } }
      add(best || newGroup(null), f, true);
    }
    groups.sort((a, b) => (b.name ? 1 : 0) - (a.name ? 1 : 0) || b.faces.length - a.faces.length);
    groups.forEach((g, i) => { if (!g.name) g.id = 'c' + i; g.photos = new Set(g.faces.map(f => f.item.id)).size; });

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

  return { load, scanAll, loadCache, cluster, facesOf };
})();
