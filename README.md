# Sort My Pictures

**English** | [Deutsch](README.de.md)

**➜ Open it directly in your browser: https://skafuu.github.io/sort-my-pictures/**

Sorts photos and videos locally into folders by year and month. It also uses the GPS data to detect holidays, day trips, business trips and your own custom categories. It copies into a target folder, moves there or reorganizes the folder in place. It is a single HTML file that runs in the browser without installation. Your photos never leave your computer.

```
Target/
  2023/
    06_June/21_14-32-08.jpg                          ← all pictures and videos
    Holidays/06_June_Italy_Lignano/20_10-32-32.jpg   ← additionally as a copy (can be turned off)
    Day trips/05_May_Vienna/…
    Business trips/01_January_Linz/…
    People/Anna/…                                    ← if you want, via face recognition
  _photos.html                                     ← photo overview: map + folders to search
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

1. **Source:** Share a drive or your main folder once, then pick subfolders directly in the **folder tree** in the side panel (● = saved progress available). The folder tree is only shown in this step. Or choose a folder (network drives work too) and click **Scan**. Copy photos from a phone to the PC first, e.g. with a USB cable in Explorer. Date taken and GPS come from EXIF or from the MP4/MOV metadata.
2. **Places:** Add zones on the map (Home, Everyday place, Work place, Named place). Optionally switch on place names from OpenStreetMap (🌐, they are fetched right away and after every scan) and a map background.
3. **Events:** Change type and place name per event. Clicking a row shows its pictures, where you can take single pictures out. This is also where you create **custom categories** (see below).
4. **Review:** Go through the events one by one, uncertain ones first. Keys `1`–`4` choose holiday, day trip, business trip or no folder, `5`–`9` your custom categories. `Enter` accepts the suggestion, `←`/`→` browse. **Review again** marks everything as not reviewed (your choices stay as suggestions), after asking.
5. **People:** When you first open it, the app asks whether to start face recognition (afterwards only for new photos). Name the groups, see [Face recognition](#face-recognition).
6. **Output:** Set folder structure, file names and filters, check the folder tree. Under **Folders** you turn event folders, person folders and skipping duplicates on or off. Choose what happens to the photos (see [Output](#output-copy-move-reorganize)) and click **Start**.

Switch the language with **DE | EN** at the top right. On first start it follows the browser language. Folder names you have not changed are switched too (Urlaube → Holidays).

Clicking a picture (thumbnail, map point, file in the folder tree) opens the **viewer**. It shows the large picture with face boxes, info, target paths, a mini map and all metadata. `←`/`→` browse, `Esc` closes.

With the **filter** only part of the pictures is sorted: by period, time of day (also across midnight), weekdays, photo/video, GPS, zone, camera or people.

### Output: copy, move, reorganize

At the top you choose **one** of three modes, or none:

| Mode | What happens | Originals |
|---|---|---|
| **Copy** (default) | sorted copies in a target folder | stay unchanged |
| **Move** | sorted into the target folder, then removed from the source | are removed |
| **Reorganize source** | the source itself is renamed and sorted into folders | are renamed/moved |
| none | only the overview, linking to the originals | stay unchanged |

Independently, switch **Index** (folder list), **Map** and **Thumbnails** for the overview `_photos.html` on or off.

- Existing files are never overwritten, a second run skips them. Every run writes a log `_log_….csv`.
- **Move:** each file is only removed from the source after its copy in the target has been fully verified (size and content). On an error or cancel the original stays. The browser deletes **without a recycle bin**. Face names and reviewed events go along to the target as `_sortmypictures.json`.
- **Reorganize:** each photo gets exactly one place (event, else special folder, else month), otherwise there would be copies in the source. **Person folders** can be added as copies; scanning skips them so the copies don't show up as duplicates (works as long as the template starts with a fixed folder name, e.g. `People/{PERSON}/…`). On the same drive this is just renaming: fast, no extra space, modified date kept. Folders that become empty are removed. Face names and ticks on events are rewritten to the new paths. **Undo reorganizing** puts everything back and removes the person copies it created. Programs or shortcuts pointing to the old paths (e.g. Lightroom) will no longer find the files.
- **Duplicates** are never deleted when moving or reorganizing; they go to the folder `_Duplicates` where you can check and delete them yourself.
- Where the browser cannot move directly (e.g. some network drives), files are copied, verified and then deleted. Slower, but just as safe. The file's modified date is then today's; the program itself goes by the date taken anyway.

### Where your progress is stored

Your progress is stored in the browser (IndexedDB/localStorage) **and** as a small file `_sortmypictures.json` in the source folder. Scanning and sorting never change the photos themselves, only this one file is written (unless you choose Move or Reorganize in step 6) (the browser asks once for write access). If you close the page or cancel, the state is kept: open the folder again and click **Scan**. With another browser or PC the progress is taken from the file; the newer one always wins. Without write access it stays in the browser only.

- **Per source folder:** face names, changes and ticks on events, finished people. If you open another folder in between, each keeps its own state. The folder is recognised by its access, not just its name.
- **For all folders:** settings, zones, remembered people, place names, face detection results.
- The storage belongs to this browser and this address. The website and the downloaded HTML file have separate storage, so do other browsers. Clearing browsing data deletes it. **Export** (step 1) saves settings, zones and names as a JSON file for backup or another PC.

## Photo overview: map and folders

After copying or moving, the target contains **`_photos.html`**; after reorganizing it is in the source. **Index** and **Map** in step 6 choose which views it contains; with both on, both are in the same file. To write it later just click **Start** again – files already copied are skipped.

- Double-click opens it in any browser, also offline and without this program.
- **Map:** all photos with a location are points. On the right you see the photos of the visible area: zoom in = search by place.
- **Folders:** the sorted folder structure to click through, with thumbnails and the new file names.
- Filter by year, event and person. A click opens the large view, `←`/`→` browse.
- Thumbnails live in the folder `_photos`, the photos themselves are loaded via relative links. So the overview must stay next to the photos (the whole folder may be moved).
- The map background (🌐) can be chosen there: street map, satellite, terrain or none.

### Overview only, without copying

If you don't want to use storage twice: in **6 Output** choose no mode, only **Index** and/or **Map**, then **Start**. Nothing is copied or moved. Only `_photos.html` is written, with the folder structure and/or map. It links directly to the originals.

- **Thumbnails on:** small pictures (about 10–20 KB per photo) are added in the folder `_photos`. The overview browses quickly with them.
- **Thumbnails off:** just the one file. The overview then loads every original, which is slower, especially over the network.

- The easiest is to put the overview into the source folder itself (or a folder above it). Then the links are relative and keep working when the folder is moved.
- If it goes somewhere else, the program asks for the full path of the source (e.g. `D:\Photos\Camera`).
- If an original is moved or deleted, the overview shows “File not found”. Just create it again.

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
- **Quick assign** (fastest with many photos): shows every open group in turn, including the automatically assigned faces of a person (“Are these all Anna?”). Click the wrong faces, then `Enter` for the suggestion, `1`–`9` for another person, or type a name. Deselected faces are no longer assigned to that person afterwards. It recalculates after every answer. More keys: `Del` stranger/not a face, `→` skip, `←` undo.
- **Many at once:** drag a frame on empty space, Shift+click selects a range, ☐ the whole group. Then **right-click** → type a name (Enter) or pick a person from the list.
- **In the viewer** click a face box (yellow frame) to assign a name directly.
- If the person is already on that photo, a warning appears. Confirmed people that appear twice on one photo are marked **2×** on their card; **⚠ twice** goes through them one by one.
- **✕** removes a face from the person. It goes to **Unassigned** at the bottom and can be assigned later.
- **Ignored** (stranger / not a face) is collapsed at the bottom. **Show** lists the ignored faces grouped by similarity: typing a name turns a group into a new person, **Bring back** makes the group open again.
- **Review** shows a person’s automatically assigned faces: ✓ confirms. Faces are always shown by date taken, with the year as a divider between the years.
- **✓ Done** puts a person small at the top to keep the overview clear. You can still drag faces onto it. “Hide finished people” hides them completely.

Recognition learns as you go:

- Each named person gets several “representatives” from their confirmed faces, e.g. with glasses, in profile, as a child and later. The more you assign, the more the program recognises by itself. This happens right after every change.
- **Check again** shows how many faces were newly assigned since the last check and looks for **anomalies**: a person twice in the same photo, or a confirmed face that fits another person much better. You can then go through them one by one. Unnamed groups that look like a known person get a green suggestion like **“Anna?”**.
- **Rules:** a person appears only once per photo. With the **time window** (default 12 months), a face is only assigned automatically if it resembles confirmed faces of the person from the same time. This keeps two babies born years apart from being mixed up. Groups with large time gaps are split. If it is the same person after all, one Enter in “Quick assign” is enough.
- **Undo:** `Ctrl+Z` or the “Undo” button takes back the last assignments.
- Unnamed groups keep their place in the list, people are sorted alphabetically. When a face is removed, the others stay in their groups (they only move if another group fits much better). “Check again” recalculates everything from scratch.
- If a person is already confirmed on a photo, they are not suggested for the other faces of that photo.
- **Remember people** stores the confirmed faces (up to 60 as different as possible per person) as knowledge in the browser. These people are then recognised in other folders too. Only face features (128 numbers) are stored, no pictures. Exporting the settings (JSON) takes the knowledge to another PC.
- The model itself is not retrained. It compares with your examples, which gives almost the same effect for a handful of people.

## Local and online

By default everything runs **offline**. Two features use the internet. They are marked with 🌐 and off by default:

| Feature | Service | What is sent |
|---|---|---|
| Place names | nominatim.openstreetmap.org | one coordinate point per event (max. 1/s, result stored locally) |
| Map background | tile.openstreetmap.org, server.arcgisonline.com (Esri), tile.opentopomap.org | the map area shown (which tiles are displayed) |

OpenStreetMap only delivers tiles to the website. When the downloaded HTML file or `_photos.html` is opened directly, OpenStreetMap blocks them (“Access blocked”), so “Map” then uses the Esri street map automatically. Satellite (Esri) and terrain (OpenTopoMap) can be chosen as well.

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
