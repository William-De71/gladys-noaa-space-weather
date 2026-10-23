// -----------------------------------------------------------------------------
// Dashboard widgets of the NOAA Space Weather integration.
//
//   - `overview`  space weather now: a Kp gauge (0–9), the NOAA scales G, S
//                 and R, the solar wind, Bz; the Kp
//                 of the last two days and of the next three (bars, a marker
//                 at now, an annotation on a predicted storm); the X-rays now,
//                 the last flare, the last SWPC message and the age of the data;
//   - `aurora`    a house (its Aurora device, or the first located house):
//                 the OVATION probability (gauge), dark or light sky, the Kp
//                 expected tonight, the threshold of the configuration, the
//                 probability over the last 24 hours, the dark hours;
//   - `alerts`    the last messages of the SWPC: a short title in the
//                 language of the user, the date, the kind as a badge, the
//                 original English text, a link to the SWPC page.
// The values are inline (never `device_feature`): the features carry no unit
// (km/s, nT have none in Gladys) and a tile must show it. No button: the
// readings follow their own rhythm. The content is cached per language.
// Content budget of a card: 8 components, 1 main one, 6 tiles, 2 texts (1
// body), 1 status, 4 buttons.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { t, ago } from './i18n.js';
import { formatTime, HOUR_MS, DAY_MS } from './time.js';
import { levelName, stormEpisodes } from './events.js';
import { alertTitle, alertSubject } from './alerts.js';
import { kpNowOf, roundKp, gOfKp } from './summary.js';

const WIDGETS = { OVERVIEW: 'overview', AURORA: 'aurora', ALERTS: 'alerts' };
const TTL_SECONDS = { overview: 120, aurora: 600, alerts: 600, message: 120 };
const SWPC_ALERTS_URL = 'https://www.swpc.noaa.gov/products/alerts-watches-and-warnings';
const ALERT_DAYS = ['1', '3', '7', '30'];
const DEFAULT_ALERT_DAYS = '7';
const KIND_COLORS = {
  alert: WIDGET_COLORS.DANGER,
  warning: WIDGET_COLORS.WARNING,
  watch: WIDGET_COLORS.INFO,
  summary: WIDGET_COLORS.NEUTRAL,
};

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {object} [options] - `{ heading, ttl }`.
 * @returns {object} The content.
 */
function messageContent(message, { heading, ttl = TTL_SECONDS.message } = {}) {
  const components = [];
  if (heading) {
    components.push({ type: 'text', variant: 'heading', text: clip(heading, 40) });
  }
  components.push({ type: 'text', variant: 'body', text: clip(message, 300) });
  return { ttl_seconds: ttl, components };
}

/**
 * @description The color of a Kp: quiet, active, storm.
 * @param {number} kp - The Kp.
 * @returns {string} A widget color.
 */
const kpColor = (kp) =>
  kp >= 5 - 1e-6
    ? WIDGET_COLORS.DANGER
    : kp >= 4 - 1e-6
      ? WIDGET_COLORS.WARNING
      : WIDGET_COLORS.SUCCESS;

/**
 * @description The color of the worst NOAA level.
 * @param {number} level - 0 to 5.
 * @returns {string} A widget color.
 */
const levelColor = (level) =>
  level >= 3 ? WIDGET_COLORS.DANGER : level >= 1 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;

/**
 * @description The "overview" widget.
 * @param {object} options - Options.
 * @param {object} options.view - The space weather view (app.js).
 * @param {string} options.language - The user language.
 * @param {string} [options.timeZone] - The timezone of Gladys.
 * @returns {object} The content.
 */
