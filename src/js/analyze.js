// Erkennung von Wohnort, Alltagsorten, Urlauben, Ausfluegen und Dienstreisen
const Analyze = (() => {
  const { distKm, dayKey, dayFromKey, addDays, daysBetween, isWeekend } = Util;

  const KINDS = {
    vac: 'Urlaub',
    trip: 'Ausflug',
    work: 'Dienstreise',
    none: '– kein Ordner –',
  };

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
        ? `${ev.days} Tage, bis ${Math.round(ev.maxKm)} km von zu Hause`
        : `${far.length} Bilder außerhalb, bis ${Math.round(ev.maxKm)} km von zu Hause`;
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
      if (named && named.name) { ev.place = named.name; ev.placeSrc = 'Zone'; }
      else if (geo) { ev.place = Geo.format(geo, s); ev.placeSrc = 'OpenStreetMap'; }
      else { ev.place = Util.fmtCoord(ev.lat, ev.lon); ev.placeSrc = 'Koordinaten'; }
    }

    // --- Dienstreisen ---
    if (s.workEnabled) {
      const workZones = zones.filter(z => z.type === 'work');
      for (const ev of events) {
        const inWork = ev.far.filter(p => zoneHit(workZones, p)).length > ev.far.length / 2;
        const byRule = ev.kind === 'vac' && s.workRuleEnabled &&
          (!s.workNoWeekend || ev.weekendDays === 0) && ev.perDay < s.workMaxPerDay;
        if (inWork) { ev.kind = ev.autoKind = 'work'; ev.reason = 'liegt in einer Zone „Dienstort“'; ev.byZone = true; }
        else if (byRule) {
          ev.kind = ev.autoKind = 'work';
          ev.reason = `Regel: ${s.workNoWeekend ? 'nur Werktage, ' : ''}${ev.perDay.toFixed(1)} Bilder/Tag (Grenze ${s.workMaxPerDay})`;
        }
      }
      if (s.workSamePlace) {
        const places = new Set(events.filter(e => e.kind === 'work').map(e => e.place));
        for (const ev of events) {
          if (ev.kind === 'trip' && places.has(ev.place) && !isWeekend(ev.start)) {
            ev.kind = ev.autoKind = 'work';
            ev.reason = 'Werktag am selben Ort wie andere Dienstreisen';
          }
        }
      }
    }

    // --- Manuelle Aenderungen aus der Vorschau ---
    for (const ev of events) {
      const o = overrides.events?.[ev.id];
      if (!o) continue;
      if (o.kind) ev.kind = o.kind;
      if (o.name) { ev.place = o.name; ev.placeSrc = 'manuell'; }
      ev.ok = !!o.ok;
    }
    for (const ev of events) if (ev.kind === 'none') for (const m of ev.items) m.event = null;

    return { items: sorted, homes, autoDaily, events, withGps: gps.length };
  }

  return { run, KINDS };
})();
