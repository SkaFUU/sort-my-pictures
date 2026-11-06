// Kartenansicht (Leaflet). Kacheln nur online und nur wenn eingeschaltet.
const MapView = (() => {
  // Farben der Ereignis-Arten kommen aus Analyze.kind(); hier nur Punkte ohne Ereignis
  const COLORS = { home: '#ae3ec9', other: '#495057' };
  const color = k => COLORS[k] || Analyze.kind(k).color;
  const ZONE_COLORS = { home: '#ae3ec9', ignore: '#868e96', work: '#1971c2', named: '#f08c00' };
  const ZONE_LABELS = { home: 'Zuhause', ignore: 'Alltagsort (kein Ausflug)', work: 'Dienstort', named: 'Benannter Ort' };
  const ZONE_TYPES = new Proxy(ZONE_LABELS, { get: (o, k) => (k in o ? T(o[k]) : undefined) });

  let map, tiles, pointLayer, overlayLayer, zoneLayer, pointCanvas = null, addMode = false, cb = {};

  function init(el, callbacks) {
    cb = callbacks;
    map = L.map(el, { preferCanvas: true, worldCopyJump: true }).setView([48.2, 16.4], 6);
    pointLayer = L.layerGroup().addTo(map);
    overlayLayer = L.layerGroup().addTo(map);
    zoneLayer = L.layerGroup().addTo(map);
    map.on('click', e => {
      if (!addMode) return;
      setAddMode(false);
      cb.onAddZone?.(e.latlng.lat, e.latlng.lng);
    });
  }

  // eine gemeinsame Zeichenflaeche fuer Punkte, Kreise und Zonen (nicht bei jedem Neuberechnen eine weitere)
  const renderer = () => (pointCanvas ||= L.canvas({ padding: 0.3 }));

  // Kartenquellen. OpenStreetMap liefert nur mit Herkunftsangabe (Webseite), bei direkt geoeffneter Datei (file://)
  // kommt „Access blocked“ – dann nimmt „auto“ die Esri-Strassenkarte.
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const TILE_SOURCES = {
    osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: () => '&copy; ' + T('OpenStreetMap-Mitwirkende') },
    street: { url: ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}', max: 19, attr: () => 'Tiles &copy; Esri' },
    sat: { url: ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, attr: () => 'Tiles &copy; Esri, Maxar, Earthstar Geographics' },
    topo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', max: 17, attr: () => '&copy; ' + T('OpenStreetMap-Mitwirkende') + ', SRTM | &copy; OpenTopoMap (CC-BY-SA)' },
  };
  const tileKey = src => (!src || src === 'auto' ? (location.protocol.startsWith('http') ? 'osm' : 'street') : src);
  function tileLayer(src) {
    const t = TILE_SOURCES[tileKey(src)] || TILE_SOURCES.street;
    return L.tileLayer(t.url, { maxZoom: t.max, maxNativeZoom: t.max, attribution: t.attr() });
  }
  let tilesSrc = null;
  function setTiles(on, src = 'auto') {
    if (tiles && (!on || tilesSrc !== tileKey(src))) { map.removeLayer(tiles); tiles = null; }
    if (on && !tiles) { tiles = tileLayer(src).addTo(map); tilesSrc = tileKey(src); }
    map.getContainer().classList.toggle('no-tiles', !on);
  }

  function setAddMode(on) {
    addMode = on;
    map.getContainer().classList.toggle('add-mode', on);
    cb.onAddMode?.(on);
  }

  function render(analysis, zones) {
    pointLayer.clearLayers(); overlayLayer.clearLayers();
    if (!analysis) return;
    const canvas = renderer();
    for (const h of analysis.homes.filter(h => h.auto)) {
      L.circle([h.lat, h.lon], { renderer: canvas, radius: h.r * 1000, color: COLORS.home, weight: 2, fill: false, dashArray: '6 4' })
        .bindTooltip(T('Wohnort (automatisch, {0} Tage)', h.days)).addTo(overlayLayer);
    }
    for (const d of analysis.autoDaily) {
      L.circle([d.lat, d.lon], { renderer: canvas, radius: d.r * 1000, color: ZONE_COLORS.ignore, weight: 2, fillOpacity: 0.1, dashArray: '4 4' })
        .bindPopup(() => {
          const div = document.createElement('div');
          div.innerHTML = `<b>${T('Alltagsort (automatisch)')}</b><br>${T('{0} Tage', d.days)}<br>`;
          const b = document.createElement('button');
          b.textContent = T('Als Zone übernehmen');
          b.onclick = () => { map.closePopup(); cb.onAddZone?.(d.lat, d.lon, { type: 'ignore', r: d.r, name: T('Alltagsort') }); };
          div.append(b);
          return div;
        }).addTo(overlayLayer);
    }
    renderZones(zones);
    // Punkte zuletzt: auf der gemeinsamen Zeichenflaeche liegen sie damit oben und bleiben anklickbar
    for (const it of analysis.items) {
      if (!it.hasGps) continue;
      const kind = it.event ? it.event.kind : (it.near ? 'home' : 'other');
      L.circleMarker([it.lat, it.lon], {
        renderer: canvas, radius: it.event ? 4 : 3, weight: 0, fillOpacity: it.event ? 0.8 : 0.35, fillColor: color(kind),
      }).bindTooltip(`${Util.escapeHtml(it.name)}<br>${Util.fmtDateTime(it.date)}${it.event ? '<br><b>' + Util.escapeHtml(it.event.place) + '</b>' : ''}`)
        .on('click', () => cb.onPointClick?.(it))
        .addTo(pointLayer);
    }
  }

  function renderZones(zones) {
    zoneLayer.clearLayers();
    for (const z of zones) {
      const color = ZONE_COLORS[z.type];
      const circle = L.circle([z.lat, z.lon], { renderer: renderer(), radius: z.r * 1000, color, weight: 2, fillOpacity: 0.12 })
        .bindTooltip(`${Util.escapeHtml(z.name || ZONE_TYPES[z.type])} (${ZONE_TYPES[z.type]})`).addTo(zoneLayer);
      const handle = L.marker([z.lat, z.lon], {
        draggable: true,
        icon: L.divIcon({ className: 'zone-handle', html: `<span style="background:${color}"></span>`, iconSize: [16, 16] }),
      }).addTo(zoneLayer);
      handle.on('drag', e => circle.setLatLng(e.target.getLatLng()));
      handle.on('dragend', e => { const p = e.target.getLatLng(); cb.onZoneMoved?.(z, p.lat, p.lng); });
      handle.on('click', () => cb.onZoneClick?.(z));
    }
    pointLayer.eachLayer(l => l.bringToFront());  // Punkte wieder nach oben
  }

  function fitAll(analysis) {
    const pts = analysis?.items.filter(i => i.hasGps).map(i => [i.lat, i.lon]);
    if (pts?.length) map.fitBounds(pts, { padding: [20, 20] });
  }
  function fitEvent(ev) {
    const pts = ev.far.map(p => [p.lat, p.lon]);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 13 });
  }
  const focus = (lat, lon, zoom = 12) => map.setView([lat, lon], zoom);
  const invalidate = () => map && map.invalidateSize();

  return { init, setTiles, tileLayer, tileKey, TILE_SOURCES,setAddMode, render, renderZones, fitAll, fitEvent, focus, invalidate, COLORS, color, ZONE_TYPES, ZONE_LABELS, ZONE_COLORS, get addMode() { return addMode; } };
})();
