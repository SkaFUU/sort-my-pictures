// Alle Einstellungen. Aus diesem Schema wird das Einstellungs-Panel erzeugt.
// level: was bei einer Aenderung neu berechnet werden muss (scan > date > analyze > map)
const Settings = (() => {
  const SCHEMA = [
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
      { key: 'lang', label: 'Sprache Monatsnamen', type: 'select', def: 'de-AT',
        options: [['de-AT', 'Deutsch (Jänner)'], ['de-DE', 'Deutsch (Januar)'], ['en', 'English']] },
      { key: 'monthFolders', label: 'Monatsordner anlegen', type: 'bool', def: true },
      { key: 'monthTpl', label: 'Monatsordner', type: 'text', def: '{YYYY}/{MM}_{MMMM}', dep: 'monthFolders',
        help: 'Platzhalter: {YYYY} {YY} {MM} {MMMM} {DD} {WT} {TYP}. "/" trennt Ordner.' },
      { key: 'fileTpl', label: 'Dateiname', type: 'text', def: '{DD}_{hh}-{mm}-{ss}',
        help: 'Platzhalter: {YYYY} {MM} {DD} {WT} {hh} {mm} {ss} {NAME} (Originalname) {KAMERA}. Endung kommt automatisch, bei gleichen Namen _2, _3 …' },
      { key: 'eventTpl', label: 'Urlaubs-/Ausflugsordner', type: 'text', def: '{YYYY}/{KAT}/{MM}_{MMMM}_{ORT}',
        help: 'Zusätzlich: {KAT} Kategorie, {ORT} Ortsname, {KOORD} Koordinaten, {EDD} {EMM} Enddatum, {TAGE}, {ANZ} Anzahl Bilder.' },
      { key: 'lowerExt', label: 'Dateiendung klein schreiben', type: 'bool', def: true },
      { key: 'photoWord', label: 'Wort für {TYP} bei Fotos', type: 'text', def: 'Fotos' },
      { key: 'videoWord', label: 'Wort für {TYP} bei Videos', type: 'text', def: 'Videos' },
      { key: 'dupSkip', label: 'Duplikate überspringen', type: 'bool', def: true,
        help: 'Gleiche Dateigröße und gleiches Aufnahmedatum gilt als Duplikat.' },
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
      { key: 'vacFolder', label: 'Ordnername', type: 'text', def: 'Urlaube', dep: 'vacEnabled' },
    ]},
    { section: 'Ausflug', items: [
      { key: 'tripEnabled', label: 'Ausflüge erkennen', type: 'bool', def: true,
        help: 'Ein Tag mit mehreren Bildern außerhalb des Umkreises zu Hause.' },
      { key: 'tripMinPics', label: 'Mindestens Bilder', type: 'num', def: 3, min: 1, dep: 'tripEnabled' },
      { key: 'tripFolder', label: 'Ordnername', type: 'text', def: 'Ausflüge', dep: 'tripEnabled' },
    ]},
    { section: 'Dienstreise', items: [
      { key: 'workEnabled', label: 'Dienstreisen erkennen', type: 'bool', def: true,
        help: 'Fahrten in eine Zone „Dienstort“ sind immer Dienstreisen. Zusätzlich die Regel unten.' },
      { key: 'workRuleEnabled', label: 'Regel für mehrtägige Fahrten', type: 'bool', def: true, dep: 'workEnabled' },
      { key: 'workNoWeekend', label: '… nur Werktage (kein Sa/So)', type: 'bool', def: true, dep: 'workRuleEnabled' },
      { key: 'workMaxPerDay', label: '… weniger Bilder pro Tag als', type: 'num', def: 5, min: 0, step: 0.5, dep: 'workRuleEnabled' },
      { key: 'workSamePlace', label: 'Einzeltage (Mo–Fr) am selben Ort auch', type: 'bool', def: true, dep: 'workEnabled' },
      { key: 'workFolder', label: 'Ordnername', type: 'text', def: 'Dienstreisen', dep: 'workEnabled' },
    ]},
    { section: 'Bilder ohne GPS', items: [
      { key: 'includeNoGps', label: 'Im Zeitraum eines Ereignisses mitnehmen', type: 'bool', def: true,
        help: 'Z.B. Videos oder Screenshots ohne Standort, die zwischen dem ersten und letzten Urlaubsfoto entstanden.' },
    ]},
    { section: 'Ortsnamen', online: true, items: [
      { key: 'geocode', label: 'Ortsnamen von OpenStreetMap', type: 'bool', def: false, online: true,
        help: 'Sendet pro Ereignis einen Koordinatenpunkt an nominatim.openstreetmap.org. Ergebnisse werden lokal gespeichert. Aus: Koordinaten bzw. Namen von Zonen.' },
      { key: 'geocodeZoom', label: 'Genauigkeit', type: 'select', def: '10', dep: 'geocode',
        options: [['5', 'Bundesland'], ['8', 'Bezirk'], ['10', 'Stadt / Gemeinde'], ['14', 'Ortsteil']] },
      { key: 'geocodeLang', label: 'Sprache', type: 'text', def: 'de', dep: 'geocode' },
      { key: 'homeCountry', label: 'Heimatland (ohne Land im Namen)', type: 'text', def: 'Österreich', dep: 'geocode' },
      { key: 'placeTpl', label: 'Ortsname im Ausland', type: 'text', def: '{LAND}_{STADT}', dep: 'geocode', help: '{LAND} {REGION} {STADT}' },
      { key: 'placeTplHome', label: 'Ortsname im Heimatland', type: 'text', def: '{STADT}', dep: 'geocode' },
    ]},
    { section: 'Karte', online: true, items: [
      { key: 'tiles', label: 'Kartenhintergrund laden', type: 'bool', def: false, online: true, level: 'map',
        help: 'Lädt Kartenkacheln von tile.openstreetmap.org. Aus: nur Punkte auf leerem Hintergrund.' },
    ]},
    { section: 'Sonderordner', items: [
      { key: 'rulesText', label: 'Regeln „Muster => Ordner“', type: 'area', def: 'Screenshot => Screenshots\n-WA0 => WhatsApp',
        help: 'Eine Regel pro Zeile, Muster im Dateinamen (Text oder /RegEx/).' },
      { key: 'rulesTpl', label: 'Ordner', type: 'text', def: '{YYYY}/{REGEL}', help: 'Zusätzlich {REGEL} = Ordner der Regel.' },
      { key: 'rulesExclusive', label: 'Nicht zusätzlich im Monatsordner', type: 'bool', def: true },
    ]},
  ];

  const KEY = 'fotosortierer.settings';
  const defaults = () => Object.fromEntries(SCHEMA.flatMap(s => s.items).map(i => [i.key, i.def]));
  const byKey = Object.fromEntries(SCHEMA.flatMap(s => s.items).map(i => [i.key, i]));

  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* leer */ }
    return { ...defaults(), ...saved };
  }
  const save = s => localStorage.setItem(KEY, JSON.stringify(s));

  return { SCHEMA, defaults, byKey, load, save };
})();
