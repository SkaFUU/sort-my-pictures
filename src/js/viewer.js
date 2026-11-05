// Bildansicht: grosses Bild, abgeleitete Infos, Mini-Karte und alle Metadaten. Pfeiltasten blaettern.
const Viewer = (() => {
  const { h, fmtDateTime, fmtBytes } = Util;
  let app, list = [], idx = 0, url = null, map = null, marker = null, tiles = null, root;

  function build() {
    root?.remove();
    root = h('div', { id: 'viewer', hidden: true },
      h('div', { class: 'v-main', onclick: e => { if (e.target.classList.contains('v-main')) close(); } },
        h('button', { class: 'v-nav v-prev', title: T('Vorheriges (←)'), onclick: () => go(-1) }, '‹'),
        h('div', { class: 'v-stage' }),
        h('button', { class: 'v-nav v-next', title: T('Nächstes (→)'), onclick: () => go(1) }, '›'),
        h('div', { class: 'v-counter' })),
      h('aside', { class: 'v-side' },
        h('div', { class: 'v-head' }, h('b', { class: 'v-title' }), h('button', { title: T('Schließen (Esc)'), onclick: close }, '✕')),
        h('div', { class: 'v-info' }),
        h('div', { id: 'vMap' }),
        h('details', { class: 'v-meta', open: true }, h('summary', {}, T('Alle Metadaten')), h('div', { class: 'v-meta-body' }))));
    document.body.append(root);
    map = marker = tiles = null;
  }

  function init(appCtx) {
    app = appCtx;
    build();
    document.addEventListener('keydown', e => {
      if (root.hidden || e.target.matches?.('input,select,textarea')) return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'Escape') close();
    });
  }

  function open(items, index = 0) {
    list = items; idx = Math.max(0, Math.min(index, items.length - 1));
    root.hidden = false;
    if (!map) {
      map = L.map('vMap', { zoomControl: false, attributionControl: true }).setView([48, 16], 12);
      marker = L.circleMarker([48, 16], { radius: 7, color: '#fff', weight: 2, fillColor: '#e8590c', fillOpacity: 1 }).addTo(map);
    }
    show();
  }
  function close() {
    root.hidden = true;
    if (url) { URL.revokeObjectURL(url); url = null; }
    root.querySelector('.v-stage').innerHTML = '';
  }
  function go(d) {
    if (!list.length) return;
    idx = (idx + d + list.length) % list.length;
    show();
  }

  async function show() {
    const it = list[idx];
    const stage = root.querySelector('.v-stage');
    root.querySelector('.v-counter').textContent = `${idx + 1} / ${list.length}`;
    root.querySelector('.v-title').textContent = it.name;
    stage.innerHTML = '<div class="v-loading">…</div>';
    if (url) { URL.revokeObjectURL(url); url = null; }

    let file = await it.handle.getFile().catch(e => e);
    if (list[idx] !== it) return;  // inzwischen weitergeblaettert
    if (file instanceof Error) { stage.innerHTML = ''; stage.append(h('div', { class: 'v-loading' }, T('Nicht lesbar: {0}', file.message))); return; }

    // Bild / Video
    let media;
    if (it.isVideo) {
      url = URL.createObjectURL(file);
      media = h('video', { src: url, controls: true, autoplay: true });
    } else {
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(it.ext)) url = URL.createObjectURL(file);
      else {
        const t = await exifr.thumbnail(file).catch(() => null);
        if (t) url = URL.createObjectURL(new Blob([t], { type: 'image/jpeg' }));
      }
      media = url ? h('img', { src: url }) : h('div', { class: 'v-loading' }, T('Keine Vorschau für dieses Format'));
    }
    const wrap = h('div', { class: 'v-wrap' }, media);
    const faces = app.facesOf(it);
    drawFaces(wrap, it);
    stage.innerHTML = '';
    stage.append(wrap);

    // Infos
    const ev = it.event;
    const ops = app.opsOf(it);
    const persons = it.persons ? [...it.persons] : [];
    const home = app.st.analysis?.homes[0];
    const rows = [
      [T('Pfad'), it.path],
      [T('Größe'), fmtBytes(it.size)],
      [T('Aufnahme'), `${fmtDateTime(it.date)} (${T(it.dateSrc)})`],
      [T('Kamera'), [it.make, it.model].filter(Boolean).join(' ') || '–'],
      [T('Standort'), it.hasGps
        ? `${it.lat.toFixed(5)}, ${it.lon.toFixed(5)}` + (home ? ' · ' + T('{0} km von zu Hause', Util.distKm(home.lat, home.lon, it.lat, it.lon).toFixed(1)) : '')
        : T('kein GPS')],
      [T('Ereignis'), ev ? `${Analyze.kind(ev.kind).label}: ${ev.place}` : '–'],
      [T('Personen'), persons.length ? persons.join(', ') : (faces.length ? T('{0} Gesicht(er), unbenannt', faces.length) : '–')],
      [T('Ziel'), ops.length ? ops.map(o => [...o.dir, o.name].join('/')).join('\n') : T('wird nicht kopiert (Filter/Duplikat)')],
    ];
    const info = root.querySelector('.v-info');
    info.innerHTML = '';
    info.append(h('table', {}, rows.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, v)))));
    if (ev) info.append(h('button', { onclick: () => { close(); app.openEvent(ev); } }, T('Ereignis öffnen')));

    // Karte
    const mapEl = root.querySelector('#vMap');
    mapEl.hidden = !it.hasGps;
    if (it.hasGps) {
      if (app.st.s.tiles && !tiles) tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
      if (!app.st.s.tiles && tiles) { map.removeLayer(tiles); tiles = null; }
      mapEl.classList.toggle('no-tiles', !app.st.s.tiles);
      setTimeout(() => { map.invalidateSize(); map.setView([it.lat, it.lon], map.getZoom() || 12); marker.setLatLng([it.lat, it.lon]); }, 0);
    }

    // Alle Metadaten
    const body = root.querySelector('.v-meta-body');
    body.innerHTML = '';
    body.append(h('div', { class: 'hint' }, T('Lese …')));
    let meta = null;
    if (!it.isVideo) {
      meta = await exifr.parse(file, {
        tiff: true, exif: true, gps: true, interop: true, ifd1: false, xmp: true, iptc: true,
        icc: false, makerNote: false, userComment: true, mergeOutput: false,
      }).catch(() => null);
    }
    if (list[idx] !== it) return;
    body.innerHTML = '';
    if (!meta) { body.append(h('div', { class: 'hint' }, T(it.isVideo ? 'Videos: nur Datum und GPS werden ausgelesen.' : 'Keine Metadaten gefunden.'))); return; }
    for (const [group, vals] of Object.entries(meta)) {
      if (!vals || typeof vals !== 'object') continue;
      body.append(h('div', { class: 'v-group' }, group.toUpperCase()));
      body.append(h('table', {}, Object.entries(vals).map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, fmtVal(v))))));
    }
  }

  // Gesichtsrahmen mit Namen; Klick auf einen Rahmen = Namen zuweisen
  function drawFaces(wrap, it) {
    wrap.querySelectorAll('.v-face').forEach(e => e.remove());
    app.facesOf(it).forEach((f, i) => {
      const [x, y, w, hh] = f.box;
      const name = app.faceName(it, i);
      const id = `${it.path}#${i}`;
      const pick = e => {
        e.preventDefault(); e.stopPropagation();
        if (!app.st.people) return;
        People.nameMenu(e.clientX, e.clientY, [id], () => { if (list[idx] === it) drawFaces(wrap, it); });
      };
      wrap.append(h('div', { class: 'v-face' + (name ? '' : ' none'), title: T('Klick: Namen zuweisen'), onclick: pick, oncontextmenu: pick,
        style: `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${hh * 100}%` },
        name ? h('span', {}, name) : null));
    });
  }

  function fmtVal(v) {
    if (v == null) return '';
    if (typeof v.getTime === 'function') return fmtDateTime(v);
    if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return T('[{0} Bytes]', v.length);
    if (Array.isArray(v)) return v.length > 12 ? T('[{0} Werte]', v.length) : v.map(fmtVal).join(', ');
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > 160 ? s.slice(0, 160) + T('… ({0} Zeichen)', s.length) : s;
  }

  // nach Sprachwechsel neu aufbauen
  function relang() {
    const wasOpen = !root.hidden;
    map?.remove();
    build();
    if (wasOpen && list.length) open(list, idx);
  }

  return { init, open, close, relang };
})();
