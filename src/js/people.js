// Personen-Tab: Gesichtsgruppen benennen, zusammenfuehren (gleicher Name), Gesichter per Drag & Drop verschieben.
// Besondere Namen: '#none' = "Nicht zugeordnet" (bleibt unten liegen, bis es zugewiesen wird), '#ignore' = kein Gesicht.
const People = (() => {
  const { h } = Util;
  const $ = sel => document.querySelector(sel);
  const DONE_KEY = 'fotosortierer.peopleDone';
  let app, expanded = null;
  const sel = new Set();  // ausgewaehlte Gesichter (Strg/Umschalt + Klick, Rahmen)
  let order = [], lastClicked = null;  // Reihenfolge der angezeigten Gesichter (fuer Umschalt+Klick)
  // Feste Reihenfolge der unbenannten Gruppen: eine Gruppe behaelt ihren Platz, solange sie im Wesentlichen
  // dieselben Gesichter enthaelt (sonst wuerde alles nach jeder Zuordnung neu nach Groesse springen)
  const rankOf = new Map();  // Schluessel -> Platz
  let keyOfFace = new Map(); // Gesicht -> Schluessel der letzten Anzeige
  let nextRank = 0;
  function stableOrder(groups) {
    const used = new Set(), next = new Map();
    for (const g of groups) {
      const cnt = new Map();
      for (const f of g.faces) { const k = keyOfFace.get(f.id); if (k && !used.has(k)) cnt.set(k, (cnt.get(k) || 0) + 1); }
      let key = null, n = 0;
      for (const [k, c] of cnt) if (c > n) { n = c; key = k; }
      if (!key || n * 2 < g.faces.length) key = 'g' + nextRank;  // ueberwiegend neue Gesichter = neue Gruppe
      used.add(key);
      if (!rankOf.has(key)) rankOf.set(key, nextRank++);
      g.key = key;
      for (const f of g.faces) next.set(f.id, key);
    }
    keyOfFace = next;
    return [...groups].sort((a, b) => rankOf.get(a.key) - rankOf.get(b.key));
  }
  // Gesichter nach Aufnahmedatum, mit der Jahreszahl als Trenner zwischen den Jahren
  function byYear(faces, make) {
    const out = [];
    let y = null;
    for (const f of [...faces].sort((a, b) => a.t - b.t)) {
      const fy = f.item.date.getFullYear();
      if (fy !== y) { y = fy; out.push(h('div', { class: 'yr' }, h('span', {}, String(fy)))); }
      out.push(make(f));
    }
    return out;
  }
  let done = new Set();
  try { done = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { /* leer */ }
  const saveDone = () => localStorage.setItem(DONE_KEY, JSON.stringify([...done]));

  function init(appCtx) {
    app = appCtx;
    $('#btnFaces').onclick = () => app.scanFaces();
    $('#pplSmall').onchange = render;
    $('#pplHideDone').checked = localStorage.getItem('fotosortierer.peopleHideDone') === '1';
    $('#pplHideDone').onchange = e => { localStorage.setItem('fotosortierer.peopleHideDone', e.target.checked ? '1' : ''); render(); };
    $('#btnFacesReset').onclick = () => {
      if (!confirm(T('Alle Namen und Ausschlüsse der Gesichter löschen? (Die Erkennung selbst bleibt gespeichert.)'))) return;
      done.clear(); saveDone();
      app.setFaceNames(Object.keys(app.st.faceNames), null);
    };
    document.addEventListener('keydown', e => {
      if (app.tab !== 'people' || document.querySelector('.quiz')) return;
      if (e.key === 'Escape' && sel.size && !menu) { sel.clear(); refreshSel(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); app.undoFaceNames(); }
    });
    $('#btnUndoNames').onclick = () => app.undoFaceNames();
    $('#btnRecheck').onclick = recheck;
    $('#btnQuiz').onclick = () => FaceQuiz.open(app);
    $('#btnLearn').onclick = learnPeople;
    $('#btnForget').onclick = forget;
    lasso($('#pplGroups'));
  }

  // Namen setzen und Auswahl leeren
  const assign = (ids, name) => { sel.clear(); closeMenu(); app.setFaceNames(ids, name); };
  const askName = () => (prompt(T('Name der Person:')) || '').trim();
  const refreshSel = () => {
    document.querySelectorAll('#pplGroups .face').forEach(el => el.classList.toggle('sel', sel.has(el.dataset.id)));
    updateSelInfo();
  };

  // ---------- Rechtsklick-Menue: ausgewaehlte Gesichter einer Person zuweisen ----------
  let menu = null;
  function closeMenu() { menu?.remove(); menu = null; }
  function showMenu(x, y) {
    closeMenu();
    const named = app.st.people.groups.filter(g => g.name).sort((a, b) => a.name.localeCompare(b.name));
    const ids = [...sel];
    const inp = h('input', { type: 'text', placeholder: T('Name eintippen …') });
    const list = h('div', { class: 'cm-list' });
    const item = (label, fn, cls = '') => h('button', { class: 'cm-item ' + cls, onclick: fn }, label);
    const fill = () => {
      const q = inp.value.trim(), ql = q.toLowerCase();
      list.innerHTML = '';
      const m = named.filter(g => g.name.toLowerCase().includes(ql))
        .sort((a, b) => (b.name.toLowerCase() === ql) - (a.name.toLowerCase() === ql) || (b.name.toLowerCase().startsWith(ql)) - (a.name.toLowerCase().startsWith(ql)));
      for (const g of m.slice(0, 40)) {
        list.append(item([h('img', { src: g.faces.find(f => !f.auto)?.crop || g.faces[0].crop }), h('b', {}, g.name), h('span', { class: 'hint' }, g.faces.length)],
          () => assign(ids, g.name)));
      }
      if (q && !named.some(g => g.name.toLowerCase() === ql)) list.append(item('+ ' + T('Neue Person „{0}“', q), () => assign(ids, q), 'new'));
      if (!list.children.length) list.append(h('div', { class: 'hint' }, T('Noch keine Personen – Namen eintippen und Enter.')));
    };
    inp.oninput = fill;
    inp.onkeydown = e => {
      if (e.key === 'Enter') list.querySelector('button')?.click();
      if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
    };
    menu = h('div', { class: 'ctxmenu' },
      h('div', { class: 'cm-head' }, T('{0} Gesichter zuweisen an:', ids.length)), inp, list, h('hr'),
      item(T('Nicht zugeordnet'), () => assign(ids, '#none')),
      item(T('Kein Gesicht (ausblenden)'), () => assign(ids, '#ignore')),
      item(T('Auswahl aufheben'), () => { sel.clear(); closeMenu(); refreshSel(); }));
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
    fill();
    inp.focus();
  }
  document.addEventListener('mousedown', e => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);

  // ---------- Lasso: auf freier Flaeche ziehen markiert alle Gesichter im Rechteck (Strg = dazu) ----------
  function lasso(box) {
    box.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('.face, button, input, select, textarea, a, .chip, label')) return;
      if (e.offsetX > e.target.clientWidth) return;  // Bildlaufleiste
      const x0 = e.clientX, y0 = e.clientY, add = e.ctrlKey || e.metaKey || e.shiftKey;
      const base = add ? new Set(sel) : new Set();
      const faces = [...box.querySelectorAll('.face')].map(el => [el, el.getBoundingClientRect()]);
      let rect = null;
      e.preventDefault();
      const move = m => {
        if (!rect && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return;
        if (!rect) { rect = h('div', { class: 'lasso' }); document.body.append(rect); }
        const l = Math.min(x0, m.clientX), t = Math.min(y0, m.clientY), r = Math.max(x0, m.clientX), b = Math.max(y0, m.clientY);
        Object.assign(rect.style, { left: l + 'px', top: t + 'px', width: (r - l) + 'px', height: (b - t) + 'px' });
        sel.clear();
        for (const id of base) sel.add(id);
        for (const [el, fr] of faces) if (fr.right > l && fr.left < r && fr.bottom > t && fr.top < b) sel.add(el.dataset.id);
        refreshSel();
      };
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up); rect?.remove(); };
      addEventListener('mousemove', move);
      addEventListener('mouseup', up);
    });
  }

  // ---------- Erneut pruefen / Personen merken ----------
  let lastCheck = null;  // automatisch zugeordnete je Person beim letzten Pruefen
  const autoCounts = p => new Map(p.groups.filter(g => g.name).map(g => [g.name, g.faces.filter(f => f.auto).length]));
  // Neu rechnen und Auffaelligkeiten unter den bestaetigten Gesichtern zum Nachpruefen anbieten
  function recheck() {
    if (!app.st.people) { alert(T('Zuerst „Gesichter erkennen“.')); return; }
    const before = lastCheck || new Map();
    app.recompute(true);  // ganz neu durchrechnen, nicht an der bisherigen Einteilung festhalten
    const p = app.st.people;
    const after = autoCounts(p);
    let more = 0;
    for (const [n, c] of after) more += Math.max(0, c - (before.get(n) || 0));
    lastCheck = after;
    const sug = p.groups.filter(g => !g.name && g.suggest).length;
    const odd = Faces.anomalies(p);
    app.status(T('Neu geprüft mit {0} bekannten Personen: {1} Gesichter neu zugeordnet (zum Prüfen), {2} Gruppen mit Namensvorschlag, {3} Auffälligkeiten.', after.size, more, sug, odd.length));
    if (odd.length && confirm(T('{0} Auffälligkeiten gefunden (Person zweimal auf einem Foto oder Gesicht passt besser zu einer anderen Person). Jetzt durchgehen?', odd.length))) FaceQuiz.check(app, odd);
    else document.querySelector('#pplGroups .suggest')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  async function learnPeople() {
    const p = app.st.people;
    const named = p ? p.groups.filter(g => g.name && g.faces.some(f => !f.auto)) : [];
    if (!named.length) { alert(T('Noch keine Person mit bestätigten Gesichtern.')); return; }
    if (!confirm(T('Diese Personen merken, damit sie auch in anderen Ordnern und später wiedererkannt werden?\n\n{0}\n\nGespeichert werden nur Gesichtsmerkmale (Zahlen, keine Bilder) und nur in diesem Browser. Je mehr bestätigte Gesichter, desto besser.',
      named.map(g => `${g.name} (${g.faces.filter(f => !f.auto).length})`).join(', ')))) return;
    const r = Faces.learn(p, app.st.faceLib);
    await Faces.saveLib(app.st.faceLib).catch(e => alert(e.message));
    app.recompute();
    app.status(T('{0} Personen gemerkt.', Object.keys(r).length));
  }
  async function forget() {
    const names = Object.keys(app.st.faceLib);
    if (!names.length) { alert(T('Es sind keine Personen gemerkt.')); return; }
    if (!confirm(T('Gemerkte Personen löschen?\n\n{0}\n\nDie Namen in diesem Ordner bleiben erhalten.', names.join(', ')))) return;
    app.st.faceLib = {};
    await Faces.saveLib({}).catch(() => {});
    app.recompute();
  }

  // Ziel fuer Drag & Drop: onDrop(ids) bekommt die gezogenen Gesichter
  function dropTarget(el, onDrop) {
    el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-faces')) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('over'); });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('over');
      document.body.classList.remove('dragging-faces');
      const ids = JSON.parse(e.dataTransfer.getData('application/x-faces') || '[]');
      if (ids.length) onDrop(ids);
    });
    return el;
  }

  // Ein Gesicht: ziehen, Strg+Klick auswaehlen, Klick oeffnet die Bildansicht
  function faceEl(f, list, { group = null, removeTo = '#none', small = false } = {}) {
    order.push(f.id);
    const el = h('div', { class: 'face' + (f.auto && group?.name ? ' auto' : '') + (sel.has(f.id) ? ' sel' : '') + (small ? ' small' : ''), draggable: 'true', 'data-id': f.id },
      h('img', { src: f.crop, draggable: 'false',
        title: f.item.name + (f.auto && group?.name ? ` (${T('automatisch zugeordnet')}, ${Math.round(f.sim * 100)} %)` : '') + '\n' +
          T('Strg+Klick: auswählen · Umschalt+Klick: Bereich · auf freier Fläche ziehen: Rahmen · Rechtsklick: Namen zuweisen') }),
      small ? null : [
        f.auto && group?.name ? h('button', { class: 'ok', title: T('Ja, das ist {0}', group.name), onclick: e => { e.stopPropagation(); assign([f.id], group.name); } }, '✓') : null,
        h('button', { title: removeTo === '#ignore' ? T('Kein Gesicht / endgültig ausblenden') : T('Nicht diese Person – nach „Nicht zugeordnet“'),
          onclick: e => { e.stopPropagation(); assign(sel.has(f.id) ? [...sel] : [f.id], removeTo); } }, '✕')]);
    el.addEventListener('click', e => {
      if (e.shiftKey && lastClicked && order.includes(lastClicked)) {
        // Bereich von zuletzt angeklickt bis hier
        const a = order.indexOf(lastClicked), b = order.indexOf(f.id);
        for (const id of order.slice(Math.min(a, b), Math.max(a, b) + 1)) sel.add(id);
        refreshSel();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        if (sel.has(f.id)) sel.delete(f.id); else sel.add(f.id);
        lastClicked = f.id;
        refreshSel();
        return;
      }
      const items = [...new Set(list.map(x => x.item))].sort((a, b) => a.date - b.date);
      app.openViewer(items, items.indexOf(f.item));
    });
    el.addEventListener('dragstart', e => {
      const ids = sel.has(f.id) ? [...sel] : [f.id];
      e.dataTransfer.setData('application/x-faces', JSON.stringify(ids));
      e.dataTransfer.effectAllowed = 'move';
      document.body.classList.add('dragging-faces');
    });
    el.addEventListener('dragend', () => document.body.classList.remove('dragging-faces'));
    el.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (!sel.has(f.id)) { sel.clear(); sel.add(f.id); lastClicked = f.id; refreshSel(); }
      showMenu(e.clientX, e.clientY);
    });
    return el;
  }

  function updateSelInfo() {
    const el = $('#pplSel');
    if (!el) return;
    el.hidden = !sel.size;
    el.querySelector('span').textContent = T('{0} Gesichter ausgewählt – ziehen oder:', sel.size);
  }

  function render() {
    const box = $('#pplGroups');
    box.innerHTML = '';
    order = [];
    closeMenu();
    const lib = Object.keys(app.st.faceLib || {});
    $('#libInfo').textContent = lib.length ? T('{0} gemerkt', lib.length) : '';
    $('#libInfo').title = lib.join(', ');
    const p = app.st.people;
    if (p && !lastCheck) lastCheck = autoCounts(p);
    const info = $('#pplInfo');
    if (!app.st.items) { info.textContent = T('Zuerst einen Quellordner einlesen.'); return; }
    if (!p && app.st.oldFaces) { info.textContent = T('Die Gesichtserkennung wurde verbessert (neues Modell). Bitte „Gesichter erkennen“ neu starten – vergebene Namen werden auf die neu gefundenen Gesichter übertragen.'); return; }
    if (!p) { info.textContent = T('Noch keine Gesichtserkennung für diesen Ordner. „Gesichter erkennen“ startet sie (lokal, nutzt alle Prozessorkerne, ca. 3–10 min für 5000 Fotos, kann jederzeit abgebrochen und fortgesetzt werden).'); return; }
    const named = p.groups.filter(g => g.name).sort((a, b) => a.name.localeCompare(b.name));
    for (const n of [...done]) if (!named.some(g => g.name === n)) done.delete(n);
    const minG = app.st.s.faceMinGroup;
    const showSmall = $('#pplSmall').checked;
    const unnamed = stableOrder(p.groups.filter(g => !g.name)).filter(g => showSmall || g.faces.length >= minG);
    const hidden = p.groups.filter(g => !g.name).length - unnamed.length;
    info.textContent = T('{0} Gesichter · {1} Personen benannt · {2} unbenannte Gruppen', p.faceCount, named.length, p.groups.length - named.length) +
      (hidden ? T(' ({0} kleine ausgeblendet)', hidden) : '') + (p.ignored ? T(' · {0} ignoriert', p.ignored) : '');

    // Vorschlaege fuer Namen
    const dl = $('#personNames');
    dl.innerHTML = '';
    for (const g of named) dl.append(h('option', { value: g.name }));

    // Auswahl-Leiste
    box.append(h('div', { id: 'pplSel', class: 'ppl-sel', hidden: !sel.size },
      h('span', {}), h('button', { onclick: e => { const r = e.target.getBoundingClientRect(); showMenu(r.left, r.bottom + 4); } }, T('Namen zuweisen …')),
      h('button', { onclick: () => { const n = askName(); if (n) assign([...sel], n); } }, T('Neue Person …')),
      h('button', { onclick: () => assign([...sel], '#none') }, T('Nicht zugeordnet')),
      h('button', { onclick: () => { sel.clear(); render(); } }, T('Auswahl aufheben'))));
    updateSelInfo();

    // Fertige Personen klein als Leiste (bleiben Ziel fuer Drag & Drop)
    const fin = named.filter(g => done.has(g.name) && expanded !== g.id);
    const open = named.filter(g => !fin.includes(g));
    if (fin.length && !$('#pplHideDone').checked) {
      box.append(h('h3', {}, T('Fertig')), h('div', { class: 'ppl-done' }, fin.map(g => dropTarget(h('div', { class: 'chip', title: T('Klick: wieder aufklappen · Gesichter hierher ziehen = {0}', g.name),
        onclick: () => { done.delete(g.name); saveDone(); render(); } },
        h('img', { src: g.faces.find(f => !f.auto)?.crop || g.faces[0].crop }), h('b', {}, g.name), h('span', {}, g.faces.length)), ids => assign(ids, g.name)))));
    }

    if (open.length) box.append(h('h3', {}, T('Personen')));
    for (const g of open) box.append(card(g));
    if (unnamed.length) box.append(h('h3', {}, T('Unbenannt – Namen eintippen (gleicher Name = zusammenführen)')));
    for (const g of unnamed.slice(0, 200)) box.append(card(g));
    if (unnamed.length > 200) box.append(h('div', { class: 'hint' }, T('… und {0} weitere Gruppen', unnamed.length - 200)));

    // Unten: Nicht zugeordnet + neue Person (beides Ziele fuer Drag & Drop)
    const un = p.unassigned;
    box.append(h('div', { class: 'ppl-bottom' },
      dropTarget(h('div', { class: 'pcard unassigned' },
        h('div', { class: 'pcard-title' }, T('Nicht zugeordnet ({0})', un.length),
          h('span', { class: 'hint' }, ' ' + T('Hierher kommt, was du mit ✕ entfernst. Später auf eine Person ziehen.'))),
        h('div', { class: 'faces' }, byYear([...un].sort((a, b) => a.t - b.t).slice(0, 400), f => faceEl(f, un, { removeTo: '#ignore' }))),
        un.length > 400 ? h('div', { class: 'hint' }, T('… und {0} weitere', un.length - 400)) : null), ids => assign(ids, '#none')),
      dropTarget(h('div', { class: 'pcard newp', onclick: () => { if (sel.size) { const n = askName(); if (n) assign([...sel], n); } } },
        h('div', { class: 'big-plus' }, '+'), h('div', {}, T('Neue Person')), h('div', { class: 'hint' }, T('Gesichter hierher ziehen'))),
        ids => { const n = askName(); if (n) assign(ids, n); })));
  }

  function card(g) {
    const ids = g.faces.map(f => f.id);
    const isOpen = expanded === g.id;
    let body;
    if (isOpen && g.name) {
      // Benannte Person: automatisch zugeordnete zum Bestaetigen, dann die bestaetigten (je nach Datum)
      const auto = g.faces.filter(f => f.auto);
      body = [
        auto.length ? h('div', { class: 'hint' }, T('{0} automatisch zugeordnet – ✓ bestätigt, ✕ entfernt.', auto.length)) : null,
        auto.length ? h('div', { class: 'faces' }, byYear(auto, f => faceEl(f, g.faces, { group: g }))) : null,
        h('div', { class: 'hint' }, T('{0} bestätigt', g.faces.length - auto.length)),
        h('div', { class: 'faces' }, byYear(g.faces.filter(f => !f.auto), f => faceEl(f, g.faces, { group: g })))];
    } else body = h('div', { class: 'faces' }, byYear(isOpen ? g.faces : g.faces.slice(0, 8), f => faceEl(f, g.faces, { group: g })));
    const items = () => [...new Set(g.faces.map(f => f.item))].sort((a, b) => a.date - b.date);
    const autoCount = g.name ? g.faces.filter(f => f.auto).length : 0;
    const el = h('div', { class: 'pcard' + (isOpen ? ' open' : '') + (g.name ? ' named' : '') },
      body,
      h('div', { class: 'pcard-foot' },
        h('input', { type: 'text', list: 'personNames', value: g.name || '', placeholder: T('Name …'),
          onchange: e => { const n = e.target.value.trim(); if (g.name && done.has(g.name)) { done.delete(g.name); if (n) done.add(n); saveDone(); } app.setFaceNames(ids, n || null); } }),
        h('span', { class: 'hint' }, T('{0} Gesichter · {1} Fotos', g.faces.length, g.photos) + (autoCount ? T(' · {0} zu prüfen', autoCount) : '')),
        g.suggest ? h('button', { class: 'suggest', title: T('Ähnelt {0} ({1} %) – Klick ordnet die ganze Gruppe {0} zu', g.suggest.name, Math.round(g.suggest.sim * 100)),
          onclick: () => assign(ids, g.suggest.name) }, T('{0}?', g.suggest.name)) : null,
        h('button', { title: T('Alle Gesichter dieser Gruppe auswählen (dann Rechtsklick oder ziehen)'),
          onclick: () => { const all = ids.every(id => sel.has(id)); for (const id of ids) all ? sel.delete(id) : sel.add(id); refreshSel(); } }, '☐'),
        h('button', { onclick: () => app.openViewer(items(), 0) }, T('Fotos')),
        h('button', { onclick: () => { expanded = isOpen ? null : g.id; render(); } }, isOpen ? T('Weniger') : g.name && autoCount ? T('Prüfen') : T('Alle')),
        g.name ? h('button', { class: 'done-btn', title: T('Mit dieser Person fertig: klein oben ablegen. Automatisch zugeordnete Gesichter werden dabei bestätigt.'),
          onclick: () => { done.add(g.name); saveDone(); if (expanded === g.id) expanded = null; if (autoCount) assign(g.faces.filter(f => f.auto).map(f => f.id), g.name); else render(); } }, '✓ ' + T('Fertig'))
          : h('button', { title: T('Diese Gruppe ignorieren (keine Person)'), onclick: () => assign(ids, '#ignore') }, T('Ignorieren'))));
    // Gesichter auf eine Gruppe ziehen: benannt = dieser Person zuordnen, unbenannt = Gruppe zuerst benennen
    return dropTarget(el, dropIds => {
      if (g.name) return assign(dropIds, g.name);
      const n = askName();
      if (n) assign([...new Set([...ids, ...dropIds])], n);
    });
  }

  return { init, render, byYear };
})();
