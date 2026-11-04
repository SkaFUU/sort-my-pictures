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

  function itemTokens(it, s) {
    const base = it.name.replace(/\.[^.]+$/, '');
    return {
      ...Util.dateTokens(it.date, s.lang),
      NAME: base,
      TYP: it.isVideo ? s.videoWord : s.photoWord,
      KAMERA: it.model || '',
    };
  }

  function eventTokens(ev, s) {
    const folders = { vac: s.vacFolder, trip: s.tripFolder, work: s.workFolder };
    return {
      ...Util.dateTokens(ev.start, s.lang),
      ...Util.dateTokens(ev.end, s.lang, 'E'),
      KAT: folders[ev.kind] || '',
      ORT: ev.place,
      KOORD: Util.fmtCoord(ev.lat, ev.lon),
      TAGE: String(ev.days),
      ANZ: String(ev.items.length),
    };
  }

  function build(analysis, s) {
    const ops = [];
    const taken = new Set();
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
      if (ev.kind === 'none') continue;
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
    for (const it of analysis.items) {
      if (s.dupSkip) {
        const k = `${it.size}|${it.date.getTime()}`;
        if (seen.has(k)) { dups.push({ item: it, original: seen.get(k) }); continue; }
        seen.set(k, it);
      }
      const tokens = itemTokens(it, s);
      const rule = rules.find(r => r.re.test(it.name));
      if (rule) add(it, Util.templatePath(s.rulesTpl, { ...tokens, REGEL: rule.folder }), 'rule');
      if (s.monthFolders && !(rule && s.rulesExclusive)) add(it, Util.templatePath(s.monthTpl, tokens), 'month');
      if (it.event && evDir.has(it.event)) add(it, evDir.get(it.event), it.event.kind, it.event);
    }
    return { ops, dups, evDir };
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

  return { build, tree, eventTokens };
})();
