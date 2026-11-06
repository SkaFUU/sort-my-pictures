# Sort My Pictures

[English](README.md) | **Deutsch**

**➜ Direkt im Browser öffnen: https://skafuu.github.io/sort-my-pictures/**

Sortiert Fotos und Videos lokal in eine Ordnerstruktur nach Jahr und Monat. Zusätzlich erkennt es anhand der GPS-Daten Urlaube, Ausflüge, Dienstreisen und eigene Kategorien. Es ist eine einzige HTML-Datei und läuft ohne Installation im Browser. Die Fotos verlassen dabei nie deinen Rechner.

```
Ziel/
  2023/
    06_Juni/21_14-32-08.jpg                        ← alle Bilder und Videos
    Urlaube/06_Juni_Italien_Lignano/20_10-32-32.jpg ← zusätzlich als Kopie
    Ausflüge/05_Mai_Wien/…
    Dienstreisen/01_Jänner_Linz/…
    Personen/Anna/…                                ← optional, per Gesichtserkennung
  _fotos.html                                      ← Fotoübersicht: Karte + Ordner zum Suchen
  _protokoll_2026-11-04_12-00-00.csv
```

## Benutzung

Öffne **https://skafuu.github.io/sort-my-pictures/** in **Chrome, Edge, Brave oder Opera**. Firefox und Safari können keine lokalen Ordner schreiben.

