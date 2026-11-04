// Kopieren in den Zielordner. Originale werden nur gelesen, vorhandene Dateien nie ueberschrieben.
const Copier = (() => {
  async function exists(dir, name) {
    try { await dir.getFileHandle(name); return true; }
    catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
  }

  async function run(targetRoot, ops, onProgress, signal) {
    const dirCache = new Map();
    // Ordner-Handles als Promise cachen, damit parallele Worker denselben Ordner nur einmal anlegen
    const getDir = segs => {
      if (!segs.length) return Promise.resolve(targetRoot);
      const key = segs.join('/');
      if (!dirCache.has(key)) {
        dirCache.set(key, getDir(segs.slice(0, -1)).then(parent =>
          parent.getDirectoryHandle(segs[segs.length - 1], { create: true })));
      }
      return dirCache.get(key);
    };

    const log = [];
    let next = 0, done = 0, bytes = 0, copied = 0, skipped = 0, errors = 0;
    const total = ops.length;
    const t0 = Date.now();

    async function worker() {
      while (next < ops.length) {
        if (signal?.aborted) return;
        const op = ops[next++];
        const rel = [...op.dir, op.name].join('/');
        let status = T('kopiert'), err = false;
        try {
          const dir = await getDir(op.dir);
          if (await exists(dir, op.name)) { status = T('existiert – übersprungen'); skipped++; }
          else {
            const src = await op.item.handle.getFile();
            const fh = await dir.getFileHandle(op.name, { create: true });
            const w = await fh.createWritable();
            await src.stream().pipeTo(w);
            const check = await fh.getFile();
            if (check.size !== src.size) throw new Error(T('Größe stimmt nicht'));
            bytes += src.size; copied++;
          }
        } catch (e) { status = T('FEHLER: {0}', e.message || e.name); err = true; errors++; }
        log.push({ quelle: op.item.path, ziel: rel, status, err });
        done++;
        const secs = (Date.now() - t0) / 1000;
        onProgress?.({ done, total, copied, skipped, errors, bytes, rate: bytes / Math.max(secs, 1) });
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));

    // Protokoll in den Zielordner schreiben
    const csv = T('Quelle;Ziel;Status') + '\n' + log.map(l => [l.quelle, l.ziel, l.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const stamp = new Date();
    const fname = `_${T('protokoll')}_${Util.dayKey(stamp)}_${Util.pad(stamp.getHours())}-${Util.pad(stamp.getMinutes())}-${Util.pad(stamp.getSeconds())}.csv`;
    try {
      const fh = await targetRoot.getFileHandle(fname, { create: true });
      const w = await fh.createWritable();
      await w.write('﻿' + csv);
      await w.close();
    } catch { /* Protokoll ist optional */ }
    return { copied, skipped, errors, bytes, aborted: !!signal?.aborted, logName: fname, log };
  }

  return { run };
})();
