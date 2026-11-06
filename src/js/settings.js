// Alle Einstellungen. Aus diesem Schema wird das Einstellungs-Panel erzeugt.
// level: was bei einer Aenderung neu berechnet werden muss (scan > date > analyze > map)
// en: Standardwert, wenn die Oberflaeche englisch ist (Ordnernamen usw.)
// Texte (label, help, options) sind deutsch und werden beim Anzeigen mit T() uebersetzt.
const Settings = (() => {
  const SCHEMA = [
    { section: 'Filter', items: [
      { key: 'filterFrom', label: 'Von Datum', type: 'date', def: '' },
      { key: 'filterTo', label: 'Bis Datum', type: 'date', def: '' },
      { key: 'filterTimeFrom', label: 'Uhrzeit von', type: 'time', def: '',
        help: 'Leer = ganzer Tag. „von“ später als „bis“ geht über Mitternacht (z.B. 20:00–06:00).' },
      { key: 'filterTimeTo', label: 'Uhrzeit bis', type: 'time', def: '' },
      { key: 'filterWeekdays', label: 'Wochentage', type: 'weekdays', def: '1111111' },
      { key: 'filterType', label: 'Dateiart', type: 'select', def: 'all',
        options: [['all', 'Fotos und Videos'], ['photo', 'nur Fotos'], ['video', 'nur Videos']] },
      { key: 'filterGps', label: 'Standort', type: 'select', def: 'all',
        options: [['all', 'alle'], ['with', 'nur mit GPS'], ['without', 'nur ohne GPS']] },
      { key: 'filterZone', label: 'Zone', type: 'zone', def: '' },
      { key: 'filterZoneMode', label: 'Zone-Bedingung', type: 'select', def: 'in',
        options: [['in', 'nur innerhalb der Zone'], ['out', 'nur außerhalb der Zone']] },
      { key: 'filterCamera', label: 'Kamera enthält', type: 'text', def: '' },
      { key: 'filterPersons', label: 'Personen (kommagetrennt)', type: 'text', def: '',
        help: 'Nur Bilder, auf denen mindestens eine dieser Personen erkannt wurde (Tab „Personen“).' },
    ]},
    { section: 'Quelle', items: [
      { key: 'recursive', label: 'Unterordner einbeziehen', type: 'bool', def: true, level: 'scan' },
      { key: 'includePhotos', label: 'Fotos (jpg, heic, png, dng …)', type: 'bool', def: true, level: 'scan' },
      { key: 'includeVideos', label: 'Videos (mp4, mov …)', type: 'bool', def: true, level: 'scan' },
      { key: 'utcPrefixes', label: 'Dateinamen in UTC (Präfixe)', type: 'text', def: 'PXL_', level: 'date',
        help: 'Kommagetrennt. Google-Pixel-Dateinamen (PXL_) enthalten UTC-Zeit statt Ortszeit.' },
      { key: 'videoDateFromName', label: 'Videos: Datum aus Dateiname bevorzugen', type: 'bool', def: true, level: 'date',
        help: 'Viele Handys speichern im Video die Zeit ungenau. Fotos nutzen immer zuerst EXIF.' },
    ]},
    { section: 'Ordner & Dateinamen', items: [
      { key: 'lang', label: 'Sprache Monatsnamen', type: 'select', def: 'de-AT', en: 'en',
        options: [['de-AT', 'Deutsch (Jänner)'], ['de-DE', 'Deutsch (Januar)'], ['en', 'English']] },
      { key: 'monthFolders', label: 'Monatsordner anlegen', type: 'bool', def: true },
      { key: 'monthTpl', label: 'Monatsordner', type: 'text', def: '{YYYY}/{MM}_{MMMM}', dep: 'monthFolders',
        help: 'Platzhalter: {YYYY} {YY} {MM} {MMMM} {DD} {WT} {TYP}. "/" trennt Ordner.' },
      { key: 'fileTpl', label: 'Dateiname', type: 'text', def: '{DD}_{hh}-{mm}-{ss}',
        help: 'Platzhalter: {YYYY} {MM} {DD} {WT} {hh} {mm} {ss} {NAME} (Originalname) {KAMERA}. Endung kommt automatisch, bei gleichen Namen _2, _3 …' },
      { key: 'eventTpl', label: 'Urlaubs-/Ausflugsordner', type: 'text', def: '{YYYY}/{KAT}/{MM}_{MMMM}_{ORT}', en: '{YYYY}/{CAT}/{MM}_{MMMM}_{PLACE}',
        help: 'Zusätzlich: {KAT} Kategorie, {ORT} Ortsname, {KOORD} Koordinaten, {EDD} {EMM} Enddatum, {TAGE}, {ANZ} Anzahl Bilder.' },
      { key: 'lowerExt', label: 'Dateiendung klein schreiben', type: 'bool', def: true },
      { key: 'photoWord', label: 'Wort für {TYP} bei Fotos', type: 'text', def: 'Fotos', en: 'Photos' },
      { key: 'videoWord', label: 'Wort für {TYP} bei Videos', type: 'text', def: 'Videos' },
      { key: 'dupSkip', label: 'Duplikate überspringen', type: 'bool', def: true,
        help: 'Gleiche Dateigröße und gleiches Aufnahmedatum gilt als Duplikat.' },
      { key: 'mapExport', label: 'Fotoübersicht ins Ziel schreiben', type: 'bool', def: true,
        help: 'Nach dem Kopieren entsteht im Ziel _fotos.html: Karte und Ordner zum Durchsuchen, auch offline und ohne dieses Programm. Vorschaubilder kommen in den Ordner _fotos.' },
    ]},
    { section: 'Wohnort', items: [
      { key: 'homeAuto', label: 'Automatisch erkennen', type: 'bool', def: true,
        help: 'Ort mit den meisten Aufnahmetagen. Wird ignoriert, sobald auf der Karte eine Zone „Zuhause“ existiert.' },
      { key: 'nearKm', label: 'Umkreis zu Hause (km)', type: 'num', def: 5, min: 0.5, step: 0.5,
        help: 'Alles weiter weg zählt als unterwegs (Ausflug).' },
    ]},
    { section: 'Alltagsorte', items: [
      { key: 'autoDaily', label: 'Automatisch erkennen (Arbeit, Familie …)', type: 'bool', def: true,
        help: 'Orte in der Nähe, die sehr oft vorkommen, gelten nicht als Ausflug.' },
      { key: 'dailyMinDays', label: 'ab wie vielen Tagen', type: 'num', def: 20, min: 2, dep: 'autoDaily' },
      { key: 'dailyRadiusKm', label: 'Radius (km)', type: 'num', def: 1.5, min: 0.1, step: 0.1, dep: 'autoDaily' },
    ]},
    { section: 'Urlaub', items: [
      { key: 'vacEnabled', label: 'Urlaube erkennen', type: 'bool', def: true },
      { key: 'vacKm', label: 'Mindestentfernung (km)', type: 'num', def: 50, min: 1, dep: 'vacEnabled' },
      { key: 'vacMinDays', label: 'Mindestdauer (Tage)', type: 'num', def: 2, min: 1, dep: 'vacEnabled' },
      { key: 'vacMaxGap', label: 'Erlaubte Tage ohne Bilder', type: 'num', def: 3, min: 0, dep: 'vacEnabled',
        help: 'Tage ohne Fotos innerhalb eines Urlaubs – aber nur, wenn an diesen Tagen kein Foto nahe zu Hause entstand.' },
      { key: 'vacFolder', label: 'Ordnername', type: 'text', def: 'Urlaube', en: 'Holidays', dep: 'vacEnabled' },
    ]},
    { section: 'Ausflug', items: [
      { key: 'tripEnabled', label: 'Ausflüge erkennen', type: 'bool', def: true,
        help: 'Ein Tag mit mehreren Bildern außerhalb des Umkreises zu Hause.' },
      { key: 'tripMinPics', label: 'Mindestens Bilder', type: 'num', def: 3, min: 1, dep: 'tripEnabled' },
      { key: 'tripFolder', label: 'Ordnername', type: 'text', def: 'Ausflüge', en: 'Day trips', dep: 'tripEnabled' },
    ]},
    { section: 'Dienstreise', items: [
      { key: 'workEnabled', label: 'Dienstreisen erkennen', type: 'bool', def: true,
        help: 'Fahrten in eine Zone „Dienstort“ sind immer Dienstreisen. Zusätzlich die Regel unten.' },
      { key: 'workRuleEnabled', label: 'Regel für mehrtägige Fahrten', type: 'bool', def: true, dep: 'workEnabled' },
      { key: 'workNoWeekend', label: '… nur Werktage (kein Sa/So)', type: 'bool', def: true, dep: 'workRuleEnabled' },
      { key: 'workMaxPerDay', label: '… weniger Bilder pro Tag als', type: 'num', def: 5, min: 0, step: 0.5, dep: 'workRuleEnabled' },
      { key: 'workSamePlace', label: 'Einzeltage (Mo–Fr) am selben Ort auch', type: 'bool', def: true, dep: 'workEnabled' },
      { key: 'workFolder', label: 'Ordnername', type: 'text', def: 'Dienstreisen', en: 'Business trips', dep: 'workEnabled' },
    ]},
    { section: 'Eigene Kategorien', items: [
      { key: 'customCats', type: 'cats', def: [] },
    ]},
    { section: 'Bilder ohne GPS', items: [
      { key: 'includeNoGps', label: 'Im Zeitraum eines Ereignisses mitnehmen', type: 'bool', def: true,
        help: 'Z.B. Videos oder Screenshots ohne Standort, die zwischen dem ersten und letzten Urlaubsfoto entstanden.' },
    ]},
    { section: 'Personen', items: [
      { key: 'personFolders', label: 'Personenordner anlegen', type: 'bool', def: false,
        help: 'Kopiert jedes Foto zusätzlich in den Ordner jeder benannten Person darauf. Gesichtserkennung läuft lokal (Tab „Personen“).' },
      { key: 'personTpl', label: 'Personenordner', type: 'text', def: 'Personen/{PERSON}/{YYYY}/{MM}_{MMMM}', en: 'People/{PERSON}/{YYYY}/{MM}_{MMMM}', dep: 'personFolders',
        help: 'Zusätzlich {PERSON}.' },
      { key: 'faceThreshold', label: 'Ähnlichkeit (0.4 streng – 0.6 locker)', type: 'num', def: 0.5, min: 0.2, step: 0.05,
        help: 'Wie verschieden zwei Gesichter derselben Person sein dürfen. Werden Personen vermischt: kleiner. Wird eine Person auf viele Gruppen verteilt: größer.' },
      { key: 'faceMinSize', label: 'Mindestgröße Gesicht (Pixel)', type: 'num', def: 40, min: 10, level: 'faces',
        help: 'Kleinere Gesichter (Hintergrund) werden ignoriert. Gilt für neu analysierte Fotos.' },
      { key: 'faceMinGroup', label: 'Gruppen zeigen ab Gesichtern', type: 'num', def: 3, min: 1 },
      { key: 'faceWindow', label: 'Zeitfenster für Kinder (Monate, 0 = aus)', type: 'num', def: 12, min: 0, step: 1,
        help: 'Automatisch zugeordnet wird nur, wenn ein Gesicht bestätigten Gesichtern der Person aus dieser Zeit ähnelt. So werden zwei Babys, die Jahre auseinander liegen, nicht vermischt. Gruppen mit größeren Zeitlücken werden geteilt – einmal Enter bei „Schnell zuordnen“ fügt sie wieder zusammen.' },
      { key: 'faceUseLib', label: 'Gemerkte Personen verwenden', type: 'bool', def: true,
        help: 'Mit „Personen merken“ gespeicherte Personen werden auch in anderen Ordnern wiedererkannt. Gespeichert werden nur Gesichtsmerkmale (Zahlen), keine Bilder – nur in diesem Browser.' },
    ]},
    { section: 'Ortsnamen', online: true, items: [
      { key: 'geocode', label: 'Ortsnamen von OpenStreetMap', type: 'bool', def: false, online: true,
        help: 'Sendet pro Ereignis einen Koordinatenpunkt an nominatim.openstreetmap.org. Ergebnisse werden lokal gespeichert. Aus: Koordinaten bzw. Namen von Zonen.' },
      { key: 'geocodeZoom', label: 'Genauigkeit', type: 'select', def: '10', dep: 'geocode',
        options: [['5', 'Bundesland'], ['8', 'Bezirk'], ['10', 'Stadt / Gemeinde'], ['14', 'Ortsteil']] },
      { key: 'geocodeLang', label: 'Sprache', type: 'text', def: 'de', en: 'en', dep: 'geocode' },
      { key: 'homeCountry', label: 'Heimatland (ohne Land im Namen)', type: 'text', def: 'Österreich', en: '', dep: 'geocode',
        help: 'So geschrieben, wie OpenStreetMap das Land in der gewählten Sprache nennt.' },
      { key: 'placeTpl', label: 'Ortsname im Ausland', type: 'text', def: '{LAND}_{STADT}', en: '{COUNTRY}_{TOWN}', dep: 'geocode', help: '{LAND} {REGION} {STADT}' },
      { key: 'placeTplHome', label: 'Ortsname im Heimatland', type: 'text', def: '{STADT}', en: '{TOWN}', dep: 'geocode' },
    ]},
    { section: 'Karte', online: true, items: [
      { key: 'tiles', label: 'Kartenhintergrund laden', type: 'bool', def: false, online: true, level: 'map',
        help: 'Lädt Kartenkacheln aus dem Internet. Aus: nur Punkte auf leerem Hintergrund.' },
      { key: 'tileSrc', label: 'Kartenquelle', type: 'select', def: 'auto', online: true, level: 'map', dep: 'tiles',
        options: [['auto', 'Automatisch'], ['osm', 'OpenStreetMap'], ['street', 'Straßenkarte (Esri)'], ['sat', 'Satellit (Esri)'], ['topo', 'Gelände (OpenTopoMap)']],
        help: 'Automatisch: OpenStreetMap auf der Webseite, Esri-Straßenkarte, wenn die Datei direkt geöffnet ist (OpenStreetMap sperrt dort die Kacheln).' },
    ]},
    { section: 'Sonderordner', items: [
      { key: 'rulesText', label: 'Regeln „Muster => Ordner“', type: 'area', def: 'Screenshot => Screenshots\n-WA0 => WhatsApp',
        help: 'Eine Regel pro Zeile, Muster im Dateinamen (Text oder /RegEx/).' },
      { key: 'rulesTpl', label: 'Ordner', type: 'text', def: '{YYYY}/{REGEL}', en: '{YYYY}/{RULE}', help: 'Zusätzlich {REGEL} = Ordner der Regel.' },
      { key: 'rulesExclusive', label: 'Nicht zusätzlich im Monatsordner', type: 'bool', def: true },
    ]},
  ];

  // Vorlagen fuer eigene Kategorien (Bedingungen leer = egal)
  const CAT_PRESETS = [
    { name: 'Neue Kategorie', nameEn: 'New category' },
    { name: 'Fernreise', nameEn: 'Long-haul trip', from: 'vac', kmMin: 800, color: '#d6336c' },
    { name: 'Wochenendtrip', nameEn: 'Weekend trip', from: 'vac', daysMax: 3, week: 'weekend', color: '#7048e8' },
    { name: 'Skiurlaub', nameEn: 'Ski holiday', from: 'vac', months: '111000000011', color: '#1098ad' },
    { name: 'Sommerurlaub', nameEn: 'Summer holiday', from: 'vac', months: '000001110000', color: '#f59f00' },
    { name: 'Wanderungen', nameEn: 'Hikes', from: 'trip', week: 'weekend', kmMax: 150, color: '#5c940d' },
  ];
  function newCat(preset = CAT_PRESETS[0]) {
    const { nameEn, ...p } = preset;
    const name = I18n.lang === 'en' ? nameEn : p.name;
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), on: true, from: 'any', kmMin: '', kmMax: '',
      daysMin: '', daysMax: '', picsMin: '', week: 'any', months: '111111111111', zone: '', place: '', persons: '',
      color: '#f08c00', ...p, name, folder: name };
  }

  const KEY = 'fotosortierer.settings';
  const items = SCHEMA.flatMap(s => s.items);
  const defOf = (it, lang = I18n.lang) => structuredClone(lang === 'en' && 'en' in it ? it.en : it.def);
  const defaults = (lang) => Object.fromEntries(items.map(i => [i.key, defOf(i, lang)]));
  const byKey = Object.fromEntries(items.map(i => [i.key, i]));

  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* leer */ }
    return { ...defaults(), ...saved };
  }
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));

  // Beim Umschalten der Sprache: Werte, die noch dem alten Standard entsprechen, auf den neuen setzen
  function switchLang(s, from, to) {
    for (const it of items) {
      if (!('en' in it)) continue;
      if (JSON.stringify(s[it.key]) === JSON.stringify(defOf(it, from))) s[it.key] = defOf(it, to);
    }
  }

  return { SCHEMA, CAT_PRESETS, newCat, defaults, byKey, load, save, switchLang };
})();
