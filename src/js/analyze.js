// Erkennung von Wohnort, Alltagsorten, Urlauben, Ausfluegen, Dienstreisen und eigenen Kategorien
const Analyze = (() => {
  const { distKm, dayKey, dayFromKey, addDays, daysBetween, isWeekend } = Util;

  // Arten von Ereignissen: eingebaute + eigene Kategorien (Einstellung customCats) + "kein Ordner"
  const BUILTIN = [
    { id: 'vac', label: 'Urlaub', plural: 'Urlaube', icon: 'i-vac', color: '#e8590c', folderKey: 'vacFolder', key: '1' },
    { id: 'trip', label: 'Ausflug', plural: 'Ausflüge', icon: 'i-trip', color: '#2f9e44', folderKey: 'tripFolder', key: '2' },
    { id: 'work', label: 'Dienstreise', plural: 'Dienstreisen', icon: 'i-work', color: '#1971c2', folderKey: 'workFolder', key: '3' },
  ];
  const NONE = { id: 'none', label: '– kein Ordner –', plural: 'Ohne Ordner', icon: 'i-none', color: '#868e96', key: '4' };
  let current = [];

  function kinds(s) {
    const list = BUILTIN.map(k => ({ ...k, label: T(k.label), plural: T(k.plural), folder: s[k.folderKey] }));
    (s.customCats || []).filter(c => c.on !== false).forEach((c, i) => list.push({
      id: 'c:' + c.id, label: c.name || T('Kategorie {0}', i + 1), plural: c.name || T('Kategorie {0}', i + 1),
      icon: 'i-tag', color: c.color || '#f08c00', folder: c.folder || c.name || 'Kategorie', custom: c, key: i < 5 ? String(i + 5) : '',
    }));
    list.push({ ...NONE, label: T(NONE.label), plural: T(NONE.plural), folder: '' });
    return list;
  }
  const kind = id => current.find(k => k.id === id) || { ...NONE, id, label: id, folder: '' };

  // Passt ein Ereignis zu einer eigenen Kategorie?
  function matches(c, ev, zones) {
    const num = v => v === '' || v == null || !Number.isFinite(+v) ? null : +v;
    if (c.from && c.from !== 'any' && ev.kind !== c.from) return false;
    const kmMin = num(c.kmMin), kmMax = num(c.kmMax), dMin = num(c.daysMin), dMax = num(c.daysMax), pMin = num(c.picsMin);
    if (kmMin != null && ev.maxKm < kmMin) return false;
    if (kmMax != null && ev.maxKm > kmMax) return false;
    if (dMin != null && ev.days < dMin) return false;
    if (dMax != null && ev.days > dMax) return false;
    if (pMin != null && ev.items.length < pMin) return false;
    if (c.week === 'weekend' && !ev.weekendDays) return false;
    if (c.week === 'onlyweekend' && ev.weekendDays < ev.days) return false;
    if (c.week === 'workdays' && ev.weekendDays) return false;
    if (c.months && /0/.test(c.months)) {
      // irgendein Tag des Ereignisses liegt in einem gewaehlten Monat
      let hit = false;
      for (let d = dayFromKey(dayKey(ev.start)), i = 0; i < ev.days && !hit; i++, d = addDays(d, 1)) hit = c.months[d.getMonth()] === '1';
      if (!hit) return false;
    }
    if (c.zone) {
      const z = zones.find(x => x.id === c.zone);
      if (!z || ev.far.filter(p => distKm(z.lat, z.lon, p.lat, p.lon) <= z.r).length <= ev.far.length / 2) return false;
    }
    if (c.place && !ev.place.toLowerCase().includes(c.place.trim().toLowerCase())) return false;
    const persons = (c.persons || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    if (persons.length && !ev.items.some(it => it.persons && [...it.persons].some(p => persons.includes(p.toLowerCase())))) return false;
    return true;
  }

  // Kurzbeschreibung der Bedingungen fuer die Begruendung
  function describe(c) {
    const p = [];
    if (c.from && c.from !== 'any') p.push(T('aus {0}', T(BUILTIN.find(b => b.id === c.from)?.plural || c.from)));
    if (c.kmMin !== '' && c.kmMin != null) p.push(T('ab {0} km', c.kmMin));
    if (c.kmMax !== '' && c.kmMax != null) p.push(T('bis {0} km', c.kmMax));
    if (c.daysMin !== '' && c.daysMin != null) p.push(T('ab {0} Tage', c.daysMin));
    if (c.daysMax !== '' && c.daysMax != null) p.push(T('bis {0} Tage', c.daysMax));
    if (c.week && c.week !== 'any') p.push(T({ weekend: 'mit Wochenende', onlyweekend: 'nur Wochenende', workdays: 'nur Werktage' }[c.week]));
    if (c.months && /0/.test(c.months)) p.push(T('Monate {0}', [...c.months].map((v, i) => v === '1' ? i + 1 : null).filter(Boolean).join(',')));
    if (c.zone) p.push(T('in Zone'));
    if (c.place) p.push(T('Ort enthält „{0}“', c.place));
    if (c.persons) p.push(T('mit {0}', c.persons));
    return p.join(', ');
  }

  // Haeufigste 0.01-Grad-Zellen nach Anzahl verschiedener Tage
  function cells(pts) {
    const map = new Map();
    for (const p of pts) {
      const k = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
      let c = map.get(k);
      if (!c) map.set(k, c = { pts: [], days: new Set() });
      c.pts.push(p); c.days.add(p.day);
    }
    return [...map.values()].map(c => ({
      lat: c.pts.reduce((a, p) => a + p.lat, 0) / c.pts.length,
      lon: c.pts.reduce((a, p) => a + p.lon, 0) / c.pts.length,
      days: c.days.size, count: c.pts.length,
    })).sort((a, b) => b.days - a.days);
  }

  // Punkt mit den meisten Nachbarn im Umkreis von 10 km
  function representative(pts) {
    const sample = pts.length > 150 ? pts.filter((_, i) => i % Math.ceil(pts.length / 150) === 0) : pts;
    let best = sample[0], bestN = -1;
    for (const a of sample) {
      let n = 0;
      for (const b of sample) if (distKm(a.lat, a.lon, b.lat, b.lon) < 10) n++;
      if (n > bestN) { bestN = n; best = a; }
    }
    return best;
  }

  const zoneHit = (zones, p) => zones.find(z => distKm(z.lat, z.lon, p.lat, p.lon) <= z.r);

  function run(items, s, zones, overrides) {
    current = kinds(s);
    const sorted = [...items].sort((a, b) => a.date - b.date);
    for (const it of sorted) { it.day = dayKey(it.date); it.event = null; it.near = false; it.dHome = null; }
    const gps = sorted.filter(i => i.hasGps);

    // --- Wohnort(e) ---
    const homeZones = zones.filter(z => z.type === 'home');
    const cellList = cells(gps);
    const homes = homeZones.length
      ? homeZones.map(z => ({ lat: z.lat, lon: z.lon, r: z.r, auto: false, name: z.name }))
      : (s.homeAuto && cellList.length ? [{ lat: cellList[0].lat, lon: cellList[0].lon, r: s.nearKm, auto: true, days: cellList[0].days }] : []);

    const dHome = p => homes.length ? Math.min(...homes.map(h => distKm(h.lat, h.lon, p.lat, p.lon))) : Infinity;

    // --- Alltagsorte (automatisch) ---
    const autoDaily = !s.autoDaily || !homes.length ? [] : cellList
      .filter(c => c.days >= s.dailyMinDays)
      .filter(c => { const d = dHome(c); return d > s.nearKm && d < s.vacKm; })
      .map(c => ({ lat: c.lat, lon: c.lon, r: s.dailyRadiusKm, days: c.days, auto: true }));

    const ignoreZones = zones.filter(z => z.type === 'ignore').concat(autoDaily);
    for (const p of gps) {
      p.dHome = dHome(p);
      p.near = p.dHome < s.nearKm || !!zoneHit(homeZones, p) || !!zoneHit(ignoreZones, p);
    }

    const byDay = new Map();
    for (const it of sorted) { if (!byDay.has(it.day)) byDay.set(it.day, []); byDay.get(it.day).push(it); }

    const events = [];
    const excluded = overrides.files || {};
    const addEvent = (kind, all) => {
      // ID vor dem Ausschliessen bilden, damit manuelle Aenderungen erhalten bleiben
      const firstFar = all.find(m => m.hasGps && !m.near);
      const members = all.filter(m => !excluded[m.id]);
      const far = members.filter(m => m.hasGps && !m.near);
      if (!firstFar || !far.length) return;
      const rep = representative(far);
      const ev = {
        id: firstFar.id, kind, autoKind: kind, items: members, far,
        excludedItems: all.filter(m => excluded[m.id]),
        start: members[0].date, end: members[members.length - 1].date,
        lat: rep.lat, lon: rep.lon, maxKm: Math.max(...far.map(p => p.dHome)),
      };
      ev.days = daysBetween(ev.start, ev.end) + 1;
      let we = 0;
      for (let d = dayFromKey(dayKey(ev.start)), i = 0; i < ev.days; i++, d = addDays(d, 1)) if (isWeekend(d)) we++;
      ev.weekendDays = we;
      ev.perDay = members.length / ev.days;
      ev.reason = kind === 'vac'
        ? T('{0} Tage, bis {1} km von zu Hause', ev.days, Math.round(ev.maxKm))
        : T('{0} Bilder außerhalb, bis {1} km von zu Hause', far.length, Math.round(ev.maxKm));
      for (const m of members) m.event = ev;
      events.push(ev);
    };
    const inWindow = (list, far) => {
      const t0 = far[0].date, t1 = far[far.length - 1].date;
      return list.filter(m => m.date >= t0 && m.date <= t1 && (m.hasGps ? !m.near : s.includeNoGps));
    };

    // --- Urlaube: zusammenhaengende Tage mit Bildern weiter weg als vacKm ---
    if (s.vacEnabled) {
      const farDays = [...new Set(gps.filter(p => !p.near && p.dHome > s.vacKm).map(p => p.day))].sort();
      const runs = [];
      let cur = null;
      for (const k of farDays) {
        const d = dayFromKey(k);
        if (cur) {
          const gap = daysBetween(cur.last, d);
          let ok = gap <= s.vacMaxGap + 1;
          // Luecken-Tage duerfen keine Bilder in der Naehe von zu Hause haben
          for (let i = 1; ok && i < gap; i++) {
            const mid = byDay.get(dayKey(addDays(cur.last, i))) || [];
            if (mid.some(p => p.hasGps && p.dHome <= s.vacKm)) ok = false;
          }
          if (ok) { cur.last = d; continue; }
          runs.push(cur);
        }
        cur = { first: d, last: d };
      }
      if (cur) runs.push(cur);

      for (const r of runs) {
        if (daysBetween(r.first, r.last) + 1 < s.vacMinDays) continue;
        const inRun = sorted.filter(m => m.date >= r.first && m.date < addDays(r.last, 1));
        const far = inRun.filter(m => m.hasGps && !m.near);
        if (far.length) addEvent('vac', inWindow(inRun, far));
      }
    }

    // --- Ausfluege: einzelne Tage mit mehreren Bildern ausserhalb ---
    if (s.tripEnabled) {
      for (const list of byDay.values()) {
        const free = list.filter(m => !m.event);
        const far = free.filter(m => m.hasGps && !m.near);
        if (far.length >= s.tripMinPics) addEvent('trip', inWindow(free, far));
      }
    }
    events.sort((a, b) => a.start - b.start);

    // --- Ortsnamen (Zone > OSM-Cache > Koordinaten) ---
    for (const ev of events) {
      const named = zoneHit(zones.filter(z => z.type === 'named' || z.type === 'work'), ev);
      const geo = s.geocode ? Geo.lookup(ev.lat, ev.lon) : null;
      if (named && named.name) { ev.place = named.name; ev.placeSrc = T('Zone'); }
      else if (geo) { ev.place = Geo.format(geo, s); ev.placeSrc = 'OpenStreetMap'; }
      else { ev.place = Util.fmtCoord(ev.lat, ev.lon); ev.placeSrc = T('Koordinaten'); }
    }

    // --- Dienstreisen ---
    if (s.workEnabled) {
      const workZones = zones.filter(z => z.type === 'work');
      for (const ev of events) {
        const inWork = ev.far.filter(p => zoneHit(workZones, p)).length > ev.far.length / 2;
        const byRule = ev.kind === 'vac' && s.workRuleEnabled &&
          (!s.workNoWeekend || ev.weekendDays === 0) && ev.perDay < s.workMaxPerDay;
        if (inWork) { ev.kind = ev.autoKind = 'work'; ev.reason = T('liegt in einer Zone „Dienstort“'); ev.byZone = true; }
        else if (byRule) {
          ev.kind = ev.autoKind = 'work';
          ev.reason = T('Regel: {0}{1} Bilder/Tag (Grenze {2})', s.workNoWeekend ? T('nur Werktage, ') : '', ev.perDay.toFixed(1), s.workMaxPerDay);
        }
      }
      if (s.workSamePlace) {
        const places = new Set(events.filter(e => e.kind === 'work').map(e => e.place));
        for (const ev of events) {
          if (ev.kind === 'trip' && places.has(ev.place) && !isWeekend(ev.start)) {
            ev.kind = ev.autoKind = 'work';
            ev.reason = T('Werktag am selben Ort wie andere Dienstreisen');
          }
        }
      }
    }

    // --- Eigene Kategorien: die erste passende in der Reihenfolge der Liste gewinnt ---
    const cats = current.filter(k => k.custom);
    for (const ev of events) {
      const k = cats.find(c => matches(c.custom, ev, zones));
      if (!k) continue;
      const why = describe(k.custom);
      ev.kind = ev.autoKind = k.id;
      ev.reason = T('Eigene Kategorie „{0}“', k.label) + (why ? ` (${why})` : '');
    }

    // --- Manuelle Aenderungen aus der Vorschau ---
    for (const ev of events) {
      const o = overrides.events?.[ev.id];
      if (!o) continue;
      if (o.kind && current.some(k => k.id === o.kind)) ev.kind = o.kind;  // geloeschte Kategorie: Vorschlag gilt
      if (o.name) { ev.place = o.name; ev.placeSrc = T('manuell'); }
      ev.ok = !!o.ok;
    }
    for (const ev of events) if (ev.kind === 'none') for (const m of ev.items) m.event = null;

    return { items: sorted, homes, autoDaily, events, withGps: gps.length };
  }

  return { run, kinds, kind, get current() { return current; }, BUILTIN };
})();
