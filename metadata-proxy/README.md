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

## Was, wenn ich das nicht mehr betreiben will?

Den Worker im Dashboard löschen. Bereits installierte Versionen von MR
Launch, die den Proxy nutzen, zeigen dann keine neue Cover-Art mehr — der
Rest der App bleibt unberührt. Ein neues Release ohne `METADATA_PROXY_URL`
bauen, dann verlangt die App wieder einen eigenen Key.
