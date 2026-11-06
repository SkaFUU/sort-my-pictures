// Zielplan: welche Datei wird wohin kopiert und wie heisst sie
const Plan = (() => {
  // "Muster => Ordner" je Zeile; Muster ist Text (ohne Gross/Klein) oder /RegEx/
  function parseRules(text) {
    return text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
      const [pat, folder] = l.split('=>').map(x => (x || '').trim());
      if (!pat || !folder) return null;
      const m = /^\/(.+)\/([a-z]*)$/.exec(pat);
      let re;
      try { re = m ? new RegExp(m[1], m[2] || 'i') : new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); }
      catch { return null; }
      return { re, folder };
    }).filter(Boolean);
  }

  // Platzhalter gibt es deutsch und englisch ({TYP} = {TYPE} …)
  function itemTokens(it, s) {
    const base = it.name.replace(/\.[^.]+$/, '');
    const typ = it.isVideo ? s.videoWord : s.photoWord;
    return {
      ...Util.dateTokens(it.date, s.lang),
      NAME: base,
      TYP: typ, TYPE: typ,
      KAMERA: it.model || '', CAMERA: it.model || '',
    };
  }

  function eventTokens(ev, s) {
    const kat = Analyze.kind(ev.kind).folder || '';
    const coord = Util.fmtCoord(ev.lat, ev.lon);
    return {
      ...Util.dateTokens(ev.start, s.lang),
      ...Util.dateTokens(ev.end, s.lang, 'E'),
      KAT: kat, CAT: kat,
      ORT: ev.place, PLACE: ev.place,
      KOORD: coord, COORD: coord,
      TAGE: String(ev.days), DAYS: String(ev.days),
      ANZ: String(ev.items.length), COUNT: String(ev.items.length),
    };
  }

  // Filter aus den Einstellungen -> Funktion item => true/false
  function makeFilter(s, zones) {
    const from = s.filterFrom ? Util.dayFromKey(s.filterFrom) : null;
    const to = s.filterTo ? Util.addDays(Util.dayFromKey(s.filterTo), 1) : null;
    const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const tFrom = s.filterTimeFrom ? mins(s.filterTimeFrom) : null;
    const tTo = s.filterTimeTo ? mins(s.filterTimeTo) : null;
    const wd = s.filterWeekdays || '1111111';
    const zone = s.filterZone ? zones.find(z => z.id === s.filterZone) : null;
    const cam = s.filterCamera.trim().toLowerCase();
    const persons = s.filterPersons.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    return it => {
      if (from && it.date < from) return false;
      if (to && it.date >= to) return false;
      if (tFrom != null || tTo != null) {
        const m = it.date.getHours() * 60 + it.date.getMinutes();
        const a = tFrom ?? 0, b = tTo ?? 1440;
        if (a <= b ? (m < a || m > b) : (m < a && m > b)) return false;
      }
      if (wd[(it.date.getDay() + 6) % 7] !== '1') return false;
      if (s.filterType === 'photo' && it.isVideo) return false;
      if (s.filterType === 'video' && !it.isVideo) return false;
      if (s.filterGps === 'with' && !it.hasGps) return false;
      if (s.filterGps === 'without' && it.hasGps) return false;
      if (zone) {
        const inside = it.hasGps && Util.distKm(zone.lat, zone.lon, it.lat, it.lon) <= zone.r;
        if (s.filterZoneMode === 'in' ? !inside : inside) return false;
      }
      if (cam && !`${it.make || ''} ${it.model || ''}`.toLowerCase().includes(cam)) return false;
      if (persons.length && !(it.persons && [...it.persons].some(p => persons.includes(p.toLowerCase())))) return false;
      return true;
    };
  }

  function build(analysis, s, zones = []) {
    const pass = makeFilter(s, zones);
    const passed = analysis.items.filter(pass);
    const passSet = new Set(passed);
    for (const ev of analysis.events) ev.passCount = ev.items.filter(i => passSet.has(i)).length;
    const ops = [];
    const taken = new Set();
    const single = s.outMode === 'inplace';
    const rules = parseRules(s.rulesText);
    const ext = it => '.' + (s.lowerExt ? it.ext.toLowerCase() : it.name.split('.').pop());

    const target = (dir, it) => {
      const base = Util.sanitizeSegment(Util.fillTemplate(s.fileTpl, itemTokens(it, s)));
      const dirKey = dir.join('/').toLowerCase();
      let name = base + ext(it), n = 2;
      while (taken.has(`${dirKey}/${name.toLowerCase()}`)) name = `${base}_${n++}${ext(it)}`;
      taken.add(`${dirKey}/${name.toLowerCase()}`);
      return name;
    };
    const add = (it, dir, kind, ev) => ops.push({ item: it, dir, name: target(dir, it), kind, event: ev || null });

    // Ereignis-Ordnernamen eindeutig machen (in Reihenfolge des Datums)
    const evDir = new Map();
    const usedEv = new Set();
    for (const ev of analysis.events) {
      if (ev.kind === 'none' || !ev.passCount) continue;
      const dir = Util.templatePath(s.eventTpl, eventTokens(ev, s));
      let key = dir.join('/').toLowerCase(), n = 2;
      const last = dir[dir.length - 1];
      while (usedEv.has(key)) { dir[dir.length - 1] = `${last}_${n++}`; key = dir.join('/').toLowerCase(); }
      usedEv.add(key);
      evDir.set(ev, dir);
    }

    // Duplikate: gleiche Groesse und gleiches Aufnahmedatum
    const seen = new Map();
    const dups = [];
    for (const it of passed) {
      if (s.dupSkip) {
        const k = `${it.size}|${it.date.getTime()}`;
        if (seen.has(k)) { dups.push({ item: it, original: seen.get(k) }); continue; }
        seen.set(k, it);
      }
      const tokens = itemTokens(it, s);
      const rule = rules.find(r => r.re.test(it.name));
      // In der Quelle umsortieren: jedes Foto bekommt genau einen Platz (Ereignis, sonst Sonderordner, sonst Monat),
      // sonst laegen danach Kopien in der Quelle, die beim naechsten Einlesen als Duplikate auftauchen.
      // Ausnahme Personenordner: die werden beim Einlesen uebersprungen (Meta.personDirTest)
      if (single) {
        if (it.event && evDir.has(it.event)) add(it, evDir.get(it.event), it.event.kind, it.event);
        else if (rule) add(it, Util.templatePath(s.rulesTpl, { ...tokens, REGEL: rule.folder, RULE: rule.folder }), 'rule');
        else if (s.monthFolders) add(it, Util.templatePath(s.monthTpl, tokens), 'month');
        // Personenordner auf Wunsch als zusaetzliche Kopien (werden beim Einlesen nicht als Fotos mitgezaehlt)
        if (s.personFolders && it.persons) {
          for (const p of [...it.persons].sort()) add(it, Util.templatePath(s.personTpl, { ...tokens, PERSON: p }), 'person');
        }
        continue;
      }
      if (rule) add(it, Util.templatePath(s.rulesTpl, { ...tokens, REGEL: rule.folder, RULE: rule.folder }), 'rule');
      if (s.monthFolders && !(rule && s.rulesExclusive)) add(it, Util.templatePath(s.monthTpl, tokens), 'month');
      if (it.event && evDir.has(it.event)) add(it, evDir.get(it.event), it.event.kind, it.event);
      if (s.personFolders && it.persons) {
        for (const p of [...it.persons].sort()) add(it, Util.templatePath(s.personTpl, { ...tokens, PERSON: p }), 'person');
      }
    }
    const byItem = new Map();
    for (const op of ops) {
      if (!byItem.has(op.item.id)) byItem.set(op.item.id, []);
      byItem.get(op.item.id).push(op);
    }
    return { ops, dups, evDir, byItem, single, filtered: analysis.items.length - passed.length };
  }

  // Baum fuer die Vorschau: { name, children: Map, files: [] }
  function tree(ops) {
    const root = { name: '', children: new Map(), files: [], count: 0 };
    for (const op of ops) {
      let n = root;
      n.count++;
      for (const seg of op.dir) {
        if (!n.children.has(seg)) n.children.set(seg, { name: seg, children: new Map(), files: [], count: 0 });
        n = n.children.get(seg);
        n.count++;
      }
      n.files.push(op);
    }
    return root;
  }

  return { build, tree, eventTokens, makeFilter };
})();
