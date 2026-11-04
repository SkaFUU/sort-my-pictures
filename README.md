# Sort My Pictures

**English** | [Deutsch](README.de.md)

**➜ Open it directly in your browser: https://skafuu.github.io/sort-my-pictures/**

Sorts photos and videos locally into folders by year and month. It also uses the GPS data to detect holidays, day trips, business trips and your own custom categories. It is a single HTML file that runs in the browser without installation. Your photos never leave your computer.

```
Target/
  2023/
    06_June/21_14-32-08.jpg                          ← all pictures and videos
    Holidays/06_June_Italy_Lignano/20_10-32-32.jpg   ← additionally as a copy
    Day trips/05_May_Vienna/…
    Business trips/01_January_Linz/…
    People/Anna/…                                    ← optional, via face recognition
  _map.html                                        ← interactive map: find photos by location
  _log_2026-11-04_12-00-00.csv
```

## Usage

Open **https://skafuu.github.io/sort-my-pictures/** in **Chrome, Edge, Brave or Opera**. Firefox and Safari cannot write to local folders.

- Only the page itself is loaded. Folders, photos and results stay on your computer, nothing is uploaded.
- To use it without internet: download [sort-my-pictures.html](https://skafuu.github.io/sort-my-pictures/sort-my-pictures.html) (right-click → Save as) and open it with a double-click.

The interface guides you step by step through the tabs from left to right:

- Each tab has a ribbon with the actions at the top and a side panel with its settings on the right.
- **Next** takes you to the next step.
- Finished steps get a ✓.

1. **Source:** Choose a folder (network drives work too) and click **Scan**. Copy photos from a phone to the PC first, e.g. with a USB cable in Explorer. Date taken and GPS come from EXIF or from the MP4/MOV metadata.
2. **Places:** Add zones on the map (Home, Everyday place, Work place, Named place). Optionally get place names and the map background from OpenStreetMap (🌐).
3. **Events:** Change type and place name per event. Clicking a row shows its pictures, where you can take single pictures out. This is also where you create **custom categories** (see below).
4. **Review:** Go through the events one by one, uncertain ones first. Keys `1`–`4` choose holiday, day trip, business trip or no folder, `5`–`9` your custom categories. `Enter` accepts the suggestion, `←`/`→` browse.
5. **People** (optional): Detect faces and name the groups, see [Face recognition](#face-recognition).
6. **Target & copy:** Set folder structure, file names and filters, check the folder tree. Then choose the **target** and click **Copy**.

Switch the language with **DE | EN** at the top right. On first start it follows the browser language. Folder names you have not changed are switched too (Urlaube → Holidays).

Clicking a picture (thumbnail, map point, file in the folder tree) opens the **viewer**. It shows the large picture with face boxes, info, target paths, a mini map and all metadata. `←`/`→` browse, `Esc` closes.

With the **filter** only part of the pictures is sorted: by period, time of day (also across midnight), weekdays, photo/video, GPS, zone, camera or people.

Originals are only read. Existing files in the target are never overwritten, a second run skips them. Settings, zones and changes are stored in the browser and can be exported as JSON.

## Map in the target folder

After copying, the target contains **`_map.html`** (can be switched off with “Map (_map.html)”). **Save map** writes it without copying again.

- Double-click opens it in any browser, also offline and without this program.
- All photos with a location are points on the map. On the right you see the photos of the visible area: zoom in = search by place.
- Filter by year, event and person. A click opens the large view, `←`/`→` browse.
- Photos are loaded directly from the sorted folders, thumbnails live in the folder `_map`. So the map only works while it stays in the target folder next to the photos (the whole folder may be moved or copied to another drive).
- The map background (OpenStreetMap 🌐) can be switched on and off there.

## Custom categories

Besides holiday, day trip and business trip you can create your own categories with their own rules and folder: **3 Events → New category** or in the side panel under **Custom categories**, also from templates (long-haul trip, weekend trip, ski holiday, summer holiday, hikes).

A category takes over detected events that match all of its conditions. Empty fields mean “any”.

| Condition | Example |
|---|---|
| Applies to | holidays only, day trips only, business trips only, or all |
| Distance from home | from 800 km |
| Duration | 2–3 days |
| At least pictures | 20 |
| Weekdays | with weekend, only at the weekend, workdays only |
| Months | December–March |
| Zone | inside a zone from the map |
| Place contains | “Italy” |
| People | “Anna” is on the photos |

The order of the list matters: the first matching category wins, move them with ▲▼. In the folder pattern the category is `{CAT}`, its colour shows on the map.

## Face recognition

It runs completely locally in the browser, using ONNX Runtime Web and two models from the OpenCV Model Zoo:

- **YuNet** (MIT) finds the faces and five landmarks (eyes, nose, mouth corners), which are used to align each face.
- **SFace** (Apache 2.0) computes 128 features from it for recognition.

Runtime and models are embedded in the HTML file, which is why it is about 19 MB.

- Detection runs in several web workers in parallel, one per CPU core. On a 6-core PC that is about 0.04 s per photo, so 3–4 minutes for 5000 photos.
- It can be cancelled at any time. Starting again continues where it stopped, results are stored in the browser.
- “Similarity” in the settings controls how strictly faces are grouped. If people get mixed up, set a smaller value. If one person is spread over many groups, a larger one.
- Small children who change a lot over the years are often mixed up.

Editing groups:

- **Type a name** to name a group. Same name = merge groups.
- **Drag and drop:** drag faces onto another person with the mouse. Ctrl+click selects several. Dropping onto an unnamed group asks for a name, dropping onto **New person** creates one.
- **✕** removes a face from the person. It goes to **Unassigned** at the bottom and can be assigned later.
- **Review** shows a person’s automatically assigned faces, least certain first: ✓ confirms.
- **✓ Done** puts a person small at the top to keep the overview clear. You can still drag faces onto it. “Hide finished people” hides them completely.

## Local and online

By default everything runs **offline**. Two features use the internet. They are marked with 🌐 and off by default:

| Feature | Service | What is sent |
|---|---|---|
| Place names | nominatim.openstreetmap.org | one coordinate point per event (max. 1/s, result stored locally) |
| Map background | tile.openstreetmap.org | the map area shown (which tiles are displayed) |

Without place names, folders get the coordinates (`47.39N_13.72E`) or the name of a zone. Zones of type “Named place” are a purely offline alternative.

## Detection

- **Home:** the place with the most days with pictures, or zones of type “Home”.
- **Everyday places:** nearby places that occur on many days (work, family). They never count as day trips.
- **Holiday:** consecutive days farther away than the minimum distance. Gaps without photos are allowed as long as no photo was taken near home on those days.
- **Day trip:** a day with at least N pictures outside the radius around home.
- **Business trip:** a trip into a “Work place” zone, or a trip of several days on workdays only with few pictures per day. Single days at the same place count too.

## Development

```
src/index.html        user interface
src/js/*.js           logic (metadata, analyze, plan, copy, map, faces, people, app …)
src/js/i18n.js        language: texts are German in the code (T('…')), English translations here
src/vendor/           Leaflet (BSD-2), exifr (MIT), onnxruntime-web (MIT), YuNet (MIT), SFace (Apache 2.0), embedded
tools/build-single.js builds dist/sort-my-pictures.html (everything in one file)
tools/vendor.js       updates src/vendor from node_modules, downloads the face models once from the OpenCV Model Zoo
tools/i18n-check.js   checks that every German text has an English translation
```

```
npm install          # only needed to update the libraries
npm run vendor       # regenerate src/vendor
node tools/i18n-check.js
npm run build        # -> dist/sort-my-pictures.html
```

`src/index.html` can also be opened directly for development. Every push to `main` rebuilds the page with GitHub Actions and publishes it on GitHub Pages.

## License

MIT, see [LICENSE](LICENSE). The embedded libraries and models have their own licenses, see `src/vendor/LICENSE-*`.
