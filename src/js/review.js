// Pruefmodus: Ereignis fuer Ereignis durchklicken und Art bestaetigen (Tasten 1–9, Enter, ←/→)
const Review = (() => {
  const { h, fmtDate, icon } = Util;
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

  // Knoepfe fuer die Arten (eingebaute, eigene Kategorien, kein Ordner) ins Ribbon
  function buildKinds() {
    const box = $('#rvKinds');
    box.innerHTML = '';
    for (const k of Analyze.kinds(app.st.s)) {
      const ic = icon(k.icon);
      ic.style.color = k.color;
      box.append(h('button', { class: 'big rv-k', 'data-kind': k.id, onclick: () => choose(k.id) },
        ic, h('span', {}, k.key ? h('kbd', {}, k.key) : null, ' ' + (k.id === 'none' ? T('Kein Ordner') : k.label))));
    }
    render();
  }

  function init(appCtx) {
    app = appCtx;
    $('#rvOpen').onchange = () => { pos = 0; render(); };
    $('#rvOrder').onchange = () => { pos = 0; render(); };
    $('#rvAccept').onclick = () => choose(null);
    $('#rvPrev').onclick = () => { pos = Math.max(0, pos - 1); render(); };
    $('#rvNext').onclick = () => { pos++; render(); };
    $('#rvMap').onclick = () => { const ev = current(); if (ev) app.showEventOnMap(ev); };
    document.addEventListener('keydown', e => {
      if (app.tab !== 'review' || !$('#viewer').hidden || document.querySelector('dialog[open]')) return;
      if (e.target.matches?.('input,select,textarea')) { if (e.key === 'Enter') e.target.blur(); return; }
      const k = /^[1-9]$/.test(e.key) && Analyze.current.find(x => x.key === e.key);
      if (k) { e.preventDefault(); choose(k.id); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(null); }
      else if (e.key === 'ArrowRight') { pos++; render(); }
      else if (e.key === 'ArrowLeft') { pos = Math.max(0, pos - 1); render(); }
    });
  }

  const current = () => { const q = queue(); return q[Math.min(pos, q.length - 1)]; };

  // Ribbon-Knoepfe: aktuelle Art markieren, Vorschlag kennzeichnen
  function ribbon(ev) {
    document.querySelectorAll('.rv-k').forEach(b => {
      b.disabled = !ev;
      b.classList.toggle('sel', !!ev && ev.kind === b.dataset.kind);
      b.querySelector('.sug')?.remove();
      if (ev && ev.autoKind === b.dataset.kind) b.append(h('span', { class: 'sug' }, T('Vorschlag')));
    });
    for (const id of ['#rvAccept', '#rvPrev', '#rvNext', '#rvMap']) $(id).disabled = !ev;
  }

  // Auswahl speichern; kind = null bedeutet: aktuelle Art bestaetigen
  function choose(kind) {
    const ev = current();
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
    if (!a) { ribbon(null); $('#rvProgress').textContent = '–'; box.append(h('div', { class: 'empty' }, T('Zuerst in Schritt 1 eine Quelle einlesen.'))); return; }
    const all = a.events.filter(e => e.passCount > 0);
    const done = all.filter(e => e.ok).length;
    $('#rvProgress').textContent = T('{0} von {1} geprüft', done, all.length);
    const q = queue();
    if (!q.length) { ribbon(null); box.append(h('div', { class: 'rv-done' }, all.length ? T('✓ Alles geprüft.') : T('Keine Ereignisse gefunden.'))); return; }
    pos = Math.min(pos, q.length - 1);
    const ev = q[pos];
    if (currentId !== ev.id) { currentId = ev.id; }
    ribbon(ev);

    const s = app.st.s;
    const unsure = certainty(ev, s) < 0.25;
    const auto = Analyze.kind(ev.autoKind);
    box.append(
      h('div', { class: 'rv-head' },
        h('div', { class: 'rv-pos' }, `${pos + 1} / ${q.length}`),
        h('h2', {}, ev.place),
        h('div', { class: 'rv-facts' },
          `${ev.days > 1 ? `${fmtDate(ev.start)} – ${fmtDate(ev.end)}` : fmtDate(ev.start)} · ` +
          T('{0} Tag(e) · {1} Sa/So · {2} Bilder · {3}/Tag · bis {4} km', ev.days, ev.weekendDays, ev.items.length, ev.perDay.toFixed(1), Math.round(ev.maxKm)))),
      h('div', { class: 'rv-reason' + (unsure ? ' unsure' : '') },
        T('Vorschlag') + ': ', h('span', { class: 'rv-kind', style: `color:${auto.color}` }, auto.label), ` – ${ev.reason}`,
        unsure ? h('span', { class: 'rv-flag' }, T('knapp an der Grenze')) : null,
        ev.ok ? h('span', { class: 'rv-ok' }, T('✓ geprüft: {0}', Analyze.kind(ev.kind).label)) : null),
      h('div', { class: 'rv-row' },
        h('label', { for: 'rvName' }, T('Ortsname')),
        h('input', { id: 'rvName', type: 'text', value: ev.place }),
        h('span', { class: 'muted' }, T('Art oben im Ribbon wählen oder Taste 1–9.'))));

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
    if (step > 1) grid.append(h('div', { class: 'hint' }, T('Jedes {0}. Bild von {1} – Klick öffnet die Bildansicht mit allen.', step, items.length)));
    box.append(grid);
  }

  return { init, render, buildKinds, certainty };
})();
