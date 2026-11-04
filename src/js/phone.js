// Quelle "Handy (USB)": Android-Speicher per ADB ueber WebUSB lesen. Komplett lokal, es wird nur gelesen.
// Stellt Objekte bereit, die sich wie Ordner-/Datei-Handles der File System Access API verhalten,
// damit Einlesen, Bildansicht, Gesichter und Kopieren unveraendert funktionieren.
const Phone = (() => {
  const ROOT = '/sdcard';
  const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
    tif: 'image/tiff', tiff: 'image/tiff', dng: 'image/x-adobe-dng', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', '3gp': 'video/3gpp' };
  let adb = null, device = null, syncP = null, onChange = null;

  const supported = () => !!navigator.usb && typeof WebAdb !== 'undefined';
  const connected = () => !!adb;
  const deviceName = () => device?.name || T('Handy');

  class PhoneError extends Error { constructor(m) { super(m); this.name = 'PhoneError'; } }
  const need = () => { if (!adb) throw new PhoneError(T('Handy nicht verbunden')); return adb; };

  // Verbinden; interactive = Geraeteauswahl des Browsers zeigen (braucht einen Klick)
  async function connect(interactive, onStatus) {
    if (adb) return adb;
    const M = WebAdb.AdbDaemonWebUsbDeviceManager.BROWSER;
    let dev = (await M.getDevices())[0];
    if (!dev && interactive) dev = await M.requestDevice();
    if (!dev) return null;
    let connection;
    try { connection = await dev.connect(); }
    catch (e) {
      if (e instanceof WebAdb.AdbDaemonWebUsbDevice.DeviceBusyError) {
        throw new PhoneError(T('Das Handy wird gerade von einem anderen Programm verwendet (z. B. adb, Android Studio, scrcpy). Dort trennen oder „adb kill-server“ ausführen.'));
      }
      throw e;
    }
    onStatus?.(T('Am Handy „USB-Debugging zulassen?“ bestätigen …'));
    const transport = await WebAdb.AdbDaemonTransport.authenticate({
      serial: dev.serial, connection, credentialStore: new WebAdb.AdbWebCredentialStore('Fotosortierer'),
    });
    adb = new WebAdb.Adb(transport);
    device = dev;
    adb.disconnected.then(() => { adb = null; syncP = null; onChange?.(false); });
    onChange?.(true);
    return adb;
  }
  async function disconnect() {
    const a = adb;
    adb = null; syncP = null;
    if (a) await a.close().catch(() => {});
  }

  const sync = () => (syncP ||= need().sync().catch(e => { syncP = null; throw e; }));

  // Unterordner auflisten (versteckte und Papierkorb-Dateien ".trashed-…" auslassen)
  async function list(path) {
    const s = await sync();
    const out = [];
    for (const e of await s.readdir(path)) {
      if (e.name.startsWith('.')) continue;
      if (e.type === 4) out.push({ name: e.name, dir: true });
      else if (e.type === 8) out.push({ name: e.name, dir: false, size: Number(e.size), mtime: Number(e.mtime) * 1000 });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Shell-Befehl ausfuehren und die (binaere) Ausgabe sammeln
  const quote = p => `'${p.replace(/'/g, `'\\''`)}'`;
  async function exec(cmd) {
    const socket = await need().createSocket('exec:' + cmd);
    const chunks = [];
    let n = 0;
    for await (const c of socket.readable) { chunks.push(c); n += c.length; }
    const out = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  // Ausschnitt einer Datei lesen (dd mit 4-KB-Bloecken, danach zuschneiden)
  async function readRange(path, start, len) {
    if (len <= 0) return new Uint8Array(0);
    const BS = 4096;
    const skip = Math.floor(start / BS), count = Math.ceil((start + len) / BS) - skip;
    const raw = await exec(`dd if=${quote(path)} bs=${BS} skip=${skip} count=${count} 2>/dev/null`);
    const off = start - skip * BS;
    return raw.subarray(off, off + len);
  }

  // Verhaelt sich wie ein File, liest aber erst bei Bedarf vom Handy
  class RemoteFile {
    constructor(path, name, size, mtime) {
      this.path = path; this.name = name; this.size = size; this.lastModified = mtime;
      this.type = MIME[name.split('.').pop().toLowerCase()] || '';
      this.remote = true;
    }
    slice(start = 0, end = this.size) {
      const a = Math.max(0, Math.min(start, this.size)), b = Math.max(a, Math.min(end, this.size));
      return {
        size: b - a,
        arrayBuffer: async () => { const u = await readRange(this.path, a, b - a); return u.buffer.slice(u.byteOffset, u.byteOffset + u.length); },
      };
    }
    // Erste n Bytes als echte Datei (reicht fuer EXIF und Vorschaubild)
    async head(n) {
      const u = await readRange(this.path, 0, Math.min(n, this.size));
      return new File([u], this.name, { type: this.type, lastModified: this.lastModified });
    }
    stream() { return lazyStream(this.path); }
    // Ganze Datei holen
    async blob() {
      const chunks = [];
      const s = await sync();
      for await (const c of s.read(this.path)) chunks.push(c);
      return new File(chunks, this.name, { type: this.type, lastModified: this.lastModified });
    }
    async arrayBuffer() { return (await this.blob()).arrayBuffer(); }
  }
  // Stream, der die Sync-Verbindung erst beim ersten Lesen oeffnet
  function lazyStream(path) {
    let reader;
    return new ReadableStream({
      async pull(ctl) {
        reader ||= (await sync()).read(path).getReader();
        const { done, value } = await reader.read();
        if (done) ctl.close(); else ctl.enqueue(value);
      },
      cancel(r) { return reader?.cancel(r); },
    });
  }

  function fileHandle(path, name, size, mtime) {
    return { kind: 'file', name, path, getFile: async () => { need(); return new RemoteFile(path, name, size, mtime); } };
  }
  // Ordner-Handle; name dient auch als Schluessel fuer Metadaten- und Gesichter-Cache
  function dirHandle(path, name) {
    return {
      kind: 'directory', name, path, isPhone: true,
      async *entries() {
        for (const e of await list(path)) {
          const p = `${path}/${e.name}`;
          yield [e.name, e.dir ? dirHandle(p, e.name) : fileHandle(p, e.name, e.size, e.mtime)];
        }
      },
      queryPermission: async () => (adb ? 'granted' : 'prompt'),
      requestPermission: async () => ((await connect(true).catch(() => null)) ? 'granted' : 'denied'),
      isSameEntry: async () => false,
    };
  }
  const source = rel => dirHandle(`${ROOT}/${rel}`.replace(/\/+$/, ''), `${deviceName()}: ${rel || 'Speicher'}`);

  // Echte Datei fuer Stellen, die einen Blob brauchen (Bildanzeige, Gesichter)
  const full = f => (f.remote ? f.blob() : f);
  const head = (f, n) => (f.remote ? f.head(n) : f);

  return { supported, connected, connect, disconnect, deviceName, list, source, full, head, ROOT, set onChange(f) { onChange = f; } };
})();
