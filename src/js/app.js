// Oberflaeche und Ablauf
(() => {
  const $ = sel => document.querySelector(sel);
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null) el.append(c);
    return el;
  };
  const { escapeHtml: esc, fmtDate, fmtBytes } = Util;

  const ZKEY = 'fotosortierer.zones', OKEY = 'fotosortierer.overrides';
  const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };

  const st = {
    s: Settings.load(),
    zones: loadJson(ZKEY, []),
    overrides: loadJson(OKEY, { events: {}, files: {} }),
    src: null, dst: null, items: null, analysis: null, plan: null,
    abort: null, selected: null, thumbUrls: [],
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
    $('#btnCopy').disabled = b || !st.plan || !st.plan.ops.length;
    $('#btnSrc').disabled = $('#btnDst').disabled = b;
  }
  function netState() {
    const on = [st.s.tiles && 'Kartenhintergrund', st.s.geocode && 'Ortsnamen'].filter(Boolean);
    const el = $('#netState');
    el.className = on.length ? 'net online' : 'net offline';
    el.textContent = on.length ? `🌐 Online: ${on.join(', ')}` : '● Vollständig offline';
    el.title = on.length ? 'Diese Funktionen senden Anfragen an OpenStreetMap. Abschalten in den Einstellungen.' : 'Es werden keine Daten ins Internet gesendet.';
  }

  // ---------------- Einstellungen ----------------
  function buildSettings() {
    const form = $('#settingsForm');
    form.innerHTML = '';
    for (const sec of Settings.SCHEMA) {
      const body = h('div', { class: 'sec-body' });
      for (const it of sec.items) body.append(settingRow(it));
      if (sec.section === 'Ortsnamen') {
        body.append(h('div', { class: 'row' },
          h('button', { id: 'btnGeocode', class: 'online-btn', onclick: geocode }, '🌐 Fehlende Ortsnamen holen'),
          h('button', { onclick: () => { if (confirm('Gespeicherte Ortsnamen löschen?')) { Geo.clear(); recompute(); } } }, 'Cache leeren'),
          h('span', { id: 'geoCacheInfo', class: 'hint' })));
      }
      form.append(h('details', { class: 'sec', open: !['Sonderordner', 'Bilder ohne GPS'].includes(sec.section) },
        h('summary', {}, sec.section, sec.online ? h('span', { class: 'badge-online', title: 'Nutzt das Internet' }, '🌐 online') : null),
        body));
    }
    refreshDeps();
  }

  function settingRow(it) {
    const id = 'set-' + it.key;
    let input;
    const v = st.s[it.key];
    if (it.type === 'bool') input = h('input', { type: 'checkbox', id, checked: !!v });
    else if (it.type === 'num') input = h('input', { type: 'number', id, value: v, min: it.min, step: it.step || 1 });
    else if (it.type === 'select') input = h('select', { id }, it.options.map(([val, lab]) => h('option', { value: val, selected: String(v) === val }, lab)));
    else if (it.type === 'area') input = h('textarea', { id, rows: 3 }, v);
    else input = h('input', { type: 'text', id, value: v });

    const read = () => it.type === 'bool' ? input.checked : it.type === 'num' ? parseFloat(input.value) : input.value;
    const apply = () => {
      const val = read();
      if (it.type === 'num' && !Number.isFinite(val)) return;
      st.s[it.key] = val;
      Settings.save(st.s);
      refreshDeps();
      onSettingChanged(it);
    };
    const deb = Util.debounce(apply, 400);
    input.addEventListener(it.type === 'bool' || it.type === 'select' ? 'change' : 'input', it.type === 'bool' || it.type === 'select' ? apply : deb);

    const label = h('label', { for: id }, it.label, it.online ? h('span', { class: 'badge-online' }, '🌐') : null);
    const row = h('div', { class: `row row-${it.type}`, 'data-key': it.key },
      it.type === 'bool' ? [input, label] : [label, input],
      it.help ? h('div', { class: 'hint' }, it.help) : null);
    return row;
  }

  function refreshDeps() {
    for (const it of Settings.SCHEMA.flatMap(s => s.items)) {
      const row = document.querySelector(`.row[data-key="${it.key}"]`);
      if (!row) continue;
      let on = true;
      for (let d = it.dep; d && on; d = Settings.byKey[d]?.dep) on = !!st.s[d];
      row.classList.toggle('disabled', !on);
      row.querySelectorAll('input,select,textarea').forEach(e => { e.disabled = !on; });
    }
  }

  function onSettingChanged(it) {
    netState();
    if (it.level === 'map') { MapView.setTiles(st.s.tiles); return; }
    if (it.level === 'scan') { if (st.items) status('Geändert: bitte neu einlesen („Einlesen“).'); return; }
    if (it.level === 'date' && st.items) for (const i of st.items) Meta.applyDate(i, st.s);
    recompute();
  }

  // ---------------- Berechnung ----------------
  function recompute(keepView = true) {
    $('#geoCacheInfo') && ($('#geoCacheInfo').textContent = `${Geo.size()} Orte gespeichert`);
    if (!st.items) { updateButtons(); return; }
    st.analysis = Analyze.run(st.items, st.s, st.zones, st.overrides);
    st.plan = Plan.build(st.analysis, st.s);
    if (st.selected) st.selected = st.analysis.events.find(e => e.id === st.selected.id) || null;
    MapView.render(st.analysis, st.zones);
    renderEvents();
    renderPreview();
    renderZoneList();
    updateButtons();
    const missing = st.s.geocode ? st.analysis.events.filter(e => !Geo.lookup(e.lat, e.lon)).length : 0;
    const gb = $('#btnGeocode'); if (gb) gb.textContent = `🌐 Fehlende Ortsnamen holen (${missing})`;
    const evs = st.analysis.events.filter(e => e.kind !== 'none');
    $('#cntEvents').textContent = evs.length;
    if (!document.body.classList.contains('busy')) {
      status(`${st.items.length} Dateien · ${st.analysis.withGps} mit GPS · ${evs.length} Ereignisse · ${st.plan.ops.length} Kopien geplant`);
    }
  }
  const recomputeSoon = Util.debounce(recompute, 150);

  // ---------------- Ordner ----------------
  const fsSupported = 'showDirectoryPicker' in window;

  async function pickSrc() {
    try {
      st.src = await showDirectoryPicker({ id: 'fs-src', mode: 'read' });
      await Util.idb.set('srcHandle', st.src);
      $('#srcName').textContent = st.src.name;
      updateButtons();
      scan();
    } catch (e) { if (e.name !== 'AbortError') alert(e.message); }
  }
  async function pickDst() {
    try {
      st.dst = await showDirectoryPicker({ id: 'fs-dst', mode: 'readwrite' });
      if (st.src && await st.src.isSameEntry(st.dst)) { alert('Ziel darf nicht gleich der Quelle sein.'); st.dst = null; return; }
      await Util.idb.set('dstHandle', st.dst);
      $('#dstName').textContent = st.dst.name;
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

  async function copy() {
    if (!st.plan) return;
    if (!st.dst) { await pickDst(); if (!st.dst) return; }
    if (!(await ensurePermission(st.dst, 'readwrite'))) return;
    if (!(await ensurePermission(st.src, 'read'))) return;
    const bytes = st.plan.ops.reduce((a, o) => a + o.item.size, 0);
    if (!confirm(`${st.plan.ops.length} Kopien (${fmtBytes(bytes)}) nach „${st.dst.name}“ schreiben?\n\nOriginale bleiben unverändert, vorhandene Dateien werden nicht überschrieben.`)) return;
    st.abort = new AbortController();
    busy(true);
    showTab('log');
    log(`Kopieren gestartet: ${st.plan.ops.length} Dateien nach „${st.dst.name}“`);
    try {
      const r = await Copier.run(st.dst, st.plan.ops, p => status(
        `Kopiere … ${p.done} / ${p.total} · ${fmtBytes(p.bytes)} · ${fmtBytes(p.rate)}/s${p.errors ? ` · ${p.errors} Fehler` : ''}`, p.done / p.total), st.abort.signal);
      const msg = `${r.aborted ? 'Abgebrochen' : 'Fertig'}: ${r.copied} kopiert, ${r.skipped} übersprungen (existierten), ${r.errors} Fehler · Protokoll: ${r.logName}`;
      log(msg);
      for (const l of r.log.filter(l => l.status.startsWith('FEHLER')).slice(0, 50)) log(`  ${l.quelle} → ${l.ziel}: ${l.status}`, 'err');
      status(msg);
    } catch (e) { log('Fehler: ' + e.message, 'err'); status('Fehler: ' + e.message); }
    finally { busy(false); }
  }

  function log(text, cls = '') {
    const t = new Date();
    $('#logList').prepend(h('div', { class: 'log ' + cls }, `${Util.pad(t.getHours())}:${Util.pad(t.getMinutes())}:${Util.pad(t.getSeconds())}  ${text}`));
  }

  // ---------------- Tabs ----------------
  function showTab(name) {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
    if (name === 'map') setTimeout(MapView.invalidate, 0);
  }

  // ---------------- Zonen ----------------
  function addZone(lat, lon, preset = {}) {
    const z = { id: Date.now().toString(36), name: '', type: 'named', r: 2, lat, lon, ...preset };
    st.zones.push(z);
    saveZones();
    recompute();
    setTimeout(() => document.querySelector(`[data-zone="${z.id}"] input`)?.focus(), 50);
  }

  function renderZoneList() {
    const list = $('#zoneList');
    list.innerHTML = '';
    if (!st.zones.length) list.append(h('div', { class: 'hint' }, 'Noch keine Zonen. „+ Zone“ und dann auf die Karte klicken.'));
    for (const z of st.zones) {
      const upd = (k, v) => { z[k] = v; saveZones(); recomputeSoon(); };
      list.append(h('div', { class: 'zone', 'data-zone': z.id },
        h('span', { class: 'dot', style: `background:${MapView.ZONE_COLORS[z.type]}` }),
        h('input', { type: 'text', value: z.name, placeholder: 'Name', oninput: e => upd('name', e.target.value) }),
        h('select', { onchange: e => upd('type', e.target.value) },
          Object.entries(MapView.ZONE_TYPES).map(([k, v]) => h('option', { value: k, selected: z.type === k }, v))),
        h('input', { type: 'number', value: z.r, min: 0.1, step: 0.1, title: 'Radius km', oninput: e => { const v = parseFloat(e.target.value); if (v > 0) upd('r', v); } }),
        h('span', { class: 'unit' }, 'km'),
        h('button', { title: 'Auf Karte zeigen', onclick: () => MapView.focus(z.lat, z.lon) }, '⌖'),
        h('button', { title: 'Löschen', onclick: () => { st.zones = st.zones.filter(x => x !== z); saveZones(); recompute(); } }, '✕')));
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
      tb.append(h('tr', { class: `kind-${ev.kind}${st.selected === ev ? ' selected' : ''}` },
        h('td', {}, h('span', { class: 'dot', style: `background:${MapView.COLORS[ev.kind]}` }),
          h('select', { onchange: e => setO('kind', e.target.value === ev.autoKind ? null : e.target.value) },
            Object.entries(Analyze.KINDS).map(([k, v]) => h('option', { value: k, selected: ev.kind === k }, v + (k === ev.autoKind ? ' (auto)' : ''))))),
        h('td', {}, h('input', { type: 'text', class: 'place', value: o.name || '', placeholder: o.name ? '' : ev.place,
          title: `Ortsname – Quelle: ${ev.placeSrc}. Leer lassen für automatisch.`, onchange: e => setO('name', e.target.value.trim()) })),
        h('td', { class: 'nowrap' }, ev.days > 1 ? `${fmtDate(ev.start)} – ${fmtDate(ev.end)}` : fmtDate(ev.start)),
        h('td', { class: 'num' }, ev.days),
        h('td', { class: 'num' }, ev.weekendDays),
        h('td', { class: 'num' }, ev.items.length),
        h('td', { class: 'num' }, ev.perDay.toFixed(1)),
        h('td', { class: 'num' }, Math.round(ev.maxKm) + ' km'),
        h('td', { class: 'src' }, ev.placeSrc),
        h('td', { class: 'path' }, dir ? dir.join('/') : '–'),
        h('td', { class: 'nowrap' },
          h('button', { title: 'Auf Karte zeigen', onclick: () => { showTab('map'); MapView.fitEvent(ev); } }, '🗺'),
          h('button', { title: 'Bilder anzeigen', onclick: () => { st.selected = ev; renderEvents(); } }, '🖼'))));
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
      h('button', { onclick: () => { st.selected = null; renderEvents(); } }, 'Schließen')));
    const grid = h('div', { class: 'thumbs' });
    const all = [...ev.items, ...ev.excludedItems].sort((a, b) => a.date - b.date);
    for (const it of all.slice(0, 300)) {
      const inEv = !st.overrides.files[it.id];
      const fig = h('figure', { class: inEv ? '' : 'off' });
      const ph = h('div', { class: 'ph' }, it.isVideo ? '🎬' : '🖼');
      fig.append(ph);
      loadThumb(it).then(u => {
        if (!u) return;
        st.thumbUrls.push(u);
        const el = it.isVideo ? h('video', { src: u + '#t=0.5', muted: true, preload: 'metadata' }) : h('img', { src: u, decoding: 'async' });
        el.onerror = () => el.replaceWith(ph);
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
    const kindName = { month: 'Monatsordner', rule: 'Sonderordner', vac: st.s.vacFolder, trip: st.s.tripFolder, work: st.s.workFolder };
    sum.innerHTML = `
      <div class="cards">
        <div><b>${a.items.length}</b>Dateien</div>
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
        for (const f of files.slice(0, 500)) {
          inner.append(h('div', { class: 'tree-file', title: `Quelle: ${f.item.path}\nDatum: ${Util.fmtDateTime(f.item.date)} (${f.item.dateSrc})` },
            f.name, h('span', { class: 'from' }, ' ← ' + f.item.name)));
        }
        if (files.length > 500) inner.append(h('div', { class: 'hint' }, `… und ${files.length - 500} weitere`));
        d.append(inner);
      });
      container.append(d);
    }
  }

  // ---------------- Export / Import ----------------
  function exportConfig() {
    const blob = new Blob([JSON.stringify({ settings: st.s, zones: st.zones, overrides: st.overrides }, null, 2)], { type: 'application/json' });
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
        buildSettings(); netState(); MapView.setTiles(st.s.tiles); recompute();
      } catch (e) { alert('Datei ungültig: ' + e.message); }
    };
    inp.click();
  }
  function resetConfig() {
    if (!confirm('Alle Einstellungen auf Standard zurücksetzen? (Zonen und manuelle Änderungen bleiben)')) return;
    st.s = Settings.defaults(); Settings.save(st.s);
    buildSettings(); netState(); MapView.setTiles(st.s.tiles); recompute();
  }
  function resetOverrides() {
    if (!confirm('Alle manuellen Änderungen in der Ereignisliste verwerfen?')) return;
    st.overrides = { events: {}, files: {} }; saveOverrides(); recompute();
  }

  // ---------------- Start ----------------
  async function start() {
    if (!fsSupported) $('#unsupported').hidden = false;
    buildSettings();
    netState();
    MapView.init($('#map'), {
      onAddZone: addZone,
      onAddMode: on => $('#btnAddZone').classList.toggle('active', on),
      onZoneMoved: (z, lat, lon) => { z.lat = lat; z.lon = lon; saveZones(); recompute(); },
      onZoneClick: z => document.querySelector(`[data-zone="${z.id}"] input`)?.focus(),
      onEventClick: ev => { st.selected = ev; renderEvents(); showTab('events'); },
    });
    MapView.setTiles(st.s.tiles);
    renderZoneList();

    $('#btnSrc').onclick = pickSrc;
    $('#btnDst').onclick = pickDst;
    $('#btnScan').onclick = scan;
    $('#btnCopy').onclick = copy;
    $('#btnCancel').onclick = () => st.abort?.abort();
    $('#btnAddZone').onclick = () => MapView.setAddMode(!MapView.addMode);
    $('#btnFit').onclick = () => MapView.fitAll(st.analysis);
    $('#btnExport').onclick = exportConfig;
    $('#btnImport').onclick = importConfig;
    $('#btnReset').onclick = resetConfig;
    $('#btnResetOverrides').onclick = resetOverrides;
    $('#btnGeocode2').onclick = geocode;
    for (const id of ['#fltKind', '#fltYear']) $(id).onchange = renderEvents;
    $('#fltText').oninput = Util.debounce(renderEvents, 200);
    document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
    $('#legend').innerHTML = [['vac', 'Urlaub'], ['trip', 'Ausflug'], ['work', 'Dienstreise'], ['home', 'Zuhause / Alltag'], ['other', 'Sonstige']]
      .map(([k, n]) => `<span><i style="background:${MapView.COLORS[k]}"></i>${n}</span>`).join('');

    updateButtons();
    status('Quelle wählen, um zu beginnen.');
    // Zuletzt verwendete Ordner wiederherstellen (Zugriff muss per Klick erneut erlaubt werden)
    if (fsSupported) {
      try {
        st.src = await Util.idb.get('srcHandle') || null;
        st.dst = await Util.idb.get('dstHandle') || null;
      } catch { /* kein Zugriff auf IndexedDB */ }
      if (st.src) $('#srcName').textContent = st.src.name;
      if (st.dst) $('#dstName').textContent = st.dst.name;
    }
    updateButtons();
    status(st.src ? `Quelle „${st.src.name}“ – „Einlesen“ klicken.` : 'Quelle wählen, um zu beginnen.');
  }

  // Fuer Tests und Fehlersuche in der Browser-Konsole
  window.Fotosortierer = { state: st, recompute, showTab, fitAll: () => MapView.fitAll(st.analysis) };

  start();
})();
