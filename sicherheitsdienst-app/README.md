# DienstWache

Installierbare PWA für Mitarbeiter und Firmen im Sicherheitsdienst.

## Enthalten
- Registrierung und Anmeldung über Supabase Auth
- Einzelzugang mit Testphase
- Firmenkonto mit Rollen: Inhaber, Admin, Objektleitung und Mitarbeiter
- Firmenbeitritt über Code mit anschließender Admin-Freigabe
- Firmenzugang mit zentralem Abo-Status und Mitarbeiterlimit
- Dashboard mit Monatsstunden, Arbeitstagen und Urlaub
- Dienstzeiten, Urlaub, Vorfallmeldungen, Datei-Uploads und PDF-Stundennachweis
- zentrale PWA-Updates: eine Veröffentlichung, anschließend Update-Hinweis für alle installierten Nutzer
- WachHelfer als integrierte Kurzhilfe
- sichere Benutzertrennung über Supabase RLS; privilegierte Firmenaktionen laufen über eine JWT-geschützte Edge Function

## Firmenbetrieb
Die Firmenstruktur ist auf mehrere hundert Nutzer ausgelegt. Bestehende persönliche Daten bleiben pro Benutzer getrennt. Firmen-Admins verwalten Mitgliedschaften, nicht die Passwörter der Mitarbeiter.

## Abrechnung
Die Datenbank ist auf ein Firmenabo vorbereitet. Der tatsächliche Zahlungs-Checkout und die verbindlichen Preise werden erst nach Festlegung des Geschäftsmodells mit dem Zahlungsanbieter verbunden. Es werden durch diese Version keine Firmen automatisch belastet.

## Veröffentlichung
Die PWA kann zentral veröffentlicht werden. Neue Versionen werden vom Service Worker erkannt und den Nutzern als Update angeboten.
