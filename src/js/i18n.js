// Sprache Deutsch / Englisch. Texte stehen im Code deutsch und werden mit T('…') uebersetzt.
// Statisches HTML wird mit translateDom() umgestellt; Elemente mit data-i18n-html als Ganzes (mit Auszeichnung).
const I18n = (() => {
  const EN = {
    // --- Oberflaeche: Register, Ribbon, Seitenleiste ---
    'Quelle': 'Source', 'Orte': 'Places', 'Ereignisse': 'Events', 'Prüfen': 'Review', 'Personen': 'People', 'Ziel & Kopieren': 'Target & copy',
    'Kopieren': 'Copy', 'Alle geplanten Kopien in den Zielordner schreiben': 'Write all planned copies to the target folder',
    'Ordner wählen': 'Choose folder','Einlesen': 'Scan', 'Dateien und Metadaten einlesen': 'Read files and metadata',
    'Dateien': 'Files', 'Exportieren': 'Export', 'Importieren': 'Import', 'Standard': 'Defaults', 'Einstellungen': 'Settings',
    'Einstellungen, Zonen und Änderungen als Datei speichern': 'Save settings, zones and changes to a file',
    'Zone setzen': 'Add zone', 'Danach auf die Karte klicken': 'Then click on the map', 'Alle zeigen': 'Show all', 'Zonen': 'Zones',
    'Ohne Karte': 'No map', 'Karte 🌐': 'Map 🌐', 'Satellit 🌐': 'Satellite 🌐', 'Gelände 🌐': 'Terrain 🌐', 'Kartenhintergrund': 'Map background',
    'OpenStreetMap auf der Webseite, Esri-Straßenkarte, wenn die Datei direkt geöffnet ist': 'OpenStreetMap on the website, Esri street map when the file is opened directly',
    'Satellitenbild von Esri': 'Satellite image from Esri', 'Geländekarte von OpenTopoMap': 'Terrain map from OpenTopoMap',
    'Erkennung': 'Detection', 'Erkennen': 'Detect', 'Art': 'Type', 'Alle': 'All', 'Jahr': 'Year', 'Alle Jahre': 'All years', 'Ort': 'Place',
    'suchen …': 'search …', 'Anzeigen': 'Show', 'Neue Kategorie': 'New category', 'Kategorien': 'Categories',
    'Eigene Kategorie mit eigenen Regeln und eigenem Ordner': 'Custom category with its own rules and folder',
    'Änderungen verwerfen': 'Discard changes', 'Bearbeiten': 'Edit', 'Art wählen': 'Choose type', 'Vorschlag OK': 'Accept suggestion',
    'Zurück': 'Back', 'Überspringen': 'Skip', 'Auf Karte': 'On map', 'Ereignis': 'Event', 'Nur ungeprüfte': 'Only unreviewed',
    'Reihenfolge': 'Order', 'unsichere zuerst': 'uncertain first', 'nach Datum': 'by date',
    'Gesichter erkennen': 'Detect faces', 'Läuft komplett lokal im Browser': 'Runs completely locally in the browser',
    'Namen zurücksetzen': 'Reset names', 'Erkennung (lokal)': 'Detection (local)', 'Ordner': 'Folder',
    'Ziel wählen': 'Choose target', 'Ziel': 'Target', 'Struktur': 'Structure', 'Filter zurücksetzen': 'Reset filter',
    'Alle Filter zurücksetzen': 'Reset all filters', 'aktiv': 'active', 'Weiter: {0} {1}': 'Next: {0} {1}', 'Nächster Schritt': 'Next step',
    'Ort (bearbeitbar)': 'Place (editable)', 'Zeitraum': 'Period', 'Tage': 'Days', 'Davon Samstag/Sonntag': 'Of which Saturday/Sunday',
    'Sa/So': 'Sat/Sun', 'Bilder': 'Pictures', 'pro Tag': 'per day', 'Größte Entfernung von zu Hause': 'Greatest distance from home',
    'Entf.': 'Dist.', 'Name aus': 'Name from', 'Zielordner': 'Target folder', 'Noch nichts eingelesen.': 'Nothing scanned yet.',
    'Seitenleiste ein-/ausblenden': 'Show/hide side panel', 'Ziehen ändert die Breite': 'Drag to change the width',
    'Noch keine Quelle gewählt.': 'No source chosen yet.', 'Noch nicht eingelesen.': 'Not scanned yet.',
    'Dieser Browser kann keine lokalen Ordner lesen und schreiben. Bitte <b>Chrome</b>, <b>Edge</b>, <b>Brave</b> oder <b>Opera</b> verwenden.':
      'This browser cannot read and write local folders. Please use <b>Chrome</b>, <b>Edge</b>, <b>Brave</b> or <b>Opera</b>.',
    '<b>Zuhause</b> – Mittelpunkt für alle Entfernungen.': '<b>Home</b> – centre for all distances.',
    '<b>Alltagsort</b> – Arbeit, Familie: zählt nie als Ausflug.': '<b>Everyday place</b> – work, family: never counts as a day trip.',
    '<b>Dienstort</b> – Fahrten dorthin sind immer Dienstreisen.': '<b>Work place</b> – trips there are always business trips.',
    '<b>Benannter Ort</b> – fester Ordnername, auch offline.': '<b>Named place</b> – fixed folder name, works offline.',
    'Mittelpunkt auf der Karte ziehen zum Verschieben.': 'Drag the centre on the map to move it.',
    'Art und Ortsname je Zeile ändern – leer = automatisch.': 'Change type and place name per row – empty = automatic.',
    '<svg class="ic sm"><use href="#i-pin"/></svg> zeigt das Ereignis auf der Karte, Klick auf die Zeile zeigt die Bilder.':
      '<svg class="ic sm"><use href="#i-pin"/></svg> shows the event on the map, clicking the row shows the pictures.',
    'In den Bildern das Häkchen entfernen = nicht in diesem Ereignis-Ordner.': 'Untick a picture = not in this event folder.',
    'Ereignisse einzeln durchgehen, unsichere (knapp an einer Regelgrenze) zuerst.': 'Go through the events one by one, uncertain ones (close to a rule limit) first.',
    'Tasten <kbd>1</kbd>–<kbd>9</kbd> wählen die Art, <kbd>Enter</kbd> übernimmt den Vorschlag, <kbd>←</kbd> <kbd>→</kbd> blättern.':
      'Keys <kbd>1</kbd>–<kbd>9</kbd> choose the type, <kbd>Enter</kbd> accepts the suggestion, <kbd>←</kbd> <kbd>→</kbd> browse.',
    'Geprüfte Ereignisse bekommen in der Liste ein ✓.': 'Reviewed events get a ✓ in the list.',
    'Läuft komplett lokal, es wird nichts hochgeladen. Nutzt alle Prozessorkerne.': 'Runs completely locally, nothing is uploaded. Uses all CPU cores.',
    'Namen eintippen – gleicher Name führt Gruppen zusammen.': 'Type names – the same name merges groups.',
    '„Prüfen“ zeigt automatisch zugeordnete Gesichter nach Datum, mit Trennern zwischen den Jahren: ✓ bestätigt, ✕ entfernt Fehltreffer.':
      '“Review” shows automatically assigned faces by date, with dividers between the years: ✓ confirms, ✕ removes wrong matches.',
    'Kann jederzeit abgebrochen werden, ein neuer Start setzt fort.': 'Can be cancelled at any time, starting again continues.',
    'Noch kein Zielordner gewählt.': 'No target folder chosen yet.',
    'Es wird nur kopiert. Vorhandene Dateien werden nie überschrieben, ein zweiter Lauf überspringt sie.':
      'Files are only copied. Existing files are never overwritten, a second run skips them.',
    'Protokoll': 'Log', 'Protokoll anzeigen': 'Show log', 'Schließen': 'Close', 'Abbrechen': 'Cancel',

    // --- Status, Meldungen ---
    '{0} Dateien · {1} mit GPS': '{0} files · {1} with GPS',
    '{0} Dateien · {1} mit GPS · {2} Ereignisse · {3} Kopien geplant': '{0} files · {1} with GPS · {2} events · {3} copies planned',
    '· {0} durch Filter ausgeblendet': '· {0} hidden by filter', '{0} durch Filter ausgeblendet': '{0} hidden by filter',
    'Kartenhintergrund laden': 'Load map background', 'Ortsnamen': 'Place names', 'Online': 'Online', 'Vollständig offline': 'Fully offline',
    'Diese Funktionen senden Anfragen an OpenStreetMap. Abschalten in den Einstellungen.': 'These features send requests to OpenStreetMap. Switch them off in the settings.',
    'Es werden keine Daten ins Internet gesendet.': 'No data is sent to the internet.',
    'Gespeicherte Ortsnamen löschen?': 'Delete stored place names?', 'Cache leeren': 'Clear cache', 'Nutzt das Internet': 'Uses the internet',
    '{0} Orte gespeichert': '{0} places stored',
    'Gilt für Fotos, die neu analysiert werden.': 'Applies to photos that are analysed from now on.',
    'Geändert: bitte neu einlesen („Einlesen“).': 'Changed: please scan again (“Scan”).',
    'Lese Dateien …': 'Reading files …', 'Suche Dateien … {0}': 'Searching files … {0}', 'Lese Metadaten … {0} / {1}': 'Reading metadata … {0} / {1}',
    'Eingelesen: {0} Dateien aus „{1}“ in {2} s': 'Scanned: {0} files from “{1}” in {2} s', 'Fehler beim Einlesen: {0}': 'Error while scanning: {0}',
    'Ortsnamen geholt: {0}': 'Place names fetched: {0}', ', Fehler: {0}': ', errors: {0}', 'Ortsnamen (online) … {0} / {1}': 'Place names (online) … {0} / {1}',
    'Unbekannt': 'Unknown',
    'Lade Gesichtsmodelle …': 'Loading face models …',
    'Gesichtserkennung gestartet (lokal, YuNet + SFace, {0} Prozessorkerne gleichzeitig)': 'Face detection started (local, YuNet + SFace, {0} CPU cores in parallel)',
    'Gesichter erkennen … {0} / {1} Fotos · {2} Gesichter · noch ca. {3} min': 'Detecting faces … {0} / {1} photos · {2} faces · about {3} min left',
    'Gesichtserkennung abgebrochen – „Gesichter erkennen“ setzt fort.': 'Face detection cancelled – “Detect faces” continues.',
    'Zuerst in Schritt 1 „Einlesen“ klicken.': 'First click “Scan” in step 1.',
    'Zuerst in Schritt 1 eine Quelle wählen und einlesen.': 'First choose and scan a source in step 1.',
    'Gesichtserkennung fertig.': 'Face detection finished.', 'Gesichtserkennung fehlgeschlagen: {0}': 'Face detection failed: {0}',
    'Ziel darf nicht gleich der Quelle sein.': 'The target must not be the same as the source.',
    '{0} Kopien ({1}) nach „{2}“ schreiben?\n\nOriginale bleiben unverändert, vorhandene Dateien werden nicht überschrieben.':
      'Write {0} copies ({1}) to “{2}”?\n\nOriginals stay unchanged, existing files are not overwritten.',
    'Kopieren gestartet: {0} Dateien nach „{1}“': 'Copying started: {0} files to “{1}”',
    'Kopiere … {0} / {1} · {2} · {3}/s': 'Copying … {0} / {1} · {2} · {3}/s', '· {0} Fehler': '· {0} errors',
    '{0}: {1} kopiert, {2} übersprungen (existierten), {3} Fehler · Protokoll: {4}': '{0}: {1} copied, {2} skipped (existed), {3} errors · log: {4}',
    'Abgebrochen': 'Cancelled', 'Fertig': 'Done', 'Fehler: {0}': 'Error: {0}',
    'kopiert': 'copied', 'existiert – übersprungen': 'exists – skipped', 'Größe stimmt nicht': 'Size does not match', 'FEHLER: {0}': 'ERROR: {0}',
    'Quelle;Ziel;Status': 'Source;Target;Status', 'protokoll': 'log',
    'Schritt 1: Oben „Ordner wählen“.': 'Step 1: “Choose folder” at the top.',
    'Quelle „{0}“ – oben „Einlesen“ klicken.': 'Source “{0}” – click “Scan” at the top.',
    'Quelle „{0}“ – „Einlesen“ klicken.': 'Source “{0}” – click “Scan”.', 'Quelle wählen, um zu beginnen.': 'Choose a source to begin.',
    'Auf die Karte klicken, um die Zone zu setzen.': 'Click on the map to place the zone.',
    'Keine Bilder mit GPS – Urlaube und Ausflüge können nicht erkannt werden.': 'No pictures with GPS – holidays and day trips cannot be detected.',
    'Datei ungültig: {0}': 'Invalid file: {0}',
    'Alle Einstellungen auf Standard zurücksetzen? (Zonen, eigene Kategorien und manuelle Änderungen bleiben)': 'Reset all settings to defaults? (Zones, custom categories and manual changes are kept)',
    'Alle manuellen Änderungen in der Ereignisliste verwerfen?': 'Discard all manual changes in the event list?',

    // --- Zonen, Karte ---
    'Zuhause': 'Home', 'Alltagsort (kein Ausflug)': 'Everyday place (no day trip)', 'Alltagsort': 'Everyday place', 'Dienstort': 'Work place', 'Benannter Ort': 'Named place',
    'Wohnort (automatisch, {0} Tage)': 'Home (automatic, {0} days)', 'Alltagsort (automatisch)': 'Everyday place (automatic)', '{0} Tage': '{0} days',
    'Als Zone übernehmen': 'Make it a zone', 'OpenStreetMap-Mitwirkende': 'OpenStreetMap contributors', 'Zuhause / Alltag': 'Home / everyday', 'Sonstige': 'Other',
    '– keine –': '– none –', 'Noch keine Zonen. Oben „Zone setzen“ und dann auf die Karte klicken.': 'No zones yet. Click “Add zone” at the top and then on the map.',
    'Auf Karte zeigen': 'Show on map', 'Löschen': 'Delete', 'Radius km': 'Radius km',

    // --- Ereignisse, Arten, Begruendungen ---
    'Urlaub': 'Holiday', 'Urlaube': 'Holidays', 'Ausflug': 'Day trip', 'Ausflüge': 'Day trips', 'Dienstreise': 'Business trip', 'Dienstreisen': 'Business trips',
    '– kein Ordner –': '– no folder –', 'Ohne Ordner': 'No folder', 'Kein Ordner': 'No folder', 'Kategorie {0}': 'Category {0}',
    '{0} Tage, bis {1} km von zu Hause': '{0} days, up to {1} km from home', '{0} Bilder außerhalb, bis {1} km von zu Hause': '{0} pictures away, up to {1} km from home',
    'Koordinaten': 'Coordinates', 'manuell': 'manual', 'liegt in einer Zone „Dienstort“': 'lies in a “Work place” zone',
    'Regel: {0}{1} Bilder/Tag (Grenze {2})': 'Rule: {0}{1} pictures/day (limit {2})', 'nur Werktage,': 'workdays only,',
    'Werktag am selben Ort wie andere Dienstreisen': 'workday at the same place as other business trips',
    'Eigene Kategorie „{0}“': 'Custom category “{0}”', 'aus {0}': 'from {0}', 'ab {0} km': 'from {0} km', 'bis {0} km': 'up to {0} km',
    'ab {0} Tage': 'from {0} days', 'bis {0} Tage': 'up to {0} days', 'mit Wochenende': 'with weekend', 'nur Wochenende': 'weekend only', 'nur Werktage': 'workdays only',
    'Monate {0}': 'months {0}', 'in Zone': 'in zone', 'Ort enthält „{0}“': 'place contains “{0}”', 'mit {0}': 'with {0}',
    'Klick: Bilder anzeigen': 'Click: show pictures', 'Ortsname – Quelle: {0}. Leer lassen für automatisch.': 'Place name – source: {0}. Leave empty for automatic.',
    'Im Prüfmodus bestätigt': 'Confirmed in review', 'Noch nicht geprüft': 'Not reviewed yet',
    'Häkchen entfernen = Bild nicht in diesem Ereignis-Ordner (bleibt im Monatsordner).': 'Untick = picture not in this event folder (stays in the month folder).',
    'ohne GPS': 'no GPS', '… und {0} weitere': '… and {0} more',

    // --- Eigene Kategorien ---
    'Eigene Kategorien': 'Custom categories',
    'Sortieren erkannte Ereignisse nach eigenen Regeln in eigene Ordner, z. B. „Fernreise: Urlaub ab 800 km“. Leere Felder = egal. Die erste passende Kategorie gewinnt.':
      'Sort detected events into their own folders by your own rules, e.g. “Long-haul trip: holiday from 800 km”. Empty fields = any. The first matching category wins.',
    'alle Ereignisse': 'all events', 'egal': 'any', 'mit Wochenende (Sa/So)': 'with weekend (Sat/Sun)', 'nur am Wochenende': 'only at the weekend',
    'nur Werktage (Mo–Fr)': 'workdays only (Mon–Fri)', 'Name': 'Name', '– egal –': '– any –', 'Ein/aus': 'On/off', 'Farbe': 'Colour',
    'Nach oben (wird zuerst geprüft)': 'Move up (checked first)', 'Nach unten': 'Move down', 'Kategorie „{0}“ löschen?': 'Delete category “{0}”?',
    'Gilt für': 'Applies to', 'Entfernung (km)': 'Distance (km)', 'ab': 'from', 'bis': 'to', 'Dauer (Tage)': 'Duration (days)', 'Mindestens Bilder': 'At least pictures',
    'Wochentage': 'Weekdays', 'Monate': 'Months', 'Ort enthält': 'Place contains', 'egal (kommagetrennt)': 'any (comma-separated)', 'Ordnername': 'Folder name',
    'ausgeschaltet': 'switched off', '{0} Ereignisse passen': '{0} events match', 'Kategorie hinzufügen': 'Add category',
    'Fernreise': 'Long-haul trip', 'Wochenendtrip': 'Weekend trip', 'Skiurlaub': 'Ski holiday', 'Sommerurlaub': 'Summer holiday', 'Wanderungen': 'Hikes',

    // --- Pruefen ---
    'Vorschlag': 'Suggestion', 'Zuerst in Schritt 1 eine Quelle einlesen.': 'First scan a source in step 1.', '{0} von {1} geprüft': '{0} of {1} reviewed',
    '✓ Alles geprüft.': '✓ Everything reviewed.', 'Keine Ereignisse gefunden.': 'No events found.',
    '{0} Tag(e) · {1} Sa/So · {2} Bilder · {3}/Tag · bis {4} km': '{0} day(s) · {1} Sat/Sun · {2} pictures · {3}/day · up to {4} km',
    'knapp an der Grenze': 'close to the limit', '✓ geprüft: {0}': '✓ reviewed: {0}', 'Ortsname': 'Place name',
    'Art oben im Ribbon wählen oder Taste 1–9.': 'Choose the type in the ribbon above or press 1–9.',
    'Jedes {0}. Bild von {1} – Klick öffnet die Bildansicht mit allen.': 'Every {0}th picture of {1} – click opens the viewer with all of them.',

    // --- Personen ---
    'Alle Namen und Ausschlüsse der Gesichter löschen? (Die Erkennung selbst bleibt gespeichert.)': 'Delete all face names and exclusions? (The detection itself stays stored.)',
    'Zuerst einen Quellordner einlesen.': 'First scan a source folder.',
    'Die Gesichtserkennung wurde verbessert (neues Modell). Bitte „Gesichter erkennen“ neu starten – vergebene Namen werden auf die neu gefundenen Gesichter übertragen.':
      'Face recognition has been improved (new model). Please run “Detect faces” again – names you gave are carried over to the newly found faces.',
    'Noch keine Gesichtserkennung für diesen Ordner. „Gesichter erkennen“ startet sie (lokal, nutzt alle Prozessorkerne, ca. 3–10 min für 5000 Fotos, kann jederzeit abgebrochen und fortgesetzt werden).':
      'No face detection for this folder yet. “Detect faces” starts it (local, uses all CPU cores, about 3–10 min for 5000 photos, can be cancelled and continued at any time).',
    '{0} Gesichter · {1} Personen benannt · {2} unbenannte Gruppen': '{0} faces · {1} people named · {2} unnamed groups',
    '({0} kleine ausgeblendet)': '({0} small ones hidden)', '· {0} ignoriert': '· {0} ignored',
    'Unbenannt – Namen eintippen (gleicher Name = zusammenführen)': 'Unnamed – type names (same name = merge)', '… und {0} weitere Gruppen': '… and {0} more groups',
    'automatisch zugeordnet': 'assigned automatically', 'Ja, das ist {0}': 'Yes, this is {0}',
    '{0} automatisch zugeordnet – ✓ bestätigt, ✕ entfernt.': '{0} assigned automatically – ✓ confirms, ✕ removes.',
    'Klick: Namen zuweisen': 'Click: assign a name',
    '<b>Ordner wählen</b> oder oben im Ordnerbaum klicken: Ordner mit Fotos und Videos am PC, auch Netzlaufwerk.':
      '<b>Choose folder</b> or click in the folder tree above: folder with photos and videos on the PC, network drives too.',
    'Anderen Hauptordner …':
      'Other main folder …',
    'Anderen Ordner …':
      'Other folder …',
    'Einmal ein Laufwerk oder einen Hauptordner freigeben (z. B. den Ordner mit allen Fotos). Danach lassen sich hier die Unterordner direkt als Quelle wählen.':
      'Share a drive or main folder once (e.g. the folder with all your photos). Then its subfolders can be chosen as source right here.',
    'Erlauben':
      'Allow',
    'Fotos werden nur gelesen, nie verändert. In den Quellordner kommt nur die kleine Datei <b>_sortmypictures.json</b> mit deinem Stand (Namen, geprüfte Ereignisse) – so geht nichts verloren, auch mit einem anderen Browser oder PC.':
      'Photos are only read, never changed. Only the small file <b>_sortmypictures.json</b> with your progress (names, reviewed events) is written into the source folder – so nothing gets lost, even with another browser or PC.',
    'Gespeicherter Stand vorhanden':
      'Saved progress available',
    'Laufwerk oder Hauptordner freigeben …':
      'Share drive or main folder …',
    'Neu laden':
      'Reload',
    'Ordner neu lesen':
      'Read folders again',
    'Stand aus „{0}“ im Ordner übernommen (gespeichert {1}).':
      'Progress taken from “{0}” in the folder (saved {1}).',
    'Stand gespeichert in „{0}“ ({1})':
      'Progress saved in “{0}” ({1})',
    'Stand nur im Browser – für „{0}“ im Ordner fehlt der Schreibzugriff.':
      'Progress only in the browser – write access for “{0}” in the folder is missing.',
    'Stand wird im Browser und in „{0}“ im Ordner gespeichert.':
      'Progress is saved in the browser and in “{0}” in the folder.',
    'Zugriff auf „{0}“ muss nach dem Neustart des Browsers einmal bestätigt werden.':
      'Access to “{0}” has to be confirmed once after the browser restarts.',
    'Zugriff erlauben':
      'Allow access',
    '„{0}“ konnte nicht geschrieben werden: {1}':
      '“{0}” could not be written: {1}',
    'Ignoriert ({0}) – fremd oder kein Gesicht': 'Ignored ({0}) – stranger or not a face', 'Verbergen': 'Hide', 'Zeigen': 'Show',
    'Für eine neue Person: Namen eintippen oder Gesichter markieren und Rechtsklick. „Zurückholen“ macht die Gruppe wieder offen.':
      'For a new person: type a name or select faces and right-click. “Bring back” makes the group open again.',
    'Wieder als offene Gruppe anzeigen': 'Show as an open group again', 'Zurückholen': 'Bring back', '{0} Gesichter': '{0} faces',
    'Gespeicherter Stand für „{0}“: {1} Gesichter benannt, {2} Ereignisse geändert oder geprüft.':
      'Saved progress for “{0}”: {1} faces named, {2} events changed or reviewed.',
    'Auch Gruppen mit nur wenigen Gesichtern anzeigen':
      'Also show groups with only a few faces',
    'Bereits geprüfte Ereignisse überspringen':
      'Skip events that have already been reviewed',
    'Es wird nichts kopiert oder verschoben. Es entsteht nur „{0}“ (Karte + Ordnerübersicht) mit Links auf die Originale.\n\nMit Vorschaubildern: zusätzlich kleine Bilder (ca. 10–20 KB je Foto) im Ordner „{1}“ – die Übersicht blättert damit schnell.\nOhne: nur die eine Datei, die Übersicht lädt dann jedes Original (langsamer, vor allem übers Netzwerk).\n\nDanach den Ordner wählen, in den die Übersicht kommt – am einfachsten der Quellordner selbst.':
      'Nothing is copied or moved. Only “{0}” is created (map + folder overview) with links to the originals.\n\nWith thumbnails: additionally small pictures (about 10–20 KB per photo) in the folder “{1}” – the overview browses quickly with them.\nWithout: just the one file, the overview then loads every original (slower, especially over the network).\n\nThen choose the folder for the overview – easiest is the source folder itself.',
    'Fertige ausblenden':
      'Hide finished',
    'Kleine Gruppen':
      'Small groups',
    'Mit Vorschaubildern':
      'With thumbnails',
    'Mit „Fertig“ abgelegte Personen ganz ausblenden':
      'Hide people marked “Done” completely',
    'Ohne Vorschaubilder':
      'Without thumbnails',
    'Schreibe Fotoübersicht …':
      'Writing photo overview …',
    'OK': 'OK',
    'Neu prüfen': 'Review again',
    'Neu starten': 'Start over',
    'Alles verwerfen': 'Discard everything',
    'Es ist noch nichts geprüft.': 'Nothing has been reviewed yet.',
    'Alle Ereignisse wieder als ungeprüft markieren und von vorne durchgehen (mit Rückfrage)': 'Mark all events as not reviewed and go through them again (asks first)',
    '{0} geprüfte Ereignisse wieder als ungeprüft markieren und von vorne durchgehen?\n\nDie gewählten Arten und Namen bleiben als Vorauswahl erhalten.':
      'Mark {0} reviewed events as not reviewed and go through them again?\n\nThe chosen types and names stay as a preselection.',
    '{0} ist auf diesem Foto schon vorhanden.\n\nOK = trotzdem zuordnen (wird bei „Erneut prüfen“ als Fehler gemeldet)\nAbbrechen = nichts ändern':
      '{0} is already on this photo.\n\nOK = assign anyway (will be reported as an error by “Check again”)\nCancel = change nothing',
    '{0} ist auf {1} dieser Fotos schon vorhanden.\n\nOK = trotzdem alle zuordnen (wird bei „Erneut prüfen“ als Fehler gemeldet)\nAbbrechen = diese Gesichter auslassen, die anderen zuordnen':
      '{0} is already on {1} of these photos.\n\nOK = assign all anyway (will be reported as an error by “Check again”)\nCancel = leave out these faces, assign the others',
    '{0} ist auf manchen Fotos mehrmals zugeordnet – Klick: einzeln prüfen': '{0} is assigned more than once on some photos – click: check one by one',
    '⚠ {0} doppelt': '⚠ {0} twice',
    '{0} ist auf diesem Foto schon – passt am zweitbesten zu {1}, wird {1} zugeordnet': '{0} is already on this photo – second best match is {1}, will be assigned to {1}',
    '{0} ist auf diesem Foto schon – wird nicht {0} zugeordnet': '{0} is already on this photo – will not be assigned to {0}',
    '{0} bestätigt': '{0} confirmed', 'Name …': 'Name …', '{0} Gesichter · {1} Fotos': '{0} faces · {1} photos', '· {0} zu prüfen': '· {0} to review',
    'Auswahl aufheben': 'Clear selection', 'Gesichter hierher ziehen': 'Drag faces here',
    'Gesichter mit der Maus auf eine andere Person ziehen. Strg+Klick wählt mehrere aus.': 'Drag faces onto another person with the mouse. Ctrl+click selects several.',
    'Viele auf einmal: auf freier Fläche einen Rahmen ziehen, Umschalt+Klick wählt einen Bereich, ☐ die ganze Gruppe. Dann <b>Rechtsklick</b> → Namen eintippen oder auswählen.':
      'Many at once: drag a frame on empty space, Shift+click selects a range, ☐ the whole group. Then <b>right-click</b> → type or pick a name.',
    'Jede Zuordnung verbessert die Erkennung sofort. <b>Erneut prüfen</b> zeigt, was dazugekommen ist. Grüne Vorschläge wie „Anna?“ ordnen eine ganze Gruppe zu.':
      'Every assignment improves recognition right away. <b>Check again</b> shows what was added. Green suggestions like “Anna?” assign a whole group.',
    '<b>Personen merken</b> speichert die bestätigten Gesichter als Wissen: diese Personen werden dann auch in anderen Ordnern erkannt.':
      '<b>Remember people</b> stores the confirmed faces as knowledge: these people are then recognised in other folders too.',
    'Hierher kommt, was du mit ✕ entfernst. Später auf eine Person ziehen.': 'Whatever you remove with ✕ ends up here. Drag it onto a person later.',
    'Kein Gesicht / endgültig ausblenden': 'Not a face / hide for good',
    'Klick: wieder aufklappen · Gesichter hierher ziehen = {0}': 'Click: expand again · drag faces here = {0}',
    'Mit dieser Person fertig: klein oben ablegen. Automatisch zugeordnete Gesichter werden dabei bestätigt.': 'Done with this person: put it small at the top. Automatically assigned faces are confirmed.',
    'Mit ✕ entfernte Gesichter landen unten in „Nicht zugeordnet“ und lassen sich später zuweisen.': 'Faces removed with ✕ go to “Unassigned” at the bottom and can be assigned later.',
    'Name der Person:': 'Name of the person:', 'Neue Person': 'New person', 'Neue Person …': 'New person …',
    'Nicht diese Person – nach „Nicht zugeordnet“': 'Not this person – move to “Unassigned”', 'Nicht zugeordnet': 'Unassigned', 'Nicht zugeordnet ({0})': 'Unassigned ({0})',
    '{0} Gesichter ausgewählt – ziehen oder:': '{0} faces selected – drag them or:',
    '„Fertig“ legt eine Person klein oben ab – sie bleibt Ziel zum Hineinziehen.': '“Done” puts a person small at the top – you can still drag faces onto it.',
    'Fotos': 'Photos', 'Weniger': 'Less', 'Diese Gruppe ignorieren (keine Person)': 'Ignore this group (not a person)', 'Ignorieren': 'Ignore',

    // --- Ziel / Vorschau ---
    'Monatsordner': 'Month folders', 'Sonderordner': 'Special folders', 'Kopien': 'Copies', 'Gesamt': 'Total', 'mit GPS': 'with GPS',
    'Duplikate übersprungen': 'duplicates skipped', '{0} gefiltert': '{0} filtered', 'Kopien je Art': 'Copies per type', 'Datum aus': 'Date from',
    'Quelle: {0}\nDatum: {1} ({2})\nKlick: Bildansicht': 'Source: {0}\nDate: {1} ({2})\nClick: viewer',
    'Dateiname': 'File name', 'Dateiname (UTC)': 'File name (UTC)', 'Dateiname (nur Datum)': 'File name (date only)', 'Video-Metadaten': 'Video metadata',
    'Änderungsdatum': 'Modification date',

    // --- Personen: Auswahl, Rechtsklick, Lernen ---
    'Alle Gesichter dieser Gruppe auswählen (dann Rechtsklick oder ziehen)': 'Select all faces of this group (then right-click or drag)',
    'Alle gemerkten Personen löschen': 'Delete all remembered people',
    'Alle nicht bestätigten Gesichter mit dem Wissen aus den bisher zugeordneten neu vergleichen': 'Compare all unconfirmed faces again using what was assigned so far',
    'Benannte Personen merken: sie werden dann auch in anderen Ordnern wiedererkannt (nur Merkmale, keine Bilder)': 'Remember named people: they are then recognised in other folders too (features only, no pictures)',
    'Diese Personen merken, damit sie auch in anderen Ordnern und später wiedererkannt werden?\n\n{0}\n\nGespeichert werden nur Gesichtsmerkmale (Zahlen, keine Bilder) und nur in diesem Browser. Je mehr bestätigte Gesichter, desto besser.':
      'Remember these people so they are recognised in other folders and later on?\n\n{0}\n\nOnly face features are stored (numbers, no pictures), and only in this browser. The more confirmed faces, the better.',
    'Erneut prüfen': 'Check again', 'Es sind keine Personen gemerkt.': 'No people are remembered.',
    'Gemerkte Personen löschen?\n\n{0}\n\nDie Namen in diesem Ordner bleiben erhalten.': 'Delete remembered people?\n\n{0}\n\nThe names in this folder are kept.',
    'Gemerkte Personen verwenden': 'Use remembered people', 'Gemerkte löschen': 'Forget people', 'Kein Gesicht (ausblenden)': 'Not a face (hide)', 'Lernen': 'Learning',
    'Mit „Personen merken“ gespeicherte Personen werden auch in anderen Ordnern wiedererkannt. Gespeichert werden nur Gesichtsmerkmale (Zahlen), keine Bilder – nur in diesem Browser.':
      'People saved with “Remember people” are recognised in other folders too. Only face features (numbers) are stored, no pictures – only in this browser.',
    'Name eintippen …': 'Type a name …', 'Namen zuweisen …': 'Assign name …',
    'Neue Person „{0}“': 'New person “{0}”', 'Noch keine Person mit bestätigten Gesichtern.': 'No person with confirmed faces yet.',
    'Noch keine Personen – Namen eintippen und Enter.': 'No people yet – type a name and press Enter.', 'Personen merken': 'Remember people',
    'Strg+Klick: auswählen · Umschalt+Klick: Bereich · auf freier Fläche ziehen: Rahmen · Rechtsklick: Namen zuweisen':
      'Ctrl+click: select · Shift+click: range · drag on empty space: frame · right-click: assign name',
    'Zuerst „Gesichter erkennen“.': 'Run “Detect faces” first.', '{0} Gesichter zuweisen an:': 'Assign {0} faces to:',
    '{0} Personen gemerkt.': '{0} people remembered.', '{0} gemerkt': '{0} remembered',
    'Ähnelt {0} ({1} %) – Klick ordnet die ganze Gruppe {0} zu': 'Looks like {0} ({1} %) – click assigns the whole group to {0}',

    // --- Gruppenpruefung, Auffaelligkeiten, Rueckgaengig, Zeitfenster ---
    '(+{0} weitere danach)': '(+{0} more afterwards)', 'Alle Auffälligkeiten durchgesehen.': 'All anomalies reviewed.',
    'Auffälligkeit {0} von {1}': 'Anomaly {0} of {1}', 'Auffälligkeiten prüfen': 'Review anomalies',
    'Automatisch zugeordnet wird nur, wenn ein Gesicht bestätigten Gesichtern der Person aus dieser Zeit ähnelt. So werden zwei Babys, die Jahre auseinander liegen, nicht vermischt. Gruppen mit größeren Zeitlücken werden geteilt – einmal Enter bei „Schnell zuordnen“ fügt sie wieder zusammen.':
      'A face is only assigned automatically if it resembles confirmed faces of the person from that time. This keeps two babies born years apart from being mixed up. Groups with larger time gaps are split – one Enter in “Quick assign” joins them again.',
    'Automatisch zugeordnet. Falsche anklicken, dann Enter.': 'Assigned automatically. Click the wrong ones, then Enter.',
    'Ebenfalls als {0} zugeordnet': 'Also assigned as {0}',
    'Enter = bleibt · 1–9 = andere Person · Name tippen = neue Person · Entf = fremd · 0 = weiß nicht · → überspringen · ← rückgängig · Esc beenden':
      'Enter = keep · 1–9 = other person · type a name = new person · Del = stranger · 0 = don’t know · → skip · ← undo · Esc quit',
    'Falsche Gesichter anklicken (abwählen), dann Namen wählen.': 'Click wrong faces (deselect), then choose a name.',
    'Falsche Gesichter anklicken · Enter = Vorschlag · 1–9 = andere Person · Name tippen = neue Person · Entf = fremd · → überspringen · ← rückgängig · Esc beenden':
      'Click wrong faces · Enter = suggestion · 1–9 = other person · type a name = new person · Del = stranger · → skip · ← undo · Esc quit',
    'Fertig – keine offenen Gruppen mehr.': 'Done – no open groups left.', 'Fotos ansehen': 'View photos', 'Ja, bleibt {0}': 'Yes, stays {0}',
    'Klick: falsch / richtig': 'Click: wrong / right', 'Letzte Zuordnung rückgängig machen (Strg+Z)': 'Undo the last assignment (Ctrl+Z)',
    'Neu geprüft mit {0} bekannten Personen: {1} Gesichter neu zugeordnet (zum Prüfen), {2} Gruppen mit Namensvorschlag, {3} Auffälligkeiten.':
      'Checked again with {0} known people: {1} faces newly assigned (to review), {2} groups with a name suggestion, {3} anomalies.',
    'Nichts zum Rückgängigmachen.': 'Nothing to undo.', 'Passt besser zu {0} ({1} % statt {2} %).': 'Fits {0} better ({1} % instead of {2} %).',
    'Rückgängig': 'Undo', 'Rückgängig (← oder Strg+Z)': 'Undo (← or Ctrl+Z)', 'Rückgängig: {0} Gesichter': 'Undone: {0} faces',
    'Sind das alle {0}?': 'Are these all {0}?', 'Weiß nicht': 'Don’t know', 'Zeitfenster für Kinder (Monate, 0 = aus)': 'Time window for children (months, 0 = off)',
    '{0} Auffälligkeiten gefunden (Person zweimal auf einem Foto oder Gesicht passt besser zu einer anderen Person). Jetzt durchgehen?':
      '{0} anomalies found (a person twice in one photo or a face that fits another person better). Review them now?',
    '{0} beantwortet · {1} bestätigt · {2} automatisch zugeordnet · {3} noch ohne Namen': '{0} answered · {1} confirmed · {2} assigned automatically · {3} still without a name',
    '{0} ist auf diesem Foto mehrmals zugeordnet – das geht nicht.': '{0} is assigned more than once in this photo – that is not possible.',
    '{0} von {1} ausgewählt': '{0} of {1} selected',

    // --- Schnell zuordnen ---
    'Am schnellsten: <b>Schnell zuordnen</b> zeigt jede offene Gruppe – falsche Gesichter anklicken, Enter übernimmt den Vorschlag. Nach jeder Antwort wird neu gerechnet.':
      'Fastest: <b>Quick assign</b> shows every open group – click wrong faces, Enter takes the suggestion. It recalculates after every answer.',
    'Verdrückt? Rückgängig mit Strg+Z.': 'Misclicked? Undo with Ctrl+Z.',
    'Anderer Name … (Enter)': 'Other name … (Enter)',
    'Ein Gesicht nach dem anderen: „Wer ist das?“ mit Vorschlag – ähnliche werden nach jeder Antwort automatisch mit zugeordnet':
      'One face after another: “Who is this?” with a suggestion – similar ones are assigned automatically after every answer',
    'Entf': 'Del', 'Fremd / kein Gesicht': 'Stranger / not a face',
    'Fremde Person oder kein Gesicht – wird nicht mehr gefragt': 'Stranger or not a face – will not be asked again', 'Ganzes Foto': 'Whole photo',
    'Ist das {0}?': 'Is this {0}?', 'Ja, {0}': 'Yes, {0}', 'Schnell zuordnen': 'Quick assign', 'Wer ist das?': 'Who is this?',
    'Übersprungene kommen beim nächsten Öffnen wieder.': 'Skipped ones come back the next time you open it.',

    // --- Fotoübersicht (_fotos.html) ---
    '_fotos': '_photos', 'Fotoübersicht': 'Photo overview', 'Alle Ereignisse': 'All events', 'Alle Personen': 'All people',
    'Ohne Ereignis': 'No event', '{0} Fotos im Kartenausschnitt': '{0} photos in the map area', 'Ohne Kartenhintergrund': 'No map background',
    'Datei öffnen': 'Open file', 'Nur die ersten {0} – näher hineinzoomen.': 'Only the first {0} – zoom in closer.',
    'Erstellt mit Sort My Pictures am {0}': 'Created with Sort My Pictures on {0}',
    'Ordner': 'Folders', '{0} Dateien': '{0} files', 'Verweist auf die Originale – nichts wurde kopiert.': 'Links to the originals – nothing was copied.',
    'Datei nicht gefunden – wurde das Original verschoben oder gelöscht?': 'File not found – was the original moved or deleted?',
    'Im Ziel entsteht ein Protokoll <i>_protokoll_….csv</i> und eine Fotoübersicht <i>_fotos.html</i> (Karte + Ordner) zum Suchen nach Standort.':
      'A log <i>_log_….csv</i> and a photo overview <i>_photos.html</i> (map + folders) for searching by location are written to the target.',
    '<b>Verzeichnis ohne Kopieren</b> schreibt nur die Fotoübersicht mit Links auf die Originale – kein Speicherplatz doppelt belegt.':
      '<b>Index without copying</b> writes only the photo overview with links to the originals – no storage used twice.',
    'Fotoübersicht ins Ziel schreiben': 'Write a photo overview to the target',
    'Nach dem Kopieren entsteht im Ziel _fotos.html: Karte und Ordner zum Durchsuchen, auch offline und ohne dieses Programm. Vorschaubilder kommen in den Ordner _fotos.':
      'After copying, _photos.html is created in the target: map and folders to browse, also offline and without this program. Thumbnails go into the folder _photos.',
    'Fotoübersicht (_fotos.html)': 'Photo overview (_photos.html)', 'Übersicht speichern': 'Save overview',
    'Fotoübersicht (Karte + Ordner) mit den kopierten Fotos ins Ziel schreiben, ohne erneut zu kopieren': 'Write the photo overview (map + folders) of the copied photos to the target without copying again',
    'Verzeichnis ohne Kopieren': 'Index without copying', 'Nur Links': 'Links only',
    'Nichts kopieren: nur eine Fotoübersicht (Karte + Ordner) schreiben, die direkt auf die Originale verlinkt': 'Copy nothing: only write a photo overview (map + folders) that links directly to the originals',
    'Der gewählte Ordner liegt nicht neben der Quelle „{0}“.\nDamit die Links funktionieren, bitte den vollständigen Pfad der Quelle eingeben (aus der Adresszeile des Explorers kopieren):':
      'The chosen folder is not next to the source “{0}”.\nFor the links to work, please enter the full path of the source (copy it from the Explorer address bar):',
    'Schreibe Fotoübersicht … {0} / {1} Vorschaubilder': 'Writing photo overview … {0} / {1} thumbnails',
    'Fotoübersicht gespeichert: „{0}“ in „{1}“ ({2} Dateien, {3} mit Standort) – per Doppelklick öffnen.': 'Photo overview saved: “{0}” in “{1}” ({2} files, {3} with location) – open it with a double-click.',
    'Fotoübersicht konnte nicht geschrieben werden: {0}': 'The photo overview could not be written: {0}',

    // --- Bildansicht ---
    'Vorheriges (←)': 'Previous (←)', 'Nächstes (→)': 'Next (→)', 'Schließen (Esc)': 'Close (Esc)', 'Alle Metadaten': 'All metadata',
'Nicht lesbar: {0}': 'Not readable: {0}', 'Keine Vorschau für dieses Format': 'No preview for this format',
    'Pfad': 'Path', 'Größe': 'Size', 'Aufnahme': 'Taken', 'Kamera': 'Camera', 'Standort': 'Location', '{0} km von zu Hause': '{0} km from home', 'kein GPS': 'no GPS',
    '{0} Gesicht(er), unbenannt': '{0} face(s), unnamed', 'wird nicht kopiert (Filter/Duplikat)': 'not copied (filter/duplicate)', 'Ereignis öffnen': 'Open event',
    'Lese …': 'Reading …', 'Videos: nur Datum und GPS werden ausgelesen.': 'Videos: only date and GPS are read.', 'Keine Metadaten gefunden.': 'No metadata found.',
    '[{0} Bytes]': '[{0} bytes]', '[{0} Werte]': '[{0} values]', '… ({0} Zeichen)': '… ({0} characters)',

'Bilder': 'Pictures',

    // --- Einstellungen: Abschnitte ---
    'Ordner & Dateinamen': 'Folders & file names', 'Wohnort': 'Home', 'Alltagsorte': 'Everyday places', 'Bilder ohne GPS': 'Pictures without GPS', 'Karte': 'Map',
    // Ribbon-Haekchen
    'Unterordner': 'Subfolders', 'Videos': 'Videos', 'Ortsnamen (OSM)': 'Place names (OSM)', 'Wohnort automatisch': 'Home automatic',
    'Alltagsorte automatisch': 'Everyday places automatic', 'Personenordner anlegen': 'Create people folders', 'Endung klein': 'Lower-case extension',
    'Duplikate überspringen': 'Skip duplicates',
    // Filter
    'Von Datum': 'From date', 'Bis Datum': 'To date', 'Uhrzeit von': 'Time from', 'Uhrzeit bis': 'Time to',
    'Leer = ganzer Tag. „von“ später als „bis“ geht über Mitternacht (z.B. 20:00–06:00).': 'Empty = whole day. “From” later than “to” spans midnight (e.g. 20:00–06:00).',
    'Mo': 'Mon', 'Di': 'Tue', 'Mi': 'Wed', 'Do': 'Thu', 'Fr': 'Fri', 'Sa': 'Sat', 'So': 'Sun',
    'Dateiart': 'File type', 'Fotos und Videos': 'Photos and videos', 'nur Fotos': 'photos only', 'nur Videos': 'videos only',
    'alle': 'all', 'nur mit GPS': 'with GPS only', 'nur ohne GPS': 'without GPS only', 'Zone-Bedingung': 'Zone condition',
    'nur innerhalb der Zone': 'only inside the zone', 'nur außerhalb der Zone': 'only outside the zone', 'Kamera enthält': 'Camera contains',
    'Personen (kommagetrennt)': 'People (comma-separated)',
    'Nur Bilder, auf denen mindestens eine dieser Personen erkannt wurde (Tab „Personen“).': 'Only pictures on which at least one of these people was recognised (tab “People”).',
    // Quelle
    'Unterordner einbeziehen': 'Include subfolders', 'Fotos (jpg, heic, png, dng …)': 'Photos (jpg, heic, png, dng …)', 'Videos (mp4, mov …)': 'Videos (mp4, mov …)',
    'Dateinamen in UTC (Präfixe)': 'File names in UTC (prefixes)',
    'Kommagetrennt. Google-Pixel-Dateinamen (PXL_) enthalten UTC-Zeit statt Ortszeit.': 'Comma-separated. Google Pixel file names (PXL_) contain UTC instead of local time.',
    'Videos: Datum aus Dateiname bevorzugen': 'Videos: prefer the date from the file name',
    'Viele Handys speichern im Video die Zeit ungenau. Fotos nutzen immer zuerst EXIF.': 'Many phones store an inaccurate time in videos. Photos always use EXIF first.',
    // Ordner & Dateinamen
    'Sprache Monatsnamen': 'Language of month names', 'Deutsch (Jänner)': 'German (Jänner)', 'Deutsch (Januar)': 'German (Januar)',
    'Monatsordner anlegen': 'Create month folders',
    'Platzhalter: {YYYY} {YY} {MM} {MMMM} {DD} {WT} {TYP}. "/" trennt Ordner.': 'Placeholders: {YYYY} {YY} {MM} {MMMM} {DD} {DOW} {TYPE}. "/" separates folders.',
    'Platzhalter: {YYYY} {MM} {DD} {WT} {hh} {mm} {ss} {NAME} (Originalname) {KAMERA}. Endung kommt automatisch, bei gleichen Namen _2, _3 …':
      'Placeholders: {YYYY} {MM} {DD} {DOW} {hh} {mm} {ss} {NAME} (original name) {CAMERA}. The extension is added automatically, duplicates get _2, _3 …',
    'Urlaubs-/Ausflugsordner': 'Holiday/trip folder',
    'Zusätzlich: {KAT} Kategorie, {ORT} Ortsname, {KOORD} Koordinaten, {EDD} {EMM} Enddatum, {TAGE}, {ANZ} Anzahl Bilder.':
      'Also: {CAT} category, {PLACE} place name, {COORD} coordinates, {EDD} {EMM} end date, {DAYS}, {COUNT} number of pictures.',
    'Dateiendung klein schreiben': 'Lower-case file extension', 'Wort für {TYP} bei Fotos': 'Word for {TYPE} for photos', 'Wort für {TYP} bei Videos': 'Word for {TYPE} for videos',
    'Gleiche Dateigröße und gleiches Aufnahmedatum gilt als Duplikat.': 'Same file size and same date taken counts as a duplicate.',
    // Wohnort, Alltagsorte
    'Automatisch erkennen': 'Detect automatically',
    'Ort mit den meisten Aufnahmetagen. Wird ignoriert, sobald auf der Karte eine Zone „Zuhause“ existiert.': 'Place with the most days with pictures. Ignored as soon as a “Home” zone exists on the map.',
    'Umkreis zu Hause (km)': 'Radius around home (km)', 'Alles weiter weg zählt als unterwegs (Ausflug).': 'Anything farther away counts as being out (day trip).',
    'Automatisch erkennen (Arbeit, Familie …)': 'Detect automatically (work, family …)',
    'Orte in der Nähe, die sehr oft vorkommen, gelten nicht als Ausflug.': 'Nearby places that occur very often do not count as day trips.',
    'ab wie vielen Tagen': 'from how many days', 'Radius (km)': 'Radius (km)',
    // Urlaub, Ausflug, Dienstreise
    'Urlaube erkennen': 'Detect holidays', 'Mindestentfernung (km)': 'Minimum distance (km)', 'Mindestdauer (Tage)': 'Minimum duration (days)',
    'Erlaubte Tage ohne Bilder': 'Allowed days without pictures',
    'Tage ohne Fotos innerhalb eines Urlaubs – aber nur, wenn an diesen Tagen kein Foto nahe zu Hause entstand.': 'Days without photos within a holiday – but only if no photo was taken near home on those days.',
    'Ausflüge erkennen': 'Detect day trips', 'Ein Tag mit mehreren Bildern außerhalb des Umkreises zu Hause.': 'A day with several pictures outside the radius around home.',
    'Dienstreisen erkennen': 'Detect business trips',
    'Fahrten in eine Zone „Dienstort“ sind immer Dienstreisen. Zusätzlich die Regel unten.': 'Trips into a “Work place” zone are always business trips. Plus the rule below.',
    'Regel für mehrtägige Fahrten': 'Rule for trips of several days', '… nur Werktage (kein Sa/So)': '… workdays only (no Sat/Sun)',
    '… weniger Bilder pro Tag als': '… fewer pictures per day than', 'Einzeltage (Mo–Fr) am selben Ort auch': 'Also single days (Mon–Fri) at the same place',
    'Im Zeitraum eines Ereignisses mitnehmen': 'Include them within the period of an event',
    'Z.B. Videos oder Screenshots ohne Standort, die zwischen dem ersten und letzten Urlaubsfoto entstanden.': 'E.g. videos or screenshots without location taken between the first and last holiday photo.',
    // Personen
    'Kopiert jedes Foto zusätzlich in den Ordner jeder benannten Person darauf. Gesichtserkennung läuft lokal (Tab „Personen“).':
      'Additionally copies each photo into the folder of every named person on it. Face recognition runs locally (tab “People”).',
    'Personenordner': 'People folder', 'Zusätzlich {PERSON}.': 'Also {PERSON}.',
    'Ähnlichkeit (0.4 streng – 0.6 locker)': 'Similarity (0.4 strict – 0.6 loose)',
    'Wie verschieden zwei Gesichter derselben Person sein dürfen. Werden Personen vermischt: kleiner. Wird eine Person auf viele Gruppen verteilt: größer.':
      'How different two faces of the same person may be. If people get mixed up: smaller. If one person is spread over many groups: larger.',
    'Mindestgröße Gesicht (Pixel)': 'Minimum face size (pixels)',
    'Kleinere Gesichter (Hintergrund) werden ignoriert. Gilt für neu analysierte Fotos.': 'Smaller faces (background) are ignored. Applies to newly analysed photos.',
    'Gruppen zeigen ab Gesichtern': 'Show groups from faces',
    // Ortsnamen, Karte
    'Ortsnamen von OpenStreetMap': 'Place names from OpenStreetMap',
    'Holt fehlende Ortsnamen beim Einschalten und nach jedem Einlesen: sendet pro Ereignis einen Koordinatenpunkt an nominatim.openstreetmap.org (höchstens einen pro Sekunde). Ergebnisse werden lokal gespeichert. Aus: Koordinaten bzw. Namen von Zonen.':
      'Fetches missing place names when switched on and after every scan: sends one coordinate point per event to nominatim.openstreetmap.org (at most one per second). Results are stored locally. Off: coordinates or zone names.',
    'Genauigkeit': 'Precision', 'Bundesland': 'State', 'Bezirk': 'District', 'Stadt / Gemeinde': 'Town / municipality', 'Ortsteil': 'Neighbourhood',
    'Sprache': 'Language', 'Heimatland (ohne Land im Namen)': 'Home country (no country in the name)',
    'So geschrieben, wie OpenStreetMap das Land in der gewählten Sprache nennt.': 'Spelled the way OpenStreetMap names the country in the chosen language.',
    'Ortsname im Ausland': 'Place name abroad', 'Ortsname im Heimatland': 'Place name in the home country', '{LAND} {REGION} {STADT}': '{COUNTRY} {REGION} {TOWN}',
    'Lädt Kartenkacheln aus dem Internet. Aus: nur Punkte auf leerem Hintergrund.': 'Loads map tiles from the internet. Off: only points on an empty background.',
    'Kartenquelle': 'Map source', 'Automatisch': 'Automatic', 'OpenStreetMap': 'OpenStreetMap',
    'Straßenkarte (Esri)': 'Street map (Esri)', 'Satellit (Esri)': 'Satellite (Esri)', 'Gelände (OpenTopoMap)': 'Terrain (OpenTopoMap)',
    'Automatisch: OpenStreetMap auf der Webseite, Esri-Straßenkarte, wenn die Datei direkt geöffnet ist (OpenStreetMap sperrt dort die Kacheln).':
      'Automatic: OpenStreetMap on the website, Esri street map when the file is opened directly (OpenStreetMap blocks the tiles there).',
    // Sonderordner
    'Regeln „Muster => Ordner“': 'Rules “pattern => folder”', 'Eine Regel pro Zeile, Muster im Dateinamen (Text oder /RegEx/).': 'One rule per line, pattern in the file name (text or /RegEx/).',
    'Zusätzlich {REGEL} = Ordner der Regel.': 'Also {RULE} = folder of the rule.', 'Nicht zusätzlich im Monatsordner': 'Not additionally in the month folder',
  };

  const KEY = 'fotosortierer.lang';
  let lang = '';
  try { lang = localStorage.getItem(KEY) || ''; } catch { /* kein Speicher */ }
  if (lang !== 'de' && lang !== 'en') lang = /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
  const missing = new Set();  // fuer Tests: fehlende Uebersetzungen

  // Leerzeichen am Anfang/Ende bleiben erhalten, nachgeschlagen wird der Text dazwischen
  function lookup(s, record) {
    if (lang !== 'en' || !s) return s;
    const [, pre, core, post] = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (core in EN) return pre + EN[core] + post;
    if (record && /[A-Za-zÄÖÜäöü]/.test(core)) missing.add(core);
    return s;
  }
  function T(s, ...args) {
    const r = lookup(s, true);
    return args.length ? String(r).replace(/\{(\d)\}/g, (_, i) => args[i]) : r;
  }

  const orig = new WeakMap();  // Knoten -> deutscher Originaltext
  function translateDom(root) {
    for (const el of root.querySelectorAll('[data-i18n-html]')) {
      // wie im Quelltext schreiben (der Browser macht aus <use …/> ein <use …></use>)
      if (!orig.has(el)) orig.set(el, el.innerHTML.trim().replace(/<use([^>]*)><\/use>/g, '<use$1/>'));
      el.innerHTML = lookup(orig.get(el));
    }
    const skip = '[data-noi18n],[data-i18n-html],script,style,svg';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n; (n = walker.nextNode());) {
      if (!orig.has(n)) orig.set(n, n.nodeValue);
      const de = orig.get(n), t = de.trim();
      if (t && /[A-Za-zÄÖÜäöü]/.test(t)) n.nodeValue = de.replace(t, lookup(t));
    }
    for (const el of root.querySelectorAll('[title],[placeholder]')) {
      if (el.closest('[data-noi18n]')) continue;
      let o = orig.get(el);
      if (!o) orig.set(el, o = { title: el.getAttribute('title'), placeholder: el.getAttribute('placeholder') });
      if (o.title) el.title = lookup(o.title);
      if (o.placeholder) el.placeholder = lookup(o.placeholder);
    }
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* kein Speicher */ }
    document.documentElement.lang = l;
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;

  return { T, EN, translateDom, setLang, missing, get lang() { return lang; } };
})();
const T = I18n.T;
