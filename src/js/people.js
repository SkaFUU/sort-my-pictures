// Personen-Tab: Gesichtsgruppen benennen, zusammenfuehren (gleicher Name), Fehler entfernen
const People = (() => {
  const { h } = Util;
  const $ = sel => document.querySelector(sel);
  let app, expanded = null;

  function init(appCtx) {
    app = appCtx;
    $('#btnFaces').onclick = () => app.scanFaces();
    $('#pplSmall').onchange = render;
    $('#btnFacesReset').onclick = () => {
      if (!confirm(T('Alle Namen und Ausschlüsse der Gesichter löschen? (Die Erkennung selbst bleibt gespeichert.)'))) return;
      app.setFaceNames(Object.keys(app.st.faceNames), null);
    };
  }

  function render() {
    const box = $('#pplGroups');
    box.innerHTML = '';
    const p = app.st.people;
    const info = $('#pplInfo');
    if (!app.st.items) { info.textContent = T('Zuerst einen Quellordner einlesen.'); return; }
    if (!p && app.st.oldFaces) { info.textContent = T('Die Gesichtserkennung wurde verbessert (neues Modell). Bitte „Gesichter erkennen“ neu starten – vergebene Namen werden auf die neu gefundenen Gesichter übertragen.'); return; }
    if (!p) { info.textContent = T('Noch keine Gesichtserkennung für diesen Ordner. „Gesichter erkennen“ startet sie (lokal, nutzt alle Prozessorkerne, ca. 3–10 min für 5000 Fotos, kann jederzeit abgebrochen und fortgesetzt werden).'); return; }
    const named = p.groups.filter(g => g.name);
    const minG = app.st.s.faceMinGroup;
    const showSmall = $('#pplSmall').checked;
    const unnamed = p.groups.filter(g => !g.name && (showSmall || g.faces.length >= minG));
    const hidden = p.groups.filter(g => !g.name).length - unnamed.length;
    info.textContent = T('{0} Gesichter · {1} Personen benannt · {2} unbenannte Gruppen', p.faceCount, named.length, p.groups.length - named.length) +
      (hidden ? T(' ({0} kleine ausgeblendet)', hidden) : '') + (p.ignored ? T(' · {0} ignoriert', p.ignored) : '');

    // Vorschlaege fuer Namen
    const dl = $('#personNames');
    dl.innerHTML = '';
    for (const g of named) dl.append(h('option', { value: g.name }));

    if (named.length) box.append(h('h3', {}, T('Personen')));
    for (const g of named) box.append(card(g));
    if (unnamed.length) box.append(h('h3', {}, T('Unbenannt – Namen eintippen (gleicher Name = zusammenführen)')));
    for (const g of unnamed.slice(0, 200)) box.append(card(g));
    if (unnamed.length > 200) box.append(h('div', { class: 'hint' }, T('… und {0} weitere Gruppen', unnamed.length - 200)));
  }

  function card(g) {
    const ids = g.faces.map(f => f.id);
    const isOpen = expanded === g.id;
    const face = f => h('div', { class: 'face' + (f.auto && g.name ? ' auto' : '') },
      h('img', { src: f.crop, title: `${f.item.name}${f.auto && g.name ? ` (${T('automatisch zugeordnet')}, ${Math.round(f.sim * 100)} %)` : ''}`,
        onclick: () => { const items = [...new Set(g.faces.map(x => x.item))]; app.openViewer(items, items.indexOf(f.item)); } }),
      isOpen && f.auto && g.name ? h('button', { class: 'ok', title: T('Ja, das ist {0}', g.name), onclick: () => app.setFaceNames([f.id], g.name) }, '✓') : null,
      isOpen ? h('button', { title: T('Nicht diese Person / ignorieren'), onclick: () => app.setFaceNames([f.id], '#ignore') }, '✕') : null);
    let body;
    if (isOpen && g.name) {
      // Benannte Person: automatisch zugeordnete zum Bestaetigen, unsicherste zuerst
      const auto = g.faces.filter(f => f.auto).sort((a, b) => a.sim - b.sim);
      body = [
        auto.length ? h('div', { class: 'hint' }, T('{0} automatisch zugeordnet – unsicherste zuerst. ✓ bestätigt, ✕ entfernt.', auto.length)) : null,
        auto.length ? h('div', { class: 'faces' }, auto.map(face)) : null,
        h('div', { class: 'hint' }, T('{0} bestätigt', g.faces.length - auto.length)),
        h('div', { class: 'faces' }, g.faces.filter(f => !f.auto).map(face))];
    } else body = h('div', { class: 'faces' }, (isOpen ? g.faces : g.faces.slice(0, 8)).map(face));
    const items = () => [...new Set(g.faces.map(f => f.item))].sort((a, b) => a.date - b.date);
    const autoCount = g.name ? g.faces.filter(f => f.auto).length : 0;
    return h('div', { class: 'pcard' + (isOpen ? ' open' : '') + (g.name ? ' named' : '') },
      body,
      h('div', { class: 'pcard-foot' },
        h('input', { type: 'text', list: 'personNames', value: g.name || '', placeholder: T('Name …'),
          onchange: e => app.setFaceNames(ids, e.target.value.trim() || null) }),
        h('span', { class: 'hint' }, T('{0} Gesichter · {1} Fotos', g.faces.length, g.photos) + (autoCount ? T(' · {0} zu prüfen', autoCount) : '')),
        h('button', { onclick: () => app.openViewer(items(), 0) }, T('Fotos')),
        h('button', { onclick: () => { expanded = isOpen ? null : g.id; render(); } }, isOpen ? T('Weniger') : g.name && autoCount ? T('Prüfen') : T('Alle')),
        h('button', { title: T('Diese Gruppe ignorieren (keine Person)'), onclick: () => app.setFaceNames(ids, '#ignore') }, T('Ignorieren'))));
  }

  return { init, render };
})();
