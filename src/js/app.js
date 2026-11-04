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
    faceCache: null, faceNames: {}, people: null,
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
    $('#srcInfo').textContent = st.src ? st.src.name + (st.items ? `\n${st.items.length} Dateien · ${st.items.filter(i => i.hasGps).length} mit GPS` : '\nNoch nicht eingelesen.') : 'Noch keine Quelle gewählt.';
  }
  function netState() {
    const on = [st.s.tiles && 'Kartenhintergrund', st.s.geocode && 'Ortsnamen'].filter(Boolean);
    const el = $('#netState');
    el.className = on.length ? 'net online' : 'net offline';
    el.textContent = on.length ? `🌐 Online: ${on.join(', ')}` : '● Vollständig offline';
    el.title = on.length ? 'Diese Funktionen senden Anfragen an OpenStreetMap. Abschalten in den Einstellungen.' : 'Es werden keine Daten ins Internet gesendet.';
  }

  // ---------------- Einstellungen ----------------
  // Einstellungen je Arbeitsschritt in die Seitenleiste, Haekchen ins Ribbon
  function buildSettings() {
    for (const box of document.querySelectorAll('.settings[data-sections]')) {
      box.innerHTML = '';
      for (const name of box.dataset.sections.split(',')) {
        const sec = Settings.SCHEMA.find(s => s.section === name);
        const body = h('div', { class: 'sec-body' });
        for (const it of sec.items) body.append(settingRow(it));
        if (sec.section === 'Ortsnamen') {
          body.append(h('div', { class: 'row' },
            h('button', { onclick: () => { if (confirm('Gespeicherte Ortsnamen löschen?')) { Geo.clear(); recompute(); } } }, 'Cache leeren'),
            h('span', { id: 'geoCacheInfo', class: 'hint' })));
        }
        const closed = ['Sonderordner', 'Bilder ohne GPS', 'Ortsnamen', 'Karte'].includes(sec.section) || (sec.section === 'Filter' && !filterActive());
        box.append(h('details', { class: 'sec', open: !closed, 'data-sec': sec.section },
          h('summary', {}, sec.section,
            sec.online ? h('span', { class: 'badge-online', title: 'Nutzt das Internet' }, '🌐 online') : null),
          body));
      }
    }
    for (const box of document.querySelectorAll('.gchecks[data-checks]')) {
      box.innerHTML = '';
      for (const key of box.dataset.checks.split(',')) {
        const it = Settings.byKey[key];
        const cb = h('input', { type: 'checkbox', 'data-skey': key, checked: !!st.s[key] });
        cb.onchange = () => setSetting(it, cb.checked);
        box.append(h('label', { class: 'check', 'data-key': key, title: it.help || '' }, cb, ribbonLabel(it), it.online ? ' 🌐' : ''));
      }
    }
    refreshDeps();
  }
  const RIBBON_LABELS = { recursive: 'Unterordner', includePhotos: 'Fotos', includeVideos: 'Videos', geocode: 'Ortsnamen (OSM)',
    homeAuto: 'Wohnort automatisch', autoDaily: 'Alltagsorte automatisch', vacEnabled: 'Urlaube', tripEnabled: 'Ausflüge',
    workEnabled: 'Dienstreisen', personFolders: 'Personenordner anlegen', monthFolders: 'Monatsordner', dupSkip: 'Duplikate überspringen', lowerExt: 'Endung klein' };
  const ribbonLabel = it => RIBBON_LABELS[it.key] || it.label;

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
    else if (it.type === 'select') input = h('select', { id }, it.options.map(([val, lab]) => h('option', { value: val, selected: String(v) === val }, lab)));
    else if (it.type === 'area') input = h('textarea', { id, rows: 3 }, v);
    else if (it.type === 'date' || it.type === 'time') input = h('input', { type: it.type, id, value: v });
    else if (it.type === 'zone') input = h('select', { id, class: 'zone-select' });
    else if (it.type === 'weekdays') {
      input = h('span', { id, class: 'weekdays' }, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) =>
        h('label', {}, h('input', { type: 'checkbox', 'data-i': i, checked: v[i] === '1' }), d)));
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

    const label = h('label', { for: id, class: 'lab' }, it.label, it.online ? h('span', { class: 'badge-online' }, '🌐') : null);
    const row = h('div', { class: `row row-${it.type}`, 'data-key': it.key },
      it.type === 'bool' ? [input, label] : [label, input],
      it.help ? h('div', { class: 'hint' }, it.help) : null);
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
    if (it.level === 'faces') { status('Gilt für Fotos, die neu analysiert werden.'); return; }
    if (it.level === 'scan') { if (st.items) status('Geändert: bitte neu einlesen („Einlesen“).'); return; }
    if (it.level === 'date' && st.items) for (const i of st.items) Meta.applyDate(i, st.s);
    recompute();
  }

  // ---------------- Berechnung ----------------
  function recompute(keepView = true) {
    $('#geoCacheInfo') && ($('#geoCacheInfo').textContent = `${Geo.size()} Orte gespeichert`);
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
    setSrcName();
    mapHint();
    if (curTab === 'review') Review.render();
    if (curTab === 'people') People.render();
    updateButtons();
    const missing = st.s.geocode ? st.analysis.events.filter(e => !Geo.lookup(e.lat, e.lon)).length : 0;
    $('#btnGeocode span').textContent = st.s.geocode && missing ? `Ortsnamen holen (${missing}) 🌐` : 'Ortsnamen holen 🌐';
    const evs = st.analysis.events.filter(e => e.kind !== 'none' && e.passCount);
    $('#cntEvents').textContent = evs.length;
    const open = st.analysis.events.filter(e => e.passCount && !e.ok).length;
    $('#cntReview').textContent = open || '';
    if (!document.body.classList.contains('busy')) {
      status(`${st.items.length} Dateien · ${st.analysis.withGps} mit GPS · ${evs.length} Ereignisse · ${st.plan.ops.length} Kopien geplant` +
        (st.plan.filtered ? ` · ${st.plan.filtered} durch Filter ausgeblendet` : ''));
    }
  }
  const recomputeSoon = Util.debounce(recompute, 150);

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
        h('h2', {}, '📱 Fotos direkt vom Handy (USB)'),
        h('p', {}, 'Funktioniert mit Android über USB-Debugging. Die Verbindung läuft direkt zwischen Browser und Handy, ohne Internet. Auf dem Handy wird nichts verändert.'),
        h('ol', {},
          h('li', {}, 'Am Handy: ', h('b', {}, 'Einstellungen → Über das Telefon'), ' → 7× auf ', h('b', {}, 'Build-Nummer'), ' tippen.'),
          h('li', {}, h('b', {}, 'Einstellungen → System → Entwickleroptionen'), ' → ', h('b', {}, 'USB-Debugging'), ' einschalten.'),
          h('li', {}, 'Handy per USB-Kabel anstecken und unten auf ', h('b', {}, 'Verbinden'), ' klicken. Im Browser-Fenster das Handy auswählen.'),
          h('li', {}, 'Am Handy ', h('b', {}, '„USB-Debugging zulassen?“'), ' bestätigen (am besten „Immer von diesem Computer zulassen“).')),
        h('p', { class: 'hint' }, 'Tipp: Nach dem Sortieren USB-Debugging wieder ausschalten. iPhones werden nicht unterstützt – dort Fotos zuerst auf den PC übertragen.'),
        msg,
        h('div', { class: 'dlg-actions' },
          h('button', { onclick: () => dlg.close() }, 'Abbrechen'),
          h('button', { class: 'primary', onclick: async e => {
            e.target.disabled = true;
            msg.textContent = 'Verbinde …';
            try {
              if (await Phone.connect(true, t => { msg.textContent = t; })) await browse();
              else msg.textContent = 'Kein Gerät gewählt.';
            } catch (err) {
              msg.textContent = err.name === 'NotFoundError' ? 'Kein Gerät gewählt. Ist USB-Debugging eingeschaltet und das Kabel ein Datenkabel?' : 'Fehler: ' + err.message;
            }
            e.target.disabled = false;
          } }, '🔌 Verbinden')));
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
        h('h2', {}, `📱 ${Phone.deviceName()} – Ordner wählen`),
        h('div', { class: 'phone-short' }, PHONE_SHORTCUTS.map(([n, p]) => h('button', { class: rel === p ? 'current' : '', onclick: () => go(p) }, n))),
        h('div', { class: 'phone-path' }, h('code', {}, '/' + rel)),
        h('div', { class: 'phone-list' },
          rel ? h('div', { class: 'phone-dir', onclick: () => go(rel.split('/').slice(0, -1).join('/')) }, '⬆ ..') : null,
          entries ? dirs.map(d => h('div', { class: 'phone-dir', onclick: () => go(`${rel}/${d.name}`) }, '📁 ' + d.name))
            : h('div', { class: 'hint' }, 'Ordner nicht gefunden.')),
        h('div', { class: 'hint' }, entries ? `${media} Fotos/Videos direkt in diesem Ordner${st.s.recursive ? ', Unterordner werden mit eingelesen' : ''}.` : ''),
        h('div', { class: 'dlg-actions' },
          h('button', { onclick: async () => { await Phone.disconnect(); intro(); } }, 'Trennen'),
          h('span', { class: 'spacer' }),
          h('button', { onclick: () => dlg.close() }, 'Abbrechen'),
          h('button', { class: 'primary', disabled: !entries, onclick: () => {
            localStorage.setItem(PKEY, rel);
            st.src = Phone.source(rel);
            st.items = null;
            setSrcName();
            dlg.close();
            updateButtons();
            scan();
          } }, 'Diesen Ordner verwenden')));
    };

    dlg.showModal();
    if (Phone.connected() || await Phone.connect(false).catch(() => null)) await browse(); else intro();
  }

  async function pickDst() {
    try {
      st.dst = await showDirectoryPicker({ id: 'fs-dst', mode: 'readwrite' });
      if (st.src && await st.src.isSameEntry(st.dst)) { alert('Ziel darf nicht gleich der Quelle sein.'); st.dst = null; return; }
      await Util.idb.set('dstHandle', st.dst);
      $('#dstName').textContent = st.dst.name;
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
    status('Lese Dateien …', -1);
    try {
      const t0 = Date.now();
      st.items = await Meta.scan(st.src, st.s, t => status(t, -1), st.abort.signal);
      st.faceCache = await Faces.loadCache(st.src.name);
      busy(false);
      recompute();
      MapView.fitAll(st.analysis);
      log(`Eingelesen: ${st.items.length} Dateien aus „${st.src.name}“ in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    } catch (e) { busy(false); status('Fehler beim Einlesen: ' + e.message); }
  }

  async function geocode() {
    if (!st.analysis) return;
    if (!st.s.geocode) { alert('Zuerst „Ortsnamen von OpenStreetMap“ einschalten.'); return; }
    st.abort = new AbortController();
    busy(true);
    try {
      const r = await Geo.fetchMissing(st.analysis.events, st.s, t => status(t, -1), st.abort.signal);
      log(`Ortsnamen geholt: ${r.fetched}${r.errors ? `, Fehler: ${r.errors}` : ''}`);
    } finally { busy(false); recompute(); }
  }

  // ---------------- Gesichter ----------------
  async function scanFaces() {
    if (!st.items) return;
    if (!(await ensurePermission(st.src, 'read'))) return;
    st.abort = new AbortController();
    busy(true);
    status('Lade Gesichtsmodelle …', -1);
    try {
      const backend = await Faces.load();
      log(`Gesichtserkennung gestartet (lokal, ${backend === 'webgl' ? 'Grafikkarte' : 'Prozessor – langsamer'})`);
      st.faceCache = await Faces.scanAll(st.items, st.src.name, st.s, p => {
        const left = p.done ? (p.secs / p.done) * (p.total - p.done) : 0;
        status(`Gesichter erkennen … ${p.done} / ${p.total} Fotos · ${p.found} Gesichter · noch ca. ${Math.ceil(left / 60)} min`, p.done / p.total);
      }, st.abort.signal);
      log(st.abort.signal.aborted ? 'Gesichtserkennung abgebrochen – „Gesichter erkennen“ setzt fort.' : 'Gesichtserkennung fertig.');
    } catch (e) { log('Gesichtserkennung fehlgeschlagen: ' + e.message, 'err'); }
    finally { busy(false); recompute(); People.render(); }
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
    if (n && n !== '#ignore') return n;
    const g = st.people?.groups.find(g => g.name && g.faces.some(f => f.id === `${it.path}#${i}`));
    return g ? g.name + ' ?' : '';
  };

  async function copy() {
    if (!st.plan) return;
    if (!st.dst) { await pickDst(); if (!st.dst) return; }
    if (!(await ensurePermission(st.dst, 'readwrite'))) return;
    if (!(await ensurePermission(st.src, 'read'))) return;
    const bytes = st.plan.ops.reduce((a, o) => a + o.item.size, 0);
    if (!confirm(`${st.plan.ops.length} Kopien (${fmtBytes(bytes)}) nach „${st.dst.name}“ schreiben?\n\nOriginale bleiben unverändert, vorhandene Dateien werden nicht überschrieben.`)) return;
    st.abort = new AbortController();
    busy(true);
    showLog(true);
    log(`Kopieren gestartet: ${st.plan.ops.length} Dateien nach „${st.dst.name}“`);
    try {
      const r = await Copier.run(st.dst, st.plan.ops, p => status(
        `Kopiere … ${p.done} / ${p.total} · ${fmtBytes(p.bytes)} · ${fmtBytes(p.rate)}/s${p.errors ? ` · ${p.errors} Fehler` : ''}`, p.done / p.total), st.abort.signal);
      const msg = `${r.aborted ? 'Abgebrochen' : 'Fertig'}: ${r.copied} kopiert, ${r.skipped} übersprungen (existierten), ${r.errors} Fehler · Protokoll: ${r.logName}`;
      log(msg);
      if (!r.aborted && !r.errors) st.copied = true;
      for (const l of r.log.filter(l => l.status.startsWith('FEHLER')).slice(0, 50)) log(`  ${l.quelle} → ${l.ziel}: ${l.status}`, 'err');
      status(msg);
    } catch (e) { log('Fehler: ' + e.message, 'err'); status('Fehler: ' + e.message); }
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
    const names = { orte: 'Orte', events: 'Ereignisse', review: 'Prüfen', people: 'Personen', ziel: 'Ziel & Kopieren' };
    TABS.forEach((t, i) => {
      const next = TABS[i + 1];
      if (!next) return;
      $(`.rpanel[data-tab="${t}"]`).append(h('div', { class: 'grp next' },
        h('div', { class: 'gbody' }, h('button', { class: 'big next-btn', onclick: () => showTab(next) },
          icon('i-next'), h('span', {}, `Weiter: ${i + 2} ${names[next]}`))),
        h('div', { class: 'gcap' }, 'Nächster Schritt')));
    });
  }
  // Hinweis oben auf der Karte, was als Naechstes zu tun ist
  function mapHint() {
    const el = $('#hint');
    if (!el) return;
    let t = '';
    if (!st.src) t = 'Schritt 1: Oben „Ordner wählen“ oder „Handy (USB)“.';
    else if (!st.items) t = `Quelle „${st.src.name}“ – oben „Einlesen“ klicken.`;
    else if (MapView.addMode) t = 'Auf die Karte klicken, um die Zone zu setzen.';
    else if (curTab === 'quelle' && st.analysis && !st.analysis.withGps) t = 'Keine Bilder mit GPS – Urlaube und Ausflüge können nicht erkannt werden.';
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
    sel.append(h('option', { value: '' }, '– keine –'),
      ...st.zones.map(z => h('option', { value: z.id, selected: st.s.filterZone === z.id }, `${z.name || MapView.ZONE_TYPES[z.type]} (${z.r} km)`)));
  }

  function renderZoneList() {
    renderZoneSelect();
    const list = $('#zoneList');
    list.innerHTML = '';
    if (!st.zones.length) list.append(h('div', { class: 'muted' }, 'Noch keine Zonen. Oben „Zone setzen“ und dann auf die Karte klicken.'));
    for (const z of st.zones) {
      const upd = (k, v) => { z[k] = v; saveZones(); recomputeSoon(); };
      list.append(h('div', { class: 'zone', 'data-zone': z.id },
        h('span', { class: 'dot', style: `background:${MapView.ZONE_COLORS[z.type]}` }),
        h('input', { type: 'text', value: z.name, placeholder: 'Name', oninput: e => upd('name', e.target.value) }),
        h('span', {},
          h('button', { class: 'mini', title: 'Auf Karte zeigen', onclick: () => MapView.focus(z.lat, z.lon) }, icon('i-target')),
          h('button', { class: 'mini', title: 'Löschen', onclick: () => { st.zones = st.zones.filter(x => x !== z); saveZones(); recompute(); } }, icon('i-trash'))),
        h('div', { class: 'zrow' },
          h('select', { onchange: e => upd('type', e.target.value) },
            Object.entries(MapView.ZONE_TYPES).map(([k, v]) => h('option', { value: k, selected: z.type === k }, v))),
          h('input', { type: 'number', value: z.r, min: 0.1, step: 0.1, title: 'Radius km', oninput: e => { const v = parseFloat(e.target.value); if (v > 0) upd('r', v); } }),
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
    if (ySel.options.length - 1 !== years.length) {
      ySel.innerHTML = '<option value="">Alle Jahre</option>' + years.map(y => `<option>${y}</option>`).join('');
      ySel.value = fYear;
    }
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
      tb.append(h('tr', { class: `kind-${ev.kind}${st.selected === ev ? ' selected' : ''}`, title: 'Klick: Bilder anzeigen',
        onclick: e => { if (e.target.closest('input,select,button')) return; st.selected = st.selected === ev ? null : ev; renderEvents(); } },
        h('td', {}, h('span', { class: 'dot', style: `background:${MapView.COLORS[ev.kind]}` }),
          h('select', { onchange: e => setO('kind', e.target.value === ev.autoKind ? null : e.target.value) },
            Object.entries(Analyze.KINDS).map(([k, v]) => h('option', { value: k, selected: ev.kind === k }, v + (k === ev.autoKind ? ' (auto)' : ''))))),
        h('td', {}, h('input', { type: 'text', class: 'place', value: o.name || '', placeholder: o.name ? '' : ev.place,
          title: `Ortsname – Quelle: ${ev.placeSrc}. Leer lassen für automatisch.`, onchange: e => setO('name', e.target.value.trim()) })),
        h('td', { class: 'nowrap' }, ev.days > 1 ? `${fmtDate(ev.start)} – ${fmtDate(ev.end)}` : fmtDate(ev.start)),
        h('td', { class: 'num' }, ev.days),
        h('td', { class: 'num' }, ev.weekendDays),
        h('td', { class: 'num', title: ev.passCount < ev.items.length ? `${ev.items.length - ev.passCount} durch Filter ausgeblendet` : '' },
          ev.passCount < ev.items.length ? `${ev.passCount}/${ev.items.length}` : ev.items.length),
        h('td', { class: 'num' }, ev.perDay.toFixed(1)),
        h('td', { class: 'num' }, Math.round(ev.maxKm) + ' km'),
        h('td', { class: 'src' }, ev.placeSrc),
        h('td', { class: 'path' }, dir ? dir.join('/') : '–'),
        h('td', { class: 'nowrap' },
          h('span', { class: 'ok-mark', title: ev.ok ? 'Im Prüfmodus bestätigt' : 'Noch nicht geprüft' }, ev.ok ? '✓' : ''),
          h('button', { class: 'mini', title: 'Auf Karte zeigen', onclick: () => { showTab('orte'); MapView.fitEvent(ev); } }, icon('i-pin')))));
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
      h('span', { class: 'hint' }, ' Häkchen entfernen = Bild nicht in diesem Ereignis-Ordner (bleibt im Monatsordner).'),
      h('button', { class: 'mini', title: 'Schließen', onclick: () => { st.selected = null; renderEvents(); } }, icon('i-cancel'))));
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
        h('span', { class: 'fname', title: it.path }, it.hasGps ? '' : ' ohne GPS')));
      grid.append(fig);
    }
    if (all.length > 300) grid.append(h('div', { class: 'hint' }, `… und ${all.length - 300} weitere`));
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
    const kindName = { month: 'Monatsordner', rule: 'Sonderordner', vac: st.s.vacFolder, trip: st.s.tripFolder, work: st.s.workFolder, person: 'Personen' };
    sum.innerHTML = `
      <div class="cards">
        <div><b>${a.items.length - p.filtered}</b>Dateien${p.filtered ? ` (${p.filtered} gefiltert)` : ''}</div>
        <div><b>${p.ops.length}</b>Kopien</div>
        <div><b>${fmtBytes(bytes)}</b>Gesamt</div>
        <div><b>${a.withGps}</b>mit GPS</div>
        <div><b>${p.dups.length}</b>Duplikate übersprungen</div>
      </div>
      <div class="hint">Kopien je Art: ${Object.entries(kinds).map(([k, n]) => `${esc(kindName[k] || k)} ${n}`).join(' · ')}</div>
      <div class="hint">Datum aus: ${Object.entries(srcCount).map(([k, n]) => `${esc(k)} ${n}`).join(' · ')}</div>`;
    const t = $('#previewTree');
    t.innerHTML = '';
    const root = Plan.tree(p.ops);
    t.append(h('div', { class: 'tree-root' }, (st.dst ? st.dst.name : 'Ziel') + '/'));
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
          inner.append(h('div', { class: 'tree-file', title: `Quelle: ${f.item.path}\nDatum: ${Util.fmtDateTime(f.item.date)} (${f.item.dateSrc})\nKlick: Bildansicht`,
            onclick: () => Viewer.open(list, i) },
            f.name, h('span', { class: 'from' }, ' ← ' + f.item.name)));
        });
        if (files.length > 500) inner.append(h('div', { class: 'hint' }, `… und ${files.length - 500} weitere`));
        d.append(inner);
      });
      container.append(d);
    }
  }

  // ---------------- Export / Import ----------------
  function exportConfig() {
    const blob = new Blob([JSON.stringify({ settings: st.s, zones: st.zones, overrides: st.overrides, faceNames: st.faceNames }, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'fotosortierer-einstellungen.json' });
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
        buildSettings(); netState(); setTiles(); recompute();
      } catch (e) { alert('Datei ungültig: ' + e.message); }
    };
    inp.click();
  }
  function resetConfig() {
    if (!confirm('Alle Einstellungen auf Standard zurücksetzen? (Zonen und manuelle Änderungen bleiben)')) return;
    st.s = Settings.defaults(); Settings.save(st.s);
    buildSettings(); netState(); setTiles(); recompute();
  }
  function resetOverrides() {
    if (!confirm('Alle manuellen Änderungen in der Ereignisliste verwerfen?')) return;
    st.overrides = { events: {}, files: {} }; saveOverrides(); recompute();
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
    addNextButtons();
    buildSettings();
    netState();
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
    setTiles();
    renderZoneList();
    initProps();

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

    $('#btnSrc').onclick = pickSrc;
    $('#btnPhone').onclick = pickPhone;
    $('#btnPhone').hidden = !Phone.supported();
    Phone.onChange = on => {
      if (!on && st.src?.isPhone) { log('Handy getrennt – zum Fortsetzen wieder anstecken und erneut starten.', 'err'); st.abort?.abort(); }
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
    $('#btnFilterReset').onclick = resetFilter;
    $('#filterBadge').hidden = !filterActive();
    $('#btnLog').onclick = () => showLog();
    $('#btnLogClose').onclick = () => showLog(false);
    for (const id of ['#fltKind', '#fltYear']) $(id).onchange = renderEvents;
    $('#fltText').oninput = Util.debounce(renderEvents, 200);
    document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
    $('#legend').innerHTML = [['vac', 'Urlaub'], ['trip', 'Ausflug'], ['work', 'Dienstreise'], ['home', 'Zuhause / Alltag'], ['other', 'Sonstige']]
      .map(([k, n]) => `<span><i style="background:${MapView.COLORS[k]}"></i>${n}</span>`).join('');
    showTab(TABS.includes(localStorage.getItem('fotosortierer.tab')) ? localStorage.getItem('fotosortierer.tab') : 'quelle');

    updateButtons();
    status('Quelle wählen, um zu beginnen.');
    try { st.faceNames = (await Util.idb.get('faceNames')) || {}; } catch { /* leer */ }
    // Zuletzt verwendete Ordner wiederherstellen (Zugriff muss per Klick erneut erlaubt werden)
    if (fsSupported) {
      try {
        st.src = await Util.idb.get('srcHandle') || null;
        st.dst = await Util.idb.get('dstHandle') || null;
      } catch { /* kein Zugriff auf IndexedDB */ }
      if (st.dst) $('#dstName').textContent = st.dst.name;
    }
    setSrcName();
    mapHint();
    updateButtons();
    status(st.src ? `Quelle „${st.src.name}“ – „Einlesen“ klicken.` : 'Quelle wählen, um zu beginnen.');
  }

  // Fuer Tests und Fehlersuche in der Browser-Konsole
  window.Fotosortierer = { state: st, recompute, showTab, fitAll: () => MapView.fitAll(st.analysis) };

  start();
})();
