// Kopiert die eingebetteten Bibliotheken aus node_modules nach src/vendor.
// Nur nach `npm install` / Update der Bibliotheken noetig – src/vendor ist eingecheckt.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  ['node_modules/leaflet/dist/leaflet.js', 'src/vendor/leaflet.js'],
  ['node_modules/leaflet/dist/leaflet.css', 'src/vendor/leaflet.css'],
  ['node_modules/leaflet/LICENSE', 'src/vendor/LICENSE-leaflet.txt'],
  ['node_modules/exifr/dist/full.umd.js', 'src/vendor/exifr.js'],
  ['node_modules/exifr/LICENSE', 'src/vendor/LICENSE-exifr.txt'],
];

for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
  console.log(`${from} -> ${to}`);
}

// ONNX Runtime Web (MIT): Skript direkt, die WebAssembly-Laufzeit gzip-komprimiert als Base64,
// damit die HTML-Datei ohne Nachladen funktioniert (auch per file://)
const zlib = require('zlib');
const gz64 = buf => zlib.gzipSync(buf, { level: 9 }).toString('base64');
const ortDist = path.join(root, 'node_modules/onnxruntime-web/dist');
// Alles als Text, weil es in Web Workern laeuft (mehrere Prozessorkerne gleichzeitig)
fs.writeFileSync(path.join(root, 'src/vendor/ort-wasm.js'),
  '// Generiert von tools/vendor.js – onnxruntime-web (MIT): Skript, WebAssembly-Lader, WebAssembly (gzip+Base64)\nconst ORT_WASM = ' + JSON.stringify({
    js: fs.readFileSync(path.join(ortDist, 'ort.wasm.min.js'), 'utf8'),
    mjs: fs.readFileSync(path.join(ortDist, 'ort-wasm-simd-threaded.mjs'), 'utf8'),
    wasm: gz64(fs.readFileSync(path.join(ortDist, 'ort-wasm-simd-threaded.wasm'))),
  }) + ';\n');
console.log('src/vendor/ort-wasm.js', (fs.statSync(path.join(root, 'src/vendor/ort-wasm.js')).size / 1e6).toFixed(1), 'MB');

// Gesichtsmodelle aus dem OpenCV Model Zoo: YuNet (MIT) und SFace (Apache 2.0).
// Werden einmal heruntergeladen (node_modules/.face-onnx) und gzip+Base64 eingebettet.
const ZOO = 'https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/';
const ZOO_RAW = 'https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/';
const MODELS = {
  yunet: 'face_detection_yunet/face_detection_yunet_2026may.onnx',
  sface: 'face_recognition_sface/face_recognition_sface_2021dec_int8bq.onnx',
};
// Minimaler Protobuf-Umbau: Gewichte (initializer) und unbenutzte Namen, die als Graph-Eingang gefuehrt werden, aus
// den Eingaengen entfernen. Sonst verlangt ONNX Runtime Web dafuer Eingabewerte (betrifft SFace).
function stripInitializerInputs(model) {
  const varint = (b, p) => { let v = 0, m = 1, c; do { c = b[p++]; v += (c & 127) * m; m *= 128; } while (c & 128); return [v, p]; };
  const enc = v => { const o = []; do { let c = v % 128; v = Math.floor(v / 128); if (v) c |= 128; o.push(c); } while (v); return Buffer.from(o); };
  const fields = b => {  // -> [{ no, wire, start, end, body }]
    const out = [];
    for (let p = 0; p < b.length;) {
      const start = p;
      let key; [key, p] = varint(b, p);
      const no = Math.floor(key / 8), wire = key & 7;
      let body = null;
      if (wire === 0) [, p] = varint(b, p);
      else if (wire === 1) p += 8;
      else if (wire === 5) p += 4;
      else if (wire === 2) { let len; [len, p] = varint(b, p); body = b.subarray(p, p + len); p += len; }
      else throw new Error('Protobuf: Typ ' + wire);
      out.push({ no, wire, start, end: p, body });
    }
    return out;
  };
  const str = (b, no) => { const f = fields(b).find(x => x.no === no && x.wire === 2); return f ? f.body.toString('utf8') : ''; };
  const lenField = (no, body) => Buffer.concat([enc(no * 8 + 2), enc(body.length), body]);

  const top = fields(model);
  const g = top.find(f => f.no === 7);
  const gf = fields(g.body);
  const inits = new Set(gf.filter(f => f.no === 5).map(f => str(f.body, 8)));
  // von Knoten benutzte Namen (NodeProto.input = Feld 1); unbenutzte Eingaenge bleiben nach der Quantisierung uebrig
  const used = new Set(gf.filter(f => f.no === 1).flatMap(n => fields(n.body).filter(x => x.no === 1).map(x => x.body.toString('utf8'))));
  const kept = gf.filter(f => !(f.no === 11 && (inits.has(str(f.body, 1)) || !used.has(str(f.body, 1)))));
  if (kept.length === gf.length) return model;
  const graph = Buffer.concat(kept.map(f => g.body.subarray(f.start, f.end)));
  return Buffer.concat(top.map(f => f === g ? lenField(7, graph) : model.subarray(f.start, f.end)));
}

(async () => {
  const cache = path.join(root, 'node_modules/.face-onnx');
  fs.mkdirSync(cache, { recursive: true });
  const get = async (url, file) => {
    if (!fs.existsSync(file)) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    return fs.readFileSync(file);
  };
  const out = {};
  for (const [k, p] of Object.entries(MODELS)) out[k] = gz64(stripInitializerInputs(await get(ZOO + p, path.join(cache, path.basename(p)))));
  // das npm-Paket enthaelt keine Lizenzdatei
  fs.writeFileSync(path.join(root, 'src/vendor/LICENSE-onnxruntime.txt'), await get('https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE', path.join(cache, 'LICENSE-onnxruntime')));
  fs.writeFileSync(path.join(root, 'src/vendor/LICENSE-yunet.txt'), await get(ZOO_RAW + 'face_detection_yunet/LICENSE', path.join(cache, 'LICENSE-yunet')));
  fs.writeFileSync(path.join(root, 'src/vendor/LICENSE-sface.txt'), await get(ZOO_RAW + 'face_recognition_sface/LICENSE', path.join(cache, 'LICENSE-sface')));
  fs.writeFileSync(path.join(root, 'src/vendor/face-models.js'),
    '// Generiert von tools/vendor.js – OpenCV Model Zoo: YuNet (MIT), SFace (Apache 2.0), gzip+Base64\nconst FACE_MODELS = ' + JSON.stringify(out) + ';\n');
  console.log('src/vendor/face-models.js', (fs.statSync(path.join(root, 'src/vendor/face-models.js')).size / 1e6).toFixed(1), 'MB');
})().catch(e => { console.error(e); process.exit(1); });
