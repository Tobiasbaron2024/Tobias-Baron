# DienstWache

Installierbare Web-App für Mitarbeiter im Sicherheitsdienst.

## Enthalten
- Registrierung und Anmeldung über Supabase Auth
- automatische 3-Tage-Testphase
- serverseitige Zugriffssperre nach Ablauf der Testphase
- Dashboard mit Monatsstunden, Arbeitstagen und Urlaub
- Dienstzeiten mit Pausenberechnung
- Urlaubsverwaltung
- Vorfallmeldungen mit Foto/PDF-Upload
- Stundennachweis als PDF und Teilen-Funktion
- PWA-Manifest und Service Worker
- sichere Benutzertrennung über Supabase RLS

## Sicherheit
Im GitHub-Code liegt kein Supabase-Secret-Key. Die App lädt nur die öffentliche Client-Konfiguration über die Supabase Edge Function `app-config`.

## Noch offen
Der Zahlungs-Checkout für 2,99 € pro Monat ist vorbereitet, aber noch nicht verbunden, weil aktuell kein Zahlungsanbieter autorisiert ist.

Für E-Mail-Bestätigung und Passwort-Reset sollte die veröffentlichte App-URL in Supabase unter Authentication → URL Configuration als erlaubte Redirect-URL eingetragen werden.
