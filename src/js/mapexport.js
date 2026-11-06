// Fotoübersicht schreiben: _fotos.html (eigenstaendig, offline) + kleine Vorschaubilder in _fotos/.
// Zwei Ansichten: Karte (Fotos nach Standort) und Ordner (die geplante Ordnerstruktur).
// Nach dem Kopieren verlinkt sie auf die Kopien, im Modus „Verzeichnis ohne Kopieren“ direkt auf die Originale.
const MapExport = (() => {
  const THUMB = 240;  // Kantenlaenge der Vorschaubilder
  const TILE_LABELS = { osm: 'OpenStreetMap', street: 'Straßenkarte (Esri)', sat: 'Satellit (Esri)', topo: 'Gelände (OpenTopoMap)' };

  const enc = path => path.split('/').map(encodeURIComponent).join('/');

  async function exists(dir, name) {
    try { await dir.getFileHandle(name); return true; } catch { return false; }
  }
  async function writeFile(dir, name, data) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }

  // Kleines JPEG: EXIF-Vorschau (schnell) oder selbst verkleinert
  async function thumbOf(file) {
    const t = await exifr.thumbnail(file).catch(() => null);
    if (t && t.length > 1000) return new Blob([t], { type: 'image/jpeg' });
    const bmp = await createImageBitmap(file, { resizeWidth: THUMB, resizeQuality: 'medium' });
    const cv = new OffscreenCanvas(bmp.width, bmp.height);
    cv.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    return cv.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
  }

  // opts.failed: Set relativer Zielpfade, die nicht kopiert werden konnten
  // opts.linkBase: gesetzt = nichts wurde kopiert, Links gehen auf die Originale (linkBase + Pfad in der Quelle)
  async function write(root, plan, analysis, s, opts, onProgress, signal) {
    // opts.thumbs: false = keine Vorschaubilder schreiben, die Seite zeigt dann die Originale
    // opts.list / opts.map: Ordneransicht (Index) und Kartenansicht einzeln; opts.note: Hinweis „verweist auf die Originale“
    // opts.at: Item -> relativer Pfad, an dem die Datei jetzt liegt (nach Verschieben/Umsortieren)
    const { failed = new Set(), linkBase = null, thumbs: withThumbs = true, list: withList = true, map: withMap = true, at = null } = opts || {};
    const index = linkBase !== null;
    const note = opts?.note ?? index;
    const folder = T('_fotos');
    const pageName = folder + '.html';
    // ein Eintrag je Bild; Link nach dem Kopieren bevorzugt in den Monatsordner
    const byItem = new Map();
    const dirs = new Map();
    for (const op of plan.ops) {
      const rel = [...op.dir, op.name].join('/');
      if (failed.has(rel)) continue;
      if (at && !at.has(op.item)) continue;
      const cur = byItem.get(op.item);
      if (at) byItem.set(op.item, { rel: at.get(op.item), kind: op.kind });
      else if (!cur || (op.kind === 'month' && cur.kind !== 'month')) byItem.set(op.item, { rel, kind: op.kind });
      const d = op.dir.join('/');
      if (!dirs.has(d)) dirs.set(d, []);
      dirs.get(d).push([op.item, op.name]);
    }
    const kinds = Analyze.current.filter(k => k.id !== 'none');
    const events = analysis.events.filter(e => e.kind !== 'none' && plan.evDir.has(e));
    const evIdx = new Map(events.map((e, i) => [e, i]));
    const persons = [...new Set([...byItem.keys()].flatMap(it => it.persons ? [...it.persons] : []))].sort();

    const thumbs = withThumbs ? await root.getDirectoryHandle(folder, { create: true }) : null;
    const list = [...byItem.entries()];
    const items = new Array(list.length);
    let done = 0, next = 0;
    const worker = async () => {
      while (next < list.length && !signal?.aborted) {
        const i = next++;
        const [it, { rel }] = list[i];
        const tname = it.path.replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]+$/, '') + '.jpg';
        let thumb = '';
        if (thumbs && !it.isVideo) {
          try {
            if (!(await exists(thumbs, tname))) await writeFile(thumbs, tname, await thumbOf(await (opts.fileOf ? opts.fileOf(it) : it.handle.getFile())));
            thumb = enc(`${folder}/${tname}`);
          } catch { /* ohne Vorschau */ }
        }
        const ev = it.event && evIdx.has(it.event) ? evIdx.get(it.event) : -1;
        items[i] = [it.hasGps ? +it.lat.toFixed(6) : null, it.hasGps ? +it.lon.toFixed(6) : null, it.date.getTime(),
          index ? linkBase + enc(it.path) : enc(rel), thumb, ev, it.isVideo ? 1 : 0,
          it.persons ? [...it.persons].map(p => persons.indexOf(p)) : []];
        if (++done % 20 === 0 || done === list.length) onProgress?.(done, list.length);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (signal?.aborted) return null;

    const itemIdx = new Map(list.map(([it], i) => [it, i]));
    const data = {
      lang: I18n.lang, title: T('Fotoübersicht'), created: Date.now(), index: note, showMap: withMap, showList: withList,
      // Kartenhintergrund: die Seite wird meist als Datei geoeffnet – dort sperrt OpenStreetMap, daher Esri/OpenTopoMap
      tile: s.tiles ? (s.tileSrc && s.tileSrc !== 'auto' ? s.tileSrc : 'street') : '',
      srcs: Object.entries(MapView.TILE_SOURCES).map(([k, v]) => [k, T(TILE_LABELS[k]), v.url, v.max, v.attr()]),
      kinds: kinds.map(k => [k.id, k.label, k.color]),
      events: events.map(e => [e.place, kinds.findIndex(k => k.id === e.kind), e.start.getTime(), e.end.getTime()]),
      persons, items,
      folders: !withList ? [] : [...dirs.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([d, fs]) => [d, fs.sort((a, b) => a[0].date - b[0].date).map(([it, name]) => [itemIdx.get(it), name])]),
      t: Object.fromEntries(['Alle Jahre', 'Alle Ereignisse', 'Alle Personen', 'Ohne Ereignis', '{0} Fotos im Kartenausschnitt', 'Ohne Kartenhintergrund',
        'Alle zeigen', 'Datei öffnen', 'Nur die ersten {0} – näher hineinzoomen.', 'Erstellt mit Sort My Pictures am {0}',
        'Karte', 'Ordner', '{0} Dateien', 'Verweist auf die Originale – nichts wurde kopiert.',
        'Datei nicht gefunden – wurde das Original verschoben oder gelöscht?'].map(k => [k, T(k)])),
    };
    await writeFile(root, pageName, page(data));
    return { name: pageName, count: items.length, gps: items.filter(p => p[0] !== null).length };
  }

  // ---------- die eigenstaendige Seite ----------
  function page(data) {
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="${data.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${Util.escapeHtml(data.title)}</title>
<style>${LEAFLET_SRC.css}</style>
<style>
:root{--bg:#1d2024;--panel:#272b30;--top:#17191c;--line:#3a3f46;--fg:#e8eaed;--muted:#9aa0a6;--tab:#4cbb6c}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,"Segoe UI",sans-serif}
#app{display:flex;flex-direction:column;height:100%}
header{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 10px;background:var(--top)}
header b{margin-right:6px}select,button{padding:5px 8px;border-radius:6px;border:1px solid #444;background:var(--bg);color:var(--fg);font:inherit;cursor:pointer}
button.on{border-color:var(--tab);color:var(--tab)}.views{display:flex}.views.one{display:none}.views button{border-radius:0}.views button:first-child{border-radius:6px 0 0 6px}.views button:last-child{border-radius:0 6px 6px 0;margin-left:-1px}
.note{color:var(--muted);font-size:12px}
.view{flex:1;display:flex;min-height:0}.view[hidden]{display:none}#map{flex:1;background:#202327}
.no-tiles{background:#202327 repeating-linear-gradient(0deg,transparent 0 79px,#2a2e33 79px 80px),repeating-linear-gradient(90deg,transparent 0 79px,#2a2e33 79px 80px)!important}
aside{width:340px;display:flex;flex-direction:column;border-left:1px solid var(--line);background:var(--panel)}
.info{padding:8px 10px;color:var(--muted);font-size:12.5px}
.grid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:104px;gap:3px;padding:0 6px 6px;align-content:start}
#fgrid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));grid-auto-rows:140px}
.grid figure{margin:0;min-height:0;background:#1a1c1f;border-radius:4px;overflow:hidden;cursor:pointer;position:relative}
.grid img{width:100%;height:100%;object-fit:cover;display:block}.grid figcaption{position:absolute;left:0;right:0;bottom:0;font-size:10.5px;padding:1px 4px;background:rgba(0,0,0,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grid .vid{display:flex;align-items:center;justify-content:center;height:100%;font-size:26px}
.grid figure.dir .vid{font-size:40px}
#legend{position:absolute;left:8px;bottom:8px;z-index:500;background:rgba(23,25,28,.85);padding:4px 8px;border-radius:6px;font-size:12px}
#legend span{margin-right:10px;white-space:nowrap}#legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
#tree{width:300px;overflow:auto;border-right:1px solid var(--line);background:var(--panel);padding:6px 0;font-size:13px}
#tree div{padding:2px 8px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#tree div:hover{background:#30353b}#tree div.sel{background:#2f4a37}
#tree .tw{display:inline-block;width:14px;color:var(--muted)}#tree small{color:var(--muted);margin-left:6px}
#fside{flex:1;display:flex;flex-direction:column;min-width:0}#crumb{padding:8px 10px;font-weight:600}
#lb{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.92);display:none;flex-direction:column}#lb.on{display:flex}
#lb .st{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;color:var(--muted)}#lb img,#lb video{max-width:96vw;max-height:84vh}
#lb .bar{display:flex;gap:10px;align-items:center;justify-content:center;padding:8px;color:var(--muted)}#lb a{color:var(--tab)}
.leaflet-container{font:inherit}.leaflet-bar a{background:var(--panel);color:var(--fg);border-color:var(--line)}
.leaflet-control-attribution{background:rgba(23,25,28,.7)!important;color:var(--muted)}.leaflet-control-attribution a{color:var(--tab)}
@media(max-width:700px){.view{flex-direction:column}aside{width:auto;height:40%}#tree{width:auto;height:35%;border-right:0}}
</style></head><body><div id="app">
<header><b id="ttl"></b><span class="views"><button id="vmap"></button><button id="vdir"></button></span><select id="fy"></select><select id="fe"></select><select id="fp"></select><select id="tiles" title="🌐"></select><button id="all"></button><span class="note" id="note"></span></header>
<div class="view" id="mapview"><div id="map" style="position:relative"><div id="legend"></div></div><aside><div class="info" id="info"></div><div class="grid" id="grid"></div></aside></div>
<div class="view" id="dirview" hidden><div id="tree"></div><div id="fside"><div id="crumb"></div><div class="grid" id="fgrid"></div></div></div></div>
<div id="lb"><div class="st"></div><div class="bar"><button id="lbp">‹</button><span id="lbt"></span><a id="lbo" target="_blank"></a><button id="lbn">›</button><button id="lbx">✕</button></div></div>
<script>${LEAFLET_SRC.js.replace(/<\/script/gi, '<\\/script')}</script>
<script>
const D=${json};
const T=(k,...a)=>(D.t[k]||k).replace(/\\{(\\d)\\}/g,(_,i)=>a[i]);
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const fd=t=>{const d=new Date(t);return D.lang==='en'?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear()};
const ft=t=>{const d=new Date(t);return fd(t)+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const I=D.items.map((p,i)=>({i,lat:p[0],lon:p[1],t:p[2],src:p[3],th:p[4],ev:p[5],vid:p[6],pe:p[7]}));
const P=I.filter(p=>p.lat!==null).sort((a,b)=>a.t-b.t);
const col=p=>p.ev>=0&&D.kinds[D.events[p.ev][1]]?D.kinds[D.events[p.ev][1]][2]:'#adb5bd';
$('#ttl').textContent=D.title+' · '+I.length;
document.title=D.title;
if(D.index)$('#note').textContent=T('Verweist auf die Originale – nichts wurde kopiert.');
const years=[...new Set(I.map(p=>new Date(p.t).getFullYear()))].sort();
$('#fy').innerHTML='<option value="">'+T('Alle Jahre')+'</option>'+years.map(y=>'<option>'+y+'</option>').join('');
$('#fe').innerHTML='<option value="">'+T('Alle Ereignisse')+'</option><option value="-1">'+T('Ohne Ereignis')+'</option>'+D.events.map((e,i)=>'<option value="'+i+'">'+esc(fd(e[2])+' '+e[0])+'</option>').join('');
$('#fp').innerHTML='<option value="">'+T('Alle Personen')+'</option>'+D.persons.map((n,i)=>'<option value="'+i+'">'+esc(n)+'</option>').join('');
if(!D.persons.length)$('#fp').hidden=true;
const ok=p=>{const y=$('#fy').value,e=$('#fe').value,pp=$('#fp').value;return(!y||new Date(p.t).getFullYear()==y)&&(e===''||p.ev==e)&&(pp===''||p.pe.includes(+pp))};
function fig(p,cap,list){const f=document.createElement('figure');
 f.innerHTML=(p.th||!p.vid?'<img loading="lazy" decoding="async" src="'+(p.th||p.src)+'">':'<div class="vid">'+(p.vid?'🎬':'🖼')+'</div>')+'<figcaption>'+esc(cap)+'</figcaption>';
 f.title=cap;f.onclick=()=>openLb(list,p);return f}

// ---- Ansicht wechseln ----
// Index (Ordner) und Karte sind einzeln waehlbar; ohne Fotos mit Standort gibt es keine Karte
const hasMap=D.showMap!==false&&P.length>0,hasDir=D.showList!==false||!hasMap;
let view=localStorage.getItem('smp.view')||'map';if(!hasMap)view='dir';if(!hasDir)view='map';
$('#vmap').textContent='🗺 '+T('Karte');$('#vdir').textContent='📁 '+T('Ordner');if(!hasMap)$('#vmap').hidden=true;if(!hasDir)$('#vdir').hidden=true;
if(!hasMap||!hasDir)$('.views').classList.add('one');
function setView(v){view=v;localStorage.setItem('smp.view',v);$('#mapview').hidden=v!=='map';$('#dirview').hidden=v!=='dir';
 $('#vmap').classList.toggle('on',v==='map');$('#vdir').classList.toggle('on',v==='dir');$('#tiles').hidden=$('#all').hidden=v!=='map';
 if(v==='map'){map.invalidateSize();if(!drawn)draw(true)}else showDir(curDir)}
$('#vmap').onclick=()=>setView('map');$('#vdir').onclick=()=>setView('dir');

// ---- Karte ----
$('#legend').innerHTML=D.kinds.map(k=>'<span><i style="background:'+k[2]+'"></i>'+esc(k[1])+'</span>').join('')+'<span><i style="background:#adb5bd"></i>'+T('Ohne Ereignis')+'</span>';
const map=L.map('map',{preferCanvas:true,worldCopyJump:true});
const canvas=L.canvas({padding:.3});let layer=L.layerGroup().addTo(map),tiles=null,drawn=false;
// OpenStreetMap nur, wenn die Seite ueber http(s) kommt (als Datei geoeffnet sperrt OSM die Kacheln)
const web=location.protocol.startsWith('http'),SRC=D.srcs.filter(s=>web||s[0]!=='osm');
let tileSrc=localStorage.getItem('smp.src');if(tileSrc==null||(tileSrc&&!SRC.some(s=>s[0]===tileSrc)))tileSrc=D.tile;
$('#tiles').innerHTML='<option value="">'+T('Ohne Kartenhintergrund')+'</option>'+SRC.map(s=>'<option value="'+s[0]+'">🌐 '+esc(s[1])+'</option>').join('');
function setTiles(k){tileSrc=k;localStorage.setItem('smp.src',k);if(tiles){map.removeLayer(tiles);tiles=null}
 const s=SRC.find(x=>x[0]===k);if(s)tiles=L.tileLayer(s[2],{maxZoom:19,maxNativeZoom:s[3],attribution:s[4]}).addTo(map);
 map.getContainer().classList.toggle('no-tiles',!s);$('#tiles').value=s?k:''}
$('#tiles').onchange=e=>setTiles(e.target.value);$('#all').textContent=T('Alle zeigen');
let cur=[];
function draw(fit){if(view!=='map')return;drawn=true;cur=P.filter(ok);layer.clearLayers();
 for(const p of cur)L.circleMarker([p.lat,p.lon],{renderer:canvas,radius:5,weight:1,color:'#000',opacity:.4,fillColor:col(p),fillOpacity:.85}).on('click',()=>openLb(inView(),p)).addTo(layer);
 if(fit&&cur.length)map.fitBounds(cur.map(p=>[p.lat,p.lon]),{padding:[30,30],maxZoom:15});panel()}
const inView=()=>{const b=map.getBounds();return cur.filter(p=>b.contains([p.lat,p.lon]))};
const MAX=600;
function panel(){const v=inView();$('#info').textContent=T('{0} Fotos im Kartenausschnitt',v.length)+(v.length>MAX?' · '+T('Nur die ersten {0} – näher hineinzoomen.',MAX):'');
 const g=$('#grid');g.innerHTML='';for(const p of v.slice(0,MAX))g.append(fig(p,fd(p.t),v))}
let tmr;map.on('moveend',()=>{clearTimeout(tmr);tmr=setTimeout(()=>{if(view==='map')panel()},150)});
$('#all').onclick=()=>draw(true);

// ---- Ordner ----
const F=new Map(D.folders.map(([d,fs])=>[d,fs.map(([i,n])=>({p:I[i],n}))]));
const kids=new Map([['',new Set()]]);
for(const d of F.keys()){const s=d.split('/');for(let k=1;k<=s.length;k++){const a=s.slice(0,k-1).join('/'),b=s.slice(0,k).join('/');
 if(!kids.has(a))kids.set(a,new Set());kids.get(a).add(b);if(!kids.has(b))kids.set(b,new Set())}}
const cmp=(a,b)=>a.localeCompare(b,undefined,{numeric:true});
const total=new Map();const tot=d=>{if(total.has(d))return total.get(d);let n=(F.get(d)||[]).length;for(const c of kids.get(d)||[])n+=tot(c);total.set(d,n);return n};
const open=new Set();let curDir=localStorage.getItem('smp.dir')||'';if(!kids.has(curDir))curDir='';
const base=d=>d.split('/').pop();
function tree(){const t=$('#tree');t.innerHTML='';
 const row=(d,lvl)=>{const k=[...kids.get(d)].sort(cmp),el=document.createElement('div');
  el.style.paddingLeft=(8+lvl*14)+'px';el.className=d===curDir?'sel':'';
  el.innerHTML='<span class="tw">'+(k.length?(open.has(d)?'▾':'▸'):'')+'</span>'+esc(d?base(d):'/')+'<small>'+tot(d)+'</small>';
  el.onclick=e=>{if(k.length&&(e.target.className==='tw'||d===curDir)){open.has(d)?open.delete(d):open.add(d);tree()}else{open.add(d);showDir(d)}};
  t.append(el);if(open.has(d))for(const c of k)row(c,lvl+1)};
 row('',0)}
const parent=d=>d.includes('/')?d.slice(0,d.lastIndexOf('/')):'';
function showDir(d){curDir=d;localStorage.setItem('smp.dir',d);open.add('');for(let x=parent(d);x;x=parent(x))open.add(x);tree();
 const g=$('#fgrid');g.innerHTML='';
 for(const c of [...kids.get(d)].sort(cmp)){const f=document.createElement('figure');f.className='dir';
  f.innerHTML='<div class="vid">📁</div><figcaption>'+esc(base(c))+' · '+tot(c)+'</figcaption>';f.onclick=()=>showDir(c);g.append(f)}
 const fs=(F.get(d)||[]).filter(x=>ok(x.p)),list=fs.map(x=>x.p),names=new Map(fs.map(x=>[x.p,x.n]));
 for(const x of fs)g.append(fig(x.p,x.n,list));lbNames=names;
 $('#crumb').textContent='/'+d+(fs.length?'  ·  '+T('{0} Dateien',fs.length):'')}
let lbNames=new Map();

// ---- Grossansicht ----
let lbList=[],lbI=0;
function openLb(list,p){lbList=list.length?list:[p];lbI=Math.max(0,lbList.indexOf(p));showLb();$('#lb').classList.add('on')}
function showLb(){const p=lbList[lbI],st=$('#lb .st');st.innerHTML=p.vid?'<video src="'+p.src+'" controls autoplay></video>':'<img src="'+p.src+'">';
 const m=st.firstChild;m.onerror=()=>{st.textContent=T('Datei nicht gefunden – wurde das Original verschoben oder gelöscht?')};
 const ev=p.ev>=0?' · '+D.events[p.ev][0]:'',nm=view==='dir'&&lbNames.get(p)?lbNames.get(p)+' · ':'';
 $('#lbt').textContent=(lbI+1)+' / '+lbList.length+' · '+nm+ft(p.t)+ev+(p.pe.length?' · '+p.pe.map(i=>D.persons[i]).join(', '):'');
 $('#lbo').href=p.src;$('#lbo').textContent=T('Datei öffnen')}
const closeLb=()=>{$('#lb').classList.remove('on');$('#lb .st').innerHTML=''};
$('#lbx').onclick=closeLb;$('#lbp').onclick=()=>{lbI=(lbI-1+lbList.length)%lbList.length;showLb()};$('#lbn').onclick=()=>{lbI=(lbI+1)%lbList.length;showLb()};
$('#lb .st').onclick=e=>{if(e.target===e.currentTarget)closeLb()};
document.onkeydown=e=>{if(!$('#lb').classList.contains('on'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')$('#lbp').click();if(e.key==='ArrowRight')$('#lbn').click()};

for(const id of ['#fy','#fe','#fp'])$(id).onchange=()=>{drawn=false;view==='map'?draw(true):showDir(curDir)};
map.setView([48,13],5);setTiles(tileSrc);
map.attributionControl.addAttribution(esc(T('Erstellt mit Sort My Pictures am {0}',fd(D.created))));
setView(view);
</script></body></html>`;
  }

  return { write };
})();
