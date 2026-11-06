// Ordnerbaum in Schritt 1: einmal ein Laufwerk oder einen Hauptordner freigeben, dann im Programm durch die Unterordner
// blaettern und per Klick die Quelle waehlen (ohne jedes Mal das Windows-Ordnerfenster). Ordner, zu denen es schon einen
// gespeicherten Stand gibt (im Browser oder als _sortmypictures.json), sind markiert.
const FolderTree = (() => {
  const { h } = Util;
  const ROOT_KEY = 'rootHandle', OPEN_KEY = 'fotosortierer.treeOpen';
  const SKIP = /^(\$|\.|System Volume Information$|_fotos$|_photos$|_karte$|_map$|@eaDir$|#recycle$)/i;
  let app, root = null, access = false;
  const kids = new Map();      // Pfad -> [{ name, handle }] (einmal gelesen, „Neu laden“ leert)
  const hasState = new Set();  // Pfade mit _sortmypictures.json
  let known = new Set();       // Pfade mit gespeichertem Stand im Browser
  let open = new Set();
  try { open = new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[""]')); } catch { /* leer */ }  // Hauptordner anfangs offen
  const saveOpen = () => localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
  const $ = () => document.getElementById('libTree');

  async function init(appCtx) {
    app = appCtx;
    document.getElementById('btnTree').onclick = focus;
    try { root = (await Util.idb.get(ROOT_KEY)) || null; } catch { root = null; }
    if (root) access = (await root.queryPermission({ mode: 'readwrite' })) === 'granted';
    render();
  }

  async function pickRoot() {
    try {
      root = await showDirectoryPicker({ id: 'fs-root', mode: 'readwrite' });
      await Util.idb.set(ROOT_KEY, root);
      access = true;
      kids.clear(); hasState.clear(); open = new Set(['']); saveOpen();
      render();
    } catch (e) { if (e.name !== 'AbortError') Ask.alert(e.message); }
  }
  async function renew() {
    access = (await root.requestPermission({ mode: 'readwrite' })) === 'granted';
    render();
  }

  // Unterordner lesen (und merken, ob hier schon eine Stand-Datei liegt)
  async function list(dir, path) {
    if (kids.has(path)) return kids.get(path);
    const out = [];
    try {
      for await (const [name, hd] of dir.entries()) {
        if (hd.kind === 'directory' && !SKIP.test(name)) out.push({ name, handle: hd });
        else if (hd.kind === 'file' && name === '_sortmypictures.json') hasState.add(path);
      }
    } catch { /* kein Zugriff */ }
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    kids.set(path, out);
    return out;
  }

  // Ordner mit gespeichertem Stand im Browser (Projektliste) als Pfade unterhalb der Wurzel
  async function knownPaths() {
    const s = new Set();
    let projects = [];
    try { projects = (await Util.idb.get('projects')) || []; } catch { /* leer */ }
    for (const p of projects) {
      try { const r = await root.resolve(p.handle); if (r) s.add(r.join('/')); } catch { /* anderer Ort */ }
    }
    return s;
  }

  let renderToken = 0;
  async function render() {
    const box = $();
    if (!box) return;
    const my = ++renderToken;
    if (!('showDirectoryPicker' in window)) { box.innerHTML = ''; return; }
    if (!root) {
      box.replaceChildren(h('div', { class: 'hint' }, T('Einmal ein Laufwerk oder einen Hauptordner freigeben (z. B. den Ordner mit allen Fotos). Danach lassen sich hier die Unterordner direkt als Quelle wählen.')),
        h('button', { onclick: pickRoot }, T('Laufwerk oder Hauptordner freigeben …')));
      return;
    }
    if (!access) {
      box.replaceChildren(h('div', { class: 'hint' }, T('Zugriff auf „{0}“ muss nach dem Neustart des Browsers einmal bestätigt werden.', root.name)),
        h('div', { class: 'row-btns' }, h('button', { onclick: renew }, T('Zugriff erlauben')), h('button', { onclick: pickRoot }, T('Anderen Ordner …'))));
      return;
    }
    known = await knownPaths();
    let cur = null;
    if (app.st.src) { try { cur = await root.resolve(app.st.src); } catch { cur = null; } }
    const curPath = cur ? cur.join('/') : null;
    const tree = h('div', { class: 'ftree' });
    const row = async (dir, name, path, depth) => {
      const isOpen = open.has(path);
      const sub = isOpen ? await list(dir, path) : null;
      const mark = known.has(path) || hasState.has(path);
      const el = h('div', { class: 'ft-row' + (path === curPath ? ' cur' : ''), style: `padding-left:${4 + depth * 14}px`,
        title: mark ? T('Gespeicherter Stand vorhanden') : '' },
        h('span', { class: 'ft-tw', onclick: e => { e.stopPropagation(); isOpen ? open.delete(path) : open.add(path); saveOpen(); render(); } }, sub && !sub.length ? '' : isOpen ? '▾' : '▸'),
        h('span', { class: 'ft-name' }, name),
        mark ? h('span', { class: 'ft-mark' }, '●') : null);
      el.onclick = () => choose(dir, path);
      tree.append(el);
      if (sub) for (const c of sub) await row(c.handle, c.name, path ? path + '/' + c.name : c.name, depth + 1);
    };
    await row(root, root.name, '', 0);
    if (my !== renderToken) return;
    box.replaceChildren(tree, h('div', { class: 'row-btns' },
      h('button', { class: 'mini', onclick: () => { kids.clear(); hasState.clear(); render(); }, title: T('Ordner neu lesen') }, '⟳ ' + T('Neu laden')),
      h('button', { class: 'mini', onclick: pickRoot }, T('Anderen Hauptordner …'))));
  }

  // Ribbon-Knopf „Ordnerbaum“: ohne Freigabe gleich das Laufwerk waehlen lassen, sonst Seitenleiste zeigen und hinspringen
  async function focus() {
    if (!root) return pickRoot();
    if (document.getElementById('props').classList.contains('hide')) document.getElementById('togProps')?.click();
    if (!access) await renew();
    const box = $();
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
  }

  async function choose(dir, path) {
    if (document.body.classList.contains('busy')) return;
    await app.useSource(dir);
    render();
  }

  return { init, render, focus };
})();
