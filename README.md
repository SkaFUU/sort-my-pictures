# Fotosortierer

Sortiert Fotos und Videos lokal in eine Ordnerstruktur nach Jahr und Monat. Zusätzlich erkennt es anhand der GPS-Daten Urlaube, Ausflüge und Dienstreisen. Es ist eine einzige HTML-Datei, die ohne Installation im Browser läuft.

```
Ziel/
  2023/
    06_Juni/21_14-32-08.jpg                        ← alle Bilder und Videos
    Urlaube/06_Juni_Italien_Caorle/20_10-32-32.jpg  ← zusätzlich als Kopie
    Ausflüge/05_Mai_Wien/…
    Dienstreisen/01_Jänner_Seekirchen am Wallersee/…
  _protokoll_2026-11-04_12-00-00.csv
```

## Benutzung

Öffne `fotosortierer.html` in **Chrome, Edge, Brave oder Opera**. Firefox und Safari können keine lokalen Ordner schreiben.

Die Oberfläche führt Schritt für Schritt durch die Register von links nach rechts:

- Jedes Register hat oben ein Ribbon mit den Aktionen und rechts eine Seitenleiste mit den zugehörigen Einstellungen.
- **Weiter** führt zum nächsten Schritt.
- Erledigte Schritte bekommen ein ✓.

1. **Quelle:** Wähle einen Ordner oder **Handy (USB)** und klicke auf **Einlesen**. Aufnahmedatum und GPS kommen aus EXIF bzw. aus den MP4/MOV-Metadaten.
2. **Orte:** Lege auf der Karte Zonen an (Zuhause, Alltagsort, Dienstort, Benannter Ort). Optional holst du dir hier Ortsnamen und den Kartenhintergrund von OpenStreetMap (🌐).
3. **Ereignisse:** Ändere Art und Ortsname je Ereignis. Ein Klick auf eine Zeile zeigt die Bilder, dort lassen sich einzelne Bilder herausnehmen. Hier legst du auch **eigene Kategorien** an (siehe unten).
4. **Prüfen:** Klicke die Ereignisse nacheinander durch, die unsicheren zuerst. Mit den Tasten `1`–`4` wählst du Urlaub, Ausflug, Dienstreise oder keinen Ordner, `5`–`9` deine eigenen Kategorien. `Enter` übernimmt den Vorschlag, `←`/`→` blättert.
5. **Personen** (optional): Lass die Gesichter erkennen und benenne die Gruppen (gleicher Name = zusammenführen). **Prüfen** bei einer Person zeigt die automatisch zugeordneten Gesichter, die unsichersten zuerst: ✓ bestätigt, ✕ entfernt Fehltreffer.
6. **Ziel & Kopieren:** Lege Ordnerstruktur, Dateinamen und Filter fest und prüfe den Ordnerbaum. Dann wählst du das **Ziel** und klickst **Kopieren**.

Oben rechts schaltest du mit **DE | EN** die Sprache um (wie im AOG Feldeditor). Beim ersten Start richtet sie sich nach dem Browser. Ordnernamen, die du nicht geändert hast, werden mit umgestellt (Urlaube → Holidays).

## Eigene Kategorien

Neben Urlaub, Ausflug und Dienstreise kannst du eigene Kategorien mit eigenen Regeln und eigenem Ordner anlegen: **3 Ereignisse → Neue Kategorie** oder in der Seitenleiste unter **Eigene Kategorien**, auch aus Vorlagen (Fernreise, Wochenendtrip, Skiurlaub, Sommerurlaub, Wanderungen).

Eine Kategorie übernimmt erkannte Ereignisse, die zu allen ihren Bedingungen passen. Leere Felder bedeuten „egal“.

| Bedingung | Beispiel |
|---|---|
| Gilt für | nur Urlaube, nur Ausflüge, nur Dienstreisen oder alle |
| Entfernung von zu Hause | ab 800 km |
| Dauer | 2–3 Tage |
| Mindestens Bilder | 20 |
| Wochentage | mit Wochenende, nur am Wochenende, nur Werktage |
| Monate | Dezember–März |
| Zone | in einer Zone von der Karte |
| Ort enthält | „Italien“ |
| Personen | auf den Fotos ist „Anna“ |

Die Reihenfolge der Liste zählt: Die erste passende Kategorie gewinnt, mit ▲▼ verschiebst du sie. Im Ordner-Muster steht die Kategorie als `{KAT}`, ihre Farbe erscheint auf der Karte.

## Direkt vom Handy (USB)

Mit **📱 Handy** liest der Fotosortierer Fotos direkt von einem Android-Handy, ohne sie vorher auf den PC zu übertragen. Die Verbindung läuft über ADB per WebUSB (ya-webadb). Das ist lokal zwischen Browser und Handy, es geht nichts ins Internet. Auf dem Handy wird nichts verändert, es wird nur gelesen.

1. Am Handy die Entwickleroptionen freischalten: **Einstellungen → Über das Telefon** → 7× auf **Build-Nummer** tippen.
2. **Einstellungen → System → Entwickleroptionen → USB-Debugging** einschalten.
3. Das Handy anstecken, **📱 Handy → Verbinden** klicken, das Gerät auswählen und am Handy „USB-Debugging zulassen?“ bestätigen.
4. Einen Ordner wählen, z. B. **Kamera** (`DCIM/Camera`) oder WhatsApp.

Für die Metadaten wird nur der Anfang jeder Datei gelesen, das geht schnell. Die Gesichtserkennung, die Bildansicht und das Kopieren holen die ganze Datei. Versteckte Dateien und der Android-Papierkorb (`.trashed-…`) werden übersprungen.

