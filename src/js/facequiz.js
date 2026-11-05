// Schnell zuordnen: jede offene Gruppe nacheinander zur Schnellpruefung („Wer ist das?“) mit Vorschlag.
// Falsche Gesichter anklicken = abwaehlen, Enter ordnet den Rest zu. Nach jeder Antwort wird neu gerechnet –
// aehnliche Gesichter wandern mit, das Programm lernt mit jeder Antwort.
// Offen sind: unbenannte Gruppen und automatisch zugeordnete (noch nicht bestaetigte) Gesichter einer Person.
// Zweiter Modus (check): einzelne Auffaelligkeiten aus „Erneut pruefen“ durchgehen.
const FaceQuiz = (() => {
  const { h } = Util;
  const MAX_TILES = 80;
  let app = null, el = null, q = null, token = 0, answered = 0, changed = false;
  let mode = 'groups', checks = [], ci = 0;
  let skipped = new Set();
  const excluded = new Set();

  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const people = () => app.st.people;
  const real = n => n && n[0] !== '#' && n[0] !== '!';

  // ---------- Fragen ----------
  function nextGroupQuestion() {
    const p = people();
    if (!p) return null;
    const cands = [];
    for (const g of p.groups) {
      if (!g.name) cands.push({ kind: 'group', g, faces: g.faces });
      else {
        const auto = g.faces.filter(f => f.auto);
        if (auto.length) cands.push({ kind: 'auto', g, faces: auto });
      }
    }
    const open = cands.filter(c => c.faces.some(f => !skipped.has(f.id)));
    if (!open.length) return null;
    open.sort((a, b) => b.faces.length - a.faces.length);
    const c = open[0];
    const faces = [...c.faces].sort((a, b) => (b.sim ?? 1) - (a.sim ?? 1)).slice(0, MAX_TILES);
    const good = faces.filter(f => (f.q ?? 1) >= 0.5);
    const rep = c.kind === 'group' && c.g.c ? (good.length ? good : faces).reduce((a, b) => (dot(b.d, c.g.c) > dot(a.d, c.g.c) ? b : a)) : faces[0];
    return { ...c, faces, rep, more: c.faces.length - faces.length };
  }

  function candidates(d, exclude = null) {
    return people().groups.filter(x => x.name && x.name !== exclude).map(x => ({ g: x, s: people().score(d, x) })).sort((a, b) => b.s - a.s);
  }

  // ---------- Antworten ----------
  function apply(changes) {
    if (!Object.keys(changes).length) return;
    answered++;
    changed = true;
    app.applyFaceNames(changes, true);
  }
  // Gruppe: ausgewaehlte = name, abgewaehlte = sicher nicht diese Person ('!name')
  function answerGroup(name) {
    const ch = {};
    for (const f of q.faces) {
      if (!excluded.has(f.id)) ch[f.id] = name;
      else if (real(name)) ch[f.id] = '!' + name;
    }
    apply(ch);
    show();
  }
  function answerOne(name) {
    if (name !== undefined) apply({ [q.f.id]: name });
    ci++;
    show();
  }
  function skip() {
    if (mode === 'check') { ci++; show(); return; }
    for (const f of q.faces) skipped.add(f.id);
    show();
  }
  function undo() {
    if (!app.canUndo()) return;
    app.undoFaceNames(true);
    answered = Math.max(0, answered - 1);
    if (mode === 'check') ci = Math.max(0, ci - 1);
    show();
  }

  // Bildausschnitt mit etwas Umgebung (hilft beim Erkennen); bis dahin das kleine Gesichtsbild
  async function context(f, img, my) {
    try {
      const bmp = await createImageBitmap(await f.item.handle.getFile());
      if (my !== token) { bmp.close(); return; }
      const [x, y, w, hh] = f.box;
      const s = Math.max(w * bmp.width, hh * bmp.height) * 2.6;
      const cx = (x + w / 2) * bmp.width, cy = (y + hh / 2) * bmp.height;
      const cv = h('canvas', { width: 320, height: 320 });
      cv.getContext('2d').drawImage(bmp, cx - s / 2, cy - s / 2, s, s, 0, 0, 320, 320);
      bmp.close();
      cv.className = 'qz-img';
      img.replaceWith(cv);
    } catch { /* bleibt beim kleinen Bild */ }
  }

  const avatar = g => h('img', { src: g.faces.find(f => !f.auto)?.crop || g.faces[0]?.crop });
  const kbd = k => h('kbd', {}, k);

  function stats() {
    const p = people();
    const named = p.groups.filter(g => g.name);
    const auto = named.reduce((a, g) => a + g.faces.filter(f => f.auto).length, 0);
    const fixed = named.reduce((a, g) => a + g.faces.length, 0) - auto;
    const open = p.groups.filter(g => !g.name).reduce((a, g) => a + g.faces.length, 0);
    return mode === 'check'
      ? T('Auffälligkeit {0} von {1}', Math.min(ci + 1, checks.length), checks.length)
      : T('{0} beantwortet · {1} bestätigt · {2} automatisch zugeordnet · {3} noch ohne Namen', answered, fixed, auto, open);
  }

  function show() {
    if (!el) return;
    const my = ++token;
    excluded.clear();
    const body = el.querySelector('.qz-body');
    body.innerHTML = '';
    if (mode === 'check') {
      // Auffaelligkeiten, die sich inzwischen erledigt haben, ueberspringen
      while (ci < checks.length && app.st.faceNames[checks[ci].f.id] !== checks[ci].name) ci++;
      q = ci < checks.length ? checks[ci] : null;
    } else q = nextGroupQuestion();
    el.querySelector('.qz-stats').textContent = stats();
    el.querySelector('.qz-undo').disabled = !app.canUndo();
    if (!q) {
      body.append(h('div', { class: 'qz-done' }, h('b', {}, mode === 'check' ? T('Alle Auffälligkeiten durchgesehen.') : T('Fertig – keine offenen Gruppen mehr.')),
        mode === 'check' ? null : h('div', { class: 'hint' }, T('Übersprungene kommen beim nächsten Öffnen wieder.')),
        h('button', { onclick: close }, T('Schließen'))));
      return;
    }
    if (mode === 'check') showCheck(body, my); else showGroup(body, my);
  }

  function showGroup(body, my) {
    const { kind, g, faces, rep, more } = q;
    const m = people().minSim;
    let sugg = null, others;
    if (kind === 'auto') { sugg = g.name; others = []; }
    else {
      // Vorschlag: im Schnitt aehnlichste bekannte Person
      const avg = people().groups.filter(x => x.name).map(x => ({ g: x, s: faces.reduce((a, f) => a + people().score(f.d, x), 0) / faces.length })).sort((a, b) => b.s - a.s);
      if (avg[0] && avg[0].s >= m - 0.12) sugg = avg[0].g.name;
      others = avg.filter(c => c.g.name !== sugg).slice(0, 9).map(c => c.g);
    }
    q.sugg = sugg;
    q.others = others.map(x => x.name);
    const img = h('img', { class: 'qz-img', src: rep.crop });
    context(rep, img, my);
    const inp = nameInput(n => answerGroup(n));
    const tiles = h('div', { class: 'qz-tiles' }, faces.map(f => {
      const t = h('div', { class: 'qz-tile', title: f.item.name + ' · ' + Util.fmtDate(f.item.date) + '\n' + T('Klick: falsch / richtig') },
        h('img', { src: f.crop }), h('span', {}, '✕'));
      t.onclick = () => { excluded.has(f.id) ? excluded.delete(f.id) : excluded.add(f.id); t.classList.toggle('off', excluded.has(f.id)); count(); };
      t.oncontextmenu = e => { e.preventDefault(); app.openViewer([f.item], 0); };
      return t;
    }));
    const cnt = h('span', { class: 'hint' });
    const count = () => { cnt.textContent = T('{0} von {1} ausgewählt', faces.length - excluded.size, faces.length); };
    count();
    const years = [...new Set(faces.map(f => f.item.date.getFullYear()))].sort();
    body.append(
      h('div', { class: 'qz-left' }, img,
        h('div', { class: 'hint' }, years.length > 1 ? years[0] + '–' + years[years.length - 1] : String(years[0])),
        h('button', { class: 'qz-photo', onclick: () => app.openViewer([...new Set(faces.map(f => f.item))], 0) }, T('Fotos ansehen'))),
      h('div', { class: 'qz-right' },
        h('h2', {}, kind === 'auto' ? T('Sind das alle {0}?', g.name) : T('Wer ist das?')),
        h('div', { class: 'hint' }, kind === 'auto' ? T('Automatisch zugeordnet. Falsche anklicken, dann Enter.') : T('Falsche Gesichter anklicken (abwählen), dann Namen wählen.'),
          more > 0 ? ' ' + T('(+{0} weitere danach)', more) : ''),
        tiles, cnt,
        sugg ? h('button', { class: 'qz-sugg', onclick: () => answerGroup(sugg) }, avatar(people().groups.find(x => x.name === sugg)),
          h('span', {}, kind === 'auto' ? T('Ja, {0}', sugg) : sugg), kbd('Enter')) : null,
        others.length ? h('div', { class: 'qz-names' }, others.map((x, i) => h('button', { onclick: () => answerGroup(x.name) }, avatar(x), h('span', {}, x.name), kbd(String(i + 1))))) : null,
        inp, actions(() => answerGroup('#ignore'))));
  }

  function showCheck(body, my) {
    const { kind, f, name, alt, others: same } = q;
    const cands = candidates(f.d, name);
    if (alt) cands.sort((a, b) => (b.g.name === alt) - (a.g.name === alt));
    q.sugg = undefined;  // Enter = bleibt
    q.others = cands.slice(0, 9).map(c => c.g.name);
    const img = h('img', { class: 'qz-img', src: f.crop });
    context(f, img, my);
    const own = people().groups.find(x => x.name === name);
    body.append(
      h('div', { class: 'qz-left' }, img,
        h('div', { class: 'hint' }, f.item.name + ' · ' + Util.fmtDate(f.item.date)),
        h('button', { class: 'qz-photo', onclick: () => app.openViewer([f.item], 0) }, T('Ganzes Foto'))),
      h('div', { class: 'qz-right' },
        h('h2', {}, T('Ist das {0}?', name)),
        h('div', { class: 'hint' }, kind === 'twice'
          ? T('{0} ist auf diesem Foto mehrmals zugeordnet – das geht nicht.', name)
          : T('Passt besser zu {0} ({1} % statt {2} %).', alt, Math.round(q.altSim * 100), Math.round(q.own * 100))),
        same?.length ? h('div', { class: 'qz-faces' }, same.map(x => h('img', { src: x.crop, title: T('Ebenfalls als {0} zugeordnet', name) }))) : null,
        h('button', { class: 'qz-sugg', onclick: () => answerOne() }, own ? avatar(own) : null, h('span', {}, T('Ja, bleibt {0}', name)), kbd('Enter')),
        q.others.length ? h('div', { class: 'qz-names' }, q.others.map((n, i) => {
          const g = people().groups.find(x => x.name === n);
          return h('button', { onclick: () => answerOne(n) }, avatar(g), h('span', {}, n), kbd(String(i + 1)));
        })) : null,
        nameInput(n => answerOne(n)),
        actions(() => answerOne('#ignore'), () => answerOne('#none'))));
  }

  function nameInput(onName) {
    const inp = h('input', { type: 'text', list: 'personNames', placeholder: T('Anderer Name … (Enter)') });
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && inp.value.trim()) onName(inp.value.trim());
      if (e.key === 'Escape') inp.blur();
    });
    return inp;
  }
  function actions(onStranger, onNone = null) {
    return h('div', { class: 'qz-actions' },
      h('button', { onclick: onStranger, title: T('Fremde Person oder kein Gesicht – wird nicht mehr gefragt') }, T('Fremd / kein Gesicht'), kbd(T('Entf'))),
      onNone ? h('button', { onclick: onNone }, T('Weiß nicht'), kbd('0')) : null,
      h('button', { onclick: skip }, T('Überspringen'), kbd('→')));
  }

  function onKey(e) {
    if (!el) return;
    if (document.activeElement?.tagName === 'INPUT') return;
    if (document.getElementById('viewer')?.getClientRects().length) return;  // Bildansicht offen
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'ArrowLeft' || k === 'Backspace' || ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z')) undo();
    else if (!q) return;
    else if (k === 'Enter') { if (mode === 'check') answerOne(); else if (q.sugg) answerGroup(q.sugg); }
    else if (/^[1-9]$/.test(k) && q.others[+k - 1]) { mode === 'check' ? answerOne(q.others[+k - 1]) : answerGroup(q.others[+k - 1]); }
    else if (k === 'Delete') { mode === 'check' ? answerOne('#ignore') : answerGroup('#ignore'); }
    else if (k === '0' && mode === 'check') answerOne('#none');
    else if (k === 'ArrowRight') skip();
    else if (k.length === 1 && /\p{L}/u.test(k) && !e.ctrlKey && !e.metaKey) { el.querySelector('input').focus(); return; }  // Tippen = anderer Name
    else return;
    e.preventDefault();
  }

  function start(appCtx, m, list = []) {
    app = appCtx;
    if (!app.st.people) { alert(T('Zuerst „Gesichter erkennen“.')); return; }
    close();
    mode = m;
    checks = list;
    ci = 0;
    skipped = new Set();
    answered = 0;
    changed = false;
    el = h('div', { class: 'quiz' }, h('div', { class: 'qz-card' },
      h('div', { class: 'qz-head' }, h('b', {}, m === 'check' ? T('Auffälligkeiten prüfen') : T('Schnell zuordnen')), h('span', { class: 'qz-stats' }),
        h('button', { class: 'qz-undo', onclick: undo, title: T('Rückgängig (← oder Strg+Z)') }, '↶ ' + T('Rückgängig')),
        h('button', { onclick: close, title: 'Esc' }, '✕')),
      h('div', { class: 'qz-body' }),
      h('div', { class: 'hint qz-foot' }, m === 'check'
        ? T('Enter = bleibt · 1–9 = andere Person · Name tippen = neue Person · Entf = fremd · 0 = weiß nicht · → überspringen · ← rückgängig · Esc beenden')
        : T('Falsche Gesichter anklicken · Enter = Vorschlag · 1–9 = andere Person · Name tippen = neue Person · Entf = fremd · → überspringen · ← rückgängig · Esc beenden'))));
    document.body.append(el);
    document.addEventListener('keydown', onKey);
    show();
  }
  function close() {
    document.removeEventListener('keydown', onKey);
    el?.remove();
    el = null;
    token++;
    if (changed) { changed = false; app.recompute(); People.render(); }
  }

  return { open: appCtx => start(appCtx, 'groups'), check: (appCtx, list) => start(appCtx, 'check', list) };
})();
