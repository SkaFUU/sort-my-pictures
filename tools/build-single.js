// Baut aus src/index.html eine einzelne, eigenstaendige HTML-Datei.
// Aufruf: node tools/build-single.js [ziel.html]   (Standard: dist/sort-my-pictures.html)
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');
const target = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'sort-my-pictures.html'));

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  const css = fs.readFileSync(path.join(src, href), 'utf8');
  return `<style>/* ${href} */\n${css}\n</style>`;
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) => {
  // "</script" im Code wuerde den Block vorzeitig beenden
  const js = fs.readFileSync(path.join(src, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${file} */\n${js}\n</script>`;
});

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, html);
console.log(`${target} (${(fs.statSync(target).size / 1024).toFixed(0)} KB)`);
