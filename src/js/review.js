// Pruefmodus: Ereignis fuer Ereignis durchklicken und Art bestaetigen (Tasten 1–4, Enter, ←/→)
const Review = (() => {
  const { h, fmtDate } = Util;
  const CHOICES = [['vac', '1', 'Urlaub'], ['trip', '2', 'Ausflug'], ['work', '3', 'Dienstreise'], ['none', '4', 'Kein Ordner']];
  let app, pos = 0, currentId = null, thumbUrls = [];

  // Wie knapp liegt ein Ereignis an einer Regelgrenze? 0 = sehr unsicher, 1 = sicher
  function certainty(ev, s) {
    const m = [];
    if (ev.byZone) return 1;
    if (ev.autoKind === 'work') m.push((s.workMaxPerDay - ev.perDay) / Math.max(s.workMaxPerDay, 1));
    if (ev.autoKind === 'vac') {
      if (ev.weekendDays === 0 && s.workEnabled) m.push((ev.perDay - s.workMaxPerDay) / Math.max(s.workMaxPerDay, 1));
      m.push((ev.maxKm - s.vacKm) / s.vacKm);
      m.push((ev.days - s.vacMinDays + 1) / Math.max(s.vacMinDays, 1));
    }
    if (ev.autoKind === 'trip') {
      m.push((ev.far.length - s.tripMinPics + 1) / Math.max(s.tripMinPics, 1));
      m.push((ev.maxKm - s.nearKm) / s.nearKm);
    }
    return m.length ? Math.min(1, ...m.map(Math.abs)) : 1;
  }

  function queue() {
    const a = app.st.analysis;
    if (!a) return [];
    let q = a.events.filter(e => e.passCount > 0);
    if ($('#rvOpen').checked) q = q.filter(e => !e.ok);
    if ($('#rvOrder').value === 'unsure') q = [...q].sort((x, y) => certainty(x, app.st.s) - certainty(y, app.st.s));
    return q;
  }
  const $ = sel => document.querySelector(sel);

  function init(appCtx) {
    app = appCtx;
    $('#rvOpen').onchange = () => { pos = 0; render(); };
    $('#rvOrder').onchange = () => { pos = 0; render(); };
    document.addEventListener('keydown', e => {
      if (!$('#tab-review').classList.contains('active') || !$('#viewer').hidden) return;
      if (e.target.matches?.('input,select,textarea')) { if (e.key === 'Enter') e.target.blur(); return; }
      const c = CHOICES.find(x => x[1] === e.key);
      if (c) { e.preventDefault(); choose(c[0]); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(null); }
      else if (e.key === 'ArrowRight') { pos++; render(); }
      else if (e.key === 'ArrowLeft') { pos = Math.max(0, pos - 1); render(); }
    });
  }

  // Auswahl speichern; kind = null bedeutet: aktuelle Art bestaetigen
  function choose(kind) {
    const q = queue();
    const ev = q[Math.min(pos, q.length - 1)];
    if (!ev) return;
    const o = { ...(app.st.overrides.events[ev.id] || {}) };
    const k = kind || ev.kind;
    if (k === ev.autoKind) delete o.kind; else o.kind = k;
    const name = $('#rvName')?.value.trim();
    if (name && name !== ev.place) o.name = name;
    o.ok = true;
    app.st.overrides.events[ev.id] = o;
    app.saveOverrides();
    if (!$('#rvOpen').checked) pos++;
    app.recompute();
  }

  function render() {
    thumbUrls.forEach(u => URL.revokeObjectURL(u));
    thumbUrls = [];
    const box = $('#rvCard');
    box.innerHTML = '';
    const a = app.st.analysis;
    if (!a) { box.append(h('div', { class: 'hint' }, 'Zuerst einen Quellordner einlesen.')); return; }
    const all = a.events.filter(e => e.passCount > 0);
    const done = all.filter(e => e.ok).length;
    $('#rvProgress').textContent = `${done} von ${all.length} geprüft`;
    const q = queue();
    if (!q.length) { box.append(h('div', { class: 'rv-done' }, '✓ Alles geprüft.')); return; }
    pos = Math.min(pos, q.length - 1);
    const ev = q[pos];
    if (currentId !== ev.id) { currentId = ev.id; }

    const s = app.st.s;
    const unsure = certainty(ev, s) < 0.25;
    box.append(
      h('div', { class: 'rv-head' },
        h('div', { class: 'rv-pos' }, `${pos + 1} / ${q.length}`),
        h('h2', {}, ev.place),
        h('div', { class: 'rv-facts' },
          `${ev.days > 1 ? `${fmtDate(ev.start)} – ${fmtDate(ev.end)}` : fmtDate(ev.start)} · ${ev.days} ${ev.days > 1 ? 'Tage' : 'Tag'}` +
          ` · ${ev.weekendDays} Sa/So · ${ev.items.length} Bilder · ${ev.perDay.toFixed(1)}/Tag · bis ${Math.round(ev.maxKm)} km`)),
      h('div', { class: 'rv-reason' + (unsure ? ' unsure' : '') },
        'Vorschlag: ', h('b', {}, Analyze.KINDS[ev.autoKind]), ` – ${ev.reason}`,
        unsure ? h('span', { class: 'rv-flag' }, 'knapp an der Grenze') : null,
        ev.ok ? h('span', { class: 'rv-ok' }, `✓ geprüft: ${Analyze.KINDS[ev.kind]}`) : null),
      h('div', { class: 'rv-choices' }, CHOICES.map(([k, key, label]) =>
        h('button', { class: `rv-choice kind-${k}${ev.kind === k ? ' current' : ''}`, onclick: () => choose(k) },
          h('kbd', {}, key), ' ', label, k === ev.autoKind ? h('small', {}, ' Vorschlag') : null))),
      h('div', { class: 'rv-row' },
        h('label', { for: 'rvName' }, 'Ortsname '),
        h('input', { id: 'rvName', type: 'text', value: ev.place }),
        h('span', { class: 'spacer' }),
        h('button', { onclick: () => { pos = Math.max(0, pos - 1); render(); } }, '← Zurück'),
        h('button', { onclick: () => { pos++; render(); } }, 'Überspringen →'),
        h('button', { class: 'primary', onclick: () => choose(null) }, '✓ Übernehmen (Enter)'),
        h('button', { title: 'Auf der Karte zeigen', onclick: () => app.showEventOnMap(ev) }, '🗺')));

    const grid = h('div', { class: 'thumbs rv-thumbs' });
    const items = ev.items;
    const step = Math.max(1, Math.ceil(items.length / 48));  // bei grossen Urlauben gleichmaessig verteilt
    items.filter((_, i) => i % step === 0).forEach(it => {
      const ph = h('div', { class: 'ph' }, it.isVideo ? '🎬' : '🖼');
      const fig = h('figure', { onclick: () => app.openViewer(items, items.indexOf(it)) }, ph,
        h('figcaption', {}, `${Util.pad(it.date.getDate())}.${Util.pad(it.date.getMonth() + 1)}. ${Util.pad(it.date.getHours())}:${Util.pad(it.date.getMinutes())}`));
      app.loadThumb(it).then(u => {
        if (!u) return;
        thumbUrls.push(u);
        const el = it.isVideo ? h('video', { src: u + '#t=0.5', muted: true, preload: 'metadata' }) : h('img', { src: u });
        el.onerror = () => el.replaceWith(ph);
        ph.replaceWith(el);
      });
      grid.append(fig);
    });
    if (step > 1) grid.append(h('div', { class: 'hint' }, `Jedes ${step}. Bild von ${items.length} – Klick öffnet die Bildansicht mit allen.`));
    box.append(grid);
  }

  return { init, render, certainty };
})();
