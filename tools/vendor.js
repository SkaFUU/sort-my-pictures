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
