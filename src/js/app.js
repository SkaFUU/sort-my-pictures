// Oberflaeche und Ablauf
(() => {
  const $ = sel => document.querySelector(sel);
  const { escapeHtml: esc, fmtDate, fmtBytes, h, icon } = Util;

  const ZKEY = 'fotosortierer.zones', OKEY = 'fotosortierer.overrides';
  const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };

  const st = {
    s: Settings.load(),
    zones: loadJson(ZKEY, []),
    overrides: { events: {}, files: {} },
    src: null, dst: null, items: null, analysis: null, plan: null,
    abort: null, selected: null, thumbUrls: [],
    faceCache: null, faceNames: {}, people: null, oldFaces: false, faceLib: {},
  };
  const saveZones = () => localStorage.setItem(ZKEY, JSON.stringify(st.zones));

  // ---------------- Stand je Quellordner ----------------
  // Im Browser (IndexedDB) getrennt je Quellordner gespeichert: Namen der Gesichter, Aenderungen und Haken an
  // Ereignissen, fertige Personen. Einstellungen, Zonen, gemerkte Personen und Ortsnamen gelten fuer alle Ordner.
  // Der Ordner wird ueber seinen Zugriff (FileSystemHandle.isSameEntry) wiedererkannt, nicht nur ueber den Namen.
  // Zusaetzlich liegt der Stand als „_sortmypictures.json“ im Quellordner (braucht Schreibzugriff auf den Ordner, die Fotos
  // selbst bleiben unberuehrt). So ist er unabhaengig vom Browser; beim Oeffnen gilt der neuere der beiden.
  let proj = null, fileTimer = null;
  const projKey = id => 'project:' + id;
  const STATE_FILE = '_sortmypictures.json';
  function saveProject() {
    if (!proj) return;
    proj.saved = Date.now();
    Util.idb.set(projKey(proj.id), { saved: proj.saved, faceNames: st.faceNames, overrides: st.overrides, done: People.getDone() }).catch(() => {});
    clearTimeout(fileTimer);
    const p = proj;
    fileTimer = setTimeout(() => writeStateFile(p), 1500);  // gesammelt, nicht bei jedem Klick aufs Netzlaufwerk
  }
  let fileInfo = { state: '', time: 0, msg: '' };
  function showFileInfo(state, msg = '') {
    fileInfo = { state, time: Date.now(), msg };
    const el = $('#projInfo');
    if (!el) return;
    el.innerHTML = '';
    el.className = 'proj-info ' + state;
    if (!proj) return;
    if (state === 'ok') el.append(T('Stand gespeichert in „{0}“ ({1})', STATE_FILE, Util.fmtDateTime(new Date(fileInfo.time)).split(' ').pop()));
    else if (state === 'noperm') el.append(T('Stand nur im Browser – für „{0}“ im Ordner fehlt der Schreibzugriff.', STATE_FILE), ' ',
      h('button', { class: 'mini', onclick: async () => { if (await proj.handle.requestPermission({ mode: 'readwrite' }) === 'granted') writeStateFile(proj); } }, T('Erlauben')));
    else if (state === 'err') el.append(T('„{0}“ konnte nicht geschrieben werden: {1}', STATE_FILE, msg));
    else el.append(T('Stand wird im Browser und in „{0}“ im Ordner gespeichert.', STATE_FILE));
  }
  async function writeStateFile(p) {
    if (p !== proj) return;
    const hd = p.handle;
    try {
      if ((await hd.queryPermission({ mode: 'readwrite' })) !== 'granted') { showFileInfo('noperm'); return; }
      const fh = await hd.getFileHandle(STATE_FILE, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify({ app: 'Sort My Pictures', version: 1, folder: hd.name, saved: p.saved,
        faceNames: st.faceNames, overrides: st.overrides, done: People.getDone() }));
      await w.close();
      showFileInfo('ok');
    } catch (e) { showFileInfo('err', e.message); }
  }
  // Stand aus der Datei im Ordner uebernehmen, wenn sie neuer ist als der im Browser (anderer Browser/PC hat weitergearbeitet)
  async function loadStateFile() {
    if (!proj) return false;
    let j = null;
    try { j = JSON.parse(await (await (await proj.handle.getFileHandle(STATE_FILE)).getFile()).text()); } catch { return false; }
    if (!j?.faceNames || !(j.saved > (proj.saved || 0))) return false;
    st.faceNames = j.faceNames;
    st.overrides = j.overrides || { events: {}, files: {} };
    People.setDone(j.done || []);
    faceHistory.length = 0;
    proj.saved = j.saved;
    Util.idb.set(projKey(proj.id), { saved: j.saved, faceNames: st.faceNames, overrides: st.overrides, done: People.getDone() }).catch(() => {});
    log(T('Stand aus „{0}“ im Ordner übernommen (gespeichert {1}).', STATE_FILE, Util.fmtDateTime(new Date(j.saved))));
    return true;
  }
  const saveOverrides = saveProject;
  // im Browser ablegen, ohne den Zeitstempel zu aendern (der zaehlt beim Vergleich mit der Datei im Ordner)
  const persist = p => Util.idb.set(projKey(p.id), { saved: p.saved || 0, faceNames: st.faceNames, overrides: st.overrides, done: People.getDone() }).catch(() => {});
  async function openProject(handle) {
    // bisherigen Ordner sicher ablegen, ausstehende Datei gleich schreiben
    if (proj) { persist(proj); if (fileTimer) { clearTimeout(fileTimer); fileTimer = null; await writeStateFile(proj); } }
    let list = [];
    try { list = (await Util.idb.get('projects')) || []; } catch { /* leer */ }
    let p = null;
    for (const x of list) { try { if (await x.handle.isSameEntry(handle)) { p = x; break; } } catch { /* Ordner weg */ } }
    let data = null;
    if (p) data = await Util.idb.get(projKey(p.id)).catch(() => null);
    else {
      p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), handle };
      // der bisher gemeinsame Stand (vor der Trennung je Ordner) gehoert zum ersten Ordner
      if (!list.length) {
        const fn = await Util.idb.get('faceNames').catch(() => null);
        data = { faceNames: fn || {}, overrides: loadJson(OKEY, { events: {}, files: {} }), done: People.legacyDone() };
      }
      list.push(p);
    }
    p.name = handle.name;
    p.last = Date.now();
    await Util.idb.set('projects', list).catch(() => {});
    proj = p;
    st.faceNames = data?.faceNames || {};
    st.overrides = data?.overrides || { events: {}, files: {} };
    People.setDone(data?.done || []);
    faceHistory.length = 0;
    p.saved = data?.saved || 0;
    persist(p);
    showFileInfo('');
    await loadStateFile();  // klappt nur, wenn schon Lesezugriff besteht – sonst beim Einlesen
    const named = Object.values(st.faceNames).filter(n => n[0] !== '#' && n[0] !== '!').length;
    const evs = Object.keys(st.overrides.events || {}).length;
    if (named || evs) log(T('Gespeicherter Stand für „{0}“: {1} Gesichter benannt, {2} Ereignisse geändert oder geprüft.', handle.name, named, evs));
  }

  // ---------------- Status ----------------
  function status(text, progress) {
    $('#statusText').textContent = text;
    const p = $('#progress');
    p.hidden = progress == null;
    if (progress != null) { if (progress < 0) p.removeAttribute('value'); else p.value = progress; }
  }
  function busy(on) {
    document.body.classList.toggle('busy', on);
    $('#btnCancel').hidden = !on;
    updateButtons();
  }
  function updateButtons() {
    const b = document.body.classList.contains('busy');
    $('#btnScan').disabled = b || !st.src;
    $('#btnCopy').disabled = $('#btnCopy2').disabled = $('#btnMapExport').disabled = $('#btnIndex').disabled = b || !st.plan || !st.plan.ops.length;
    for (const id of ['#btnSrc', '#btnDst', '#btnFaces']) $(id).disabled = b;
    document.querySelectorAll('[data-lang]').forEach(x => { x.disabled = b; });
    updateSteps();
  }

  // Erledigte Arbeitsschritte im Register abhaken
  function updateSteps() {
    const a = st.analysis;
    const done = {
      quelle: !!st.items,
      orte: !!a && (a.homes.length > 0),
      events: !!a,
      review: !!a && a.events.some(e => e.passCount) && !a.events.some(e => e.passCount && !e.ok),
      people: !!st.people && st.people.groups.some(g => g.name),
      ziel: !!st.copied,
    };
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('done', !!done[b.dataset.tab]));
  }
  function setSrcName() {
    $('#srcName').textContent = st.src ? '· ' + st.src.name : '';
    $('#srcInfo').textContent = st.src
      ? st.src.name + '\n' + (st.items ? T('{0} Dateien · {1} mit GPS', st.items.length, st.items.filter(i => i.hasGps).length) : T('Noch nicht eingelesen.'))
      : T('Noch keine Quelle gewählt.');
  }
  const setDstName = () => { $('#dstName').textContent = st.dst ? st.dst.name : T('Noch kein Zielordner gewählt.'); };
  function netState() {
    const on = [st.s.tiles && T('Kartenhintergrund'), st.s.geocode && T('Ortsnamen')].filter(Boolean);
    const el = $('#netState');
    el.className = on.length ? 'net online' : 'net offline';
    el.textContent = on.length ? `🌐 ${T('Online')}: ${on.join(', ')}` : '● ' + T('Vollständig offline');
    el.title = on.length ? T('Diese Funktionen senden Anfragen an OpenStreetMap. Abschalten in den Einstellungen.') : T('Es werden keine Daten ins Internet gesendet.');
  }

  // ---------------- Einstellungen ----------------
  // Einstellungen je Arbeitsschritt in die Seitenleiste, Haekchen ins Ribbon
  function buildSettings() {
    for (const box of document.querySelectorAll('.settings[data-sections]')) {
      box.innerHTML = '';
      for (const name of box.dataset.sections.split(',')) {
        const sec = Settings.SCHEMA.find(s => s.section === name);
        const body = h('div', { class: 'sec-body' });
        for (const it of sec.items) body.append(it.type === 'cats' ? h('div', { id: 'catEditor' }) : settingRow(it));
        if (sec.section === 'Ortsnamen') {
          body.append(h('div', { class: 'row' },
            h('button', { onclick: async () => { if (await Ask.confirm(T('Gespeicherte Ortsnamen löschen?'))) { Geo.clear(); recompute(); } } }, T('Cache leeren')),
            h('span', { id: 'geoCacheInfo', class: 'hint' })));
        }
        const closed = ['Sonderordner', 'Bilder ohne GPS', 'Ortsnamen', 'Karte'].includes(sec.section) || (sec.section === 'Filter' && !filterActive());
        box.append(h('details', { class: 'sec', open: !closed, 'data-sec': sec.section },
          h('summary', {}, T(sec.section),
            sec.online ? h('span', { class: 'badge-online', title: T('Nutzt das Internet') }, '🌐 online') : null),
          body));
      }
    }
    for (const box of document.querySelectorAll('.gchecks[data-checks]')) {
      box.innerHTML = '';
      for (const key of box.dataset.checks.split(',')) {
        const it = Settings.byKey[key];
        const cb = h('input', { type: 'checkbox', 'data-skey': key, checked: !!st.s[key] });
        cb.onchange = () => setSetting(it, cb.checked);
        const [ic, cls] = RIBBON_ICONS[key] || ['i-check', 'c-view'];
        box.append(toggleBtn(cb, ic, cls, ribbonLabel(it) + (it.online ? ' 🌐' : ''), it.help ? T(it.help) : '', key));
      }
    }
    renderCats();
    refreshDeps();
  }
  const RIBBON_LABELS = { recursive: 'Unterordner', includePhotos: 'Fotos', includeVideos: 'Videos', geocode: 'Ortsnamen (OSM)',
    homeAuto: 'Wohnort automatisch', autoDaily: 'Alltagsorte automatisch', vacEnabled: 'Urlaube', tripEnabled: 'Ausflüge',
    workEnabled: 'Dienstreisen', personFolders: 'Personenordner anlegen', monthFolders: 'Monatsordner', dupSkip: 'Duplikate überspringen', lowerExt: 'Endung klein', mapExport: 'Fotoübersicht (_fotos.html)' };
  const ribbonLabel = it => T(RIBBON_LABELS[it.key] || it.label);
  const RIBBON_ICONS = { vacEnabled: ['i-vac', 'c-vac'], tripEnabled: ['i-trip', 'c-trip'], workEnabled: ['i-work', 'c-work'],
    personFolders: ['i-faces', 'c-face'], monthFolders: ['i-folder', 'c-file'], dupSkip: ['i-copy', 'c-view'], lowerExt: ['i-tag', 'c-view'], mapExport: ['i-map', 'c-zone'] };
  // Ein-/Aus-Schalter im Ribbon: grosser Knopf mit Symbol, eingeschaltet = hinterlegt (das Kaestchen ist unsichtbar)
  function toggleBtn(cb, ic, cls, text, title = '', key = null) {
    return h('label', { class: `big tog ${cls}`, title, 'data-key': key },
      cb, icon(ic), h('span', {}, text));
  }
  // feste Schalter aus index.html (<label class="big tog" data-icon=… > <input> Text</label>) mit Symbol versehen
  for (const l of document.querySelectorAll('label.tog[data-icon]')) {
    const text = [...l.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    [...l.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove());
    l.append(icon(l.dataset.icon), h('span', {}, text));
  }

  // Wert setzen und alle Eingaben dafuer (Seitenleiste + Ribbon) angleichen
  function setSetting(it, val) {
    st.s[it.key] = val;
    Settings.save(st.s);
    document.querySelectorAll(`[data-skey="${it.key}"]`).forEach(e => { if (e.type === 'checkbox') e.checked = !!val; else if (e.value !== String(val)) e.value = val; });
    refreshDeps();
    onSettingChanged(it);
  }

  function settingRow(it) {
    const id = 'set-' + it.key;
    let input;
    const v = st.s[it.key];
    if (it.type === 'bool') input = h('input', { type: 'checkbox', id, checked: !!v });
    else if (it.type === 'num') input = h('input', { type: 'number', id, value: v, min: it.min, step: it.step || 1 });
    else if (it.type === 'select') input = h('select', { id }, it.options.map(([val, lab]) => h('option', { value: val, selected: String(v) === val }, T(lab))));
    else if (it.type === 'area') input = h('textarea', { id, rows: 3 }, v);
    else if (it.type === 'date' || it.type === 'time') input = h('input', { type: it.type, id, value: v });
    else if (it.type === 'zone') input = h('select', { id, class: 'zone-select' });
    else if (it.type === 'weekdays') {
      input = h('span', { id, class: 'weekdays' }, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) =>
        h('label', {}, h('input', { type: 'checkbox', 'data-i': i, checked: v[i] === '1' }), T(d))));
    }
    else input = h('input', { type: 'text', id, value: v });
    if (it.type !== 'weekdays') input.dataset.skey = it.key;

    const read = () => it.type === 'bool' ? input.checked
      : it.type === 'num' ? parseFloat(input.value)
      : it.type === 'weekdays' ? [...input.querySelectorAll('input')].map(c => c.checked ? '1' : '0').join('')
      : input.value;
    const apply = () => {
      const val = read();
      if (it.type === 'num' && !Number.isFinite(val)) return;
      setSetting(it, val);
    };
    const deb = Util.debounce(apply, 400);
    const instant = ['bool', 'select', 'zone', 'weekdays', 'date', 'time'].includes(it.type);
    input.addEventListener(instant ? 'change' : 'input', instant ? apply : deb);

    const label = h('label', { for: id, class: 'lab' }, T(it.label), it.online ? h('span', { class: 'badge-online' }, '🌐') : null);
    const row = h('div', { class: `row row-${it.type}`, 'data-key': it.key },
      it.type === 'bool' ? [input, label] : [label, input],
      it.help ? h('div', { class: 'hint' }, T(it.help)) : null);
    return row;
  }

  function refreshDeps() {
    for (const it of Settings.SCHEMA.flatMap(s => s.items)) {
      let on = true;
      for (let d = it.dep; d && on; d = Settings.byKey[d]?.dep) on = !!st.s[d];
      for (const row of document.querySelectorAll(`.row[data-key="${it.key}"], .tog[data-key="${it.key}"]`)) {
        row.classList.toggle(row.classList.contains('tog') ? 'dis' : 'disabled', !on);
        row.querySelectorAll('input,select,textarea').forEach(e => { e.disabled = !on; });
      }
    }
  }

  const FILTER_KEYS = Settings.SCHEMA.find(s => s.section === 'Filter').items.map(i => i.key);
  const filterActive = () => FILTER_KEYS.some(k => String(st.s[k]) !== String(Settings.byKey[k].def) && k !== 'filterZoneMode');
  function resetFilter() {
    for (const k of FILTER_KEYS) st.s[k] = Settings.byKey[k].def;
    Settings.save(st.s);
    buildSettings();
    renderZoneSelect();
    $('#filterBadge').hidden = true;
    recompute();
  }

  function onSettingChanged(it) {
    netState();
    $('#filterBadge').hidden = !filterActive();
    if (it.level === 'map') { setTiles(); return; }
    if (it.level === 'faces') { status(T('Gilt für Fotos, die neu analysiert werden.')); return; }
    if (it.level === 'scan') { if (st.items) status(T('Geändert: bitte neu einlesen („Einlesen“).')); return; }
    if (it.level === 'date' && st.items) for (const i of st.items) Meta.applyDate(i, st.s);
    if (it.key === 'customCats') kindsChanged();
    recompute();
    if (it.key === 'geocode' && st.s.geocode) geocode();  // eingeschaltet: fehlende Ortsnamen gleich holen
  }

  // ---------------- Eigene Kategorien ----------------
  const CAT_FROM = [['any', 'alle Ereignisse'], ['vac', 'Urlaube'], ['trip', 'Ausflüge'], ['work', 'Dienstreisen']];
  const CAT_WEEK = [['any', 'egal'], ['weekend', 'mit Wochenende (Sa/So)'], ['onlyweekend', 'nur am Wochenende'], ['workdays', 'nur Werktage (Mo–Fr)']];
  let catTimer;
  const saveCats = cats => { clearTimeout(catTimer); st.s.customCats = cats; Settings.save(st.s); kindsChanged(); recomputeSoon(); };
  const saveCatsSoon = cats => { clearTimeout(catTimer); catTimer = setTimeout(() => saveCats(cats), 400); };

  function addCat(preset) {
    const cats = [...(st.s.customCats || []), Settings.newCat(preset)];
    saveCats(cats);
    renderCats();
    showTab('events');
    const sec = document.querySelector('.sec[data-sec="Eigene Kategorien"]');
    if (sec) sec.open = true;
    setTimeout(() => { const el = document.querySelector('#catEditor .cat:last-of-type input.cat-name'); el?.focus(); el?.select(); }, 50);
  }

  function renderCats() {
    const box = $('#catEditor');
    if (!box) return;
    box.innerHTML = '';
    const cats = (st.s.customCats || []).map(c => ({ ...c }));
    const commit = (structural) => { if (structural) { saveCats(cats.map(c => ({ ...c }))); renderCats(); } else saveCatsSoon(cats.map(c => ({ ...c }))); };
    box.append(h('div', { class: 'hint' }, T('Sortieren erkannte Ereignisse nach eigenen Regeln in eigene Ordner, z. B. „Fernreise: Urlaub ab 800 km“. Leere Felder = egal. Die erste passende Kategorie gewinnt.')));
    const counts = {};
    for (const ev of st.analysis?.events || []) counts[ev.autoKind] = (counts[ev.autoKind] || 0) + 1;
    const mshort = (Util.MONTHS[I18n.lang === 'en' ? 'en' : 'de-DE']).map(m => m.slice(0, 3));

    cats.forEach((c, i) => {
      const set = (k, v, structural) => { c[k] = v; commit(structural); };
      const num = (k, ph) => h('input', { type: 'number', min: 0, value: c[k] ?? '', placeholder: ph, oninput: e => set(k, e.target.value === '' ? '' : +e.target.value) });
      const sel = (k, opts) => h('select', { onchange: e => set(k, e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: (c[k] || opts[0][0]) === v }, T(l))));
      const nameIn = h('input', { type: 'text', class: 'cat-name', value: c.name, placeholder: T('Name'),
        oninput: e => { const old = c.name; c.name = e.target.value; if (!c.folder || c.folder === old) { c.folder = c.name; folderIn.value = c.name; } commit(false); } });
      const folderIn = h('input', { type: 'text', value: c.folder, placeholder: c.name, oninput: e => set('folder', e.target.value) });
      const months = h('span', { class: 'months' }, mshort.map((m, mi) => h('label', { title: Util.MONTHS[I18n.lang === 'en' ? 'en' : 'de-DE'][mi] },
        h('input', { type: 'checkbox', checked: (c.months || '111111111111')[mi] === '1', onchange: e => {
          const a = [...(c.months || '111111111111')]; a[mi] = e.target.checked ? '1' : '0'; set('months', a.join(''));
        } }), m)));
      const zoneSel = h('select', { onchange: e => set('zone', e.target.value) },
        h('option', { value: '' }, T('– egal –')),
        st.zones.map(z => h('option', { value: z.id, selected: c.zone === z.id }, `${z.name || MapView.ZONE_TYPES[z.type]} (${z.r} km)`)));
      const n = counts['c:' + c.id] || 0;
      box.append(h('div', { class: 'cat' + (c.on === false ? ' off' : '') },
        h('div', { class: 'cat-head' },
          h('input', { type: 'checkbox', checked: c.on !== false, title: T('Ein/aus'), onchange: e => set('on', e.target.checked, true) }),
          h('input', { type: 'color', value: c.color || '#f08c00', title: T('Farbe'), onchange: e => set('color', e.target.value, true) }),
          nameIn,
          h('button', { class: 'mini', title: T('Nach oben (wird zuerst geprüft)'), disabled: i === 0, onclick: () => { [cats[i - 1], cats[i]] = [cats[i], cats[i - 1]]; commit(true); } }, '▲'),
          h('button', { class: 'mini', title: T('Nach unten'), disabled: i === cats.length - 1, onclick: () => { [cats[i + 1], cats[i]] = [cats[i], cats[i + 1]]; commit(true); } }, '▼'),
          h('button', { class: 'mini', title: T('Löschen'), onclick: async () => { if (await Ask.confirm(T('Kategorie „{0}“ löschen?', c.name))) { cats.splice(i, 1); commit(true); } } }, icon('i-trash'))),
        h('div', { class: 'cat-grid' },
          h('label', {}, T('Gilt für')), sel('from', CAT_FROM),
          h('label', {}, T('Entfernung (km)')), h('span', { class: 'range' }, num('kmMin', T('ab')), '–', num('kmMax', T('bis'))),
          h('label', {}, T('Dauer (Tage)')), h('span', { class: 'range' }, num('daysMin', T('ab')), '–', num('daysMax', T('bis'))),
          h('label', {}, T('Mindestens Bilder')), num('picsMin', T('egal')),
          h('label', {}, T('Wochentage')), sel('week', CAT_WEEK),
          h('label', {}, T('Monate')), months,
          h('label', {}, T('Zone')), zoneSel,
          h('label', {}, T('Ort enthält')), h('input', { type: 'text', value: c.place || '', placeholder: T('egal'), oninput: e => set('place', e.target.value) }),
          h('label', {}, T('Personen')), h('input', { type: 'text', value: c.persons || '', placeholder: T('egal (kommagetrennt)'), oninput: e => set('persons', e.target.value) }),
          h('label', {}, T('Ordnername')), folderIn),
        h('div', { class: 'hint' }, c.on === false ? T('ausgeschaltet') : T('{0} Ereignisse passen', n))));
    });
    const preset = h('select', {}, Settings.CAT_PRESETS.map((p, i) => h('option', { value: i }, I18n.lang === 'en' ? p.nameEn : p.name)));
    box.append(h('div', { class: 'row cat-add' }, preset,
      h('button', { onclick: () => addCat(Settings.CAT_PRESETS[preset.value]) }, '+ ' + T('Kategorie hinzufügen'))));
  }

  // Arten haben sich geaendert (eigene Kategorien, Sprache): abhaengige Anzeigen neu aufbauen
  function kindsChanged() {
    Analyze.kinds(st.s);
    renderKindFilter();
    renderLegend();
    Review.buildKinds();
  }
  function renderKindFilter() {
    const sel = $('#fltKind'), cur = sel.value;
    sel.innerHTML = '';
    sel.append(h('option', { value: '' }, T('Alle')), ...Analyze.kinds(st.s).map(k => h('option', { value: k.id }, k.plural)));
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
  }
  function renderLegend() {
    $('#legend').innerHTML = '';
    const list = Analyze.kinds(st.s).filter(k => k.id !== 'none').map(k => [k.color, k.label])
      .concat([[MapView.COLORS.home, T('Zuhause / Alltag')], [MapView.COLORS.other, T('Sonstige')]]);
    for (const [c, n] of list) $('#legend').append(h('span', {}, h('i', { style: `background:${c}` }), n));
  }

  // ---------------- Berechnung ----------------
  function recompute(fresh) {
    $('#geoCacheInfo') && ($('#geoCacheInfo').textContent = T('{0} Orte gespeichert', Geo.size()));
    if (!st.items) { updateButtons(); return; }
    // Personen aus der Gesichtserkennung den Bildern zuordnen
    clusterPeople(fresh === true);
    st.analysis = Analyze.run(st.items, st.s, st.zones, st.overrides);
    st.plan = Plan.build(st.analysis, st.s, st.zones);
    if (st.selected) st.selected = st.analysis.events.find(e => e.id === st.selected.id) || null;
    MapView.render(st.analysis, st.zones);
    renderEvents();
    renderPreview();
    renderZoneList();
    renderCatCounts();
    setSrcName();
    mapHint();
    if (curTab === 'review') Review.render();
    if (curTab === 'people') People.render();
    updateButtons();
    const evs = st.analysis.events.filter(e => e.kind !== 'none' && e.passCount);
    $('#cntEvents').textContent = evs.length;
    const open = st.analysis.events.filter(e => e.passCount && !e.ok).length;
    $('#cntReview').textContent = open || '';
    if (!document.body.classList.contains('busy')) {
      status(T('{0} Dateien · {1} mit GPS · {2} Ereignisse · {3} Kopien geplant', st.items.length, st.analysis.withGps, evs.length, st.plan.ops.length) +
        (st.plan.filtered ? T(' · {0} durch Filter ausgeblendet', st.plan.filtered) : ''));
    }
  }
  const recomputeSoon = Util.debounce(recompute, 150);
  // Trefferzahl unter jeder Kategorie aktualisieren, ohne den Editor neu aufzubauen (Fokus bleibt)
  function renderCatCounts() {
    const counts = {};
    for (const ev of st.analysis?.events || []) counts[ev.autoKind] = (counts[ev.autoKind] || 0) + 1;
    document.querySelectorAll('#catEditor .cat').forEach((el, i) => {
      const c = st.s.customCats[i];
      const hint = el.querySelector(':scope > .hint');
      if (c && hint) hint.textContent = c.on === false ? T('ausgeschaltet') : T('{0} Ereignisse passen', counts['c:' + c.id] || 0);
    });
  }

  // ---------------- Ordner ----------------
  const fsSupported = 'showDirectoryPicker' in window;

  async function pickSrc() {
    let dir;
    try { dir = await showDirectoryPicker({ id: 'fs-src', mode: 'readwrite' }); }
    catch (e) { if (e.name !== 'AbortError') Ask.alert(e.message); return; }
    await useSource(dir);
    FolderTree.render();
  }
  // Quelle setzen (aus dem Windows-Ordnerfenster oder dem Ordnerbaum), Stand dieses Ordners laden, einlesen
  async function useSource(dir) {
    st.src = dir;
    await Util.idb.set('srcHandle', dir).catch(() => {});
    await openProject(dir);
    st.items = st.people = st.faceCache = null;
    setSrcName();
    updateButtons();
    await scan();
  }
  async function pickDst() {
    try {
      st.dst = await showDirectoryPicker({ id: 'fs-dst', mode: 'readwrite' });
      if (st.src && await st.src.isSameEntry(st.dst)) { Ask.alert(T('Ziel darf nicht gleich der Quelle sein.')); st.dst = null; return; }
      await Util.idb.set('dstHandle', st.dst);
      setDstName();
      if (st.plan) renderPreview();
      updateButtons();
    } catch (e) { if (e.name !== 'AbortError') Ask.alert(e.message); }
  }
  async function ensurePermission(handle, mode) {
    if ((await handle.queryPermission({ mode })) === 'granted') return true;
    return (await handle.requestPermission({ mode })) === 'granted';
  }

  async function scan() {
    if (!st.src) return;
    // Schreibzugriff nur fuer die Stand-Datei im Ordner; abgelehnt = nur lesen, Stand bleibt im Browser
    const rw = await ensurePermission(st.src, 'readwrite').catch(() => false);
    if (!rw && !(await ensurePermission(st.src, 'read'))) return;
    await loadStateFile();
    if (!rw) showFileInfo('noperm');
    st.abort = new AbortController();
    busy(true);
    status(T('Lese Dateien …'), -1);
    try {
      const t0 = Date.now();
      st.items = await Meta.scan(st.src, st.s, t => status(t, -1), st.abort.signal);
      st.faceCache = await Faces.loadCache(st.src.name);
      st.oldFaces = !st.faceCache && !!(await Util.idb.get('faces:' + st.src.name).catch(() => null));
      busy(false);
      recompute();
      MapView.fitAll(st.analysis);
      log(T('Eingelesen: {0} Dateien aus „{1}“ in {2} s', st.items.length, st.src.name, ((Date.now() - t0) / 1000).toFixed(0)));
    } catch (e) { busy(false); status(T('Fehler beim Einlesen: {0}', e.message)); return; }
    if (st.s.geocode) geocode();
  }

  // Fehlende Ortsnamen holen (nur wenn „Ortsnamen (OSM)“ eingeschaltet ist; laeuft nach dem Einlesen und beim Einschalten)
  async function geocode() {
    if (!st.analysis || !st.s.geocode || document.body.classList.contains('busy')) return;
    st.abort = new AbortController();
    busy(true);
    try {
      const r = await Geo.fetchMissing(st.analysis.events, st.s, t => status(t, -1), st.abort.signal);
      if (r.fetched || r.errors) log(T('Ortsnamen geholt: {0}', r.fetched) + (r.errors ? T(', Fehler: {0}', r.errors) : ''));
    } finally { busy(false); recompute(); }
  }

  // ---------------- Gesichter ----------------
  async function scanFaces() {
    if (!st.items) {
      const t = st.src ? T('Zuerst in Schritt 1 „Einlesen“ klicken.') : T('Zuerst in Schritt 1 eine Quelle wählen und einlesen.');
      status(t); Ask.alert(t, { kind: 'info' }); return;
    }
    if (!(await ensurePermission(st.src, 'read'))) return;
    st.abort = new AbortController();
    busy(true);
    status(T('Lade Gesichtsmodelle …'), -1);
    let failed = '';
    try {
      const threads = await Faces.load();
      log(T('Gesichtserkennung gestartet (lokal, YuNet + SFace, {0} Prozessorkerne gleichzeitig)', threads));
      const r = await Faces.scanAll(st.items, st.src.name, st.s, st.faceNames, p => {
        const left = p.fresh ? (p.secs / p.fresh) * (p.total - p.done) : 0;
        status(T('Gesichter erkennen … {0} / {1} Fotos · {2} Gesichter · noch ca. {3} min', p.done, p.total, p.found, Math.ceil(left / 60)), p.done / p.total);
      }, st.abort.signal);
      st.faceCache = r.cache;
      st.oldFaces = false;
      if (r.namesChanged) saveProject();
      log(st.abort.signal.aborted ? T('Gesichtserkennung abgebrochen – „Gesichter erkennen“ setzt fort.') : T('Gesichtserkennung fertig.'));
    } catch (e) {
      log(T('Gesichtserkennung fehlgeschlagen: {0}', e.message), 'err');
      showLog(true);
      failed = T('Gesichtserkennung fehlgeschlagen: {0}', e.message);
    }
    finally { busy(false); recompute(); People.render(); if (failed) status(failed); }
  }

  // Namen fuer Gesichter setzen (null = Name entfernen, '#ignore' = ignorieren)
  // quick: nur die Gesichter neu gruppieren (Schnell zuordnen), der Rest folgt mit recompute() beim Schliessen
  // changes: { faceId: Name | null }. Jede Aenderung landet im Verlauf fuer „Rückgängig“ (Strg+Z).
  const faceHistory = [];
  function applyFaceNames(changes, quick = false, record = true) {
    if (record) {
      faceHistory.push(Object.fromEntries(Object.keys(changes).map(id => [id, st.faceNames[id] ?? null])));
      if (faceHistory.length > 300) faceHistory.shift();
    }
    for (const [id, n] of Object.entries(changes)) { if (n) st.faceNames[id] = n; else delete st.faceNames[id]; }
    saveProject();
    if (quick) { clusterPeople(); return; }
    recompute();
    People.render();
  }
  // Gesichter, deren Foto die Person schon hat (bestaetigt an einem anderen Gesicht oder mehrmals in ids)
  function samePhoto(ids, name) {
    const photo = id => id.slice(0, id.lastIndexOf('#'));
    const own = new Set(ids), has = new Set(), out = [];
    for (const [id, n] of Object.entries(st.faceNames)) if (n === name && !own.has(id)) has.add(photo(id));
    for (const id of ids) { const ph = photo(id); if (has.has(ph)) out.push(id); else has.add(ph); }
    return out;
  }
  async function setFaceNames(ids, name, quick = false) {
    if (name && name[0] !== '#' && name[0] !== '!') {
      const clash = samePhoto(ids, name);
      if (clash.length) {
        const n = new Set(clash.map(id => id.slice(0, id.lastIndexOf('#')))).size;
        const all = clash.length === ids.length;
        if (!await Ask.confirm(all
          ? T('{0} ist auf diesem Foto schon vorhanden.\n\nOK = trotzdem zuordnen (wird bei „Erneut prüfen“ als Fehler gemeldet)\nAbbrechen = nichts ändern', name)
          : T('{0} ist auf {1} dieser Fotos schon vorhanden.\n\nOK = trotzdem alle zuordnen (wird bei „Erneut prüfen“ als Fehler gemeldet)\nAbbrechen = diese Gesichter auslassen, die anderen zuordnen', name, n))) {
          if (all) return;
          const skip = new Set(clash);
          ids = ids.filter(id => !skip.has(id));
        }
      }
    }
    applyFaceNames(Object.fromEntries(ids.map(id => [id, name])), quick);
  }
  function undoFaceNames(quick = false) {
    const last = faceHistory.pop();
    if (!last) { status(T('Nichts zum Rückgängigmachen.')); return false; }
    applyFaceNames(last, quick, false);
    status(T('Rückgängig: {0} Gesichter', Object.keys(last).length));
    return true;
  }
  // fresh: ohne die bisherige Einteilung neu gruppieren (sonst bleiben offene Gesichter moeglichst in ihrer Gruppe)
  function clusterPeople(fresh = false) {
    const lib = st.s.faceUseLib ? st.faceLib : null;
    const sig = [st.s.faceThreshold, st.s.faceWindow, lib ? Object.keys(lib).length : -1].join();
    const prev = !fresh && st.people?.sig === sig ? st.people : null;
    st.people = st.faceCache ? Faces.cluster(st.items, st.faceCache, st.faceNames, st.s.faceThreshold, lib, st.s.faceWindow, prev) : null;
    for (const it of st.items) it.persons = st.people?.byItem.get(it.id);
  }
  const faceName = (it, i) => {
    const n = st.faceNames[`${it.path}#${i}`];
    if (n && n[0] !== '#' && n[0] !== '!') return n;
    const g = st.people?.groups.find(g => g.name && g.faces.some(f => f.id === `${it.path}#${i}`));
    return g ? g.name + ' ?' : '';
  };

  async function copy() {
    if (!st.plan) return;
    if (!st.dst) { await pickDst(); if (!st.dst) return; }
    if (!(await ensurePermission(st.dst, 'readwrite'))) return;
    if (!(await ensurePermission(st.src, 'read'))) return;
    const bytes = st.plan.ops.reduce((a, o) => a + o.item.size, 0);
    if (!await Ask.confirm(T('{0} Kopien ({1}) nach „{2}“ schreiben?\n\nOriginale bleiben unverändert, vorhandene Dateien werden nicht überschrieben.', st.plan.ops.length, fmtBytes(bytes), st.dst.name))) return;
    st.abort = new AbortController();
    busy(true);
    showLog(true);
    log(T('Kopieren gestartet: {0} Dateien nach „{1}“', st.plan.ops.length, st.dst.name));
    try {
      const r = await Copier.run(st.dst, st.plan.ops, p => status(
        T('Kopiere … {0} / {1} · {2} · {3}/s', p.done, p.total, fmtBytes(p.bytes), fmtBytes(p.rate)) + (p.errors ? T(' · {0} Fehler', p.errors) : ''), p.done / p.total), st.abort.signal);
      const msg = T('{0}: {1} kopiert, {2} übersprungen (existierten), {3} Fehler · Protokoll: {4}', r.aborted ? T('Abgebrochen') : T('Fertig'), r.copied, r.skipped, r.errors, r.logName);
      log(msg);
      if (!r.aborted && !r.errors) st.copied = true;
      for (const l of r.log.filter(l => l.err).slice(0, 50)) log(`  ${l.quelle} → ${l.ziel}: ${l.status}`, 'err');
      status(msg);
      if (!r.aborted && st.s.mapExport) await exportMap(st.dst, { failed: new Set(r.log.filter(l => l.err).map(l => l.ziel)) });
    } catch (e) { log(T('Fehler: {0}', e.message), 'err'); status(T('Fehler: {0}', e.message)); }
    finally { busy(false); }
  }

  // Fotoübersicht (Karte + Ordner) schreiben: nach dem Kopieren ins Ziel oder ohne Kopieren mit Links auf die Originale
  async function exportMap(dir = st.dst, opts = {}) {
    try {
      const r = await MapExport.write(dir, st.plan, st.analysis, st.s, opts,
        (n, total) => status(opts.thumbs === false ? T('Schreibe Fotoübersicht …') : T('Schreibe Fotoübersicht … {0} / {1} Vorschaubilder', n, total), n / total), st.abort?.signal);
      if (r) {
        const msg = T('Fotoübersicht gespeichert: „{0}“ in „{1}“ ({2} Dateien, {3} mit Standort) – per Doppelklick öffnen.', r.name, dir.name, r.count, r.gps);
        log(msg); status(msg);
      }
    } catch (e) { log(T('Fotoübersicht konnte nicht geschrieben werden: {0}', e.message), 'err'); }
  }
  async function saveMap() {
    if (!st.plan) return;
    if (!st.dst) { await pickDst(); if (!st.dst) return; }
    if (!(await ensurePermission(st.dst, 'readwrite')) || !(await ensurePermission(st.src, 'read'))) return;
    st.abort = new AbortController();
    busy(true);
    showLog(true);
    try { await exportMap(); } finally { busy(false); }
  }

  // Verzeichnis ohne Kopieren: nur _fotos.html + Vorschaubilder, die Links zeigen auf die Originale.
  // Liegt die Quelle im gewaehlten Ordner (oder umgekehrt), gehen relative Links; sonst braucht es den Pfad der Quelle.
  const fileUrl = p => {
    const s = p.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    const unc = s.startsWith('//');
    return (unc ? 'file://' : 'file:///') + s.replace(/^\/+/, '').split('/').map((x, i) => i ? encodeURIComponent(x) : x).join('/') + '/';
  };
  async function saveIndex() {
    if (!st.plan || !st.src) return;
    const how = await Ask.confirm(T('Es wird nichts kopiert oder verschoben. Es entsteht nur „{0}“ (Karte + Ordnerübersicht) mit Links auf die Originale.\n\nMit Vorschaubildern: zusätzlich kleine Bilder (ca. 10–20 KB je Foto) im Ordner „{1}“ – die Übersicht blättert damit schnell.\nOhne: nur die eine Datei, die Übersicht lädt dann jedes Original (langsamer, vor allem übers Netzwerk).\n\nDanach den Ordner wählen, in den die Übersicht kommt – am einfachsten der Quellordner selbst.', T('_fotos') + '.html', T('_fotos')),
      { title: T('Verzeichnis ohne Kopieren'), yes: T('Mit Vorschaubildern'), extra: [{ label: T('Ohne Vorschaubilder'), value: 'plain' }] });
    if (!how) return;
    let dir;
    try { dir = await showDirectoryPicker({ id: 'fs-index', mode: 'readwrite', startIn: st.src }); }
    catch (e) { if (e.name !== 'AbortError') Ask.alert(e.message); return; }
    if (!(await ensurePermission(st.src, 'read'))) return;
    let base = null;
    const down = await dir.resolve(st.src);       // Quelle liegt im gewaehlten Ordner (oder ist es)
    if (down) base = down.map(x => encodeURIComponent(x) + '/').join('');
    else {
      const up = await st.src.resolve(dir);       // gewaehlter Ordner liegt in der Quelle
      if (up) base = '../'.repeat(up.length);
    }
    if (base === null) {
      const p = await Ask.prompt(T('Der gewählte Ordner liegt nicht neben der Quelle „{0}“.\nDamit die Links funktionieren, bitte den vollständigen Pfad der Quelle eingeben (aus der Adresszeile des Explorers kopieren):', st.src.name),
        localStorage.getItem('fotosortierer.srcPath') || '');
      if (!p || !p.trim()) return;
      localStorage.setItem('fotosortierer.srcPath', p.trim());
      base = fileUrl(p);
    }
    st.abort = new AbortController();
    busy(true);
    showLog(true);
    try { await exportMap(dir, { linkBase: base, thumbs: how !== 'plain' }); } finally { busy(false); }
  }

  function log(text, cls = '') {
    const t = new Date();
    $('#logList').prepend(h('div', { class: 'log ' + cls }, `${Util.pad(t.getHours())}:${Util.pad(t.getMinutes())}:${Util.pad(t.getSeconds())}  ${text}`));
    if ($('#logPanel').hidden) $('#btnLog').classList.add('new');
  }
  function showLog(on = $('#logPanel').hidden) {
    $('#logPanel').hidden = !on;
    if (on) $('#btnLog').classList.remove('new');
  }

  // ---------------- Arbeitsschritte (Register) ----------------
  const TABS = ['quelle', 'orte', 'events', 'review', 'people', 'ziel'];
  const VIEW_OF = { quelle: 'map', orte: 'map', events: 'events', review: 'review', people: 'people', ziel: 'ziel' };
  let curTab = 'quelle';
  function showTab(name) {
    if (name === 'map') name = 'orte';
    curTab = name;
    document.body.dataset.tab = name;
    localStorage.setItem('fotosortierer.tab', name);
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.rpanel, .pp').forEach(p => p.classList.toggle('on', p.dataset.tab === name));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.dataset.view === VIEW_OF[name]));
    if (VIEW_OF[name] === 'map') setTimeout(MapView.invalidate, 0);
    if (name !== 'orte' && MapView.addMode) MapView.setAddMode(false);
    mapHint();
    if (name === 'review') Review.render();
    if (name === 'people') People.render();
  }
  // Am Ende jedes Ribbons: Knopf zum naechsten Schritt
  function addNextButtons() {
    document.querySelectorAll('.grp.next').forEach(g => g.remove());
    const names = { orte: 'Orte', events: 'Ereignisse', review: 'Prüfen', people: 'Personen', ziel: 'Ziel & Kopieren' };
    TABS.forEach((t, i) => {
      const next = TABS[i + 1];
      if (!next) return;
      $(`.rpanel[data-tab="${t}"]`).append(h('div', { class: 'grp next' },
        h('div', { class: 'gbody' }, h('button', { class: 'big next-btn', onclick: () => showTab(next) },
          icon('i-next'), h('span', {}, T('Weiter: {0} {1}', i + 2, T(names[next]))))),
        h('div', { class: 'gcap' }, T('Nächster Schritt'))));
    });
  }
  // Hinweis oben auf der Karte, was als Naechstes zu tun ist
  function mapHint() {
    const el = $('#hint');
    if (!el) return;
    let t = '';
    if (!st.src) t = T('Schritt 1: Oben „Ordner wählen“.');
    else if (!st.items) t = T('Quelle „{0}“ – oben „Einlesen“ klicken.', st.src.name);
    else if (MapView.addMode) t = T('Auf die Karte klicken, um die Zone zu setzen.');
    else if (curTab === 'quelle' && st.analysis && !st.analysis.withGps) t = T('Keine Bilder mit GPS – Urlaube und Ausflüge können nicht erkannt werden.');
    el.textContent = VIEW_OF[curTab] === 'map' ? t : '';
  }

  // ---------------- Zonen ----------------
  function addZone(lat, lon, preset = {}) {
    const z = { id: Date.now().toString(36), name: '', type: 'named', r: 2, lat, lon, ...preset };
    st.zones.push(z);
    saveZones();
    recompute();
    setTimeout(() => document.querySelector(`[data-zone="${z.id}"] input`)?.focus(), 50);
  }

  // Zonen-Auswahl im Filter aktuell halten
  function renderZoneSelect() {
    const sel = $('#set-filterZone');
    if (!sel) return;
    sel.innerHTML = '';
    sel.append(h('option', { value: '' }, T('– keine –')),
      ...st.zones.map(z => h('option', { value: z.id, selected: st.s.filterZone === z.id }, `${z.name || MapView.ZONE_TYPES[z.type]} (${z.r} km)`)));
  }

  function renderZoneList() {
    renderZoneSelect();
    const list = $('#zoneList');
    list.innerHTML = '';
    if (!st.zones.length) list.append(h('div', { class: 'muted' }, T('Noch keine Zonen. Oben „Zone setzen“ und dann auf die Karte klicken.')));
    for (const z of st.zones) {
      const upd = (k, v) => { z[k] = v; saveZones(); recomputeSoon(); };
      list.append(h('div', { class: 'zone', 'data-zone': z.id },
        h('span', { class: 'dot', style: `background:${MapView.ZONE_COLORS[z.type]}` }),
        h('input', { type: 'text', value: z.name, placeholder: T('Name'), oninput: e => upd('name', e.target.value) }),
        h('span', {},
          h('button', { class: 'mini', title: T('Auf Karte zeigen'), onclick: () => MapView.focus(z.lat, z.lon) }, icon('i-target')),
          h('button', { class: 'mini', title: T('Löschen'), onclick: () => { st.zones = st.zones.filter(x => x !== z); saveZones(); recompute(); } }, icon('i-trash'))),
        h('div', { class: 'zrow' },
          h('select', { onchange: e => upd('type', e.target.value) },
            Object.keys(MapView.ZONE_LABELS).map(k => h('option', { value: k, selected: z.type === k }, MapView.ZONE_TYPES[k]))),
          h('input', { type: 'number', value: z.r, min: 0.1, step: 0.1, title: T('Radius km'), oninput: e => { const v = parseFloat(e.target.value); if (v > 0) upd('r', v); } }),
          h('span', { class: 'unit' }, 'km'))));
    }
  }

  // ---------------- Ereignisse ----------------
  function renderEvents() {
    const tb = $('#eventRows');
    tb.innerHTML = '';
    const a = st.analysis;
    if (!a) return;
    const fKind = $('#fltKind').value, fYear = $('#fltYear').value, fText = $('#fltText').value.toLowerCase();
    const years = [...new Set(a.events.map(e => e.start.getFullYear()))].sort();
    const ySel = $('#fltYear');
    if (ySel.options.length - 1 !== years.length || ySel.options[0].textContent !== T('Alle Jahre')) {
      ySel.innerHTML = '';
      ySel.append(h('option', { value: '' }, T('Alle Jahre')), ...years.map(y => h('option', {}, y)));
      ySel.value = fYear;
    }
    const kinds = Analyze.current;
    for (const ev of a.events) {
      if (!ev.passCount) continue;
      if (fKind && ev.kind !== fKind) continue;
      if (fYear && String(ev.start.getFullYear()) !== fYear) continue;
      if (fText && !ev.place.toLowerCase().includes(fText)) continue;
      const o = st.overrides.events[ev.id] || {};
      const setO = (k, v) => {
        const cur = st.overrides.events[ev.id] || {};
        if (v == null || v === '') delete cur[k]; else cur[k] = v;
        if (Object.keys(cur).length) st.overrides.events[ev.id] = cur; else delete st.overrides.events[ev.id];
        saveOverrides(); recomputeSoon();
      };
      const dir = st.plan.evDir.get(ev);
      tb.append(h('tr', { class: `kind-${ev.kind.replace(':', '-')}${st.selected === ev ? ' selected' : ''}`, title: T('Klick: Bilder anzeigen'),
        onclick: e => { if (e.target.closest('input,select,button')) return; st.selected = st.selected === ev ? null : ev; renderEvents(); } },
        h('td', {}, h('span', { class: 'dot', style: `background:${MapView.color(ev.kind)}` }),
          h('select', { onchange: e => setO('kind', e.target.value === ev.autoKind ? null : e.target.value) },
            kinds.map(k => h('option', { value: k.id, selected: ev.kind === k.id }, k.label + (k.id === ev.autoKind ? ' (auto)' : ''))))),
        h('td', {}, h('input', { type: 'text', class: 'place', value: o.name || '', placeholder: o.name ? '' : ev.place,
          title: T('Ortsname – Quelle: {0}. Leer lassen für automatisch.', ev.placeSrc), onchange: e => setO('name', e.target.value.trim()) })),
        h('td', { class: 'nowrap' }, ev.days > 1 ? `${fmtDate(ev.start)} – ${fmtDate(ev.end)}` : fmtDate(ev.start)),
        h('td', { class: 'num' }, ev.days),
        h('td', { class: 'num' }, ev.weekendDays),
        h('td', { class: 'num', title: ev.passCount < ev.items.length ? T('{0} durch Filter ausgeblendet', ev.items.length - ev.passCount) : '' },
          ev.passCount < ev.items.length ? `${ev.passCount}/${ev.items.length}` : ev.items.length),
        h('td', { class: 'num' }, ev.perDay.toFixed(1)),
        h('td', { class: 'num' }, Math.round(ev.maxKm) + ' km'),
        h('td', { class: 'src' }, ev.placeSrc),
        h('td', { class: 'path' }, dir ? dir.join('/') : '–'),
        h('td', { class: 'nowrap' },
          h('span', { class: 'ok-mark', title: ev.ok ? T('Im Prüfmodus bestätigt') : T('Noch nicht geprüft') }, ev.ok ? '✓' : ''),
          h('button', { class: 'mini', title: T('Auf Karte zeigen'), onclick: () => { showTab('orte'); MapView.fitEvent(ev); } }, icon('i-pin')))));
    }
    renderDetail();
  }

  function renderDetail() {
    st.thumbUrls.forEach(u => URL.revokeObjectURL(u));
    st.thumbUrls = [];
    const box = $('#eventDetail');
    box.innerHTML = '';
    const ev = st.selected;
    if (!ev) { box.hidden = true; return; }
    box.hidden = false;
    box.append(h('div', { class: 'detail-head' },
      h('b', {}, `${ev.place} · ${fmtDate(ev.start)}${ev.days > 1 ? ' – ' + fmtDate(ev.end) : ''}`),
      h('span', { class: 'hint' }, ' ' + T('Häkchen entfernen = Bild nicht in diesem Ereignis-Ordner (bleibt im Monatsordner).')),
      h('button', { class: 'mini', title: T('Schließen'), onclick: () => { st.selected = null; renderEvents(); } }, icon('i-cancel'))));
    const grid = h('div', { class: 'thumbs' });
    const all = [...ev.items, ...ev.excludedItems].sort((a, b) => a.date - b.date);
    for (const it of all.slice(0, 300)) {
      const inEv = !st.overrides.files[it.id];
      const fig = h('figure', { class: inEv ? '' : 'off' });
      const ph = h('div', { class: 'ph' }, it.isVideo ? '🎬' : '🖼');
      fig.append(ph);
      ph.onclick = () => Viewer.open(all, all.indexOf(it));
      loadThumb(it).then(u => {
        if (!u) return;
        st.thumbUrls.push(u);
        const el = it.isVideo ? h('video', { src: u + '#t=0.5', muted: true, preload: 'metadata' }) : h('img', { src: u, decoding: 'async' });
        el.onerror = () => el.replaceWith(ph);
        el.onclick = () => Viewer.open(all, all.indexOf(it));
        ph.replaceWith(el);
      });
      fig.append(h('figcaption', {},
        h('label', {}, h('input', { type: 'checkbox', checked: inEv, onchange: e => {
          if (e.target.checked) delete st.overrides.files[it.id]; else st.overrides.files[it.id] = true;
          saveOverrides(); recomputeSoon();
        } }), ` ${Util.pad(it.date.getDate())}.${Util.pad(it.date.getMonth() + 1)}. ${Util.pad(it.date.getHours())}:${Util.pad(it.date.getMinutes())}`),
        h('span', { class: 'fname', title: it.path }, it.hasGps ? '' : ' ' + T('ohne GPS'))));
      grid.append(fig);
    }
    if (all.length > 300) grid.append(h('div', { class: 'hint' }, T('… und {0} weitere', all.length - 300)));
    box.append(grid);
  }

  // Kleines EXIF-Vorschaubild bevorzugen (schnell, auch fuer HEIC), sonst die Datei selbst
  async function loadThumb(it) {
    try {
      const f = await it.handle.getFile();
      if (!it.isVideo) {
        const t = await exifr.thumbnail(f).catch(() => null);
        if (t) return URL.createObjectURL(new Blob([t], { type: 'image/jpeg' }));
      }
      if (['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v'].includes(it.ext)) return URL.createObjectURL(f);
    } catch { /* Datei nicht lesbar */ }
    return null;
  }

  // ---------------- Vorschau ----------------
  function renderPreview() {
    const a = st.analysis, p = st.plan;
    const sum = $('#previewSummary');
    const bytes = p.ops.reduce((x, o) => x + o.item.size, 0);
    const srcCount = {};
    for (const it of a.items) srcCount[it.dateSrc] = (srcCount[it.dateSrc] || 0) + 1;
    const kinds = {};
    for (const o of p.ops) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
    const kindName = k => ({ month: T('Monatsordner'), rule: T('Sonderordner'), person: T('Personen') })[k] || Analyze.kind(k).folder || k;
    sum.innerHTML = `
      <div class="cards">
        <div><b>${a.items.length - p.filtered}</b>${T('Dateien')}${p.filtered ? ` (${T('{0} gefiltert', p.filtered)})` : ''}</div>
        <div><b>${p.ops.length}</b>${T('Kopien')}</div>
        <div><b>${fmtBytes(bytes)}</b>${T('Gesamt')}</div>
        <div><b>${a.withGps}</b>${T('mit GPS')}</div>
        <div><b>${p.dups.length}</b>${T('Duplikate übersprungen')}</div>
      </div>
      <div class="hint">${T('Kopien je Art')}: ${Object.entries(kinds).map(([k, n]) => `${esc(kindName(k))} ${n}`).join(' · ')}</div>
      <div class="hint">${T('Datum aus')}: ${Object.entries(srcCount).map(([k, n]) => `${esc(T(k))} ${n}`).join(' · ')}</div>`;
    const t = $('#previewTree');
    t.innerHTML = '';
    const root = Plan.tree(p.ops);
    t.append(h('div', { class: 'tree-root' }, (st.dst ? st.dst.name : T('Ziel')) + '/'));
    renderTreeLevel(t, root);
  }

  function renderTreeLevel(container, node) {
    const kids = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
    for (const c of kids) {
      const d = h('details', {}, h('summary', {}, `📁 ${c.name}`, h('span', { class: 'cnt' }, c.count)));
      let rendered = false;
      d.addEventListener('toggle', () => {
        if (!d.open || rendered) return;
        rendered = true;
        const inner = h('div', { class: 'tree-inner' });
        renderTreeLevel(inner, c);
        const files = c.files.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
        const list = files.map(f => f.item);
        files.slice(0, 500).forEach((f, i) => {
          inner.append(h('div', { class: 'tree-file', title: T('Quelle: {0}\nDatum: {1} ({2})\nKlick: Bildansicht', f.item.path, Util.fmtDateTime(f.item.date), T(f.item.dateSrc)),
            onclick: () => Viewer.open(list, i) },
            f.name, h('span', { class: 'from' }, ' ← ' + f.item.name)));
        });
        if (files.length > 500) inner.append(h('div', { class: 'hint' }, T('… und {0} weitere', files.length - 500)));
        d.append(inner);
      });
      container.append(d);
    }
  }

  // ---------------- Export / Import ----------------
  function exportConfig() {
    // gemerkte Personen als Zahlenlisten (4 Nachkommastellen reichen)
    const faceLibrary = Object.fromEntries(Object.entries(st.faceLib).map(([n, vs]) => [n, vs.map(v => Array.from(v, x => +x.toFixed(4)))]));
    const blob = new Blob([JSON.stringify({ settings: st.s, zones: st.zones, overrides: st.overrides, faceNames: st.faceNames, faceLibrary }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'sort-my-pictures-settings.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importConfig() {
    const inp = h('input', { type: 'file', accept: '.json,application/json' });
    inp.onchange = async () => {
      try {
        const j = JSON.parse(await inp.files[0].text());
        if (j.settings) { st.s = { ...Settings.defaults(), ...j.settings }; Settings.save(st.s); }
        if (j.zones) { st.zones = j.zones; saveZones(); }
        if (j.overrides) { st.overrides = j.overrides; saveOverrides(); }
        if (j.faceNames) { st.faceNames = j.faceNames; saveProject(); }
        if (j.faceLibrary) {
          st.faceLib = Object.fromEntries(Object.entries(j.faceLibrary).map(([n, vs]) => [n, vs.map(v => Float32Array.from(v))]));
          Faces.saveLib(st.faceLib).catch(() => {});
        }
        buildSettings(); kindsChanged(); netState(); setTiles(); recompute();
      } catch (e) { Ask.alert(T('Datei ungültig: {0}', e.message)); }
    };
    inp.click();
  }
  async function resetConfig() {
    if (!await Ask.confirm(T('Alle Einstellungen auf Standard zurücksetzen? (Zonen, eigene Kategorien und manuelle Änderungen bleiben)'))) return;
    const cats = st.s.customCats;
    st.s = { ...Settings.defaults(), customCats: cats }; Settings.save(st.s);
    buildSettings(); kindsChanged(); netState(); setTiles(); recompute();
  }
  async function resetOverrides() {
    if (!await Ask.confirm(T('Alle manuellen Änderungen in der Ereignisliste verwerfen?'))) return;
    st.overrides = { events: {}, files: {} }; saveOverrides(); recompute();
  }

  // ---------------- Sprache ----------------
  function setLang(l) {
    const from = I18n.lang;
    if (l === from) return;
    I18n.setLang(l);
    // Ordnernamen usw., die noch dem Standard entsprechen, mit umstellen
    Settings.switchLang(st.s, from, l);
    Settings.save(st.s);
    applyLang();
    MapView.setTiles(false);
    setTiles();
    Viewer.relang();
    recompute();
    if (!st.items) status(st.src ? T('Quelle „{0}“ – „Einlesen“ klicken.', st.src.name) : T('Quelle wählen, um zu beginnen.'));
  }
  function applyLang() {
    I18n.translateDom(document.body);
    document.title = 'Sort My Pictures';
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === I18n.lang));
    addNextButtons();
    buildSettings();
    renderZoneSelect();
    renderZoneList();
    kindsChanged();
    netState();
    setSrcName();
    setDstName();
    mapHint();
  }

  // ---------------- Start ----------------
  function setTiles() {
    MapView.setTiles(st.s.tiles, st.s.tileSrc);
    // Ribbon: Ohne / Karte (automatisch) / Satellit / Gelaende; andere Quellen aus der Seitenleiste markieren „Karte“
    const cur = !st.s.tiles ? '' : ['sat', 'topo'].includes(st.s.tileSrc) ? st.s.tileSrc : 'auto';
    document.querySelectorAll('[data-tiles]').forEach(b => b.classList.toggle('sel', b.dataset.tiles === cur));
  }

  // Seitenleiste: ein-/ausklappen und Breite ziehen (wird gemerkt)
  function initProps() {
    const props = $('#props'), grip = $('#propsGrip'), tog = $('#togProps');
    const w = parseInt(localStorage.getItem('fotosortierer.propsW'));
    if (w) props.style.width = w + 'px';
    const setHidden = hide => {
      props.classList.toggle('hide', hide); grip.classList.toggle('hide', hide);
      tog.textContent = hide ? '‹' : '›';
      localStorage.setItem('fotosortierer.propsHide', hide ? '1' : '');
      setTimeout(MapView.invalidate, 0);
    };
    setHidden(!!localStorage.getItem('fotosortierer.propsHide'));
    tog.onclick = () => setHidden(!props.classList.contains('hide'));
    grip.onpointerdown = e => {
      grip.setPointerCapture(e.pointerId); grip.classList.add('drag');
      const x0 = e.clientX, w0 = props.offsetWidth;
      grip.onpointermove = ev => { props.style.width = Math.max(240, Math.min(700, w0 - (ev.clientX - x0))) + 'px'; MapView.invalidate(); };
      grip.onpointerup = () => {
        grip.onpointermove = grip.onpointerup = null; grip.classList.remove('drag');
        localStorage.setItem('fotosortierer.propsW', props.offsetWidth);
      };
    };
  }

  async function start() {
    if (!fsSupported) $('#unsupported').hidden = false;
    MapView.init($('#map'), {
      onAddZone: addZone,
      onAddMode: on => { $('#btnAddZone').classList.toggle('on', on); mapHint(); },
      onZoneMoved: (z, lat, lon) => { z.lat = lat; z.lon = lon; saveZones(); recompute(); },
      onZoneClick: z => { showTab('orte'); document.querySelector(`[data-zone="${z.id}"] input`)?.focus(); },
      onPointClick: it => {
        const list = it.event ? it.event.items : st.analysis.items.filter(i => i.day === it.day);
        Viewer.open(list, list.indexOf(it));
      },
    });

    // Kontext fuer Bildansicht, Pruefmodus und Personen
    const appCtx = {
      st, recompute, saveOverrides, saveProject, useSource, loadThumb, scanFaces, setFaceNames, applyFaceNames, undoFaceNames, canUndo: () => faceHistory.length > 0, faceName, status,
      openViewer: (list, i) => Viewer.open(list, i),
      opsOf: it => st.plan?.byItem.get(it.id) || [],
      facesOf: it => Faces.facesOf(it, st.faceCache),
      openEvent: ev => { st.selected = ev; showTab('events'); renderEvents(); },
      showEventOnMap: ev => { showTab('orte'); MapView.fitEvent(ev); },
      get tab() { return curTab; },
    };
    Viewer.init(appCtx);
    Review.init(appCtx);
    People.init(appCtx);
    FolderTree.init(appCtx);
    applyLang();
    setTiles();
    initProps();

    $('#btnSrc').onclick = pickSrc;
    $('#btnDst').onclick = pickDst;
    $('#btnScan').onclick = scan;
    $('#btnCopy').onclick = $('#btnCopy2').onclick = copy;
    $('#btnMapExport').onclick = saveMap;
    $('#btnIndex').onclick = saveIndex;
    $('#btnCancel').onclick = () => st.abort?.abort();
    $('#btnAddZone').onclick = () => { showTab('orte'); MapView.setAddMode(!MapView.addMode); };
    $('#btnFit').onclick = () => MapView.fitAll(st.analysis);
    document.querySelectorAll('[data-tiles]').forEach(b => {
      b.onclick = () => {
        const v = b.dataset.tiles;
        if (v) setSetting(Settings.byKey.tileSrc, v);
        setSetting(Settings.byKey.tiles, !!v);
      };
    });
    $('#btnExport').onclick = exportConfig;
    $('#btnImport').onclick = importConfig;
    $('#btnReset').onclick = resetConfig;
    $('#btnResetOverrides').onclick = resetOverrides;
    $('#btnAddCat').onclick = () => addCat();
    $('#btnFilterReset').onclick = resetFilter;
    $('#filterBadge').hidden = !filterActive();
    $('#btnLog').onclick = () => showLog();
    $('#btnLogClose').onclick = () => showLog(false);
    document.querySelectorAll('[data-lang]').forEach(b => { b.onclick = () => setLang(b.dataset.lang); });
    for (const id of ['#fltKind', '#fltYear']) $(id).onchange = renderEvents;
    $('#fltText').oninput = Util.debounce(renderEvents, 200);
    document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
    showTab(TABS.includes(localStorage.getItem('fotosortierer.tab')) ? localStorage.getItem('fotosortierer.tab') : 'quelle');

    updateButtons();
    status(T('Quelle wählen, um zu beginnen.'));
    st.faceLib = await Faces.loadLib();
    // Zuletzt verwendete Ordner wiederherstellen (Zugriff muss per Klick erneut erlaubt werden)
    if (fsSupported) {
      try {
        st.src = await Util.idb.get('srcHandle') || null;
        st.dst = await Util.idb.get('dstHandle') || null;
        if (st.src) await openProject(st.src);
      } catch { /* kein Zugriff auf IndexedDB */ }
      setDstName();
    }
    setSrcName();
    mapHint();
    updateButtons();
    status(st.src ? T('Quelle „{0}“ – „Einlesen“ klicken.', st.src.name) : T('Quelle wählen, um zu beginnen.'));
  }

  // Fuer Tests und Fehlersuche in der Browser-Konsole
  window.Fotosortierer = { state: st, recompute, showTab, openProject, saveProject, setLang, kindsChanged, renderCats, fitAll: () => MapView.fitAll(st.analysis) };

  start();
})();
