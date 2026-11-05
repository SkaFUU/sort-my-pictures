// Schnell zuordnen: Gesichter einzeln abfragen („Wer ist das?“) mit Vorschlag. Nach jeder Antwort wird neu gerechnet,
// aehnliche Gesichter wandern automatisch mit – das Programm lernt mit jeder Antwort.
// Gefragt wird zuerst, was am meisten bringt: grosse unbenannte Gruppen, dann unsichere automatische Zuordnungen,
// zuletzt kleine Gruppen und Einzelne.
const FaceQuiz = (() => {
  const { h } = Util;
  let app = null, el = null, q = null, token = 0, answered = 0, changed = false;
  let skipped = new Set();
  const history = [];  // [{ prev: { faceId: alterName|undefined } }] fuer „Zurück“

  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const simTo = (d, g) => {
    if (g.p?.length) { let m = -1; for (const c of g.p) { const v = dot(d, c); if (v > m) m = v; } return m; }
    return g.c ? dot(d, g.c) : -1;
  };
  const minSim = () => 1 - app.st.s.faceThreshold;
  const UNSURE = 0.08;  // automatisch zugeordnet, aber nur knapp ueber der Schwelle

  // Vertreter einer unbenannten Gruppe: gutes Gesicht nahe der Gruppenmitte
  function rep(g) {
    const fs = g.faces.filter(f => !skipped.has(f.id));
    if (!fs.length) return null;
    const good = fs.filter(f => (f.q ?? 1) >= 0.5);
    return (good.length ? good : fs).reduce((a, b) => (dot(b.d, g.c) > dot(a.d, g.c) ? b : a));
  }

  function stats() {
    const p = app.st.people, m = minSim();
    const named = p.groups.filter(g => g.name);
    return {
      fixed: named.reduce((a, g) => a + g.faces.filter(f => !f.auto).length, 0),
      auto: named.reduce((a, g) => a + g.faces.filter(f => f.auto).length, 0),
      unsure: named.reduce((a, g) => a + g.faces.filter(f => f.auto && f.sim < m + UNSURE).length, 0),
      open: p.groups.filter(g => !g.name).reduce((a, g) => a + g.faces.length, 0),
    };
  }

  function nextQuestion() {
    const p = app.st.people;
    if (!p) return null;
    const m = minSim();
    const named = p.groups.filter(g => g.name);
    const unnamed = p.groups.filter(g => !g.name && g.c).sort((a, b) => b.faces.length - a.faces.length);
    for (const g of unnamed.filter(g => g.faces.length >= 3)) { const f = rep(g); if (f) return { f, g, kind: 'group' }; }
    const unsure = named.flatMap(g => g.faces.filter(f => f.auto && !skipped.has(f.id) && f.sim < m + UNSURE).map(f => ({ f, g })))
      .sort((a, b) => a.f.sim - b.f.sim);
    if (unsure.length) return { ...unsure[0], kind: 'unsure' };
    for (const g of unnamed) { const f = rep(g); if (f) return { f, g, kind: 'group' }; }
    return null;
  }

  // Bildausschnitt mit etwas Umgebung (hilft beim Erkennen); bis dahin das kleine Gesichtsbild
  async function context(f, img, my) {
    try {
      const bmp = await createImageBitmap(await f.item.handle.getFile());
      if (my !== token) { bmp.close(); return; }
      const [x, y, w, hh] = f.box;
      const s = Math.max(w * bmp.width, hh * bmp.height) * 2.6;
      const cx = (x + w / 2) * bmp.width, cy = (y + hh / 2) * bmp.height;
      const cv = h('canvas', { width: 360, height: 360 });
      cv.getContext('2d').drawImage(bmp, cx - s / 2, cy - s / 2, s, s, 0, 0, 360, 360);
      bmp.close();
      cv.className = 'qz-img';
      img.replaceWith(cv);
    } catch { /* bleibt beim kleinen Bild */ }
  }

  function answer(name, ids = [q.f.id]) {
    const prev = {};
    for (const id of ids) prev[id] = app.st.faceNames[id];
    history.push({ prev });
    answered++;
    app.setFaceNames(ids, name, true);
    changed = true;
    show();
  }
  function undo() {
    const last = history.pop();
    if (!last) return;
    answered--;
    for (const [id, n] of Object.entries(last.prev)) {
      skipped.delete(id);
      app.setFaceNames([id], n || null, true);
    }
    show();
  }

  function show() {
    if (!el) return;
    const my = ++token;
    q = nextQuestion();
    const s = stats();
    const body = el.querySelector('.qz-body');
    body.innerHTML = '';
    el.querySelector('.qz-stats').textContent =
      T('{0} beantwortet · {1} bestätigt · {2} automatisch zugeordnet ({3} unsicher) · {4} noch ohne Namen', answered, s.fixed, s.auto, s.unsure, s.open);
    if (!q) {
      body.append(h('div', { class: 'qz-done' }, h('b', {}, T('Fertig – keine offenen Fragen mehr.')),
        h('div', { class: 'hint' }, T('Übersprungene kommen beim nächsten Öffnen wieder.')),
        h('button', { onclick: undo, disabled: !history.length }, T('Zurück')), h('button', { onclick: close }, T('Schließen'))));
      return;
    }
    const { f, g, kind } = q;
    const m = minSim();
    const cands = app.st.people.groups.filter(x => x.name).map(x => ({ g: x, s: simTo(f.d, x) })).sort((a, b) => b.s - a.s);
    const sugg = kind === 'unsure' ? g.name : (cands[0] && cands[0].s >= m - 0.12 ? cands[0].g.name : null);
    const others = cands.filter(c => c.g.name !== sugg).slice(0, 9);
    q.sugg = sugg;
    q.others = others.map(c => c.g.name);

    const img = h('img', { class: 'qz-img', src: f.crop });
    context(f, img, my);
    const inp = h('input', { type: 'text', list: 'personNames', placeholder: T('Anderer Name … (Enter)') });
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && inp.value.trim()) answer(inp.value.trim(), e.shiftKey && kind === 'group' ? g.faces.map(x => x.id) : [f.id]);
      if (e.key === 'Escape') inp.blur();
    });
    const avatar = x => h('img', { src: x.faces.find(ff => !ff.auto)?.crop || x.faces[0]?.crop });
    const groupFaces = kind === 'group' ? g.faces.filter(x => x.id !== f.id) : [];
    body.append(
      h('div', { class: 'qz-left' }, img,
        h('div', { class: 'hint' }, f.item.name + ' · ' + Util.fmtDate(f.item.date)),
        h('button', { class: 'qz-photo', onclick: () => app.openViewer([f.item], 0) }, T('Ganzes Foto'))),
      h('div', { class: 'qz-right' },
        h('h2', {}, kind === 'unsure' ? T('Ist das {0}?', g.name) : T('Wer ist das?')),
        kind === 'unsure' ? h('div', { class: 'hint' }, T('Automatisch zugeordnet, aber unsicher ({0} %).', Math.round(f.sim * 100))) : null,
        sugg ? h('button', { class: 'qz-sugg', onclick: () => answer(sugg) }, avatar(app.st.people.groups.find(x => x.name === sugg)),
          h('span', {}, (kind === 'unsure' ? T('Ja, {0}', sugg) : sugg)), h('kbd', {}, 'Enter')) : null,
        others.length ? h('div', { class: 'qz-names' }, others.map((c, i) =>
          h('button', { onclick: () => answer(c.g.name), title: Math.round(c.s * 100) + ' %' }, avatar(c.g), h('span', {}, c.g.name), h('kbd', {}, String(i + 1))))) : null,
        inp,
        h('div', { class: 'qz-actions' },
          h('button', { onclick: () => answer('#ignore'), title: T('Fremde Person oder kein Gesicht – wird nicht mehr gefragt') }, T('Fremd / kein Gesicht'), h('kbd', {}, T('Entf'))),
          kind === 'unsure' ? h('button', { onclick: () => answer('#none') }, T('Nein, weiß nicht'), h('kbd', {}, '0')) : null,
          h('button', { onclick: () => { skipped.add(f.id); show(); } }, T('Überspringen'), h('kbd', {}, '→')),
          h('button', { onclick: undo, disabled: !history.length }, T('Zurück'), h('kbd', {}, '←'))),
        groupFaces.length ? h('div', { class: 'qz-group' },
          h('div', { class: 'hint' }, T('Dieselbe Gruppe ({0} weitere) – nach der Antwort werden alle ähnlichen automatisch mit zugeordnet. Umschalt+Enter ordnet die ganze Gruppe fest zu:', groupFaces.length)),
          h('div', { class: 'qz-faces' }, groupFaces.slice(0, 24).map(x => h('img', { src: x.crop }))),
          sugg ? h('button', { onclick: () => answer(sugg, g.faces.map(x => x.id)) }, T('Alle {0} sind {1}', g.faces.length, sugg), h('kbd', {}, '⇧Enter')) : null) : null));
  }

  function onKey(e) {
    if (!el) return;
    if (!q) { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft' || e.key === 'Backspace') undo(); return; }
    if (document.activeElement?.tagName === 'INPUT') return;
    if (document.getElementById('viewer')?.getClientRects().length) return;  // Bildansicht offen
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'Enter' && e.shiftKey && q.sugg && q.kind === 'group') answer(q.sugg, q.g.faces.map(x => x.id));
    else if (k === 'Enter' && q.sugg) answer(q.sugg);
    else if (/^[1-9]$/.test(k) && q.others[+k - 1]) answer(q.others[+k - 1]);
    else if (k === 'Delete') answer('#ignore');
    else if (k === '0' && q.kind === 'unsure') answer('#none');
    else if (k === 'ArrowRight' || k === ' ') { skipped.add(q.f.id); show(); }
    else if (k === 'ArrowLeft' || k === 'Backspace') undo();
    else if (k.length === 1 && /\p{L}/u.test(k)) { el.querySelector('input').focus(); return; }  // Tippen = anderer Name
    else return;
    e.preventDefault();
  }

  function open(appCtx) {
    app = appCtx;
    if (!app.st.people) { alert(T('Zuerst „Gesichter erkennen“.')); return; }
    skipped = new Set();
    answered = 0;
    history.length = 0;
    changed = false;
    el = h('div', { class: 'quiz' }, h('div', { class: 'qz-card' },
      h('div', { class: 'qz-head' }, h('b', {}, T('Schnell zuordnen')), h('span', { class: 'qz-stats' }), h('button', { onclick: close, title: 'Esc' }, '✕')),
      h('div', { class: 'qz-body' }),
      h('div', { class: 'hint qz-foot' }, T('Enter = Vorschlag · 1–9 = andere Person · Name tippen = neue Person · Entf = fremd · → überspringen · ← zurück · Esc beenden'))));
    document.body.append(el);
    document.addEventListener('keydown', onKey);
    show();
  }
  function close() {
    document.removeEventListener('keydown', onKey);
    el?.remove();
    el = null;
    token++;
    if (changed) { app.recompute(); People.render(); }
  }

  return { open };
})();
