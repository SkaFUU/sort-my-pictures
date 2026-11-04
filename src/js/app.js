// Oberflaeche und Ablauf
(() => {
  const $ = sel => document.querySelector(sel);
  const { escapeHtml: esc, fmtDate, fmtBytes, h, icon } = Util;

  const ZKEY = 'fotosortierer.zones', OKEY = 'fotosortierer.overrides';
  const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };

  const st = {
    s: Settings.load(),
    zones: loadJson(ZKEY, []),
    overrides: loadJson(OKEY, { events: {}, files: {} }),
    src: null, dst: null, items: null, analysis: null, plan: null,
    abort: null, selected: null, thumbUrls: [],
    faceCache: null, faceNames: {}, people: null, oldFaces: false,
  };
  const saveZones = () => localStorage.setItem(ZKEY, JSON.stringify(st.zones));
  const saveOverrides = () => localStorage.setItem(OKEY, JSON.stringify(st.overrides));

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
    $('#btnCopy').disabled = $('#btnCopy2').disabled = b || !st.plan || !st.plan.ops.length;
    for (const id of ['#btnSrc', '#btnDst', '#btnPhone', '#btnFaces', '#btnGeocode']) $(id).disabled = b;
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
            h('button', { onclick: () => { if (confirm(T('Gespeicherte Ortsnamen löschen?'))) { Geo.clear(); recompute(); } } }, T('Cache leeren')),
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
        box.append(h('label', { class: 'check', 'data-key': key, title: it.help ? T(it.help) : '' }, cb, ribbonLabel(it), it.online ? ' 🌐' : ''));
      }
    }
    renderCats();
    refreshDeps();
  }
  const RIBBON_LABELS = { recursive: 'Unterordner', includePhotos: 'Fotos', includeVideos: 'Videos', geocode: 'Ortsnamen (OSM)',
    homeAuto: 'Wohnort automatisch', autoDaily: 'Alltagsorte automatisch', vacEnabled: 'Urlaube', tripEnabled: 'Ausflüge',
    workEnabled: 'Dienstreisen', personFolders: 'Personenordner anlegen', monthFolders: 'Monatsordner', dupSkip: 'Duplikate überspringen', lowerExt: 'Endung klein' };
  const ribbonLabel = it => T(RIBBON_LABELS[it.key] || it.label);

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
      for (const row of document.querySelectorAll(`.row[data-key="${it.key}"], .check[data-key="${it.key}"]`)) {
        row.classList.toggle(row.classList.contains('check') ? 'dis' : 'disabled', !on);
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
          h('button', { class: 'mini', title: T('Löschen'), onclick: () => { if (confirm(T('Kategorie „{0}“ löschen?', c.name))) { cats.splice(i, 1); commit(true); } } }, icon('i-trash'))),
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
  function recompute() {
    $('#geoCacheInfo') && ($('#geoCacheInfo').textContent = T('{0} Orte gespeichert', Geo.size()));
    if (!st.items) { updateButtons(); return; }
    // Personen aus der Gesichtserkennung den Bildern zuordnen
    st.people = st.faceCache ? Faces.cluster(st.items, st.faceCache, st.faceNames, st.s.faceThreshold) : null;
    for (const it of st.items) it.persons = st.people?.byItem.get(it.id);
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
    const missing = st.s.geocode ? st.analysis.events.filter(e => !Geo.lookup(e.lat, e.lon)).length : 0;
    $('#btnGeocode span').textContent = (st.s.geocode && missing ? T('Ortsnamen holen ({0})', missing) : T('Ortsnamen holen')) + ' 🌐';
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
    try {
      st.src = await showDirectoryPicker({ id: 'fs-src', mode: 'read' });
      await Util.idb.set('srcHandle', st.src);
      st.items = null;
      setSrcName();
      updateButtons();
      scan();
    } catch (e) { if (e.name !== 'AbortError') alert(e.message); }
  }
  // Handy per USB: verbinden, Ordner am Handy waehlen
  const PKEY = 'fotosortierer.phonePath';
  const PHONE_SHORTCUTS = [
    ['📷 Kamera', 'DCIM/Camera'], ['Alle Kamera-Ordner', 'DCIM'], ['Bilder', 'Pictures'], ['Videos', 'Movies'],
    ['WhatsApp', 'Android/media/com.whatsapp/WhatsApp/Media'],
  ];
  async function pickPhone() {
    const dlg = h('dialog', { id: 'phoneDlg' });
    document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    let rel = localStorage.getItem(PKEY) || 'DCIM/Camera';

    const intro = () => {
      dlg.innerHTML = '';
      const msg = h('div', { class: 'hint' });
      dlg.append(
        h('h2', {}, T('📱 Fotos direkt vom Handy (USB)')),
        h('p', {}, T('Funktioniert mit Android über USB-Debugging. Die Verbindung läuft direkt zwischen Browser und Handy, ohne Internet. Auf dem Handy wird nichts verändert.')),
        h('ol', { html: T('<li>Am Handy: <b>Einstellungen → Über das Telefon</b> → 7× auf <b>Build-Nummer</b> tippen.</li><li><b>Einstellungen → System → Entwickleroptionen</b> → <b>USB-Debugging</b> einschalten.</li><li>Handy per USB-Kabel anstecken und unten auf <b>Verbinden</b> klicken. Im Browser-Fenster das Handy auswählen.</li><li>Am Handy <b>„USB-Debugging zulassen?“</b> bestätigen (am besten „Immer von diesem Computer zulassen“).</li>') }),
        h('p', { class: 'hint' }, T('Tipp: Nach dem Sortieren USB-Debugging wieder ausschalten. iPhones werden nicht unterstützt – dort Fotos zuerst auf den PC übertragen.')),
        msg,
        h('div', { class: 'dlg-actions' },
          h('button', { onclick: () => dlg.close() }, T('Abbrechen')),
          h('button', { class: 'primary', onclick: async e => {
            e.target.disabled = true;
            msg.textContent = T('Verbinde …');
            try {
              if (await Phone.connect(true, t => { msg.textContent = t; })) await browse();
              else msg.textContent = T('Kein Gerät gewählt.');
            } catch (err) {
              msg.textContent = err.name === 'NotFoundError' ? T('Kein Gerät gewählt. Ist USB-Debugging eingeschaltet und das Kabel ein Datenkabel?') : T('Fehler: {0}', err.message);
            }
            e.target.disabled = false;
          } }, '🔌 ' + T('Verbinden'))));
    };

    const browse = async () => {
      dlg.innerHTML = '';
      let entries;
      try { entries = await Phone.list(`${Phone.ROOT}/${rel}`.replace(/\/+$/, '')); }
      catch { entries = null; }
      const dirs = entries ? entries.filter(e => e.dir) : [];
      const media = entries ? entries.filter(e => !e.dir && [...Meta.PHOTO, ...Meta.VIDEO].includes(e.name.split('.').pop().toLowerCase())).length : 0;
      const go = r => { rel = r.replace(/^\/+|\/+$/g, ''); browse(); };
      dlg.append(
        h('h2', {}, `📱 ${Phone.deviceName()} – ${T('Ordner wählen')}`),
        h('div', { class: 'phone-short' }, PHONE_SHORTCUTS.map(([n, p]) => h('button', { class: rel === p ? 'current' : '', onclick: () => go(p) }, T(n)))),
        h('div', { class: 'phone-path' }, h('code', {}, '/' + rel)),
        h('div', { class: 'phone-list' },
          rel ? h('div', { class: 'phone-dir', onclick: () => go(rel.split('/').slice(0, -1).join('/')) }, '⬆ ..') : null,
          entries ? dirs.map(d => h('div', { class: 'phone-dir', onclick: () => go(`${rel}/${d.name}`) }, '📁 ' + d.name))
            : h('div', { class: 'hint' }, T('Ordner nicht gefunden.'))),
        h('div', { class: 'hint' }, entries ? T('{0} Fotos/Videos direkt in diesem Ordner', media) + (st.s.recursive ? T(', Unterordner werden mit eingelesen') : '') + '.' : ''),
        h('div', { class: 'dlg-actions' },
          h('button', { onclick: async () => { await Phone.disconnect(); intro(); } }, T('Trennen')),
          h('span', { class: 'spacer' }),
          h('button', { onclick: () => dlg.close() }, T('Abbrechen')),
          h('button', { class: 'primary', disabled: !entries, onclick: () => {
            localStorage.setItem(PKEY, rel);
            st.src = Phone.source(rel);
            st.items = null;
            setSrcName();
            dlg.close();
            updateButtons();
            scan();
          } }, T('Diesen Ordner verwenden'))));
    };

    dlg.showModal();
    if (Phone.connected() || await Phone.connect(false).catch(() => null)) await browse(); else intro();
  }

  async function pickDst() {
    try {
      st.dst = await showDirectoryPicker({ id: 'fs-dst', mode: 'readwrite' });
      if (st.src && await st.src.isSameEntry(st.dst)) { alert(T('Ziel darf nicht gleich der Quelle sein.')); st.dst = null; return; }
      await Util.idb.set('dstHandle', st.dst);
      setDstName();
      if (st.plan) renderPreview();
      updateButtons();
    } catch (e) { if (e.name !== 'AbortError') alert(e.message); }
  }
  async function ensurePermission(handle, mode) {
    if ((await handle.queryPermission({ mode })) === 'granted') return true;
    return (await handle.requestPermission({ mode })) === 'granted';
  }

  async function scan() {
    if (!st.src || !(await ensurePermission(st.src, 'read'))) return;
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
    } catch (e) { busy(false); status(T('Fehler beim Einlesen: {0}', e.message)); }
  }

  async function geocode() {
    if (!st.analysis) return;
    if (!st.s.geocode) { alert(T('Zuerst „Ortsnamen von OpenStreetMap“ einschalten.')); return; }
    st.abort = new AbortController();
    busy(true);
    try {
      const r = await Geo.fetchMissing(st.analysis.events, st.s, t => status(t, -1), st.abort.signal);
      log(T('Ortsnamen geholt: {0}', r.fetched) + (r.errors ? T(', Fehler: {0}', r.errors) : ''));
    } finally { busy(false); recompute(); }
  }

  // ---------------- Gesichter ----------------
  async function scanFaces() {
    if (!st.items) {
      const t = st.src ? T('Zuerst in Schritt 1 „Einlesen“ klicken.') : T('Zuerst in Schritt 1 eine Quelle wählen und einlesen.');
      status(t); alert(t); return;
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
      if (r.namesChanged) Util.idb.set('faceNames', st.faceNames).catch(() => {});
      log(st.abort.signal.aborted ? T('Gesichtserkennung abgebrochen – „Gesichter erkennen“ setzt fort.') : T('Gesichtserkennung fertig.'));
    } catch (e) {
      log(T('Gesichtserkennung fehlgeschlagen: {0}', e.message), 'err');
      showLog(true);
      failed = T('Gesichtserkennung fehlgeschlagen: {0}', e.message);
    }
    finally { busy(false); recompute(); People.render(); if (failed) status(failed); }
  }

  // Namen fuer Gesichter setzen (null = Name entfernen, '#ignore' = ignorieren)
  function setFaceNames(ids, name) {
    for (const id of ids) { if (name) st.faceNames[id] = name; else delete st.faceNames[id]; }
    Util.idb.set('faceNames', st.faceNames).catch(() => {});
    recompute();
    People.render();
  }
  const faceName = (it, i) => {
    const n = st.faceNames[`${it.path}#${i}`];
    if (n && !n.startsWith('#')) return n;
    const g = st.people?.groups.find(g => g.name && g.faces.some(f => f.id === `${it.path}#${i}`));
    return g ? g.name + ' ?' : '';
  };

  async function copy() {
    if (!st.plan) return;
    if (!st.dst) { await pickDst(); if (!st.dst) return; }
    if (!(await ensurePermission(st.dst, 'readwrite'))) return;
    if (!(await ensurePermission(st.src, 'read'))) return;
    const bytes = st.plan.ops.reduce((a, o) => a + o.item.size, 0);
    if (!confirm(T('{0} Kopien ({1}) nach „{2}“ schreiben?\n\nOriginale bleiben unverändert, vorhandene Dateien werden nicht überschrieben.', st.plan.ops.length, fmtBytes(bytes), st.dst.name))) return;
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
    } catch (e) { log(T('Fehler: {0}', e.message), 'err'); status(T('Fehler: {0}', e.message)); }
    finally { busy(false); }
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
    if (!st.src) t = T('Schritt 1: Oben „Ordner wählen“ oder „Handy (USB)“.');
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
        const t = await exifr.thumbnail(await Phone.head(f, 128 * 1024)).catch(() => null);
        if (t) return URL.createObjectURL(new Blob([t], { type: 'image/jpeg' }));
      }
      // Videos vom Handy nicht ganz laden, nur fuer ein Vorschaubild
      if (f.remote && (it.isVideo || f.size > 30e6)) return null;
      if (['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'm4v'].includes(it.ext)) return URL.createObjectURL(await Phone.full(f));
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
    const blob = new Blob([JSON.stringify({ settings: st.s, zones: st.zones, overrides: st.overrides, faceNames: st.faceNames }, null, 2)], { type: 'application/json' });
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
        if (j.faceNames) { st.faceNames = j.faceNames; Util.idb.set('faceNames', st.faceNames).catch(() => {}); }
        buildSettings(); kindsChanged(); netState(); setTiles(); recompute();
      } catch (e) { alert(T('Datei ungültig: {0}', e.message)); }
    };
    inp.click();
  }
  function resetConfig() {
    if (!confirm(T('Alle Einstellungen auf Standard zurücksetzen? (Zonen, eigene Kategorien und manuelle Änderungen bleiben)'))) return;
    const cats = st.s.customCats;
    st.s = { ...Settings.defaults(), customCats: cats }; Settings.save(st.s);
    buildSettings(); kindsChanged(); netState(); setTiles(); recompute();
  }
  function resetOverrides() {
    if (!confirm(T('Alle manuellen Änderungen in der Ereignisliste verwerfen?'))) return;
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
    MapView.setTiles(st.s.tiles);
    document.querySelectorAll('[data-tiles]').forEach(b => b.classList.toggle('sel', (b.dataset.tiles === '1') === !!st.s.tiles));
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
      st, recompute, saveOverrides, loadThumb, scanFaces, setFaceNames, faceName,
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
    applyLang();
    setTiles();
    initProps();

    $('#btnSrc').onclick = pickSrc;
    $('#btnPhone').onclick = pickPhone;
    $('#btnPhone').hidden = !Phone.supported();
    Phone.onChange = on => {
      if (!on && st.src?.isPhone) { log(T('Handy getrennt – zum Fortsetzen wieder anstecken und erneut starten.'), 'err'); st.abort?.abort(); }
    };
    $('#btnDst').onclick = pickDst;
    $('#btnScan').onclick = scan;
    $('#btnCopy').onclick = $('#btnCopy2').onclick = copy;
    $('#btnCancel').onclick = () => st.abort?.abort();
    $('#btnAddZone').onclick = () => { showTab('orte'); MapView.setAddMode(!MapView.addMode); };
    $('#btnFit').onclick = () => MapView.fitAll(st.analysis);
    document.querySelectorAll('[data-tiles]').forEach(b => { b.onclick = () => setSetting(Settings.byKey.tiles, b.dataset.tiles === '1'); });
    $('#btnGeocode').onclick = geocode;
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
    try { st.faceNames = (await Util.idb.get('faceNames')) || {}; } catch { /* leer */ }
    // Zuletzt verwendete Ordner wiederherstellen (Zugriff muss per Klick erneut erlaubt werden)
    if (fsSupported) {
      try {
        st.src = await Util.idb.get('srcHandle') || null;
        st.dst = await Util.idb.get('dstHandle') || null;
      } catch { /* kein Zugriff auf IndexedDB */ }
      setDstName();
    }
    setSrcName();
    mapHint();
    updateButtons();
    status(st.src ? T('Quelle „{0}“ – „Einlesen“ klicken.', st.src.name) : T('Quelle wählen, um zu beginnen.'));
  }

  // Fuer Tests und Fehlersuche in der Browser-Konsole
  window.Fotosortierer = { state: st, recompute, showTab, setLang, kindsChanged, renderCats, fitAll: () => MapView.fitAll(st.analysis) };

  start();
})();
