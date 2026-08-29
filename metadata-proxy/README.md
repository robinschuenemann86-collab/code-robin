# Cover-Art-Proxy für MR Launch

Dieser kleine Dienst hält deinen SteamGridDB-Key im Hintergrund, damit
Freunde, die MR Launch ausprobieren, keinen eigenen Key anlegen müssen —
Cover-Art funktioniert bei ihnen dann einfach sofort.

Das ist eine dauerhafte Einrichtung: du betreibst diesen Dienst ab jetzt
weiter (kostenlos, aber nicht "einmal machen und vergessen"). Wenn dir das
zu viel ist, funktioniert MR Launch genauso gut ohne — dann trägt jeder
Nutzer weiterhin seinen eigenen kostenlosen Key ein wie bisher.

## Einmalige Einrichtung (ca. 10 Minuten)

1. **Cloudflare-Konto anlegen** (falls noch nicht vorhanden): auf
   [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) —
   kostenlos, keine Zahlungsdaten nötig für das, was wir hier brauchen.

2. **Worker anlegen**: Im Cloudflare-Dashboard links auf **Workers & Pages**,
   dann **Create** → **Workers** → **Create Worker**. Einen Namen vergeben
   (z. B. `mr-launch-metadata-proxy`) und auf **Deploy** klicken — erstmal
   mit dem Standard-Beispielcode, den ersetzen wir gleich.

3. **Code einfügen**: Nach dem Erstellen auf **Edit code** (oder
   **Quick edit**). Den kompletten Inhalt der Datei `worker.js` aus diesem
   Ordner hineinkopieren (den bisherigen Beispielcode komplett ersetzen).
   Oben rechts auf **Deploy** / **Save and deploy** klicken.

4. **Echten SteamGridDB-Key als Secret hinterlegen**: Im Worker unter
   **Settings** → **Variables and Secrets** → **Add** → als Typ **Secret**
   auswählen, Name genau `STEAMGRIDDB_API_KEY`, als Wert deinen Key von
   steamgriddb.com einfügen. Speichern. (Wichtig: **Secret**, nicht
   "Text"/"Plaintext" — sonst kann ihn jeder im Dashboard sehen, der Zugriff
   auf dein Cloudflare-Konto hat.)

5. **Adresse kopieren**: Oben auf der Worker-Seite steht eine Adresse wie
   `https://mr-launch-metadata-proxy.<dein-name>.workers.dev` — die brauchst
   du im nächsten Schritt.

## MR Launch mit dem Proxy bauen

Beim nächsten Release-Build diese Umgebungsvariable setzen, bevor
`npm run build:win` läuft (PowerShell):

```powershell
$env:METADATA_PROXY_URL = "https://mr-launch-metadata-proxy.<dein-name>.workers.dev"
npm run build:win
```

Die Adresse wird dabei fest in die App eingebacken — Freunde, die den
Installer herunterladen, müssen nichts weiter einstellen. Baust du eine
Version *ohne* gesetzte Variable, funktioniert die App weiterhin, verlangt
dann aber wieder von jedem Nutzer einen eigenen Key wie bisher.

## Zusätzlich für den Bibliotheks-Abgleich zwischen mehreren PCs (optional)

Dieser Worker kann jetzt auch Favoriten/Sterne/Tags zwischen deinen eigenen
PCs abgleichen (Feature "PC-Abgleich" im "…"-Menü von MR Launch). Dafür
braucht der Worker einen eigenen Speicher (KV-Namespace):

1. Im Cloudflare-Dashboard unter **Workers & Pages** → **KV** → **Create
   namespace**. Einen Namen vergeben, z. B. `mr-launch-sync`.
2. Zurück zu deinem Worker → **Settings** → **Bindings** → **Add binding** →
   **KV Namespace**. Als **Variable name** genau `SYNC_STORE` eintragen, als
   Namespace den gerade erstellten `mr-launch-sync` auswählen. Speichern.
3. Den aktualisierten Code aus `worker.js` (diese Datei wurde erweitert)
   erneut wie in Schritt 3 oben einfügen und deployen — nicht vergessen, die
   neue Version danach auch als **aktive Version zu promoten** (siehe
   Stolperstein weiter unten).
4. Fertig — einen Build mit `METADATA_PROXY_URL` gesetzt (siehe oben) reicht,
   eine zusätzliche Variable braucht es dafür nicht. In MR Launch selbst
   einen beliebigen, langen Code (mind. 16 Zeichen, Buchstaben/Zahlen) im
   "PC-Abgleich"-Dialog erfinden und auf beiden PCs identisch eintragen.

**Wichtig zu verstehen:** Wer diesen Code kennt, kann die dahinterliegenden
Daten lesen und überschreiben — das ist kein echtes Login, nur ein geteiltes
Passwort zwischen deinen eigenen Geräten. Für den privaten Gebrauch
zwischen deinem eigenen Gaming-PC und z. B. einem Laptop ist das in
Ordnung; den Code entsprechend nicht öffentlich teilen. Der Abgleich fügt
außerdem nie neue Programme hinzu — nur Favorit/Sterne/Tags werden für
Programme ergänzt, die auf beiden PCs bereits vorhanden sind (erkannt an
Name bzw. Steam-/Epic-/Battle.net-/Ubisoft-Kennung).

## Was, wenn ich das nicht mehr betreiben will?

Den Worker im Dashboard löschen. Bereits installierte Versionen von MR
Launch, die den Proxy nutzen, zeigen dann keine neue Cover-Art mehr — der
Rest der App bleibt unberührt. Ein neues Release ohne `METADATA_PROXY_URL`
bauen, dann verlangt die App wieder einen eigenen Key.
