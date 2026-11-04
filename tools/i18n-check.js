// Prueft, ob es fuer alle deutschen Texte eine englische Uebersetzung gibt.
// Aufruf: node tools/i18n-check.js [--list]   (--list gibt fehlende Texte als JSON aus)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = path.join(__dirname, '..', 'src');
const keys = new Set();
const add = s => { if (s && /[A-Za-zÄÖÜäöüß]/.test(s)) keys.add(s.trim()); };

// 1. T('…') in den Skripten (auch mehrere Literale in einem Ausdruck: T(a ? '…' : '…'))
const unq = s => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
for (const f of fs.readdirSync(path.join(src, 'js'))) {
  const code = fs.readFileSync(path.join(src, 'js', f), 'utf8');
  for (const m of code.matchAll(/\bT\(\s*((?:'(?:[^'\\]|\\.)*'\s*(?:[,)?:]|$)|[^)'"]*\?\s*'(?:[^'\\]|\\.)*'\s*:\s*'(?:[^'\\]|\\.)*'))/g)) {
    for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) add(unq(s[1]));
  }
}

// 2. Texte aus Schemas und Tabellen, die per T(variable) uebersetzt werden
const ctx = { I18n: { lang: 'de' }, structuredClone, console, localStorage: { getItem: () => null }, navigator: { language: 'de' }, T: s => s };
vm.createContext(ctx);
const load = f => vm.runInContext(fs.readFileSync(path.join(src, 'js', f), 'utf8').replace(/^const (\w+) =/m, 'var $1 ='), ctx);
['util.js', 'settings.js', 'analyze.js'].forEach(load);
for (const sec of ctx.Settings.SCHEMA) {
  add(sec.section);
  for (const it of sec.items) { add(it.label); add(it.help); (it.options || []).forEach(o => add(o[1])); }
}
for (const p of ctx.Settings.CAT_PRESETS) add(p.name);
for (const k of ctx.Analyze.BUILTIN) { add(k.label); add(k.plural); }
const app = fs.readFileSync(path.join(src, 'js', 'app.js'), 'utf8');
const lit = (re, file = app) => { const m = file.match(re); if (m) for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) add(unq(s[1])); };
lit(/const RIBBON_LABELS = \{([\s\S]*?)\};/);
lit(/const names = \{([^}]*)\}/);
lit(/const CAT_FROM = \[([\s\S]*?)\];/);
lit(/const CAT_WEEK = \[([\s\S]*?)\];/);
lit(/const PHONE_SHORTCUTS = \[([\s\S]*?)\];/);
lit(/\['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'\]/.test(app) ? /(\['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'\])/ : /$^/);
lit(/\{ (weekend: 'mit Wochenende'[^}]*)\}/, fs.readFileSync(path.join(src, 'js', 'analyze.js'), 'utf8'));
lit(/const ZONE_LABELS = \{([^}]*)\}/, fs.readFileSync(path.join(src, 'js', 'map.js'), 'utf8'));
lit(/const NONE = \{([^}]*)\}/, fs.readFileSync(path.join(src, 'js', 'analyze.js'), 'utf8'));
// Herkunft des Datums (it.dateSrc)
lit(/(src: utc \? 'Dateiname \(UTC\)' : 'Dateiname'[\s\S]*?'Änderungsdatum')/, fs.readFileSync(path.join(src, 'js', 'metadata.js'), 'utf8'));

// 3. Statisches HTML: Textknoten, title/placeholder, data-i18n-html
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg width="0"[\s\S]*?<\/svg>/g, '');
html = html.replace(/<(\w+)([^>]*)\sdata-i18n-html([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, a, b, inner) => { add(inner.trim()); return `<${tag}${a}${b}></${tag}>`; });
html = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
for (const m of html.matchAll(/\s(?:title|placeholder)="([^"]*)"/g)) add(m[1].replace(/&amp;/g, '&'));
for (const m of html.replace(/<[^>]+>/g, '\n').split('\n')) add(m.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' '));

// Kennungen, Pfade und Woerter, die in beiden Sprachen gleich sind
const SAME = ['EXIF', 'PXL_', 'DE', 'EN', 'English', 'Deutsch', 'Enter', 'WhatsApp', 'DCIM', 'DCIM/Camera', 'Movies', 'Pictures',
  'Android/media/com.whatsapp/WhatsApp/Media', 'Filter', 'optional', 'Zone', 'Sort My Pictures',
  'vac', 'trip', 'work', 'none', 'any', 'weekend', 'onlyweekend', 'workdays'];
for (const k of [...keys]) if (SAME.includes(k) || /^(#|i-)/.test(k)) keys.delete(k);

// Vergleich
vm.runInContext(fs.readFileSync(path.join(src, 'js', 'i18n.js'), 'utf8').replace(/^const I18n =/m, 'var I18n =').replace(/^const T =.*$/m, ''), ctx);
const EN = ctx.I18n.EN;
const missing = [...keys].filter(k => !(k in EN)).sort();
const unused = Object.keys(EN).filter(k => !keys.has(k));
if (process.argv.includes('--list')) { console.log(JSON.stringify(missing, null, 1)); process.exit(0); }
console.log(`${keys.size} Texte, ${missing.length} ohne Übersetzung, ${unused.length} Übersetzungen ungenutzt`);
for (const m of missing) console.log('  fehlt:', JSON.stringify(m));
for (const u of unused) console.log('  ungenutzt:', JSON.stringify(u));
process.exit(missing.length ? 1 : 0);
