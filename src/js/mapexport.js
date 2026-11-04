// Interaktive Karte ins Ziel schreiben: _karte.html (eigenstaendig, offline) + kleine Vorschaubilder in _karte/.
// Die Seite laedt die Fotos ueber relative Pfade direkt aus den sortierten Ordnern.
const MapExport = (() => {
  const THUMB = 240;  // Kantenlaenge der Vorschaubilder

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

  // failed: Set relativer Zielpfade, die nicht kopiert werden konnten
  async function write(root, plan, analysis, s, failed, onProgress, signal) {
    const folder = T('_karte');
    const pageName = folder + '.html';
    // ein Eintrag je Bild mit GPS; Pfad bevorzugt im Monatsordner
    const byItem = new Map();
    for (const op of plan.ops) {
      const rel = [...op.dir, op.name].join('/');
      if (failed.has(rel) || !op.item.hasGps) continue;
      const cur = byItem.get(op.item);
      if (!cur || (op.kind === 'month' && cur.kind !== 'month')) byItem.set(op.item, { rel, kind: op.kind });
    }
    const kinds = Analyze.current.filter(k => k.id !== 'none');
    const events = analysis.events.filter(e => e.kind !== 'none' && plan.evDir.has(e));
    const evIdx = new Map(events.map((e, i) => [e, i]));
    const persons = [...new Set([...byItem.keys()].flatMap(it => it.persons ? [...it.persons] : []))].sort();

    const thumbs = await root.getDirectoryHandle(folder, { create: true });
    const list = [...byItem.entries()];
    const pts = new Array(list.length);
    let done = 0, next = 0;
    const worker = async () => {
      while (next < list.length && !signal?.aborted) {
        const i = next++;
        const [it, { rel }] = list[i];
        const tname = rel.replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]+$/, '') + '.jpg';
        let thumb = '';
        if (!it.isVideo) {
          try {
            if (!(await exists(thumbs, tname))) await writeFile(thumbs, tname, await thumbOf(await it.handle.getFile()));
            thumb = enc(`${folder}/${tname}`);
          } catch { /* ohne Vorschau */ }
        }
        const ev = it.event && evIdx.has(it.event) ? evIdx.get(it.event) : -1;
        pts[i] = [+it.lat.toFixed(6), +it.lon.toFixed(6), it.date.getTime(), enc(rel), thumb, ev, it.isVideo ? 1 : 0,
          it.persons ? [...it.persons].map(p => persons.indexOf(p)) : []];
        if (++done % 20 === 0 || done === list.length) onProgress?.(done, list.length);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (signal?.aborted) return null;

    const data = {
      lang: I18n.lang, title: T('Fotos auf der Karte'), created: Date.now(), tiles: !!s.tiles,
      kinds: kinds.map(k => [k.id, k.label, k.color]),
      events: events.map(e => [e.place, kinds.findIndex(k => k.id === e.kind), e.start.getTime(), e.end.getTime()]),
      persons, pts: pts.filter(Boolean),
      t: Object.fromEntries(['Alle Jahre', 'Alle Ereignisse', 'Alle Personen', 'Ohne Ereignis', '{0} Fotos im Kartenausschnitt', 'Kartenhintergrund (online)',
        'Alle zeigen', 'Datei öffnen', 'Nur die ersten {0} – näher hineinzoomen.',
        'Erstellt mit Sort My Pictures am {0}'].map(k => [k, T(k)])),
    };
    await writeFile(root, pageName, page(data));
    return { name: pageName, count: data.pts.length };
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
button.on{border-color:var(--tab);color:var(--tab)}#main{flex:1;display:flex;min-height:0}#map{flex:1;background:#202327}
.no-tiles{background:#202327 repeating-linear-gradient(0deg,transparent 0 79px,#2a2e33 79px 80px),repeating-linear-gradient(90deg,transparent 0 79px,#2a2e33 79px 80px)!important}
aside{width:340px;display:flex;flex-direction:column;border-left:1px solid var(--line);background:var(--panel)}
#info{padding:8px 10px;color:var(--muted);font-size:12.5px}#grid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:104px;gap:3px;padding:0 6px 6px;align-content:start}
#grid figure{margin:0;min-height:0;background:#1a1c1f;border-radius:4px;overflow:hidden;cursor:pointer;position:relative}
#grid img{width:100%;height:100%;object-fit:cover;display:block}#grid figcaption{position:absolute;left:0;right:0;bottom:0;font-size:10px;padding:1px 4px;background:rgba(0,0,0,.55)}
#grid .vid{display:flex;align-items:center;justify-content:center;height:100%;font-size:26px}
#legend{position:absolute;left:8px;bottom:8px;z-index:500;background:rgba(23,25,28,.85);padding:4px 8px;border-radius:6px;font-size:12px}
#legend span{margin-right:10px;white-space:nowrap}#legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
#lb{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.92);display:none;flex-direction:column}#lb.on{display:flex}
#lb .st{flex:1;display:flex;align-items:center;justify-content:center;min-height:0}#lb img,#lb video{max-width:96vw;max-height:84vh}
#lb .bar{display:flex;gap:10px;align-items:center;justify-content:center;padding:8px;color:var(--muted)}#lb a{color:var(--tab)}
.leaflet-container{font:inherit}.leaflet-bar a{background:var(--panel);color:var(--fg);border-color:var(--line)}
.leaflet-control-attribution{background:rgba(23,25,28,.7)!important;color:var(--muted)}.leaflet-control-attribution a{color:var(--tab)}
@media(max-width:700px){#main{flex-direction:column}aside{width:auto;height:40%}}
</style></head><body><div id="app">
<header><b id="ttl"></b><select id="fy"></select><select id="fe"></select><select id="fp"></select><button id="tiles"></button><button id="all"></button></header>
<div id="main"><div id="map" style="position:relative"><div id="legend"></div></div><aside><div id="info"></div><div id="grid"></div></aside></div></div>
<div id="lb"><div class="st"></div><div class="bar"><button id="lbp">‹</button><span id="lbt"></span><a id="lbo" target="_blank"></a><button id="lbn">›</button><button id="lbx">✕</button></div></div>
<script>${LEAFLET_SRC.js.replace(/<\/script/gi, '<\\/script')}</script>
<script>
const D=${json};
const T=(k,...a)=>(D.t[k]||k).replace(/\\{(\\d)\\}/g,(_,i)=>a[i]);
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const fd=t=>{const d=new Date(t);return D.lang==='en'?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear()};
const ft=t=>{const d=new Date(t);return fd(t)+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const P=D.pts.map((p,i)=>({i,lat:p[0],lon:p[1],t:p[2],src:p[3],th:p[4],ev:p[5],vid:p[6],pe:p[7]})).sort((a,b)=>a.t-b.t);
const col=p=>p.ev>=0&&D.kinds[D.events[p.ev][1]]?D.kinds[D.events[p.ev][1]][2]:'#adb5bd';
$('#ttl').textContent=D.title+' · '+P.length;
document.title=D.title;
const years=[...new Set(P.map(p=>new Date(p.t).getFullYear()))].sort();
$('#fy').innerHTML='<option value="">'+T('Alle Jahre')+'</option>'+years.map(y=>'<option>'+y+'</option>').join('');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('#fe').innerHTML='<option value="">'+T('Alle Ereignisse')+'</option><option value="-1">'+T('Ohne Ereignis')+'</option>'+D.events.map((e,i)=>'<option value="'+i+'">'+esc(fd(e[2])+' '+e[0])+'</option>').join('');
$('#fp').innerHTML='<option value="">'+T('Alle Personen')+'</option>'+D.persons.map((n,i)=>'<option value="'+i+'">'+esc(n)+'</option>').join('');
if(!D.persons.length)$('#fp').hidden=true;
$('#legend').innerHTML=D.kinds.map(k=>'<span><i style="background:'+k[2]+'"></i>'+esc(k[1])+'</span>').join('')+'<span><i style="background:#adb5bd"></i>'+T('Ohne Ereignis')+'</span>';
const map=L.map('map',{preferCanvas:true,worldCopyJump:true});
const canvas=L.canvas({padding:.3});let layer=L.layerGroup().addTo(map),tiles=null;
let useTiles=localStorage.getItem('smp.tiles');useTiles=useTiles==null?D.tiles:useTiles==='1';
function setTiles(on){useTiles=on;localStorage.setItem('smp.tiles',on?'1':'0');
 if(on&&!tiles)tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
 if(!on&&tiles){map.removeLayer(tiles);tiles=null}
 map.getContainer().classList.toggle('no-tiles',!on);$('#tiles').textContent='🌐 '+T('Kartenhintergrund (online)');$('#tiles').classList.toggle('on',on)}
$('#tiles').onclick=()=>setTiles(!useTiles);$('#all').textContent=T('Alle zeigen');
let cur=[];
function filtered(){const y=$('#fy').value,e=$('#fe').value,pp=$('#fp').value;
 return P.filter(p=>(!y||new Date(p.t).getFullYear()==y)&&(e===''||p.ev==e)&&(pp===''||p.pe.includes(+pp)))}
function draw(fit){cur=filtered();layer.clearLayers();
 for(const p of cur)L.circleMarker([p.lat,p.lon],{renderer:canvas,radius:5,weight:1,color:'#000',opacity:.4,fillColor:col(p),fillOpacity:.85}).on('click',()=>openLb(inView(),p)).addTo(layer);
 if(fit&&cur.length)map.fitBounds(cur.map(p=>[p.lat,p.lon]),{padding:[30,30],maxZoom:15});panel()}
const inView=()=>{const b=map.getBounds();return cur.filter(p=>b.contains([p.lat,p.lon]))};
const MAX=600;
function panel(){const v=inView();$('#info').textContent=T('{0} Fotos im Kartenausschnitt',v.length)+(v.length>MAX?' · '+T('Nur die ersten {0} – näher hineinzoomen.',MAX):'');
 const g=$('#grid');g.innerHTML='';
 for(const p of v.slice(0,MAX)){const f=document.createElement('figure');
  f.innerHTML=(p.th?'<img loading="lazy" src="'+p.th+'">':'<div class="vid">'+(p.vid?'🎬':'🖼')+'</div>')+'<figcaption>'+fd(p.t)+'</figcaption>';
  f.onclick=()=>openLb(v,p);g.append(f)}}
let lbList=[],lbI=0;
function openLb(list,p){lbList=list.length?list:[p];lbI=Math.max(0,lbList.indexOf(p));showLb();$('#lb').classList.add('on')}
function showLb(){const p=lbList[lbI],st=$('#lb .st');st.innerHTML=p.vid?'<video src="'+p.src+'" controls autoplay></video>':'<img src="'+p.src+'">';
 const ev=p.ev>=0?' · '+D.events[p.ev][0]:'';$('#lbt').textContent=(lbI+1)+' / '+lbList.length+' · '+ft(p.t)+ev+(p.pe.length?' · '+p.pe.map(i=>D.persons[i]).join(', '):'');
 $('#lbo').href=p.src;$('#lbo').textContent=T('Datei öffnen')}
const closeLb=()=>{$('#lb').classList.remove('on');$('#lb .st').innerHTML=''};
$('#lbx').onclick=closeLb;$('#lbp').onclick=()=>{lbI=(lbI-1+lbList.length)%lbList.length;showLb()};$('#lbn').onclick=()=>{lbI=(lbI+1)%lbList.length;showLb()};
$('#lb .st').onclick=e=>{if(e.target===e.currentTarget)closeLb()};
document.onkeydown=e=>{if(!$('#lb').classList.contains('on'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')$('#lbp').click();if(e.key==='ArrowRight')$('#lbn').click()};
let tmr;map.on('moveend',()=>{clearTimeout(tmr);tmr=setTimeout(panel,150)});
for(const id of ['#fy','#fe','#fp'])$(id).onchange=()=>draw(true);
$('#all').onclick=()=>draw(true);
map.setView([48,13],5);setTiles(useTiles);draw(true);
map.attributionControl.addAttribution(esc(T('Erstellt mit Sort My Pictures am {0}',fd(D.created))));
</script></body></html>`;
  }

  return { write };
})();
