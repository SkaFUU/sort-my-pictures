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
  ['node_modules/@vladmandic/face-api/dist/face-api.js', 'src/vendor/face-api.js'],
  ['node_modules/@vladmandic/face-api/LICENSE', 'src/vendor/LICENSE-face-api.txt'],
];

for (const [from, to] of files) {
  fs.copyFileSync(path.join(root, from), path.join(root, to));
  console.log(`${from} -> ${to}`);
}

// Gesichtsmodelle als JS-Datei einbetten (Manifest + Gewichte als Base64), damit nichts nachgeladen wird
const modelDir = path.join(root, 'node_modules/@vladmandic/face-api/model');
const models = ['tiny_face_detector_model', 'face_landmark_68_tiny_model', 'face_recognition_model'];
const out = {};
for (const m of models) {
  const manifest = JSON.parse(fs.readFileSync(path.join(modelDir, `${m}-weights_manifest.json`), 'utf8'));
  const bins = manifest.flatMap(g => g.paths).map(p => fs.readFileSync(path.join(modelDir, p)));
  out[m] = { specs: manifest.flatMap(g => g.weights), data: Buffer.concat(bins).toString('base64') };
}
fs.writeFileSync(path.join(root, 'src/vendor/face-models.js'),
  '// Generiert von tools/vendor.js – Modelle von @vladmandic/face-api (MIT)\nconst FACE_MODELS = ' + JSON.stringify(out) + ';\n');
console.log('src/vendor/face-models.js', (fs.statSync(path.join(root, 'src/vendor/face-models.js')).size / 1e6).toFixed(1), 'MB');
