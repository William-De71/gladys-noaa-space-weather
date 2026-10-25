# NOAA Space Weather

## Überblick

Diese Integration bringt das Weltraumwetter des [Space Weather Prediction Center der NOAA](https://www.swpc.noaa.gov/) (SWPC) in Gladys: den Kp-Index der geomagnetischen Aktivität, die NOAA-Skalen für geomagnetische Stürme (G), solare Strahlungsstürme (S) und Funkausfälle (R), den Sonnenwind, die Sonneneruptionen, die Meldungen des SWPC und die OVATION-Polarlichtvorhersage für jedes deiner Zuhause. Deine Szenen erfahren, wenn ein Sturm beginnt, ein starker Flare auftritt oder heute Nacht bei dir Polarlicht sichtbar sein könnte.

Transport: Cloud. Die Integration liest öffentliche Dateien auf `services.swpc.noaa.gov`; nichts von dir wird gesendet (kein Konto, kein Schlüssel, nie die Koordinaten deiner Zuhause: das Polarlicht-Raster wird vollständig geladen und lokal gelesen). Daten: NOAA SWPC, gemeinfrei. Diese Integration ist nicht mit der NOAA verbunden.

**Die Skalen kurz erklärt.** Der **Kp**-Index reicht von 0 (ruhig) bis 9 (extremer Sturm), pro 3-Stunden-Zeitraum; Kp 5 ist ein Sturm **G1**, Kp 9 ein Sturm **G5**. **S1–S5** messen die Protonen der Sonne (Satelliten, Polarflüge), **R1–R5** die Röntgenstrahlung der Flares (KW-Funk und GPS auf der Tagseite): R1 entspricht einem M1-Flare, R3 einem X1-Flare.

## Voraussetzungen

- Gladys 5.3.0 oder neuer (Widgets und Szenen-Auslöser).
- Für Polarlicht: ein Zuhause mit Standort (Einstellungen → Zuhause). Die Integration fragt bei der Installation nach den Koordinaten der Zuhause.
- Die Breite zählt. Unterhalb von etwa 55° magnetischer Breite, wie im Großteil Deutschlands, ist Polarlicht selten: Nur starke Stürme (G3 oder mehr, einige Male pro Sonnenzyklus) bringen es so weit nach Süden. In Skandinavien, Island, Kanada oder Alaska ist es häufig.

## Konfiguration

| Feld                | Zweck                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sprache der Texte   | Gerätenamen, Sätze und Fehler der Szenen. Automatisch: die Sprache des zuletzt angezeigten Widgets.                                   |
| Polarlicht-Schwelle | 5 bis 50 %: die OVATION-Wahrscheinlichkeit, ab der Polarlicht an einem Zuhause bei dunklem Himmel „möglich“ ist (standardmäßig 10 %). |

Die Schaltfläche **Verbindung testen** liest die NOAA-Skalen und den geschätzten Kp und listet die Zuhause mit Standort auf. **Diagnose** schreibt den Zustand der Integration in ihre Logs.

Die Integration liest jedes Produkt in seinem Takt: den geschätzten Kp jede Minute, Sonnenwind, Magnetfeld, Flares und Skalen alle 5 Minuten, die Meldungen alle 10 Minuten, den 3-Stunden-Kp alle 30 Minuten, die Vorhersage stündlich, den Radiofluss alle 3 Stunden. Das OVATION-Raster (etwa 1 MB) wird alle 20 Minuten **nur** gelesen, solange ein Polarlicht-Gerät existiert oder ein Polarlicht-Widget angezeigt wird. Unveränderte Dateien beantwortet der Server mit „nicht geändert“, ein Fehler verdoppelt die Wartezeit (höchstens eine Stunde), und die letzten Werte bleiben im Datenordner der Integration.

## Verwendung

### Geräte

Im Bildschirm „Entdecken“: ein Gerät **Weltraumwetter (NOAA)** und ein Gerät **Polarlicht** pro Zuhause mit Standort. Erstelle die gewünschten.

| Gerät                 | Funktionen                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weltraumwetter (NOAA) | Geschätzter Kp (letzte Minuten), Kp-Index (3 Std.), geomagnetischer Sturm (G 0–5), Strahlungssturm (S 0–5), Funkausfall (R 0–5), Sonnenwind (km/s), Magnetfeld Bz und Bt (nT), Radiofluss 10,7 cm (sfu), Röntgenklasse (ein Text, „B5.4“) |
| Polarlicht – Zuhause  | Polarlicht-Wahrscheinlichkeit (%), dunkler Himmel (1 = Sonne mehr als 6° unter dem Horizont), Kp heute Nacht                                                                                                                              |

Gladys hat keine Einheit für km/s, nT, sfu oder den Kp: Diese Funktionen haben keine Einheit, sie steht in ihrem Namen. Die Wahrscheinlichkeit gilt für Polarlicht im Zenit, der höchste Wert der neun 1°-Felder um das Zuhause; Polarlicht weiter nördlich kann trotzdem tief am Horizont zu sehen sein.

### Dashboard-Widgets

![Die drei Widgets: das aktuelle Weltraumwetter mit dem Kp der letzten Tage und der drei nächsten, die Polarlicht-Vorhersage eines Zuhauses, die letzten SWPC-Meldungen (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-noaa-space-weather/main/docs/assets/widgets.de.png)

- **Weltraumwetter**: eine Kp-Anzeige, die Stufen G, S und R, der Sonnenwind, Bz, der Kp der letzten zwei Tage und der drei nächsten, die Röntgenstrahlung, der letzte Flare, die letzte SWPC-Meldung.
- **Polarlicht-Vorhersage**: Wähle ein Polarlicht-Gerät (leer: das erste Zuhause mit Standort): Wahrscheinlichkeit, dunkler oder heller Himmel, Kp heute Nacht, Schwelle, die letzten 24 Stunden, die dunklen Stunden.
- **SWPC-Meldungen**: die letzten Meldungen mit Kurztitel in deiner Sprache, die Art als Badge, der englische Originaltext beim Öffnen. Einstellungen: Arten, Zeitraum.

### Szenen

Auslöser (jeder einmal pro Ereignis, nie beim Start):

- **NOAA: geomagnetischer Sturm**: Die Skala G erreicht eine neue Stufe; Filter nach Stufen (für „G3 oder mehr“ wähle G3, G4 und G5).
- **NOAA: geomagnetischer Sturm vorbei**: seit 3 Stunden wieder G0.
- **NOAA: Strahlungssturm** (S) und **NOAA: Funkausfall** (R): eine neue Stufe.
- **NOAA: Sonneneruption**: Ein Flare erreicht Klasse M oder X (Filter: nur X); ein Flare, der von M auf X wächst, löst erneut aus.
- **NOAA: Polarlicht möglich**: An einem Zuhause mit Polarlicht-Gerät erreicht die Wahrscheinlichkeit bei dunklem Himmel die Schwelle; **NOAA: Polarlicht vorbei** bei Dämmerung oder wenn sie sinkt.
- **NOAA: SWPC-Meldung**: jede neue Vorwarnung, Warnung, jeder Alarm oder jede Zusammenfassung, gefiltert nach Art und Thema.
- **NOAA: Sturm vorhergesagt**: ein Kp von 5 oder mehr in den nächsten 3 Tagen, einmal pro Episode.

Jeder Auslöser liefert einen fertigen Satz, `{{triggerEvent.data.sentence}}`, in der Sprache der Konfiguration.

Aktionen: **Weltraumwetter lesen**, **Polarlicht-Vorhersage lesen** (ein Zuhause), **3-Tage-Vorhersage lesen**, jede mit einem Satz `summary`. Sie antworten mit den letzten Messungen und lesen nur zu Altes neu.

Beispiele:

1. Wenn **geomagnetischer Sturm** mit den Stufen G3, G4, G5 → die Benachrichtigung `{{triggerEvent.data.sentence}}` senden.
2. Wenn **Polarlicht möglich** am Polarlicht-Gerät der Hütte → „Polarlicht heute Nacht möglich: {{triggerEvent.data.probability}} %, schau nach Norden“ senden.
3. Wenn **Sonneneruption** der Klasse X → „X-Flare: KW-Funk und GPS können gestört sein ({{triggerEvent.data.class}})“ an den Funkamateur des Hauses senden.

## Fehlerbehebung

- **Kein Polarlicht-Gerät**: Das Zuhause hat keinen Standort (Einstellungen → Zuhause), danach im Bildschirm „Entdecken“ neu suchen.
- **Das Polarlicht-Widget wartet**: Das OVATION-Raster wird in der Minute nach der ersten Anzeige gelesen; es erscheint nach wenigen Minuten.
- **„Das NOAA SWPC antwortet nicht“**: Der Dienst oder die Internetverbindung ist ausgefallen; die Integration versucht es selbst erneut, immer seltener (höchstens stündlich).
- **Ein Wert bleibt leer**: Ein Produkt, das älter als seine Frische ist (eine Stunde für den Sonnenwind), wird nicht als „aktuell“ angezeigt; das SWPC unterbricht manchmal einen Datenstrom.
- Logs: Einstellungen → Supervision; füge im Entwicklermodus `DEBUG=gladys-integration-sdk` für die SDK-Logs hinzu. Probleme: https://github.com/William-De71/gladys-noaa-space-weather/issues
