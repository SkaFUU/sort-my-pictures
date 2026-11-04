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
      if (!confirm('Alle Namen und Ausschlüsse der Gesichter löschen? (Die Erkennung selbst bleibt gespeichert.)')) return;
      app.setFaceNames(Object.keys(app.st.faceNames), null);
    };
  }

  function render() {
    const box = $('#pplGroups');
    box.innerHTML = '';
    const p = app.st.people;
    const info = $('#pplInfo');
    if (!app.st.items) { info.textContent = 'Zuerst einen Quellordner einlesen.'; return; }
    if (!p) { info.textContent = 'Noch keine Gesichtserkennung für diesen Ordner. „Gesichter erkennen“ startet sie (lokal, dauert je nach Rechner 10–40 min für 5000 Fotos, kann jederzeit abgebrochen und fortgesetzt werden).'; return; }
    const named = p.groups.filter(g => g.name);
    const minG = app.st.s.faceMinGroup;
    const showSmall = $('#pplSmall').checked;
    const unnamed = p.groups.filter(g => !g.name && (showSmall || g.faces.length >= minG));
    const hidden = p.groups.filter(g => !g.name).length - unnamed.length;
    info.textContent = `${p.faceCount} Gesichter · ${named.length} Personen benannt · ${p.groups.length - named.length} unbenannte Gruppen` +
      (hidden ? ` (${hidden} kleine ausgeblendet)` : '') + (p.ignored ? ` · ${p.ignored} ignoriert` : '');

    // Vorschlaege fuer Namen
    const dl = $('#personNames');
    dl.innerHTML = '';
    for (const g of named) dl.append(h('option', { value: g.name }));

    if (named.length) box.append(h('h3', {}, 'Personen'));
    for (const g of named) box.append(card(g));
    if (unnamed.length) box.append(h('h3', {}, 'Unbenannt – Namen eintippen (gleicher Name = zusammenführen)'));
    for (const g of unnamed.slice(0, 200)) box.append(card(g));
    if (unnamed.length > 200) box.append(h('div', { class: 'hint' }, `… und ${unnamed.length - 200} weitere Gruppen`));
  }

  function card(g) {
    const ids = g.faces.map(f => f.id);
    const isOpen = expanded === g.id;
    const crops = (isOpen ? g.faces : g.faces.slice(0, 8)).map(f =>
      h('div', { class: 'face' + (f.auto && g.name ? ' auto' : '') },
        h('img', { src: f.crop, title: `${f.item.name}${f.auto && g.name ? ' (automatisch zugeordnet)' : ''}`,
          onclick: () => { const items = [...new Set(g.faces.map(x => x.item))]; app.openViewer(items, items.indexOf(f.item)); } }),
        isOpen ? h('button', { title: 'Nicht diese Person / ignorieren', onclick: () => app.setFaceNames([f.id], '#ignore') }, '✕') : null));
    const items = () => [...new Set(g.faces.map(f => f.item))].sort((a, b) => a.date - b.date);
    return h('div', { class: 'pcard' + (isOpen ? ' open' : '') + (g.name ? ' named' : '') },
      h('div', { class: 'faces' }, crops),
      h('div', { class: 'pcard-foot' },
        h('input', { type: 'text', list: 'personNames', value: g.name || '', placeholder: 'Name …',
          onchange: e => app.setFaceNames(ids, e.target.value.trim() || null) }),
        h('span', { class: 'hint' }, `${g.faces.length} Gesichter · ${g.photos} Fotos`),
        h('button', { onclick: () => app.openViewer(items(), 0) }, 'Fotos'),
        h('button', { onclick: () => { expanded = isOpen ? null : g.id; render(); } }, isOpen ? 'Weniger' : 'Alle'),
        h('button', { title: 'Diese Gruppe ignorieren (keine Person)', onclick: () => app.setFaceNames(ids, '#ignore') }, 'Ignorieren')));
  }

  return { init, render };
})();
