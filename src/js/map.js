// Kartenansicht (Leaflet). Kacheln nur online und nur wenn eingeschaltet.
const MapView = (() => {
  const COLORS = { vac: '#e8590c', trip: '#2f9e44', work: '#1971c2', none: '#868e96', home: '#ae3ec9', other: '#495057' };
  const ZONE_COLORS = { home: '#ae3ec9', ignore: '#868e96', work: '#1971c2', named: '#f08c00' };
  const ZONE_TYPES = { home: 'Zuhause', ignore: 'Alltagsort (kein Ausflug)', work: 'Dienstort', named: 'Benannter Ort' };

  let map, tiles, pointLayer, overlayLayer, zoneLayer, addMode = false, cb = {};

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

  function setTiles(on) {
    if (on && !tiles) {
      tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap-Mitwirkende',
      }).addTo(map);
    } else if (!on && tiles) { map.removeLayer(tiles); tiles = null; }
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
    const canvas = L.canvas({ padding: 0.3 });
    for (const it of analysis.items) {
      if (!it.hasGps) continue;
      const kind = it.event ? it.event.kind : (it.near ? 'home' : 'other');
      L.circleMarker([it.lat, it.lon], {
        renderer: canvas, radius: it.event ? 4 : 3, weight: 0, fillOpacity: it.event ? 0.8 : 0.35, fillColor: COLORS[kind],
      }).bindTooltip(`${Util.escapeHtml(it.name)}<br>${Util.fmtDateTime(it.date)}${it.event ? '<br><b>' + Util.escapeHtml(it.event.place) + '</b>' : ''}`)
        .on('click', () => cb.onPointClick?.(it))
        .addTo(pointLayer);
    }
    for (const h of analysis.homes.filter(h => h.auto)) {
      L.circle([h.lat, h.lon], { radius: h.r * 1000, color: COLORS.home, weight: 2, fill: false, dashArray: '6 4' })
        .bindTooltip(`Wohnort (automatisch, ${h.days} Tage)`).addTo(overlayLayer);
    }
    for (const d of analysis.autoDaily) {
      L.circle([d.lat, d.lon], { radius: d.r * 1000, color: ZONE_COLORS.ignore, weight: 2, fillOpacity: 0.1, dashArray: '4 4' })
        .bindPopup(() => {
          const div = document.createElement('div');
          div.innerHTML = `<b>Alltagsort (automatisch)</b><br>${d.days} Tage<br>`;
          const b = document.createElement('button');
          b.textContent = 'Als Zone übernehmen';
          b.onclick = () => { map.closePopup(); cb.onAddZone?.(d.lat, d.lon, { type: 'ignore', r: d.r, name: 'Alltagsort' }); };
          div.append(b);
          return div;
        }).addTo(overlayLayer);
    }
    renderZones(zones);
  }

  function renderZones(zones) {
    zoneLayer.clearLayers();
    for (const z of zones) {
      const color = ZONE_COLORS[z.type];
      const circle = L.circle([z.lat, z.lon], { radius: z.r * 1000, color, weight: 2, fillOpacity: 0.12 })
        .bindTooltip(`${Util.escapeHtml(z.name || ZONE_TYPES[z.type])} (${ZONE_TYPES[z.type]})`).addTo(zoneLayer);
      const handle = L.marker([z.lat, z.lon], {
        draggable: true,
        icon: L.divIcon({ className: 'zone-handle', html: `<span style="background:${color}"></span>`, iconSize: [16, 16] }),
      }).addTo(zoneLayer);
      handle.on('drag', e => circle.setLatLng(e.target.getLatLng()));
      handle.on('dragend', e => { const p = e.target.getLatLng(); cb.onZoneMoved?.(z, p.lat, p.lng); });
      handle.on('click', () => cb.onZoneClick?.(z));
    }
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

  return { init, setTiles, setAddMode, render, renderZones, fitAll, fitEvent, focus, invalidate, COLORS, ZONE_TYPES, ZONE_COLORS, get addMode() { return addMode; } };
})();
