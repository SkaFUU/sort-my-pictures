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

1. `fotosortierer.html` in **Chrome, Edge, Brave oder Opera** öffnen. Firefox und Safari können keine lokalen Ordner schreiben.
2. **Quelle** wählen. Die Dateien werden eingelesen: Aufnahmedatum und GPS aus EXIF bzw. aus den MP4/MOV-Metadaten.
3. In den Einstellungen links Parameter anpassen. Die Vorschau aktualisiert sich sofort.
4. **Karte**: Zonen anlegen (Zuhause, Alltagsort, Dienstort, Benannter Ort).
5. **Ereignisse**: Art und Ortsname je Ereignis ändern. Mit 🖼 lassen sich einzelne Bilder aus einem Ereignis herausnehmen.
6. **Vorschau**: Den Ordnerbaum mit den endgültigen Dateinamen prüfen.
7. **Ziel** wählen und **Kopieren** klicken.

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
src/vendor/           Leaflet (BSD-2) und exifr (MIT), eingebettet
tools/build-single.js baut dist/fotosortierer.html (alles in einer Datei)
tools/vendor.js       aktualisiert src/vendor aus node_modules
```

```
npm install          # nur zum Aktualisieren der Bibliotheken nötig
npm run build        # -> dist/fotosortierer.html
```

`src/index.html` lässt sich zum Entwickeln auch direkt öffnen.