- Die Seite wird nur geladen. Ordner, Fotos und Ergebnisse bleiben auf deinem Rechner, es wird nichts hochgeladen.
- Für die Benutzung ohne Internet: [sort-my-pictures.html](https://skafuu.github.io/sort-my-pictures/sort-my-pictures.html) herunterladen (Rechtsklick → Speichern unter) und per Doppelklick öffnen.

Die Oberfläche führt Schritt für Schritt durch die Register von links nach rechts:

- Jedes Register hat oben ein Ribbon mit den Aktionen und rechts eine Seitenleiste mit den zugehörigen Einstellungen.
- **Weiter** führt zum nächsten Schritt.
- Erledigte Schritte bekommen ein ✓.

1. **Quelle:** Wähle einen Ordner (auch Netzlaufwerk) und klicke auf **Einlesen**. Fotos vom Handy vorher auf den PC kopieren, z. B. per USB-Kabel im Explorer. Aufnahmedatum und GPS kommen aus EXIF bzw. aus den MP4/MOV-Metadaten.
2. **Orte:** Lege auf der Karte Zonen an (Zuhause, Alltagsort, Dienstort, Benannter Ort). Optional holst du dir hier Ortsnamen und den Kartenhintergrund von OpenStreetMap (🌐).
3. **Ereignisse:** Ändere Art und Ortsname je Ereignis. Ein Klick auf eine Zeile zeigt die Bilder, dort lassen sich einzelne Bilder herausnehmen. Hier legst du auch **eigene Kategorien** an (siehe unten).
4. **Prüfen:** Klicke die Ereignisse nacheinander durch, die unsicheren zuerst. Mit den Tasten `1`–`4` wählst du Urlaub, Ausflug, Dienstreise oder keinen Ordner, `5`–`9` deine eigenen Kategorien. `Enter` übernimmt den Vorschlag, `←`/`→` blättert. **Neu prüfen** markiert alles wieder als ungeprüft (die Auswahl bleibt als Vorschlag), mit Rückfrage.
5. **Personen** (optional): Lass die Gesichter erkennen und benenne die Gruppen, siehe [Gesichtserkennung](#gesichtserkennung).
6. **Ziel & Kopieren:** Lege Ordnerstruktur, Dateinamen und Filter fest und prüfe den Ordnerbaum. Dann wählst du das **Ziel** und klickst **Kopieren**.

Oben rechts schaltest du mit **DE | EN** die Sprache um. Beim ersten Start richtet sie sich nach dem Browser. Ordnernamen, die du nicht geändert hast, werden mit umgestellt (Urlaube → Holidays).

Ein Klick auf ein Bild (Vorschaubild, Kartenpunkt, Datei im Ordnerbaum) öffnet die **Bildansicht**. Sie zeigt das große Bild mit Gesichtsrahmen, Infos, Zielpfaden, eine Mini-Karte und alle Metadaten. `←`/`→` blättert, `Esc` schließt.

Mit dem **Filter** wird nur ein Teil sortiert: nach Zeitraum, Uhrzeit (auch über Mitternacht), Wochentagen, Foto/Video, GPS, Zone, Kamera oder Personen.

Die Originale werden nur gelesen. Vorhandene Dateien im Ziel werden nie überschrieben, ein zweiter Lauf überspringt sie. Einstellungen, Zonen und Änderungen bleiben im Browser gespeichert und lassen sich als JSON exportieren.

## Fotoübersicht: Karte und Ordner

Nach dem Kopieren liegt im Ziel **`_fotos.html`**, abschaltbar unter „Fotoübersicht (_fotos.html)“. Mit **Übersicht speichern** lässt sie sich auch ohne erneutes Kopieren schreiben.

- Doppelklick öffnet sie in jedem Browser, auch offline und ohne dieses Programm.
- **Karte:** Alle Fotos mit Standort sind Punkte. Rechts stehen die Fotos des sichtbaren Ausschnitts: hineinzoomen = nach Ort suchen.
- **Ordner:** die sortierte Ordnerstruktur zum Durchklicken, mit Vorschaubildern und den neuen Dateinamen.
- Filter nach Jahr, Ereignis und Person. Ein Klick öffnet die Großansicht, `←`/`→` blättert.
- Vorschaubilder liegen im Ordner `_fotos`, die Fotos selbst werden über relative Links geladen. Die Übersicht muss also neben den Fotos bleiben (der ganze Ordner darf verschoben werden).
- Der Kartenhintergrund (OpenStreetMap 🌐) lässt sich dort ein- und ausschalten.

### Verzeichnis ohne Kopieren

Wer keinen Speicherplatz doppelt belegen will: **6 Ziel → Verzeichnis ohne Kopieren**. Dann wird nichts kopiert oder verschoben. Es entsteht nur `_fotos.html` mit Karte und der gewünschten Ordnerstruktur. Diese verlinkt direkt auf die Originale.

- **Mit Vorschaubildern:** Zusätzlich kommen kleine Bilder (ca. 10–20 KB je Foto) in den Ordner `_fotos`. Damit blättert die Übersicht schnell.
- **Ohne Vorschaubilder:** Es entsteht nur die eine Datei. Die Übersicht lädt dann jedes Original, das ist langsamer, vor allem übers Netzwerk.

- Am einfachsten legst du die Übersicht in den Quellordner selbst (oder in einen Ordner darüber). Dann sind die Links relativ und funktionieren auch, wenn der Ordner verschoben wird.
- Liegt sie woanders, fragt das Programm nach dem vollständigen Pfad der Quelle (z. B. `D:\Fotos\Kamera`).
- Wird ein Original verschoben oder gelöscht, zeigt die Übersicht „Datei nicht gefunden“. Dann einfach neu erstellen.

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

## Gesichtserkennung

Sie läuft komplett lokal im Browser, mit ONNX Runtime Web und zwei Modellen aus dem OpenCV Model Zoo:

- **YuNet** (MIT) findet die Gesichter und fünf Merkpunkte (Augen, Nase, Mundwinkel). Damit wird jedes Gesicht gerade ausgerichtet.
- **SFace** (Apache 2.0) berechnet daraus 128 Merkmale zum Wiedererkennen.

Laufzeit und Modelle sind in der HTML-Datei eingebettet, deshalb ist sie ca. 19 MB groß.

- Die Erkennung läuft in mehreren Web Workern gleichzeitig, einer je Prozessorkern. Auf einem 6-Kern-Rechner sind es etwa 0,04 s pro Foto, bei 5000 Fotos also 3–4 Minuten.
- Der Lauf kann jederzeit abgebrochen werden. Ein neuer Start setzt dort fort, die Ergebnisse bleiben im Browser gespeichert.
- Die „Ähnlichkeit“ in den Einstellungen steuert, wie streng gruppiert wird. Werden Personen vermischt, stellst du einen kleineren Wert ein. Wird eine Person auf viele Gruppen verteilt, einen größeren.
- Kleine Kinder, die sich über die Jahre stark verändern, werden oft vermischt.

Gruppen bearbeiten:

- **Name eintippen** benennt eine Gruppe. Gleicher Name = Gruppen zusammenführen.
- **Ziehen und Ablegen:** Gesichter mit der Maus auf eine andere Person ziehen. Strg+Klick wählt mehrere aus. Auf eine unbenannte Gruppe ziehen fragt nach einem Namen, auf **Neue Person** legt eine neue an.
- **Schnell zuordnen** (am schnellsten bei vielen Fotos): zeigt jede offene Gruppe nacheinander, auch die automatisch zugeordneten Gesichter einer Person („Sind das alle Anna?“). Falsche Gesichter anklicken, dann `Enter` für den Vorschlag, `1`–`9` für eine andere Person oder einen Namen tippen. Abgewählte Gesichter werden dieser Person danach nicht mehr zugeordnet. Nach jeder Antwort wird neu gerechnet. Weitere Tasten: `Entf` fremd/kein Gesicht, `→` überspringen, `←` rückgängig.
- **Viele auf einmal:** Auf freier Fläche einen Rahmen ziehen, Umschalt+Klick wählt einen Bereich, ☐ die ganze Gruppe. Dann **Rechtsklick** → Namen eintippen (Enter) oder eine Person aus der Liste wählen.
- **In der Bildansicht** einen Gesichtsrahmen (gelber Kasten) anklicken und direkt einen Namen zuweisen.
- Ist die Person auf dem Foto schon, kommt eine Meldung. Bestätigte Personen, die auf einem Foto doppelt vorkommen, sind in ihrer Karte mit **2×** markiert; **⚠ doppelt** geht sie einzeln durch.
- **✕** entfernt ein Gesicht aus der Person. Es landet unten in **Nicht zugeordnet** und lässt sich später zuweisen.
- **Prüfen** zeigt die automatisch zugeordneten Gesichter einer Person: ✓ bestätigt. Gesichter stehen überall nach Aufnahmedatum, mit der Jahreszahl als Trenner zwischen den Jahren.
- **✓ Fertig** legt eine Person klein oben ab, damit die Übersicht frei bleibt. Man kann weiter Gesichter darauf ziehen. „Fertige Personen ausblenden“ blendet sie ganz aus.

Die Erkennung lernt mit:

- Jede benannte Person bekommt aus ihren bestätigten Gesichtern mehrere „Vertreter“, z. B. mit Brille, im Profil, als Kind und später. Je mehr du zuordnest, desto mehr erkennt das Programm selbst. Das passiert nach jeder Änderung sofort.
- **Erneut prüfen** zeigt, wie viele Gesichter seit dem letzten Prüfen neu zugeordnet wurden, und sucht **Auffälligkeiten**: eine Person zweimal auf demselben Foto oder ein bestätigtes Gesicht, das deutlich besser zu einer anderen Person passt. Diese lassen sich dann einzeln durchgehen. Unbenannte Gruppen, die einer bekannten Person ähneln, bekommen einen grünen Vorschlag wie **„Anna?“**.
- **Regeln:** Eine Person kommt auf einem Foto nur einmal vor. Mit dem **Zeitfenster** (Standard 12 Monate) wird automatisch nur zugeordnet, wenn ein Gesicht bestätigten Gesichtern der Person aus derselben Zeit ähnelt. So werden zwei Babys, die Jahre auseinander liegen, nicht vermischt. Gruppen mit großen Zeitlücken werden geteilt. Ist es doch dieselbe Person, reicht bei „Schnell zuordnen“ ein Enter.
- **Rückgängig:** `Strg+Z` oder der Knopf „Rückgängig“ nimmt die letzten Zuordnungen zurück.
- Unbenannte Gruppen behalten ihren Platz in der Liste, Personen stehen alphabetisch. Wird ein Gesicht entfernt, bleiben die übrigen in ihren Gruppen (gewechselt wird nur, wenn eine andere Gruppe deutlich besser passt). „Erneut prüfen“ rechnet dagegen alles frisch durch.
- Ist eine Person auf einem Foto schon bestätigt, wird sie für die anderen Gesichter dieses Fotos nicht mehr vorgeschlagen.
- **Personen merken** speichert die bestätigten Gesichter (bis zu 60 möglichst verschiedene je Person) als Wissen im Browser. Diese Personen werden dann auch in anderen Ordnern erkannt. Gespeichert werden nur Gesichtsmerkmale (128 Zahlen), keine Bilder. Mit dem Export der Einstellungen (JSON) wandert das Wissen auf einen anderen PC.
- Das Modell selbst wird dabei nicht neu trainiert. Es vergleicht mit deinen Beispielen, und das bringt bei wenigen Personen fast denselben Effekt.

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
src/js/*.js           Logik (metadata, analyze, plan, copy, map, faces, people, app …)
src/js/i18n.js        Sprache: Texte stehen deutsch im Code (T('…')), englische Übersetzungen hier
src/vendor/           Leaflet (BSD-2), exifr (MIT), onnxruntime-web (MIT), YuNet (MIT), SFace (Apache 2.0), eingebettet
tools/build-single.js baut dist/sort-my-pictures.html (alles in einer Datei)
tools/vendor.js       aktualisiert src/vendor aus node_modules, lädt die Gesichtsmodelle einmal aus dem OpenCV Model Zoo
tools/i18n-check.js   prüft, ob jeder deutsche Text eine englische Übersetzung hat
```

```
npm install          # nur zum Aktualisieren der Bibliotheken nötig
npm run vendor       # src/vendor neu erzeugen
node tools/i18n-check.js
npm run build        # -> dist/sort-my-pictures.html
```

`src/index.html` lässt sich zum Entwickeln auch direkt öffnen. Jeder Push auf `main` baut die Seite über GitHub Actions neu und veröffentlicht sie auf GitHub Pages.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Die eingebetteten Bibliotheken und Modelle haben eigene Lizenzen, siehe `src/vendor/LICENSE-*`.