- Wenn adb, Android Studio oder scrcpy läuft, ist das Gerät belegt. Dann vorher `adb kill-server` ausführen.
- iPhones werden nicht unterstützt, und über WLAN geht es nicht, weil Browser keine direkten Netzwerkverbindungen erlauben.
- Nach dem Sortieren am besten USB-Debugging wieder ausschalten.

Ein Klick auf ein Bild (Vorschaubild, Kartenpunkt, Datei im Ordnerbaum) öffnet die **Bildansicht**. Sie zeigt das große Bild mit Gesichtsrahmen, Infos, Zielpfaden, eine Mini-Karte und alle Metadaten. `←`/`→` blättert, `Esc` schließt.

Mit dem **Filter** (oben in den Einstellungen) wird nur ein Teil sortiert: nach Zeitraum, Uhrzeit (auch über Mitternacht), Wochentagen, Foto/Video, GPS, Zone, Kamera oder Personen.

## Gesichtserkennung

Sie läuft komplett lokal im Browser, mit ONNX Runtime Web und zwei Modellen aus dem OpenCV Model Zoo:

- **YuNet** (MIT) findet die Gesichter und fünf Merkpunkte (Augen, Nase, Mundwinkel). Damit wird jedes Gesicht gerade ausgerichtet.
- **SFace** (Apache 2.0) berechnet daraus 128 Merkmale zum Wiedererkennen.

Laufzeit und Modelle sind in der HTML-Datei eingebettet, deshalb ist sie ca. 19 MB groß. Es wird nichts nachgeladen.

- Die Erkennung läuft in mehreren Web Workern gleichzeitig, einer je Prozessorkern. Auf einem 6-Kern-Rechner sind es etwa 0,04 s pro Foto, bei 5000 Fotos also 3–4 Minuten.
- Der Lauf kann jederzeit abgebrochen werden. Ein neuer Start setzt dort fort, und die Ergebnisse bleiben im Browser gespeichert.
- Benannte Gesichter bilden feste Gruppen. Neue Gesichter werden der ähnlichsten Gruppe zugeordnet (gestrichelt = automatisch). Gute, frontale Gesichter werden zuerst eingeordnet, danach wird in zwei Runden nachsortiert.
- Die „Ähnlichkeit“ in den Einstellungen steuert, wie streng gruppiert wird. Werden Personen vermischt, stellst du einen kleineren Wert ein. Wird eine Person auf viele Gruppen verteilt, einen größeren.
- Kleine Kinder, die sich über die Jahre stark verändern, werden auch mit diesem Modell oft vermischt.
- Ergebnisse der früheren Erkennung (face-api) werden nicht weiterverwendet. Beim neuen Lauf werden vergebene Namen auf die Gesichter an derselben Stelle übertragen.

Die Originale werden nur gelesen. Vorhandene Dateien im Ziel werden nie überschrieben, ein zweiter Lauf überspringt sie. Einstellungen, Zonen und Änderungen bleiben im Browser gespeichert und lassen sich als JSON exportieren.

## Lokal und online

Standardmäßig läuft alles **offline**. Zwei Funktionen nutzen das Internet. Sie sind in der Oberfläche mit 🌐 gekennzeichnet und standardmäßig aus:

| Funktion | Dienst | Was gesendet wird |
|---|---|---|
| Ortsnamen | nominatim.openstreetmap.org | ein Koordinatenpunkt pro Ereignis (max. 1/s, Ergebnis wird lokal gespeichert) |
| Kartenhintergrund | tile.openstreetmap.org | Kartenausschnitt (welche Kacheln angezeigt werden) |

Ohne Ortsnamen bekommen Ordner die Koordinaten (`47.39N_13.72E`) oder den Namen einer Zone. Zonen vom Typ „Benannter Ort“ sind damit eine reine Offline-Alternative.

## Erkennung

- **Wohnort:** Ort mit den meisten Aufnahmetagen, oder Zonen vom Typ „Zuhause“.
- **Alltagsorte:** Orte in der Nähe, die an vielen Tagen vorkommen (Arbeit, Familie). Sie zählen nie als Ausflug.
- **Urlaub:** zusammenhängende Tage weiter weg als die Mindestentfernung. Lücken ohne Fotos sind erlaubt, solange an diesen Tagen kein Foto nahe zu Hause entstand.
- **Ausflug:** ein Tag mit mindestens N Bildern außerhalb des Umkreises von zu Hause.
- **Dienstreise:** Fahrt in eine Zone „Dienstort“, oder mehrtägige Fahrt nur an Werktagen mit wenigen Bildern pro Tag. Einzeltage am selben Ort zählen auch.

## Entwicklung

```
src/index.html        Oberfläche
src/js/*.js           Logik (metadata, analyze, plan, copy, map, app …)
src/js/i18n.js        Sprache: Texte stehen deutsch im Code (T('…')), englische Übersetzungen hier
src/vendor/           Leaflet (BSD-2), exifr (MIT), onnxruntime-web (MIT), YuNet (MIT), SFace (Apache 2.0), ya-webadb (MIT), eingebettet
tools/adb-entry.js    Einstieg für das ADB-Bundle (esbuild -> src/vendor/webadb.js)
tools/build-single.js baut dist/fotosortierer.html (alles in einer Datei)
tools/vendor.js       aktualisiert src/vendor aus node_modules, lädt die Gesichtsmodelle einmal aus dem OpenCV Model Zoo
tools/i18n-check.js   prüft, ob jeder deutsche Text eine englische Übersetzung hat
```

```
npm install          # nur zum Aktualisieren der Bibliotheken nötig
npm run vendor       # src/vendor neu erzeugen
node tools/i18n-check.js
npm run build        # -> dist/fotosortierer.html
```

`src/index.html` lässt sich zum Entwickeln auch direkt öffnen.