function buildOverviewWidget({ view, language, timeZone }) {
  const now = view.now;
  const kp = roundKp(kpNowOf(view));
  const scales = view.scales?.now ?? null;
  if (kp === null && !scales && !view.wind) {
    return messageContent(t('widgetWaiting', language));
  }
  const time = (instant) => formatTime(instant, { language, timeZone, now });
  const components = [];
  if (kp !== null) {
    components.push({
      type: 'gauge',
      value: kp,
      min: 0,
      max: 9,
      // A narrow tile: the G level of a storm fits, "unsettled" in Spanish does not.
      label: clip(
        gOfKp(kp) > 0
          ? t('tileKpStorm', language, { level: `G${gOfKp(kp)}` })
          : t('tileKp', language),
        24,
      ),
      color: kpColor(kp),
    });
  }
  if (scales) {
    // One tile per scale: "G2 S0 R1" in one tile is cut by the width of a tile.
    for (const scale of ['g', 's', 'r']) {
      const level = scales[scale] ?? 0;
      components.push({
        type: 'value',
        value: levelName(scale, level),
        label: clip(t(`tileScale_${scale}`, language), 24),
        icon: { g: 'globe', s: 'sun', r: 'radio' }[scale],
        color: levelColor(level),
      });
    }
  }
  if (view.wind) {
    const speed = Math.round(view.wind.speed);
    components.push({
      type: 'value',
      value: speed,
      unit: 'km/s',
      label: clip(t('tileWind', language), 24),
      icon: 'wind',
      color:
        speed >= 800
          ? WIDGET_COLORS.DANGER
          : speed >= 600
            ? WIDGET_COLORS.WARNING
            : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (Number.isFinite(view.mag?.bz)) {
    const bz = Math.round(view.mag.bz * 10) / 10;
    components.push({
      type: 'value',
      value: bz,
      unit: 'nT',
      label: clip(t('tileBz', language), 24),
      icon: 'compass',
      // A southward field (negative Bz) opens the door to the solar wind.
      color:
        bz <= -10 ? WIDGET_COLORS.DANGER : bz <= -5 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.NEUTRAL,
    });
  }
  const rows = view.forecast ?? [];
  const observed = rows.filter(
    (row) => row.kind !== 'predicted' && row.at >= now - 2 * DAY_MS && row.at <= now,
  );
  const predicted = rows.filter(
    (row) => row.kind === 'predicted' && row.at + 3 * HOUR_MS > now && row.at <= now + 3 * DAY_MS,
  );
  if (observed.length + predicted.length >= 2) {
    const series = [];
    if (observed.length) {
      series.push({
        name: clip(t('seriesObserved', language), 24),
        points: observed.map((row) => ({ t: new Date(row.at).toISOString(), v: roundKp(row.kp) })),
      });
    }
    if (predicted.length) {
      series.push({
        name: clip(t('seriesPredicted', language), 24),
        points: predicted.map((row) => ({ t: new Date(row.at).toISOString(), v: roundKp(row.kp) })),
      });
    }
    const storm = stormEpisodes(rows, now)[0];
    components.push({
      type: 'chart',
      chart_type: 'bar',
      title: clip(t('chartKp', language), 40),
      series,
      now_marker: true,
      ...(storm
        ? {
            annotations: [
              {
                t: new Date(storm.start).toISOString(),
                value: roundKp(storm.maxKp),
                label: clip(
                  t('annotationStorm', language, { level: `G${Math.max(1, gOfKp(storm.maxKp))}` }),
                  16,
                ),
                color: WIDGET_COLORS.DANGER,
              },
            ],
          }
        : {}),
    });
  }
  const items = [];
  if (view.xray) {
    const letter = view.xray.letter;
    items.push({
      label: clip(t('tileXray', language), 40),
      value: clip(view.xray.text, 40),
      color:
        letter === 'X'
          ? WIDGET_COLORS.DANGER
          : letter === 'M'
            ? WIDGET_COLORS.WARNING
            : WIDGET_COLORS.NEUTRAL,
    });
  }
  const flare = view.flare;
  if (flare?.maxClass && Number.isFinite(flare.max ?? flare.begin)) {
    const letter = flare.maxClass.letter;
    items.push({
      label: clip(t('rowFlare', language), 40),
      value: clip(
        t('rowFlareValue', language, {
          class: flare.maxClass.text,
          time: time(flare.max ?? flare.begin),
        }),
        40,
      ),
      color:
        letter === 'X'
          ? WIDGET_COLORS.DANGER
          : letter === 'M'
            ? WIDGET_COLORS.WARNING
            : WIDGET_COLORS.NEUTRAL,
    });
  }
  const recent = (view.alerts ?? []).find((message) => message.issued >= now - 3 * DAY_MS);
  if (recent) {
    items.push({
      label: clip(
        t('rowMessageAt', language, {
          kind: t(`kind_${recent.kind}`, language),
          time: time(recent.issued),
        }),
        40,
      ),
      value: clip(alertSubject(recent, language), 40),
      color: KIND_COLORS[recent.kind] ?? WIDGET_COLORS.NEUTRAL,
    });
  } else if (view.alertsRead) {
    items.push({
      label: clip(t('rowNoMessage', language), 40),
      value: clip(t('rowNoMessageValue', language), 40),
      color: WIDGET_COLORS.SUCCESS,
    });
  }
  if (Number.isFinite(view.updatedAt)) {
    items.push({
      label: clip(t('rowData', language), 40),
      value: clip(ago(view.updatedAt, now, language), 40),
      color: now - view.updatedAt > 30 * 60 * 1000 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    });
  }
  if (items.length) {
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: TTL_SECONDS.overview, components };
}

/**
 * @description The "aurora" widget of a house.
 * @param {object} options - Options.
 * @param {object} options.aurora - The aurora view of the house (app.js).
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now (ms).
 * @param {string} [options.timeZone] - The timezone of Gladys.
 * @returns {object} The content.
 */
function buildAuroraWidget({ aurora, language, now, timeZone }) {
  const { house, darkness } = aurora;
  if (!Number.isFinite(aurora.observation)) {
    return messageContent(t('widgetAuroraWaiting', language), { heading: house.name });
  }
  const time = (instant) => formatTime(instant, { language, timeZone, now });
  const probability = aurora.fresh ? aurora.probability : null;
  const components = [
    {
      type: 'text',
      variant: 'caption',
      text: clip(
        t('captionAurora', language, { house: house.name, time: time(aurora.observation) }),
        80,
      ),
    },
  ];
  if (probability !== null) {
    components.push({
      type: 'gauge',
      value: probability,
      min: 0,
      max: 100,
      unit: '%',
      label: clip(t('tileProbability', language), 24),
      color:
        probability >= aurora.threshold
          ? WIDGET_COLORS.SUCCESS
          : probability >= 5
            ? WIDGET_COLORS.INFO
            : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (darkness) {
    components.push({
      type: 'value',
      value: clip(t(darkness.dark ? 'valueDark' : 'valueLight', language), 12),
      label: clip(t('tileSky', language), 24),
      icon: darkness.dark ? 'moon' : 'sun',
      color: darkness.dark ? WIDGET_COLORS.PRIMARY : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (Number.isFinite(aurora.kpTonight)) {
    components.push({
      type: 'value',
      value: aurora.kpTonight,
      label: clip(t('tileKpTonight', language), 24),
      icon: 'activity',
      color: kpColor(aurora.kpTonight),
    });
  }
  components.push({
    type: 'value',
    value: aurora.threshold,
    unit: '%',
    label: clip(t('tileThreshold', language), 24),
    icon: 'sliders',
  });
  const history = (aurora.history ?? []).filter((point) => point.t >= now - DAY_MS);
  if (history.length >= 2) {
    components.push({
      type: 'chart',
      chart_type: 'area',
      title: clip(t('chartAurora', language), 40),
      unit: '%',
      series: [
        {
          name: clip(t('seriesProbability', language), 24),
          points: history.map((point) => ({ t: new Date(point.t).toISOString(), v: point.v })),
        },
      ],
    });
  } else {
    components.push({
      type: 'text',
      variant: 'body',
      text: clip(t('widgetCurveSoon', language), 300),
    });
  }
  const items = [];
  if (darkness) {
    let value;
    if (darkness.dark) {
      value = Number.isFinite(darkness.end)
        ? t('rowDarkUntil', language, { time: time(darkness.end) })
        : t('valueDark', language);
    } else if (Number.isFinite(darkness.start) && Number.isFinite(darkness.end)) {
      value = t('rowDarkWindow', language, {
        start: time(darkness.start),
        end: time(darkness.end),
      });
    } else if (Number.isFinite(darkness.start)) {
      value = t('rowDarkFrom', language, { time: time(darkness.start) });
    } else {
      value = t('rowDarkNone', language);
    }
    items.push({
      label: clip(t('rowDark', language), 40),
      value: clip(value, 40),
      color: darkness.dark ? WIDGET_COLORS.PRIMARY : WIDGET_COLORS.NEUTRAL,
    });
  }
  items.push({
    label: clip(t('rowObservation', language), 40),
    value: clip(ago(aurora.observation, now, language), 40),
    color: aurora.fresh ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
  });
  components.push({ type: 'status', items });
  return { ttl_seconds: TTL_SECONDS.aurora, components };
}

/**
 * @description The "alerts" widget.
 * @param {object} options - Options.
 * @param {object[]} options.alerts - The messages (newest first).
 * @param {string} options.language - The user language.
 * @param {number} options.now - Now (ms).
 * @param {object} [options.settings] - `{ types, days }`.
 * @returns {object} The content.
 */
function buildAlertsWidget({ alerts, language, now, settings = {} }) {
  const days = ALERT_DAYS.includes(String(settings.days))
    ? Number(settings.days)
    : Number(DEFAULT_ALERT_DAYS);
  const types = Array.isArray(settings.types) && settings.types.length ? settings.types : null;
  const shown = (alerts ?? []).filter(
    (message) =>
      Number.isFinite(message.issued) &&
      message.issued >= now - days * DAY_MS &&
      (!types || types.includes(message.kind)),
  );
  if (shown.length === 0) {
    return messageContent(t('widgetNoAlerts', language, { days }), { ttl: TTL_SECONDS.alerts });
  }
  return {
    ttl_seconds: TTL_SECONDS.alerts,
    components: [
      {
        type: 'text',
        variant: 'caption',
        text: clip(t('captionAlerts', language, { count: shown.length, days }), 80),
      },
      {
        type: 'card-list',
        display: 'list',
        items: shown.slice(0, 8).map((message) => ({
          title: clip(alertTitle(message, language), 60),
          date: new Date(message.issued).toISOString(),
          badge: {
            text: clip(t(`kind_${message.kind}`, language), 16),
            color: KIND_COLORS[message.kind] ?? WIDGET_COLORS.NEUTRAL,
          },
          description: clip(message.text, 2000),
          links: [{ url: SWPC_ALERTS_URL, label: clip(t('linkSwpc', language), 24) }],
        })),
      },
    ],
  };
}

export {
  WIDGETS,
  TTL_SECONDS,
  ALERT_DAYS,
  DEFAULT_ALERT_DAYS,
  SWPC_ALERTS_URL,
  clip,
  messageContent,
  buildOverviewWidget,
  buildAuroraWidget,
  buildAlertsWidget,
};
