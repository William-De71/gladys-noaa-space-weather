// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: feature and device names, widget contents, statuses, scene texts
// and errors, results of the configuration buttons. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, maison / Zuhause / vivienda);
// German says "du", Spanish "usted", like Gladys. The texts of the SWPC
// messages are never translated: only their short titles are.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices and features
  deviceGlobal: {
    en: 'Space weather (NOAA)',
    fr: 'Météo spatiale (NOAA)',
    de: 'Weltraumwetter (NOAA)',
    es: 'Clima espacial (NOAA)',
  },
  deviceAurora: {
    en: 'Aurora – {house}',
    fr: 'Aurores – {house}',
    de: 'Polarlicht – {house}',
    es: 'Auroras – {house}',
  },
  feature_kp_estimated: {
    en: 'Estimated Kp',
    fr: 'Kp estimé',
    de: 'Geschätzter Kp',
    es: 'Kp estimado',
  },
  feature_kp: {
    en: 'Kp index (3 h)',
    fr: 'Indice Kp (3 h)',
    de: 'Kp-Index (3 Std.)',
    es: 'Índice Kp (3 h)',
  },
  feature_g_scale: {
    en: 'Geomagnetic storm (G)',
    fr: 'Orage géomagnétique (G)',
    de: 'Geomagnetischer Sturm (G)',
    es: 'Tormenta geomagnética (G)',
  },
  feature_s_scale: {
    en: 'Solar radiation storm (S)',
    fr: 'Tempête de radiations (S)',
    de: 'Strahlungssturm (S)',
    es: 'Tormenta de radiación (S)',
  },
  feature_r_scale: {
    en: 'Radio blackout (R)',
    fr: 'Black-out radio (R)',
    de: 'Funkausfall (R)',
    es: 'Apagón de radio (R)',
  },
  feature_solar_wind_speed: {
    en: 'Solar wind (km/s)',
    fr: 'Vent solaire (km/s)',
    de: 'Sonnenwind (km/s)',
    es: 'Viento solar (km/s)',
  },
  feature_bz: {
    en: 'Magnetic field Bz (nT)',
    fr: 'Champ magnétique Bz (nT)',
    de: 'Magnetfeld Bz (nT)',
    es: 'Campo magnético Bz (nT)',
  },
  feature_bt: {
    en: 'Magnetic field Bt (nT)',
    fr: 'Champ magnétique Bt (nT)',
    de: 'Magnetfeld Bt (nT)',
    es: 'Campo magnético Bt (nT)',
  },
  feature_radio_flux: {
    en: 'Radio flux 10.7 cm (sfu)',
    fr: 'Flux radio 10,7 cm (sfu)',
    de: 'Radiofluss 10,7 cm (sfu)',
    es: 'Flujo de radio 10,7 cm (sfu)',
  },
  feature_xray_class: {
    en: 'X-ray class',
    fr: 'Classe des rayons X',
    de: 'Röntgenklasse',
    es: 'Clase de rayos X',
  },
  feature_probability: {
    en: 'Aurora probability (%)',
    fr: 'Probabilité d’aurore (%)',
    de: 'Polarlicht-Wahrscheinlichkeit (%)',
    es: 'Probabilidad de aurora (%)',
  },
  feature_night: { en: 'Dark sky', fr: 'Nuit noire', de: 'Dunkler Himmel', es: 'Cielo oscuro' },
  feature_kp_tonight: {
    en: 'Kp expected tonight',
    fr: 'Kp prévu cette nuit',
    de: 'Kp heute Nacht',
    es: 'Kp previsto esta noche',
  },

  // levels of the NOAA scales (minor … extreme), per scale for the genders
  level_0: { en: 'quiet', fr: 'calme', de: 'ruhig', es: 'en calma' },
  g_1: { en: 'minor', fr: 'mineur', de: 'schwach', es: 'menor' },
  g_2: { en: 'moderate', fr: 'modéré', de: 'mäßig', es: 'moderada' },
  g_3: { en: 'strong', fr: 'fort', de: 'stark', es: 'fuerte' },
  g_4: { en: 'severe', fr: 'sévère', de: 'schwer', es: 'severa' },
  g_5: { en: 'extreme', fr: 'extrême', de: 'extrem', es: 'extrema' },
  s_1: { en: 'minor', fr: 'mineure', de: 'schwach', es: 'menor' },
  s_2: { en: 'moderate', fr: 'modérée', de: 'mäßig', es: 'moderada' },
  s_3: { en: 'strong', fr: 'forte', de: 'stark', es: 'fuerte' },
  s_4: { en: 'severe', fr: 'sévère', de: 'schwer', es: 'severa' },
  s_5: { en: 'extreme', fr: 'extrême', de: 'extrem', es: 'extrema' },
  r_1: { en: 'minor', fr: 'mineur', de: 'schwach', es: 'menor' },
  r_2: { en: 'moderate', fr: 'modéré', de: 'mäßig', es: 'moderado' },
  r_3: { en: 'strong', fr: 'fort', de: 'stark', es: 'fuerte' },
  r_4: { en: 'severe', fr: 'sévère', de: 'schwer', es: 'severo' },
  r_5: { en: 'extreme', fr: 'extrême', de: 'extrem', es: 'extremo' },

  // geomagnetic activity from the Kp (SWPC: 0-2 quiet, 3 unsettled, 4 active, 5+ storm)
  activity_quiet: { en: 'quiet', fr: 'calme', de: 'ruhig', es: 'en calma' },
  activity_unsettled: { en: 'unsettled', fr: 'agité', de: 'unruhig', es: 'inestable' },
  activity_active: { en: 'active', fr: 'actif', de: 'aktiv', es: 'activo' },
  activity_storm: {
    en: 'storm {level}',
    fr: 'orage {level}',
    de: 'Sturm {level}',
    es: 'tormenta {level}',
  },

  // get_space_weather
  sumKp: {
    en: 'Kp {kp} ({activity}).',
    fr: 'Kp {kp} ({activity}).',
    de: 'Kp {kp} ({activity}).',
    es: 'Kp {kp} ({activity}).',
  },
  sumScales: {
    en: 'NOAA scales: {g}, {s}, {r}.',
    fr: 'Échelles NOAA : {g}, {s}, {r}.',
    de: 'NOAA-Skalen: {g}, {s}, {r}.',
    es: 'Escalas NOAA: {g}, {s}, {r}.',
  },
  sumWind: {
    en: 'Solar wind {speed} km/s, Bz {bz} nT.',
    fr: 'Vent solaire {speed} km/s, Bz {bz} nT.',
    de: 'Sonnenwind {speed} km/s, Bz {bz} nT.',
    es: 'Viento solar {speed} km/s, Bz {bz} nT.',
  },
  sumWindOnly: {
    en: 'Solar wind {speed} km/s.',
    fr: 'Vent solaire {speed} km/s.',
    de: 'Sonnenwind {speed} km/s.',
    es: 'Viento solar {speed} km/s.',
  },
  sumXray: {
    en: 'X-rays: class {xray}.',
    fr: 'Rayons X : classe {xray}.',
    de: 'Röntgenstrahlung: Klasse {xray}.',
    es: 'Rayos X: clase {xray}.',
  },
  sumFlare: {
    en: 'Last flare {class} at {time}.',
    fr: 'Dernière éruption {class} à {time}.',
    de: 'Letzter Flare {class} um {time}.',
    es: 'Última fulguración {class} a las {time}.',
  },
  sumNoData: {
    en: 'No recent data from the NOAA SWPC.',
    fr: 'Aucune donnée récente du SWPC de la NOAA.',
    de: 'Keine aktuellen Daten vom NOAA SWPC.',
    es: 'Sin datos recientes del SWPC de la NOAA.',
  },

  // get_forecast
  fcKp: {
    en: 'Highest Kp expected: {today} today, {tomorrow} tomorrow, {after} the day after (UTC days).',
    fr: 'Kp maximal prévu : {today} aujourd’hui, {tomorrow} demain, {after} après-demain (jours UTC).',
    de: 'Höchster erwarteter Kp: {today} heute, {tomorrow} morgen, {after} übermorgen (UTC-Tage).',
    es: 'Kp máximo previsto: {today} hoy, {tomorrow} mañana, {after} pasado mañana (días UTC).',
  },
  fcStorm: {
    en: 'Geomagnetic storm expected: up to {level} ({description}).',
    fr: 'Orage géomagnétique prévu : jusqu’à {level} ({description}).',
    de: 'Geomagnetischer Sturm erwartet: bis {level} ({description}).',
    es: 'Tormenta geomagnética prevista: hasta {level} ({description}).',
  },
  fcNoStorm: {
    en: 'No geomagnetic storm expected.',
    fr: 'Pas d’orage géomagnétique prévu.',
    de: 'Kein geomagnetischer Sturm erwartet.',
    es: 'No se prevé ninguna tormenta geomagnética.',
  },
  fcProbabilities: {
    en: 'Chances within 3 days: radio blackout R1–R2 {r12} %, R3 or more {r3} %, radiation storm S1 or more {s1} %.',
    fr: 'Probabilités sur 3 jours : black-out radio R1–R2 {r12} %, R3 ou plus {r3} %, tempête de radiations S1 ou plus {s1} %.',
    de: 'Wahrscheinlichkeiten in 3 Tagen: Funkausfall R1–R2 {r12} %, R3 oder mehr {r3} %, Strahlungssturm S1 oder mehr {s1} %.',
    es: 'Probabilidades en 3 días: apagón de radio R1–R2 {r12} %, R3 o más {r3} %, tormenta de radiación S1 o más {s1} %.',
  },
  fcNoData: {
    en: 'No recent forecast from the NOAA SWPC.',
    fr: 'Aucune prévision récente du SWPC de la NOAA.',
    de: 'Keine aktuelle Vorhersage vom NOAA SWPC.',
    es: 'Sin previsión reciente del SWPC de la NOAA.',
  },

  // get_aurora
  auPlace: {
    en: '{house}: aurora probability {probability} %.',
    fr: '{house} : probabilité d’aurore {probability} %.',
    de: '{house}: Polarlicht-Wahrscheinlichkeit {probability} %.',
    es: '{house}: probabilidad de aurora {probability} %.',
  },
  auDarkUntil: {
    en: 'Dark sky until {time}.',
    fr: 'Nuit noire jusqu’à {time}.',
    de: 'Dunkler Himmel bis {time}.',
    es: 'Cielo oscuro hasta las {time}.',
  },
  auDark: {
    en: 'Dark sky.',
    fr: 'Nuit noire.',
    de: 'Dunkler Himmel.',
    es: 'Cielo oscuro.',
  },
  auDarkFrom: {
    en: 'Dark sky from {time}.',
    fr: 'Nuit noire à partir de {time}.',
    de: 'Dunkler Himmel ab {time}.',
    es: 'Cielo oscuro a partir de las {time}.',
  },
  auNoDark: {
    en: 'No dark sky in the next 24 hours.',
    fr: 'Pas de nuit noire dans les 24 prochaines heures.',
    de: 'Kein dunkler Himmel in den nächsten 24 Stunden.',
    es: 'Sin cielo oscuro en las próximas 24 horas.',
  },
  auKpTonight: {
    en: 'Highest Kp expected tonight: {kp}.',
    fr: 'Kp maximal prévu cette nuit : {kp}.',
    de: 'Höchster Kp heute Nacht: {kp}.',
    es: 'Kp máximo previsto esta noche: {kp}.',
  },
  auVerdict_none: {
    en: 'Aurora unlikely.',
    fr: 'Aurore improbable.',
    de: 'Polarlicht unwahrscheinlich.',
    es: 'Aurora improbable.',
  },
  auVerdict_low: {
    en: 'A faint chance of aurora.',
    fr: 'Faible chance d’aurore.',
    de: 'Geringe Chance auf Polarlicht.',
    es: 'Escasa probabilidad de aurora.',
  },
  auVerdict_north: {
    en: 'Aurora possible: look north, away from lights.',
    fr: 'Aurore possible : regardez vers le nord, loin des lumières.',
    de: 'Polarlicht möglich: Schau nach Norden, weg von Lichtern.',
    es: 'Aurora posible: mire hacia el norte, lejos de las luces.',
  },
  auVerdict_south: {
    en: 'Aurora possible: look south, away from lights.',
    fr: 'Aurore possible : regardez vers le sud, loin des lumières.',
    de: 'Polarlicht möglich: Schau nach Süden, weg von Lichtern.',
    es: 'Aurora posible: mire hacia el sur, lejos de las luces.',
  },
  auNoData: {
    en: 'No recent OVATION forecast.',
    fr: 'Pas de prévision OVATION récente.',
    de: 'Keine aktuelle OVATION-Vorhersage.',
    es: 'Sin previsión OVATION reciente.',
  },

  // scene events
  evStorm: {
    en: 'Geomagnetic storm {level} ({description}) in progress, Kp {kp}.',
    fr: 'Orage géomagnétique {level} ({description}) en cours, Kp {kp}.',
    de: 'Geomagnetischer Sturm {level} ({description}) im Gange, Kp {kp}.',
    es: 'Tormenta geomagnética {level} ({description}) en curso, Kp {kp}.',
  },
  evStormEnded: {
    en: 'The geomagnetic storm is over (up to {level}, {hours} h).',
    fr: 'L’orage géomagnétique est terminé (jusqu’à {level}, {hours} h).',
    de: 'Der geomagnetische Sturm ist vorbei (bis {level}, {hours} Std.).',
    es: 'La tormenta geomagnética ha terminado (hasta {level}, {hours} h).',
  },
  evRadiation: {
    en: 'Solar radiation storm {level} ({description}) in progress.',
    fr: 'Tempête de radiations solaires {level} ({description}) en cours.',
    de: 'Solarer Strahlungssturm {level} ({description}) im Gange.',
    es: 'Tormenta de radiación solar {level} ({description}) en curso.',
  },
  evRadio: {
    en: 'Radio blackout {level} ({description}): HF radio disturbed on the sunlit side of the Earth.',
    fr: 'Black-out radio {level} ({description}) : radio HF perturbée sur la face éclairée de la Terre.',
    de: 'Funkausfall {level} ({description}): KW-Funk auf der Tagseite der Erde gestört.',
    es: 'Apagón de radio {level} ({description}): radio HF perturbada en el lado diurno de la Tierra.',
  },
  evFlare: {
    en: 'Solar flare {class} (peak at {time}).',
    fr: 'Éruption solaire {class} (pic à {time}).',
    de: 'Sonneneruption {class} (Höhepunkt um {time}).',
    es: 'Fulguración solar {class} (pico a las {time}).',
  },
  evFlareX: {
    en: 'A major flare: HF radio blackouts and GPS errors are possible on the sunlit side.',
    fr: 'Éruption majeure : coupures de la radio HF et erreurs GPS possibles sur la face éclairée.',
    de: 'Ein großer Flare: KW-Funkausfälle und GPS-Fehler sind auf der Tagseite möglich.',
    es: 'Una fulguración mayor: posibles cortes de radio HF y errores de GPS en el lado diurno.',
  },
  evAurora: {
    en: '{house}: aurora possible, probability {probability} % (threshold {threshold} %), Kp {kp}.',
    fr: '{house} : aurore possible, probabilité {probability} % (seuil {threshold} %), Kp {kp}.',
    de: '{house}: Polarlicht möglich, Wahrscheinlichkeit {probability} % (Schwelle {threshold} %), Kp {kp}.',
    es: '{house}: aurora posible, probabilidad {probability} % (umbral {threshold} %), Kp {kp}.',
  },
  evAuroraEnded_dawn: {
    en: '{house}: the dark sky is over (aurora up to {probability} %).',
    fr: '{house} : la nuit noire est finie (aurore jusqu’à {probability} %).',
    de: '{house}: Der dunkle Himmel ist vorbei (Polarlicht bis {probability} %).',
    es: '{house}: se acabó el cielo oscuro (aurora hasta el {probability} %).',
  },
  evAuroraEnded_decreased: {
    en: '{house}: the aurora probability fell to {probability} %.',
    fr: '{house} : la probabilité d’aurore est retombée à {probability} %.',
    de: '{house}: Die Polarlicht-Wahrscheinlichkeit ist auf {probability} % gefallen.',
    es: '{house}: la probabilidad de aurora bajó al {probability} %.',
  },
  evForecast: {
    en: 'The NOAA expects a geomagnetic storm {level} (Kp {kp}) from {time}.',
    fr: 'La NOAA prévoit un orage géomagnétique {level} (Kp {kp}) à partir de {time}.',
    de: 'Die NOAA erwartet einen geomagnetischen Sturm {level} (Kp {kp}) ab {time}.',
    es: 'La NOAA prevé una tormenta geomagnética {level} (Kp {kp}) a partir de las {time}.',
  },

  // SWPC messages: kinds, statuses, subjects
  kind_watch: { en: 'Watch', fr: 'Veille', de: 'Vorwarnung', es: 'Vigilancia' },
  kind_warning: { en: 'Warning', fr: 'Avertissement', de: 'Warnung', es: 'Aviso' },
  kind_alert: { en: 'Alert', fr: 'Alerte', de: 'Alarm', es: 'Alerta' },
  kind_summary: { en: 'Summary', fr: 'Bilan', de: 'Zusammenfassung', es: 'Resumen' },
  kindStatus_extended: {
    en: '{kind} (extended)',
    fr: '{kind} (prolongation)',
    de: '{kind} (Verlängerung)',
    es: '{kind} (prórroga)',
  },
  kindStatus_continued: {
    en: '{kind} (continued)',
    fr: '{kind} (suite)',
    de: '{kind} (Fortsetzung)',
    es: '{kind} (continuación)',
  },
  kindStatus_cancelled: {
    en: '{kind} (cancelled)',
    fr: '{kind} (annulation)',
    de: '{kind} (Aufhebung)',
    es: '{kind} (cancelación)',
  },
  alertTitle: {
    en: '{kind}: {subject}',
    fr: '{kind} : {subject}',
    de: '{kind}: {subject}',
    es: '{kind}: {subject}',
  },
  subject_kindex_reached: {
    en: 'K-index of {k} reached',
    fr: 'indice K de {k} atteint',
    de: 'K-Index {k} erreicht',
    es: 'índice K de {k} alcanzado',
  },
  subject_kindex_expected: {
    en: 'K-index of {k} expected',
    fr: 'indice K de {k} attendu',
    de: 'K-Index {k} erwartet',
    es: 'índice K de {k} previsto',
  },
  subject_storm_predicted: {
    en: '{level} geomagnetic storm predicted',
    fr: 'orage géomagnétique {level} prévu',
    de: 'geomagnetischer Sturm {level} erwartet',
    es: 'tormenta geomagnética {level} prevista',
  },
  subject_impulse_expected: {
    en: 'sudden impulse expected',
    fr: 'impulsion soudaine attendue',
    de: 'plötzlicher Impuls erwartet',
    es: 'impulso repentino previsto',
  },
  subject_impulse_observed: {
    en: 'sudden impulse observed',
    fr: 'impulsion soudaine observée',
    de: 'plötzlicher Impuls beobachtet',
    es: 'impulso repentino observado',
  },
  subject_protons: {
    en: 'protons {mev} MeV above {pfu} pfu',
    fr: 'protons {mev} MeV au-delà de {pfu} pfu',
    de: 'Protonen {mev} MeV über {pfu} pfu',
    es: 'protones {mev} MeV por encima de {pfu} pfu',
  },
  subject_proton_event: {
    en: 'proton event',
    fr: 'événement à protons',
    de: 'Protonenereignis',
    es: 'evento de protones',
  },
  subject_electrons: {
    en: 'electrons {mev} MeV above {pfu} pfu',
    fr: 'électrons {mev} MeV au-delà de {pfu} pfu',
    de: 'Elektronen {mev} MeV über {pfu} pfu',
    es: 'electrones {mev} MeV por encima de {pfu} pfu',
  },
  subject_xray: {
    en: 'X-rays above {level}',
    fr: 'rayons X au-delà de {level}',
    de: 'Röntgenstrahlung über {level}',
    es: 'rayos X por encima de {level}',
  },
  subject_radio_emission: {
    en: 'type {type} radio emission',
    fr: 'émission radio de type {type}',
    de: 'Radioemission Typ {type}',
    es: 'emisión de radio de tipo {type}',
  },
  subject_radio_burst: {
    en: '10 cm radio burst',
    fr: 'sursaut radio à 10 cm',
    de: '10-cm-Radioausbruch',
    es: 'ráfaga de radio de 10 cm',
  },

  // widgets
  widgetWaiting: {
    en: 'Waiting for the first data of the NOAA SWPC.',
    fr: 'En attente des premières données du SWPC de la NOAA.',
    de: 'Warte auf die ersten Daten des NOAA SWPC.',
    es: 'Esperando los primeros datos del SWPC de la NOAA.',
  },
  widgetNoHouse: {
    en: 'No house of Gladys has a location: set it in Settings → Houses.',
    fr: 'Aucune maison de Gladys n’est localisée : réglez-la dans Paramètres → Maisons.',
    de: 'Kein Zuhause in Gladys hat einen Standort: Lege ihn unter Einstellungen → Zuhause fest.',
    es: 'Ninguna vivienda de Gladys tiene ubicación: configúrela en Configuración → Viviendas.',
  },
  widgetAuroraWaiting: {
    en: 'The OVATION forecast is read from now on: it shows here within a few minutes.',
    fr: 'La prévision OVATION est lue à partir de maintenant : elle s’affiche ici d’ici quelques minutes.',
    de: 'Die OVATION-Vorhersage wird ab jetzt gelesen: Sie erscheint hier in wenigen Minuten.',
    es: 'La previsión OVATION se lee a partir de ahora: aparecerá aquí en unos minutos.',
  },
  widgetCurveSoon: {
    en: 'The curve of the last 24 hours appears after a few readings.',
    fr: 'La courbe des dernières 24 heures apparaît après quelques relevés.',
    de: 'Die Kurve der letzten 24 Stunden erscheint nach einigen Messungen.',
    es: 'La curva de las últimas 24 horas aparece tras algunas lecturas.',
  },
  widgetNoAlerts: {
    en: 'No message from the SWPC in the last {days} days.',
    fr: 'Aucun message du SWPC ces {days} derniers jours.',
    de: 'Keine Meldung des SWPC in den letzten {days} Tagen.',
    es: 'Ningún mensaje del SWPC en los últimos {days} días.',
  },
  captionAurora: {
    en: '{house} · OVATION {time}',
    fr: '{house} · OVATION {time}',
    de: '{house} · OVATION {time}',
    es: '{house} · OVATION {time}',
  },
  captionAlerts: {
    en: '{count} messages in {days} days · NOAA SWPC',
    fr: '{count} messages en {days} jours · SWPC NOAA',
    de: '{count} Meldungen in {days} Tagen · NOAA SWPC',
    es: '{count} mensajes en {days} días · SWPC NOAA',
  },
  tileKp: { en: 'Kp now', fr: 'Kp actuel', de: 'Kp aktuell', es: 'Kp actual' },
  tileKpStorm: { en: 'Kp · {level}', fr: 'Kp · {level}', de: 'Kp · {level}', es: 'Kp · {level}' },
  tileScale_g: { en: 'Geomagnetic', fr: 'Géomagnétique', de: 'Geomagnetisch', es: 'Geomagnética' },
  tileScale_s: { en: 'Radiation', fr: 'Radiations', de: 'Strahlung', es: 'Radiación' },
  tileScale_r: { en: 'Radio', fr: 'Radio', de: 'Funk', es: 'Radio' },
  tileWind: { en: 'Solar wind', fr: 'Vent solaire', de: 'Sonnenwind', es: 'Viento solar' },
  tileBz: { en: 'Field Bz', fr: 'Champ Bz', de: 'Feld Bz', es: 'Campo Bz' },
  tileXray: { en: 'X-rays', fr: 'Rayons X', de: 'Röntgen', es: 'Rayos X' },
  tileFlux: { en: 'Flux 10.7 cm', fr: 'Flux 10,7 cm', de: 'Fluss 10,7 cm', es: 'Flujo 10,7 cm' },
  tileProbability: { en: 'Aurora', fr: 'Aurore', de: 'Polarlicht', es: 'Aurora' },
  tileSky: { en: 'Sky', fr: 'Ciel', de: 'Himmel', es: 'Cielo' },
  valueDark: { en: 'Dark', fr: 'Nuit', de: 'Dunkel', es: 'Oscuro' },
  valueLight: { en: 'Light', fr: 'Clair', de: 'Hell', es: 'Claro' },
  tileKpTonight: {
    en: 'Kp tonight',
    fr: 'Kp cette nuit',
    de: 'Kp heute Nacht',
    es: 'Kp esta noche',
  },
  tileThreshold: { en: 'Threshold', fr: 'Seuil', de: 'Schwelle', es: 'Umbral' },
  chartKp: {
    en: 'Kp: observed and expected',
    fr: 'Kp : observé et prévu',
    de: 'Kp: gemessen und erwartet',
    es: 'Kp: observado y previsto',
  },
  seriesObserved: { en: 'Observed', fr: 'Observé', de: 'Gemessen', es: 'Observado' },
  seriesPredicted: { en: 'Expected', fr: 'Prévu', de: 'Erwartet', es: 'Previsto' },
  annotationStorm: {
    en: '{level} expected',
    fr: '{level} prévu',
    de: '{level} erwartet',
    es: '{level} previsto',
  },
  chartAurora: {
    en: 'Aurora probability, 24 h',
    fr: 'Probabilité d’aurore, 24 h',
    de: 'Polarlicht, letzte 24 Std.',
    es: 'Probabilidad de aurora, 24 h',
  },
  seriesProbability: {
    en: 'Probability',
    fr: 'Probabilité',
    de: 'Wahrscheinlichkeit',
    es: 'Probabilidad',
  },
  rowFlare: {
    en: 'Last flare',
    fr: 'Dernière éruption',
    de: 'Letzter Flare',
    es: 'Última fulguración',
  },
  rowFlareValue: {
    en: '{class} at {time}',
    fr: '{class} à {time}',
    de: '{class} um {time}',
    es: '{class} a las {time}',
  },
  rowMessageAt: {
    en: '{kind}, {time}',
    fr: '{kind}, {time}',
    de: '{kind}, {time}',
    es: '{kind}, {time}',
  },
  rowNoMessage: {
    en: 'SWPC messages',
    fr: 'Messages SWPC',
    de: 'SWPC-Meldungen',
    es: 'Mensajes SWPC',
  },
  rowNoMessageValue: {
    en: 'none for 3 days',
    fr: 'aucun depuis 3 jours',
    de: 'keine seit 3 Tagen',
    es: 'ninguno en 3 días',
  },
  rowData: { en: 'NOAA data', fr: 'Données NOAA', de: 'NOAA-Daten', es: 'Datos NOAA' },
  rowObservation: {
    en: 'OVATION observation',
    fr: 'Observation OVATION',
    de: 'OVATION-Beobachtung',
    es: 'Observación OVATION',
  },
  rowDark: { en: 'Dark sky', fr: 'Nuit noire', de: 'Dunkler Himmel', es: 'Cielo oscuro' },
  rowDarkUntil: {
    en: 'until {time}',
    fr: 'jusqu’à {time}',
    de: 'bis {time}',
    es: 'hasta las {time}',
  },
  rowDarkWindow: {
    en: '{start} – {end}',
    fr: '{start} – {end}',
    de: '{start} – {end}',
    es: '{start} – {end}',
  },
  rowDarkFrom: { en: 'from {time}', fr: 'dès {time}', de: 'ab {time}', es: 'desde las {time}' },
  rowDarkNone: {
    en: 'not within 24 h',
    fr: 'pas dans les 24 h',
    de: 'nicht in 24 Std.',
    es: 'no en 24 h',
  },
  linkSwpc: {
    en: 'SWPC alerts',
    fr: 'Alertes du SWPC',
    de: 'SWPC-Meldungen',
    es: 'Alertas del SWPC',
  },

  // connection status and configuration buttons
  statusOk: {
    en: 'NOAA SWPC: Kp {kp}, {g} {s} {r}.',
    fr: 'SWPC NOAA : Kp {kp}, {g} {s} {r}.',
    de: 'NOAA SWPC: Kp {kp}, {g} {s} {r}.',
    es: 'SWPC NOAA: Kp {kp}, {g} {s} {r}.',
  },
  statusWaiting: {
    en: 'Reading the NOAA SWPC…',
    fr: 'Lecture du SWPC de la NOAA…',
    de: 'Lese das NOAA SWPC…',
    es: 'Leyendo el SWPC de la NOAA…',
  },
  statusUnreachable: {
    en: 'The NOAA SWPC has not answered since {time} ({detail}). Trying again.',
    fr: 'Le SWPC de la NOAA ne répond plus depuis {time} ({detail}). Nouvel essai en cours.',
    de: 'Das NOAA SWPC antwortet seit {time} nicht ({detail}). Neuer Versuch läuft.',
    es: 'El SWPC de la NOAA no responde desde las {time} ({detail}). Reintentando.',
  },
  statusNoHouse: {
    en: 'No located house: no aurora.',
    fr: 'Aucune maison localisée : pas d’aurores.',
    de: 'Kein Zuhause mit Standort: kein Polarlicht.',
    es: 'Ninguna vivienda con ubicación: sin auroras.',
  },
  testOk: {
    en: 'NOAA SWPC reached: Kp {kp} at {time}, NOAA scales {g} {s} {r}. Located houses: {houses}.',
    fr: 'SWPC de la NOAA joint : Kp {kp} à {time}, échelles NOAA {g} {s} {r}. Maisons localisées : {houses}.',
    de: 'NOAA SWPC erreicht: Kp {kp} um {time}, NOAA-Skalen {g} {s} {r}. Zuhause mit Standort: {houses}.',
    es: 'SWPC de la NOAA alcanzado: Kp {kp} a las {time}, escalas NOAA {g} {s} {r}. Viviendas con ubicación: {houses}.',
  },
  testFailed: {
    en: 'The NOAA SWPC did not answer: {detail}.',
    fr: 'Le SWPC de la NOAA n’a pas répondu : {detail}.',
    de: 'Das NOAA SWPC hat nicht geantwortet: {detail}.',
    es: 'El SWPC de la NOAA no respondió: {detail}.',
  },
  none: { en: 'none', fr: 'aucune', de: 'keines', es: 'ninguna' },
  diagnosticDone: {
    en: 'The state of the integration is in its logs ({count} line(s) "NOAA diagnostic").',
    fr: 'L’état de l’intégration est dans ses journaux ({count} ligne(s) « NOAA diagnostic »).',
    de: 'Der Zustand der Integration steht in ihren Logs ({count} Zeile(n) „NOAA diagnostic“).',
    es: 'El estado de la integración está en sus registros ({count} línea(s) «NOAA diagnostic»).',
  },
  errNoHouse: {
    en: 'No house of Gladys has a location: set it in Settings → Houses.',
    fr: 'Aucune maison de Gladys n’est localisée : réglez-la dans Paramètres → Maisons.',
    de: 'Kein Zuhause in Gladys hat einen Standort: Lege ihn unter Einstellungen → Zuhause fest.',
    es: 'Ninguna vivienda de Gladys tiene ubicación: configúrela en Configuración → Viviendas.',
  },
  errNoData: {
    en: 'No recent data from the NOAA SWPC ({detail}).',
    fr: 'Aucune donnée récente du SWPC de la NOAA ({detail}).',
    de: 'Keine aktuellen Daten vom NOAA SWPC ({detail}).',
    es: 'Sin datos recientes del SWPC de la NOAA ({detail}).',
  },

  // times
  never: { en: 'never', fr: 'jamais', de: 'nie', es: 'nunca' },
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: {
    en: '{n} days ago',
    fr: 'il y a {n} jours',
    de: 'vor {n} Tagen',
    es: 'hace {n} días',
  },
};

/**
 * @description Whether a value is a language of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, with its values.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The values of the `{placeholders}`.
 * @returns {string} The text, the key itself when unknown.
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string|Function} key - A TEXTS key, or `(language) => text`.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function'
        ? key(language)
        : t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) {
    return t('never', language);
  }
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) {
    return t('justNow', language);
  }
  if (minutes < 60) {
    return t('minutesAgo', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return t('hoursAgo', language, { n: hours });
  }
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

/**
 * @description A number in the format of a language.
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [decimals] - The decimals at most.
 * @returns {string} "2,33" in French.
 */
function formatNumber(value, language, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '–';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * @description A signed number: "+2", "−5,1".
 * @param {number} value - The number.
 * @param {string} language - The language.
 * @param {number} [decimals] - The decimals at most.
 * @returns {string} The text.
 */
function formatSigned(value, language, decimals = 1) {
  if (!Number.isFinite(value)) {
    return '–';
  }
  return new Intl.NumberFormat(isLanguage(language) ? language : 'en', {
    maximumFractionDigits: decimals,
    signDisplay: 'exceptZero',
  }).format(value);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, ago, formatNumber, formatSigned };
