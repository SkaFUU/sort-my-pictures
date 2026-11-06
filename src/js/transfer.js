// Verschieben (Quelle -> Ziel, danach in der Quelle loeschen) und Umsortieren (innerhalb der Quelle).
// Sicherheit: ein Original wird erst entfernt, wenn die Datei am neuen Platz vollstaendig nachgeprueft ist
// (Groesse und Inhalt gleich). Der Browser loescht ohne Papierkorb – deshalb lieber eine Datei stehen lassen
// als eine zu verlieren. Duplikate werden nie geloescht, sondern in den Ordner _Duplikate gelegt.
// Umsortieren schreibt ein Journal (_umsortiert_….json), mit dem sich alles zuruecknehmen laesst.
const Transfer = (() => {
  const JOURNAL = /^_(umsortiert|reorganized)_.*\.json$/;

  async function exists(dir, name) {
    try { await dir.getFileHandle(name); return true; }
    catch (e) { if (e.name === 'NotFoundError' || e.name === 'TypeMismatchError') return false; throw e; }
  }
  // Ordner-Handles (auf Wunsch anlegen) als Promise cachen, damit parallele Laeufe denselben Ordner nur einmal anlegen
  function dirGetter(root) {
    const cache = new Map();
    const get = segs => {
      if (!segs.length) return Promise.resolve(root);
      const key = segs.join('/');
      if (!cache.has(key)) {
        const p = get(segs.slice(0, -1)).then(parent => parent.getDirectoryHandle(segs[segs.length - 1], { create: true }));
        p.catch(() => cache.delete(key));
        cache.set(key, p);
      }
      return cache.get(key);
    };
    return get;
  }
  async function parentOf(root, path) {
    const segs = path.split('/');
    const name = segs.pop();
    let d = root;
    for (const s of segs) d = await d.getDirectoryHandle(s);
    return [d, name];
  }
  async function stillThere(root, path) {
    try { const [d, n] = await parentOf(root, path); return await exists(d, n); } catch { return false; }
  }

  // Inhalt vergleichen (in Stuecken, damit grosse Videos nicht ganz in den Speicher muessen)
  async function sameFile(a, b) {
    if (a.size !== b.size) return false;
    const CH = 4 << 20;
    for (let pos = 0; pos < a.size; pos += CH) {
      const [x, y] = await Promise.all([a.slice(pos, pos + CH).arrayBuffer(), b.slice(pos, pos + CH).arrayBuffer()]);
      const u = new Uint8Array(x), v = new Uint8Array(y);
      for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false;
    }
    return true;
  }
  async function copyVerified(file, dir, name) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await file.stream().pipeTo(w);
    const c = await fh.getFile();
    if (!(await sameFile(file, c))) {
      await dir.removeEntry(name).catch(() => {});
      throw new Error(T('Kopie stimmt nicht mit dem Original überein'));
    }
    return c;
  }

  // Eine Datei an einen neuen Platz bringen: direkt verschieben, wenn der Browser das kann (gleiches Laufwerk:
  // nur umbenennen, Datum bleibt), sonst kopieren, Kopie pruefen und erst dann das Original loeschen.
  // f: { handle, path } relativ zu fromRoot. Gibt die Datei am neuen Platz zurueck.
  async function moveFile(fromRoot, f, dir, name) {
    if (typeof f.handle.move === 'function') {
      try {
        await f.handle.move(dir, name);
        return await (await dir.getFileHandle(name)).getFile();
      } catch (e) {
        // doch angekommen? (manche Fehler kommen erst nach dem Umbenennen)
        if (await exists(dir, name)) {
          if (!(await stillThere(fromRoot, f.path))) return await (await dir.getFileHandle(name)).getFile();
          throw e;  // halbe Kopie neben dem Original: nichts anfassen
        }
      }
    }
    const file = await f.handle.getFile();
    const c = await copyVerified(file, dir, name);
    const [parent, base] = await parentOf(fromRoot, f.path);
    await parent.removeEntry(base);
    return c;
  }

  // Ordner, die durch das Verschieben leer geworden sind, entfernen (Thumbs.db/desktop.ini zaehlen als leer)
  const JUNK = /^(thumbs\.db|desktop\.ini|\.ds_store)$/i;
  async function removeEmptyDirs(root, paths) {
    const dirs = new Set();
    for (const p of paths) { const s = p.split('/'); for (let k = s.length - 1; k > 0; k--) dirs.add(s.slice(0, k).join('/')); }
    let removed = 0;
    for (const d of [...dirs].sort((a, b) => b.split('/').length - a.split('/').length)) {
      try {
        const [parent, name] = await parentOf(root, d);
        const h = await parent.getDirectoryHandle(name);
        const junk = [];
        let other = false;
        for await (const [n, x] of h.entries()) { if (x.kind === 'file' && JUNK.test(n)) junk.push(n); else { other = true; break; } }
        if (other) continue;
        for (const n of junk) await h.removeEntry(n);
        await parent.removeEntry(name);
        removed++;
      } catch { /* weg oder kein Zugriff */ }
    }
    return removed;
  }

  const stamp = () => {
    const d = new Date();
    return `${Util.dayKey(d)}_${Util.pad(d.getHours())}-${Util.pad(d.getMinutes())}-${Util.pad(d.getSeconds())}`;
  };
  async function writeText(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }
  const csvOf = log => T('Quelle;Ziel;Status') + '\n' + log.map(l => [l.quelle, l.ziel, l.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');

  // mode: 'move' (Quelle -> dst) oder 'inplace' (innerhalb der Quelle)
  async function run({ mode, src, dst, ops, dups, onProgress, signal }) {
    const inplace = mode === 'inplace';
    const root = inplace ? src : dst;
    const getDir = dirGetter(root);
    const relOf = o => [...o.dir, o.name].join('/');
    const groups = new Map();
    for (const op of ops) { if (!groups.has(op.item)) groups.set(op.item, []); groups.get(op.item).push(op); }
    let todo = [...groups.entries()];
    const log = [], moves = [], placed = new Map();  // placed: Item -> relativer Pfad, an dem es jetzt liegt
    const created = [];  // Umsortieren: angelegte Kopien [Pfad der Kopie, Pfad des Originals]
    const failed = new Set();
    let done = 0, bytes = 0, movedN = 0, copies = 0, skipped = 0, errors = 0, dupN = 0;
    const total = todo.length + dups.length;
    const t0 = Date.now();
    const report = () => onProgress?.({ done, total, moved: movedN, skipped, errors, bytes, rate: bytes / Math.max((Date.now() - t0) / 1000, 1) });
    const entry = (q, z, status, err = false) => { log.push({ quelle: q, ziel: z, status, err }); if (err) errors++; };

    // eine Datei mit allen ihren Zielen; 'later' = Name am Hauptplatz noch belegt (wird vielleicht gleich frei)
    async function one(it, list, last) {
      if (inplace) return oneInplace(it, list, last);
      const main = list.find(o => o.kind === 'month') || list[0];
      const rest = list.filter(o => o !== main);
      const mainRel = relOf(main);
      if (inplace && mainRel.toLowerCase() === it.path.toLowerCase()) {
        skipped++; placed.set(it, it.path);
        entry(it.path, mainRel, T('liegt schon richtig'));
        return;
      }
      const dir = await getDir(main.dir);
      if (await exists(dir, main.name)) {
        if (inplace && !last) return 'later';
        // im Ziel liegt schon eine Datei mit dem Namen: gleiche Datei (frueherer, abgebrochener Lauf) -> Original weg
        const there = await (await dir.getFileHandle(main.name)).getFile();
        if (!inplace && await sameFile(await it.handle.getFile(), there)) {
          const [parent, base] = await parentOf(src, it.path);
          await parent.removeEntry(base);
          placed.set(it, mainRel); skipped++;
          entry(it.path, mainRel, T('war schon im Ziel – Original entfernt'));
        } else {
          failed.add(mainRel); skipped++;
          entry(it.path, mainRel, T('Name am Ziel schon belegt – Datei bleibt, wo sie ist'));
        }
        return;
      }
      // zuerst die zusaetzlichen Kopien (Ereignis-, Personen-, Sonderordner) aus dem Original
      let restOk = true;
      for (const o of rest) {
        const rel = relOf(o);
        try {
          const d = await getDir(o.dir);
          if (await exists(d, o.name)) { entry(it.path, rel, T('existiert – übersprungen')); continue; }
          await copyVerified(await it.handle.getFile(), d, o.name);
          copies++; bytes += it.size;
          entry(it.path, rel, T('kopiert'));
        } catch (e) { restOk = false; failed.add(rel); entry(it.path, rel, T('FEHLER: {0}', e.message || e.name), true); }
      }
      if (!restOk) {
        // eine Zusatzkopie fehlt: Original behalten, Hauptplatz nur als Kopie
        await copyVerified(await it.handle.getFile(), dir, main.name);
        copies++; bytes += it.size;
        entry(it.path, mainRel, T('kopiert – Original bleibt wegen eines Fehlers'));
        return;
      }
      const file = await moveFile(src, it, dir, main.name);
      moves.push({ item: it, from: it.path, to: mainRel, mtime: file.lastModified });
      placed.set(it, mainRel);
      movedN++; bytes += it.size;
      entry(it.path, mainRel, T('verschoben'));
    }

    // Umsortieren: das Original an seinen einen Platz (nie in einen Personenordner), danach die Personenordner als Kopien
    // von dort. Jede angelegte Kopie kommt ins Journal, damit „Zurücknehmen“ sie wieder entfernt.
    async function oneInplace(it, list, last) {
      const main = list.find(o => o.kind !== 'person') || null;
      const rest = list.filter(o => o !== main);
      let at = it.path;
      if (main && relOf(main).toLowerCase() !== it.path.toLowerCase()) {
        const mainRel = relOf(main);
        const dir = await getDir(main.dir);
        if (await exists(dir, main.name)) {
          if (!last) return 'later';
          failed.add(mainRel); skipped++;
          entry(it.path, mainRel, T('Name am Ziel schon belegt – Datei bleibt, wo sie ist'));
        } else {
          const file = await moveFile(src, it, dir, main.name);
          moves.push({ item: it, from: it.path, to: mainRel, mtime: file.lastModified });
          movedN++; bytes += it.size; at = mainRel;
          entry(it.path, mainRel, T('verschoben'));
        }
      } else if (main) { skipped++; entry(it.path, it.path, T('liegt schon richtig')); }
      placed.set(it, at);
      for (const o of rest) {
        const rel = relOf(o);
        try {
          const d = await getDir(o.dir);
          if (await exists(d, o.name)) { entry(at, rel, T('existiert – übersprungen')); continue; }
          const [pd, pn] = await parentOf(src, at);
          await copyVerified(await (await pd.getFileHandle(pn)).getFile(), d, o.name);
          created.push([rel, at]);
          copies++; bytes += it.size;
          entry(at, rel, T('kopiert'));
        } catch (e) { failed.add(rel); entry(at, rel, T('FEHLER: {0}', e.message || e.name), true); }
      }
    }

    // mehrere Durchgaenge: was auf einen Namen wartet, der erst durch ein anderes Verschieben frei wird, kommt danach dran
    let last = false;
    while (todo.length && !signal?.aborted) {
      const later = [];
      let next = 0;
      const worker = async () => {
        while (next < todo.length && !signal?.aborted) {
          const [it, list] = todo[next++];
          try {
            if (await one(it, list, last) === 'later') { later.push([it, list]); continue; }
          } catch (e) { failed.add(relOf(list[0])); entry(it.path, relOf(list[0]), T('FEHLER: {0}', e.message || e.name), true); }
          done++;
          report();
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      if (last) break;
      if (later.length === todo.length) last = true;  // nichts frei geworden: ein letzter Durchgang, dann gilt der Name als belegt
      todo = later;
    }

    // Duplikate nicht loeschen, sondern zum Anschauen in _Duplikate (mit dem alten Pfad, damit nichts kollidiert)
    const dupRoot = T('_Duplikate');
    for (const d of dups) {
      if (signal?.aborted) break;
      const it = d.item;
      const segs = [dupRoot, ...it.path.split('/').slice(0, -1)];
      const rel = [...segs, it.name].join('/');
      try {
        const dir = await getDir(segs);
        let name = it.name;
        for (let n = 2; await exists(dir, name); n++) name = it.name.replace(/(\.[^.]*)?$/, `_${n}$1`);
        const file = await moveFile(src, it, dir, name);
        moves.push({ item: it, from: it.path, to: [...segs, name].join('/'), mtime: file.lastModified, dup: true });
        dupN++;
        entry(it.path, rel, T('Duplikat von {0} – zum Prüfen abgelegt', d.original.path));
      } catch (e) { entry(it.path, rel, T('FEHLER: {0}', e.message || e.name), true); }
      done++;
      report();
    }

    const emptied = await removeEmptyDirs(src, moves.map(m => m.from));
    const s = stamp();
    const logName = `_${T('protokoll')}_${inplace ? T('umsortiert') : T('verschoben')}_${s}.csv`;
    await writeText(root, logName, '﻿' + csvOf(log)).catch(() => {});
    let journal = null;
    if (inplace && (moves.length || created.length)) {
      journal = `_${T('umsortiert')}_${s}.json`;
      await writeText(src, journal, JSON.stringify({ app: 'Sort My Pictures', created: Date.now(), moves: moves.map(m => [m.from, m.to]), copies: created })).catch(() => { journal = null; });
    }
    return { moved: movedN, copies, skipped, errors, dups: dupN, emptied, bytes, aborted: !!signal?.aborted, logName, journal, log, moves, placed, failed };
  }

  // letztes Umsortieren in diesem Ordner (Journal-Datei), neueste zuerst
  async function lastJournal(src) {
    const names = [];
    try { for await (const [n, h] of src.entries()) if (h.kind === 'file' && JOURNAL.test(n)) names.push(n); } catch { /* kein Zugriff */ }
    return names.sort().pop() || null;
  }

  // Umsortieren zuruecknehmen: jede Datei zurueck an ihren alten Platz
  async function undo(src, journalName, onProgress, signal) {
    const j = JSON.parse(await (await (await src.getFileHandle(journalName)).getFile()).text());
    const getDir = dirGetter(src);
    const back = [], log = [], removedCopies = [];
    let done = 0, errors = 0;
    // zuerst die angelegten Kopien (Personenordner) – nur wenn sie noch genau dem Original gleichen
    for (const [rel, of] of j.copies || []) {
      if (signal?.aborted) break;
      try {
        const [cd, cn] = await parentOf(src, rel), [od, on] = await parentOf(src, of);
        const copy = await (await cd.getFileHandle(cn)).getFile(), orig = await (await od.getFileHandle(on)).getFile();
        if (!(await sameFile(copy, orig))) throw new Error(T('Kopie wurde verändert – bleibt'));
        await cd.removeEntry(cn);
        removedCopies.push(rel);
        log.push({ quelle: rel, ziel: '', status: T('Kopie entfernt') });
      } catch (e) { if (e.name !== 'NotFoundError') { errors++; log.push({ quelle: rel, ziel: '', status: T('FEHLER: {0}', e.message || e.name) }); } }
    }
    const list = [...j.moves].reverse();
    for (const [from, to] of list) {
      if (signal?.aborted) break;
      try {
        const [pd, pn] = await parentOf(src, to);
        const handle = await pd.getFileHandle(pn);
        const segs = from.split('/'), name = segs.pop();
        const dir = await getDir(segs);
        if (await exists(dir, name)) throw new Error(T('am alten Platz liegt schon eine Datei'));
        const file = await moveFile(src, { handle, path: to }, dir, name);
        back.push([to, from, file.lastModified]);
        log.push({ quelle: to, ziel: from, status: T('zurück') });
      } catch (e) { errors++; log.push({ quelle: to, ziel: from, status: T('FEHLER: {0}', e.message || e.name) }); }
      onProgress?.(++done, list.length);
    }
    await removeEmptyDirs(src, back.map(b => b[0]).concat(removedCopies));
    const s = stamp();
    await writeText(src, `_${T('protokoll')}_${T('zurück')}_${s}.csv`, '﻿' + csvOf(log)).catch(() => {});
    // Journal nur entfernen, wenn alles zurueck ist – sonst kann man es noch einmal versuchen
    if (!errors && !signal?.aborted) await src.removeEntry(journalName).catch(() => {});
    return { back, copies: removedCopies.length, errors, total: list.length, aborted: !!signal?.aborted };
  }

  return { run, undo, lastJournal, sameFile };
})();
